// backend/services/analysisService.js
// Advanced analytics — MongoDB (Emission collection). SQLite/localDB removed for production parity.

const Emission = require('../models/Emission');
const { buildEmissionMatch, resolveDateRange } = require('../utils/emissionQueryUtils');
const {
  aggregateCommuteEmissions,
  aggregateCommuteEmissionsByMonth,
  includesScope3InFilters,
  mergeCommuteIntoScopePeriods,
  COMMUTE_ACTIVITY_LABEL
} = require('./commuteAnalyticsService');

/** Period label helpers for aggregation */
function periodExpression(interval) {
  if (interval === 'year') {
    return { $dateToString: { format: '%Y', date: '$date', timezone: 'UTC' } };
  }
  if (interval === 'quarter') {
    return {
      $concat: [
        { $toString: { $year: '$date' } },
        '-Q',
        {
          $toString: {
            $ceil: { $divide: [{ $month: '$date' }, 3] }
          }
        }
      ]
    };
  }
  return { $dateToString: { format: '%Y-%m', date: '$date', timezone: 'UTC' } };
}

class AnalysisService {
  /**
   * Calculate Scope Migration Analysis
   */
  async calculateScopeMigration(filters = {}) {
    const {
      startDate,
      endDate,
      organisationId,
      department,
      site,
      asset,
      timeInterval = 'month'
    } = filters;

    try {
      if (!organisationId) {
        throw new Error('organisationId is required for scope migration analysis');
      }

      const match = buildEmissionMatch({
        startDate,
        endDate,
        organisationId,
        department,
        site,
        asset
      });

      const periodField = periodExpression(timeInterval);

      const pipeline = [
        { $match: match },
        {
          $project: {
            scope: 1,
            co2e: { $ifNull: ['$co2e', 0] },
            period: periodField,
            date: 1
          }
        },
        { $match: { period: { $ne: null } } },
        {
          $group: {
            _id: { period: '$period', scope: '$scope' },
            total_co2e: { $sum: '$co2e' },
            count: { $sum: 1 },
            avg_co2e: { $avg: '$co2e' }
          }
        },
        { $sort: { '_id.period': 1, '_id.scope': 1 } }
      ];

      const rows = await Emission.aggregate(pipeline).allowDiskUse(true);
      const timeSeriesData = rows.map((r) => ({
        period: r._id.period,
        scope: r._id.scope,
        total_co2e: r.total_co2e,
        count: r.count,
        avg_co2e: r.avg_co2e
      }));

      let scopeTotals = this._calculateScopeTotals(timeSeriesData);

      if (includesScope3InFilters(filters)) {
        const { startDate, endDate } = resolveDateRange(filters);
        const commuteByMonth = await aggregateCommuteEmissionsByMonth(
          organisationId,
          startDate,
          endDate
        );
        scopeTotals = mergeCommuteIntoScopePeriods(scopeTotals, commuteByMonth);
      }

      const burdenShifts = this._detectBurdenShifting(scopeTotals);
      const sankeyData = this._generateSankeyData(scopeTotals, burdenShifts);
      const metrics = this._calculateMigrationMetrics(scopeTotals, burdenShifts);

      return {
        success: true,
        data: {
          sankey: sankeyData,
          timeSeries: scopeTotals,
          burdenShifts,
          metrics,
          filters
        }
      };
    } catch (error) {
      console.error('Scope migration analysis error:', error);
      throw error;
    }
  }

