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
  checkPageAccess 
} = require('./middleware/auth');

const app = express();

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Rate limiting - more lenient for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // increased limit for development
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Admin-specific rate limiting
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // Admin operations get lower limit
  message: {
    error: 'Too many admin requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));
app.use(compression());

// More detailed logging in development
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('combined'));
}

// CORS configuration - more permissive for development
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    process.env.CLIENT_URL
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
}));

// Apply rate limiting
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint - enhanced
app.get('/health', (req, res) => {
  const healthData = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    database: 'Local SQLite Database (Active)',
    port: process.env.PORT || 5001,
    features: {
      multiUser: true,
      adminMonitoring: true,
      auditLogging: true,
      roleBasedAccess: true,
      localDatabase: true,
      rbacSupport: true
    }
  };
  
  res.status(200).json(healthData);
  console.log('Health check requested:', healthData);
});

// Import controllers
const authController = require('./controllers/authController');
const userController = require('./controllers/userController');
const adminController = require('./controllers/adminController');
const dashboardController = require('./controllers/dashboardController');
const emissionController = require('./controllers/emissionController');

// Authentication routes
const authRouter = express.Router();
authRouter.post('/login', authController.login);
authRouter.post('/register', authenticateToken, requireAdmin, authController.register);
authRouter.post('/logout', authenticateToken, authController.logout);
authRouter.get('/verify', authenticateToken, authController.verifyToken);
authRouter.patch('/profile', authenticateToken, authController.updateProfile);
authRouter.patch('/change-password', authenticateToken, authController.changePassword);
app.use('/api/auth', authRouter);

// Admin routes with enhanced RBAC
const adminRouter = express.Router();
adminRouter.get('/dashboard', adminController.getAdminDashboard);
adminRouter.get('/activities', adminController.getAllActivities);
adminRouter.get('/user-summary', adminController.getUserActivitySummary);
app.use('/api/admin', adminLimiter, authenticateToken, requireAdmin, adminRouter);

// User management routes with enhanced RBAC
const userRouter = express.Router();
userRouter.get('/', userController.getUsers);
userRouter.get('/stats', userController.getUserStats);
userRouter.get('/rbac-options', userController.getRBACOptions); // NEW: RBAC options endpoint
userRouter.get('/:id', userController.getUserById);
userRouter.post('/', requireAdmin, userController.createUser); // ENHANCED: With RBAC support
userRouter.patch('/:id/role', requireAdmin, userController.updateUserRole);
userRouter.patch('/:id/restrictions', requireAdmin, userController.updateUserRestrictions); // NEW: Update restrictions
userRouter.patch('/:id/status', requireAdmin, userController.updateUserStatus);
userRouter.delete('/:id', requireAdmin, userController.deleteUser);
userRouter.patch('/bulk', requireAdmin, userController.bulkUpdateUsers);
app.use('/api/users', authenticateToken, userRouter);

// Emission routes with RBAC
const emissionRouter = express.Router();
emissionRouter.get('/', emissionController.getEmissions);
emissionRouter.get('/categories', emissionController.getEmissionCategories);
emissionRouter.get('/stats', emissionController.getEmissionStats);
emissionRouter.get('/:id', emissionController.getEmissionById);

// RBAC-protected emission creation (check scope and activity access)
emissionRouter.post('/', (req, res, next) => {
  const { scope, category } = req.body;
  
  // Check scope access
  if (scope) {
    return checkScopeAccess(scope)(req, res, () => {
      // Check activity access if category is provided
      if (category) {
        return checkActivityAccess(category)(req, res, next);
      }
      next();
    });
  }
  next();
}, emissionController.createEmission);

emissionRouter.patch('/:id', emissionController.updateEmission);
emissionRouter.patch('/:id/verify', requireAdmin, emissionController.verifyEmission);
emissionRouter.delete('/:id', emissionController.deleteEmission);
app.use('/api/emissions', authenticateToken, emissionRouter);

// Dashboard routes with page access control
const dashboardRouter = express.Router();
dashboardRouter.get('/summary', checkPageAccess('/dashboard'), dashboardController.getDashboardSummary);
dashboardRouter.get('/notifications', dashboardController.getDashboardNotifications);
app.use('/api/dashboard', authenticateToken, dashboardRouter);

// Input page access control
app.get('/api/input/access/:scope', authenticateToken, (req, res) => {
  const scope = req.params.scope;
  
  // Check if user can access this scope
  checkScopeAccess(scope)(req, res, () => {
    res.json({
      success: true,
      hasAccess: true,
      scope: scope,
      userRole: req.user.role,
      restrictions: req.user.restrictions
    });
  });
});

// Monitor page access control
app.get('/api/monitor/access', authenticateToken, (req, res) => {
  checkPageAccess('/monitor')(req, res, () => {
    res.json({
      success: true,
      hasAccess: true,
      userRole: req.user.role,
      restrictions: req.user.restrictions
    });
  });
});

// Analytics page access control
app.get('/api/analytics/access', authenticateToken, (req, res) => {
  checkPageAccess('/analytics')(req, res, () => {
    res.json({
      success: true,
      hasAccess: true,
      userRole: req.user.role,
      restrictions: req.user.restrictions
    });
  });
});

// Other route placeholders with access control
app.use('/api/analytics', authenticateToken, checkPageAccess('/analytics'), (req, res) => {
  res.json({ message: 'Analytics endpoint placeholder', userRole: req.user.role });
});

app.use('/api/monitor', authenticateToken, checkPageAccess('/monitor'), (req, res) => {
  res.json({ message: 'Monitor endpoint placeholder', userRole: req.user.role });
});

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
  res.json({ 
    success: true,
    data: [] 
  });
});

app.use('/api/export', authenticateToken, (req, res) => {
  res.json({ message: 'Export endpoint placeholder' });
});

// Error handling middleware that doesn't exist - create a simple one
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

// Database connection (optional MongoDB, but we're using SQLite primarily)
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

// Graceful shutdown
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
    // Initialize local database first
    await localDB.init();
    
    // Try to connect to MongoDB as secondary database
    await connectDB();
    
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('');
      console.log('🚀 ================================');
      console.log(`📊 Carbon Accounting Backend (Enhanced RBAC)`);
      console.log(`🌐 Server running on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 API Base: http://localhost:${PORT}/api`);
      console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
      console.log(`👥 Multi-User: Enabled`);
      console.log(`🔒 Role-Based Access: Enhanced with Local DB`);
      console.log(`📋 Admin Monitoring: Enabled`);
      console.log(`📝 Activity Logging: Enabled`);
      console.log(`🗄️  Database: Local SQLite (Primary)`);
      console.log(`🛡️  RBAC: Scope & Activity Restrictions`);
      console.log(`💚 Status: Ready for connections`);
      console.log('🚀 ================================');
      console.log('');
      console.log('📌 Demo Credentials:');
      console.log('   Admin - Email: demo@example.com, Password: password123');
      console.log('   Analyst - Email: analyst@example.com, Password: password123');
      console.log('   Contributor - Email: contributor@example.com, Password: password123 (Restricted)');
      console.log('   Viewer - Email: viewer@example.com, Password: password123');
      console.log('');
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Please try a different port.`);
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

// Start server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = app;