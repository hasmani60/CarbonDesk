// backend/server.js - Fixed Server with Increased Rate Limits
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// Import local database
const localDB = require('./database/localDB');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const { 
  authenticateToken, 
  requireAdmin, 
  checkScopeAccess, 
  checkActivityAccess, 
  checkPageAccess,
  enforceRouteAccess,
  authorizeRoles
} = require('./middleware/auth');

// Import organisation scoping middleware
const { 
  addOrganisationContext, 
  requireOrganisation 
} = require('./middleware/organisationScope');

// Import company middleware
const {
  authenticateCompanyOperator,
  canCreateOrganisations,
  canManageOrganisations,
  requireSuperOperator,
  logCompanyActivity
} = require('./middleware/companyAuth');

const app = express();

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// ============================================
// RATE LIMITING - INCREASED LIMITS TO PREVENT 429 ERRORS
// ============================================

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased from 200 to 1000 requests per 15 minutes
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Increased from 100 to 500 requests per 15 minutes
  message: { error: 'Too many admin requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const companyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Increased from 50 to 200 requests per 15 minutes
  message: { error: 'Too many company operations requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================
// MIDDLEWARE
// ============================================

app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));
app.use(compression());

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('combined'));
}

// CORS configuration
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000',
      process.env.CLIENT_URL
    ].filter(Boolean);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(null, true); // Allow for development - remove in production
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,
  preflightContinue: false
}));

// Apply general rate limiting
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============================================
// HEALTH CHECK ENDPOINT
// ============================================

app.get('/health', (req, res) => {
  const healthData = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '2.0.1',
    database: 'Local SQLite Database (Active)',
    port: process.env.PORT || 5001,
    rateLimits: {
      general: '1000 requests per 15 minutes',
      admin: '500 requests per 15 minutes',
      company: '200 requests per 15 minutes'
    },
    features: {
      multiUser: true,
      adminMonitoring: true,
      auditLogging: true,
      roleBasedAccess: true,
      localDatabase: true,
      rbacSupport: true,
      strictRBAC: true,
      multiTenant: true,
      companyOperations: true,
      taskManagement: true,
      taskAssignment: true,
      workflowTracking: true,
      increasedRateLimits: true
    }
  };
  
  res.status(200).json(healthData);
  console.log('Health check requested:', healthData);
});

// ============================================
// IMPORT CONTROLLERS
// ============================================

const authController = require('./controllers/authController');
const userController = require('./controllers/userController');
const adminController = require('./controllers/adminController');
const dashboardController = require('./controllers/dashboardController');
const emissionController = require('./controllers/emissionController');
const companyController = require('./controllers/companyController');

// ============================================
// COMPANY OPERATIONS ROUTES (HIDDEN)
// ============================================

console.log('🏢 Registering Company Operations routes...');

// Company Auth Routes - NO authentication required for login
const companyAuthRouter = express.Router();
companyAuthRouter.post('/login', companyController.companyLogin);
companyAuthRouter.get('/profile', authenticateCompanyOperator, companyController.getCompanyProfile);

app.use('/api/company/auth', companyLimiter, companyAuthRouter);
console.log('✅ Company auth routes registered: /api/company/auth');

// Company Dashboard Routes - Requires authentication
const companyDashboardRouter = express.Router();
companyDashboardRouter.get('/', companyController.getCompanyDashboard);

app.use('/api/company/dashboard', 
  companyLimiter, 
  authenticateCompanyOperator, 
  companyDashboardRouter
);
console.log('✅ Company dashboard routes registered: /api/company/dashboard');

// Company Organisation Routes - Requires authentication
const companyOrgRouter = express.Router();

// CREATE new organisation (with super admin)
companyOrgRouter.post('/', 
  canCreateOrganisations, 
  logCompanyActivity('org_create', 'Creating new organisation'), 
  companyController.createOrganisation
);

// GET all organisations
companyOrgRouter.get('/', 
  companyController.getAllOrganisations
);

