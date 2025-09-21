// middleware/auth.js - Updated authentication middleware for Local DB
const jwt = require('jsonwebtoken');
const localDB = require('../database/localDB');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    console.log('Auth middleware - Token received:', token ? 'Yes' : 'No');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required'
      });
    }

    // Verify the JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    console.log('Auth middleware - Token decoded:', decoded);

    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    // Get user from local database
    const user = await localDB.findUserById(decoded.id);
    console.log('Auth middleware - Database user found:', !!user);

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
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      restrictions: user.restrictions || null
    };
    
    console.log('Auth middleware - User set:', req.user);
    return next();

  } catch (error) {
    console.error('Auth middleware error:', error.message);
    
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

// Role-based authorization middleware
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${roles.join(', ')}. Your role: ${req.user.role}`
      });
    }

    console.log(`Auth middleware - Role authorized: ${req.user.role} for required roles: ${roles.join(', ')}`);
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

  console.log('Auth middleware - Admin access granted for:', req.user.email);
  next();
};

// RBAC middleware for checking scope and activity restrictions (for contributors)
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

    // Contributors with restrictions
    if (req.user.role === 'contributor' && req.user.restrictions) {
      const allowedScopes = req.user.restrictions.allowedScopes || [1, 2, 3];
      
      if (!allowedScopes.includes(parseInt(requiredScope))) {
        return res.status(403).json({
          success: false,
          message: `Access denied. You don't have permission to access Scope ${requiredScope}`
        });
      }
    }

    next();
  };
};

// RBAC middleware for checking activity restrictions (for contributors)
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

// RBAC middleware for checking page restrictions
const checkPageAccess = (page) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Admin has full access
    if (req.user.role === 'admin') {
      return next();
    }

    // Check role-based page access
    const rolePageAccess = {
      analyst: ['/dashboard', '/input', '/monitor', '/analytics', '/settings'],
      contributor: ['/dashboard', '/input', '/monitor', '/settings'], // Note: /analytics removed
      viewer: ['/dashboard', '/monitor'] // Limited access
    };

    const allowedPages = rolePageAccess[req.user.role] || [];
    
    if (!allowedPages.includes(page)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Your role (${req.user.role}) doesn't have access to ${page}`
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
  req.userFilter = { user: req.user.id };
  
  next();
};

// Middleware to check if user can modify specific resource
const authorizeResourceModification = (resourceUserIdField = 'user') => {
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

      // This is a generic check - specific controllers should implement their own logic
      req.requireOwnership = true;
      req.ownershipField = resourceUserIdField;
      
      next();
    } catch (error) {
      console.error('Resource authorization error:', error);
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

module.exports = {
  authenticateToken,
  authorizeRoles,
  requireAdmin,
  checkScopeAccess,       // NEW: For scope-based access control
  checkActivityAccess,    // NEW: For activity-based access control
  checkPageAccess,        // NEW: For page-based access control
  authorizeResourceAccess,
  authorizeResourceModification,
  logActivity
};