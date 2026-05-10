// backend/controllers/dashboardController.js
// MongoDB Implementation - Fixed with better error handling

const Emission = require('../models/Emission'); // You'll need to create this model
const User = require('../models/User'); // Adjust path as needed
const { scopeQuery } = require('../middleware/organisationScope');

/**
 * Aggregation pipeline: top emission rows by display label & scope (for dashboard pie breakdown).
 * @param {Record<string, unknown>} orgMatch - e.g. { organisation_id }
 * @param {Record<string, unknown>} scopeMatch - optional extra filter e.g. { scope: 3 }
 * @param {number} limit - max groups to return
 */
const buildTopActivitiesPipeline = (orgMatch, scopeMatch = {}, limit = 5) => [
  { $match: { ...orgMatch, ...scopeMatch } },
  {
    $addFields: {
      _sourceFrag: {
        $cond: [
          { $gt: [{ $strLenCP: { $ifNull: ['$subcategory', ''] } }, 0] },
          '$subcategory',
          { $ifNull: ['$source', { $ifNull: ['$activity', ''] }] }
        ]
      }
    }
  },
  {
    $addFields: {
      _displayLabel: {
        $cond: [
          { $gt: [{ $strLenCP: { $ifNull: ['$category', ''] } }, 0] },
          {
            $cond: [
              { $gt: [{ $strLenCP: '$_sourceFrag' }, 0] },
              { $concat: ['$category', ' · ', '$_sourceFrag'] },
              '$category'
            ]
          },
          {
            $cond: [
              { $gt: [{ $strLenCP: '$_sourceFrag' }, 0] },
              '$_sourceFrag',
              { $ifNull: ['$activity', 'Unknown'] }
            ]
          }
        ]
      }
    }
  },
  {
    $group: {
      _id: { activity: '$_displayLabel', scope: '$scope' },
      count: { $sum: 1 },
      total_co2e: { $sum: { $ifNull: ['$co2e', 0] } }
    }
  },
  { $sort: { total_co2e: -1 } },
  { $limit: limit },
  {
    $project: {
      activity: '$_id.activity',
      scope: '$_id.scope',
      count: 1,
      total_co2e: 1,
      _id: 0
    }
  }
];

