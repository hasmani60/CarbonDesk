const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true
    },
    content: {
      type: String,
      required: true
    }
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

const analyticsChatSchema = new mongoose.Schema(
  {
    organisation_id: {
      type: String,
      required: true,
      index: true
    },
    title: {
      type: String,
      default: 'Analytics chat'
    },
    filters: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    /** Cached prepare-data payload for OpenRouter context */
    contextData: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    contextRefreshedAt: {
      type: Date,
      default: null
    },
    messages: {
      type: [messageSchema],
      default: []
    },
    createdBy: {
      type: String,
      required: true,
      index: true
    },
    createdByName: String
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    collection: 'analyticschats'
  }
);

analyticsChatSchema.index({ organisation_id: 1, created_at: -1 });

module.exports = mongoose.model('AnalyticsChat', analyticsChatSchema);