// GET organisation by ID
companyOrgRouter.get('/:id', 
  companyController.getOrganisationById
);

// UPDATE organisation
companyOrgRouter.patch('/:id', 
  canManageOrganisations, 
  logCompanyActivity('org_update', 'Updating organisation'), 
  companyController.updateOrganisation
);

// DELETE/DEACTIVATE organisation
companyOrgRouter.delete('/:id', 
  canManageOrganisations, 
  logCompanyActivity('org_deactivate', 'Deactivating organisation'), 
  companyController.deactivateOrganisation
);

// GET organisation stats
companyOrgRouter.get('/:id/stats', 
  companyController.getOrganisationStats
);

app.use('/api/company/organisations', 
  companyLimiter, 
  authenticateCompanyOperator, 
  companyOrgRouter
);
console.log('✅ Company organisation routes registered: /api/company/organisations');

// Test endpoint to verify company routes are working
app.get('/api/company/test', (req, res) => {
  res.json({
    success: true,
    message: 'Company operations endpoint is accessible',
    timestamp: new Date().toISOString(),
    availableRoutes: [
      'POST /api/company/auth/login',
      'GET /api/company/auth/profile',
      'GET /api/company/dashboard',
      'POST /api/company/organisations',
      'GET /api/company/organisations',
      'GET /api/company/organisations/:id'
    ]
  });
});
console.log('✅ Company test route registered: /api/company/test');

console.log('🏢 ================================');
console.log('🏢 Company Operations routes ready!');
console.log('🏢 ================================\n');


// ============================================
// REGULAR USER AUTHENTICATION ROUTES
// ============================================

const authRouter = express.Router();
authRouter.post('/login', authController.login);
authRouter.post('/register', authenticateToken, requireAdmin, authController.register);
authRouter.post('/logout', authenticateToken, authController.logout);
authRouter.get('/verify', authenticateToken, authController.verifyToken);
authRouter.patch('/profile', authenticateToken, authController.updateProfile);
authRouter.patch('/change-password', authenticateToken, authController.changePassword);
app.use('/api/auth', authRouter);

// ============================================
// ADMIN ROUTES
// ============================================

const adminRouter = express.Router();
adminRouter.get('/dashboard', adminController.getAdminDashboard);
adminRouter.get('/activities', adminController.getAllActivities);
adminRouter.get('/user-summary', adminController.getUserActivitySummary);
app.use('/api/admin', adminLimiter, authenticateToken, requireAdmin, adminRouter);

// ============================================
// USER MANAGEMENT ROUTES (WITH ORG CONTEXT)
// ============================================

const userRouter = express.Router();
userRouter.get('/', addOrganisationContext, userController.getUsers);
userRouter.get('/stats', addOrganisationContext, userController.getUserStats);
userRouter.get('/rbac-options', userController.getRBACOptions);
userRouter.get('/:id', addOrganisationContext, userController.getUserById);
userRouter.post('/', addOrganisationContext, requireAdmin, userController.createUser);
userRouter.patch('/:id/role', addOrganisationContext, requireAdmin, userController.updateUserRole);
userRouter.patch('/:id/restrictions', addOrganisationContext, requireAdmin, userController.updateUserRestrictions);
userRouter.patch('/:id/status', addOrganisationContext, requireAdmin, userController.updateUserStatus);
userRouter.delete('/:id', addOrganisationContext, requireAdmin, userController.deleteUser);
userRouter.patch('/bulk', addOrganisationContext, requireAdmin, userController.bulkUpdateUsers);
app.use('/api/users', authenticateToken, userRouter);

// ============================================
// EMISSION ROUTES (WITH ORG CONTEXT & RBAC)
// ============================================

const emissionRouter = express.Router();

emissionRouter.get('/', 
  addOrganisationContext,
  authorizeRoles('admin', 'analyst', 'contributor', 'viewer'),
  requireOrganisation,
  emissionController.getEmissions
);

