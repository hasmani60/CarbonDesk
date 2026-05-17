const mongoose = require('mongoose');

const PRODUCTION_UNITS = ['kg', 'tonnes', 'units', 'litres', 'm3', 'kWh', 'other'];

const productionRecordSchema = new mongoose.Schema(
  {
    organisation_id: {
      type: String,
      required: true,
      index: true,
      ref: 'Organisation'
    },
    product_name: {
      type: String,
      required: true,
      trim: true
    },
    product_code: {
      type: String,
      trim: true,
      default: ''
    },
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    unit: {
      type: String,
      required: true,
      enum: PRODUCTION_UNITS,
      default: 'units'
    },
    /** Reporting month YYYY-MM */
    period_month: {
      type: String,
      required: true,
      index: true,
      match: /^\d{4}-\d{2}$/
    },
    notes: {
      type: String,
      trim: true,
      default: ''
    },
    created_by: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

productionRecordSchema.index({ organisation_id: 1, period_month: 1 });
productionRecordSchema.index({ organisation_id: 1, product_name: 1 });

module.exports = mongoose.model('ProductionRecord', productionRecordSchema);
module.exports.PRODUCTION_UNITS = PRODUCTION_UNITS;
