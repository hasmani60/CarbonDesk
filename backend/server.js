// backend/server.js - MongoDB Compliant Server
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const logger = require('./utils/logger');
const { effectiveAllowedScopesForContributor } = require('./utils/contributorEmissionAccess');

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

const { 
  addOrganisationContext, 
  requireOrganisation 
} = require('./middleware/organisationScope');

const {
  authenticateCompanyOperator,
  canCreateOrganisations,
  canManageOrganisations,
  requireSuperOperator,
  logCompanyActivity
} = require('./middleware/companyAuth');

const organisationRoutes = require('./routes/organisation');

const app = express();

app.set('trust proxy', 1);

// ============================================
// RATE LIMITING
// ============================================

const isDevelopment = process.env.NODE_ENV !== 'production';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDevelopment ? 10000 : 1000,
  skip: () => isDevelopment,
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDevelopment ? 10000 : 500,
  skip: () => isDevelopment,
  message: { error: 'Too many admin requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const companyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDevelopment ? 10000 : 200,
  skip: () => isDevelopment,
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

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('combined'));
}

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
    if (!origin) return callback(null, true);

    if (corsOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      if (process.env.NODE_ENV === 'production') {
        logger.warn('CORS blocked origin', { origin });
        callback(new Error('Not allowed by CORS'));
      } else {
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

app.use(limiter);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

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
    database: mongoose.connection.readyState === 1 ? 'MongoDB Atlas (Connected)' : 'MongoDB (Disconnected)',
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

/**
 * SMTP / forgot-password troubleshooting without Render Shell.
 * Set RENDER_EMAIL_DIAGNOSTIC_SECRET in Render env (long random string), then POST from your PC:
 *
 * curl -X POST "$RENDER_URL/health/email-diagnostic" -H "Content-Type: application/json" \
 *   -d "{\"secret\":\"$SECRET\",\"email\":\"you@gmail.com\"}"
 *
 * Omit "email" to skip DB lookup. Returns 404 if secret missing or wrong.
 */
app.post('/health/email-diagnostic', async (req, res) => {
  try {
    const expected = process.env.RENDER_EMAIL_DIAGNOSTIC_SECRET;
    if (
      !expected ||
      typeof req.body?.secret !== 'string' ||
      req.body.secret !== expected
    ) {
      return res.status(404).json({ message: 'Not found' });
    }

    const emailService = require('./utils/emailService');
    const { User } = require('./models');

    const payload = {
      smtpConfigured: emailService.isConfigured(),
      clientUrl: process.env.CLIENT_URL || null,
      smtpVerifyOk: null,
      smtpVerifyError: null,
      user: null
    };

    if (payload.smtpConfigured) {
      try {
        await emailService.getTransporter().verify();
        payload.smtpVerifyOk = true;
      } catch (e) {
        payload.smtpVerifyOk = false;
        payload.smtpVerifyError =
          e && e.message ? String(e.message) : 'SMTP verify failed';
      }
    }

    const em =
      typeof req.body?.email === 'string'
        ? req.body.email.trim().toLowerCase()
        : '';
    if (em) {
      try {
        if (mongoose.connection.readyState !== 1) {
          payload.user = { error: 'MongoDB not connected on this instance' };
        } else {
          const u = await User.findOne({ email: em })
            .select('email status')
            .lean();
          if (!u) {
            payload.user = { found: false };
          } else {
            payload.user = {
              found: true,
              status: u.status,
              receivesForgotEmail: u.status === 'active'
            };
          }
        }
      } catch (e) {
        payload.user = {
          lookupError:
            e && e.message ? String(e.message) : 'User lookup failed'
        };
      }
    }

    return res.json({ success: true, data: payload });
  } catch (e) {
    logger.error('/health/email-diagnostic', e);
    return res.status(500).json({ success: false, message: 'Diagnostic failed' });
  }
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
const { ActivityLog } = require('./models');

// ============================================
// COMPANY OPERATIONS ROUTES
// ============================================

const companyAuthRouter = express.Router();
companyAuthRouter.post('/login', companyController.companyLogin);
companyAuthRouter.get('/profile', authenticateCompanyOperator, companyController.getCompanyProfile);

app.use('/api/company/auth', companyLimiter, companyAuthRouter);

const companyDashboardRouter = express.Router();
companyDashboardRouter.get('/', companyController.getCompanyDashboard);

app.use('/api/company/dashboard',
  companyLimiter,
  authenticateCompanyOperator,
  companyDashboardRouter
);

const companyOrgRouter = express.Router();

companyOrgRouter.post('/', 
  canCreateOrganisations, 
  logCompanyActivity('org_create', 'Creating new organisation'), 
  companyController.createOrganisation
);

companyOrgRouter.get('/', 
  companyController.getAllOrganisations
);

companyOrgRouter.patch('/:id/super-admin-password',
  canManageOrganisations,
  logCompanyActivity('org_super_admin_password', 'Reset organisation super admin password'),
  companyController.resetSuperAdminPassword
);

companyOrgRouter.get('/:id', 
  companyController.getOrganisationById
);

companyOrgRouter.patch('/:id', 
  canManageOrganisations, 
  logCompanyActivity('org_update', 'Updating organisation'), 
  companyController.updateOrganisation
);

companyOrgRouter.delete('/:id', 
  canManageOrganisations, 
  logCompanyActivity('org_deactivate', 'Deactivating organisation'), 
  companyController.deactivateOrganisation
);

companyOrgRouter.get('/:id/stats', 
  companyController.getOrganisationStats
);

app.use('/api/company/organisations',
  companyLimiter,
  authenticateCompanyOperator,
  companyOrgRouter
);

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
      'GET /api/company/organisations/:id',
      'PATCH /api/company/organisations/:id/super-admin-password'
    ]
  });
});


