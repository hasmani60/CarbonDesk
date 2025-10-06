// backend/services/analysisService.js
// Advanced analytics service for Scope Migration and Hotspot Pareto Analysis

const localDB = require('../database/localDB');

class AnalysisService {
  /**
   * Calculate Scope Migration Analysis
   * Tracks emissions moving between scopes over time
   */
  async calculateScopeMigration(filters = {}) {
    const {
      startDate,
      endDate,
      organisationId,
      department,
      site,
      asset,
      timeInterval = 'month' // month, quarter, year
    } = filters;

    try {
      // Build WHERE clause
      const whereConditions = ['organisation_id = ?'];
      const params = [organisationId];

      if (startDate) {
        whereConditions.push('date >= ?');
        params.push(startDate);
      }
      if (endDate) {
        whereConditions.push('date <= ?');
        params.push(endDate);
      }
      if (department) {
        whereConditions.push('department = ?');
        params.push(department);
      }
      if (site) {
        whereConditions.push('site = ?');
        params.push(site);
      }
      if (asset) {
        whereConditions.push('asset = ?');
        params.push(asset);
      }

      const whereClause = whereConditions.join(' AND ');

      // Get time-series data grouped by scope
      const timeSeriesData = await this._getTimeSeriesData(whereClause, params, timeInterval);

      // Calculate scope totals per period
      const scopeTotals = this._calculateScopeTotals(timeSeriesData);

      // Detect burden shifting
      const burdenShifts = this._detectBurdenShifting(scopeTotals);

      // Generate Sankey diagram data
      const sankeyData = this._generateSankeyData(scopeTotals, burdenShifts);

      // Calculate metrics
      const metrics = this._calculateMigrationMetrics(scopeTotals, burdenShifts);

      return {
        success: true,
        data: {
          sankey: sankeyData,
          timeSeries: scopeTotals,
          burdenShifts: burdenShifts,
          metrics: metrics,
          filters: filters
        }
      };

    } catch (error) {
      console.error('Scope migration analysis error:', error);
      throw error;
    }
  }

  /**
   * Calculate Hotspot Pareto Analysis
   * Identifies top emission sources following 80/20 rule
   */
  async calculateHotspotPareto(filters = {}) {
    const {
      startDate,
      endDate,
      organisationId,
      scope,
      category,
      drillDownLevel = 'activity' // scope, category, activity, asset
    } = filters;

    try {
      // Build WHERE clause
      const whereConditions = ['organisation_id = ?'];
      const params = [organisationId];

      if (startDate) {
        whereConditions.push('date >= ?');
        params.push(startDate);
      }
      if (endDate) {
        whereConditions.push('date <= ?');
        params.push(endDate);
      }
      if (scope) {
        whereConditions.push('scope = ?');
        params.push(scope);
      }
      if (category) {
        whereConditions.push('category = ?');
        params.push(category);
      }

      const whereClause = whereConditions.join(' AND ');

      // Get aggregated emissions by hierarchy
      const aggregatedData = await this._getHierarchicalAggregation(
        whereClause, 
        params, 
        drillDownLevel
      );

      // Calculate Pareto analysis
      const paretoData = this._calculatePareto(aggregatedData);

      // Identify hotspots (top 20% contributing to 80%)
      const hotspots = this._identifyHotspots(paretoData);

      // Calculate concentration risk
      const concentrationMetrics = this._calculateConcentrationRisk(paretoData);

      // Generate drill-down hierarchy
      const drillDown = await this._generateDrillDownHierarchy(
        whereClause, 
        params, 
        hotspots
      );

      return {
        success: true,
        data: {
          pareto: paretoData,
          hotspots: hotspots,
          concentration: concentrationMetrics,
          drillDown: drillDown,
          filters: filters
        }
      };

    } catch (error) {
      console.error('Hotspot pareto analysis error:', error);
      throw error;
    }
  }

