/**
 * Single-request analytics bootstrap — one commute pass, parallel emission aggregations.
 */
const Emission = require('../models/Emission');
const { resolveDateRange } = require('../utils/emissionQueryUtils');
const {
  aggregateCommuteEmissions,
  aggregateCommuteEmissionsByMonth,
  COMMUTE_ACTIVITY_LABEL,
  runWithCommuteFactorCache
} = require('./commuteAnalyticsService');
const { buildExtendedCharts } = require('./analyticsChartsService');

const sumCo2 = { $sum: { $ifNull: ['$co2e', 0] } };

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

function buildOverviewFromScopeStats(stats, commute) {
  const result = {
    totalEmissions: 0,
    totalEntries: 0,
    scope1: 0,
    scope2: 0,
    scope3: 0,
    scope1Count: 0,
    scope2Count: 0,
    scope3Count: 0,
    scope3_activity_co2e: 0,
    scope3_commute_co2e: 0,
    scope3_commute_present_days: 0
  };

  stats.forEach((stat) => {
    const scopeKey = `scope${stat._id}`;
    const countKey = `scope${stat._id}Count`;
    result[scopeKey] = stat.total;
    result[countKey] = stat.count;
    result.totalEmissions += stat.total;
    result.totalEntries += stat.count;
  });

  result.scope3_activity_co2e = result.scope3;
  if (commute?.total_co2e_kg > 0) {
    result.scope3_commute_co2e = commute.total_co2e_kg;
    result.scope3_commute_present_days = commute.present_days;
    result.scope3 += commute.total_co2e_kg;
    result.totalEmissions += commute.total_co2e_kg;
    result.scope3Count += commute.present_days;
    result.totalEntries += commute.present_days;
  }

  return result;
}

function buildScopeMigrationPeriods(periodData, commuteByMonth) {
  const periods = {};

  periodData.forEach((item) => {
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

  if (commuteByMonth?.size) {
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

  return Object.values(periods);
}

function buildParetoData(categoryData, commute) {
  let paretoRows = categoryData.map((item) => ({
    name: item._id || 'Unknown',
    value: item.value,
    count: item.count,
    scope: item.scope
  }));

  if (commute?.total_co2e_kg > 0) {
    paretoRows.push({
      name: COMMUTE_ACTIVITY_LABEL,
      value: commute.total_co2e_kg,
      count: commute.present_days,
      scope: 3
    });
  }

  const paretoTotal = paretoRows.reduce((sum, item) => sum + (item.value || 0), 0);
  if (paretoTotal <= 0) return [];

  paretoRows.sort((a, b) => b.value - a.value);

  let cumulative = 0;
  return paretoRows.map((item) => {
    const percentage = (item.value / paretoTotal) * 100;
    cumulative += percentage;
    return {
      name: item.name,
      value: item.value,
      count: item.count,
      scope: item.scope,
      percentage: parseFloat(percentage.toFixed(2)),
      cumulativePercentage: parseFloat(cumulative.toFixed(2)),
      canDrill: item.name !== COMMUTE_ACTIVITY_LABEL
    };
  });
}

async function loadCommuteBundle(organisationId, filters) {
  const { startDate, endDate } = resolveDateRange(filters);
  return runWithCommuteFactorCache(async () => {
    const [total, byMonth] = await Promise.all([
      aggregateCommuteEmissions(organisationId, startDate, endDate),
      aggregateCommuteEmissionsByMonth(organisationId, startDate, endDate)
    ]);
    return { total, byMonth };
  });
}

/**
 * @param {object} match - emission $match from buildEmissionMatch
 * @param {object} filters - analytics filters (organisationId, dates, scopes)
 * @param {boolean} includeCommute
 */
async function buildAnalyticsBootstrap(match, filters, includeCommute) {
  const organisationId = filters.organisationId;

  const commutePromise = includeCommute
    ? loadCommuteBundle(organisationId, filters)
    : Promise.resolve({ total: null, byMonth: new Map() });

  const [scopeStats, periodData, categoryData, commuteBundle] = await Promise.all([
    Emission.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$scope',
          total: sumCo2,
          count: { $sum: 1 }
        }
      }
    ]),
    Emission.aggregate([
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
    ]),
    Emission.aggregate([
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
    ]),
    commutePromise
  ]);

  const commute = commuteBundle.total;
  const commuteByMonth = commuteBundle.byMonth;
  const overview = buildOverviewFromScopeStats(scopeStats, commute);
  const periods = buildScopeMigrationPeriods(periodData, commuteByMonth);

  const extended = await buildExtendedCharts(match, filters, {
    periods,
    overview,
    commute,
    includeScope3
  });

  return {
    overview,
    scopeMigration: { periodData: periods },
    pareto: { paretoData: buildParetoData(categoryData, commute) },
    extended
  };
}

module.exports = {
  buildAnalyticsBootstrap
};
