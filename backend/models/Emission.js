// backend/models/Emission.js - MongoDB Emission Schema
const mongoose = require('mongoose');

const emissionSchema = new mongoose.Schema({
  scope: {
    type: Number,
    required: [true, 'Scope is required'],
    min: 1,
    max: 3
  },
  category: String,
  activity: {
    type: String,
    required: [true, 'Activity is required']
  },
  quantity: {
    type: Number,
    default: 0,
    min: 0
  },
  unit: {
    type: String,
    default: 'kg'
  },
  co2e: {
    type: Number,
    default: 0,
    min: 0
  },
  date: {
    type: Date,
    required: [true, 'Date is required']
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'verified', 'rejected'],
    default: 'draft'
  },
  notes: String,
  verified_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verified_at: Date,

  // Multi-tenant fields
  organisation_id: {
    type: String,
    required: [true, 'Organisation ID is required'],
    ref: 'Organisation',
    index: true
  },
  organisation_name: String,

  // Audit fields
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'Created by is required'],
    ref: 'User'
  },
  created_by_name: String,
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

// Indexes for faster queries
emissionSchema.index({ organisation_id: 1 });
emissionSchema.index({ created_by: 1 });
emissionSchema.index({ date: 1 });
emissionSchema.index({ scope: 1 });
emissionSchema.index({ status: 1 });
emissionSchema.index({ organisation_id: 1, date: -1 });
emissionSchema.index({ organisation_id: 1, scope: 1 });

module.exports = mongoose.model('Emission', emissionSchema);