  // ============================================
  // PRIVATE HELPER METHODS - SCOPE MIGRATION
  // ============================================

  _getTimeSeriesData(whereClause, params, interval) {
    return new Promise((resolve, reject) => {
      // Determine date grouping based on interval
      let dateGroup;
      switch (interval) {
        case 'quarter':
          dateGroup = "strftime('%Y-Q', date, 'start of month', printf('-%d month', (cast(strftime('%m', date) as integer) - 1) % 3))";
          break;
        case 'year':
          dateGroup = "strftime('%Y', date)";
          break;
        default: // month
          dateGroup = "strftime('%Y-%m', date)";
      }

      const query = `
        SELECT 
          ${dateGroup} as period,
          scope,
          SUM(co2e) as total_co2e,
          COUNT(*) as count,
          AVG(co2e) as avg_co2e
        FROM emissions
        WHERE ${whereClause}
        GROUP BY period, scope
        ORDER BY period, scope
      `;

      localDB.db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  _calculateScopeTotals(timeSeriesData) {
    // Group by period
    const periodMap = {};

    timeSeriesData.forEach(row => {
      if (!periodMap[row.period]) {
        periodMap[row.period] = {
          period: row.period,
          scope1: 0,
          scope2: 0,
          scope3: 0,
          total: 0
        };
      }

      const scopeKey = `scope${row.scope}`;
      periodMap[row.period][scopeKey] = parseFloat(row.total_co2e || 0);
      periodMap[row.period].total += parseFloat(row.total_co2e || 0);
    });

    return Object.values(periodMap).sort((a, b) => 
      a.period.localeCompare(b.period)
    );
  }

  _detectBurdenShifting(scopeTotals) {
    const shifts = [];

    for (let i = 1; i < scopeTotals.length; i++) {
      const current = scopeTotals[i];
      const previous = scopeTotals[i - 1];

      // Detect Scope 1 decrease with Scope 3 increase (burden shifting)
      const scope1Change = current.scope1 - previous.scope1;
      const scope3Change = current.scope3 - previous.scope3;

      if (scope1Change < 0 && scope3Change > 0) {
        const scope1ChangePercent = previous.scope1 > 0 
          ? (scope1Change / previous.scope1) * 100 
          : 0;
        const scope3ChangePercent = previous.scope3 > 0 
          ? (scope3Change / previous.scope3) * 100 
          : 0;

        // Significant burden shift if >10% change
        if (Math.abs(scope1ChangePercent) > 10 && scope3ChangePercent > 10) {
          shifts.push({
            period: current.period,
            type: 'scope1_to_scope3',
            scope1Decrease: Math.abs(scope1Change).toFixed(2),
            scope3Increase: scope3Change.toFixed(2),
            scope1PercentChange: scope1ChangePercent.toFixed(1),
            scope3PercentChange: scope3ChangePercent.toFixed(1),
            severity: this._calculateShiftSeverity(Math.abs(scope1ChangePercent), scope3ChangePercent)
          });
        }
      }

      // Detect Scope 2 to Scope 1 shift (e.g., on-site generation)
      const scope2Change = current.scope2 - previous.scope2;
      const scope1Increase = scope1Change > 0 ? scope1Change : 0;

      if (scope2Change < 0 && scope1Increase > 0) {
        const scope2ChangePercent = previous.scope2 > 0 
          ? (scope2Change / previous.scope2) * 100 
          : 0;

        if (Math.abs(scope2ChangePercent) > 10) {
          shifts.push({
            period: current.period,
            type: 'scope2_to_scope1',
            scope2Decrease: Math.abs(scope2Change).toFixed(2),
            scope1Increase: scope1Increase.toFixed(2),
            scope2PercentChange: scope2ChangePercent.toFixed(1),
            severity: this._calculateShiftSeverity(Math.abs(scope2ChangePercent), 
              (scope1Increase / previous.scope1) * 100)
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
    // Generate nodes (scopes across periods)
    const nodes = [];
    const links = [];
    const nodeMap = {};
    let nodeIndex = 0;

    // Create nodes for each scope in each period
    scopeTotals.forEach((period, periodIdx) => {
      ['scope1', 'scope2', 'scope3'].forEach(scope => {
        const nodeId = `${period.period}_${scope}`;
        const scopeNum = scope.replace('scope', '');
        
        nodeMap[nodeId] = nodeIndex;
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

    // Create links between periods
    for (let i = 0; i < scopeTotals.length - 1; i++) {
      const currentPeriod = scopeTotals[i];
      const nextPeriod = scopeTotals[i + 1];

      ['scope1', 'scope2', 'scope3'].forEach(scope => {
        const sourceId = `${currentPeriod.period}_${scope}`;
        const targetId = `${nextPeriod.period}_${scope}`;
        
        const value = Math.min(currentPeriod[scope], nextPeriod[scope]);
        
        if (value > 0) {
          links.push({
            source: nodeMap[sourceId],
            target: nodeMap[targetId],
            value: value,
            period: `${currentPeriod.period} → ${nextPeriod.period}`
          });
        }
      });

      // Add burden shift flows
      const periodShifts = burdenShifts.filter(s => s.period === nextPeriod.period);
      periodShifts.forEach(shift => {
        if (shift.type === 'scope1_to_scope3') {
          links.push({
            source: nodeMap[`${currentPeriod.period}_scope1`],
            target: nodeMap[`${nextPeriod.period}_scope3`],
            value: parseFloat(shift.scope3Increase) * 0.3, // Proportion of shift
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
      highSeverityShifts: burdenShifts.filter(s => s.severity === 'high').length,
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
    const colors = {
      '1': '#ef4444', // red
      '2': '#f59e0b', // amber
      '3': '#3b82f6'  // blue
    };
    return colors[scopeNum] || '#6b7280';
  }

  // ============================================
  // PRIVATE HELPER METHODS - HOTSPOT PARETO
  // ============================================

  _getHierarchicalAggregation(whereClause, params, level) {
    return new Promise((resolve, reject) => {
      // Determine grouping based on drill-down level
      let groupBy, selectFields;
      
      switch (level) {
        case 'scope':
          groupBy = 'scope';
          selectFields = 'scope as name, scope';
          break;
        case 'category':
          groupBy = 'scope, category';
          selectFields = 'scope, category, (scope || \' - \' || COALESCE(category, \'Uncategorized\')) as name';
          break;
        case 'asset':
          groupBy = 'scope, category, activity, notes';
          selectFields = 'scope, category, activity, COALESCE(notes, \'Asset \' || id) as name';
          break;
        default: // activity
          groupBy = 'scope, category, activity';
          selectFields = 'scope, category, activity, activity as name';
      }

      const query = `
        SELECT 
          ${selectFields},
          SUM(co2e) as total_co2e,
          COUNT(*) as count,
          AVG(co2e) as avg_co2e,
          MIN(date) as earliest_date,
          MAX(date) as latest_date
        FROM emissions
        WHERE ${whereClause}
        GROUP BY ${groupBy}
        ORDER BY total_co2e DESC
      `;

      localDB.db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  _calculatePareto(aggregatedData) {
    if (!aggregatedData || aggregatedData.length === 0) {
      return [];
    }

    // Calculate total emissions
    const totalEmissions = aggregatedData.reduce((sum, item) => 
      sum + parseFloat(item.total_co2e || 0), 0
    );

    // Sort by emissions descending (should already be sorted)
    const sortedData = [...aggregatedData].sort((a, b) => 
      parseFloat(b.total_co2e) - parseFloat(a.total_co2e)
    );

    // Calculate cumulative percentages
    let cumulativeEmissions = 0;
    const paretoData = sortedData.map((item, index) => {
      const emissions = parseFloat(item.total_co2e || 0);
      const percentage = (emissions / totalEmissions) * 100;
      cumulativeEmissions += emissions;
      const cumulativePercentage = (cumulativeEmissions / totalEmissions) * 100;

      return {
        rank: index + 1,
        name: item.name,
        scope: item.scope,
        category: item.category || null,
        activity: item.activity || null,
        emissions: parseFloat(emissions.toFixed(2)),
        percentage: parseFloat(percentage.toFixed(2)),
        cumulativeEmissions: parseFloat(cumulativeEmissions.toFixed(2)),
        cumulativePercentage: parseFloat(cumulativePercentage.toFixed(2)),
        count: item.count,
        avgEmissions: parseFloat((item.avg_co2e || 0).toFixed(2)),
        dateRange: {
          start: item.earliest_date,
          end: item.latest_date
        }
      };
    });

    return paretoData;
  }

  _identifyHotspots(paretoData) {
    // Find sources contributing to 80% of emissions
    const hotspots = {
      top80Percent: [],
      top20Percent: [],
      criticalSources: []
    };

    paretoData.forEach((item, index) => {
      // Top 80% cumulative emissions
      if (item.cumulativePercentage <= 80) {
        hotspots.top80Percent.push(item);
      }

      // Top 20% of sources
      if (index < Math.ceil(paretoData.length * 0.2)) {
        hotspots.top20Percent.push(item);
      }

      // Critical sources (>10% individual contribution)
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
        paretoRatio: hotspots.top20Percent.length > 0 
          ? (hotspots.top20Percent.reduce((sum, s) => sum + s.percentage, 0)).toFixed(1)
          : 0
      }
    };
  }

  _calculateConcentrationRisk(paretoData) {
    if (paretoData.length === 0) return null;

    // Herfindahl-Hirschman Index (HHI) for concentration
    const hhi = paretoData.reduce((sum, item) => 
      sum + Math.pow(item.percentage, 2), 0
    );

    // Gini coefficient for inequality
    const gini = this._calculateGiniCoefficient(
      paretoData.map(d => d.emissions)
    );

    // Top N concentration
    const top3 = paretoData.slice(0, 3).reduce((sum, s) => sum + s.percentage, 0);
    const top5 = paretoData.slice(0, 5).reduce((sum, s) => sum + s.percentage, 0);
    const top10 = paretoData.slice(0, Math.min(10, paretoData.length))
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
      risks: risks,
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

  async _generateDrillDownHierarchy(whereClause, params, hotspots) {
    // Get detailed breakdown for top hotspots
    const topSources = hotspots.top80Percent.slice(0, 10);
    
    const drillDown = await Promise.all(
      topSources.map(async (source) => {
        // Get sub-level details
        const subQuery = `
          SELECT 
            activity,
            COALESCE(notes, 'Asset ' || id) as asset,
            SUM(co2e) as total_co2e,
            COUNT(*) as count
          FROM emissions
          WHERE ${whereClause}
            AND scope = ?
            ${source.category ? 'AND category = ?' : ''}
            ${source.activity ? 'AND activity = ?' : ''}
          GROUP BY activity, asset
          ORDER BY total_co2e DESC
          LIMIT 10
        `;

        const subParams = [...params, source.scope];
        if (source.category) subParams.push(source.category);
        if (source.activity) subParams.push(source.activity);

        const subData = await new Promise((resolve, reject) => {
          localDB.db.all(subQuery, subParams, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          });
        });

        return {
          parent: source.name,
          parentEmissions: source.emissions,
          children: subData.map(child => ({
            name: child.asset || child.activity,
            emissions: parseFloat((child.total_co2e || 0).toFixed(2)),
            count: child.count,
            percentOfParent: ((child.total_co2e / source.emissions) * 100).toFixed(1)
          }))
        };
      })
    );

    return drillDown;
  }
}

module.exports = new AnalysisService();