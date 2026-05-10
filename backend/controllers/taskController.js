// controllers/taskController.js - MongoDB-compatible with ObjectId references
const { Task, User, ActivityLog } = require('../models');
const mongoose = require('mongoose');
const { contributorMaySubmitEmission } = require('../utils/contributorEmissionAccess');

// Helper to calculate days until deadline
const getDaysUntilDeadline = (deadline) => {
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diffTime = deadlineDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// @desc    Create new task
// @route   POST /api/tasks
// @access  Private (Admin only)
const createTask = async (req, res) => {
  try {
    const {
      assignedToUserId,
      scope,
      activity,
      source,
      startDate,
      endDate,
      deadline,
      comments,
      priority = 'medium'
    } = req.body;

    if (!assignedToUserId || !scope || !activity || !startDate || !endDate || !deadline) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    if (![1, 2, 3].includes(parseInt(scope))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid scope. Must be 1, 2, or 3'
      });
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(assignedToUserId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    // Get assignee user by MongoDB _id
    const assigneeUser = await User.findById(assignedToUserId);
    if (!assigneeUser) {
      return res.status(404).json({
        success: false,
        message: 'Assigned user not found'
      });
    }

    if (assigneeUser.organisation_id !== req.organisationId) {
      return res.status(403).json({
        success: false,
        message: 'Cannot assign tasks to users outside your organisation'
      });
    }

    // Check RBAC (same rules as emission create: scopes + granular activities)
    if (assigneeUser.role === 'contributor' && assigneeUser.restrictions) {
      const scopeNum = parseInt(scope, 10);
      const categoryKey =
        typeof activity === 'string' ? activity.trim() : String(activity ?? '').trim();
      const lineKey = source ? String(source).trim() : '';

      if (
        !contributorMaySubmitEmission(
          assigneeUser.restrictions,
          scopeNum,
          categoryKey,
          lineKey
        )
      ) {
        return res.status(400).json({
          success: false,
          message: `User ${assigneeUser.name} cannot be assigned Scope ${scopeNum}${
            categoryKey ? ` for activity "${categoryKey}"` : ''
          } with their current permissions`
        });
      }
    }

    const adminUser = await User.findById(req.user.id);

    // Create task with ObjectId references and Date objects
    const newTask = await Task.create({
      organisation_id: req.organisationId,
      assigned_to: assigneeUser._id,
      assigned_by: adminUser._id,
      scope: parseInt(scope),
      activity: activity.trim(),
      source: source ? source.trim() : null,
      start_date: new Date(startDate),
      end_date: new Date(endDate),
      deadline: new Date(deadline),
      comments: comments ? comments.trim() : null,
      priority: ['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'medium',
      status: 'pending'
    });

    // Populate user details
    await newTask.populate([
      { path: 'assigned_to', select: 'name email role' },
      { path: 'assigned_by', select: 'name email role' }
    ]);

    await ActivityLog.create({
      user_id: req.user.id,
      action: 'task_created',
      resource_type: 'task',
      resource_id: newTask._id.toString(),
      details: `Created task for ${assigneeUser.name}: ${activity} (Scope ${scope})`,
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    res.status(201).json({
      success: true,
      data: {
        _id: newTask._id.toString(),
        id: newTask._id.toString(),
        assigned_to: {
          _id: newTask.assigned_to._id.toString(),
          name: newTask.assigned_to.name,
          email: newTask.assigned_to.email,
          role: newTask.assigned_to.role
        },
        assigned_by: {
          _id: newTask.assigned_by._id.toString(),
          name: newTask.assigned_by.name,
          email: newTask.assigned_by.email,
          role: newTask.assigned_by.role
        },
        scope: newTask.scope,
        activity: newTask.activity,
        source: newTask.source,
        start_date: newTask.start_date.toISOString(),
        end_date: newTask.end_date.toISOString(),
        deadline: newTask.deadline.toISOString(),
        comments: newTask.comments,
        priority: newTask.priority,
        status: newTask.status,
        days_until_deadline: getDaysUntilDeadline(newTask.deadline),
        created_at: newTask.created_at,
        updated_at: newTask.updated_at
      },
      message: 'Task assigned successfully'
    });

  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create task'
    });
  }
};

// @desc    Get tasks
// @route   GET /api/tasks
// @access  Private
const getTasks = async (req, res) => {
  try {
    const {
      status,
      scope,
      search,
      start_date,
      end_date,
      limit,
      assigned_to
    } = req.query;

    const query = {
      organisation_id: req.organisationId
    };

    if (status && status !== 'all') {
      query.status = status;
    }

    if (scope && scope !== 'all') {
      query.scope = parseInt(scope);
    }

    if (search) {
      query.$or = [
        { activity: new RegExp(search, 'i') },
        { source: new RegExp(search, 'i') }
      ];
    }

    // Date filtering on Date objects
    if (start_date) {
      query.start_date = { $gte: new Date(start_date) };
    }

    if (end_date) {
      query.end_date = { $lte: new Date(end_date) };
    }

    // Role-based filtering
    if (req.user.role === 'admin') {
      if (assigned_to && assigned_to !== 'all') {
        if (mongoose.Types.ObjectId.isValid(assigned_to)) {
          query.assigned_to = new mongoose.Types.ObjectId(assigned_to);
        }
      }
    } else {
      // Non-admins see only their tasks
      query.assigned_to = new mongoose.Types.ObjectId(req.user.id);
    }

    let tasksQuery = Task.find(query)
      .populate('assigned_to', 'name email role')
      .populate('assigned_by', 'name email role')
      .sort({ deadline: 1, created_at: -1 });

    if (limit) {
      tasksQuery = tasksQuery.limit(parseInt(limit));
    }

    const tasks = await tasksQuery;

    // Transform tasks
    const transformedTasks = tasks.map(task => {
      const daysUntilDeadline = getDaysUntilDeadline(task.deadline);
      const isOverdue = daysUntilDeadline < 0 && task.status !== 'completed';

      return {
        _id: task._id.toString(),
        id: task._id.toString(),
        assigned_to: {
          _id: task.assigned_to._id.toString(),
          name: task.assigned_to.name,
          email: task.assigned_to.email,
          role: task.assigned_to.role
        },
        assigned_by: {
          _id: task.assigned_by._id.toString(),
          name: task.assigned_by.name,
          email: task.assigned_by.email,
          role: task.assigned_by.role
        },
        scope: task.scope,
        activity: task.activity,
        source: task.source,
        start_date: task.start_date.toISOString(),
        end_date: task.end_date.toISOString(),
        deadline: task.deadline.toISOString(),
        comments: task.comments,
        priority: task.priority,
        status: isOverdue && task.status !== 'completed' ? 'overdue' : task.status,
        display_status: isOverdue && task.status !== 'completed' ? 'overdue' : task.status,
        days_until_deadline: daysUntilDeadline,
        created_at: task.created_at,
        updated_at: task.updated_at
      };
    });

    res.json({
      success: true,
      data: transformedTasks,
      total: transformedTasks.length
    });

  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch tasks'
    });
  }
};

