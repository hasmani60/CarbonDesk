// backend/controllers/dashboardController.js
// Enhanced with clear organisation context logging

const localDB = require('../database/localDB');
const { scopeQuery } = require('../middleware/organisationScope');

// @desc    Get dashboard summary
// @route   GET /api/dashboard/summary
// @access  Private (Admin, Viewer, Contributor)
const getDashboardSummary = async (req, res) => {
  try {
    console.log('📊 =================================');
    console.log('📊 DASHBOARD REQUEST');
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
      console.error('❌ NO ORGANISATION FILTER - This should not happen!');
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
    
    // Build WHERE clause for organisation
    const whereClause = 'WHERE organisation_id = ?';
    const params = [orgFilter.organisation_id];
    
    // 1. Get total emissions by scope
    const emissionsByScope = await new Promise((resolve, reject) => {
      localDB.db.all(
        `SELECT 
          scope,
          COUNT(*) as count,
          SUM(co2e) as total_co2e,
          SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) as verified_count
        FROM emissions 
        ${whereClause}
        GROUP BY scope
        ORDER BY scope`,
        params,
        (err, rows) => {
          if (err) {
            console.error('❌ Error fetching emissions by scope:', err);
            reject(err);
          } else {
            console.log(`✅ Found ${rows?.length || 0} scope groups`);
            resolve(rows || []);
          }
        }
      );
    }).catch(() => []);
    
    // 2. Get total emissions summary
    const totalEmissions = await new Promise((resolve, reject) => {
      localDB.db.get(
        `SELECT 
          COUNT(*) as total_count,
          SUM(co2e) as total_co2e,
          SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) as verified_count,
          SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_count
        FROM emissions 
        ${whereClause}`,
        params,
        (err, row) => {
          if (err) {
            console.error('❌ Error fetching total emissions:', err);
            reject(err);
          } else {
            console.log(`✅ Total emissions: ${row?.total_count || 0} records, ${row?.total_co2e || 0} kg CO2e`);
            resolve(row || { total_count: 0, total_co2e: 0, verified_count: 0, draft_count: 0 });
          }
        }
      );
    }).catch(() => ({ total_count: 0, total_co2e: 0, verified_count: 0, draft_count: 0 }));
    
    // 3. Get recent emissions (last 10)
    const recentEmissions = await new Promise((resolve, reject) => {
      localDB.db.all(
        `SELECT 
          id, scope, category, activity, quantity, unit, co2e, 
          date, status, created_by_name, created_at, organisation_id, organisation_name
        FROM emissions 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT 10`,
        params,
        (err, rows) => {
          if (err) {
            console.error('❌ Error fetching recent emissions:', err);
            reject(err);
          } else {
            console.log(`✅ Found ${rows?.length || 0} recent emissions`);
            resolve(rows || []);
          }
        }
      );
    }).catch(() => []);
    
    // 4. Get monthly trend (last 6 months)
    const monthlyTrend = await new Promise((resolve, reject) => {
      localDB.db.all(
        `SELECT 
          strftime('%Y-%m', date) as month,
          SUM(co2e) as total_co2e,
          COUNT(*) as count
        FROM emissions 
        ${whereClause} AND date >= date('now', '-6 months')
        GROUP BY month
        ORDER BY month`,
        params,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    }).catch(() => []);
    
    // 5. Get top activities (by CO2e)
    const topActivities = await new Promise((resolve, reject) => {
      localDB.db.all(
        `SELECT 
          activity,
          scope,
          COUNT(*) as count,
          SUM(co2e) as total_co2e
        FROM emissions 
        ${whereClause}
        GROUP BY activity, scope
        ORDER BY total_co2e DESC
        LIMIT 5`,
        params,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    }).catch(() => []);
    
    // 6. Get user statistics for this organisation
    const userStats = await new Promise((resolve, reject) => {
      localDB.db.get(
        `SELECT 
          COUNT(*) as total_users,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_users,
          SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admin_count,
          SUM(CASE WHEN role = 'contributor' THEN 1 ELSE 0 END) as contributor_count
        FROM users 
        WHERE organisation_id = ?`,
        [orgFilter.organisation_id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row || { total_users: 0, active_users: 0, admin_count: 0, contributor_count: 0 });
        }
      );
    }).catch(() => ({ total_users: 0, active_users: 0, admin_count: 0, contributor_count: 0 }));
    
    // 7. Calculate percentages and trends
    const scope1Percentage = totalEmissions.total_co2e > 0 
      ? ((emissionsByScope.find(s => s.scope === 1)?.total_co2e || 0) / totalEmissions.total_co2e * 100).toFixed(1)
      : 0;
    
    const scope2Percentage = totalEmissions.total_co2e > 0 
      ? ((emissionsByScope.find(s => s.scope === 2)?.total_co2e || 0) / totalEmissions.total_co2e * 100).toFixed(1)
      : 0;
    
    const scope3Percentage = totalEmissions.total_co2e > 0 
      ? ((emissionsByScope.find(s => s.scope === 3)?.total_co2e || 0) / totalEmissions.total_co2e * 100).toFixed(1)
      : 0;
    
    const verificationRate = totalEmissions.total_count > 0
      ? ((totalEmissions.verified_count / totalEmissions.total_count) * 100).toFixed(1)
      : 0;
    
    // Prepare response
    const summary = {
      organisation: {
        id: req.organisation.id,
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
          total_co2e: parseFloat((emissionsByScope.find(s => s.scope === 1)?.total_co2e || 0).toFixed(2)),
          count: emissionsByScope.find(s => s.scope === 1)?.count || 0,
          percentage: parseFloat(scope1Percentage)
        },
        scope_2: {
          total_co2e: parseFloat((emissionsByScope.find(s => s.scope === 2)?.total_co2e || 0).toFixed(2)),
          count: emissionsByScope.find(s => s.scope === 2)?.count || 0,
          percentage: parseFloat(scope2Percentage)
        },
        scope_3: {
          total_co2e: parseFloat((emissionsByScope.find(s => s.scope === 3)?.total_co2e || 0).toFixed(2)),
          count: emissionsByScope.find(s => s.scope === 3)?.count || 0,
          percentage: parseFloat(scope3Percentage)
        }
      },
      recent_emissions: recentEmissions,
      monthly_trend: monthlyTrend,
      top_activities: topActivities,
      user_stats: userStats
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
      message: error.message || 'Failed to fetch dashboard summary'
    });
  }
};

