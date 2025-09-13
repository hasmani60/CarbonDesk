const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// User Model
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
    enum: ['admin', 'analyst', 'viewer', 'contributor'],
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
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

// Emission Model
const emissionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  scope: {
    type: Number,
    required: [true, 'Scope is required'],
    enum: [1, 2, 3]
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true
  },
  subcategory: {
    type: String,
    trim: true
  },
  activityType: {
    type: String,
    required: [true, 'Activity type is required'],
    trim: true
  },
  source: {
    type: String,
    required: [true, 'Source is required'],
    trim: true
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  unit: {
    type: String,
    required: [true, 'Unit is required'],
    enum: ['kg', 'tons', 'litres', 'kWh', 'km', 'hours']
  },
  emissionFactor: {
    type: Number,
    required: true,
    min: 0
  },
  totalEmissions: {
    type: Number,
    required: true,
    min: 0
  },
  accountingPeriod: {
    start: {
      type: Date,
      required: true
    },
    end: {
      type: Date,
      required: true
    }
  },
  location: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  attachments: [{
    filename: String,
    path: String,
    mimetype: String,
    size: Number
  }],
  verified: {
    type: Boolean,
    default: false
  },
  verifiedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  verificationDate: Date,
  status: {
    type: String,
    enum: ['draft', 'submitted', 'verified', 'rejected'],
    default: 'draft'
  }
}, {
  timestamps: true
});

// Calculate total emissions before saving
emissionSchema.pre('save', function(next) {
  this.totalEmissions = this.amount * this.emissionFactor;
  next();
});

const Emission = mongoose.model('Emission', emissionSchema);

// Activity Log Model
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
      'created_emission',
      'updated_emission',
      'deleted_emission',
      'verified_emission',
      'exported_data',
      'login',
      'logout',
      'profile_update'
    ]
  },
  resourceType: {
    type: String,
    enum: ['emission', 'user', 'vehicle', 'generator', 'report']
  },
  resourceId: {
    type: mongoose.Schema.ObjectId
  },
  details: {
    type: String,
    maxlength: 500
  },
  ipAddress: String,
  userAgent: String
}, {
  timestamps: true
});

const Activity = mongoose.model('Activity', activitySchema);

// Vehicle Model
const vehicleSchema = new mongoose.Schema({
  registrationNumber: {
    type: String,
    required: [true, 'Registration number is required'],
    unique: true,
    trim: true,
    uppercase: true
  },
  type: {
    type: String,
    required: [true, 'Vehicle type is required'],
    enum: ['car', 'truck', 'van', 'motorcycle', 'bus', 'other']
  },
  category: {
    type: String,
    enum: ['company', 'personal'],
    default: 'company'
  },
  make: {
    type: String,
    required: true,
    trim: true
  },
  model: {
    type: String,
    required: true,
    trim: true
  },
  year: {
    type: Number,
    required: true,
    min: 1900,
    max: new Date().getFullYear() + 1
  },
  fuelType: {
    type: String,
    required: true,
    enum: ['petrol', 'diesel', 'electric', 'hybrid', 'cng', 'lpg']
  },
  engineSize: {
    type: Number,
    min: 0
  },
  mileage: {
    type: Number,
    min: 0,
    required: [true, 'Mileage is required']
  },
  owner: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  driver: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance'],
    default: 'active'
  }
}, {
  timestamps: true
});

const Vehicle = mongoose.model('Vehicle', vehicleSchema);

// Generator Model
const generatorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Generator name is required'],
    trim: true
  },
  type: {
    type: String,
    required: [true, 'Generator type is required'],
    enum: ['diesel', 'natural_gas', 'solar', 'wind', 'hydro', 'coal']
  },
  capacity: {
    value: {
      type: Number,
      required: [true, 'Capacity value is required'],
      min: 0
    },
    unit: {
      type: String,
      required: true,
      enum: ['kW', 'MW', 'GW'],
      default: 'kW'
    }
  },
  location: {
    building: String,
    floor: String,
    room: String
  },
  manufacturer: String,
  model: String,
  serialNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  installationDate: Date,
  lastMaintenanceDate: Date,
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance', 'decommissioned'],
    default: 'active'
  },
  efficiency: {
    type: Number,
    min: 0,
    max: 100
  },
  emissionFactor: {
    type: Number,
    required: true,
    min: 0
  }
}, {
  timestamps: true
});

const Generator = mongoose.model('Generator', generatorSchema);

// Organization Model
const organizationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Organization name is required'],
    trim: true
  },
  type: {
    type: String,
    enum: ['corporation', 'partnership', 'sole_proprietorship', 'non_profit'],
    default: 'corporation'
  },
  industry: {
    type: String,
    required: true
  },
  headquarters: {
    address: String,
    city: String,
    state: String,
    country: String,
    zipCode: String
  },
  facilities: [{
    name: String,
    type: {
      type: String,
      enum: ['headquarters', 'warehouse', 'factory', 'office', 'retail']
    },
    address: String,
    city: String,
    state: String,
    country: String,
    isMainOffice: Boolean,
    isWarehouse: Boolean
  }],
  boundary: {
    scopeDefinition: {
      type: String,
      default: 'All owned and controlled facilities within the controlled United States'
    },
    includedFacilities: [String],
    excludedFacilities: [String],
    reportingPeriod: {
      start: Date,
      end: Date
    }
  },
  settings: {
    fiscalYearStart: {
      type: Date,
      default: () => new Date(new Date().getFullYear(), 0, 1)
    },
    currency: {
      type: String,
      default: 'USD'
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    carbonUnits: {
      type: String,
      enum: ['kg', 'tons', 'tonnes'],
      default: 'tons'
    }
  }
}, {
  timestamps: true
});

const Organization = mongoose.model('Organization', organizationSchema);

// Notification Model
const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  sender: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  type: {
    type: String,
    required: true,
    enum: [
      'emission_submitted',
      'emission_verified',
      'emission_rejected',
      'task_assigned',
      'deadline_reminder',
      'system_update'
    ]
  },
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    maxlength: 1000
  },
  data: {
    type: mongoose.Schema.Types.Mixed
  },
  read: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  expiresAt: Date
}, {
  timestamps: true
});

const Notification = mongoose.model('Notification', notificationSchema);

// Task Model
const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    maxlength: 1000
  },
  assignedTo: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  assignedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  scope: {
    type: Number,
    enum: [1, 2, 3]
  },
  activityType: String,
  source: String,
  dueDate: {
    type: Date,
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  attachments: [{
    filename: String,
    path: String,
    mimetype: String,
    size: Number
  }],
  comments: [{
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    message: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

const Task = mongoose.model('Task', taskSchema);

module.exports = {
  User,
  Emission,
  Activity,
  Vehicle,
  Generator,
  Organization,
  Notification,
  Task
};