// @desc    Get task by ID
// @route   GET /api/tasks/:id
// @access  Private
const getTaskById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid task ID format'
      });
    }

    const task = await Task.findById(req.params.id)
      .populate('assigned_to', 'name email role')
      .populate('assigned_by', 'name email role');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    if (task.organisation_id !== req.organisationId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this task'
      });
    }

    // Check if non-admin can access
    if (req.user.role !== 'admin' && task.assigned_to._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only view your own tasks'
      });
    }

    const daysUntilDeadline = getDaysUntilDeadline(task.deadline);
    const isOverdue = daysUntilDeadline < 0 && task.status !== 'completed';

    res.json({
      success: true,
      data: {
        _id: task._id.toString(),
        id: task._id.toString(),
        assigned_to: {
          _id: task.assigned_to._id.toString(),
          name: task.assigned_to.name,
          email: task.assigned_to.email,
          role: task.assigned_to.role
        },
        assigned_by: {
          _id: task.assigned_by._id.toString(),
          name: task.assigned_by.name,
          email: task.assigned_by.email,
          role: task.assigned_by.role
        },
        scope: task.scope,
        activity: task.activity,
        source: task.source,
        start_date: task.start_date.toISOString(),
        end_date: task.end_date.toISOString(),
        deadline: task.deadline.toISOString(),
        comments: task.comments,
        priority: task.priority,
        status: task.status,
        display_status: isOverdue ? 'overdue' : task.status,
        days_until_deadline: daysUntilDeadline,
        created_at: task.created_at,
        updated_at: task.updated_at
      }
    });

  } catch (error) {
    console.error('Get task by ID error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch task'
    });
  }
};

