const mongoose = require('mongoose');
const crypto = require('crypto');

const offsetUtilizationSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: () => crypto.randomUUID(),
      unique: true,
      index: true
    },
    organisation_id: { type: String, required: true, index: true },
    offset_id: { type: String, required: true, index: true },
    reporting_year: { type: Number, required: true, min: 1990, max: 2100, index: true },
    quantity_applied: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true },
    counts_toward_net: { type: Boolean, default: true },
    gross_emissions_at_apply: { type: Number, default: 0 },
    applied_by: { type: String, default: '' },
    notes: { type: String, trim: true, default: '' },
    deleted_at: { type: Date, default: null }
  },
  { timestamps: true }
);

offsetUtilizationSchema.index({ organisation_id: 1, reporting_year: 1 });
offsetUtilizationSchema.index({ offset_id: 1, deleted_at: 1 });

module.exports = mongoose.model('OffsetUtilization', offsetUtilizationSchema);
