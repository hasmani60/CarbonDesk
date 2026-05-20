const Emission = require('../models/Emission');
const analysisService = require('./analysisService');
const advancedAnalyticsService = require('./advancedAnalyticsService');
const {
  buildEmissionMatch,
  additionalMatchFromBuilt,
  resolveDateRange
} = require('../utils/emissionQueryUtils');
const {
  aggregateCommuteEmissions,
  aggregateCommuteEmissionsByMonth,
  includesScope3InFilters,
  mergeCommuteIntoMonthlyTrend
} = require('./commuteAnalyticsService');

const sumCo2 = { $sum: { $ifNull: ['$co2e', 0] } };

function round2(n) {
  return parseFloat((n || 0).toFixed(2));
}

const AI_MONTHLY_CAP = 6;
const AI_LIST_CAP = 8;

/**
 * Compact payload for LLM prompts — avoids OpenRouter 429s from oversized JSON.stringify.
 * Charts are rendered client-side; the model only needs summaries per scope.
 */
function buildAiReportContext(prepared) {
  if (!prepared) return null;

  const { organisation, filters, summary, scopeSections, topSources, trends, reductions, dataQuality } =
    prepared;

  const scopeBreakdown = [1, 2, 3].map((n) => {
    const s = scopeSections?.[`scope${n}`] || {};
    return {
      scope: n,
      totalCo2eKg: s.totalCo2eKg ?? summary?.[`scope${n}`],
      entryCount: s.entryCount ?? summary?.[`scope${n}Count`],
      sharePercent: s.sharePercent,
      topHotspots: (s.topHotspots || []).slice(0, 5)
    };
  });

  const monthly = Array.isArray(trends?.monthly) ? trends.monthly : [];
  const recentMonthly = monthly.slice(-AI_MONTHLY_CAP).map((row) => ({
    period: row.date ?? row.period ?? row.yearMonth,
    co2eKg: round2(row.emissions ?? row.co2e ?? row.total_co2e ?? row.total)
  }));

  const velocity = trends?.velocity;
  const velocityBrief =
    velocity && typeof velocity === 'object'
      ? {
          mom: velocity.mom ?? velocity.monthOverMonth,
          yoy: velocity.yoy ?? velocity.yearOverYear,
          trend: velocity.trend ?? velocity.direction
        }
      : null;

  return {
    organisation,
    reportingPeriod: {
      startDate: filters?.resolvedStartDate,
      endDate: filters?.resolvedEndDate,
      selectedScopes: filters?.selectedScopes
    },
    summary: {
      totalCo2eKg: summary?.totalCo2eKg,
      entryCount: summary?.entryCount,
      verifiedPercent: summary?.verifiedPercent,
      scope1: summary?.scope1,
      scope2: summary?.scope2,
      scope3: summary?.scope3
    },
    scopeBreakdown,
    recentMonthlyEmissions: recentMonthly,
    topCategories: (topSources?.categories || []).slice(0, AI_LIST_CAP),
    topLocations: (topSources?.locations || []).slice(0, 5),
    paretoHotspots: (topSources?.paretoHotspots || []).slice(0, AI_LIST_CAP),
    emissionsVelocity: velocityBrief,
    reductionTrajectory: reductions?.trajectoryMetrics || null,
    dataQualitySummary: (dataQuality?.byStatus || []).slice(0, 6),
    reportStructure: {
      sections: ['Overview', 'Scope 1', 'Scope 2', 'Scope 3', 'Recommendations'],
      note: 'Scope charts are attached in the report UI; write one subsection per scope using scopeBreakdown figures.'
    }
  };
}

/**
 * Normalize API request body into filter object for buildEmissionMatch.
 */
function normalizeReportFilters(body = {}, organisationId) {
  const { startDate, endDate } = resolveDateRange(body);
  return {
    organisationId,
    startDate: startDate ? startDate.toISOString() : body.startDate,
    endDate: endDate ? endDate.toISOString() : body.endDate,
    reportingMonth: body.reportingMonth,
    reportingYear: body.reportingYear,
    selectedScopes: body.selectedScopes,
    selectedFacilities: body.selectedFacilities,
    selectedDepartments: body.selectedDepartments,
    selectedSites: body.selectedSites,
    selectedCategories: body.selectedCategories,
    additionalFilters: body.additionalFilters,
    scope: body.scope,
    category: body.category
  };
}

