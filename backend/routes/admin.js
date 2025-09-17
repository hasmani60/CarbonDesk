// routes/admin.js - Admin-specific routes for monitoring and user management
const express = require('express');
const {
  getAllActivities,
  getUserActivitySummary,
  getAuditLogs,
  getAdminDashboard
} = require('../controllers/adminController');

const router = express.Router();

// All routes here are already protected by requireAdmin middleware in server.js

// @desc    Get admin dashboard data
// @route   GET /api/admin/dashboard
// @access  Private (Admin only)
router.get('/dashboard', getAdminDashboard);

// @desc    Get all user activities
// @route   GET /api/admin/activities
// @access  Private (Admin only)
router.get('/activities', getAllActivities);

// @desc    Get user activity summary
// @route   GET /api/admin/user-summary
// @access  Private (Admin only)
router.get('/user-summary', getUserActivitySummary);

// @desc    Get audit logs
// @route   GET /api/admin/audit-logs
// @access  Private (Admin only)
router.get('/audit-logs', getAuditLogs);

// @desc    Get system statistics
// @route   GET /api/admin/system-stats
// @access  Private (Admin only)
router.get('/system-stats', async (req, res) => {
  try {
    const { Activity, User, Emission } = require('../models');
    
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const stats = {
      users: {
        total: await User.countDocuments(),
        active: await User.countDocuments({ status: 'active' }),
        newThisWeek: await User.countDocuments({ createdAt: { $gte: last7Days } })
      },
      emissions: {
        total: await Emission.countDocuments(),
        thisWeek: await Emission.countDocuments({ createdAt: { $gte: last7Days } }),
        pending: await Emission.countDocuments({ status: 'submitted' }),
        verified: await Emission.countDocuments({ status: 'verified' })
      },
      activities: {
        total: await Activity.countDocuments(),
        today: await Activity.countDocuments({ createdAt: { $gte: last24Hours } }),
        thisWeek: await Activity.countDocuments({ createdAt: { $gte: last7Days } }),
        thisMonth: await Activity.countDocuments({ createdAt: { $gte: last30Days } })
      }
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Get security alerts
// @route   GET /api/admin/security-alerts
// @access  Private (Admin only)
router.get('/security-alerts', async (req, res) => {
  try {
    const { Activity } = require('../models');
    
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Get suspicious activities
    const suspiciousActivities = await Activity.find({
      createdAt: { $gte: last24Hours },
      $or: [
        { action: 'failed_login' },
        { action: 'deleted_emission' },
        { action: { $regex: '^admin_' } }
      ]
    })
      .populate('user', 'name email role')
      .sort({ createdAt: -1 })
      .limit(20);

    // Group by user to find patterns
    const userActivityCount = await Activity.aggregate([
      {
        $match: {
          createdAt: { $gte: last24Hours },
          action: { $in: ['failed_login', 'deleted_emission'] }
        }
      },
      { $group: { _id: '$user', count: { $sum: 1 } } },
      { $match: { count: { $gte: 3 } } }
    ]);

    res.json({
      success: true,
      data: {
        suspiciousActivities,
        highActivityUsers: userActivityCount
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Get user login history
// @route   GET /api/admin/login-history
// @access  Private (Admin only)
router.get('/login-history', async (req, res) => {
  try {
    const { Activity } = require('../models');
    const { userId, days = 30 } = req.query;
    
    const daysAgo = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);
    
    let query = {
      createdAt: { $gte: daysAgo },
      action: { $in: ['login', 'logout'] }
    };

    if (userId) {
      query.user = userId;
    }

    const loginHistory = await Activity.find(query)
      .populate('user', 'name email role')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({
      success: true,
      data: loginHistory
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @desc    Export activity logs
// @route   GET /api/admin/export-logs
// @access  Private (Admin only)
router.get('/export-logs', async (req, res) => {
  try {
    const { Activity } = require('../models');
    const XLSX = require('xlsx');
    const { format = 'csv', startDate, endDate } = req.query;
    
    let query = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const activities = await Activity.find(query)
      .populate('user', 'name email role')
      .sort({ createdAt: -1 });

    const exportData = activities.map(activity => ({
      'Timestamp': activity.createdAt.toISOString(),
      'User': activity.user?.name || 'System',
      'Email': activity.user?.email || '',
      'Role': activity.user?.role || '',
      'Action': activity.action,
      'Resource Type': activity.resourceType || '',
      'Resource ID': activity.resourceId || '',
      'Details': activity.details || '',
      'IP Address': activity.ipAddress || '',
      'User Agent': activity.userAgent || ''
    }));

    if (format === 'xlsx') {
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Activity Logs');
      
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=activity_logs.xlsx');
      res.send(buffer);
    } else {
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=activity_logs.csv');
      res.send(csv);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;