  /**
   * Calculate Hotspot Pareto Analysis
   */
  async calculateHotspotPareto(filters = {}) {
    const {
      startDate,
      endDate,
      organisationId,
      scope,
      category,
      drillDownLevel = 'activity'
    } = filters;

    try {
      if (!organisationId) {
        throw new Error('organisationId is required for hotspot analysis');
      }

      const match = buildEmissionMatch({
        startDate,
        endDate,
        organisationId,
        scope,
        category
      });

      const aggregatedData = await this._getHierarchicalAggregationMongo(match, drillDownLevel);

      const scopeNum = scope != null ? parseInt(scope, 10) : null;
      const includeCommute =
        drillDownLevel === 'activity' && (!scopeNum || scopeNum === 3) && includesScope3InFilters(filters);

      if (includeCommute) {
        const { startDate: rangeStart, endDate: rangeEnd } = resolveDateRange(filters);
        const commute = await aggregateCommuteEmissions(
          organisationId,
          rangeStart,
          rangeEnd
        );
        if (commute.total_co2e_kg > 0) {
          aggregatedData.push({
            name: COMMUTE_ACTIVITY_LABEL,
            scope: 3,
            category: 'Employee Commuting',
            activity: COMMUTE_ACTIVITY_LABEL,
            total_co2e: commute.total_co2e_kg,
            count: commute.present_days,
            avg_co2e: commute.present_days
              ? commute.total_co2e_kg / commute.present_days
              : 0,
            earliest_date: rangeStart,
            latest_date: rangeEnd
          });
        }
      }

      const paretoData = this._calculatePareto(aggregatedData);
      const hotspots = this._identifyHotspots(paretoData);
      const concentrationMetrics = this._calculateConcentrationRisk(paretoData);
      const drillDown = await this._generateDrillDownHierarchyMongo(match, hotspots);

      return {
        success: true,
        data: {
          pareto: paretoData,
          hotspots,
          concentration: concentrationMetrics,
          drillDown,
          filters
        }
      };
    } catch (error) {
      console.error('Hotspot pareto analysis error:', error);
      throw error;
    }
  }

  async _getHierarchicalAggregationMongo(match, level) {
    const safeMatch = match;

    let groupId;
    switch (level) {
      case 'scope':
        groupId = { scope: '$scope' };
        break;
      case 'category':
        groupId = { scope: '$scope', category: { $ifNull: ['$category', 'Uncategorized'] } };
        break;
      case 'asset':
        groupId = {
          scope: '$scope',
          category: { $ifNull: ['$category', ''] },
          activity: { $ifNull: ['$activity', ''] },
          assetKey: {
            $ifNull: [{ $trim: { input: '$notes' } }, { $concat: ['asset-', { $toString: '$_id' }] }]
          }
        };
        break;
      default:
        groupId = {
          scope: '$scope',
          category: { $ifNull: ['$category', 'Uncategorized'] },
          activity: { $ifNull: ['$activity', 'Unknown'] }
        };
    }

    const nameExpr = (() => {
      switch (level) {
        case 'scope':
          return { $toString: '$_id.scope' };
        case 'category':
          return {
            $concat: [
              { $toString: '$_id.scope' },
              ' - ',
              { $ifNull: ['$_id.category', ''] }
            ]
          };
        case 'asset':
          return '$_id.activity';
        default:
          return '$_id.activity';
      }
    })();

    const pipeline = [
      { $match: safeMatch },
      {
        $group: {
          _id: groupId,
          total_co2e: { $sum: { $ifNull: ['$co2e', 0] } },
          count: { $sum: 1 },
          avg_co2e: { $avg: { $ifNull: ['$co2e', 0] } },
          earliest_date: { $min: '$date' },
          latest_date: { $max: '$date' },
          scope: { $first: '$scope' },
          category: { $first: '$category' },
          activity: { $first: '$activity' }
        }
      },
      {
        $project: {
          scope: '$scope',
          category: '$category',
          activity: '$activity',
          name: nameExpr,
          total_co2e: 1,
          count: 1,
          avg_co2e: 1,
          earliest_date: 1,
          latest_date: 1
        }
      },
      { $sort: { total_co2e: -1 } }
    ];

    return Emission.aggregate(pipeline).allowDiskUse(true);
  }

  // ============================================
  // PRIVATE — scope migration (unchanged logic)
  // ============================================

  _calculateScopeTotals(timeSeriesData) {
    const periodMap = {};

    timeSeriesData.forEach((row) => {
      const p = row.period;
      if (!periodMap[p]) {
        periodMap[p] = {
          period: p,
          scope1: 0,
          scope2: 0,
          scope3: 0,
          total: 0
        };
      }
      const s = parseInt(row.scope, 10);
      const scopeKey = `scope${Number.isFinite(s) ? s : ''}`;
      if (['scope1', 'scope2', 'scope3'].includes(scopeKey)) {
        periodMap[p][scopeKey] = parseFloat(row.total_co2e || 0);
        periodMap[p].total += parseFloat(row.total_co2e || 0);
      }
    });

    return Object.values(periodMap).sort((a, b) =>
      String(a.period).localeCompare(String(b.period))
    );
  }

