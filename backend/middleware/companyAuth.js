// middleware/companyAuth.js - MongoDB-compatible company operator authentication
const jwt = require('jsonwebtoken');
const { CompanyOperator } = require('../models');
const logger = require('../utils/logger');

// Authenticate company operator token
const authenticateCompanyOperator = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Company operator access token is required'
      });
    }

    // Verify the JWT token (using company secret)
    const decoded = jwt.verify(
      token, 
      process.env.COMPANY_JWT_SECRET || process.env.JWT_SECRET || 'company-secret-key'
    );

    if (!decoded || !decoded.id || decoded.type !== 'company_operator') {
      return res.status(401).json({
        success: false,
        message: 'Invalid company operator token'
      });
    }

    // Get company operator from MongoDB
    const operator = await CompanyOperator.findById(decoded.id).select('-password');

    if (!operator) {
      return res.status(401).json({
        success: false,
        message: 'Company operator not found'
      });
    }

    // Check if operator account is active
    if (!operator.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Company operator account is not active'
      });
    }

    // Set operator information in request
    req.companyOperator = {
      id: operator._id.toString(),
      name: operator.name,
      email: operator.email,
      role: operator.role,
      permissions: {
        canCreateOrgs: operator.can_create_orgs === true,
        canManageOrgs: operator.can_manage_orgs === true,
        canViewAllOrgs: operator.can_view_all_orgs === true
      }
    };

    logger.debug('Company operator authenticated', { email: operator.email });
    return next();

  } catch (error) {
    logger.error('Company auth error', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Company operator token has expired'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid company operator token'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Company operator authentication failed'
    });
  }
};

// Check if operator can create organisations
const canCreateOrganisations = (req, res, next) => {
  if (!req.companyOperator) {
    return res.status(401).json({
      success: false,
      message: 'Company operator authentication required'
    });
  }

  if (!req.companyOperator.permissions.canCreateOrgs) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to create organisations'
    });
  }

  next();
};

// Check if operator can manage organisations
const canManageOrganisations = (req, res, next) => {
  if (!req.companyOperator) {
    return res.status(401).json({
      success: false,
      message: 'Company operator authentication required'
    });
  }

  if (!req.companyOperator.permissions.canManageOrgs) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to manage organisations'
    });
  }

  next();
};

// Check if operator is super operator
const requireSuperOperator = (req, res, next) => {
  if (!req.companyOperator) {
    return res.status(401).json({
      success: false,
      message: 'Company operator authentication required'
    });
  }

  if (req.companyOperator.role !== 'super_operator') {
    return res.status(403).json({
      success: false,
      message: 'Super operator access required'
    });
  }

  next();
};

// Log company operator activity
const logCompanyActivity = (action, description) => {
  return async (req, res, next) => {
    // Store activity info to be logged after successful operation
    req.companyActivity = {
      action,
      description,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      operatorId: req.companyOperator?.id,
      operatorName: req.companyOperator?.name
    };
    
    next();
  };
};

module.exports = {
  authenticateCompanyOperator,
  canCreateOrganisations,
  canManageOrganisations,
  requireSuperOperator,
  logCompanyActivity
};