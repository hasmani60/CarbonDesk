// backend/models/CompanyOperator.js - FIXED to match actual MongoDB collection name
const mongoose = require('mongoose');

const companyOperatorSchema = new mongoose.Schema({
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
    enum: ['operator', 'super_operator'],
    default: 'operator'
  },
  can_create_orgs: {
    type: Boolean,
    default: true
  },
  can_manage_orgs: {
    type: Boolean,
    default: true
  },
  can_view_all_orgs: {
    type: Boolean,
    default: true
  },
  is_active: {
    type: Boolean,
    default: true,
    index: true
  },
  last_login: Date,
  failed_login_attempts: {
    type: Number,
    default: 0
  },
  locked_until: Date,
  created_by: Number,
  notes: String
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  collection: 'company_operators' // FIXED: Explicitly set collection name to match MongoDB
});

module.exports = mongoose.model('CompanyOperator', companyOperatorSchema);