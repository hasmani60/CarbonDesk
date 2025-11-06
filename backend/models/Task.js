// backend/models/Task.js - MongoDB Task Schema
const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  assigned_to: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'Assigned to is required'],
    ref: 'User',
    index: true
  },
  assigned_by: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'Assigned by is required'],
    ref: 'User'
  },
  assigned_to_name: String,
  assigned_by_name: String,
  scope: {
    type: Number,
    required: [true, 'Scope is required'],
    min: 1,
    max: 3
  },
  activity: {
    type: String,
    required: [true, 'Activity is required']
  },
  source: String,
  start_date: {
    type: Date,
    required: [true, 'Start date is required']
  },
  end_date: {
    type: Date,
    required: [true, 'End date is required']
  },
  deadline: {
    type: Date,
    required: [true, 'Deadline is required'],
    index: true
  },
  comments: String,
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'cancelled'],
    default: 'pending',
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  organisation_id: {
    type: String,
    required: [true, 'Organisation ID is required'],
    ref: 'Organisation',
    index: true
  },
  completed_at: Date,
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

// Indexes for efficient queries
taskSchema.index({ assigned_to: 1, status: 1 });
taskSchema.index({ organisation_id: 1, deadline: 1 });
taskSchema.index({ scope: 1 });
taskSchema.index({ deadline: 1, status: 1 });

// Virtual for days until deadline
taskSchema.virtual('days_until_deadline').get(function() {
  const now = new Date();
  const diffTime = this.deadline - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for display status
taskSchema.virtual('display_status').get(function() {
  if (this.status === 'completed') return 'completed';
  if (this.status === 'cancelled') return 'cancelled';

  if (this.deadline < new Date()) return 'overdue';
  return this.status;
});

// Ensure virtuals are included in JSON
taskSchema.set('toJSON', { virtuals: true });
taskSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Task', taskSchema);
