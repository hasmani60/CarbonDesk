// models/index.js - Enhanced User Model with proper RBAC
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// User Model with enhanced role-based access control
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot be more than 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please enter a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  role: {
    type: String,
    enum: {
      values: ['admin', 'analyst', 'contributor', 'viewer'],
      message: 'Role must be one of: admin, analyst, contributor, viewer'
    },
    default: 'contributor'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  avatar: {
    type: String,
    default: ''
  },
  lastLogin: {
    type: Date
  },
  organization: {
    type: mongoose.Schema.ObjectId,
    ref: 'Organization'
  },
  // Role-based permissions (computed field)
  permissions: {
    type: Object,
    default: function() {
      return getRolePermissions(this.role);
    }
  },
  // Profile information
  phone: String,
  company: String,
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters']
  },
  // Security fields
  passwordChangedAt: Date,
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  this.password = await bcrypt.hash(this.password, 12);
  this.passwordChangedAt = Date.now() - 1000; // Ensure JWT is always created after password change
  next();
});

// Update permissions when role changes
userSchema.pre('save', function(next) {
  if (this.isModified('role')) {
    this.permissions = getRolePermissions(this.role);
  }
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Check if password was changed after JWT was issued
userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Check if user has specific permission
userSchema.methods.hasPermission = function(permission) {
  return this.permissions && this.permissions[permission] === true;
};

// Check if user can access resource
userSchema.methods.canAccess = function(resource, action = 'read') {
  const key = `${resource}_${action}`;
  return this.hasPermission(key);
};

// Virtual for account lock status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

const User = mongoose.model('User', userSchema);

// Role-based permissions configuration
function getRolePermissions(role) {
  const permissions = {
    // Admin - Full access to everything
    admin: {
      // User management
      users_read: true,
      users_create: true,
      users_update: true,
      users_delete: true,
      users_manage_roles: true,
      
      // Emissions
      emissions_read: true,
      emissions_create: true,
      emissions_update: true,
      emissions_delete: true,
      emissions_verify: true,
      emissions_read_all: true,
      
      // Analytics
      analytics_read: true,
      analytics_read_all: true,
      analytics_export: true,
      
      // System
      system_monitor: true,
      system_admin: true,
      system_settings: true,
      
      // Organizations
      organization_manage: true,
      
      // Vehicles & Generators
      vehicles_manage: true,
      generators_manage: true,
      
      // Tasks
      tasks_create: true,
      tasks_assign: true,
      tasks_manage_all: true
    },
    
    // Analyst - Data analysis and reporting
    analyst: {
      // Users (limited)
      users_read: true,
      
      // Emissions
      emissions_read: true,
      emissions_create: true,
      emissions_update: true,
      emissions_verify: true,
      emissions_read_team: true,
      
      // Analytics
      analytics_read: true,
      analytics_read_team: true,
      analytics_export: true,
      
      // System (limited)
      system_monitor: false,
      system_admin: false,
      
      // Tasks
      tasks_create: true,
      tasks_assign: true,
      tasks_manage_assigned: true
    },
    
    // Contributor - Data entry and own data management
    contributor: {
      // Users (very limited)
      users_read: false,
      
      // Emissions (own data only)
      emissions_read: true,
      emissions_create: true,
      emissions_update: true,
      emissions_read_own: true,
      
      // Analytics (limited)
      analytics_read: true,
      analytics_read_own: true,
      
      // Tasks
      tasks_view_assigned: true,
      tasks_update_assigned: true
    },
    
    // Viewer - Read-only access
    viewer: {
      // Emissions (read-only)
      emissions_read: true,
      emissions_read_own: true,
      
      // Analytics (read-only)
      analytics_read: true,
      analytics_read_own: true,
      
      // Tasks (read-only)
      tasks_view_assigned: true
    }
  };
  
  return permissions[role] || permissions.viewer;
}

// Enhanced Activity Schema - Remove audit log specific fields
const activitySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      // User actions
      'user_registered',
      'login',
      'logout',
      'profile_update',
      'password_change',
      
      // Emission actions
      'created_emission',
      'updated_emission',
      'deleted_emission',
      'verified_emission',
      
      // System actions
      'viewed_dashboard',
      'viewed_analytics',
      'viewed_monitor',
      'data_export',
      
      // Admin actions
      'admin_created_user',
      'admin_updated_user_role',
      'admin_updated_user_status',
      'admin_deleted_user',
      'admin_viewed_user_activities'
    ]
  },
  resourceType: {
    type: String,
    enum: ['emission', 'user', 'vehicle', 'generator', 'report', 'system']
  },
  resourceId: {
    type: mongoose.Schema.ObjectId
  },
  details: {
    type: String,
    maxlength: 500
  },
  ipAddress: String,
  userAgent: String,
  // Additional context for better tracking
  metadata: {
    browser: String,
    os: String,
    location: String,
    sessionId: String
  }
}, {
  timestamps: true
});

// Index for better query performance
activitySchema.index({ user: 1, createdAt: -1 });
activitySchema.index({ action: 1, createdAt: -1 });
activitySchema.index({ resourceType: 1, resourceId: 1 });

const Activity = mongoose.model('Activity', activitySchema);

// Keep other models the same...
// (Include Emission, Vehicle, Generator, etc. schemas here)

module.exports = {
  User,
  Activity,
  getRolePermissions
  // ... other models
};