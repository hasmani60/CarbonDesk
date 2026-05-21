/**
 * Extended analytics chart payloads for bootstrap (charts 1–11).
 */
const Emission = require('../models/Emission');
const ProductionRecord = require('../models/ProductionRecord');
const advancedAnalyticsService = require('./advancedAnalyticsService');
const { getNetEmissionsSummary } = require('./offsetService');
const { resolveDateRange } = require('../utils/emissionQueryUtils');
const { materialTransportMatchFilter } = require('../utils/transportEmissionUtils');
const { COMMUTE_ACTIVITY_LABEL } = require('./commuteAnalyticsService');

const sumCo2 = { $sum: { $ifNull: ['$co2e', 0] } };

function deriveDateRangeFromPeriods(periods, filters) {
  const resolved = resolveDateRange(filters);
  if (resolved.startDate && resolved.endDate) {
    return {
      startDate: resolved.startDate.toISOString().slice(0, 10),
      endDate: resolved.endDate.toISOString().slice(0, 10)
    };
  }
  if (!periods?.length) {
    const end = new Date();
    const start = new Date();
    start.setFullYear(start.getFullYear() - 2);
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10)
    };
  }
  const sorted = [...periods].sort((a, b) => a.period.localeCompare(b.period));
  const [y0, m0] = sorted[0].period.split('-').map(Number);
  const [y1, m1] = sorted[sorted.length - 1].period.split('-').map(Number);
  const startDate = new Date(Date.UTC(y0, m0 - 1, 1));
  const endDate = new Date(Date.UTC(y1, m1, 0, 23, 59, 59, 999));
  return {
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10)
  };
}

function buildIntensitySeries(periods, productionByMonth) {
  const prodMap = new Map(
    (productionByMonth || []).map((r) => [r.period, r.quantity])
  );
  return (periods || []).map((p) => {
    const production = prodMap.get(p.period) || 0;
    const emissions = p.total || 0;
    const intensity = production > 0 ? emissions / production : null;
    return {
      period: p.period,
      emissions: parseFloat(emissions.toFixed(2)),
      production: parseFloat(production.toFixed(2)),
      intensity: intensity != null ? parseFloat(intensity.toFixed(4)) : null
    };
  });
}

function buildYoYComparison(periods) {
  if (!periods?.length) return { chartData: [], hasData: false };

  const byKey = {};
  periods.forEach((p) => {
    const [year, month] = p.period.split('-');
    const key = month;
    if (!byKey[key]) byKey[key] = {};
    byKey[key][year] = p.total || 0;
  });

  const years = [
    ...new Set(periods.map((p) => p.period.split('-')[0]))
  ].sort();
  if (years.length < 2) return { chartData: [], hasData: false };

  const currentYear = years[years.length - 1];
  const priorYear = years[years.length - 2];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const chartData = Object.keys(byKey)
    .sort((a, b) => Number(a) - Number(b))
    .map((month) => {
      const idx = Number(month) - 1;
      return {
        period: monthNames[idx] || month,
        monthKey: month,
        current: byKey[month][currentYear] ?? 0,
        previous: byKey[month][priorYear] ?? 0,
        currentYear,
        previousYear: priorYear
      };
    })
    .filter((row) => row.current > 0 || row.previous > 0);

  return {
    chartData,
    hasData: chartData.length > 0,
    currentYear,
    previousYear: priorYear
  };
}

function buildWaterfall(periods) {
  if (!periods || periods.length < 2) {
    return { steps: [], hasData: false };
  }
  const sorted = [...periods].sort((a, b) => a.period.localeCompare(b.period));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const d1 = (last.scope1 || 0) - (first.scope1 || 0);
  const d2 = (last.scope2 || 0) - (first.scope2 || 0);
  const d3 = (last.scope3 || 0) - (first.scope3 || 0);

  return {
    hasData: true,
    periodStart: first.period,
    periodEnd: last.period,
    steps: [
      { name: `Start (${first.period})`, value: first.total || 0, type: 'total' },
      { name: 'Scope 1 change', value: d1, type: 'delta' },
      { name: 'Scope 2 change', value: d2, type: 'delta' },
      { name: 'Scope 3 change', value: d3, type: 'delta' },
      { name: `End (${last.period})`, value: last.total || 0, type: 'total' }
    ]
  };
}