// ============================================
// ORGANISATION ROUTES
// ============================================

app.use('/api/organisations', 
  authenticateToken,
  addOrganisationContext,
  requireOrganisation,
  organisationRoutes
);

// ============================================
// AUTH ROUTES
// ============================================

app.use('/api/auth', require('./routes/auth'));

// ============================================
// USER ROUTES
// ============================================

app.use('/api/users', 
  authenticateToken, 
  addOrganisationContext, 
  require('./routes/users')
);

// ============================================
// ACTIVITY LOG ROUTES
// ============================================

app.use('/api/activities', 
  authenticateToken, 
  addOrganisationContext,
  require('./routes/activity')
);

// ============================================
// ADMIN ROUTES
// ============================================

app.use('/api/admin', 
  authenticateToken,
  addOrganisationContext,
  requireAdmin,
  adminLimiter,
  require('./routes/admin')
);

// ============================================
// DASHBOARD ROUTES
// ============================================

app.use('/api/dashboard',
  authenticateToken,
  addOrganisationContext,
  requireOrganisation,
  require('./routes/dashboard')
);

// ============================================
// EMISSION ROUTES
// ============================================

app.use('/api/emissions',
  authenticateToken,
  addOrganisationContext,
  requireOrganisation,
  require('./routes/emissions')
);

// ============================================
// ADDITIONAL ROUTES
// ============================================

app.use('/api/export', 
  authenticateToken, 
  addOrganisationContext, 
  require('./routes/export')
);
app.use('/api/vehicles', 
  authenticateToken, 
  addOrganisationContext, 
  requireOrganisation,
  require('./routes/vehicles')
);
app.use('/api/generators', 
  authenticateToken, 
  addOrganisationContext, 
  requireOrganisation,
  require('./routes/generators')
);
app.use('/api/monitor', 
  authenticateToken, 
  addOrganisationContext, 
  require('./routes/monitor')
);

// ============================================
// ANALYTICS ROUTES
// ============================================
// ANALYTICS ROUTES
// ============================================

const analyticsRouter = express.Router();
const analyticsRoutes = require('./routes/analytics');
const analyticsController = require('./controllers/analyticsController');

analyticsRouter.get('/health', (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  res.json({
    success: true,
    connected: isConnected,
    status: isConnected ? 'connected' : 'disconnected',
    database: 'MongoDB Atlas',
    mongodb: isConnected, // This is what Analytics.jsx checks for
    timestamp: new Date().toISOString()
  });
});

