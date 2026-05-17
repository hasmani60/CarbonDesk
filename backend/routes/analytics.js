// backend/routes/analytics.js - Example Analytics Routes for Express + MongoDB

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth'); // Your auth middleware
const Emission = require('../models/Emission'); // Your Emission model
const MACCOpportunity = require('../models/MACCOpportunity'); // Create this model
const { buildEmissionMatch, resolveDateRange } = require('../utils/emissionQueryUtils');
const { materialTransportMatchFilter } = require('../utils/transportEmissionUtils');
const {
  aggregateCommuteEmissions,
  aggregateCommuteEmissionsByMonth,
  COMMUTE_ACTIVITY_LABEL
} = require('../services/commuteAnalyticsService');

const COMMUTE_PARETO_LABEL = COMMUTE_ACTIVITY_LABEL;

/**
 * Build $match from query string (supports JSON `filters` or individual fields).
 */
function emissionMatchFromRequest(req) {
  const organisationId = req.user.organisation_id;
  let filters = { organisationId, excludeRejected: true };

  if (req.query.filters) {
    try {
      const parsed =
        typeof req.query.filters === 'string'
          ? JSON.parse(req.query.filters)
          : req.query.filters;
      if (parsed && typeof parsed === 'object') {
        filters = { ...filters, ...parsed, organisationId };
      }
    } catch {
      /* ignore invalid JSON */
    }
  }

  const q = req.query;
  if (q.startDate) filters.startDate = q.startDate;
  if (q.endDate) filters.endDate = q.endDate;
  if (q.reportingMonth != null) filters.reportingMonth = q.reportingMonth;
  if (q.reportingYear != null) filters.reportingYear = q.reportingYear;
  if (q.selectedScopes != null) {
    filters.selectedScopes = Array.isArray(q.selectedScopes)
      ? q.selectedScopes
      : String(q.selectedScopes).split(',').map((s) => s.trim());
  }
  if (q.selectedFacilities != null) {
    filters.selectedFacilities = Array.isArray(q.selectedFacilities)
      ? q.selectedFacilities
      : String(q.selectedFacilities).split(',').map((s) => s.trim());
  }
  if (q.selectedDepartments != null) {
    filters.selectedDepartments = Array.isArray(q.selectedDepartments)
      ? q.selectedDepartments
      : String(q.selectedDepartments).split(',').map((s) => s.trim());
  }
  if (q.selectedSites != null) {
    filters.selectedSites = Array.isArray(q.selectedSites)
      ? q.selectedSites
      : String(q.selectedSites).split(',').map((s) => s.trim());
  }
  if (q.selectedCategories != null) {
    filters.selectedCategories = Array.isArray(q.selectedCategories)
      ? q.selectedCategories
      : String(q.selectedCategories).split(',').map((s) => s.trim());
  }

  return buildEmissionMatch(filters);
}

function analyticsFiltersFromRequest(req) {
  const organisationId = req.user.organisation_id;
  let filters = { organisationId, excludeRejected: true };

  if (req.query.filters) {
    try {
      const parsed =
        typeof req.query.filters === 'string'
          ? JSON.parse(req.query.filters)
          : req.query.filters;
      if (parsed && typeof parsed === 'object') {
        filters = { ...filters, ...parsed, organisationId };
      }
    } catch {
      /* ignore invalid JSON */
    }
  }

  const q = req.query;
  if (q.startDate) filters.startDate = q.startDate;
  if (q.endDate) filters.endDate = q.endDate;
  if (q.reportingMonth != null) filters.reportingMonth = q.reportingMonth;
  if (q.reportingYear != null) filters.reportingYear = q.reportingYear;
  if (q.selectedScopes != null) {
    filters.selectedScopes = Array.isArray(q.selectedScopes)
      ? q.selectedScopes
      : String(q.selectedScopes).split(',').map((s) => s.trim());
  }

  return filters;
}

