const mongoose = require('mongoose');

const emissionFactorSchema = new mongoose.Schema({
  scope: {
    type: Number,
    required: true,
    enum: [1, 2, 3]
  },
  category: {
    type: String,
    required: true,
    index: true
  },
  subcategory: {
    type: String,
    required: true,
    index: true
  },
  factor: {
    type: Number,
    required: true
  },
  unit: {
    type: String,
    required: true
  },
  co2: {
    type: Number,
    default: null
  },
  ch4: {
    type: Number,
    default: null
  },
  n2o: {
    type: Number,
    default: null
  },
  description: {
    type: String,
    default: ''
  },
  source: {
    type: String,
    default: 'UK Government GHG Conversion Factors'
  },
  year: {
    type: Number,
    default: 2023
  },
  isActive: {
    type: Boolean,
    default: true
  },
  organisation_id: {
    type: String,
    default: null,
    index: true
  }
}, {
  timestamps: true
});

// Global factors: unique per scope/category/subcategory when organisation_id is null
emissionFactorSchema.index(
  { scope: 1, category: 1, subcategory: 1, organisation_id: 1 },
  { unique: true }
);

module.exports = mongoose.model('EmissionFactor', emissionFactorSchema);
