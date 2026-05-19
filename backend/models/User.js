// backend/models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
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
    enum: ['admin', 'analyst', 'contributor', 'viewer'],
    default: 'contributor',
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'deleted'],
    default: 'active',
    index: true
  },
  organisation_id: {
    type: String,
    required: true,
    index: true,
    ref: 'Organisation'
  },
  restrictions: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  /** Phone, company, bio, notification toggles, locale prefs (Settings page) */
  settings: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  last_login: Date,

  /** When false, login may be blocked if REQUIRE_EMAIL_VERIFICATION=true (see auth). Legacy users often omit this field (treated as verified). */
  email_verified: {
    type: Boolean
  },
  email_verification_token: {
    type: String,
    default: null,
    select: false
  },
  email_verification_expires: {
    type: Date,
    default: null,
    select: false
  },
  password_reset_token: {
    type: String,
    default: null,
    select: false
  },
  password_reset_expires: {
    type: Date,
    default: null,
    select: false
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Compound indexes
userSchema.index({ organisation_id: 1, role: 1 });
userSchema.index({ organisation_id: 1, status: 1 });
userSchema.index({ email: 1, status: 1 });

module.exports = mongoose.model('User', userSchema);
