// backend/models/Emission.js - Enhanced MongoDB Emission Schema
const mongoose = require('mongoose');

const emissionSchema = new mongoose.Schema({
  // Core emission fields
  scope: {
    type: Number,
    required: [true, 'Scope is required'],
    min: 1,
    max: 3,
    index: true
  },
  category: {
    type: String,
    index: true
  },
  subcategory: String,
  activity: {
    type: String,
    required: [true, 'Activity is required'],
    index: true
  },
  activityType: String,
  source: String,
  
  // Quantity and measurement
  quantity: {
    type: Number,
    default: 0,
    min: 0
  },
  amount: {
    type: Number,
    default: 0,
    min: 0
  },
  unit: {
    type: String,
    default: 'kg'
  },
  
  // Calculated emissions
  co2e: {
    type: Number,
    default: 0,
    min: 0,
    index: true
  },
  totalEmissions: {
    type: Number,
    default: 0,
    min: 0
  },
  calculatedEmissions: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Gas breakdown (optional - for detailed tracking)
  co2: Number,
  ch4: Number,
  n2o: Number,
  emissions_co2: Number,
  emissions_ch4: Number,
  emissions_n2o: Number,
  
  // Emission factor details
  factor: Number,
  emissionFactor: {
    value: Number,
    unit: String,
    description: String,
    co2: Number,
    ch4: Number,
    n2o: Number
  },
  
  // Activity-specific data (flexible schema)
  activityData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Date and period information
  date: {
    type: Date,
    required: [true, 'Date is required'],
    index: true
  },
  startDate: Date,
  endDate: Date,
  accountingPeriod: {
    start: Date,
    end: Date
  },
  
  // Status and verification
  status: {
    type: String,
    enum: ['draft', 'submitted', 'verified', 'rejected'],
    default: 'draft',
    index: true
  },
  verified_by: {
    type: String, // Changed to String for compatibility with SQLite user IDs
    ref: 'User'
  },
  verified_at: Date,
  
  // Additional information
  location: String,
  description: String,
  notes: String,
  
  // Multi-tenant fields
  organisation_id: {
    type: String,
    required: [true, 'Organisation ID is required'],
    ref: 'Organisation',
    index: true
  },
  organisation_name: String,
  
  // User tracking
  user: {
    type: String, // Changed to String for compatibility with SQLite user IDs
    ref: 'User'
  },
  userName: String,
  
  // Audit fields
  created_by: {
    type: String, // Changed from ObjectId to String to support SQLite user IDs
    required: false,
    index: true
  },
  created_by_name: String,
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  // Allow flexible schema for additional fields
  strict: false
});

// Compound indexes for faster queries
emissionSchema.index({ organisation_id: 1, date: -1 });
emissionSchema.index({ organisation_id: 1, scope: 1 });
emissionSchema.index({ organisation_id: 1, status: 1 });
emissionSchema.index({ organisation_id: 1, category: 1 });
emissionSchema.index({ created_by: 1, date: -1 });

// Pre-save middleware to sync related fields
emissionSchema.pre('save', function(next) {
  // Sync user fields
  if (this.created_by && !this.user) {
    this.user = this.created_by;
  }

  if (this.created_by_name && !this.userName) {
    this.userName = this.created_by_name;
  }
  
  // Sync emission values
  if (this.co2e && !this.totalEmissions) {
    this.totalEmissions = this.co2e;
    this.calculatedEmissions = this.co2e;
  }
  
  // Sync dates
  if (this.date && !this.startDate) {
    this.startDate = this.date;
  }

  // Quantity / amount — API and Monitor use both; keep aligned on .save()
  if (this.quantity != null && this.quantity !== '') {
    this.amount = this.quantity;
  } else if (this.amount != null && this.amount !== '' && (this.quantity == null || this.quantity === '')) {
    this.quantity = this.amount;
  }

  next();
});

// Virtual for ID as string (for compatibility with frontend expecting 'id')
emissionSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

// Ensure virtuals are included in JSON output
emissionSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id.toString();
    return ret;
  }
});

emissionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Emission', emissionSchema);