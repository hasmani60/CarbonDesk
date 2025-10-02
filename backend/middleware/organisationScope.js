// backend/middleware/organisationScope.js
// Middleware to automatically scope all queries to user's organisation

const localDB = require('../database/localDB');

/**
 * Add organisation context to request
 * This middleware must run AFTER authenticateToken
 */
const addOrganisationContext = async (req, res, next) => {
  try {
    // If user is authenticated and has an organisation
    if (req.user && req.user.organisation_id) {
      // Add organisation context to request
      req.organisationId = req.user.organisation_id;
      
      // Fetch organisation details (with caching to avoid repeated DB calls)
      if (!req.organisation) {
        const organisation = await localDB.findOrganisationById(req.user.organisation_id);
        if (organisation) {
          req.organisation = organisation;
          
          // Fetch organisation settings
          const settings = await localDB.getOrganisationSettings(req.user.organisation_id);
          req.organisationSettings = settings;
          
          console.log(`🏢 Request scoped to organisation: ${organisation.name} (${req.organisationId})`);
        } else {
          console.warn(`⚠️  User ${req.user.email} has invalid organisation_id: ${req.user.organisation_id}`);
        }
      }
    } else if (req.user) {
      // User exists but has no organisation - legacy user or unassigned
      console.warn(`⚠️  User ${req.user.email} has no organisation_id`);
      req.organisationId = null;
      req.organisation = null;
    }
    
    next();
  } catch (error) {
    console.error('Organisation context error:', error);
    // Don't fail the request, just continue without org context
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
      code: 'NO_ORGANISATION'
    });
  }
  next();
};

/**
 * Get organisation filter for database queries
 * Returns an object with organisation_id to be used in queries
 */
const scopeQuery = (req) => {
  const filter = {};
  
  // Add organisation scope if available
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
      organisation_id: req.organisationId,
      organisation_name: req.organisation?.name || 'Unknown'
    };
  }
  return data;
};

module.exports = {
  addOrganisationContext,
  requireOrganisation,
  scopeQuery,
  addOrganisationToData
};