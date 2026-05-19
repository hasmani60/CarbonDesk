const { ActivityLog } = require('../models');

// Extract user ID logic shared across endpoints
const getUserId = (req) => req.user.id ? req.user.id.toString() : req.user._id.toString();

/**
 * Log a new activity
 * @route POST /api/activities/log
 */
const logActivity = async (req, res) => {
  try {
    const { action, resource_type, resource_id, details } = req.body;
    const userId = getUserId(req);
    
    await ActivityLog.create({
      user_id: userId,
      action: action || 'page_view',
      resource_type: resource_type || null,
      resource_id: resource_id || null,
      details: details || '',
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Activity logged'
    });
  } catch (error) {
    console.error('Activity log error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get recent system-wide activities
 * @route GET /api/activities/recent
 */
const getRecentActivities = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    
    // Admins and analysts can see all activities; others can't access this (RBAC handled in route)
    const activities = await ActivityLog.find()
      .sort({ created_at: -1 })
      .limit(limit)
      .populate('user_id', 'name email role');

    res.json({
      success: true,
      data: activities
    });
  } catch (error) {
    console.error('Get recent activities error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get activities for a specific user
 * @route GET /api/activities/user/:id
 */
const getUserActivities = async (req, res) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const userId = getUserId(req);

    // Only allow users to see their own activities unless they're an admin
    if (req.user.role !== 'admin' && id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to view these activities'
      });
    }

    const activities = await ActivityLog.find({ user_id: id })
      .sort({ created_at: -1 })
      .limit(limit);

    res.json({
      success: true,
      data: activities
    });
  } catch (error) {
    console.error('Get user activities error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  logActivity,
  getRecentActivities,
  getUserActivities
};