class ReportDataService {
  /**
   * Distinct filter dimensions present in org emissions (dynamic UI).
   */
  async getFilterOptions(organisationId) {
    const base = { organisation_id: organisationId };
    const [locations, departments, sites, categories, statuses, scopes, dateBounds] =
      await Promise.all([
        Emission.distinct('location', { ...base, location: { $nin: [null, ''] } }),
        Emission.distinct('department', { ...base, department: { $nin: [null, ''] } }),
        Emission.distinct('site', { ...base, site: { $nin: [null, ''] } }),
        Emission.distinct('category', { ...base, category: { $nin: [null, ''] } }),
        Emission.distinct('status', base),
        Emission.distinct('scope', base),
        Emission.aggregate([
          { $match: base },
          {
            $group: {
              _id: null,
              minDate: { $min: '$date' },
              maxDate: { $max: '$date' }
            }
          }
        ])
      ]);

    return {
      locations: locations.sort(),
      facilities: locations.sort(),
      departments: departments.sort(),
      sites: sites.sort(),
      categories: categories.sort(),
      statuses: statuses.sort(),
      scopes: scopes.filter((s) => s >= 1 && s <= 3).sort(),
      dateRange: dateBounds[0]
        ? {
            minDate: dateBounds[0].minDate,
            maxDate: dateBounds[0].maxDate
          }
        : null
    };
  }

