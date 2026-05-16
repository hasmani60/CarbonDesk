// controllers/exportController.js
const { Emission, Activity, User } = require('../models');
const XLSX = require('xlsx');
const { formatDate, formatTime } = require('../utils/dateFormat');

// @desc    Export activities to CSV/Excel
// @route   GET /api/export/activities
// @access  Private
const exportActivities = async (req, res) => {
  try {
    const { format = 'csv', scope, startDate, endDate } = req.query;
    
    const query = {};
    if (scope && scope !== 'all') {
      const emissions = await Emission.find({ scope: parseInt(scope) });
      const emissionIds = emissions.map(e => e._id);
      query.resourceId = { $in: emissionIds };
      query.resourceType = 'emission';
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const activities = await Activity.find(query)
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    // Transform data for export
    const exportData = activities.map(activity => ({
      'User': activity.user?.name || 'Unknown',
      'Email': activity.user?.email || '',
      'Action': activity.action.replace('_', ' ').toUpperCase(),
      'Details': activity.details || '',
      'Date': formatDate(activity.createdAt),
      'Time': formatTime(activity.createdAt),
      'IP Address': activity.ipAddress || ''
    }));

    if (format === 'xlsx') {
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Activities');
      
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=activities_export.xlsx');
      res.send(buffer);
    } else {
      // CSV format
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=activities_export.csv');
      res.send(csv);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Export emissions data
// @route   GET /api/export/emissions
// @access  Private
const exportEmissions = async (req, res) => {
  try {
    const { format = 'csv', scope, startDate, endDate } = req.query;
    
    const query = {};
    if (scope && scope !== 'all') query.scope = parseInt(scope);
    
    if (startDate || endDate) {
      query['accountingPeriod.start'] = {};
      if (startDate) query['accountingPeriod.start'].$gte = new Date(startDate);
      if (endDate) query['accountingPeriod.start'].$lte = new Date(endDate);
    }

    const emissions = await Emission.find(query)
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    const exportData = emissions.map(emission => ({
      'User': emission.user?.name || 'Unknown',
      'Scope': emission.scope,
      'Category': emission.category,
      'Activity Type': emission.activityType,
      'Source': emission.source,
      'Amount': emission.amount,
      'Unit': emission.unit,
      'Total Emissions (CO2e)': emission.totalEmissions,
      'Start Date': formatDate(emission.accountingPeriod.start),
      'End Date': formatDate(emission.accountingPeriod.end),
      'Status': emission.status,
      'Location': emission.location || '',
      'Created Date': formatDate(emission.createdAt)
    }));

    if (format === 'xlsx') {
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Emissions');
      
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=emissions_export.xlsx');
      res.send(buffer);
    } else {
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=emissions_export.csv');
      res.send(csv);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  exportActivities,
  exportEmissions
};
