const mongoose = require('mongoose');

const aiReportSchema = new mongoose.Schema(
  {
    organisation_id: {
      type: String,
      required: true,
      index: true
    },
    filters: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    reportContent: {
      type: String,
      default: null
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true
    },
    generatedAt: {
      type: Date,
      default: null
    },
    createdBy: {
      type: String,
      required: true,
      index: true
    },
    createdByName: String,
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    error: {
      type: String,
      default: null
    }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'aireports'
  }
);

aiReportSchema.index({ organisation_id: 1, created_at: -1 });
aiReportSchema.index({ organisation_id: 1, status: 1, created_at: -1 });

module.exports = mongoose.model('AIReport', aiReportSchema);
