// controllers/analyticsController.js
const { Emission } = require('../models');

// @desc    Get emission trends
// @route   GET /api/analytics/trends
// @access  Private
const getEmissionTrends = async (req, res) => {
  try {
    const { 
      scope, 
      dateRange = '12months', 
      startDate, 
      endDate 
    } = req.query;

    let matchStage = { status: 'verified' };

    // Apply scope filter
    if (scope && scope !== 'all') {
      matchStage.scope = parseInt(scope);
    }

    // Apply date filter
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else {
      const now = new Date();
      switch (dateRange) {
        case '7days':
          dateFilter.$gte = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30days':
          dateFilter.$gte = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '3months':
          dateFilter.$gte = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          break;
        case '6months':
          dateFilter.$gte = new Date(now.getFullYear(), now.getMonth() - 6, 1);
          break;
        default: // 12months
          dateFilter.$gte = new Date(now.getFullYear(), 0, 1);
      }
    }

    matchStage['accountingPeriod.start'] = dateFilter;

    const trends = await Emission.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            year: { $year: '$accountingPeriod.start' },
            month: { $month: '$accountingPeriod.start' },
            scope: '$scope'
          },
          totalEmissions: { $sum: '$totalEmissions' },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: {
            year: '$_id.year',
            month: '$_id.month'
          },
          scopes: {
            $push: {
              scope: '$_id.scope',
              totalEmissions: '$totalEmissions',
              count: '$count'
            }
          },
          totalEmissions: { $sum: '$totalEmissions' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      success: true,
      data: trends
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get scope comparison
// @route   GET /api/analytics/scope-comparison
// @access  Private
const getScopeComparison = async (req, res) => {
  try {
    const { dateRange = 'currentYear' } = req.query;
    
    const now = new Date();
    let startDate, endDate;

    switch (dateRange) {
      case 'currentYear':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        break;
      case 'lastYear':
        startDate = new Date(now.getFullYear() - 1, 0, 1);
        endDate = new Date(now.getFullYear() - 1, 11, 31);
        break;
      default:
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
    }

    const comparison = await Emission.aggregate([
      {
        $match: {
          'accountingPeriod.start': { $gte: startDate, $lte: endDate },
          status: 'verified'
        }
      },
      {
        $group: {
          _id: '$scope',
          totalEmissions: { $sum: '$totalEmissions' },
          avgEmissions: { $avg: '$totalEmissions' },
          count: { $sum: 1 },
          maxEmission: { $max: '$totalEmissions' },
          minEmission: { $min: '$totalEmissions' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: comparison
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getEmissionTrends,
  getScopeComparison
};