// @desc    Update task
// @route   PATCH /api/tasks/:id
// @access  Private
const updateTask = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid task ID format'
      });
    }

    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    if (task.organisation_id !== req.organisationId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this task'
      });
    }

    // Check permissions
    if (req.user.role !== 'admin' && task.assigned_to.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own tasks'
      });
    }

    const updates = req.body;
    const allowedUpdates = ['status', 'comments', 'priority', 'deadline', 'start_date', 'end_date'];
    
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key) && updates[key] !== undefined) {
        // Convert date strings to Date objects
        if (['deadline', 'start_date', 'end_date'].includes(key)) {
          task[key] = new Date(updates[key]);
        } else {
          task[key] = updates[key];
        }
      }
    });

    // Mark as completed if status is completed
    if (updates.status === 'completed' && !task.completed_at) {
      task.completed_at = new Date();
    }

    task.updated_at = new Date();
    await task.save();

    // Populate user details for response
    await task.populate([
      { path: 'assigned_to', select: 'name email role' },
      { path: 'assigned_by', select: 'name email role' }
    ]);

    await ActivityLog.create({
      user_id: req.user.id,
      action: 'task_updated',
      resource_type: 'task',
      resource_id: req.params.id,
      details: `Updated task: ${task.activity}`,
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    res.json({
      success: true,
      data: {
        _id: task._id.toString(),
        id: task._id.toString(),
        assigned_to: {
          _id: task.assigned_to._id.toString(),
          name: task.assigned_to.name,
          email: task.assigned_to.email,
          role: task.assigned_to.role
        },
        assigned_by: {
          _id: task.assigned_by._id.toString(),
          name: task.assigned_by.name,
          email: task.assigned_by.email,
          role: task.assigned_by.role
        },
        scope: task.scope,
        activity: task.activity,
        source: task.source,
        start_date: task.start_date.toISOString(),
        end_date: task.end_date.toISOString(),
        deadline: task.deadline.toISOString(),
        comments: task.comments,
        priority: task.priority,
        status: task.status,
        days_until_deadline: getDaysUntilDeadline(task.deadline),
        created_at: task.created_at,
        updated_at: task.updated_at
      },
      message: 'Task updated successfully'
    });

  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update task'
    });
  }
};

// @desc    Delete task
// @route   DELETE /api/tasks/:id
// @access  Private (Admin only)
const deleteTask = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid task ID format'
      });
    }

    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    if (task.organisation_id !== req.organisationId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this task'
      });
    }

    await Task.findByIdAndDelete(req.params.id);

    await ActivityLog.create({
      user_id: req.user.id,
      action: 'task_deleted',
      resource_type: 'task',
      resource_id: req.params.id,
      details: `Deleted task: ${task.activity}`,
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });

  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete task'
    });
  }
};

// @desc    Get task statistics
// @route   GET /api/tasks/stats
// @access  Private
const getTaskStats = async (req, res) => {
  try {
    const query = { organisation_id: req.organisationId };

    if (req.user.role !== 'admin') {
      query.assigned_to = new mongoose.Types.ObjectId(req.user.id);
    }

    const total = await Task.countDocuments(query);
    const pending = await Task.countDocuments({ ...query, status: 'pending' });
    const in_progress = await Task.countDocuments({ ...query, status: 'in_progress' });
    const completed = await Task.countDocuments({ ...query, status: 'completed' });

    // Overdue tasks
    const now = new Date();
    const overdueTasks = await Task.countDocuments({
      ...query,
      deadline: { $lt: now },
      status: { $ne: 'completed' }
    });

    res.json({
      success: true,
      data: {
        total,
        pending,
        in_progress,
        completed,
        overdue: overdueTasks
      }
    });

  } catch (error) {
    console.error('Get task stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch task statistics'
    });
  }
};

// @desc    Get assignable users
// @route   GET /api/tasks/assignable-users
// @access  Private (Admin only)
const getAssignableUsers = async (req, res) => {
  try {
    const users = await User.find({
      organisation_id: req.organisationId,
      status: 'active'
    }).select('name email role restrictions');

    const assignableUsers = users.map(user => ({
      id: user._id.toString(),
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      restrictions: user.restrictions
    }));

    res.json({
      success: true,
      data: assignableUsers
    });

  } catch (error) {
    console.error('Get assignable users error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch assignable users'
    });
  }
};

// @desc    Get tasks due soon
// @route   GET /api/tasks/due-soon
// @access  Private
const getTasksDueSoon = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const now = new Date();
    const daysAhead = new Date();
    daysAhead.setDate(daysAhead.getDate() + parseInt(days));

    const query = {
      organisation_id: req.organisationId,
      deadline: { $lte: daysAhead, $gte: now },
      status: { $ne: 'completed' }
    };

    if (req.user.role !== 'admin') {
      query.assigned_to = new mongoose.Types.ObjectId(req.user.id);
    }

    const tasks = await Task.find(query)
      .populate('assigned_to', 'name email')
      .sort({ deadline: 1 })
      .limit(10);

    const transformedTasks = tasks.map(task => ({
      _id: task._id.toString(),
      id: task._id.toString(),
      activity: task.activity,
      deadline: task.deadline.toISOString(),
      assigned_to: {
        _id: task.assigned_to._id.toString(),
        name: task.assigned_to.name,
        email: task.assigned_to.email
      },
      days_until_deadline: getDaysUntilDeadline(task.deadline),
      priority: task.priority,
      status: task.status
    }));

    res.json({
      success: true,
      data: transformedTasks
    });

  } catch (error) {
    console.error('Get tasks due soon error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch tasks due soon'
    });
  }
};

module.exports = {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  getTaskStats,
  getAssignableUsers,
  getTasksDueSoon
};