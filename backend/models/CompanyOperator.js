// backend/models/CompanyOperator.js - MongoDB Company Operator Schema
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const companyOperatorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    select: false
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
    default: true
  },
  last_login: Date,
  failed_login_attempts: {
    type: Number,
    default: 0
  },
  locked_until: Date,
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CompanyOperator'
  },
  notes: String,
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Hash password before saving
companyOperatorSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
companyOperatorSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Don't return password in JSON
companyOperatorSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('CompanyOperator', companyOperatorSchema);
