// backend/models/Task.js - MongoDB-compatible with ObjectId references
const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  assigned_to: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
    ref: 'User'
  },
  assigned_by: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
    ref: 'User'
  },
  scope: {
    type: Number,
    required: true,
    min: 1,
    max: 3,
    index: true
  },
  activity: {
    type: String,
    required: true
  },
  source: String,
  start_date: {
    type: Date,
    required: true
  },
  end_date: {
    type: Date,
    required: true
  },
  deadline: {
    type: Date,
    required: true,
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
    required: true,
    index: true,
    ref: 'Organisation'
  },
  completed_at: Date
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Compound indexes
taskSchema.index({ organisation_id: 1, assigned_to: 1 });
taskSchema.index({ organisation_id: 1, status: 1 });
taskSchema.index({ organisation_id: 1, deadline: 1 });

// Virtual for assignee details (populated)
taskSchema.virtual('assignee', {
  ref: 'User',
  localField: 'assigned_to',
  foreignField: '_id',
  justOne: true
});

// Virtual for assigner details (populated)
taskSchema.virtual('assigner', {
  ref: 'User',
  localField: 'assigned_by',
  foreignField: '_id',
  justOne: true
});

// Ensure virtuals are included in JSON
taskSchema.set('toJSON', { virtuals: true });
taskSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Task', taskSchema);