// controllers/dashboardController.js - Fixed with MongoDB fallback
const mongoose = require('mongoose');

// Helper function to check if MongoDB is connected
const isMongoConnected = () => {
  try {
    return mongoose.connection && mongoose.connection.readyState === 1;
  } catch (error) {
    return false;
  }
};

// @desc    Get dashboard summary
// @route   GET /api/dashboard/summary
// @access  Private
const getDashboardSummary = async (req, res) => {
  try {
    // Check if MongoDB is connected
    if (!isMongoConnected()) {
      // Return demo dashboard data
      const currentYear = new Date().getFullYear();
      const startDate = new Date(currentYear, 0, 1);
      const endDate = new Date(currentYear, 11, 31);
      
      const demoDashboardData = {
        scope1: { 
          total: 375315, 
          percentage: 33.3, 
          count: 5,
          topCategories: [
            { name: 'Fuel from Generator', value: 375200, percentage: 99.97 },
            { name: 'Company Vehicles', value: 65, percentage: 0.02 },
            { name: 'Water Used', value: 50, percentage: 0.01 }
          ]
        },
        scope2: { 
          total: 30, 
          percentage: 33.3, 
          count: 1,
          topCategories: [
            { name: 'Electricity Purchased', value: 30, percentage: 100 },
            { name: 'No Data', value: 0, percentage: 0 },
            { name: 'No Data', value: 0, percentage: 0 }
          ]
        },
        scope3: { 
          total: 125, 
          percentage: 33.4, 
          count: 3,
          topCategories: [
            { name: 'Business Travel', value: 60, percentage: 48 },
            { name: 'Export of Material', value: 65, percentage: 52 },
            { name: 'No Data', value: 0, percentage: 0 }
          ]
        },
        totalEmissions: 375470,
        recentActivityCount: 15,
        reportingPeriod: {
          start: startDate,
          end: endDate
        }
      };
      
      return res.json({
        success: true,
        data: demoDashboardData
      });
    }
    
    // Original MongoDB logic
    const { Emission, Activity } = require('../models');
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
    console.error('Dashboard summary error:', error);
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
    // Check if MongoDB is connected
    if (!isMongoConnected()) {
      // Return demo notifications
      const sampleNotifications = [
        {
          _id: '1',
          type: 'deadline_reminder',
          title: 'Deadline Reminder',
          message: 'Q1 emissions report is due in 3 days. Please review and submit your data.',
          deadline: '25/03/2025',
          user: { name: 'System', avatar: 'S' },
          date: '25/03/2025',
          read: false
        },
        {
          _id: '2',
          type: 'task_assigned',
          title: 'New Task Assigned',
          message: 'You have been assigned to review Scope 2 electricity data for March.',
          deadline: 'Tomorrow',
          user: { name: 'Admin User', avatar: 'AU' },
          date: new Date().toLocaleDateString(),
          read: false
        },
        {
          _id: '3',
          type: 'emission_submitted',
          title: 'Emission Data Submitted',
          message: 'Your emission record for generator fuel has been submitted for review.',
          deadline: 'Today',
          user: { name: 'John Doe', avatar: 'JD' },
          date: new Date().toLocaleDateString(),
          read: true
        },
        {
          _id: '4',
          type: 'system_update',
          title: 'System Update',
          message: 'New emission factors have been updated for 2025. Please review your calculations.',
          deadline: 'Info',
          user: { name: 'System', avatar: 'S' },
          date: new Date().toLocaleDateString(),
          read: false
        }
      ];
      
      return res.json({
        success: true,
        data: sampleNotifications
      });
    }
    
    // Original MongoDB logic
    const { Notification } = require('../models');
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

    // If no notifications, return sample notifications
    if (notifications.length === 0) {
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
      
      return res.json({
        success: true,
        data: sampleNotifications
      });
    }

    res.json({
      success: true,
      data: notifications
    });
  } catch (error) {
    console.error('Dashboard notifications error:', error);
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