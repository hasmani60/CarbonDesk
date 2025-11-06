// backend/models/Organisation.js - MongoDB Organisation Schema
const mongoose = require('mongoose');

const organisationSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Organisation name is required'],
    trim: true
  },
  display_name: {
    type: String,
    required: [true, 'Display name is required'],
    trim: true
  },
  industry_type: {
    type: String,
    required: [true, 'Industry type is required']
  },
  location: String,
  contact_email: {
    type: String,
    required: [true, 'Contact email is required'],
    lowercase: true
  },
  contact_phone: String,
  address: String,
  website: String,
  config: mongoose.Schema.Types.Mixed,
  is_active: {
    type: Boolean,
    default: true
  },
  subscription_tier: {
    type: String,
    enum: ['free', 'standard', 'premium', 'enterprise'],
    default: 'standard'
  },
  max_users: {
    type: Number,
    default: 50
  },
  max_storage_gb: {
    type: Number,
    default: 10
  },

  // Organisation Details
  registered_name: String,
  cin_number: String,
  registered_address: String,
  gst_number: String,
  current_employees: Number,

  created_by: String,
  notes: String,
  activated_at: Date,
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
organisationSchema.index({ id: 1 });
organisationSchema.index({ is_active: 1 });
organisationSchema.index({ industry_type: 1 });
organisationSchema.index({ subscription_tier: 1 });

// Generate organisation ID
organisationSchema.statics.generateOrgId = function(orgName) {
  const year = new Date().getFullYear();
  const prefix = orgName.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '') || 'ORG';
  const timestamp = Date.now().toString().slice(-6);
  return `ORG-${prefix}-${year}-${timestamp}`;
};

module.exports = mongoose.model('Organisation', organisationSchema);