  _detectBurdenShifting(scopeTotals) {
    const shifts = [];

    for (let i = 1; i < scopeTotals.length; i++) {
      const current = scopeTotals[i];
      const previous = scopeTotals[i - 1];

      const scope1Change = current.scope1 - previous.scope1;
      const scope3Change = current.scope3 - previous.scope3;

      if (scope1Change < 0 && scope3Change > 0) {
        const scope1ChangePercent =
          previous.scope1 > 0 ? (scope1Change / previous.scope1) * 100 : 0;
        const scope3ChangePercent =
          previous.scope3 > 0 ? (scope3Change / previous.scope3) * 100 : 0;

        if (Math.abs(scope1ChangePercent) > 10 && scope3ChangePercent > 10) {
          shifts.push({
            period: current.period,
            type: 'scope1_to_scope3',
            scope1Decrease: Math.abs(scope1Change).toFixed(2),
            scope3Increase: scope3Change.toFixed(2),
            scope1PercentChange: scope1ChangePercent.toFixed(1),
            scope3PercentChange: scope3ChangePercent.toFixed(1),
            severity: this._calculateShiftSeverity(
              Math.abs(scope1ChangePercent),
              scope3ChangePercent
            )
          });
        }
      }

      const scope2Change = current.scope2 - previous.scope2;
      const scope1Increase = scope1Change > 0 ? scope1Change : 0;

      if (scope2Change < 0 && scope1Increase > 0) {
        const scope2ChangePercent =
          previous.scope2 > 0 ? (scope2Change / previous.scope2) * 100 : 0;

        if (Math.abs(scope2ChangePercent) > 10) {
          shifts.push({
            period: current.period,
            type: 'scope2_to_scope1',
            scope2Decrease: Math.abs(scope2Change).toFixed(2),
            scope1Increase: scope1Increase.toFixed(2),
            scope2PercentChange: scope2ChangePercent.toFixed(1),
            severity: this._calculateShiftSeverity(
              Math.abs(scope2ChangePercent),
              (previous.scope1 ? (scope1Increase / previous.scope1) * 100 : 0)
            )
          });
        }
      }
    }

    return shifts;
  }

  _calculateShiftSeverity(decreasePercent, increasePercent) {
    const avgChange = (decreasePercent + increasePercent) / 2;
    if (avgChange > 30) return 'high';
    if (avgChange > 15) return 'medium';
    return 'low';
  }

  _generateSankeyData(scopeTotals, burdenShifts) {
    const nodes = [];
    const links = [];
    const nodeMap = {};
    let nodeIndex = 0;

    scopeTotals.forEach((period) => {
      ['scope1', 'scope2', 'scope3'].forEach((scope) => {
        const nodeId = `${period.period}_${scope}`;
        nodeMap[nodeId] = nodeIndex;
        const scopeNum = scope.replace('scope', '');
        nodes.push({
          id: nodeIndex,
          name: `Scope ${scopeNum}`,
          period: period.period,
          value: period[scope],
          color: this._getScopeColor(scopeNum)
        });
        nodeIndex++;
      });
    });

    for (let i = 0; i < scopeTotals.length - 1; i++) {
      const currentPeriod = scopeTotals[i];
      const nextPeriod = scopeTotals[i + 1];

      ['scope1', 'scope2', 'scope3'].forEach((scope) => {
        const sourceId = `${currentPeriod.period}_${scope}`;
        const targetId = `${nextPeriod.period}_${scope}`;
        const value = Math.min(currentPeriod[scope], nextPeriod[scope]);

        if (value > 0) {
          links.push({
            source: nodeMap[sourceId],
            target: nodeMap[targetId],
            value,
            period: `${currentPeriod.period} → ${nextPeriod.period}`
          });
        }
      });

      const periodShifts = burdenShifts.filter((s) => s.period === nextPeriod.period);
      periodShifts.forEach((shift) => {
        if (shift.type === 'scope1_to_scope3') {
          links.push({
            source: nodeMap[`${currentPeriod.period}_scope1`],
            target: nodeMap[`${nextPeriod.period}_scope3`],
            value: parseFloat(shift.scope3Increase) * 0.3,
            type: 'burden_shift',
            color: '#ef4444'
          });
        }
      });
    }

    return { nodes, links };
  }