function includesScope3(filters) {
  const raw =
    filters.selectedScopes ||
    filters.scopes ||
    (filters.scope != null ? [filters.scope] : null);
  if (raw == null) return true;
  const arr = Array.isArray(raw) ? raw : String(raw).split(',').map((s) => s.trim());
  const scopes = [...new Set(arr.map((s) => parseInt(s, 10)).filter((n) => n >= 1 && n <= 3))];
  return scopes.length === 0 || scopes.includes(3);
}

/** Normalise emission date so $year/$month work (handles Date + ISO strings); drops invalid/null dates. */
const stagesValidEmissionDate = [
  {
    $addFields: {
      __d: {
        $convert: { input: '$date', to: 'date', onError: null, onNull: null }
      }
    }
  },
  { $match: { __d: { $type: 'date' } } }
];

const sumCo2 = { $sum: { $ifNull: ['$co2e', 0] } };

/**
 * Health Check - No authentication required
 * GET /api/analytics/health
 */
router.get('/health', async (req, res) => {
  try {
    // Check if MongoDB is connected
    const mongoose = require('mongoose');
    const isConnected = mongoose.connection.readyState === 1;
    
    res.json({
      success: true,
      mongodb: isConnected,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.json({
      success: false,
      mongodb: false,
      error: error.message
    });
  }
});

/**
 * Get Overview Statistics
 * GET /api/analytics/overview
 */
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    const match = emissionMatchFromRequest(req);

    // Aggregate emissions by scope
    const stats = await Emission.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$scope',
          total: sumCo2,
          count: { $sum: 1 }
        }
      }
    ]);

    // Transform results
    const result = {
      totalEmissions: 0,
      totalEntries: 0,
      scope1: 0,
      scope2: 0,
      scope3: 0,
      scope1Count: 0,
      scope2Count: 0,
      scope3Count: 0
    };

    stats.forEach(stat => {
      const scopeKey = `scope${stat._id}`;
      const countKey = `scope${stat._id}Count`;
      result[scopeKey] = stat.total;
      result[countKey] = stat.count;
      result.totalEmissions += stat.total;
      result.totalEntries += stat.count;
    });

    result.scope3_activity_co2e = result.scope3;
    result.scope3_commute_co2e = 0;
    result.scope3_commute_present_days = 0;

    const filters = analyticsFiltersFromRequest(req);
    if (includesScope3(filters)) {
      const { startDate, endDate } = resolveDateRange(filters);
      const commute = await aggregateCommuteEmissions(
        filters.organisationId,
        startDate,
        endDate
      );
      result.scope3_commute_co2e = commute.total_co2e_kg;
      result.scope3_commute_present_days = commute.present_days;
      result.scope3 += commute.total_co2e_kg;
      result.totalEmissions += commute.total_co2e_kg;
      result.scope3Count += commute.present_days;
      result.totalEntries += commute.present_days;
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Overview stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch overview statistics'
    });
  }
});

/**
 * Get Scope Migration Analysis
 * GET /api/analytics/scope-migration
 */
