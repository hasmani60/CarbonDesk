// backend/models/Notification.js — persisted inbox per user / organisation
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient_id: {
      type: String,
      required: true,
      index: true
    },
    organisation_id: {
      type: String,
      required: true,
      index: true
    },
    type: { type: String, default: 'info' },
    title: { type: String, required: true },
    message: { type: String, default: '' },
    read: { type: Boolean, default: false, index: true },
    read_at: { type: Date, default: null },
    actor_user_id: { type: String, default: null },
    actor_name: { type: String, default: null },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    },
    deadline: { type: String, default: null },
    data: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

notificationSchema.index({
  organisation_id: 1,
  recipient_id: 1,
  created_at: -1
});

module.exports = mongoose.model('Notification', notificationSchema);
