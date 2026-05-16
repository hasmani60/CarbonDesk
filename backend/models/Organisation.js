// backend/models/Organisation.js
const mongoose = require('mongoose');

const organisationSchema = new mongoose.Schema({
  _id: {
    type: String,  // Allow custom string _id instead of ObjectId
    required: true
  },
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  display_name: {
    type: String,
    required: true,
    trim: true
  },
  industry_type: {
    type: String,
    required: true
  },
  location: String,
  contact_email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  contact_phone: String,
  address: String,
  website: String,
  config: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  is_active: {
    type: Boolean,
    default: true,
    index: true
  },
  subscription_tier: {
    type: String,
    enum: ['basic', 'standard', 'premium'],
    default: 'standard'
  },
  max_users: {
    type: Number,
    default: 50
  },
  max_storage_gb: {
    type: Number,
    default: 10
  },
  /** Max AI carbon reports this organisation may generate (set by company operator). */
  max_ai_reports: {
    type: Number,
    default: 10,
    min: 0
  },
  registered_name: String,
  cin_number: String,
  registered_address: String,
  gst_number: String,
  current_employees: Number,
  created_by: String,
  notes: String,
  activated_at: Date,
  /** User id (string) of the bootstrap org admin created with the organisation (company ops can reset their password). */
  bootstrap_admin_user_id: {
    type: String,
    default: null,
    index: true
  },
  /** When the paid subscription period ends (used for renewal reminders). */
  subscription_expires_at: {
    type: Date,
    default: null,
    index: true
  },
  /** Set when the "60 days to expiry" (or SUBSCRIPTION_RENEWAL_REMINDER_DAYS) email was sent. */
  subscription_renewal_reminder_sent_at: {
    type: Date,
    default: null
  }
}, {
  _id: false,  // Disable auto _id generation
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Indexes for performance
organisationSchema.index({ is_active: 1, created_at: -1 });
organisationSchema.index({ industry_type: 1 });
organisationSchema.index({ contact_email: 1 });

module.exports = mongoose.model('Organisation', organisationSchema);