emissionRouter.get('/categories',
  addOrganisationContext,
  authorizeRoles('admin', 'analyst', 'contributor'),
  requireOrganisation,
  emissionController.getEmissionCategories
);

emissionRouter.get('/stats',
  addOrganisationContext,
  authorizeRoles('admin', 'analyst', 'viewer'),
  requireOrganisation,
  emissionController.getEmissionStats
);

emissionRouter.get('/user/allowed-activities',
  authorizeRoles('admin', 'analyst', 'contributor', 'viewer'),
  emissionController.getUserAllowedActivities
);

emissionRouter.get('/:id',
  addOrganisationContext,
  authorizeRoles('admin', 'analyst', 'contributor', 'viewer'),
  requireOrganisation,
  emissionController.getEmissionById
);

emissionRouter.post('/', 
  addOrganisationContext,
  authorizeRoles('admin', 'contributor'),
  requireOrganisation,
  emissionController.createEmission
);

emissionRouter.patch('/:id',
  addOrganisationContext,
  authorizeRoles('admin', 'contributor'),
  requireOrganisation,
  emissionController.updateEmission
);

emissionRouter.patch('/:id/verify',
  addOrganisationContext,
  authorizeRoles('admin', 'analyst'),
  requireOrganisation,
  emissionController.verifyEmission
);

emissionRouter.delete('/:id',
  addOrganisationContext,
  authorizeRoles('admin', 'contributor'),
  requireOrganisation,
  emissionController.deleteEmission
);

app.use('/api/emissions', authenticateToken, emissionRouter);

// ============================================
// TASK MANAGEMENT ROUTES (NEW)
// ============================================

const taskRouter = express.Router();

// Import task routes
const taskRoutes = require('./routes/tasks');

// Apply middleware stack, then mount the routes
app.use('/api/tasks', 
  authenticateToken,              // 1. Authenticate user
  addOrganisationContext,         // 2. Add organisation context  
  requireOrganisation,            // 3. Ensure user belongs to organisation
  taskRoutes                      // 4. Apply task routes (which have role-based auth)
);

console.log('✅ Task management routes registered: /api/tasks');

// ============================================
// DASHBOARD ROUTES (WITH ORG CONTEXT & RBAC)
// ============================================

const dashboardRouter = express.Router();
dashboardRouter.get('/summary', 
  addOrganisationContext,
  authorizeRoles('admin', 'viewer', 'contributor'),
  requireOrganisation,
  dashboardController.getDashboardSummary
);
dashboardRouter.get('/notifications', 
  addOrganisationContext,
  authorizeRoles('admin', 'viewer', 'contributor'),
  dashboardController.getDashboardNotifications
);
app.use('/api/dashboard', authenticateToken, dashboardRouter);

// ============================================
// ANALYTICS ROUTES (Admin, Analyst, Viewer)
// ============================================

const analysisRouter = require('./routes/analytics');

// Analysis endpoints - uses SAME middleware pattern as your existing routes
app.use('/api/analysis', 
  authenticateToken,              // Your existing auth middleware
  addOrganisationContext,         // Your existing org context middleware
  requireOrganisation,            // Your existing org requirement middleware
  authorizeRoles('admin', 'analyst', 'viewer'),  // Your existing RBAC middleware
  analysisRouter
);

// ============================================
// MONITOR ROUTES (Admin, Viewer)
// ============================================

const monitorRouter = express.Router();
monitorRouter.get('*', 
  authorizeRoles('admin', 'viewer'),
  (req, res) => {
    res.json({ 
      message: 'Monitor endpoint placeholder', 
      userRole: req.user.role,
      hasAccess: true
    });
  }
);
app.use('/api/monitor', authenticateToken, monitorRouter);

// ============================================
// SETTINGS ROUTES (All authenticated users)
// ============================================

const settingsRouter = express.Router();
settingsRouter.get('*', 
  authorizeRoles('admin', 'analyst', 'contributor', 'viewer'),
  (req, res) => {
    res.json({ 
      message: 'Settings endpoint placeholder', 
      userRole: req.user.role,
      hasAccess: true
    });
  }
);
app.use('/api/settings', authenticateToken, settingsRouter);

