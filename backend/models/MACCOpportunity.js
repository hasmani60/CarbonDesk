// backend/models/MACCOpportunity.js - MongoDB Model for MACC Opportunities

const mongoose = require('mongoose');

const maccOpportunitySchema = new mongoose.Schema({
  // Organization reference
  organisation_id: {
    type: String,
    required: true,
    index: true
  },

  // Opportunity details
  name: {
    type: String,
    required: true,
    trim: true
  },

  category: {
    type: String,
    required: true,
    enum: [
      'Energy Efficiency',
      'Renewable Energy',
      'Process Optimization',
      'Fuel Switching',
      'Waste Reduction',
      'Supply Chain',
      'Other'
    ]
  },

  // Emissions abatement
  abatementPotential: {
    type: Number,
    required: true,
    min: 0,
    comment: 'Annual abatement potential in tCO2e'
  },

  // Cost metrics
  costPerTon: {
    type: Number,
    required: true,
    comment: 'Cost per tCO2e abated (negative = savings, positive = cost)'
  },

  totalCost: {
    type: Number,
    required: true,
    comment: 'Total annual cost (abatementPotential * costPerTon)'
  },

  // Financial metrics
  paybackPeriod: {
    type: Number,
    min: 0,
    comment: 'Payback period in years (optional)'
  },

  // Priority classification
  priority: {
    type: String,
    required: true,
    enum: ['high', 'medium', 'low'],
    default: 'low'
  },

  // Additional information
  description: {
    type: String,
    trim: true
  },

  implementationStatus: {
    type: String,
    enum: ['planned', 'in-progress', 'completed', 'cancelled'],
    default: 'planned'
  },

  targetDate: {
    type: Date,
    comment: 'Target implementation date'
  },

  // Metadata
  createdBy: {
    type: String,
    comment: 'User ID who created this opportunity'
  },

  updatedBy: {
    type: String,
    comment: 'User ID who last updated this opportunity'
  }
}, {
  timestamps: true,
  collection: 'macc_opportunities'
});

// Indexes for performance
maccOpportunitySchema.index({ organisation_id: 1, category: 1 });
maccOpportunitySchema.index({ organisation_id: 1, priority: 1 });
maccOpportunitySchema.index({ organisation_id: 1, costPerTon: 1 });
maccOpportunitySchema.index({ organisation_id: 1, implementationStatus: 1 });

// Pre-save middleware to calculate totalCost if not provided
maccOpportunitySchema.pre('save', function(next) {
  if (this.isModified('abatementPotential') || this.isModified('costPerTon')) {
    this.totalCost = this.abatementPotential * this.costPerTon;
  }
  
  // Auto-set priority based on costPerTon if not explicitly set
  if (!this.priority || this.isNew) {
    if (this.costPerTon < 0) {
      this.priority = 'high'; // Negative cost = savings = high priority
    } else if (this.costPerTon < 50) {
      this.priority = 'medium'; // Low cost per ton
    } else {
      this.priority = 'low'; // High cost per ton
    }
  }
  
  next();
});

// Methods
maccOpportunitySchema.methods.calculateROI = function() {
  if (this.costPerTon >= 0 || !this.paybackPeriod) {
    return null; // No ROI for opportunities that cost money
  }
  
  const annualSavings = Math.abs(this.totalCost);
  const roi = (annualSavings / Math.abs(this.costPerTon)) * 100;
  return roi;
};

maccOpportunitySchema.methods.getAbatementPercentage = function(totalEmissions) {
  if (!totalEmissions || totalEmissions === 0) return 0;
  return (this.abatementPotential / totalEmissions) * 100;
};

// Statics
maccOpportunitySchema.statics.getOrganizationSummary = async function(organisation_id) {
  const opportunities = await this.find({ organisation_id });
  
  const summary = {
    totalOpportunities: opportunities.length,
    totalAbatementPotential: 0,
    totalCostSavings: 0,
    totalCosts: 0,
    netCost: 0,
    highPriorityCount: 0,
    mediumPriorityCount: 0,
    lowPriorityCount: 0,
    implementationStats: {
      planned: 0,
      'in-progress': 0,
      completed: 0,
      cancelled: 0
    }
  };
  
  opportunities.forEach(opp => {
    summary.totalAbatementPotential += opp.abatementPotential;
    
    if (opp.costPerTon < 0) {
      summary.totalCostSavings += Math.abs(opp.totalCost);
    } else {
      summary.totalCosts += opp.totalCost;
    }
    
    // Count by priority
    summary[`${opp.priority}PriorityCount`]++;
    
    // Count by implementation status
    summary.implementationStats[opp.implementationStatus]++;
  });
  
  summary.netCost = summary.totalCosts - summary.totalCostSavings;
  summary.averageCostPerTon = summary.totalAbatementPotential > 0
    ? summary.netCost / summary.totalAbatementPotential
    : 0;
  
  return summary;
};

maccOpportunitySchema.statics.getMACCCurveData = async function(organisation_id) {
  const opportunities = await this.find({ organisation_id })
    .sort({ costPerTon: 1 });
  
  let cumulativeAbatement = 0;
  
  const curveData = opportunities.map(opp => {
    cumulativeAbatement += opp.abatementPotential;
    
    return {
      name: opp.name,
      category: opp.category,
      costPerTon: opp.costPerTon,
      abatementPotential: opp.abatementPotential,
      cumulativeAbatement,
      priority: opp.priority
    };
  });
  
  return curveData;
};

const MACCOpportunity = mongoose.model('MACCOpportunity', maccOpportunitySchema);

module.exports = MACCOpportunity;