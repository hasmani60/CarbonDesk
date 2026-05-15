const Emission = require('../models/Emission');
const analysisService = require('./analysisService');
const advancedAnalyticsService = require('./advancedAnalyticsService');
const {
  buildEmissionMatch,
  additionalMatchFromBuilt,
  resolveDateRange
} = require('../utils/emissionQueryUtils');

const sumCo2 = { $sum: { $ifNull: ['$co2e', 0] } };

function round2(n) {
  return parseFloat((n || 0).toFixed(2));
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
    const totalCo2e = totals.total_co2e || 0;

    const byScope = { scope1: 0, scope2: 0, scope3: 0, scope1Count: 0, scope2Count: 0, scope3Count: 0 };
    scopeStats.forEach((s) => {
      const key = `scope${s._id}`;
      const countKey = `scope${s._id}Count`;
      if (byScope[key] !== undefined) {
        byScope[key] = round2(s.total_co2e);
        byScope[countKey] = s.count;
      }
    });

    const monthlyTrend = await advancedAnalyticsService.getHistoricalEmissions(
      startIso,
      endIso,
      organisationId,
      additionalMatch
    );

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