// ============================================
// UTILITY ENDPOINTS
// ============================================

// Organisation info endpoint
app.get('/api/organisation/info', authenticateToken, addOrganisationContext, (req, res) => {
  if (!req.organisationId) {
    return res.json({
      success: true,
      data: {
        hasOrganisation: false,
        message: 'User not assigned to any organisation'
      }
    });
  }
  
  res.json({
    success: true,
    data: {
      hasOrganisation: true,
      organisation: {
        id: req.organisation.id,
        name: req.organisation.name,
        display_name: req.organisation.display_name,
        industry_type: req.organisation.industry_type,
        subscription_tier: req.organisation.subscription_tier
      },
      settings: req.organisationSettings ? {
        currency: req.organisationSettings.currency,
        timezone: req.organisationSettings.timezone
      } : null
    }
  });
});

// Debug context endpoint
app.get('/api/debug/context', authenticateToken, addOrganisationContext, (req, res) => {
  res.json({
    success: true,
    debug: {
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
        organisation_id: req.user.organisation_id
      },
      context: {
        organisationId: req.organisationId,
        hasOrganisation: !!req.organisation,
        organisationName: req.organisation?.name || null
      }
    }
  });
});

// Access control endpoints
app.get('/api/access/scope/:scope', authenticateToken, (req, res) => {
  const scope = req.params.scope;
  try {
    checkScopeAccess(scope)(req, res, () => {
      res.json({
        success: true,
        hasAccess: true,
        scope: scope,
        userRole: req.user.role,
        restrictions: req.user.restrictions
      });
    });
  } catch (error) {
    res.status(403).json({
      success: false,
      hasAccess: false,
      scope: scope,
      userRole: req.user.role,
      message: error.message
    });
  }
});

app.get('/api/access/page/:page', authenticateToken, (req, res) => {
  const page = `/${req.params.page}`;
  try {
    checkPageAccess(page)(req, res, () => {
      res.json({
        success: true,
        hasAccess: true,
        page: page,
        userRole: req.user.role,
        restrictions: req.user.restrictions
      });
    });
  } catch (error) {
    res.status(403).json({
      success: false,
      hasAccess: false,
      page: page,
      userRole: req.user.role,
      message: error.message
    });
  }
});

// RBAC info endpoint
app.get('/api/rbac/info', authenticateToken, addOrganisationContext, (req, res) => {
  const { role } = req.user;
  
  const rolePermissions = {
    admin: {
      pages: ['dashboard', 'input', 'monitor', 'analytics', 'settings', 'admin'],
      actions: ['create', 'read', 'update', 'delete', 'verify', 'manage_users'],
      scopes: [1, 2, 3],
      description: 'Full system access'
    },
    analyst: {
      pages: ['analytics', 'settings'],
      actions: ['read', 'verify'],
      scopes: [1, 2, 3],
      description: 'Analytics and verification access only'
    },
    contributor: {
      pages: ['input', 'settings'],
      actions: ['create', 'read', 'update', 'delete'],
      scopes: req.user.restrictions?.allowedScopes || [1, 2, 3],
      description: 'Data entry and management only'
    },
    viewer: {
      pages: ['dashboard', 'monitor', 'analytics', 'settings'],
      actions: ['read'],
      scopes: [1, 2, 3],
      description: 'Read-only access to data and analytics'
    }
  };

  res.json({
    success: true,
    data: {
      userRole: role,
      permissions: rolePermissions[role] || rolePermissions.viewer,
      restrictions: req.user.restrictions || null,
      organisation_id: req.organisationId || null,
      organisation_name: req.organisation?.name || null
    }
  });
});

// ============================================
// PLACEHOLDER ROUTES
// ============================================

app.use('/api/vehicles', authenticateToken, (req, res) => {
  res.json({ message: 'Vehicles endpoint placeholder' });
});