// @desc    Get dashboard notifications
// @route   GET /api/dashboard/notifications
// @access  Private
const getDashboardNotifications = async (req, res) => {
  try {
    console.log('🔔 Getting notifications for:', req.user.email);
    
    const notifications = [];
    
    // Get organisation filter
    const orgFilter = scopeQuery(req);
    
    if (orgFilter.organisation_id) {
      // 1. Check for draft emissions
      const draftCount = await new Promise((resolve, reject) => {
        localDB.db.get(
          'SELECT COUNT(*) as count FROM emissions WHERE organisation_id = ? AND status = "draft"',
          [orgFilter.organisation_id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row?.count || 0);
          }
        );
      }).catch(() => 0);
      
      if (draftCount > 0) {
        notifications.push({
          id: 'draft-emissions',
          type: 'warning',
          title: 'Draft Emissions',
          message: `You have ${draftCount} draft emission(s) pending verification`,
          action: '/input',
          created_at: new Date().toISOString()
        });
      }
      
      // 2. Check for recent activity (last 24 hours)
      const recentActivity = await new Promise((resolve, reject) => {
        localDB.db.get(
          'SELECT COUNT(*) as count FROM emissions WHERE organisation_id = ? AND created_at >= datetime("now", "-1 day")',
          [orgFilter.organisation_id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row?.count || 0);
          }
        );
      }).catch(() => 0);
      
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
      
      // 3. Check for monthly goal (if total emissions > 1000)
      const monthlyTotal = await new Promise((resolve, reject) => {
        localDB.db.get(
          `SELECT SUM(co2e) as total FROM emissions 
           WHERE organisation_id = ? 
           AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now')`,
          [orgFilter.organisation_id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row?.total || 0);
          }
        );
      }).catch(() => 0);
      
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

