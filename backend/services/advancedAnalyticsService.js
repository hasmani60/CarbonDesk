// backend/services/advancedAnalyticsService.js - MongoDB Version
const mongoose = require('mongoose');
const Emission = require('../models/Emission');
const MACCOpportunity = require('../models/MACCOpportunity');

class AdvancedAnalyticsService {
  
  /**
   * Calculate emissions trajectory with science-based targets
   */
  async calculateEmissionsTrajectory(params) {
    const { startDate, endDate, organisationId, targetScenario = '1.5C' } = params;
    
    const historical = await this.getHistoricalEmissions(startDate, endDate, organisationId);
    
    if (historical.length === 0) {
      return {
        historical: [],
        targets: { '1.5C': [], '2C': [] },
        metrics: { pace: 'insufficient_data', on_track: false }
      };
    }
    
    const baseline = {
      date: historical[0].date,
      emissions: historical[0].emissions
    };
    
    const targets = this.generateTargetPathways(baseline, startDate, endDate);
    const metrics = this.calculateTrajectoryMetrics(historical, targets[targetScenario], targetScenario);
    
    return {
      historical,
      targets,
      metrics,
      baseline
    };
  }
  
  /**
   * Get historical emissions aggregated by month from MongoDB
   */
  async getHistoricalEmissions(startDate, endDate, organisationId) {
    try {
      const result = await Emission.aggregate([
        {
          $match: {
            organisation_id: organisationId,
            date: {
              $gte: new Date(startDate),
              $lte: new Date(endDate)
            },
            status: { $ne: 'rejected' }
          }
        },
        {
          $project: {
            yearMonth: {
              $dateToString: { format: '%Y-%m', date: '$date' }
            },
            emissions: {
              $ifNull: ['$co2e', { $ifNull: ['$totalEmissions', 0] }]
            }
          }
        },
        {
          $group: {
            _id: '$yearMonth',
            emissions: { $sum: '$emissions' }
          }
        },
        {
          $sort: { _id: 1 }
        },
        {
          $project: {
            _id: 0,
            date: '$_id',
            emissions: { $round: ['$emissions', 2] }
          }
        }
      ]);
      
      return result;
    } catch (error) {
      console.error('Error fetching historical emissions:', error);
      throw error;
    }
  }
  
  /**
   * Generate science-based target pathways
   */
  generateTargetPathways(baseline, startDate, endDate) {
    const pathways = { '1.5C': [], '2C': [] };
    const reductionRates = { '1.5C': 0.042, '2C': 0.029 };
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const baselineEmissions = baseline.emissions;
    
    for (let date = new Date(start); date <= end; date.setMonth(date.getMonth() + 1)) {
      const monthsFromBaseline = (date.getFullYear() - start.getFullYear()) * 12 + 
                                  (date.getMonth() - start.getMonth());
      const yearsFromBaseline = monthsFromBaseline / 12;
      const dateStr = date.toISOString().slice(0, 7);
      
      pathways['1.5C'].push({
        date: dateStr,
        emissions: parseFloat((baselineEmissions * Math.pow(1 - reductionRates['1.5C'], yearsFromBaseline)).toFixed(2))
      });
      
      pathways['2C'].push({
        date: dateStr,
        emissions: parseFloat((baselineEmissions * Math.pow(1 - reductionRates['2C'], yearsFromBaseline)).toFixed(2))
      });
    }
    
    return pathways;
  }
  
