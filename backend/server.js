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

// Import logger
const logger = require('./utils/logger');

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

const organisationRoutes = require('./routes/organisation');

const app = express();

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// ============================================
// RATE LIMITING - DISABLED IN DEVELOPMENT, ENABLED IN PRODUCTION
// ============================================

// Disable rate limiting in development
const isDevelopment = process.env.NODE_ENV !== 'production';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 10000 : 1000, // Much higher limit in dev
  skip: () => isDevelopment, // Skip rate limiting in development
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 10000 : 500,
  skip: () => isDevelopment, // Skip rate limiting in development
  message: { error: 'Too many admin requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const companyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 10000 : 200,
  skip: () => isDevelopment, // Skip rate limiting in development
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
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  : [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000',
      process.env.CLIENT_URL
    ].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, curl)
    if (!origin) return callback(null, true);

    if (corsOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // In production, reject unauthorized origins
      if (process.env.NODE_ENV === 'production') {
        logger.warn('CORS blocked origin', { origin });
        callback(new Error('Not allowed by CORS'));
      } else {
        // In development, allow but log
        logger.debug('CORS origin not in whitelist (allowed in dev)', { origin });
        callback(null, true);
      }
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

// Company Auth Routes - NO authentication required for login
const companyAuthRouter = express.Router();
companyAuthRouter.post('/login', companyController.companyLogin);
companyAuthRouter.get('/profile', authenticateCompanyOperator, companyController.getCompanyProfile);

app.use('/api/company/auth', companyLimiter, companyAuthRouter);

// Company Dashboard Routes - Requires authentication
const companyDashboardRouter = express.Router();
companyDashboardRouter.get('/', companyController.getCompanyDashboard);

app.use('/api/company/dashboard',
  companyLimiter,
  authenticateCompanyOperator,
  companyDashboardRouter
);

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


// ============================================
// ORGANISATION ROUTES (For Regular Admins)
// ============================================

app.use('/api/organisation',
  authenticateToken,
  addOrganisationContext,
  requireOrganisation,
  organisationRoutes
);


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
  authenticateToken,
  addOrganisationContext,
  requireOrganisation,
  taskRoutes
);

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

// Analysis endpoints
app.use('/api/analysis',
  authenticateToken,
  addOrganisationContext,
  requireOrganisation,
  authorizeRoles('admin', 'analyst', 'viewer'),
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
// ERROR HANDLING MIDDLEWARE
// ============================================

const errorHandlerMiddleware = (err, req, res, next) => {
  logger.error('Request error', err);

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
      logger.info('MONGODB_URI not set - using local SQLite database');
      return false;
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    logger.info('MongoDB Connected', { host: conn.connection.host, mode: 'Secondary' });
    return true;
  } catch (error) {
    logger.info('MongoDB not available - using local SQLite database (Primary)');
    return false;
  }
};

const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received, shutting down gracefully`);

  try {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed');
    }

    if (localDB) {
      localDB.close();
      logger.info('Local database connection closed');
    }
  } catch (error) {
    logger.error('Error during shutdown', error);
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
      logger.info('Server started successfully', {
        version: '2.0.1',
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        apiBase: `http://localhost:${PORT}/api`,
        healthCheck: `http://localhost:${PORT}/health`,
        rateLimits: {
          general: '1000 req/15min',
          admin: '500 req/15min',
          company: '200 req/15min'
        },
        features: {
          multiUser: true,
          multiTenant: true,
          strictRBAC: true,
          adminMonitoring: true,
          activityLogging: true,
          taskManagement: true,
          database: 'Local SQLite (Primary)'
        }
      });
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use`);
        process.exit(1);
      } else {
        logger.error('Server error', error);
        process.exit(1);
      }
    });

  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = app;