// Overview stats endpoint
analyticsRouter.get('/overview', addOrganisationContext, requireOrganisation, async (req, res) => {
  try {
    const { Emission } = require('./models');
    const organisationId = req.organisationId;
    
    const totalEmissions = await Emission.aggregate([
      { $match: { organisation_id: organisationId } },
      {
        $group: {
          _id: null,
          total_co2e: { $sum: '$co2e' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    const byScope = await Emission.aggregate([
      { $match: { organisation_id: organisationId } },
      {
        $group: {
          _id: '$scope',
          total_co2e: { $sum: '$co2e' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        total_emissions: totalEmissions[0]?.total_co2e || 0,
        total_count: totalEmissions[0]?.count || 0,
        by_scope: byScope
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Pareto analysis endpoint
analyticsRouter.get('/pareto', addOrganisationContext, requireOrganisation, async (req, res) => {
  try {
    const { Emission } = require('./models');
    const organisationId = req.organisationId;
    
    const paretoData = await Emission.aggregate([
      { $match: { organisation_id: organisationId } },
      {
        $group: {
          _id: '$activity',
          total_co2e: { $sum: '$co2e' },
          count: { $sum: 1 }
        }
      },
      { $sort: { total_co2e: -1 } },
      { $limit: 20 }
    ]);
    
    res.json({
      success: true,
      data: paretoData
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// SCOPE MIGRATION ENDPOINT
// ============================================
analyticsRouter.get('/scope-migration', addOrganisationContext, requireOrganisation, async (req, res) => {
  try {
    const Emission = require('./models/Emission');
    const organisationId = req.organisationId;
    
    console.log('📊 Scope migration request for org:', organisationId);
    
    const totalCount = await Emission.countDocuments({ organisation_id: organisationId });
    console.log('📊 Total emissions found:', totalCount);
    
    if (totalCount === 0) {
      return res.json({
        success: true,
        data: { periodData: [] }
      });
    }
    
    // Convert string date to Date object, then extract year/month
    const periodData = await Emission.aggregate([
      { $match: { organisation_id: organisationId } },
      {
        $addFields: {
          dateObj: { $toDate: '$date' }  // Convert string to Date
        }
      },
      {
        $project: {
          year: { $year: '$dateObj' },
          month: { $month: '$dateObj' },
          scope: 1,
          co2e: 1
        }
      },
      {
        $group: {
          _id: {
            year: '$year',
            month: '$month'
          },
          scope1: { 
            $sum: { 
              $cond: [{ $eq: ['$scope', 1] }, '$co2e', 0] 
            } 
          },
          scope2: { 
            $sum: { 
              $cond: [{ $eq: ['$scope', 2] }, '$co2e', 0] 
            } 
          },
          scope3: { 
            $sum: { 
              $cond: [{ $eq: ['$scope', 3] }, '$co2e', 0] 
            } 
          },
          total: { $sum: '$co2e' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    console.log('📊 Period data found:', periodData.length, 'periods');

    const formattedData = periodData.map(item => ({
      period: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
      scope1: item.scope1 || 0,
      scope2: item.scope2 || 0,
      scope3: item.scope3 || 0,
      total: item.total || 0
    }));

    res.json({
      success: true,
      data: { periodData: formattedData }
    });
  } catch (error) {
    console.error('❌ Scope migration error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch scope migration data'
    });
  }
});


// ============================================
// VELOCITY ANALYSIS ENDPOINT
// ============================================
analyticsRouter.get('/velocity', addOrganisationContext, requireOrganisation, async (req, res) => {
  try {
    const Emission = require('./models/Emission');
    const organisationId = req.organisationId;
    
    console.log('⚡ Velocity request for org:', organisationId);

    const totalCount = await Emission.countDocuments({ organisation_id: organisationId });
    console.log('⚡ Total emissions found:', totalCount);
    
    if (totalCount === 0) {
      return res.json({
        success: true,
        data: {
          chartData: [],
          summary: {
            avgVelocity: 0,
            avgAcceleration: 0,
            trend: 'stable',
            currentVelocity: 0,
            projectedNextMonth: 0
          }
        }
      });
    }

    // Convert string date to Date object
    const periodData = await Emission.aggregate([
      { $match: { organisation_id: organisationId } },
      {
        $addFields: {
          dateObj: { $toDate: '$date' }  // Convert string to Date
        }
      },
      {
        $project: {
          year: { $year: '$dateObj' },
          month: { $month: '$dateObj' },
          co2e: 1
        }
      },
      {
        $group: {
          _id: {
            year: '$year',
            month: '$month'
          },
          emissions: { $sum: '$co2e' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    console.log('⚡ Period data found:', periodData.length, 'periods');

    const chartData = [];
    let prevEmissions = null;
    let prevVelocity = null;

    periodData.forEach(item => {
      const period = `${item._id.year}-${String(item._id.month).padStart(2, '0')}`;
      const emissions = item.emissions || 0;
      
      const velocity = prevEmissions !== null ? emissions - prevEmissions : 0;
      const acceleration = prevVelocity !== null ? velocity - prevVelocity : 0;

      chartData.push({
        period,
        emissions,
        velocity,
        acceleration
      });

      prevEmissions = emissions;
      prevVelocity = velocity;
    });

    // Calculate summary
    const velocities = chartData.slice(1).map(d => d.velocity);
    const accelerations = chartData.slice(2).map(d => d.acceleration);
    
    const avgVelocity = velocities.length > 0 
      ? velocities.reduce((a, b) => a + b, 0) / velocities.length 
      : 0;
    
    const avgAcceleration = accelerations.length > 0
      ? accelerations.reduce((a, b) => a + b, 0) / accelerations.length
      : 0;

    const lastData = chartData[chartData.length - 1];
    const currentVelocity = lastData?.velocity || 0;
    const projectedNextMonth = lastData 
      ? lastData.emissions + currentVelocity 
      : 0;

    res.json({
      success: true,
      data: {
        chartData,
        summary: {
          avgVelocity: parseFloat(avgVelocity.toFixed(2)),
          avgAcceleration: parseFloat(avgAcceleration.toFixed(2)),
          trend: avgVelocity < 0 ? 'decreasing' : avgVelocity > 0 ? 'increasing' : 'stable',
          currentVelocity: parseFloat(currentVelocity.toFixed(2)),
          projectedNextMonth: parseFloat(projectedNextMonth.toFixed(2))
        }
      }
    });
  } catch (error) {
    console.error('❌ Velocity analysis error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch velocity analysis'
    });
  }
});

// ============================================
// MACC ANALYSIS ENDPOINT
// ============================================
analyticsRouter.get('/macc', addOrganisationContext, requireOrganisation, async (req, res) => {
  try {
    const { MACCOpportunity } = require('./models');
    const organisationId = req.organisationId;

    const opportunities = await MACCOpportunity.find({ organisation_id: organisationId })
      .sort({ costPerTon: 1 })
      .lean();

    // Calculate analysis
    const analysis = {
      totalAbatementPotential: 0,
      totalCostSavings: 0,
      totalCosts: 0,
      netCost: 0,
      opportunitiesCount: opportunities.length,
      highPriorityCount: 0,
      mediumPriorityCount: 0,
      lowPriorityCount: 0
    };

    opportunities.forEach(opp => {
      analysis.totalAbatementPotential += opp.abatementPotential || 0;
      
      const totalCost = (opp.costPerTon || 0) * (opp.abatementPotential || 0);
      
      if (opp.costPerTon < 0) {
        analysis.totalCostSavings += Math.abs(totalCost);
      } else {
        analysis.totalCosts += totalCost;
      }

      if (opp.priority === 'high') analysis.highPriorityCount++;
      else if (opp.priority === 'medium') analysis.mediumPriorityCount++;
      else analysis.lowPriorityCount++;
    });

    analysis.netCost = analysis.totalCosts - analysis.totalCostSavings;
    analysis.averageCostPerTon = analysis.totalAbatementPotential > 0
      ? analysis.netCost / analysis.totalAbatementPotential
      : 0;

    res.json({
      success: true,
      data: {
        opportunities,
        analysis
      }
    });
  } catch (error) {
    console.error('MACC analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch MACC analysis'
    });
  }
});

// ============================================
// SAVE MACC OPPORTUNITY ENDPOINT
// ============================================
analyticsRouter.post('/macc/opportunity', addOrganisationContext, requireOrganisation, async (req, res) => {
  try {
    const { MACCOpportunity } = require('./models');
    const organisationId = req.organisationId;
    
    const opportunityData = {
      ...req.body,
      organisation_id: organisationId,
      createdBy: req.user.id
    };

    const opportunity = await MACCOpportunity.create(opportunityData);

    res.status(201).json({
      success: true,
      data: opportunity,
      message: 'MACC opportunity created successfully'
    });
  } catch (error) {
    console.error('Save MACC opportunity error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save MACC opportunity'
    });
  }
});

// ============================================
// DELETE MACC OPPORTUNITY ENDPOINT
// ============================================
analyticsRouter.delete('/macc/opportunity/:id', addOrganisationContext, requireOrganisation, async (req, res) => {
  try {
    const { MACCOpportunity } = require('./models');
    const organisationId = req.organisationId;
    const { id } = req.params;

    const opportunity = await MACCOpportunity.findOneAndDelete({
      _id: id,
      organisation_id: organisationId
    });

    if (!opportunity) {
      return res.status(404).json({
        success: false,
        error: 'MACC opportunity not found'
      });
    }

    res.json({
      success: true,
      message: 'MACC opportunity deleted successfully'
    });
  } catch (error) {
    console.error('Delete MACC opportunity error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete MACC opportunity'
    });
  }
});

// ============================================
// PARETO DRILL-DOWN ENDPOINT
// ============================================
analyticsRouter.get('/pareto/drilldown/:category', addOrganisationContext, requireOrganisation, async (req, res) => {
  try {
    const { Emission } = require('./models');
    const organisationId = req.organisationId;
    const { category } = req.params;

    const drilldownData = await Emission.aggregate([
      { 
        $match: { 
          organisation_id: organisationId,
          activity: decodeURIComponent(category)
        } 
      },
      {
        $group: {
          _id: '$subactivity',
          total_co2e: { $sum: '$co2e' },
          count: { $sum: 1 }
        }
      },
      { $sort: { total_co2e: -1 } },
      { $limit: 20 }
    ]);

    res.json({
      success: true,
      data: {
        category: decodeURIComponent(category),
        paretoData: drilldownData
      }
    });
  } catch (error) {
    console.error('Pareto drill-down error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch drill-down data'
    });
  }
});

app.use('/api/analytics', 
  authenticateToken,
  addOrganisationContext,
  requireOrganisation,
  analyticsRouter
);

// ============================================
// TASK ROUTES
// ============================================

const taskRouter = express.Router();
const taskController = require('./controllers/taskController');

taskRouter.get('/', addOrganisationContext, requireOrganisation, taskController.getTasks);
taskRouter.post('/', addOrganisationContext, requireOrganisation, authorizeRoles(['admin']), taskController.createTask);
taskRouter.get('/stats', addOrganisationContext, requireOrganisation, taskController.getTaskStats);
taskRouter.get('/assignable-users', addOrganisationContext, requireOrganisation, authorizeRoles(['admin']), taskController.getAssignableUsers);
taskRouter.get('/due-soon', addOrganisationContext, requireOrganisation, taskController.getTasksDueSoon);
taskRouter.get('/:id', addOrganisationContext, requireOrganisation, taskController.getTaskById);
taskRouter.patch('/:id', addOrganisationContext, requireOrganisation, taskController.updateTask);
taskRouter.delete('/:id', addOrganisationContext, requireOrganisation, authorizeRoles(['admin']), taskController.deleteTask);

app.use('/api/tasks',
  authenticateToken,
  taskRouter
);

// ============================================
// NOTIFICATION ROUTES
// ============================================

const notificationRouter = express.Router();
const notificationController = require('./controllers/notificationController');

notificationRouter.get('/unread-count', addOrganisationContext, notificationController.getUnreadCount);
notificationRouter.get('/', addOrganisationContext, notificationController.getNotifications);
notificationRouter.patch('/read-all', addOrganisationContext, notificationController.markAllAsRead);
notificationRouter.patch('/:id/read', addOrganisationContext, notificationController.markAsRead);
notificationRouter.delete('/:id', addOrganisationContext, notificationController.deleteNotification);

app.use('/api/notifications',
  authenticateToken,
  notificationRouter
);

// ============================================
// DEBUG ROUTES
// ============================================

app.get('/api/debug/organisation', authenticateToken, addOrganisationContext, (req, res) => {
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
      scopes: req.user.restrictions
        ? effectiveAllowedScopesForContributor(req.user.restrictions)
        : [1, 2, 3],
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

app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API route ${req.originalUrl} not found`
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

app.use(errorHandlerMiddleware);

// ============================================
// DATABASE CONNECTION & STARTUP
// ============================================

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI not found in environment variables');
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI);
    
    logger.info('MongoDB Connected', { 
      host: conn.connection.host, 
      database: conn.connection.name 
    });
    return true;
  } catch (error) {
    logger.error('MongoDB connection failed', error);
    const uri = process.env.MONGODB_URI || '';
    const isLocal =
      /localhost|127\.0\.0\.1|^\s*mongodb:\/\/(localhost|127\.0\.0\.1)/i.test(
        uri
      );
    const refused =
      String(error?.message || '').includes('ECONNREFUSED') ||
      String(error?.cause?.message || '').includes('ECONNREFUSED');
    if (isLocal && refused) {
      logger.error(
        'Nothing is listening on local MongoDB (port 27017). Fix one of: ' +
          '(1) Start MongoDB locally (e.g. brew services start mongodb-community, or Docker), ' +
          'or (2) Set MONGODB_URI in backend/.env to your MongoDB Atlas connection string ' +
          '(Network Access must allow your IP: 0.0.0.0/0 for quick tests).'
      );
    }
    throw error;
  }
};

const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received, shutting down gracefully`);

  try {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed');
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
    await connectDB();

    if (process.env.NODE_ENV === 'production') {
      const j = process.env.JWT_SECRET;
      if (!j || j.length < 24 || j === 'your-development-jwt-secret-change-in-production') {
        logger.error(
          'Set a strong JWT_SECRET in production (min ~24 chars, not the example placeholder).'
        );
        process.exit(1);
      }
    }

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
          database: 'MongoDB Atlas'
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