function buildScope3Split(overview, commute) {
  const activity = overview?.scope3_activity_co2e ?? 0;
  const commuteCo2 = commute?.total_co2e_kg ?? overview?.scope3_commute_co2e ?? 0;
  const chartData = [
    { name: 'Activity-based Scope 3', value: parseFloat(activity.toFixed(2)), key: 'activity' },
    { name: COMMUTE_ACTIVITY_LABEL, value: parseFloat(commuteCo2.toFixed(2)), key: 'commute' }
  ].filter((d) => d.value > 0);

  return {
    chartData,
    hasData: chartData.length > 0,
    activity_co2e: activity,
    commute_co2e: commuteCo2
  };
}

async function aggregateProductionByMonth(organisationId, periods) {
  if (!periods?.length) return [];
  const months = periods.map((p) => p.period);
  const rows = await ProductionRecord.aggregate([
    {
      $match: {
        organisation_id: organisationId,
        period_month: { $in: months }
      }
    },
    {
      $group: {
        _id: '$period_month',
        quantity: { $sum: '$quantity' },
        productCount: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  return rows.map((r) => ({
    period: r._id,
    quantity: r.quantity,
    productCount: r.productCount
  }));
}

async function aggregateActivityBreakdown(match, limit = 15) {
  const rows = await Emission.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $ifNull: ['$activity', 'Unspecified'] },
        value: sumCo2,
        count: { $sum: 1 },
        scope: { $first: '$scope' }
      }
    },
    { $sort: { value: -1 } },
    { $limit: limit }
  ]);
  return rows.map((r) => ({
    name: r._id,
    value: parseFloat((r.value || 0).toFixed(2)),
    count: r.count,
    scope: r.scope
  }));
}

async function aggregateByLocation(match, limit = 12) {
  const rows = await Emission.aggregate([
    {
      $match: {
        ...match,
        location: { $exists: true, $nin: [null, ''] }
      }
    },
    {
      $group: {
        _id: '$location',
        value: sumCo2,
        count: { $sum: 1 }
      }
    },
    { $sort: { value: -1 } },
    { $limit: limit }
  ]);
  return rows.map((r) => ({
    name: r._id,
    value: parseFloat((r.value || 0).toFixed(2)),
    count: r.count
  }));
}

async function aggregateByStatus(match) {
  const rows = await Emission.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $ifNull: ['$status', 'draft'] },
        value: sumCo2,
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);
  const total = rows.reduce((s, r) => s + (r.count || 0), 0);
  return {
    chartData: rows.map((r) => ({
      name: String(r._id).replace(/_/g, ' '),
      status: r._id,
      value: parseFloat((r.value || 0).toFixed(2)),
      count: r.count,
      share: total > 0 ? parseFloat(((r.count / total) * 100).toFixed(1)) : 0
    })),
    totalEntries: total,
    hasData: total > 0
  };
}

async function aggregateScope3Transport(match) {
  const transportMatch = { ...match, ...materialTransportMatchFilter() };
  const rows = await Emission.aggregate([
    { $match: transportMatch },
    {
      $group: {
        _id: { $ifNull: ['$transport_category', 'raw_material'] },
        value: sumCo2,
        count: { $sum: 1 }
      }
    }
  ]);

  let upstream = 0;
  let downstream = 0;
  rows.forEach((row) => {
    const val = row.value || 0;
    if (row._id === 'finished_product') downstream = val;
    else upstream += val;
  });

  const chartData = [
    { name: 'Upstream (raw material)', value: parseFloat(upstream.toFixed(2)), key: 'raw_material' },
    { name: 'Downstream (finished product)', value: parseFloat(downstream.toFixed(2)), key: 'finished_product' }
  ].filter((d) => d.value > 0);

  return { chartData, hasData: chartData.length > 0 };
}

