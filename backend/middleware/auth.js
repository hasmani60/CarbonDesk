// middleware/auth.js - Enhanced authentication with role-based access control
const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Demo users for fallback when database is not available
const demoUsers = {
  'demo_admin_id': {
    _id: 'demo_admin_id',
    name: 'Demo Admin',
    email: 'demo@example.com',
    role: 'admin',
    status: 'active'
  },
  'demo_user_id': {
    _id: 'demo_user_id',
    name: 'Demo User',
    email: 'user@example.com',
    role: 'contributor',
    status: 'active'
  }
};

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    console.log('Auth middleware - Token received:', token ? 'Yes' : 'No'); // Debug log

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required'
      });
    }

    // Verify the JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    console.log('Auth middleware - Token decoded:', decoded); // Debug log

    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    // Try to get user from database first
    let user;
    try {
      user = await User.findById(decoded.id);
      console.log('Auth middleware - Database user found:', !!user); // Debug log
    } catch (dbError) {
      console.log('Auth middleware - Database not available, using demo users');
    }

    // If database user found, use it
    if (user) {
      // Check if user account is active
      if (user.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'User account is not active'
        });
      }

      req.user = {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      };
      
      console.log('Auth middleware - Database user set:', req.user); // Debug log
      return next();
    }

    // Fallback to demo users if database not available
    const demoUser = demoUsers[decoded.id];
    if (demoUser) {
      req.user = {
        id: demoUser._id,
        name: demoUser.name,
        email: demoUser.email,
        role: demoUser.role,
        status: demoUser.status
      };
      
      console.log('Auth middleware - Demo user set:', req.user); // Debug log
      return next();
    }

    // User not found
    return res.status(401).json({
      success: false,
      message: 'User not found'
    });

  } catch (error) {
    console.error('Auth middleware error:', error.message); // Debug log
    
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
  authorizeResourceAccess,
  authorizeResourceModification,
  logActivity
};