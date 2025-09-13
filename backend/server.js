const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const emissionRoutes = require('./routes/emissions');
const dashboardRoutes = require('./routes/dashboard');
const analyticsRoutes = require('./routes/analytics');
const monitorRoutes = require('./routes/monitor');
const vehicleRoutes = require('./routes/vehicles');
const generatorRoutes = require('./routes/generators');
const organizationRoutes = require('./routes/organization');
const notificationRoutes = require('./routes/notifications');
const exportRoutes = require('./routes/export');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const { authenticateToken } = require('./middleware/auth');

const app = express();

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: 'Running with sample data (MongoDB not required for demo)'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/emissions', authenticateToken, emissionRoutes);
app.use('/api/dashboard', authenticateToken, dashboardRoutes);
app.use('/api/analytics', authenticateToken, analyticsRoutes);
app.use('/api/monitor', authenticateToken, monitorRoutes);
app.use('/api/vehicles', authenticateToken, vehicleRoutes);
app.use('/api/generators', authenticateToken, generatorRoutes);
app.use('/api/organization', authenticateToken, organizationRoutes);
app.use('/api/notifications', authenticateToken, notificationRoutes);
app.use('/api/export', authenticateToken, exportRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Error handling middleware
app.use(errorHandler);

// Database connection (optional for demo)
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/carbon-accounting');
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.log('⚠️  MongoDB not available - running with sample data');
    console.log('💡 This is normal for demo purposes. The app will work with sample data.');
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
  }
  process.exit(0);
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Try to connect to database but don't crash if it fails
    await connectDB();
    
    const server = app.listen(PORT, () => {
      console.log('');
      console.log('🚀 ================================');
      console.log(`📊 Carbon Accounting Backend`);
      console.log(`🌐 Server running on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 API Base: http://localhost:${PORT}/api`);
      console.log(`💚 Status: Ready for connections`);
      console.log('🚀 ================================');
      console.log('');
    });

    // Socket.io setup for real-time notifications (optional)
    /* Uncomment if you want real-time features
    const io = require('socket.io')(server, {
      cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        methods: ['GET', 'POST']
      }
    });

    io.on('connection', (socket) => {
      console.log('User connected:', socket.id);
      
      socket.on('join', (userId) => {
        socket.join(`user_${userId}`);
      });

      socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
      });
    });

    // Make io available globally
    app.set('io', io);
    */

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = app;