// backend/models/ActivityLog.js - MongoDB Activity Log Schema
const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'User ID is required'],
    ref: 'User',
    index: true
  },
  action: {
    type: String,
    required: [true, 'Action is required']
  },
  resource_type: String,
  resource_id: String,
  details: mongoose.Schema.Types.Mixed,
  ip_address: String,
  user_agent: String,
  created_at: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false }
});

// Indexes
activityLogSchema.index({ user_id: 1, created_at: -1 });
activityLogSchema.index({ action: 1 });
activityLogSchema.index({ resource_type: 1 });
activityLogSchema.index({ created_at: -1 });

// TTL index - auto-delete logs older than 90 days (optional)
activityLogSchema.index({ created_at: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

module.exports = mongoose.model('ActivityLog', activityLogSchema);
