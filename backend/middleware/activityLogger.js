// middleware/activityLogger.js - MongoDB-compatible activity logging
const { ActivityLog } = require('../models');
const logger = require('../utils/logger');

/**
 * Middleware to log user activities to MongoDB
 * Usage: router.post('/endpoint', activityLogger('action_name', 'resource_type'), controller)
 */
const activityLogger = (action, resourceType = null) => {
  return async (req, res, next) => {
    // Store original res.json to intercept successful responses
    const originalJson = res.json.bind(res);
    
    res.json = async function(data) {
      // Only log if response was successful
      if (data.success !== false && res.statusCode < 400) {
        try {
          const activityData = {
            user_id: req.user?.id || 'system', // String
            action: action,
            resource_type: resourceType || extractResourceType(req.path),
            resource_id: extractResourceId(req, data),
            details: generateActivityDetails(action, req, data),
            ip_address: req.ip || req.connection?.remoteAddress || 'unknown',
            user_agent: req.get('User-Agent') || 'unknown',
            created_at: new Date()
          };

          // Create activity log in MongoDB
          await ActivityLog.create(activityData);
          
          logger.debug('Activity logged', {
            action,
            user: req.user?.email,
            resource: resourceType
          });
        } catch (error) {
          // Don't fail the request if logging fails
          logger.error('Failed to log activity', error);
        }
      }
      
      // Call original res.json
      return originalJson(data);
    };
    
    next();
  };
};

/**
 * Extract resource type from request path
 */
const extractResourceType = (path) => {
  const parts = path.split('/').filter(Boolean);
  
  // Try to extract meaningful resource type from path
  if (parts.length >= 2 && parts[0] === 'api') {
    return parts[1]; // e.g., /api/users -> 'users'
  }
  
  return 'unknown';
};

/**
 * Extract resource ID from request or response
 */
const extractResourceId = (req, data) => {
  // Try to get ID from URL params
  if (req.params.id) {
    return req.params.id;
  }
  
  // Try to get ID from response data
  if (data.data) {
    if (data.data.id) return data.data.id;
    if (data.data._id) return data.data._id.toString();
    if (Array.isArray(data.data) && data.data[0]) {
      return data.data[0].id || data.data[0]._id?.toString();
    }
  }
  
  return null;
};

/**
 * Generate human-readable activity details
 */
const generateActivityDetails = (action, req, data) => {
  const user = req.user?.name || req.user?.email || 'Unknown user';
  
  const actionDescriptions = {
    'login': `${user} logged in`,
    'logout': `${user} logged out`,
    'user_created': `${user} created a new user`,
    'user_updated': `${user} updated user information`,
    'user_deleted': `${user} deleted a user`,
    'user_role_updated': `${user} updated user role`,
    'user_status_updated': `${user} updated user status`,
    'emission_created': `${user} created a new emission record`,
    'emission_updated': `${user} updated an emission record`,
    'emission_deleted': `${user} deleted an emission record`,
    'emission_verified': `${user} verified an emission record`,
    'task_created': `${user} created a new task`,
    'task_updated': `${user} updated a task`,
    'task_deleted': `${user} deleted a task`,
    'organisation_updated': `${user} updated organisation settings`,
    'password_changed': `${user} changed their password`,
    'profile_updated': `${user} updated their profile`
  };
  
  return actionDescriptions[action] || `${user} performed ${action}`;
};

/**
 * Log activity after response is sent
 * This version doesn't intercept the response
 */
const logActivityAfterResponse = (action, resourceType = null) => {
  return (req, res, next) => {
    // Store activity info in request for manual logging
    req.pendingActivity = {
      action,
      resourceType,
      user_id: req.user?.id,
      ip_address: req.ip || req.connection?.remoteAddress,
      user_agent: req.get('User-Agent')
    };
    
    next();
  };
};

/**
 * Manually log the pending activity
 * Call this in your controller after successful operation
 */
const logPendingActivity = async (req, resourceId = null, details = null) => {
  if (!req.pendingActivity) return;
  
  try {
    await ActivityLog.create({
      user_id: req.pendingActivity.user_id || 'system',
      action: req.pendingActivity.action,
      resource_type: req.pendingActivity.resourceType || 'unknown',
      resource_id: resourceId,
      details: details || generateActivityDetails(req.pendingActivity.action, req, {}),
      ip_address: req.pendingActivity.ip_address || 'unknown',
      user_agent: req.pendingActivity.user_agent || 'unknown',
      created_at: new Date()
    });
  } catch (error) {
    logger.error('Failed to log pending activity', error);
  }
};

/**
 * Simple activity logger that creates log immediately
 * Use this when you want to log before sending response
 */
const logActivityNow = async (req, action, resourceType, resourceId = null, details = null) => {
  try {
    await ActivityLog.create({
      user_id: req.user?.id || 'system',
      action: action,
      resource_type: resourceType,
      resource_id: resourceId,
      details: details || generateActivityDetails(action, req, {}),
      ip_address: req.ip || req.connection?.remoteAddress || 'unknown',
      user_agent: req.get('User-Agent') || 'unknown',
      created_at: new Date()
    });
    
    return true;
  } catch (error) {
    logger.error('Failed to log activity', error);
    return false;
  }
};

module.exports = {
  activityLogger,
  logActivityAfterResponse,
  logPendingActivity,
  logActivityNow
};