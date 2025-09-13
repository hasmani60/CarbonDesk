// controllers/monitorController.js
const { Activity, Task, Emission, User } = require('../models');

// @desc    Get activities
// @route   GET /api/monitor/activities
// @access  Private
const getActivities = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 9,
      scope,
      search,
      status,
      startDate,
      endDate
    } = req.query;

    const query = {};

    if (scope && scope !== 'all') {
      // Find emissions with specific scope and get their IDs
      const emissions = await Emission.find({ scope: parseInt(scope) });
      const emissionIds = emissions.map(e => e._id);
      query.resourceId = { $in: emissionIds };
      query.resourceType = 'emission';
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (search) {
      query.$or = [
        { action: new RegExp(search, 'i') },
        { details: new RegExp(search, 'i') }
      ];
    }

    const activities = await Activity.find(query)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Activity.countDocuments(query);

    // Transform activities to match frontend format
    const transformedActivities = activities.map(activity => ({
      _id: activity._id,
      user: {
        name: activity.user.name,
        avatar: activity.user.name.split(' ').map(n => n[0]).join('')
      },
      scope: `Scope ${Math.floor(Math.random() * 3) + 1}`, // Placeholder
      activityType: activity.details || activity.action.replace('_', ' '),
      source: 'System generated',
      accountingPeriod: activity.createdAt.toLocaleDateString(),
      emissions: Math.floor(Math.random() * 1000),
      status: 'active',
      createdAt: activity.createdAt
    }));

    res.json({
      success: true,
      data: transformedActivities,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Create task
// @route   POST /api/monitor/tasks
// @access  Private
const createTask = async (req, res) => {
  try {
    const { userName, scope, source, activityType, startDate, endDate } = req.body;

    // Find user by name (in real app, you'd use user ID)
    const assignedUser = await User.findOne({ 
      name: new RegExp(userName.replace('_', ' '), 'i') 
    });

    if (!assignedUser) {
      return res.status(400).json({
        success: false,
        message: 'User not found'
      });
    }

    const task = await Task.create({
      title: `${activityType} - ${source}`,
      assignedTo: assignedUser._id,
      assignedBy: req.user.id,
      scope: parseInt(scope.replace('scope', '')),
      activityType,
      source,
      dueDate: new Date(endDate),
      status: 'pending'
    });

    await task.populate(['assignedTo', 'assignedBy'], 'name email');

    res.status(201).json({
      success: true,
      data: task
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get tasks
// @route   GET /api/monitor/tasks
// @access  Private
const getTasks = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      assignedTo
    } = req.query;

    const query = {};
    if (status && status !== 'all') query.status = status;
    if (assignedTo) query.assignedTo = assignedTo;

    const tasks = await Task.find(query)
      .populate(['assignedTo', 'assignedBy'], 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Task.countDocuments(query);

    res.json({
      success: true,
      data: tasks,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update task
// @route   PATCH /api/monitor/tasks/:id
// @access  Private
const updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check if user can update task
    if (task.assignedTo.toString() !== req.user.id && 
        task.assignedBy.toString() !== req.user.id && 
        req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this task'
      });
    }

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate(['assignedTo', 'assignedBy'], 'name email');

    res.json({
      success: true,
      data: updatedTask
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete task
// @route   DELETE /api/monitor/tasks/:id
// @access  Private
const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check permissions
    if (task.assignedBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this task'
      });
    }

    await task.deleteOne();

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Assign activity
// @route   POST /api/monitor/assign
// @access  Private
const assignActivity = async (req, res) => {
  try {
    const { userId, activityType, source, dueDate } = req.body;

    const task = await Task.create({
      title: `Assigned: ${activityType}`,
      description: `Complete ${activityType} with source: ${source}`,
      assignedTo: userId,
      assignedBy: req.user.id,
      activityType,
      source,
      dueDate: new Date(dueDate),
      status: 'pending'
    });

    await task.populate(['assignedTo', 'assignedBy'], 'name email');

    res.status(201).json({
      success: true,
      data: task
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getActivities,
  createTask,
  updateTask,
  deleteTask,
  getTasks,
  assignActivity
};