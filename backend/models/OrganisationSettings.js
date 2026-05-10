// backend/models/OrganisationSettings.js
const mongoose = require('mongoose');

const organisationSettingsSchema = new mongoose.Schema({
  organisation_id: {
    type: String,
    required: true,
    unique: true,
    index: true,
    ref: 'Organisation'
  },
  logo_url: String,
  primary_color: {
    type: String,
    default: '#10b981'
  },
  secondary_color: {
    type: String,
    default: '#059669'
  },
  default_reporting_period: {
    type: String,
    enum: ['monthly', 'quarterly', 'yearly'],
    default: 'monthly'
  },
  fiscal_year_start: {
    type: String,
    default: '01-01'
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  currency: {
    type: String,
    default: 'USD'
  },
  emission_factors_version: {
    type: String,
    default: 'latest'
  },
  calculation_methodology: {
    type: String,
    default: 'GHG_Protocol'
  },
  features_enabled: {
    type: [String],
    default: ['analytics', 'reporting']
  },
  notification_settings: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  data_retention_days: {
    type: Number,
    default: 365
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('OrganisationSettings', organisationSettingsSchema);