  _calculateMigrationMetrics(scopeTotals, burdenShifts) {
    if (scopeTotals.length === 0) return null;

    const first = scopeTotals[0];
    const last = scopeTotals[scopeTotals.length - 1];

    const calculateChange = (start, end) => {
      if (start === 0) return end > 0 ? 100 : 0;
      return ((end - start) / start) * 100;
    };

    return {
      totalPeriods: scopeTotals.length,
      overallChange: {
        scope1: {
          start: first.scope1,
          end: last.scope1,
          change: last.scope1 - first.scope1,
          percentChange: calculateChange(first.scope1, last.scope1)
        },
        scope2: {
          start: first.scope2,
          end: last.scope2,
          change: last.scope2 - first.scope2,
          percentChange: calculateChange(first.scope2, last.scope2)
        },
        scope3: {
          start: first.scope3,
          end: last.scope3,
          change: last.scope3 - first.scope3,
          percentChange: calculateChange(first.scope3, last.scope3)
        },
        total: {
          start: first.total,
          end: last.total,
          change: last.total - first.total,
          percentChange: calculateChange(first.total, last.total)
        }
      },
      burdenShiftCount: burdenShifts.length,
      highSeverityShifts: burdenShifts.filter((s) => s.severity === 'high').length,
      dominantScope: this._getDominantScope(last)
    };
  }

  _getDominantScope(period) {
    const scopes = [
      { name: 'Scope 1', value: period.scope1 },
      { name: 'Scope 2', value: period.scope2 },
      { name: 'Scope 3', value: period.scope3 }
    ];
    scopes.sort((a, b) => b.value - a.value);
    return scopes[0].name;
  }

  _getScopeColor(scopeNum) {
    const colors = { '1': '#ef4444', '2': '#f59e0b', '3': '#3b82f6' };
    const k = String(scopeNum).replace(/\D/g, '') || String(scopeNum);
    return colors[k] || '#6b7280';
  }

  // ============================================
  // Pareto (unchanged + Mongo drill-down)
  // ============================================

  _calculatePareto(aggregatedData) {
    if (!aggregatedData || aggregatedData.length === 0) {
      return [];
    }

    const totalEmissions = aggregatedData.reduce(
      (sum, item) => sum + parseFloat(item.total_co2e || 0),
      0
    );
    if (totalEmissions === 0) {
      return [];
    }

    const sortedData = [...aggregatedData].sort(
      (a, b) => parseFloat(b.total_co2e || 0) - parseFloat(a.total_co2e || 0)
    );

    let cumulativeEmissions = 0;
    return sortedData.map((item, index) => {
      const emissions = parseFloat(item.total_co2e || 0);
      const percentage = (emissions / totalEmissions) * 100;
      cumulativeEmissions += emissions;
      const cumulativePercentage = (cumulativeEmissions / totalEmissions) * 100;

      return {
        rank: index + 1,
        name: item.name,
        scope: item.scope,
        category: item.category ?? null,
        activity: item.activity ?? null,
        emissions: parseFloat(emissions.toFixed(2)),
        percentage: parseFloat(percentage.toFixed(2)),
        cumulativeEmissions: parseFloat(cumulativeEmissions.toFixed(2)),
        cumulativePercentage: parseFloat(cumulativePercentage.toFixed(2)),
        count: item.count,
        avgEmissions: parseFloat((parseFloat(item.avg_co2e) || 0).toFixed(2)),
        dateRange: {
          start: item.earliest_date,
          end: item.latest_date
        }
      };
    });
  }

  _identifyHotspots(paretoData) {
    const hotspots = {
      top80Percent: [],
      top20Percent: [],
      criticalSources: []
    };

    paretoData.forEach((item, index) => {
      if (item.cumulativePercentage <= 80) {
        hotspots.top80Percent.push(item);
      }
      if (index < Math.ceil(paretoData.length * 0.2)) {
        hotspots.top20Percent.push(item);
      }
      if (item.percentage > 10) {
        hotspots.criticalSources.push(item);
      }
    });

    return {
      ...hotspots,
      summary: {
        totalSources: paretoData.length,
        sourcesIn80Percent: hotspots.top80Percent.length,
        sourcesIn20Percent: hotspots.top20Percent.length,
        criticalSourceCount: hotspots.criticalSources.length,
        paretoRatio:
          hotspots.top20Percent.length > 0
            ? hotspots.top20Percent.reduce((sum, s) => sum + s.percentage, 0).toFixed(1)
            : 0
      }
    };
  }

