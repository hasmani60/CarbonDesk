// utils/analysisHelpers.js - Advanced Analytics Helper Functions (Extended)

/**
 * ===== PARETO ANALYSIS HELPERS =====
 */

export const calculatePareto = (data, valueKey = 'value') => {
    if (!data || data.length === 0) return [];
  
    const total = data.reduce((sum, item) => sum + (item[valueKey] || 0), 0);
    
    if (total === 0) return data.map(item => ({ ...item, percentage: 0, cumulative: 0 }));
  
    const sorted = [...data].sort((a, b) => (b[valueKey] || 0) - (a[valueKey] || 0));
  
    let cumulative = 0;
    return sorted.map(item => {
      const percentage = ((item[valueKey] || 0) / total) * 100;
      cumulative += percentage;
      
      return {
        ...item,
        percentage: parseFloat(percentage.toFixed(2)),
        cumulative: parseFloat(cumulative.toFixed(2))
      };
    });
  };
  
  export const identifyTopContributors = (paretoData, threshold = 80) => {
    const topItems = paretoData.filter(item => item.cumulative <= threshold);
    const topCount = topItems.length;
    const topPercentage = topItems.length > 0 ? topItems[topItems.length - 1].cumulative : 0;
  
    return {
      items: topItems,
      count: topCount,
      percentage: topPercentage,
      threshold,
      message: `Top ${topCount} items account for ${topPercentage.toFixed(1)}% of total`
    };
  };
  
  export const calculateConcentrationRisk = (paretoData) => {
    if (!paretoData || paretoData.length === 0) {
      return { level: 'unknown', score: 0, message: 'No data available' };
    }
  
    const top3Items = paretoData.slice(0, 3);
    const top3Percentage = top3Items.length > 0 ? top3Items[top3Items.length - 1].cumulative : 0;
  
    let level, score, message;
  
    if (top3Percentage >= 80) {
      level = 'high';
      score = 9;
      message = 'Very high concentration - Top 3 sources dominate emissions';
    } else if (top3Percentage >= 60) {
      level = 'medium-high';
      score = 7;
      message = 'High concentration - Few sources drive majority of emissions';
    } else if (top3Percentage >= 40) {
      level = 'medium';
      score = 5;
      message = 'Moderate concentration - Distribution is fairly balanced';
    } else {
      level = 'low';
      score = 3;
      message = 'Low concentration - Emissions are well distributed';
    }
  
    return {
      level,
      score,
      top3Percentage: top3Percentage.toFixed(1),
      message,
      recommendation: level === 'high' || level === 'medium-high' 
        ? 'Focus reduction efforts on top sources for maximum impact'
        : 'Consider broad-based reduction strategies'
    };
  };
  
  export const calculateReductionPotential = (paretoData, reductionPercentage = 50, threshold = 80) => {
    const topItems = paretoData.filter(item => item.cumulative <= threshold);
    const totalTopValue = topItems.reduce((sum, item) => sum + (item.value || 0), 0);
    const potentialReduction = totalTopValue * (reductionPercentage / 100);
    
    const totalValue = paretoData.reduce((sum, item) => sum + (item.value || 0), 0);
    const impactPercentage = (potentialReduction / totalValue) * 100;
  
    return {
      topItemsCount: topItems.length,
      totalTopValue,
      reductionPercentage,
      potentialReduction: parseFloat(potentialReduction.toFixed(2)),
      impactPercentage: parseFloat(impactPercentage.toFixed(2)),
      message: `Reducing top ${topItems.length} sources by ${reductionPercentage}% would eliminate ${impactPercentage.toFixed(1)}% of total emissions`
    };
  };
  
  /**
   * ===== SCOPE MIGRATION ANALYSIS HELPERS =====
   */
  
  export const detectBurdenShifting = (periods) => {
    if (!periods || periods.length < 2) {
      return {
        detected: false,
        message: 'Insufficient data to detect burden shifting'
      };
    }
  
    const first = periods[0];
    const last = periods[periods.length - 1];
  
    const scope1Change = calculatePercentageChange(first.scope1, last.scope1);
    const scope2Change = calculatePercentageChange(first.scope2, last.scope2);
    const scope3Change = calculatePercentageChange(first.scope3, last.scope3);
  
    const outsourcingDetected = scope1Change < -10 && scope3Change > 10;
    const energyShiftDetected = scope2Change < -10 && scope1Change > 10;
    const significantShiftDetected = 
      (Math.abs(scope1Change) > 15 && Math.abs(scope3Change) > 15 && scope1Change * scope3Change < 0) ||
      (Math.abs(scope1Change) > 15 && Math.abs(scope2Change) > 15 && scope1Change * scope2Change < 0) ||
      (Math.abs(scope2Change) > 15 && Math.abs(scope3Change) > 15 && scope2Change * scope3Change < 0);
  
    const detected = outsourcingDetected || energyShiftDetected || significantShiftDetected;
  
    let primaryShift = '';
    let shiftType = '';
  
    if (outsourcingDetected) {
      primaryShift = `Scope 1 → Scope 3 (${Math.abs(scope1Change).toFixed(1)}% decrease, ${scope3Change.toFixed(1)}% increase)`;
      shiftType = 'outsourcing';
    } else if (energyShiftDetected) {
      primaryShift = `Scope 2 → Scope 1 (${Math.abs(scope2Change).toFixed(1)}% decrease, ${scope1Change.toFixed(1)}% increase)`;
      shiftType = 'energy_independence';
    } else if (significantShiftDetected) {
      primaryShift = 'Significant redistribution detected';
      shiftType = 'redistribution';
    }
  
    const totalFirst = first.scope1 + first.scope2 + first.scope3;
    const totalLast = last.scope1 + last.scope2 + last.scope3;
    const netChange = calculatePercentageChange(totalFirst, totalLast);
  
    return {
      detected,
      shiftType,
      primaryShift,
      scope1Change: parseFloat(scope1Change.toFixed(2)),
      scope2Change: parseFloat(scope2Change.toFixed(2)),
      scope3Change: parseFloat(scope3Change.toFixed(2)),
      netChange: parseFloat(netChange.toFixed(2)),
      message: detected 
        ? `Burden shifting detected: ${primaryShift}` 
        : 'No significant burden shifting detected',
      recommendation: detected
        ? 'Review outsourced activities and engage supply chain partners in reduction efforts'
        : 'Continue monitoring scope distributions for emerging patterns'
    };
  };
  
  export const calculateEmissionFlows = (currentPeriod, previousPeriod = null) => {
    const flows = [];
  
    flows.push({
      source: 'Scope 1',
      target: 'Scope 1',
      value: currentPeriod.scope1 || 0,
      type: 'stable'
    });
  
    flows.push({
      source: 'Scope 2',
      target: 'Scope 2',
      value: currentPeriod.scope2 || 0,
      type: 'stable'
    });
  
    flows.push({
      source: 'Scope 3',
      target: 'Scope 3',
      value: currentPeriod.scope3 || 0,
      type: 'stable'
    });
  
    if (previousPeriod) {
      const scope1to3 = Math.max(0, previousPeriod.scope1 - currentPeriod.scope1);
      if (scope1to3 > 0 && currentPeriod.scope3 > previousPeriod.scope3) {
        flows.push({
          source: 'Scope 1',
          target: 'Scope 3',
          value: Math.min(scope1to3, currentPeriod.scope3 - previousPeriod.scope3),
          type: 'shift'
        });
      }
  
      const scope2to1 = Math.max(0, previousPeriod.scope2 - currentPeriod.scope2);
      if (scope2to1 > 0 && currentPeriod.scope1 > previousPeriod.scope1) {
        flows.push({
          source: 'Scope 2',
          target: 'Scope 1',
          value: Math.min(scope2to1, currentPeriod.scope1 - previousPeriod.scope1),
          type: 'shift'
        });
      }
    }
  
    return flows.filter(flow => flow.value > 0);
  };
  
  export const calculateTrends = (periods) => {
    if (!periods || periods.length < 2) {
      return { trend: 'insufficient_data', message: 'Need at least 2 periods for trend analysis' };
    }
  
    const trends = {
      scope1: analyzeScopeTrend(periods, 'scope1'),
      scope2: analyzeScopeTrend(periods, 'scope2'),
      scope3: analyzeScopeTrend(periods, 'scope3'),
      total: analyzeTotalTrend(periods)
    };
  
    return trends;
  };
  
  const analyzeScopeTrend = (periods, scopeKey) => {
    const values = periods.map(p => p[scopeKey] || 0);
    const first = values[0];
    const last = values[values.length - 1];
    const change = calculatePercentageChange(first, last);
  
    let increases = 0;
    let decreases = 0;
    for (let i = 1; i < values.length; i++) {
      if (values[i] > values[i - 1]) increases++;
      if (values[i] < values[i - 1]) decreases++;
    }
  
    const consistency = Math.max(increases, decreases) / (values.length - 1);
  
    return {
      direction: change > 5 ? 'increasing' : change < -5 ? 'decreasing' : 'stable',
      change: parseFloat(change.toFixed(2)),
      consistency: parseFloat((consistency * 100).toFixed(1)),
      isConsistent: consistency > 0.7
    };
  };
  
  const analyzeTotalTrend = (periods) => {
    const totals = periods.map(p => (p.scope1 || 0) + (p.scope2 || 0) + (p.scope3 || 0));
    const first = totals[0];
    const last = totals[totals.length - 1];
    const change = calculatePercentageChange(first, last);
  
    return {
      direction: change > 5 ? 'increasing' : change < -5 ? 'decreasing' : 'stable',
      change: parseFloat(change.toFixed(2)),
      firstPeriod: first,
      lastPeriod: last,
      absoluteChange: last - first
    };
  };
  
  /**
   * ===== NEW: TRAJECTORY ANALYSIS HELPERS =====
   */
  
  export const calculateBaselineYear = (yearlyData) => {
    if (!yearlyData || yearlyData.length === 0) {
      return { year: new Date().getFullYear(), emissions: 0 };
    }
  
    // Use earliest year with data as baseline
    const sorted = [...yearlyData].sort((a, b) => a.period.localeCompare(b.period));
    const baseline = sorted[0];
    
    return {
      year: parseInt(baseline.period),
      emissions: baseline.total
    };
  };
  
  export const calculateTrajectoryAlignment = (historicalData, targetPathway, baseline) => {
    if (!historicalData || historicalData.length < 2) {
      return {
        onTrack: false,
        deviationPercent: 0,
        requiredReductionRate: 0,
        currentReductionRate: 0,
        message: 'Insufficient data for trajectory alignment'
      };
    }
  
    // Get latest actual emissions
    const latest = historicalData[historicalData.length - 1];
    const latestYear = parseInt(latest.period);
    
    // Find corresponding target
    const target = targetPathway.find(t => parseInt(t.period) === latestYear);
    
    if (!target) {
      return {
        onTrack: false,
        deviationPercent: 0,
        requiredReductionRate: 0,
        currentReductionRate: 0,
        message: 'No target data available for comparison'
      };
    }
  
    // Calculate deviation
    const deviation = latest.total - target.target;
    const deviationPercent = (deviation / target.target) * 100;
  
    // Calculate current reduction rate
    const first = historicalData[0];
    const yearsElapsed = latestYear - parseInt(first.period);
    const currentReductionRate = yearsElapsed > 0 
      ? (calculatePercentageChange(first.total, latest.total) / yearsElapsed)
      : 0;
  
    // Calculate required reduction rate based on scenario
    const scenarioRates = {
      '1.5C': 4.2,
      '2C': 2.9,
      '2C_low': 2.0
    };
    const requiredReductionRate = scenarioRates[target.scenario] || 2.9;
  
    // Determine if on track (within 10% tolerance)
    const onTrack = Math.abs(deviationPercent) <= 10 && 
                    Math.abs(currentReductionRate) >= (requiredReductionRate * 0.9);
  
    return {
      onTrack,
      deviationPercent: parseFloat(deviationPercent.toFixed(2)),
      requiredReductionRate: parseFloat(requiredReductionRate.toFixed(2)),
      currentReductionRate: parseFloat(Math.abs(currentReductionRate).toFixed(2)),
      message: onTrack 
        ? `On track to meet ${target.scenario} targets`
        : `Off track by ${Math.abs(deviationPercent).toFixed(1)}% - need to ${deviationPercent > 0 ? 'accelerate' : 'maintain'} reduction efforts`
    };
  };
  
  /**
   * ===== NEW: VELOCITY & ACCELERATION HELPERS =====
   */
  
  export const calculateVelocityMetrics = (periods) => {
    if (!periods || periods.length < 2) {
      return {
        periods: [],
        summary: {
          avgVelocity: 0,
          avgAcceleration: 0,
          trendDirection: 'insufficient_data',
          inflectionPoints: 0
        }
      };
    }
  
    const enrichedPeriods = [];
    let velocities = [];
  
    for (let i = 0; i < periods.length; i++) {
      const period = periods[i];
      let velocity = null;
      let acceleration = null;
      let isInflectionPoint = false;
  
      // Calculate velocity (rate of change)
      if (i > 0) {
        const prevPeriod = periods[i - 1];
        velocity = calculatePercentageChange(prevPeriod.total, period.total);
        velocities.push(velocity);
  
        // Calculate acceleration (change in velocity)
        if (i > 1) {
          const prevVelocity = velocities[velocities.length - 2];
          acceleration = velocity - prevVelocity;
  
          // Detect inflection points (sign change in velocity)
          if ((prevVelocity > 0 && velocity < 0) || (prevVelocity < 0 && velocity > 0)) {
            isInflectionPoint = true;
          }
        }
      }
  
      enrichedPeriods.push({
        period: period.period,
        emissions: period.total,
        velocity: velocity !== null ? parseFloat(velocity.toFixed(2)) : null,
        acceleration: acceleration !== null ? parseFloat(acceleration.toFixed(2)) : null,
        isInflectionPoint
      });
    }
  
    // Calculate summary statistics
    const validVelocities = velocities.filter(v => v !== null);
    const avgVelocity = validVelocities.length > 0
      ? validVelocities.reduce((sum, v) => sum + v, 0) / validVelocities.length
      : 0;
  
    const accelerations = enrichedPeriods
      .map(p => p.acceleration)
      .filter(a => a !== null);
    const avgAcceleration = accelerations.length > 0
      ? accelerations.reduce((sum, a) => sum + a, 0) / accelerations.length
      : 0;
  
    const inflectionPoints = enrichedPeriods.filter(p => p.isInflectionPoint).length;
  
    let trendDirection = 'stable';
    if (avgVelocity < -2) trendDirection = 'decelerating';
    else if (avgVelocity > 2) trendDirection = 'accelerating';
  
    return {
      periods: enrichedPeriods,
      summary: {
        avgVelocity: parseFloat(avgVelocity.toFixed(2)),
        avgAcceleration: parseFloat(avgAcceleration.toFixed(2)),
        trendDirection,
        inflectionPoints
      }
    };
  };
  
  /**
   * ===== NEW: MACC ANALYSIS HELPERS =====
   */
  
  export const generateMACCData = (opportunities) => {
    if (!opportunities || opportunities.length === 0) {
      return {
        opportunities: [],
        summary: {
          totalAbatementPotential: 0,
          totalCost: 0,
          avgCostPerTon: 0,
          costEffectiveOpportunities: 0
        }
      };
    }
  
    // Sort by cost per ton (ascending - negative first)
    const sorted = [...opportunities].sort((a, b) => a.costPerTon - b.costPerTon);
  
    // Calculate cumulative abatement
    let cumulative = 0;
    const enriched = sorted.map(opp => {
      cumulative += opp.abatementPotential;
      return {
        ...opp,
        cumulativeAbatement: parseFloat(cumulative.toFixed(2))
      };
    });
  
    // Calculate summary
    const totalAbatementPotential = opportunities.reduce((sum, o) => sum + o.abatementPotential, 0);
    const totalCost = opportunities.reduce((sum, o) => sum + o.totalCost, 0);
    const avgCostPerTon = totalAbatementPotential > 0 
      ? totalCost / totalAbatementPotential 
      : 0;
    const costEffectiveOpportunities = opportunities.filter(o => o.costPerTon < 0).length;
  
    return {
      opportunities: enriched,
      summary: {
        totalAbatementPotential: parseFloat(totalAbatementPotential.toFixed(2)),
        totalCost: parseFloat(totalCost.toFixed(2)),
        avgCostPerTon: parseFloat(avgCostPerTon.toFixed(2)),
        costEffectiveOpportunities
      }
    };
  };
  
  export const rankMACCOpportunities = (opportunities) => {
    // Rank by cost-effectiveness score
    return opportunities.map(opp => {
      let score = 0;
      
      // Negative cost = high score
      if (opp.costPerTon < 0) score += 10;
      else if (opp.costPerTon < 25) score += 7;
      else if (opp.costPerTon < 50) score += 5;
      else score += 2;
  
      // High abatement potential
      if (opp.abatementPotential > 1000) score += 5;
      else if (opp.abatementPotential > 500) score += 3;
      else score += 1;
  
      // Quick payback
      if (opp.paybackPeriod && opp.paybackPeriod < 2) score += 5;
      else if (opp.paybackPeriod && opp.paybackPeriod < 5) score += 3;
  
      return {
        ...opp,
        score,
        rank: 0 // Will be set after sorting
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((opp, index) => ({
      ...opp,
      rank: index + 1
    }));
  };
  
  /**
   * ===== UTILITY FUNCTIONS =====
   */
  
  export const calculatePercentageChange = (oldValue, newValue) => {
    if (oldValue === 0) return newValue > 0 ? 100 : 0;
    return ((newValue - oldValue) / oldValue) * 100;
  };
  
  export const formatLargeNumber = (value, decimals = 1) => {
    if (value >= 1000000000) return (value / 1000000000).toFixed(decimals) + 'B';
    if (value >= 1000000) return (value / 1000000).toFixed(decimals) + 'M';
    if (value >= 1000) return (value / 1000).toFixed(decimals) + 'K';
    return value.toFixed(decimals);
  };
  
  export const groupEmissions = (emissions, groupByField) => {
    return emissions.reduce((acc, emission) => {
      const key = emission[groupByField] || 'Unknown';
      if (!acc[key]) {
        acc[key] = {
          name: key,
          value: 0,
          count: 0,
          items: []
        };
      }
      acc[key].value += emission.calculatedEmissions || emission.totalEmissions || 0;
      acc[key].count += 1;
      acc[key].items.push(emission);
      return acc;
    }, {});
  };
  
  export const transformForPareto = (groupedData) => {
    return Object.values(groupedData).map(group => ({
      name: group.name,
      value: group.value,
      count: group.count,
      canDrill: group.items.length > 0
    }));
  };
  
  export const calculateDrillDown = (items, drillField = 'subcategory') => {
    const grouped = groupEmissions(items, drillField);
    const transformed = transformForPareto(grouped);
    return calculatePareto(transformed);
  };
  
  export const generateParetoInsights = (paretoData, threshold = 80) => {
    const topContributors = identifyTopContributors(paretoData, threshold);
    const concentrationRisk = calculateConcentrationRisk(paretoData);
    const reductionPotential = calculateReductionPotential(paretoData, 50, threshold);
  
    return {
      summary: topContributors.message,
      risk: concentrationRisk.message,
      potential: reductionPotential.message,
      recommendations: [
        concentrationRisk.recommendation,
        `Target ${topContributors.count} sources for maximum reduction impact`,
        `Potential to eliminate ${reductionPotential.impactPercentage.toFixed(1)}% of emissions by focusing on top sources`
      ]
    };
  };
  
  export const generateMigrationInsights = (periods) => {
    const burdenShifting = detectBurdenShifting(periods);
    const trends = calculateTrends(periods);
  
    const insights = {
      burdenShifting: burdenShifting.message,
      overallTrend: `Total emissions ${trends.total.direction} by ${Math.abs(trends.total.change).toFixed(1)}%`,
      scopeTrends: [
        `Scope 1: ${trends.scope1.direction} (${trends.scope1.change > 0 ? '+' : ''}${trends.scope1.change}%)`,
        `Scope 2: ${trends.scope2.direction} (${trends.scope2.change > 0 ? '+' : ''}${trends.scope2.change}%)`,
        `Scope 3: ${trends.scope3.direction} (${trends.scope3.change > 0 ? '+' : ''}${trends.scope3.change}%)`
      ],
      recommendations: [burdenShifting.recommendation]
    };
  
    if (trends.total.direction === 'increasing') {
      insights.recommendations.push('Implement comprehensive emission reduction strategies across all scopes');
    }
  
    if (burdenShifting.detected) {
      insights.recommendations.push('Review supply chain carbon intensity and engage partners');
    }
  
    return insights;
  };
  
  export const validateAnalysisData = (data) => {
    if (!data || !Array.isArray(data)) {
      return { valid: false, message: 'Data must be an array' };
    }
  
    if (data.length === 0) {
      return { valid: false, message: 'Data array is empty' };
    }
  
    const hasRequiredFields = data.every(item => 
      item.hasOwnProperty('value') || item.hasOwnProperty('scope1')
    );
  
    if (!hasRequiredFields) {
      return { valid: false, message: 'Data items missing required fields' };
    }
  
    return { valid: true, message: 'Data is valid' };
  };
  
  export default {
    // Pareto functions
    calculatePareto,
    identifyTopContributors,
    calculateConcentrationRisk,
    calculateReductionPotential,
    
    // Scope migration functions
    detectBurdenShifting,
    calculateEmissionFlows,
    calculateTrends,
    
    // Trajectory functions
    calculateBaselineYear,
    calculateTrajectoryAlignment,
    
    // Velocity functions
    calculateVelocityMetrics,
    
    // MACC functions
    generateMACCData,
    rankMACCOpportunities,
    
    // Utility functions
    calculatePercentageChange,
    formatLargeNumber,
    groupEmissions,
    transformForPareto,
    calculateDrillDown,
    
    // Insight generation
    generateParetoInsights,
    generateMigrationInsights,
    
    // Validation
    validateAnalysisData
  };