// @desc    Get recent activity
// @route   GET /api/dashboard/recent-activity
// @access  Private
const getRecentActivity = async (req, res) => {
  try {
    const orgFilter = scopeQuery(req);
    
    // Get recent emissions
    const recentEmissions = await new Promise((resolve, reject) => {
      localDB.db.all(
        `SELECT 
          id, scope, activity, co2e, date, status,
          created_by_name, created_at,
          'emission' as type
        FROM emissions 
        WHERE organisation_id = ?
        ORDER BY created_at DESC
        LIMIT 20`,
        [orgFilter.organisation_id],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    }).catch(() => []);
    
    // Get recent user activities from activity_logs
    const recentUserActivities = await localDB.getUserActivities(req.user.id, 10);
    
    // Combine and format
    const activities = [
      ...recentEmissions.map(e => ({
        id: `emission-${e.id}`,
        type: 'emission',
        action: 'created',
        title: `New ${e.activity}`,
        description: `Scope ${e.scope} • ${e.co2e} kg CO2e`,
        user: e.created_by_name,
        timestamp: e.created_at,
        status: e.status
      })),
      ...recentUserActivities.slice(0, 10).map(a => ({
        id: `activity-${a.id}`,
        type: 'user_activity',
        action: a.action,
        title: a.action.replace(/_/g, ' '),
        description: a.details,
        user: req.user.name,
        timestamp: a.created_at
      }))
    ];
    
    // Sort by timestamp
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json({
      success: true,
      data: activities.slice(0, 20)
    });
    
  } catch (error) {
    console.error('❌ Recent activity error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch recent activity'
    });
  }
};

// @desc    Get dashboard insights
// @route   GET /api/dashboard/insights
// @access  Private
const getDashboardInsights = async (req, res) => {
  try {
    const orgFilter = scopeQuery(req);
    const insights = [];
    
    // Insight 1: Highest emitting scope
    const scopeBreakdown = await new Promise((resolve, reject) => {
      localDB.db.all(
        `SELECT scope, SUM(co2e) as total FROM emissions 
         WHERE organisation_id = ? 
         GROUP BY scope 
         ORDER BY total DESC`,
        [orgFilter.organisation_id],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    }).catch(() => []);
    
    if (scopeBreakdown.length > 0 && scopeBreakdown[0].total > 0) {
      const topScope = scopeBreakdown[0];
      const totalEmissions = scopeBreakdown.reduce((sum, s) => sum + s.total, 0);
      const percentage = ((topScope.total / totalEmissions) * 100).toFixed(1);
      
      insights.push({
        type: 'scope_analysis',
        title: `Scope ${topScope.scope} is your highest emitter`,
        description: `Accounting for ${percentage}% of total emissions (${topScope.total.toFixed(2)} kg CO2e)`,
        priority: 'high',
        action: `/analytics?scope=${topScope.scope}`
      });
    }
    
    // Insight 2: Recent trend
    const lastMonthTotal = await new Promise((resolve, reject) => {
      localDB.db.get(
        `SELECT SUM(co2e) as total FROM emissions 
         WHERE organisation_id = ? 
         AND date >= date('now', '-1 month')`,
        [orgFilter.organisation_id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row?.total || 0);
        }
      );
    }).catch(() => 0);
    
    const previousMonthTotal = await new Promise((resolve, reject) => {
      localDB.db.get(
        `SELECT SUM(co2e) as total FROM emissions 
         WHERE organisation_id = ? 
         AND date >= date('now', '-2 months')
         AND date < date('now', '-1 month')`,
        [orgFilter.organisation_id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row?.total || 0);
        }
      );
    }).catch(() => 0);
    
    if (lastMonthTotal > 0 && previousMonthTotal > 0) {
      const change = ((lastMonthTotal - previousMonthTotal) / previousMonthTotal * 100).toFixed(1);
      const trend = change > 0 ? 'increased' : 'decreased';
      
      insights.push({
        type: 'trend_analysis',
        title: `Emissions ${trend} by ${Math.abs(change)}%`,
        description: `Compared to previous month (${lastMonthTotal.toFixed(2)} vs ${previousMonthTotal.toFixed(2)} kg CO2e)`,
        priority: change > 10 ? 'high' : 'medium',
        action: '/analytics'
      });
    }
    
    res.json({
      success: true,
      data: insights
    });
    
  } catch (error) {
    console.error('❌ Dashboard insights error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch insights'
    });
  }
};

module.exports = {
  getDashboardSummary,
  getDashboardNotifications,
  getRecentActivity,
  getDashboardInsights
};