  _calculateConcentrationRisk(paretoData) {
    if (paretoData.length === 0) return null;

    const hhi = paretoData.reduce((sum, item) => sum + Math.pow(item.percentage, 2), 0);
    const gini = this._calculateGiniCoefficient(paretoData.map((d) => d.emissions));
    const top3 = paretoData.slice(0, 3).reduce((sum, s) => sum + s.percentage, 0);
    const top5 = paretoData.slice(0, 5).reduce((sum, s) => sum + s.percentage, 0);
    const top10 = paretoData
      .slice(0, Math.min(10, paretoData.length))
      .reduce((sum, s) => sum + s.percentage, 0);

    return {
      herfindahlIndex: parseFloat(hhi.toFixed(2)),
      giniCoefficient: parseFloat(gini.toFixed(3)),
      concentrationLevel: this._getConcentrationLevel(hhi),
      topNConcentration: {
        top3Percent: parseFloat(top3.toFixed(1)),
        top5Percent: parseFloat(top5.toFixed(1)),
        top10Percent: parseFloat(top10.toFixed(1))
      },
      riskAssessment: this._assessConcentrationRisk(hhi, gini, top3)
    };
  }

  _calculateGiniCoefficient(values) {
    const n = values.length;
    if (n === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);

    if (sum === 0) return 0;

    let numerator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (2 * (i + 1) - n - 1) * sorted[i];
    }

    return numerator / (n * sum);
  }

  _getConcentrationLevel(hhi) {
    if (hhi < 1500) return 'low';
    if (hhi < 2500) return 'moderate';
    return 'high';
  }

  _assessConcentrationRisk(hhi, gini, top3Percent) {
    const risks = [];

    if (hhi > 2500) {
      risks.push('High emission concentration detected');
    }
    if (gini > 0.7) {
      risks.push('Severe inequality in emission distribution');
    }
    if (top3Percent > 60) {
      risks.push('Over-reliance on top 3 emission sources');
    }

    return {
      level: risks.length > 2 ? 'high' : risks.length > 0 ? 'medium' : 'low',
      risks,
      recommendation: this._getConcentrationRecommendation(risks.length)
    };
  }

  _getConcentrationRecommendation(riskCount) {
    if (riskCount > 2) {
      return 'Immediate action required: Diversify emission sources and implement targeted reduction strategies for top contributors';
    }
    if (riskCount > 0) {
      return 'Monitor top emission sources closely and develop contingency plans';
    }
    return 'Emission distribution is balanced. Continue regular monitoring';
  }

  async _generateDrillDownHierarchyMongo(match, hotspots) {
    const topSources = hotspots.top80Percent.slice(0, 10);
    const safeBase = match;

    const drillDown = await Promise.all(
      topSources.map(async (source) => {
        const subMatch = { ...safeBase, scope: source.scope };

        if (source.category) {
          subMatch.category = source.category;
        }
        if (source.activity) {
          subMatch.activity = source.activity;
        }

        const subData = await Emission.aggregate([
          { $match: subMatch },
          {
            $group: {
              _id: { activity: '$activity', asset: '$notes' },
              total_co2e: { $sum: { $ifNull: ['$co2e', 0] } },
              count: { $sum: 1 }
            }
          },
          { $sort: { total_co2e: -1 } },
          { $limit: 10 }
        ]);

        return {
          parent: source.name,
          parentEmissions: source.emissions,
          children: subData.map((child) => {
            const emissions = parseFloat((child.total_co2e || 0).toFixed(2));
            return {
              name: child._id.asset?.trim?.() ? child._id.asset : child._id.activity,
              emissions,
              count: child.count,
              percentOfParent:
                source.emissions > 0
                  ? ((child.total_co2e || 0) / source.emissions * 100).toFixed(1)
                  : '0'
            };
          })
        };
      })
    );

    return drillDown;
  }
}

module.exports = new AnalysisService();