router.get('/scope-migration', authenticateToken, async (req, res) => {
  try {
    const match = emissionMatchFromRequest(req);

    const periodData = await Emission.aggregate([
      { $match: match },
      ...stagesValidEmissionDate,
      {
        $group: {
          _id: {
            year: { $year: '$__d' },
            month: { $month: '$__d' },
            scope: '$scope'
          },
          emissions: sumCo2,
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Transform into period-based structure
    const periods = {};
    
    periodData.forEach(item => {
      const period = `${item._id.year}-${String(item._id.month).padStart(2, '0')}`;
      
      if (!periods[period]) {
        periods[period] = {
          period,
          scope1: 0,
          scope2: 0,
          scope3: 0,
          count1: 0,
          count2: 0,
          count3: 0,
          total: 0
        };
      }
      
      const scopeKey = `scope${item._id.scope}`;
      const countKey = `count${item._id.scope}`;
      periods[period][scopeKey] = item.emissions;
      periods[period][countKey] = item.count;
      periods[period].total += item.emissions;
    });

    const filters = analyticsFiltersFromRequest(req);
    if (includesScope3(filters)) {
      const { startDate, endDate } = resolveDateRange(filters);
      const commuteByMonth = await aggregateCommuteEmissionsByMonth(
        filters.organisationId,
        startDate,
        endDate
      );

      commuteByMonth.forEach((co2e, period) => {
        if (!periods[period]) {
          periods[period] = {
            period,
            scope1: 0,
            scope2: 0,
            scope3: 0,
            count1: 0,
            count2: 0,
            count3: 0,
            total: 0
          };
        }
        periods[period].scope3 += co2e;
        periods[period].total += co2e;
      });
    }

    res.json({
      success: true,
      data: {
        periodData: Object.values(periods)
      }
    });
  } catch (error) {
    console.error('Scope migration error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch scope migration data'
    });
  }
});

/**
 * Scope 3 material transport split (GHG Cat. 4 upstream vs Cat. 9 downstream)
 * GET /api/analytics/scope3-transport-breakdown
 */
router.get('/scope3-transport-breakdown', authenticateToken, async (req, res) => {
  try {
    const match = {
      ...emissionMatchFromRequest(req),
      ...materialTransportMatchFilter()
    };

    const rows = await Emission.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            $ifNull: ['$transport_category', 'raw_material']
          },
          total_co2e: sumCo2,
          count: { $sum: 1 }
        }
      }
    ]);

    let upstream = 0;
    let downstream = 0;
    let upstreamCount = 0;
    let downstreamCount = 0;

    rows.forEach((row) => {
      const val = row.total_co2e || 0;
      const cnt = row.count || 0;
      if (row._id === 'finished_product') {
        downstream = val;
        downstreamCount = cnt;
      } else {
        upstream += val;
        upstreamCount += cnt;
      }
    });

    const transportSubtotal = upstream + downstream;

    res.json({
      success: true,
      data: {
        category_4_upstream: {
          label: 'Category 4: Upstream Transport (Raw Material)',
          transport_category: 'raw_material',
          total_co2e: parseFloat(upstream.toFixed(4)),
          count: upstreamCount
        },
        category_9_downstream: {
          label: 'Category 9: Downstream Transport (Finished Product)',
          transport_category: 'finished_product',
          total_co2e: parseFloat(downstream.toFixed(4)),
          count: downstreamCount
        },
        transport_subtotal: {
          label: 'Transport Subtotal',
          total_co2e: parseFloat(transportSubtotal.toFixed(4)),
          count: upstreamCount + downstreamCount
        },
        chart_data: [
          {
            name: 'Upstream (Raw Material)',
            value: parseFloat(upstream.toFixed(4)),
            key: 'raw_material'
          },
          {
            name: 'Downstream (Finished Product)',
            value: parseFloat(downstream.toFixed(4)),
            key: 'finished_product'
          }
        ].filter((d) => d.value > 0)
      }
    });
  } catch (error) {
    console.error('Scope 3 transport breakdown error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Scope 3 transport breakdown'
    });
  }
});

/**
 * Get Pareto Analysis
 * GET /api/analytics/pareto
 */