  /**
   * AI-ready summary JSON — aggregates stored co2e only (no factor recalculation).
   */
  async prepareReportData(body, organisationId, organisationMeta = {}) {
    const filters = normalizeReportFilters(body, organisationId);
    const match = buildEmissionMatch(filters);
    const additionalMatch = additionalMatchFromBuilt(match);

    const { startDate, endDate } = resolveDateRange(filters);
    if (!startDate || !endDate) {
      const err = new Error('A valid date range is required (startDate/endDate or reportingMonth/reportingYear)');
      err.statusCode = 400;
      throw err;
    }

    const startIso = startDate.toISOString();
    const endIso = endDate.toISOString();

    const analysisFilters = {
      startDate: startIso,
      endDate: endIso,
      organisationId,
      ...filters,
      scope: filters.selectedScopes?.length === 1 ? filters.selectedScopes[0] : undefined,
      category: filters.selectedCategories?.length === 1 ? filters.selectedCategories[0] : undefined
    };

    const [
      scopeStats,
      totalStats,
      statusStats,
      categoryStats,
      locationStats,
      velocity,
      paretoResult,
      scopeMigrationResult
    ] = await Promise.all([
      Emission.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$scope',
            count: { $sum: 1 },
            total_co2e: sumCo2
          }
        },
        { $sort: { _id: 1 } }
      ]),
      Emission.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            entryCount: { $sum: 1 },
            total_co2e: sumCo2,
            verified_count: {
              $sum: { $cond: [{ $eq: ['$status', 'verified'] }, 1, 0] }
            }
          }
        }
      ]),
      Emission.aggregate([
        { $match: match },
        { $group: { _id: '$status', count: { $sum: 1 }, total_co2e: sumCo2 } }
      ]),
      Emission.aggregate([
        { $match: match },
        { $group: { _id: '$category', count: { $sum: 1 }, total_co2e: sumCo2 } },
        { $sort: { total_co2e: -1 } },
        { $limit: 15 }
      ]),
      Emission.aggregate([
        { $match: { ...match, location: { $nin: [null, ''] } } },
        { $group: { _id: '$location', count: { $sum: 1 }, total_co2e: sumCo2 } },
        { $sort: { total_co2e: -1 } },
        { $limit: 15 }
      ]),
      advancedAnalyticsService.calculateEmissionsVelocity({
        startDate: startIso,
        endDate: endIso,
        organisationId,
        additionalMatch
      }),
      analysisService.calculateHotspotPareto({
        ...analysisFilters,
        drillDownLevel: 'activity'
      }),
      analysisService.calculateScopeMigration({
        ...analysisFilters,
        department: filters.selectedDepartments?.[0],
        site: filters.selectedSites?.[0],
        timeInterval: 'month'
      })
    ]);

    const totals = totalStats[0] || { entryCount: 0, total_co2e: 0, verified_count: 0 };
    let totalCo2e = totals.total_co2e || 0;

    const byScope = { scope1: 0, scope2: 0, scope3: 0, scope1Count: 0, scope2Count: 0, scope3Count: 0 };
    scopeStats.forEach((s) => {
      const key = `scope${s._id}`;
      const countKey = `scope${s._id}Count`;
      if (byScope[key] !== undefined) {
        byScope[key] = round2(s.total_co2e);
        byScope[countKey] = s.count;
      }
    });

    let scope3CommuteCo2e = 0;
    let scope3CommutePresentDays = 0;
    if (includesScope3InFilters(filters)) {
      const commute = await aggregateCommuteEmissions(
        organisationId,
        startDate,
        endDate
      );
      scope3CommuteCo2e = commute.total_co2e_kg;
      scope3CommutePresentDays = commute.present_days;
      byScope.scope3 = round2(byScope.scope3 + scope3CommuteCo2e);
      byScope.scope3Count += scope3CommutePresentDays;
      byScope.scope3_activity_co2e = round2(byScope.scope3 - scope3CommuteCo2e);
      byScope.scope3_commute_co2e = round2(scope3CommuteCo2e);
      byScope.scope3_commute_present_days = scope3CommutePresentDays;
      totalCo2e += scope3CommuteCo2e;
    }

    let monthlyTrend = await advancedAnalyticsService.getHistoricalEmissions(
      startIso,
      endIso,
      organisationId,
      additionalMatch
    );

    if (includesScope3InFilters(filters)) {
      const commuteByMonth = await aggregateCommuteEmissionsByMonth(
        organisationId,
        startDate,
        endDate
      );
      monthlyTrend = mergeCommuteIntoMonthlyTrend(monthlyTrend, commuteByMonth);
    }

    let trajectory = null;
    try {
      trajectory = await advancedAnalyticsService.calculateEmissionsTrajectory({
        startDate: startIso,
        endDate: endIso,
        organisationId,
        targetScenario: '1.5C'
      });
    } catch {
      trajectory = null;
    }

    const topCategories = categoryStats.map((c) => ({
      category: c._id || 'Uncategorized',
      co2eKg: round2(c.total_co2e),
      count: c.count,
      sharePercent: totalCo2e > 0 ? round2((c.total_co2e / totalCo2e) * 100) : 0
    }));

    const topLocations = locationStats.map((l) => ({
      location: l._id,
      co2eKg: round2(l.total_co2e),
      count: l.count,
      sharePercent: totalCo2e > 0 ? round2((l.total_co2e / totalCo2e) * 100) : 0
    }));

    const paretoHotspots = paretoResult?.data?.hotspots?.top80Percent?.slice(0, 10)?.map((h) => ({
      name: h.name,
      scope: h.scope,
      co2eKg: h.emissions,
      cumulativePercent: h.cumulativePercent
    })) || [];

    const buildScopeSection = (scopeNum) => ({
      scope: scopeNum,
      totalCo2eKg: byScope[`scope${scopeNum}`],
      entryCount: byScope[`scope${scopeNum}Count`],
      sharePercent:
        totalCo2e > 0 ? round2((byScope[`scope${scopeNum}`] / totalCo2e) * 100) : 0,
      topHotspots: paretoHotspots.filter((h) => h.scope === scopeNum).slice(0, 5)
    });

    const scopeSections = {
      scope1: buildScopeSection(1),
      scope2: buildScopeSection(2),
      scope3: buildScopeSection(3)
    };

    return {
      organisation: {
        id: organisationId,
        name: organisationMeta.name || organisationMeta.display_name,
        industry: organisationMeta.industry_type,
        reportingPeriod: organisationMeta.default_reporting_period
      },
      filters: {
        ...filters,
        resolvedStartDate: startIso,
        resolvedEndDate: endIso
      },
      units: { emissions: 'kg CO2e' },
      summary: {
        totalCo2eKg: round2(totalCo2e),
        entryCount: totals.entryCount,
        verifiedCount: totals.verified_count,
        verifiedPercent:
          totals.entryCount > 0
            ? round2((totals.verified_count / totals.entryCount) * 100)
            : 0,
        ...byScope
      },
      trends: {
        monthly: monthlyTrend,
        velocity: velocity?.velocity || velocity,
        scopeMigration: scopeMigrationResult?.data?.metrics || null
      },
      topSources: {
        categories: topCategories,
        locations: topLocations,
        paretoHotspots
      },
      scopeSections,
      reductions: {
        trajectoryMetrics: trajectory?.metrics || null,
        trajectoryBaseline: trajectory?.baseline || null
      },
      dataQuality: {
        byStatus: statusStats.map((s) => ({
          status: s._id,
          count: s.count,
          co2eKg: round2(s.total_co2e)
        })),
        rejectedExcluded: true
      },
      generatedAt: new Date().toISOString()
    };
  }
}

module.exports = new ReportDataService();
module.exports.buildAiReportContext = buildAiReportContext;