app.use('/api/generators', authenticateToken, (req, res) => {
  res.json({ message: 'Generators endpoint placeholder' });
});

app.use('/api/organization', authenticateToken, (req, res) => {
  res.json({ message: 'Organization endpoint placeholder' });
});

app.use('/api/notifications', authenticateToken, (req, res) => {
  res.json({ success: true, data: [] });
});

app.use('/api/export', authenticateToken, authorizeRoles('admin', 'analyst'), (req, res) => {
  res.json({ message: 'Export endpoint placeholder - Admin/Analyst only' });
});

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================

const errorHandlerMiddleware = (err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: Object.values(err.errors).map(e => e.message)
    });
  }
  
  if (err.code === 11000) {
    return res.status(400).json({
      success: false,
      message: 'Duplicate key error'
    });
  }
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
};

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API route ${req.originalUrl} not found`
  });
});

// 404 handler for all other routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Error handling middleware (must be last)
app.use(errorHandlerMiddleware);

// ============================================
// DATABASE CONNECTION & STARTUP
// ============================================

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.log('⚠️  MONGODB_URI not set - using local SQLite database');
      return false;
    }
    
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host} (Secondary)`);
    return true;
  } catch (error) {
    console.log('⚠️  MongoDB not available - using local SQLite database (Primary)');
    return false;
  }
};

const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received, shutting down gracefully`);
  
  try {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('MongoDB connection closed');
    }
    
    if (localDB) {
      localDB.close();
      console.log('Local database connection closed');
    }
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
  
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

const PORT = process.env.PORT || 5001;

const startServer = async () => {
  try {
    await localDB.init();
    await localDB.createTasksTable();
    await connectDB();
    
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('');
      console.log('🚀 ================================');
      console.log(`📊 Carbon Accounting Backend v2.0.1`);
      console.log(`🌐 Server running on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 API Base: http://localhost:${PORT}/api`);
      console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
      console.log('');
      console.log(`⚡ RATE LIMITS (UPDATED):`);
      console.log(`   📊 General: 1000 req/15min (increased from 200)`);
      console.log(`   🔐 Admin: 500 req/15min (increased from 100)`);
      console.log(`   🏢 Company: 200 req/15min (increased from 50)`);
      console.log('');
      console.log(`✨ FEATURES:`);
      console.log(`   👥 Multi-User Support: Enabled`);
      console.log(`   🏢 Multi-Tenant: Enabled (Organisation Scoping)`);
      console.log(`   🔒 Strict RBAC: Enforced`);
      console.log(`   📋 Admin Monitoring: Enabled`);
      console.log(`   📝 Activity Logging: Enhanced`);
      console.log(`   📋 Task Management: Enabled`);
      console.log(`   👥 Task Assignment: Enabled`);
      console.log(`   🔄 Workflow Tracking: Enabled`);
      console.log(`   🗄️  Database: Local SQLite (Primary)`);
      console.log('');
      console.log(`🔐 COMPANY OPERATIONS (HIDDEN)`);
      console.log(`   ⚠️  Internal Use Only`);
      console.log(`   Base URL: http://localhost:${PORT}/api/company`);
      console.log('');
      console.log(`📌 DEFAULT CREDENTIALS:`);
      console.log(`   🔴 Company: admin@carbontrack-company.com / CompanyAdmin2025!`);
      console.log(`   🟢 Demo Admin: demo@example.com / password123`);
      console.log('');
      console.log(`📋 TASK MANAGEMENT ENDPOINTS:`);
      console.log(`   POST /api/tasks - Create task (Admin)`);
      console.log(`   GET /api/tasks - Get tasks (Role-based)`);
      console.log(`   PATCH /api/tasks/:id - Update task`);
      console.log(`   GET /api/tasks/stats - Task statistics`);
      console.log('');
      console.log(`💚 Status: Ready (429 Errors Fixed)`);
      console.log('🚀 ================================');
      console.log('');
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use.`);
        process.exit(1);
      } else {
        console.error('❌ Server error:', error);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = app;