router.get('/pareto', authenticateToken, async (req, res) => {
  try {
    const match = emissionMatchFromRequest(req);

    const categoryData = await Emission.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $ifNull: ['$category', 'Uncategorized'] },
          value: sumCo2,
          count: { $sum: 1 },
          scope: { $first: '$scope' }
        }
      },
      { $sort: { value: -1 } }
    ]);

    let paretoRows = categoryData.map((item) => ({
      name: item._id || 'Unknown',
      value: item.value,
      count: item.count,
      scope: item.scope
    }));

    const filters = analyticsFiltersFromRequest(req);
    if (includesScope3(filters)) {
      const { startDate, endDate } = resolveDateRange(filters);
      const commute = await aggregateCommuteEmissions(
        filters.organisationId,
        startDate,
        endDate
      );
      if (commute.total_co2e_kg > 0) {
        paretoRows.push({
          name: COMMUTE_PARETO_LABEL,
          value: commute.total_co2e_kg,
          count: commute.present_days,
          scope: 3
        });
      }
    }

    const paretoTotal = paretoRows.reduce((sum, item) => sum + (item.value || 0), 0);
    let cumulative = 0;

    if (paretoTotal <= 0) {
      return res.json({
        success: true,
        data: { paretoData: [] }
      });
    }

    paretoRows.sort((a, b) => b.value - a.value);

    const paretoData = paretoRows.map((item) => {
      const percentage = (item.value / paretoTotal) * 100;
      cumulative += percentage;

      return {
        name: item.name,
        value: item.value,
        count: item.count,
        scope: item.scope,
        percentage: parseFloat(percentage.toFixed(2)),
        cumulativePercentage: parseFloat(cumulative.toFixed(2)),
        canDrill: item.name !== COMMUTE_PARETO_LABEL
      };
    });

    res.json({
      success: true,
      data: {
        paretoData
      }
    });
  } catch (error) {
    console.error('Pareto analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Pareto analysis'
    });
  }
});

/**
 * Get Pareto Drill-Down
 * GET /api/analytics/pareto/drilldown/:category
 */
router.get('/pareto/drilldown/:category', authenticateToken, async (req, res) => {
  try {
    const { organisation_id } = req.user;
    const { category } = req.params;

    const subcategoryData = await Emission.aggregate([
      { 
        $match: { 
          organisation_id,
          category: decodeURIComponent(category)
        } 
      },
      {
        $group: {
          _id: {
            $cond: [
              { $gt: [{ $strLenCP: { $ifNull: ['$subcategory', ''] } }, 0] },
              '$subcategory',
              { $ifNull: ['$activity', 'Unspecified source'] }
            ]
          },
          value: sumCo2,
          count: { $sum: 1 },
          scope: { $first: '$scope' }
        }
      },
      { $sort: { value: -1 } }
    ]);

    const total = subcategoryData.reduce((sum, item) => sum + (item.value || 0), 0);
    let cumulative = 0;

    if (total <= 0) {
      return res.json({
        success: true,
        data: {
          category: decodeURIComponent(category),
          paretoData: []
        }
      });
    }

    const paretoData = subcategoryData.map(item => {
      const percentage = (item.value / total) * 100;
      cumulative += percentage;
      
      return {
        name: item._id || 'Unknown',
        value: item.value,
        count: item.count,
        scope: item.scope,
        percentage: parseFloat(percentage.toFixed(2)),
        cumulativePercentage: parseFloat(cumulative.toFixed(2)),
        canDrill: false
      };
    });

    res.json({
      success: true,
      data: {
        category: decodeURIComponent(category),
        paretoData
      }
    });
  } catch (error) {
    console.error('Pareto drill-down error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch drill-down data'
    });
  }
});

/**
 * Get Velocity Analysis
 * GET /api/analytics/velocity
 */
