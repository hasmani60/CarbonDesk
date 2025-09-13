// controllers/dashboardController.js
const { Emission, Notification, Activity } = require('../models');
const mongoose = require('mongoose');

// @desc    Get dashboard summary
// @route   GET /api/dashboard/summary
// @access  Private
const getDashboardSummary = async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const startDate = new Date(currentYear, 0, 1);
    const endDate = new Date(currentYear, 11, 31);

    // Get emissions data for current year by scope
    const emissionsByScope = await Emission.aggregate([
      {
        $match: {
          'accountingPeriod.start': { $gte: startDate, $lte: endDate },
          status: 'verified'
        }
      },
      {
        $group: {
          _id: '$scope',
          total: { $sum: '$totalEmissions' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Calculate totals and percentages
    const totalEmissions = emissionsByScope.reduce((sum, scope) => sum + scope.total, 0);
    
    const scopeData = {
      scope1: { total: 0, percentage: 0, count: 0 },
      scope2: { total: 0, percentage: 0, count: 0 },
      scope3: { total: 0, percentage: 0, count: 0 }
    };

    emissionsByScope.forEach(scope => {
      const scopeKey = `scope${scope._id}`;
      scopeData[scopeKey] = {
        total: scope.total,
        percentage: totalEmissions > 0 ? Math.round((scope.total / totalEmissions) * 100) : 0,
        count: scope.count
      };
    });

    // Get recent activity count
    const recentActivityCount = await Activity.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });

    res.json({
      success: true,
      data: {
        ...scopeData,
        totalEmissions,
        recentActivityCount,
        reportingPeriod: {
          start: startDate,
          end: endDate
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get dashboard notifications
// @route   GET /api/dashboard/notifications
// @access  Private
const getDashboardNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipient: req.user.id,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gte: new Date() } }
      ]
    })
    .populate('sender', 'name email')
    .sort({ createdAt: -1 })
    .limit(8);

    // Sample notifications if none exist
    const sampleNotifications = [
      {
        _id: new mongoose.Types.ObjectId(),
        type: 'deadline_reminder',
        title: 'Deadline Reminder',
        message: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        deadline: '25/03/2025',
        user: { name: 'Jhon Doe', avatar: 'JD' },
        date: '25/03/2025',
        read: false
      },
      {
        _id: new mongoose.Types.ObjectId(),
        type: 'task_assigned',
        title: 'Task Assigned',
        message: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        deadline: 'Tomorrow',
        user: { name: 'Jhon Doe', avatar: 'JD' },
        date: 'May 20, 2025',
        read: false
      },
      {
        _id: new mongoose.Types.ObjectId(),
        type: 'emission_submitted',
        title: 'Emission Data Submitted',
        message: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        deadline: 'Today',
        user: { name: 'Jhon Doe', avatar: 'JD' },
        date: 'May 20, 2025',
        read: false
      },
      {
        _id: new mongoose.Types.ObjectId(),
        type: 'system_update',
        title: 'System Update',
        message: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        deadline: 'Tomorrow',
        user: { name: 'Jhon Doe', avatar: 'JD' },
        date: 'May 20, 2025',
        read: false
      }
    ];

    const responseData = notifications.length > 0 ? notifications : sampleNotifications;

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getDashboardSummary,
  getDashboardNotifications
};
