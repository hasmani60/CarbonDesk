// middleware/auth.js - MongoDB-compatible authentication middleware with RBAC
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const logger = require('../utils/logger');
const { contributorAllowedToUseScope } = require('../utils/contributorEmissionAccess');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required'
      });
    }

    // Verify the JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    // Get user from MongoDB
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user account is active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'User account is not active'
      });
    }

    // Set user information in request
    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      organisation_id: user.organisation_id, // String
      restrictions: user.restrictions || null
    };

    return next();

  } catch (error) {
    logger.error('Auth middleware error', error);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

// Role-based authorization middleware - FIXED
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    console.log('🔐 authorizeRoles check:', {
      requiredRoles: roles,
      userRole: req.user?.role,
      user: req.user ? 'present' : 'missing'
    });

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // FIXED: Normalize roles for comparison (handle case sensitivity and whitespace)
    const userRole = String(req.user.role || '').trim().toLowerCase();
    const allowedRoles = roles.map(r => String(r).trim().toLowerCase());

    console.log('🔍 Normalized roles:', { userRole, allowedRoles });

    if (!allowedRoles.includes(userRole)) {
      console.error('❌ Role check FAILED');
      
      return res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${roles.join(', ')}. Your role: ${req.user.role}`
      });
    }

    console.log('✅ Role check PASSED');
    next();
  };
};

// Check if user is admin
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }

  next();
};

// RBAC middleware for checking scope restrictions
const checkScopeAccess = (requiredScope) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Admin and analysts have full access
    if (['admin', 'analyst'].includes(req.user.role)) {
      return next();
    }

    // Contributors — scope allowed explicitly or implied by allowedActivities (fine-grained RBAC)
    if (req.user.role === 'contributor' && req.user.restrictions) {
      if (!contributorAllowedToUseScope(req.user.restrictions, requiredScope)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. You don't have permission to access Scope ${requiredScope}`
        });
      }
    }

    next();
  };
};

// RBAC middleware for checking activity restrictions
const checkActivityAccess = (requiredActivity) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Admin and analysts have full access
    if (['admin', 'analyst'].includes(req.user.role)) {
      return next();
    }

    // Contributors with restrictions
    if (req.user.role === 'contributor' && req.user.restrictions) {
      const allowedActivities = req.user.restrictions.allowedActivities || [];
      
      // If no specific activities are restricted, allow all
      if (allowedActivities.length > 0 && !allowedActivities.includes(requiredActivity)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. You don't have permission to access activity: ${requiredActivity}`
        });
      }
    }

    next();
  };
};

// Enhanced page access control with strict RBAC enforcement
const checkPageAccess = (page) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // STRICT RBAC: Define exact page access per role
    const strictRolePageAccess = {
      admin: ['/dashboard', '/input', '/monitor', '/analytics', '/settings', '/admin'],
      analyst: ['/analytics', '/settings'],
      contributor: ['/input', '/settings'],
      viewer: ['/dashboard', '/monitor', '/analytics', '/settings']
    };

    const allowedPages = strictRolePageAccess[req.user.role] || [];
    
    // Check if the page is in the allowed list for this role
    const hasAccess = allowedPages.some(allowedPage => {
      if (allowedPage === '/admin' && page.startsWith('/admin')) {
        return true;
      }
      return page === allowedPage || page.startsWith(allowedPage + '/');
    });

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Your role (${req.user.role}) doesn't have access to ${page}`,
        allowedPages: allowedPages
      });
    }

    // Additional restrictions for contributors
    if (req.user.role === 'contributor' && req.user.restrictions) {
      const restrictedPages = req.user.restrictions.restrictedPages || [];
      
      if (restrictedPages.includes(page)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. This page has been restricted for your account.`
        });
      }
    }

    next();
  };
};

// Route-level access control middleware for API endpoints
const enforceRouteAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  const { role } = req.user;
  const { method, path } = req;

  // Define route access rules based on roles
  const routeAccess = {
    admin: {
      GET: ['*'],
      POST: ['*'],
      PUT: ['*'],
      PATCH: ['*'],
      DELETE: ['*']
    },
    analyst: {
      GET: ['/api/analytics/*', '/api/settings/*', '/api/auth/*'],
      POST: ['/api/auth/*'],
      PATCH: ['/api/auth/*', '/api/settings/*'],
      PUT: ['/api/settings/*'],
      DELETE: []
    },
    contributor: {
      GET: ['/api/emissions/*', '/api/settings/*', '/api/auth/*', '/api/dashboard/summary'],
      POST: ['/api/emissions/*', '/api/auth/*'],
      PATCH: ['/api/emissions/*', '/api/auth/*', '/api/settings/*'],
      PUT: ['/api/emissions/*', '/api/settings/*'],
      DELETE: ['/api/emissions/*']
    },
    viewer: {
      GET: ['/api/dashboard/*', '/api/monitor/*', '/api/analytics/*', '/api/settings/*', '/api/auth/*', '/api/emissions/*'],
      POST: ['/api/auth/*'],
      PATCH: ['/api/auth/*', '/api/settings/*'],
      PUT: ['/api/settings/*'],
      DELETE: []
    }
  };

  const allowedRoutes = routeAccess[role]?.[method] || [];
  
  // Check if route is allowed
  const isAllowed = allowedRoutes.some(route => {
    if (route === '*') return true;
    if (route.endsWith('/*')) {
      const baseRoute = route.slice(0, -2);
      return path.startsWith(baseRoute);
    }
    return path === route || path.startsWith(route + '/');
  });

  if (!isAllowed) {
    return res.status(403).json({
      success: false,
      message: `Access denied. Your role (${role}) cannot ${method} ${path}`,
      allowedRoutes: allowedRoutes
    });
  }

  next();
};

// Check if user can access resource (own data or admin)
const authorizeResourceAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Admin can access everything
  if (req.user.role === 'admin') {
    req.canAccessAll = true;
    return next();
  }

  // Regular users can only access their own data
  req.canAccessAll = false;
  req.userFilter = { user_id: req.user.id }; // MongoDB compatible
  
  next();
};

// Middleware to check if user can modify specific resource
const authorizeResourceModification = (resourceUserIdField = 'user_id') => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Admin can modify anything
    if (req.user.role === 'admin') {
      return next();
    }

    // For regular users, check if they own the resource
    try {
      const resourceId = req.params.id;
      if (!resourceId) {
        return res.status(400).json({
          success: false,
          message: 'Resource ID required'
        });
      }

      req.requireOwnership = true;
      req.ownershipField = resourceUserIdField;
      
      next();
    } catch (error) {
      logger.error('Resource authorization error', error);
      return res.status(500).json({
        success: false,
        message: 'Authorization check failed'
      });
    }
  };
};

// Log user activity middleware
const logActivity = (action, resourceType = null) => {
  return async (req, res, next) => {
    // Store activity info to be logged after successful operation
    req.activityLog = {
      action,
      resourceType,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    };
    
    next();
  };
};

// Middleware to validate user can access their own data only
const requireOwnership = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Admin can access all data
  if (req.user.role === 'admin') {
    return next();
  }

  // For other users, they can only access their own data
  req.ownershipRequired = true;
  next();
};

module.exports = {
  authenticateToken,
  authorizeRoles,
  requireAdmin,
  checkScopeAccess,
  checkActivityAccess,
  checkPageAccess,
  enforceRouteAccess,
  authorizeResourceAccess,
  authorizeResourceModification,
  logActivity,
  requireOwnership
};