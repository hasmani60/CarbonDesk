const mongoose = require('mongoose');
const crypto = require('crypto');

const OFFSET_TYPES = ['pat_certificate', 'carbon_credit', 'rec', 'other'];
const OFFSET_UNITS = ['tco2e', 'pat_units', 'mwh', 'other'];
const OFFSET_STATUSES = ['active', 'partially_used', 'utilized', 'expired'];
const APPLICABLE_SCOPES = [1, 2, 3];

const activityLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    details: { type: String, default: '' },
    user_id: { type: String, default: '' },
    user_email: { type: String, default: '' }
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

const offsetOpportunitySchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: () => crypto.randomUUID(),
      unique: true,
      index: true
    },
    organisation_id: {
      type: String,
      required: true,
      index: true
    },
    offset_name: { type: String, required: true, trim: true },
    offset_type: {
      type: String,
      required: true,
      enum: OFFSET_TYPES
    },
    certificate_number: { type: String, required: true, trim: true },
    issuing_authority: { type: String, trim: true, default: '' },
    vintage_year: { type: Number, min: 1990, max: 2100 },
    expiry_date: { type: Date },
    reporting_year: { type: Number, required: true, min: 1990, max: 2100, index: true },
    applicable_scopes: {
      type: [Number],
      default: [],
      validate: {
        validator(scopes) {
          return scopes.every((s) => APPLICABLE_SCOPES.includes(s));
        },
        message: 'applicable_scopes must be 1, 2, and/or 3'
      }
    },
    total_quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true, enum: OFFSET_UNITS, default: 'tco2e' },
    status: {
      type: String,
      enum: OFFSET_STATUSES,
      default: 'active'
    },
    notes: { type: String, trim: true, default: '' },
    created_by: { type: String, default: '' },
    activity_log: [activityLogSchema],
    deleted_at: { type: Date, default: null, index: true }
  },
  { timestamps: true }
);

offsetOpportunitySchema.index(
  { organisation_id: 1, certificate_number: 1 },
  {
    unique: true,
    partialFilterExpression: { deleted_at: null }
  }
);

offsetOpportunitySchema.index({ organisation_id: 1, reporting_year: 1 });
offsetOpportunitySchema.index({ organisation_id: 1, status: 1 });

module.exports = mongoose.model('OffsetOpportunity', offsetOpportunitySchema);
module.exports.OFFSET_TYPES = OFFSET_TYPES;
module.exports.OFFSET_UNITS = OFFSET_UNITS;
module.exports.OFFSET_STATUSES = OFFSET_STATUSES;
module.exports.APPLICABLE_SCOPES = APPLICABLE_SCOPES;