async function loadTrajectory(organisationId, filters, periods) {
  try {
    const { startDate, endDate } = deriveDateRangeFromPeriods(periods, filters);
    const result = await advancedAnalyticsService.calculateEmissionsTrajectory({
      startDate,
      endDate,
      organisationId,
      targetScenario: '1.5C'
    });
    return {
      historical: result.historical || [],
      targets: result.targets || { '1.5C': [], '2C': [] },
      metrics: result.metrics || null,
      baseline: result.baseline || null,
      hasData: (result.historical || []).length > 0
    };
  } catch (err) {
    console.error('Trajectory load error:', err.message);
    return { historical: [], targets: { '1.5C': [], '2C': [] }, metrics: null, hasData: false };
  }
}

async function loadGrossNet(organisationId, filters) {
  const year =
    filters.reportingYear != null && filters.reportingYear !== ''
      ? parseInt(filters.reportingYear, 10)
      : new Date().getFullYear();
  try {
    const summary = await getNetEmissionsSummary(organisationId, year);
    return {
      ...summary,
      reporting_year: year,
      hasData: (summary.gross_emissions || 0) > 0 || (summary.total_offsets_applied || 0) > 0,
      chartData: [
        { name: 'Gross emissions', value: summary.gross_emissions || 0, key: 'gross' },
        { name: 'Offsets applied', value: summary.total_offsets_applied || 0, key: 'offsets' },
        { name: 'Net emissions', value: summary.net_emissions || 0, key: 'net' }
      ]
    };
  } catch (err) {
    console.error('Gross/net load error:', err.message);
    return { hasData: false, chartData: [], reporting_year: year };
  }
}

/**
 * @param {object} match - emission filter
 * @param {object} filters - org + date filters
 * @param {object} ctx - { periods, overview, commute, includeScope3 }
 */
async function buildExtendedCharts(match, filters, ctx) {
  const organisationId = filters.organisationId;
  const periods = ctx.periods || [];
  const includeScope3 = ctx.includeScope3 !== false;

  const [
    productionByMonth,
    activityBreakdown,
    byLocation,
    byStatus,
    scope3Transport,
    trajectory,
    grossNet
  ] = await Promise.all([
    aggregateProductionByMonth(organisationId, periods),
    aggregateActivityBreakdown(match),
    aggregateByLocation(match),
    aggregateByStatus(match),
    includeScope3 ? aggregateScope3Transport(match) : Promise.resolve({ chartData: [], hasData: false }),
    loadTrajectory(organisationId, filters, periods),
    loadGrossNet(organisationId, filters)
  ]);

  const intensity = {
    series: buildIntensitySeries(periods, productionByMonth),
    productionByMonth,
    hasData: productionByMonth.some((p) => p.quantity > 0) && periods.some((p) => p.total > 0),
    unitNote: 'Intensity = total CO₂e ÷ summed production quantity (all products/units combined).'
  };

  return {
    stackedScopeTrend: { periods, hasData: periods.length > 0 },
    intensity,
    trajectory,
    activityBreakdown: {
      chartData: activityBreakdown,
      hasData: activityBreakdown.length > 0
    },
    scope3Transport,
    scope3Split: includeScope3
      ? buildScope3Split(ctx.overview, ctx.commute)
      : { chartData: [], hasData: false },
    byLocation: {
      chartData: byLocation,
      hasData: byLocation.length > 0
    },
    byStatus,
    yoy: buildYoYComparison(periods),
    waterfall: buildWaterfall(periods),
    grossNet
  };
}

module.exports = {
  buildExtendedCharts,
  buildIntensitySeries,
  buildYoYComparison,
  buildWaterfall,
  buildScope3Split
};
