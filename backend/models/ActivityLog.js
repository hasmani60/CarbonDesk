// backend/models/ActivityLog.js
const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  user_id: {
    type: String,
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

module.exports = mongoose.model('ActivityLog', activityLogSchema);
