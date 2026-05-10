// middleware/organisationScope.js - MongoDB-compatible organisation scoping (FIXED)
const { Organisation, OrganisationSettings } = require('../models');
const logger = require('../utils/logger');

/**
 * Add organisation context to request
 * This middleware must run AFTER authenticateToken
 */
const addOrganisationContext = async (req, res, next) => {
  try {
    // If user is authenticated and has an organisation
    if (req.user && req.user.organisation_id) {
      // Add organisation context to request
      req.organisationId = req.user.organisation_id; // String ID
      
      // Fetch organisation details (with caching to avoid repeated DB calls)
      if (!req.organisation) {
        let organisation = null;
        
        // Try to find by custom id field first
        organisation = await Organisation.findOne({ id: req.user.organisation_id });
        
        // If not found, try finding by MongoDB _id field (which may be a custom string)
        if (!organisation) {
          organisation = await Organisation.findOne({ _id: req.user.organisation_id });
        }
        
        if (organisation) {
          // Convert to plain object and ensure we have both id formats
          const orgObj = organisation.toObject ? organisation.toObject() : organisation;
          req.organisation = {
            ...orgObj,
            id: orgObj.id || orgObj._id.toString(),
            _id: orgObj._id
          };
          
          // Fetch organisation settings
          const settings = await OrganisationSettings.findOne({ 
            organisation_id: req.user.organisation_id 
          });
          
          req.organisationSettings = settings;
          
          logger.debug('Request scoped to organisation', {
            name: req.organisation.name,
            id: req.organisationId,
            found_by: organisation.id ? 'custom_id' : '_id'
          });
        } else {
          logger.warn('User has invalid organisation_id - organisation not found', {
            email: req.user.email,
            organisation_id: req.user.organisation_id
          });
          req.organisationId = null;
          req.organisation = null;
        }
      }
    } else if (req.user) {
      // User exists but has no organisation - unassigned
      logger.warn('User has no organisation_id', { email: req.user.email });
      req.organisationId = null;
      req.organisation = null;
    }
    
    next();
  } catch (error) {
    logger.error('Organisation context error', error);
    // Don't fail the request, just continue without org context
    req.organisationId = null;
    req.organisation = null;
    next();
  }
};

/**
 * Require organisation context
 * Use this for routes that MUST have organisation scoping
 */
const requireOrganisation = (req, res, next) => {
  if (!req.organisationId) {
    return res.status(403).json({
      success: false,
      message: 'This feature requires organisation membership. Please contact your administrator.',
      code: 'NO_ORGANISATION',
      debug: {
        user_email: req.user?.email,
        has_org_id: !!req.user?.organisation_id,
        org_found: !!req.organisation
      }
    });
  }
  
  if (!req.organisation) {
    return res.status(403).json({
      success: false,
      message: 'Organisation not found. Please contact your administrator.',
      code: 'ORGANISATION_NOT_FOUND',
      debug: {
        user_email: req.user?.email,
        organisation_id: req.organisationId
      }
    });
  }
  
  next();
};

/**
 * Get organisation filter for database queries
 * Returns an object with organisation_id to be used in MongoDB queries
 */
const scopeQuery = (req) => {
  const filter = {};
  
  // Add organisation scope if available (String ID)
  if (req.organisationId) {
    filter.organisation_id = req.organisationId;
  }
  
  return filter;
};

/**
 * Add organisation to data being created
 * Automatically adds organisation_id to new records
 */
const addOrganisationToData = (req, data) => {
  if (req.organisationId) {
    return {
      ...data,
      organisation_id: req.organisationId, // String
      organisation_name: req.organisation?.name || 'Unknown'
    };
  }
  return data;
};

/**
 * Validate organisation access for a resource
 * Ensures the resource belongs to the user's organisation
 */
const validateOrganisationAccess = (resource) => {
  return (req, res, next) => {
    if (!req.organisationId) {
      return res.status(403).json({
        success: false,
        message: 'Organisation context required'
      });
    }

    // Store resource name for controller to validate
    req.resourceOrganisationCheck = {
      resource,
      expectedOrgId: req.organisationId
    };

    next();
  };
};

module.exports = {
  addOrganisationContext,
  requireOrganisation,
  scopeQuery,
  addOrganisationToData,
  validateOrganisationAccess
};