// controllers/adminController.js - FIXED to use SQLite Database
const mongoose = require('mongoose');
const localDB = require('../database/localDB');

// Helper function to check if MongoDB is connected
const isMongoConnected = () => {
  try {
    return mongoose.connection && mongoose.connection.readyState === 1;
  } catch (error) {
    return false;
  }
};

// @desc    Get all user activities (Admin only)
// @route   GET /api/admin/activities
// @access  Private (Admin)
const getAllActivities = async (req, res) => {
  try {
    console.log('📊 getAllActivities called');
    
    // Check if MongoDB is connected
    if (!isMongoConnected()) {
      console.log('🗄️  Using SQLite database for activities...');
      
      // USE SQLITE DATABASE
      const {
        page = 1,
        limit = 20,
        userId,
        action,
        startDate,
        endDate,
        search
      } = req.query;

      // Build SQLite query
      let query = `
        SELECT 
          a.id,
          a.user_id,
          a.action,
          a.resource_type,
          a.resource_id,
          a.details,
          a.ip_address,
          a.user_agent,
          a.created_at,
          u.id as user_id,
          u.name as user_name,
          u.email as user_email,
          u.role as user_role
        FROM activity_logs a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE 1=1
      `;
      const params = [];

      // Apply filters
      if (userId && userId !== 'all') {
        query += ' AND a.user_id = ?';
        params.push(userId);
      }

      if (action && action !== 'all') {
        query += ' AND a.action LIKE ?';
        params.push(`%${action}%`);
      }

      if (startDate) {
        query += ' AND a.created_at >= ?';
        params.push(startDate);
      }

      if (endDate) {
        query += ' AND a.created_at <= ?';
        params.push(endDate);
      }

      if (search) {
        query += ' AND (a.details LIKE ? OR a.action LIKE ? OR u.name LIKE ? OR u.email LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
      }

      query += ' ORDER BY a.created_at DESC';
      
      // Get total count for pagination
      const countQuery = query.replace(
        'SELECT a.id, a.user_id, a.action, a.resource_type, a.resource_id, a.details, a.ip_address, a.user_agent, a.created_at, u.id as user_id, u.name as user_name, u.email as user_email, u.role as user_role',
        'SELECT COUNT(*) as total'
      ).split('ORDER BY')[0];

      const totalResult = await new Promise((resolve, reject) => {
        localDB.db.get(countQuery, params, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      const total = totalResult?.total || 0;

      // Apply pagination
      const offset = (page - 1) * limit;
      query += ` LIMIT ? OFFSET ?`;
      params.push(parseInt(limit), offset);

      // Execute query
      const activities = await new Promise((resolve, reject) => {
        localDB.db.all(query, params, (err, rows) => {
          if (err) {
            console.error('SQLite query error:', err);
            reject(err);
          } else {
            resolve(rows);
          }
        });
      });

      // Transform activities for frontend
      const transformedActivities = activities.map(activity => ({
        _id: activity.id,
        id: activity.id,
        user: {
          id: activity.user_id,
          name: activity.user_name || 'Unknown User',
          email: activity.user_email,
          role: activity.user_role,
          avatar: activity.user_name ? activity.user_name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U'
        },
        action: activity.action,
        actionDisplay: formatActionDisplay(activity.action),
        resourceType: activity.resource_type,
        resourceId: activity.resource_id,
        details: activity.details,
        ipAddress: activity.ip_address,
        userAgent: activity.user_agent,
        createdAt: activity.created_at,
        timestamp: activity.created_at
      }));

      console.log(`✅ Loaded ${transformedActivities.length} activities from SQLite`);

      return res.json({
        success: true,
        data: transformedActivities,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      });
    }

    // Original MongoDB logic (if connected)
    const { Activity, User } = require('../models');
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

    if (userId && userId !== 'all') {
      query.user = userId;
    }

    if (action && action !== 'all') {
      query.action = new RegExp(action, 'i');
    }

    if (resourceType && resourceType !== 'all') {
      query.resourceType = resourceType;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

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
      timestamp: activity.createdAt.toISOString(),
      metadata: activity.metadata
    }));

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
    console.log('📊 getUserActivitySummary called');
    
    if (!isMongoConnected()) {
      console.log('🗄️  Using SQLite database for user summary...');
      
      const { timeframe = '7days' } = req.query;
      
      // Calculate date filter
      const now = new Date();
      let dateFilter;
      
      switch (timeframe) {
        case '24hours':
          dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
          break;
        case '7days':
          dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
          break;
        case '30days':
          dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
          break;
        default:
          dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      }

      // Get user activity statistics from SQLite
      const userStatsQuery = `
        SELECT 
          u.id as userId,
          u.name,
          u.email,
          u.role,
          COUNT(a.id) as totalActivities,
          COUNT(DISTINCT a.action) as uniqueActions,
          MAX(a.created_at) as lastActivity
        FROM users u
        LEFT JOIN activity_logs a ON u.id = a.user_id AND a.created_at >= ?
        WHERE u.status = 'active'
        GROUP BY u.id, u.name, u.email, u.role
        ORDER BY totalActivities DESC
      `;

      const userStats = await new Promise((resolve, reject) => {
        localDB.db.all(userStatsQuery, [dateFilter], (err, rows) => {
          if (err) reject(err);
          else {
            const formatted = rows.map(row => ({
              userId: row.userId,
              user: {
                id: row.userId,
                name: row.name,
                email: row.email,
                role: row.role
              },
              totalActivities: row.totalActivities,
              uniqueActions: row.uniqueActions,
              lastActivity: row.lastActivity
            }));
            resolve(formatted);
          }
        });
      });

      // Get system-wide statistics
      const systemStatsQuery = `
        SELECT 
          (SELECT COUNT(*) FROM users WHERE status = 'active') as totalUsers,
          (SELECT COUNT(*) FROM activity_logs) as totalActivities,
          (SELECT COUNT(*) FROM activity_logs WHERE created_at >= ?) as recentActivities
      `;

      const systemStats = await new Promise((resolve, reject) => {
        localDB.db.get(systemStatsQuery, [dateFilter], (err, row) => {
          if (err) reject(err);
          else resolve({
            totalUsers: row.totalUsers,
            totalActivities: row.totalActivities,
            totalEmissions: 0, // Would need emissions table
            recentActivities: row.recentActivities
          });
        });
      });

      console.log('✅ User summary loaded from SQLite');

      return res.json({
        success: true,
        data: {
          userStats,
          emissionStats: [],
          systemStats,
          timeframe
        }
      });
    }

    // Original MongoDB logic
    const { Activity, User, Emission } = require('../models');
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

    const systemStats = {
      totalUsers: await User.countDocuments({ status: 'active' }),
      totalEmissions: await Emission.countDocuments(),
      totalActivities: await Activity.countDocuments(),
      recentActivities: await Activity.countDocuments({ createdAt: dateFilter })
    };

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

// @desc    Get system dashboard data (Admin only)
// @route   GET /api/admin/dashboard
// @access  Private (Admin)
const getAdminDashboard = async (req, res) => {
  try {
    console.log('📊 getAdminDashboard called');
    
    if (!isMongoConnected()) {
      console.log('🗄️  Using SQLite database for dashboard...');
      
      const now = new Date();
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // User statistics
      const userStatsQuery = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive,
          SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as newToday,
          SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as newThisWeek
        FROM users
      `;

      const userStats = await new Promise((resolve, reject) => {
        localDB.db.get(userStatsQuery, [last24Hours, last7Days], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      // Activity statistics
      const activityStatsQuery = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as today,
          SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as thisWeek,
          SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as thisMonth
        FROM activity_logs
      `;

      const activityStats = await new Promise((resolve, reject) => {
        localDB.db.get(activityStatsQuery, [last24Hours, last7Days, last30Days], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      // Emission statistics (if emissions table exists)
      let emissionStats = {
        total: 0,
        pending: 0,
        verified: 0,
        rejected: 0,
        thisWeek: 0
      };

      try {
        const emissionStatsQuery = `
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'pending' OR status = 'submitted' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) as verified,
            SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
            SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as thisWeek
          FROM emissions
        `;

        emissionStats = await new Promise((resolve, reject) => {
          localDB.db.get(emissionStatsQuery, [last7Days], (err, row) => {
            if (err) {
              // Table might not exist, use default values
              resolve(emissionStats);
            } else {
              resolve(row || emissionStats);
            }
          });
        });
      } catch (err) {
        console.log('Emissions table not found, using default values');
      }

      console.log('✅ Dashboard data loaded from SQLite:', {
        userStats,
        activityStats,
        emissionStats
      });

      return res.json({
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
    }

    // Original MongoDB logic
    const { User, Activity, Emission } = require('../models');
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const userStats = {
      total: await User.countDocuments(),
      active: await User.countDocuments({ status: 'active' }),
      inactive: await User.countDocuments({ status: 'inactive' }),
      newToday: await User.countDocuments({ createdAt: { $gte: last24Hours } }),
      newThisWeek: await User.countDocuments({ createdAt: { $gte: last7Days } })
    };

    const activityStats = {
      total: await Activity.countDocuments(),
      today: await Activity.countDocuments({ createdAt: { $gte: last24Hours } }),
      thisWeek: await Activity.countDocuments({ createdAt: { $gte: last7Days } }),
      thisMonth: await Activity.countDocuments({ createdAt: { $gte: last30Days } })
    };

    const emissionStats = {
      total: await Emission.countDocuments(),
      pending: await Emission.countDocuments({ status: 'submitted' }),
      verified: await Emission.countDocuments({ status: 'verified' }),
      rejected: await Emission.countDocuments({ status: 'rejected' }),
      thisWeek: await Emission.countDocuments({ createdAt: { $gte: last7Days } })
    };

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

    const criticalActivities = await Activity.find({
      action: { 
        $in: ['deleted_emission', 'admin_created_user', 'admin_updated_user_role', 'admin_deleted_user'] 
      },
      createdAt: { $gte: last24Hours }
    })
      .populate('user', 'name email role')
      .sort({ createdAt: -1 })
      .limit(10);

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
      { $match: { count: { $gte: 3 } } },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        userStats,
        activityStats,
        emissionStats,
        topUsers,
        criticalActivities: criticalActivities.map(activity => ({
          ...activity.toObject(),
          severity: classifyActivitySeverity(activity.action)
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
    'admin_created_user': 'Admin: Created User',
    'admin_updated_user_role': 'Admin: Changed User Role',
    'admin_updated_user_status': 'Admin: Changed User Status',
    'admin_deleted_user': 'Admin: Deleted User',
    'admin_viewed_user_activities': 'Admin: Viewed User Activities',
    'password_change': 'Password Changed',
    'profile_update': 'Profile Updated',
    'user_registered': 'User Registered',
    'viewed_dashboard': 'Viewed Dashboard',
    'viewed_analytics': 'Viewed Analytics',
    'viewed_monitor': 'Viewed Monitor'
  };
  
  return actionMap[action] || action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const classifyActivitySeverity = (action) => {
  const highSeverity = ['deleted_emission', 'admin_deleted_user', 'admin_updated_user_role'];
  const mediumSeverity = ['created_emission', 'updated_emission', 'admin_created_user', 'password_change'];
  const lowSeverity = ['login', 'logout', 'profile_update', 'viewed_'];
  
  if (highSeverity.some(h => action.includes(h))) return 'high';
  if (mediumSeverity.some(m => action.includes(m))) return 'medium';
  if (lowSeverity.some(l => action.includes(l))) return 'low';
  return 'medium';
};

module.exports = {
  getAllActivities,
  getUserActivitySummary,
  getAdminDashboard
};