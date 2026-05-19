// backend/models/Task.js
const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  assigned_to: {
    type: Number,
    required: true,
    index: true,
    ref: 'User'
  },
  assigned_by: {
    type: Number,
    required: true,
    index: true,
    ref: 'User'
  },
  assigned_to_name: String,
  assigned_by_name: String,
  scope: {
    type: Number,
    required: true,
    min: 1,
    max: 3,
    index: true
  },
  activity: {
    type: String,
    required: true
  },
  source: String,
  start_date: {
    type: String,
    required: true
  },
  end_date: {
    type: String,
    required: true
  },
  deadline: {
    type: String,
    required: true,
    index: true
  },
  comments: String,
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'cancelled'],
    default: 'pending',
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  organisation_id: {
    type: String,
    required: true,
    index: true,
    ref: 'Organisation'
  },
  completed_at: Date
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Compound indexes
taskSchema.index({ organisation_id: 1, assigned_to: 1 });
taskSchema.index({ organisation_id: 1, status: 1 });
taskSchema.index({ organisation_id: 1, deadline: 1 });

module.exports = mongoose.model('Task', taskSchema);

// backend/models/CompanyOperator.js
const companyOperatorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['operator', 'super_operator'],
    default: 'operator'
  },
  can_create_orgs: {
    type: Boolean,
    default: true
  },
  can_manage_orgs: {
    type: Boolean,
    default: true
  },
  can_view_all_orgs: {
    type: Boolean,
    default: true
  },
  is_active: {
    type: Boolean,
    default: true,
    index: true
  },
  last_login: Date,
  failed_login_attempts: {
    type: Number,
    default: 0
  },
  locked_until: Date,
  created_by: Number,
  notes: String
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

const CompanyOperator = mongoose.model('CompanyOperator', companyOperatorSchema);

// backend/models/OrganisationSettings.js
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

const OrganisationSettings = mongoose.model('OrganisationSettings', organisationSettingsSchema);

// backend/models/ActivityLog.js
const activityLogSchema = new mongoose.Schema({
  user_id: {
    type: Number,
    required: true,
    index: true,
    ref: 'User'
  },
  action: {
    type: String,
    required: true,
    index: true
  },
  resource_type: String,
  resource_id: String,
  details: String,
  ip_address: String,
  user_agent: String
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false }
});

activityLogSchema.index({ user_id: 1, created_at: -1 });
activityLogSchema.index({ action: 1, created_at: -1 });

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

// backend/models/MACCOpportunity.js
const maccOpportunitySchema = new mongoose.Schema({
  organisation_id: {
    type: String,
    required: true,
    index: true,
    ref: 'Organisation'
  },
  name: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  scope: {
    type: Number,
    min: 1,
    max: 3
  },
  cost_per_tCO2e: {
    type: Number,
    required: true
  },
  reduction_potential: {
    type: Number,
    required: true
  },
  payback_period: Number,
  implementation_status: {
    type: String,
    enum: ['proposed', 'in_progress', 'implemented', 'rejected'],
    default: 'proposed'
  },
  notes: String
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

maccOpportunitySchema.index({ organisation_id: 1, cost_per_tCO2e: 1 });

const MACCOpportunity = mongoose.model('MACCOpportunity', maccOpportunitySchema);

module.exports = { CompanyOperator, OrganisationSettings, ActivityLog, MACCOpportunity };
