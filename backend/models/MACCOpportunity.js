// backend/models/MACCOpportunity.js - MongoDB MACC Opportunity Schema
const mongoose = require('mongoose');

const maccOpportunitySchema = new mongoose.Schema({
  organisation_id: {
    type: String,
    required: [true, 'Organisation ID is required'],
    ref: 'Organisation',
    index: true
  },
  name: {
    type: String,
    required: [true, 'Name is required']
  },
  category: {
    type: String,
    required: [true, 'Category is required']
  },
  scope: {
    type: Number,
    min: 1,
    max: 3
  },
  cost_per_tCO2e: {
    type: Number,
    required: [true, 'Cost per tCO2e is required']
  },
  reduction_potential: {
    type: Number,
    required: [true, 'Reduction potential is required'],
    min: 0
  },
  payback_period: Number,
  implementation_status: {
    type: String,
    enum: ['proposed', 'approved', 'in_progress', 'completed', 'rejected'],
    default: 'proposed'
  },
  notes: String,
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Indexes
maccOpportunitySchema.index({ organisation_id: 1 });
maccOpportunitySchema.index({ cost_per_tCO2e: 1 });
maccOpportunitySchema.index({ scope: 1 });

module.exports = mongoose.model('MACCOpportunity', maccOpportunitySchema);