  /**
   * Calculate trajectory alignment metrics
   */
  calculateTrajectoryMetrics(historical, targetPath, scenario) {
    if (historical.length === 0 || targetPath.length === 0) {
      return {
        pace: 'insufficient_data',
        on_track: false,
        deviation_percent: 0,
        required_rate: 0,
        actual_rate: 0
      };
    }
    
    const latest = historical[historical.length - 1];
    const matchingTarget = targetPath.find(t => t.date === latest.date);
    
    if (!matchingTarget) {
      return {
        pace: 'no_matching_target',
        on_track: false,
        deviation_percent: 0,
        required_rate: scenario === '1.5C' ? 4.2 : 2.9,
        actual_rate: 0
      };
    }
    
    const deviation = ((latest.emissions - matchingTarget.emissions) / matchingTarget.emissions) * 100;
    
    const first = historical[0];
    const yearsElapsed = (new Date(latest.date) - new Date(first.date)) / (365.25 * 24 * 60 * 60 * 1000);
    const actualRate = yearsElapsed > 0 
      ? (((first.emissions - latest.emissions) / first.emissions) / yearsElapsed) * 100
      : 0;
    
    const requiredRate = scenario === '1.5C' ? 4.2 : 2.9;
    const onTrack = Math.abs(deviation) <= 10 && actualRate >= (requiredRate * 0.9);
    
    let pace;
    if (actualRate >= requiredRate) pace = 'on_pace';
    else if (actualRate >= requiredRate * 0.8) pace = 'slightly_behind';
    else pace = 'slower_than_required';
    
    return {
      pace,
      on_track: onTrack,
      deviation_percent: parseFloat(deviation.toFixed(2)),
      required_rate: requiredRate,
      actual_rate: parseFloat(actualRate.toFixed(2))
    };
  }
  
  /**
   * Calculate emissions velocity and acceleration
   */
  async calculateEmissionsVelocity(params) {
    const { startDate, endDate, organisationId } = params;
    const historical = await this.getHistoricalEmissions(startDate, endDate, organisationId);
    
    if (historical.length < 2) {
      return {
        velocity: { mom: 0, yoy: 0 },
        acceleration: { trend: 'insufficient_data', inflection_points: [] },
        periods: []
      };
    }
    
    const periods = [];
    const velocities = [];
    
    for (let i = 0; i < historical.length; i++) {
      const period = {
        date: historical[i].date,
        emissions: historical[i].emissions,
        velocity: null,
        acceleration: null,
        is_inflection: false
      };
      
      if (i > 0) {
        const prevEmissions = historical[i - 1].emissions;
        period.velocity = prevEmissions > 0 
          ? ((historical[i].emissions - prevEmissions) / prevEmissions) * 100
          : 0;
        velocities.push(period.velocity);
        
        if (i > 1 && velocities.length >= 2) {
          period.acceleration = period.velocity - velocities[velocities.length - 2];
          
          if ((velocities[velocities.length - 2] > 0 && period.velocity < 0) ||
              (velocities[velocities.length - 2] < 0 && period.velocity > 0)) {
            period.is_inflection = true;
          }
        }
      }
      
      periods.push(period);
    }
    
    const mom = velocities.length > 0 ? velocities[velocities.length - 1] : 0;
    
    let yoy = 0;
    if (historical.length >= 12) {
      const current = historical[historical.length - 1].emissions;
      const yearAgo = historical[historical.length - 12].emissions;
      yoy = yearAgo > 0 ? ((current - yearAgo) / yearAgo) * 100 : 0;
    }
    
    const recentAccelerations = periods
      .slice(-6)
      .filter(p => p.acceleration !== null)
      .map(p => p.acceleration);
    
    const avgAcceleration = recentAccelerations.length > 0
      ? recentAccelerations.reduce((sum, a) => sum + a, 0) / recentAccelerations.length
      : 0;
    
    let trend;
    if (avgAcceleration < -1) trend = 'decelerating';
    else if (avgAcceleration > 1) trend = 'accelerating';
    else trend = 'stable';
    
    const inflectionPoints = periods.filter(p => p.is_inflection).map(p => p.date);
    
    return {
      velocity: {
        mom: parseFloat(mom.toFixed(2)),
        yoy: parseFloat(yoy.toFixed(2))
      },
      acceleration: {
        trend,
        inflection_points: inflectionPoints,
        avg_acceleration: parseFloat(avgAcceleration.toFixed(2))
      },
      periods: periods.map(p => ({
        date: p.date,
        emissions: p.emissions,
        velocity: p.velocity !== null ? parseFloat(p.velocity.toFixed(2)) : null,
        acceleration: p.acceleration !== null ? parseFloat(p.acceleration.toFixed(2)) : null,
        is_inflection: p.is_inflection
      }))
    };
  }
  
