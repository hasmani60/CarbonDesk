// controllers/adminController.js - Admin monitoring and user management
const { Activity, User, Emission, Task, Notification } = require('../models');

// Helper function to log admin activity
const logAdminActivity = async (adminId, action, resourceType, resourceId, details, req) => {
  try {
    await Activity.create({
      user: adminId,
      action: `admin_${action}`,
      resourceType,
      resourceId,
      details,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
  } catch (error) {
    console.error('Failed to log admin activity:', error);
  }
};

// @desc    Get all user activities (Admin only)
// @route   GET /api/admin/activities
// @access  Private (Admin)
const getAllActivities = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      userId,
      action,
      resourceType,
      startDate,
      endDate,
      search
    } = req.query;

    let query = {};

    // Filter by user
    if (userId && userId !== 'all') {
      query.user = userId;
    }

    // Filter by action
    if (action && action !== 'all') {
      query.action = new RegExp(action, 'i');
    }

    // Filter by resource type
    if (resourceType && resourceType !== 'all') {
      query.resourceType = resourceType;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Search in details
    if (search) {
      query.$or = [
        { details: new RegExp(search, 'i') },
        { action: new RegExp(search, 'i') }
      ];
    }

    const activities = await Activity.find(query)
      .populate('user', 'name email role')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Activity.countDocuments(query);

    // Transform activities for better frontend display
    const transformedActivities = activities.map(activity => ({
      _id: activity._id,
      user: {
        id: activity.user?._id,
        name: activity.user?.name || 'Unknown User',
        email: activity.user?.email,
        role: activity.user?.role,
        avatar: activity.user?.name ? activity.user.name.split(' ').map(n => n[0]).join('') : 'U'
      },
      action: activity.action,
      actionDisplay: formatActionDisplay(activity.action),
      resourceType: activity.resourceType,
      resourceId: activity.resourceId,
      details: activity.details,
      ipAddress: activity.ipAddress,
      userAgent: activity.userAgent,
      createdAt: activity.createdAt,
      timestamp: activity.createdAt.toISOString()
    }));

    // Log this admin activity
    await logAdminActivity(
      req.user.id,
      'viewed_all_activities',
      'activity',
      null,
      `Viewed ${activities.length} user activities`,
      req
    );

    res.json({
      success: true,
      data: transformedActivities,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get all activities error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get user activity summary (Admin only)
// @route   GET /api/admin/user-summary
// @access  Private (Admin)
const getUserActivitySummary = async (req, res) => {
  try {
    const { timeframe = '7days' } = req.query;
    
    let dateFilter = {};
    const now = new Date();
    
    switch (timeframe) {
      case '24hours':
        dateFilter.$gte = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7days':
        dateFilter.$gte = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30days':
        dateFilter.$gte = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        dateFilter.$gte = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Get user activity statistics
    const userStats = await Activity.aggregate([
      { $match: { createdAt: dateFilter } },
      {
        $group: {
          _id: '$user',
          totalActivities: { $sum: 1 },
          lastActivity: { $max: '$createdAt' },
          actions: { $push: '$action' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          userId: '$_id',
          user: {
            id: '$userInfo._id',
            name: '$userInfo.name',
            email: '$userInfo.email',
            role: '$userInfo.role'
          },
          totalActivities: 1,
          lastActivity: 1,
          uniqueActions: { $size: { $setUnion: ['$actions', []] } }
        }
      },
      { $sort: { totalActivities: -1 } }
    ]);

    // Get emission statistics by user
    const emissionStats = await Emission.aggregate([
      { $match: { createdAt: dateFilter } },
      {
        $group: {
          _id: '$user',
          totalEmissions: { $sum: '$totalEmissions' },
          emissionCount: { $sum: 1 },
          avgEmission: { $avg: '$totalEmissions' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true } },
      { $sort: { totalEmissions: -1 } }
    ]);

    // Get system-wide statistics
    const systemStats = {
      totalUsers: await User.countDocuments({ status: 'active' }),
      totalEmissions: await Emission.countDocuments(),
      totalActivities: await Activity.countDocuments(),
      recentActivities: await Activity.countDocuments({ createdAt: dateFilter })
    };

    // Log this admin activity
    await logAdminActivity(
      req.user.id,
      'viewed_user_summary',
      'user',
      null,
      `Viewed user activity summary for ${timeframe}`,
      req
    );

    res.json({
      success: true,
      data: {
        userStats,
        emissionStats,
        systemStats,
        timeframe
      }
    });
  } catch (error) {
    console.error('Get user summary error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get audit logs (Admin only)
// @route   GET /api/admin/audit-logs
// @access  Private (Admin)
const getAuditLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      userId,
      action,
      severity = 'all',
      startDate,
      endDate
    } = req.query;

    let query = {};

    // Filter by user
    if (userId && userId !== 'all') {
      query.user = userId;
    }

    // Filter by action type
    if (action && action !== 'all') {
      if (action === 'security') {
        query.action = { $in: ['login', 'logout', 'password_change', 'failed_login'] };
      } else if (action === 'emissions') {
        query.action = { $in: ['created_emission', 'updated_emission', 'deleted_emission', 'verified_emission'] };
      } else if (action === 'admin') {
        query.action = { $regex: '^admin_' };
      } else {
        query.action = new RegExp(action, 'i');
      }
    }

    // Filter by date range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const logs = await Activity.find(query)
      .populate('user', 'name email role')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Activity.countDocuments(query);

    // Transform logs with severity classification
    const transformedLogs = logs.map(log => ({
      _id: log._id,
      timestamp: log.createdAt,
      user: {
        id: log.user?._id,
        name: log.user?.name || 'System',
        email: log.user?.email,
        role: log.user?.role
      },
      action: log.action,
      actionDisplay: formatActionDisplay(log.action),
      severity: classifyLogSeverity(log.action),
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      details: log.details,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      metadata: {
        browser: extractBrowser(log.userAgent),
        os: extractOS(log.userAgent)
      }
    }));

    // Log this admin activity
    await logAdminActivity(
      req.user.id,
      'viewed_audit_logs',
      'activity',
      null,
      `Viewed ${logs.length} audit log entries`,
      req
    );

    res.json({
      success: true,
      data: transformedLogs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get system dashboard data (Admin only)
// @route   GET /api/admin/dashboard
// @access  Private (Admin)
const getAdminDashboard = async (req, res) => {
  try {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // User statistics
    const userStats = {
      total: await User.countDocuments(),
      active: await User.countDocuments({ status: 'active' }),
      inactive: await User.countDocuments({ status: 'inactive' }),
      newToday: await User.countDocuments({ createdAt: { $gte: last24Hours } }),
      newThisWeek: await User.countDocuments({ createdAt: { $gte: last7Days } })
    };

    // Activity statistics
    const activityStats = {
      total: await Activity.countDocuments(),
      today: await Activity.countDocuments({ createdAt: { $gte: last24Hours } }),
      thisWeek: await Activity.countDocuments({ createdAt: { $gte: last7Days } }),
      thisMonth: await Activity.countDocuments({ createdAt: { $gte: last30Days } })
    };

    // Emission statistics
    const emissionStats = {
      total: await Emission.countDocuments(),
      pending: await Emission.countDocuments({ status: 'submitted' }),
      verified: await Emission.countDocuments({ status: 'verified' }),
      rejected: await Emission.countDocuments({ status: 'rejected' }),
      thisWeek: await Emission.countDocuments({ createdAt: { $gte: last7Days } })
    };

    // Top active users
    const topUsers = await Activity.aggregate([
      { $match: { createdAt: { $gte: last7Days } } },
      { $group: { _id: '$user', activityCount: { $sum: 1 } } },
      { $sort: { activityCount: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: '$userInfo' },
      {
        $project: {
          user: {
            id: '$userInfo._id',
            name: '$userInfo.name',
            email: '$userInfo.email',
            role: '$userInfo.role'
          },
          activityCount: 1
        }
      }
    ]);

    // Recent critical activities
    const criticalActivities = await Activity.find({
      action: { 
        $in: ['deleted_emission', 'admin_user_role_changed', 'admin_user_status_changed', 'failed_login'] 
      },
      createdAt: { $gte: last24Hours }
    })
      .populate('user', 'name email role')
      .sort({ createdAt: -1 })
      .limit(10);

    // Security alerts
    const securityAlerts = await Activity.aggregate([
      {
        $match: {
          createdAt: { $gte: last24Hours },
          $or: [
            { action: 'failed_login' },
            { action: { $regex: '^admin_' } }
          ]
        }
      },
      { $group: { _id: '$user', count: { $sum: 1 } } },
      { $match: { count: { $gte: 3 } } }, // 3+ failed attempts or admin actions
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      }
    ]);

    // Log dashboard access
    await logAdminActivity(
      req.user.id,
      'viewed_admin_dashboard',
      'system',
      null,
      'Accessed admin dashboard',
      req
    );

    res.json({
      success: true,
      data: {
        userStats,
        activityStats,
        emissionStats,
        topUsers,
        criticalActivities: criticalActivities.map(activity => ({
          ...activity.toObject(),
          severity: classifyLogSeverity(activity.action)
        })),
        securityAlerts,
        lastUpdated: now
      }
    });
  } catch (error) {
    console.error('Get admin dashboard error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Helper functions
const formatActionDisplay = (action) => {
  const actionMap = {
    'login': 'User Login',
    'logout': 'User Logout',
    'created_emission': 'Created Emission',
    'updated_emission': 'Updated Emission',
    'deleted_emission': 'Deleted Emission',
    'verified_emission': 'Verified Emission',
    'admin_viewed_all_users': 'Admin: Viewed All Users',
    'admin_user_role_changed': 'Admin: Changed User Role',
    'admin_user_status_changed': 'Admin: Changed User Status',
    'password_change': 'Password Changed',
    'profile_update': 'Profile Updated'
  };
  
  return actionMap[action] || action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const classifyLogSeverity = (action) => {
  const highSeverity = ['deleted_emission', 'admin_user_role_changed', 'admin_user_status_changed'];
  const mediumSeverity = ['created_emission', 'updated_emission', 'verified_emission', 'password_change'];
  const lowSeverity = ['login', 'logout', 'profile_update', 'viewed_'];
  
  if (highSeverity.some(h => action.includes(h))) return 'high';
  if (mediumSeverity.some(m => action.includes(m))) return 'medium';
  if (lowSeverity.some(l => action.includes(l))) return 'low';
  return 'medium';
};

const extractBrowser = (userAgent) => {
  if (!userAgent) return 'Unknown';
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';
  return 'Other';
};

const extractOS = (userAgent) => {
  if (!userAgent) return 'Unknown';
  if (userAgent.includes('Windows')) return 'Windows';
  if (userAgent.includes('Mac')) return 'MacOS';
  if (userAgent.includes('Linux')) return 'Linux';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('iOS')) return 'iOS';
  return 'Other';
};

module.exports = {
  getAllActivities,
  getUserActivitySummary,
  getAuditLogs,
  getAdminDashboard
};