router.get('/velocity', authenticateToken, async (req, res) => {
  try {
    const { organisation_id } = req.user;

    const periodData = await Emission.aggregate([
      { $match: { organisation_id } },
      ...stagesValidEmissionDate,
      {
        $group: {
          _id: {
            year: { $year: '$__d' },
            month: { $month: '$__d' }
          },
          emissions: sumCo2
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const chartData = [];
    let prevEmissions = null;
    let prevVelocity = null;

    periodData.forEach(item => {
      const period = `${item._id.year}-${String(item._id.month).padStart(2, '0')}`;
      const emissions = item.emissions;
      
      const velocity = prevEmissions !== null ? emissions - prevEmissions : 0;
      const acceleration = prevVelocity !== null ? velocity - prevVelocity : 0;

      chartData.push({
        period,
        emissions,
        velocity,
        acceleration
      });

      prevEmissions = emissions;
      prevVelocity = velocity;
    });

    // Calculate summary
    const velocities = chartData.slice(1).map(d => d.velocity);
    const accelerations = chartData.slice(2).map(d => d.acceleration);
    
    const avgVelocity = velocities.length > 0 
      ? velocities.reduce((a, b) => a + b, 0) / velocities.length 
      : 0;
    
    const avgAcceleration = accelerations.length > 0
      ? accelerations.reduce((a, b) => a + b, 0) / accelerations.length
      : 0;

    const lastData = chartData[chartData.length - 1];
    const currentVelocity = lastData?.velocity || 0;
    const projectedNextMonth = lastData 
      ? lastData.emissions + currentVelocity 
      : 0;

    res.json({
      success: true,
      data: {
        chartData,
        summary: {
          avgVelocity: parseFloat(avgVelocity.toFixed(2)),
          avgAcceleration: parseFloat(avgAcceleration.toFixed(2)),
          trend: avgVelocity < 0 ? 'decreasing' : avgVelocity > 0 ? 'increasing' : 'stable',
          currentVelocity: parseFloat(currentVelocity.toFixed(2)),
          projectedNextMonth: parseFloat(projectedNextMonth.toFixed(2))
        }
      }
    });
  } catch (error) {
    console.error('Velocity analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch velocity analysis'
    });
  }
});

/**
 * Get MACC Analysis
 * GET /api/analytics/macc
 */
router.get('/macc', authenticateToken, async (req, res) => {
  try {
    const { organisation_id } = req.user;

    const opportunities = await MACCOpportunity.find({ organisation_id })
      .sort({ costPerTon: 1 });

    // Calculate analysis
    const analysis = {
      totalAbatementPotential: 0,
      totalCostSavings: 0,
      totalCosts: 0,
      netCost: 0,
      opportunitiesCount: opportunities.length,
      highPriorityCount: 0,
      mediumPriorityCount: 0,
      lowPriorityCount: 0
    };

    opportunities.forEach(opp => {
      analysis.totalAbatementPotential += opp.abatementPotential;
      
      if (opp.costPerTon < 0) {
        analysis.totalCostSavings += Math.abs(opp.totalCost);
      } else {
        analysis.totalCosts += opp.totalCost;
      }

      if (opp.priority === 'high') analysis.highPriorityCount++;
      else if (opp.priority === 'medium') analysis.mediumPriorityCount++;
      else analysis.lowPriorityCount++;
    });

    analysis.netCost = analysis.totalCosts - analysis.totalCostSavings;
    analysis.averageCostPerTon = analysis.totalAbatementPotential > 0
      ? analysis.netCost / analysis.totalAbatementPotential
      : 0;

    res.json({
      success: true,
      data: {
        opportunities,
        analysis
      }
    });
  } catch (error) {
    console.error('MACC analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch MACC analysis'
    });
  }
});

/**
 * Save MACC Opportunity
 * POST /api/analytics/macc/opportunity
 */
router.post('/macc/opportunity', authenticateToken, async (req, res) => {
  try {
    const { organisation_id } = req.user;
    const opportunityData = {
      ...req.body,
      organisation_id
    };

    const opportunity = new MACCOpportunity(opportunityData);
    await opportunity.save();

    res.status(201).json({
      success: true,
      data: opportunity,
      message: 'MACC opportunity created successfully'
    });
  } catch (error) {
    console.error('Save MACC opportunity error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save MACC opportunity'
    });
  }
});

/**
 * Delete MACC Opportunity
 * DELETE /api/analytics/macc/opportunity/:id
 */
router.delete('/macc/opportunity/:id', authenticateToken, async (req, res) => {
  try {
    const { organisation_id } = req.user;
    const { id } = req.params;

    const opportunity = await MACCOpportunity.findOneAndDelete({
      _id: id,
      organisation_id
    });

    if (!opportunity) {
      return res.status(404).json({
        success: false,
        error: 'MACC opportunity not found'
      });
    }

    res.json({
      success: true,
      message: 'MACC opportunity deleted successfully'
    });
  } catch (error) {
    console.error('Delete MACC opportunity error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete MACC opportunity'
    });
  }
});

module.exports = router;