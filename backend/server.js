const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const { authenticateToken, requireAdmin } = require('./middleware/auth');

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
    database: mongoose.connection && mongoose.connection.readyState === 1 ? 'Connected' : 'Running with sample data (MongoDB not required for demo)',
    port: process.env.PORT || 5001,
    features: {
      multiUser: true,
      adminMonitoring: true,
      auditLogging: true,
      roleBasedAccess: true
    }
  };
  
  res.status(200).json(healthData);
  console.log('Health check requested:', healthData);
});

// Import routes (only if they exist)
let authRoutes, userRoutes, emissionRoutes, dashboardRoutes;
let analyticsRoutes, monitorRoutes, vehicleRoutes, generatorRoutes;
let organizationRoutes, notificationRoutes, exportRoutes, adminRoutes;

try {
  authRoutes = require('./routes/auth');
} catch (e) {
  console.log('Auth routes not found, using inline routes');
}

try {
  userRoutes = require('./routes/users');
} catch (e) {
  console.log('User routes not found, using inline routes');
}

try {
  emissionRoutes = require('./routes/emissions');
} catch (e) {
  console.log('Emission routes not found, using inline routes');
}

try {
  dashboardRoutes = require('./routes/dashboard');
} catch (e) {
  console.log('Dashboard routes not found, using inline routes');
}

try {
  analyticsRoutes = require('./routes/analytics');
} catch (e) {
  console.log('Analytics routes not found, using inline routes');
}

try {
  monitorRoutes = require('./routes/monitor');
} catch (e) {
  console.log('Monitor routes not found, using inline routes');
}

try {
  vehicleRoutes = require('./routes/vehicles');
} catch (e) {
  console.log('Vehicle routes not found, using inline routes');
}

try {
  generatorRoutes = require('./routes/generators');
} catch (e) {
  console.log('Generator routes not found, using inline routes');
}

try {
  organizationRoutes = require('./routes/organization');
} catch (e) {
  console.log('Organization routes not found, using inline routes');
}

try {
  notificationRoutes = require('./routes/notifications');
} catch (e) {
  console.log('Notification routes not found, using inline routes');
}

try {
  exportRoutes = require('./routes/export');
} catch (e) {
  console.log('Export routes not found, using inline routes');
}

try {
  adminRoutes = require('./routes/admin');
} catch (e) {
  console.log('Admin routes not found, using inline routes');
}

// API Routes
if (authRoutes) {
  app.use('/api/auth', authRoutes);
} else {
  // Inline auth routes for demo
  const authController = require('./controllers/authController');
  const authRouter = express.Router();
  authRouter.post('/login', authController.login);
  authRouter.post('/register', authController.register);
  authRouter.post('/logout', authenticateToken, authController.logout);
  authRouter.get('/verify', authenticateToken, authController.verifyToken);
  authRouter.patch('/profile', authenticateToken, authController.updateProfile);
  authRouter.patch('/change-password', authenticateToken, authController.changePassword);
  app.use('/api/auth', authRouter);
}

// Admin routes with proper controller
if (adminRoutes) {
  app.use('/api/admin', adminLimiter, authenticateToken, requireAdmin, adminRoutes);
} else {
  // Inline admin routes
  const adminController = require('./controllers/adminController');
  const adminRouter = express.Router();
  
  adminRouter.get('/dashboard', adminController.getAdminDashboard);
  adminRouter.get('/activities', adminController.getAllActivities);
  adminRouter.get('/user-summary', adminController.getUserActivitySummary);
  adminRouter.get('/audit-logs', adminController.getAuditLogs);
  
  app.use('/api/admin', adminLimiter, authenticateToken, requireAdmin, adminRouter);
}

// User routes
if (userRoutes) {
  app.use('/api/users', authenticateToken, userRoutes);
} else {
  // Inline user routes
  const userController = require('./controllers/userController');
  const userRouter = express.Router();
  
  userRouter.get('/', userController.getUsers);
  userRouter.get('/stats', userController.getUserStats);
  userRouter.get('/:id', userController.getUserById);
  userRouter.post('/', requireAdmin, userController.createUser);
  userRouter.patch('/:id/role', requireAdmin, userController.updateUserRole);
  userRouter.patch('/:id/status', requireAdmin, userController.updateUserStatus);
  userRouter.delete('/:id', requireAdmin, userController.deleteUser);
  userRouter.patch('/bulk', requireAdmin, userController.bulkUpdateUsers);
  
  app.use('/api/users', authenticateToken, userRouter);
}

// Emission routes
if (emissionRoutes) {
  app.use('/api/emissions', authenticateToken, emissionRoutes);
} else {
  // Inline emission routes
  const emissionController = require('./controllers/emissionController');
  const emissionRouter = express.Router();
  
  emissionRouter.get('/', emissionController.getEmissions);
  emissionRouter.get('/categories', emissionController.getEmissionCategories);
  emissionRouter.get('/stats', emissionController.getEmissionStats);
  emissionRouter.get('/:id', emissionController.getEmissionById);
  emissionRouter.post('/', emissionController.createEmission);
  emissionRouter.patch('/:id', emissionController.updateEmission);
  emissionRouter.patch('/:id/verify', requireAdmin, emissionController.verifyEmission);
  emissionRouter.delete('/:id', emissionController.deleteEmission);
  
  app.use('/api/emissions', authenticateToken, emissionRouter);
}

// Dashboard routes
if (dashboardRoutes) {
  app.use('/api/dashboard', authenticateToken, dashboardRoutes);
} else {
  // Inline dashboard routes
  const dashboardController = require('./controllers/dashboardController');
  const dashboardRouter = express.Router();
  
  dashboardRouter.get('/summary', dashboardController.getDashboardSummary);
  dashboardRouter.get('/notifications', dashboardController.getDashboardNotifications);
  
  app.use('/api/dashboard', authenticateToken, dashboardRouter);
}

// Other route placeholders
app.use('/api/analytics', authenticateToken, (req, res) => {
  res.json({ message: 'Analytics endpoint placeholder' });
});

app.use('/api/monitor', authenticateToken, (req, res) => {
  res.json({ message: 'Monitor endpoint placeholder' });
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
app.use(errorHandler);

// Database connection (optional for demo)
const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.log('⚠️  MONGODB_URI not set - running in demo mode');
      return false;
    }
    
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.log('⚠️  MongoDB not available - running with enhanced demo mode');
    console.log('💡 Multi-user features work with sample data. Connect database for persistence.');
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
    // Try to connect to database but don't crash if it fails
    await connectDB();
    
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('');
      console.log('🚀 ================================');
      console.log(`📊 Carbon Accounting Backend (Multi-User)`);
      console.log(`🌐 Server running on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 API Base: http://localhost:${PORT}/api`);
      console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
      console.log(`👥 Multi-User: Enabled`);
      console.log(`🔒 Role-Based Access: Enabled`);
      console.log(`📋 Admin Monitoring: Enabled`);
      console.log(`📝 Audit Logging: Enabled`);
      console.log(`💚 Status: Ready for connections`);
      console.log('🚀 ================================');
      console.log('');
      console.log('📌 Demo Credentials:');
      console.log('   Email: demo@example.com');
      console.log('   Password: password123');
      console.log('   Role: Admin');
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