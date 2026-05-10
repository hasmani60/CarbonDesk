// backend/models/Emission.js
const mongoose = require('mongoose');

const emissionSchema = new mongoose.Schema({
  scope: {
    type: Number,
    required: true,
    min: 1,
    max: 3,
    index: true
  },
  category: String,
  activity: {
    type: String,
    required: true,
    index: true
  },
  quantity: {
    type: Number,
    default: 0
  },
  unit: {
    type: String,
    default: 'kg'
  },
  co2e: {
    type: Number,
    default: 0
  },
  date: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'verified'],
    default: 'draft',
    index: true
  },
  notes: String,
  verified_by: {
    type: Number,
    ref: 'User'
  },
  verified_at: String,
  organisation_id: {
    type: String,
    required: true,
    index: true,
    ref: 'Organisation'
  },
  organisation_name: String,
  created_by: {
    type: Number,
    required: true,
    index: true,
    ref: 'User'
  },
  created_by_name: String
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Compound indexes for performance
emissionSchema.index({ organisation_id: 1, date: -1 });
emissionSchema.index({ organisation_id: 1, scope: 1 });
emissionSchema.index({ organisation_id: 1, activity: 1 });
emissionSchema.index({ organisation_id: 1, status: 1 });
emissionSchema.index({ created_by: 1, date: -1 });

// Unique constraint to prevent duplicates
emissionSchema.index(
  { organisation_id: 1, scope: 1, activity: 1, date: 1, co2e: 1, created_by: 1 },
  { unique: true, name: 'unique_emission_entry' }
);

module.exports = mongoose.model('Emission', emissionSchema);