// @desc    Get dashboard summary
// @route   GET /api/dashboard/summary
// @access  Private (Admin, Viewer, Contributor)
const getDashboardSummary = async (req, res) => {
  try {
    console.log('📊 =================================');
    console.log('📊 DASHBOARD REQUEST (MongoDB)');
    console.log('📊 User:', req.user.email);
    console.log('📊 User ID:', req.user.id);
    console.log('📊 User Role:', req.user.role);
    console.log('📊 User Org ID:', req.user.organisation_id);
    console.log('📊 Request Org ID:', req.organisationId);
    console.log('📊 Organisation:', req.organisation?.name || 'NONE');
    console.log('📊 =================================');
    
    // Get organisation filter
    const orgFilter = scopeQuery(req);
    
    if (!orgFilter.organisation_id) {
      console.error('❌ NO ORGANISATION FILTER');
      return res.status(403).json({
        success: false,
        message: 'Dashboard requires organisation membership',
        debug: {
          user_id: req.user.id,
          user_org_id: req.user.organisation_id,
          req_org_id: req.organisationId
        }
      });
    }
    
    console.log('🔒 Filtering data by organisation_id:', orgFilter.organisation_id);
    
    // MongoDB filter
    const mongoFilter = { organisation_id: orgFilter.organisation_id };
    
    // 1. Get total emissions by scope using MongoDB aggregation
    const emissionsByScope = await Emission.aggregate([
      { $match: mongoFilter },
      {
        $group: {
          _id: '$scope',
          count: { $sum: 1 },
          total_co2e: { $sum: '$co2e' },
          verified_count: {
            $sum: { $cond: [{ $eq: ['$status', 'verified'] }, 1, 0] }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    console.log(`✅ Found ${emissionsByScope.length} scope groups`);
    
    // 2. Get total emissions summary
    const totalStats = await Emission.aggregate([
      { $match: mongoFilter },
      {
        $group: {
          _id: null,
          total_count: { $sum: 1 },
          total_co2e: { $sum: '$co2e' },
          verified_count: {
            $sum: { $cond: [{ $eq: ['$status', 'verified'] }, 1, 0] }
          },
          draft_count: {
            $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] }
          }
        }
      }
    ]);
    
    const totalEmissions = totalStats[0] || {
      total_count: 0,
      total_co2e: 0,
      verified_count: 0,
      draft_count: 0
    };
    
    console.log(`✅ Total emissions: ${totalEmissions.total_count} records, ${totalEmissions.total_co2e} kg CO2e`);
    
    // 3. Get recent emissions (last 10)
    const recentEmissions = await Emission.find(mongoFilter)
      .sort({ created_at: -1 })
      .limit(10)
      .select(
        'scope category subcategory source activityType activity quantity amount unit co2e date status created_by_name created_at organisation_id organisation_name'
      )
      .lean();
    
    console.log(`✅ Found ${recentEmissions.length} recent emissions`);
    
    // 4. Get monthly trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const monthlyTrend = await Emission.aggregate([
      {
        $match: {
          ...mongoFilter,
          date: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' }
          },
          total_co2e: { $sum: '$co2e' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      {
        $project: {
          month: {
            $concat: [
              { $toString: '$_id.year' },
              '-',
              {
                $cond: [
                  { $lt: ['$_id.month', 10] },
                  { $concat: ['0', { $toString: '$_id.month' }] },
                  { $toString: '$_id.month' }
                ]
              }
            ]
          },
          total_co2e: 1,
          count: 1
        }
      }
    ]);
    
    // 5. Top activities — global top 5 (legacy) + per-scope top 3 (for dashboard pies: scope rows can be missing from global top 5)
    const [topActivities, topScope1Acts, topScope2Acts, topScope3Acts] = await Promise.all([
      Emission.aggregate(buildTopActivitiesPipeline(mongoFilter, {}, 5)),
      Emission.aggregate(buildTopActivitiesPipeline(mongoFilter, { scope: 1 }, 3)),
      Emission.aggregate(buildTopActivitiesPipeline(mongoFilter, { scope: 2 }, 3)),
      Emission.aggregate(buildTopActivitiesPipeline(mongoFilter, { scope: 3 }, 3))
    ]);
    
    // 6. Get user statistics for this organisation
    const userStats = await User.aggregate([
      { $match: { organisation_id: orgFilter.organisation_id } },
      {
        $group: {
          _id: null,
          total_users: { $sum: 1 },
          active_users: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          admin_count: {
            $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] }
          },
          contributor_count: {
            $sum: { $cond: [{ $eq: ['$role', 'contributor'] }, 1, 0] }
          }
        }
      }
    ]);
    
    const userStatsData = userStats[0] || {
      total_users: 0,
      active_users: 0,
      admin_count: 0,
      contributor_count: 0
    };
    
    // 7. Calculate percentages and trends
    const scope1Data = emissionsByScope.find(s => s._id === 1) || { total_co2e: 0, count: 0 };
    const scope2Data = emissionsByScope.find(s => s._id === 2) || { total_co2e: 0, count: 0 };
    const scope3Data = emissionsByScope.find(s => s._id === 3) || { total_co2e: 0, count: 0 };
    
    const scope1Percentage = totalEmissions.total_co2e > 0 
      ? ((scope1Data.total_co2e || 0) / totalEmissions.total_co2e * 100).toFixed(1)
      : 0;
    
    const scope2Percentage = totalEmissions.total_co2e > 0 
      ? ((scope2Data.total_co2e || 0) / totalEmissions.total_co2e * 100).toFixed(1)
      : 0;
    
    const scope3Percentage = totalEmissions.total_co2e > 0 
      ? ((scope3Data.total_co2e || 0) / totalEmissions.total_co2e * 100).toFixed(1)
      : 0;
    
    const verificationRate = totalEmissions.total_count > 0
      ? ((totalEmissions.verified_count / totalEmissions.total_count) * 100).toFixed(1)
      : 0;
    
    // Validate organisation context
    if (!req.organisation) {
      console.error('❌ Organisation context missing in request');
      return res.status(500).json({
        success: false,
        message: 'Organisation context not properly initialized. Please contact support.',
        debug: {
          user_id: req.user.id,
          user_org_id: req.user.organisation_id,
          req_org_id: req.organisationId,
          has_organisation: !!req.organisation
        }
      });
    }
    
    // Prepare response
    const summary = {
      organisation: {
        id: req.organisation.id || req.organisation._id,
        name: req.organisation.name,
        display_name: req.organisation.display_name,
        industry_type: req.organisation.industry_type
      },
      overview: {
        total_emissions: parseFloat((totalEmissions.total_co2e || 0).toFixed(2)),
        total_count: totalEmissions.total_count || 0,
        verified_count: totalEmissions.verified_count || 0,
        draft_count: totalEmissions.draft_count || 0,
        verification_rate: parseFloat(verificationRate)
      },
      by_scope: {
        scope_1: {
          total_co2e: parseFloat((scope1Data.total_co2e || 0).toFixed(2)),
          count: scope1Data.count || 0,
          percentage: parseFloat(scope1Percentage)
        },
        scope_2: {
          total_co2e: parseFloat((scope2Data.total_co2e || 0).toFixed(2)),
          count: scope2Data.count || 0,
          percentage: parseFloat(scope2Percentage)
        },
        scope_3: {
          total_co2e: parseFloat((scope3Data.total_co2e || 0).toFixed(2)),
          count: scope3Data.count || 0,
          percentage: parseFloat(scope3Percentage)
        }
      },
      recent_emissions: recentEmissions,
      monthly_trend: monthlyTrend,
      top_activities: topActivities,
      top_activities_by_scope: {
        scope_1: topScope1Acts,
        scope_2: topScope2Acts,
        scope_3: topScope3Acts
      },
      user_stats: userStatsData
    };
    
    console.log(`✅ Dashboard loaded for ${req.organisation.name}: ${totalEmissions.total_count} emissions, ${totalEmissions.total_co2e?.toFixed(2)} kg CO2e`);
    console.log('📊 =================================\n');
    
    res.json({
      success: true,
      data: summary,
      _debug: {
        filtered_by_org: orgFilter.organisation_id,
        org_name: req.organisation.name,
        user_email: req.user.email
      }
    });
    
  } catch (error) {
    console.error('❌ Dashboard summary error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch dashboard summary',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Get dashboard notifications
// @route   GET /api/dashboard/notifications
// @access  Private
const getDashboardNotifications = async (req, res) => {
  try {
    const orgFilter = scopeQuery(req);
    const notifications = [];
    
    if (!orgFilter.organisation_id) {
      return res.json({
        success: true,
        data: notifications,
        total: 0
      });
    }
    
    const mongoFilter = { organisation_id: orgFilter.organisation_id };
    
    // 1. Check for unverified emissions
    if (req.user.role === 'admin' || req.user.role === 'analyst') {
      const unverifiedCount = await Emission.countDocuments({
        ...mongoFilter,
        status: { $in: ['draft', 'pending'] }
      });
      
      if (unverifiedCount > 0) {
        notifications.push({
          id: 'unverified-emissions',
          type: 'warning',
          title: 'Pending Verification',
          message: `${unverifiedCount} emission(s) require verification`,
          action: '/monitor',
          created_at: new Date().toISOString()
        });
      }
    }
    
    // 2. Check for recent activity (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentActivity = await Emission.countDocuments({
      ...mongoFilter,
      created_at: { $gte: oneDayAgo }
    });
    
    if (recentActivity > 0) {
      notifications.push({
        id: 'recent-activity',
        type: 'info',
        title: 'Recent Activity',
        message: `${recentActivity} new emission(s) added in the last 24 hours`,
        action: '/dashboard',
        created_at: new Date().toISOString()
      });
    }
    
    // 3. Check for monthly total
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const monthlyStats = await Emission.aggregate([
      {
        $match: {
          ...mongoFilter,
          date: { $gte: startOfMonth }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$co2e' }
        }
      }
    ]);
    
    const monthlyTotal = monthlyStats[0]?.total || 0;
    
    if (monthlyTotal > 1000) {
      notifications.push({
        id: 'monthly-total',
        type: 'info',
        title: 'Monthly Summary',
        message: `This month's total: ${monthlyTotal.toFixed(2)} kg CO2e`,
        action: '/analytics',
        created_at: new Date().toISOString()
      });
    }
    
    // 4. Welcome message for new users
    const userCreatedDate = new Date(req.user.created_at || Date.now());
    const daysSinceCreated = Math.floor((Date.now() - userCreatedDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceCreated <= 7) {
      notifications.push({
        id: 'welcome',
        type: 'success',
        title: 'Welcome!',
        message: `Welcome to ${req.organisation?.name || 'Carbon Track'}. Start by adding your first emission.`,
        action: '/input',
        created_at: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      data: notifications,
      total: notifications.length
    });
    
  } catch (error) {
    console.error('❌ Dashboard notifications error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch notifications'
    });
  }
};

module.exports = {
  getDashboardSummary,
  getDashboardNotifications
};