  /**
   * Calculate Marginal Abatement Cost Curve
   */
  async calculateMACCAnalysis(params) {
    const { organisationId, scope, category } = params;
    const opportunities = await this.getMACCOpportunities(organisationId, scope, category);
    
    if (opportunities.length === 0) {
      return {
        opportunities: [],
        cumulative_reduction: 0,
        low_hanging_fruit: [],
        summary: {
          total_abatement_potential: 0,
          total_cost: 0,
          avg_cost_per_ton: 0,
          cost_effective_count: 0
        }
      };
    }
    
    const sorted = opportunities.sort((a, b) => a.cost_per_tCO2e - b.cost_per_tCO2e);
    
    let cumulative = 0;
    const enriched = sorted.map(opp => {
      cumulative += opp.reduction_potential;
      return { ...opp, cumulative_reduction: parseFloat(cumulative.toFixed(2)) };
    });
    
    const lowHangingFruit = sorted
      .filter(opp => opp.cost_per_tCO2e < 25)
      .map(opp => opp.name);
    
    const totalAbatement = opportunities.reduce((sum, o) => sum + o.reduction_potential, 0);
    const totalCost = opportunities.reduce((sum, o) => sum + (o.reduction_potential * o.cost_per_tCO2e), 0);
    const avgCost = totalAbatement > 0 ? totalCost / totalAbatement : 0;
    const costEffectiveCount = opportunities.filter(o => o.cost_per_tCO2e < 50).length;
    
    return {
      opportunities: enriched,
      cumulative_reduction: cumulative,
      low_hanging_fruit: lowHangingFruit,
      summary: {
        total_abatement_potential: parseFloat(totalAbatement.toFixed(2)),
        total_cost: parseFloat(totalCost.toFixed(2)),
        avg_cost_per_ton: parseFloat(avgCost.toFixed(2)),
        cost_effective_count: costEffectiveCount
      }
    };
  }
  
  /**
   * Get MACC opportunities from MongoDB
   */
  async getMACCOpportunities(organisationId, scope, category) {
    try {
      const query = { organisation_id: organisationId };
      
      if (scope) {
        query.scope = parseInt(scope);
      }
      
      if (category) {
        query.category = category;
      }
      
      const opportunities = await MACCOpportunity.find(query)
        .sort({ costPerTon: 1 })
        .lean();
      
      // Map MongoDB fields to expected format
      return opportunities.map(opp => ({
        id: opp._id.toString(),
        name: opp.name,
        category: opp.category,
        scope: opp.scope,
        cost_per_tCO2e: opp.costPerTon,
        reduction_potential: opp.abatementPotential,
        payback_period: opp.paybackPeriod,
        implementation_status: opp.status || 'proposed',
        notes: opp.description || opp.implementationNotes
      }));
    } catch (error) {
      console.error('Error fetching MACC opportunities:', error);
      throw error;
    }
  }
  
  /**
   * Save MACC opportunity to MongoDB
   */
  async saveMACCOpportunity(data) {
    try {
      const { organisationId, name, category, scope, cost_per_tCO2e, reduction_potential, payback_period, notes } = data;
      
      const opportunity = await MACCOpportunity.create({
        organisation_id: organisationId,
        name,
        category: category || 'General',
        scope: scope || null,
        costPerTon: cost_per_tCO2e,
        abatementPotential: reduction_potential,
        paybackPeriod: payback_period || null,
        status: 'planned',
        description: notes || null,
        createdBy: data.createdBy || data.userId
      });
      
      return {
        id: opportunity._id.toString(),
        ...data,
        created_at: opportunity.createdAt
      };
    } catch (error) {
      console.error('Error saving MACC opportunity:', error);
      throw error;
    }
  }
  
  /**
   * Delete MACC opportunity from MongoDB
   */
  async deleteMACCOpportunity(id, organisationId) {
    try {
      const result = await MACCOpportunity.deleteOne({
        _id: id,
        organisation_id: organisationId
      });
      
      return { deleted: result.deletedCount > 0 };
    } catch (error) {
      console.error('Error deleting MACC opportunity:', error);
      throw error;
    }
  }
}

module.exports = new AdvancedAnalyticsService();