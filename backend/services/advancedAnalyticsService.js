// backend/services/advancedAnalyticsService.js
const localDB = require('../database/localDB');

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
   * Get historical emissions aggregated by month
   * Uses same organization filtering as existing controllers
   */
  async getHistoricalEmissions(startDate, endDate, organisationId) {
    return new Promise((resolve, reject) => {
      // Match existing pattern: WHERE organisation_id = ?
      const query = `
        SELECT 
          strftime('%Y-%m', date) as date,
          SUM(co2e) as emissions
        FROM emissions
        WHERE organisation_id = ?
          AND date >= ?
          AND date <= ?
        GROUP BY strftime('%Y-%m', date)
        ORDER BY date ASC
      `;
      
      localDB.db.all(query, [organisationId, startDate, endDate], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
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
   * Get MACC opportunities from database
   */
  async getMACCOpportunities(organisationId, scope, category) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT 
          id, name, category, scope,
          cost_per_tCO2e, reduction_potential, payback_period,
          implementation_status, notes
        FROM macc_opportunities
        WHERE organisation_id = ?
      `;
      
      const params = [organisationId];
      
      if (scope) {
        query += ' AND scope = ?';
        params.push(scope);
      }
      
      if (category) {
        query += ' AND category = ?';
        params.push(category);
      }
      
      query += ' ORDER BY cost_per_tCO2e ASC';
      
      localDB.db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }
  
  /**
   * Save MACC opportunity
   */
  async saveMACCOpportunity(data) {
    const { organisationId, name, category, scope, cost_per_tCO2e, reduction_potential, payback_period, notes } = data;
    
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO macc_opportunities (
          organisation_id, name, category, scope, 
          cost_per_tCO2e, reduction_potential, payback_period, 
          implementation_status, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `;
      
      localDB.db.run(query, [
        organisationId, name, category || 'General', scope || null,
        cost_per_tCO2e, reduction_potential, payback_period || null,
        'proposed', notes || null
      ], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, ...data, created_at: new Date().toISOString() });
      });
    });
  }
  
  /**
   * Delete MACC opportunity
   */
  async deleteMACCOpportunity(id, organisationId) {
    return new Promise((resolve, reject) => {
      const query = 'DELETE FROM macc_opportunities WHERE id = ? AND organisation_id = ?';
      
      localDB.db.run(query, [id, organisationId], function(err) {
        if (err) reject(err);
        else resolve({ deleted: this.changes > 0 });
      });
    });
  }
}

module.exports = new AdvancedAnalyticsService();