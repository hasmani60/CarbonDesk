// controllers/adminController.js - Compatible with String user_id
const { ActivityLog, User, Emission } = require('../models');

const formatActionDisplay = (action) => {
  const actionMap = {
    'login': 'User Login',
    'logout': 'User Logout',
    'created_emission': 'Created Emission',
    'updated_emission': 'Updated Emission',
    'deleted_emission': 'Deleted Emission',
    'verified_emission': 'Verified Emission',
    'admin_created_user': 'Admin: Created User',
    'user_created': 'User Created',
    'user_role_updated': 'User Role Updated',
    'user_status_updated': 'User Status Updated',
    'user_deleted': 'User Deleted',
    'task_created': 'Task Created',
    'task_updated': 'Task Updated',
    'task_deleted': 'Task Deleted',
    'password_change': 'Password Changed',
    'profile_update': 'Profile Updated',
    'user_registered': 'User Registered'
  };
  
  return actionMap[action] || action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// @desc    Get all user activities
// @route   GET /api/admin/activities
// @access  Private (Admin)
const getAllActivities = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      userId,
      action,
      startDate,
      endDate,
      search
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    let query = {};

    if (userId && userId !== 'all') {
      query.user_id = userId;
    }

    if (action && action !== 'all') {
      query.action = new RegExp(action, 'i');
    }

    if (startDate || endDate) {
      query.created_at = {};
      if (startDate) query.created_at.$gte = new Date(startDate);
      if (endDate) query.created_at.$lte = new Date(endDate);
    }

    if (search) {
      query.$or = [
        { details: new RegExp(search, 'i') },
        { action: new RegExp(search, 'i') }
      ];
    }

    const activities = await ActivityLog.find(query)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ActivityLog.countDocuments(query);

    // Manually fetch user data since user_id is String
    const transformedActivities = await Promise.all(activities.map(async (activity) => {
      let user = null;
      if (activity.user_id) {
        try {
          user = await User.findById(activity.user_id).select('name email role');
        } catch (e) {
          // User might not be found
        }
      }

      return {
        _id: activity._id.toString(),
        id: activity._id.toString(),
        user: user ? {
          id: user._id.toString(),
          name: user.name || 'Unknown User',
          email: user.email,
          role: user.role,
          avatar: user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U'
        } : {
          id: activity.user_id,
          name: 'Unknown User',
          avatar: 'U'
        },
        action: activity.action,
        actionDisplay: formatActionDisplay(activity.action),
        resourceType: activity.resource_type,
        resourceId: activity.resource_id,
        details: activity.details,
        ipAddress: activity.ip_address,
        userAgent: activity.user_agent,
        createdAt: activity.created_at,
        timestamp: activity.created_at.toISOString()
      };
    }));

    res.json({
      success: true,
      data: transformedActivities,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get user activity summary
// @route   GET /api/admin/user-summary
// @access  Private (Admin)
const getUserActivitySummary = async (req, res) => {
  try {
    const { timeframe = '7days' } = req.query;
    
    const now = new Date();
    let dateFilter;
    
    switch (timeframe) {
      case '24hours':
        dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7days':
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30days':
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    const userActivities = await ActivityLog.aggregate([
      {
        $match: {
          created_at: { $gte: dateFilter }
        }
      },
      {
        $group: {
          _id: '$user_id',
          activityCount: { $sum: 1 },
          lastActivity: { $max: '$created_at' }
        }
      },
      {
        $sort: { activityCount: -1 }
      },
      {
        $limit: 10
      }
    ]);

    const populatedActivities = await Promise.all(
      userActivities.map(async (activity) => {
        let user = null;
        try {
          user = await User.findById(activity._id).select('name email role status');
        } catch (e) {}
        
        return {
          user: user ? {
            id: user._id.toString(),
            name: user.name || 'Unknown User',
            email: user.email,
            role: user.role,
            status: user.status,
            avatar: user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U'
          } : {
            id: activity._id,
            name: 'Unknown User',
            avatar: 'U'
          },
          activityCount: activity.activityCount,
          lastActivity: activity.lastActivity
        };
      })
    );

    const actionBreakdown = await ActivityLog.aggregate([
      {
        $match: {
          created_at: { $gte: dateFilter }
        }
      },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      }
    ]);

    res.json({
      success: true,
      data: {
        timeframe,
        userActivities: populatedActivities,
        actionBreakdown: actionBreakdown.map(item => ({
          action: item._id,
          actionDisplay: formatActionDisplay(item._id),
          count: item.count
        })),
        totalActivities: await ActivityLog.countDocuments({
          created_at: { $gte: dateFilter }
        })
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get system dashboard data
// @route   GET /api/admin/dashboard
// @access  Private (Admin)
const getAdminDashboard = async (req, res) => {
  try {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // User statistics for organisation
    const userStats = {
      total: await User.countDocuments({ organisation_id: req.organisationId }),
      active: await User.countDocuments({ organisation_id: req.organisationId, status: 'active' }),
      inactive: await User.countDocuments({ organisation_id: req.organisationId, status: { $ne: 'active' } }),
      newToday: await User.countDocuments({ organisation_id: req.organisationId, created_at: { $gte: last24Hours } }),
      newThisWeek: await User.countDocuments({ organisation_id: req.organisationId, created_at: { $gte: last7Days } })
    };

    // Activity statistics
    const activityStats = {
      total: await ActivityLog.countDocuments({}),
      today: await ActivityLog.countDocuments({ created_at: { $gte: last24Hours } }),
      thisWeek: await ActivityLog.countDocuments({ created_at: { $gte: last7Days } }),
      thisMonth: await ActivityLog.countDocuments({ created_at: { $gte: last30Days } })
    };

    // Emission statistics
    const emissionStats = {
      total: await Emission.countDocuments({ organisation_id: req.organisationId }),
      pending: await Emission.countDocuments({ organisation_id: req.organisationId, status: { $in: ['pending', 'submitted'] } }),
      verified: await Emission.countDocuments({ organisation_id: req.organisationId, status: 'verified' }),
      rejected: await Emission.countDocuments({ organisation_id: req.organisationId, status: 'rejected' }),
      thisWeek: await Emission.countDocuments({ organisation_id: req.organisationId, created_at: { $gte: last7Days } })
    };

    res.json({
      success: true,
      data: {
        userStats,
        activityStats,
        emissionStats,
        topUsers: [],
        criticalActivities: [],
        securityAlerts: [],
        lastUpdated: now
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getAllActivities,
  getUserActivitySummary,
  getAdminDashboard
};