// backend/controllers/taskController.js
// Complete Task Management Controller with RBAC

const localDB = require('../database/localDB');
const { scopeQuery, addOrganisationToData } = require('../middleware/organisationScope');

// @desc    Create new task (Admin only)
// @route   POST /api/tasks
// @access  Private (Admin only)
const createTask = async (req, res) => {
  try {
    console.log('📋 Creating task by admin:', req.user.email);
    console.log('📦 Request body:', JSON.stringify(req.body, null, 2));
    
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
    
    // Validate required fields
    if (!assignedToUserId || !scope || !activity || !startDate || !endDate || !deadline) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: assignedToUserId, scope, activity, startDate, endDate, deadline are required'
      });
    }
    
    // Validate scope
    if (![1, 2, 3].includes(parseInt(scope))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid scope. Must be 1, 2, or 3'
      });
    }
    
    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    const due = new Date(deadline);
    const now = new Date();
    
    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: 'Start date must be before end date'
      });
    }
    
    if (due < now) {
      return res.status(400).json({
        success: false,
        message: 'Deadline cannot be in the past'
      });
    }
    
    // Get assignee user info to verify they exist and are in same organisation
    const assigneeUser = await localDB.findUserById(assignedToUserId);
    if (!assigneeUser) {
      return res.status(404).json({
        success: false,
        message: 'Assigned user not found'
      });
    }
    
    // Verify assignee is in same organisation
    if (assigneeUser.organisation_id !== req.organisationId) {
      return res.status(403).json({
        success: false,
        message: 'Cannot assign tasks to users outside your organisation'
      });
    }
    
    // Verify assignee can handle the specified scope (check their restrictions)
    if (assigneeUser.role === 'contributor' && assigneeUser.restrictions) {
      const { allowedScopes, allowedActivities } = assigneeUser.restrictions;
      
      // Check scope access
      if (allowedScopes && allowedScopes.length > 0) {
        if (!allowedScopes.includes(parseInt(scope))) {
          return res.status(400).json({
            success: false,
            message: `User ${assigneeUser.name} does not have access to Scope ${scope}`
          });
        }
      }
      
      // Check activity access
      if (allowedActivities && allowedActivities.length > 0) {
        if (!allowedActivities.includes(activity)) {
          return res.status(400).json({
            success: false,
            message: `User ${assigneeUser.name} does not have access to activity: ${activity}`
          });
        }
      }
    }
    
    // Prepare task data with organisation context
    const taskData = addOrganisationToData(req, {
      assigned_to: parseInt(assignedToUserId),
      assigned_by: req.user.id,
      assigned_to_name: assigneeUser.name,
      assigned_by_name: req.user.name,
      scope: parseInt(scope),
      activity: activity.trim(),
      source: source ? source.trim() : null,
      start_date: startDate,
      end_date: endDate,
      deadline: deadline,
      comments: comments ? comments.trim() : null,
      priority: ['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'medium',
      status: 'pending'
    });
    
    console.log('🔐 Creating task with data:', {
      assigned_to: taskData.assigned_to,
      assigned_by: taskData.assigned_by,
      scope: taskData.scope,
      activity: taskData.activity,
      organisation_id: taskData.organisation_id
    });
    
    // Create task
    const newTask = await localDB.createTask(taskData);
    
    // Log activity
    await localDB.logActivity({
      userId: req.user.id,
      action: 'task_created',
      resourceType: 'task',
      resourceId: newTask.id,
      details: `Created task for ${assigneeUser.name}: ${activity} (Scope ${scope})`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    console.log(`✅ Task created successfully: ID ${newTask.id}`);
    
    res.status(201).json({
      success: true,
      data: {
        ...newTask,
        display_status: 'pending',
        days_until_deadline: localDB.getDaysUntilDeadline(newTask.deadline)
      },
      message: 'Task assigned successfully'
    });
    
  } catch (error) {
    console.error('❌ Create task error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create task'
    });
  }
};

// @desc    Get tasks (filtered by role and organisation)
// @route   GET /api/tasks
// @access  Private
const getTasks = async (req, res) => {
    try {
      console.log('📋 Getting tasks for user:', req.user.email, 'role:', req.user.role);
      
      const {
        status,
        scope,
        search,
        start_date,
        end_date,
        limit,
        assigned_to
      } = req.query;
      
      console.log('📋 Query parameters:', { status, scope, search, limit, assigned_to });
      
      // Build filters with organisation context
      const filters = {
        organisation_id: req.organisationId,
        status: status || undefined,
        scope: scope || undefined,
        search: search || undefined,
        start_date: start_date || undefined,
        end_date: end_date || undefined,
        limit: limit ? parseInt(limit) : undefined,
        include_overdue_status: true
      };
      
      console.log('📋 Filters:', JSON.stringify(filters, null, 2));
      
      let tasks;
      
      if (req.user.role === 'admin') {
        // Admin can see all tasks in organisation or filter by user
        if (assigned_to) {
          // Verify the user exists and is in same organisation
          const targetUser = await localDB.findUserById(assigned_to);
          if (!targetUser || targetUser.organisation_id !== req.organisationId) {
            console.warn('❌ User not found or not in organisation:', assigned_to);
            return res.status(404).json({
              success: false,
              message: 'User not found or not in your organisation'
            });
          }
          
          console.log('📋 Admin viewing tasks for user:', assigned_to);
          tasks = await localDB.getUserTasks(assigned_to, filters);
        } else {
          console.log('📋 Admin viewing all organisation tasks');
          tasks = await localDB.getAllTasks(filters);
        }
      } else {
        // Contributors and others can only see their own tasks
        console.log('📋 Contributor viewing own tasks, user ID:', req.user.id);
        tasks = await localDB.getUserTasks(req.user.id, filters);
      }
      
      console.log(`✅ Found ${tasks.length} tasks for ${req.user.role}: ${req.user.email}`);
      
      // Log task IDs for verification
      if (tasks.length > 0) {
        console.log('📋 Task IDs:', tasks.map(t => ({ id: t.id, activity: t.activity, status: t.status })));
      }
      
      res.json({
        success: true,
        data: tasks,
        total: tasks.length,
        user_role: req.user.role,
        organisation: req.organisation?.name || 'N/A',
        filters: {
          status: filters.status,
          scope: filters.scope,
          search: filters.search,
          limit: filters.limit
        }
      });
      
    } catch (error) {
      console.error('❌ Get tasks error:', error);
      console.error('Stack:', error.stack);
      
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch tasks',
        error: process.env.NODE_ENV === 'development' ? error.toString() : undefined
      });
    }
  };

// @desc    Get task by ID
// @route   GET /api/tasks/:id
// @access  Private
const getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔍 Getting task:', id, 'for user:', req.user.email);
    
    const task = await localDB.getTaskById(id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    // Check access permissions
    const canAccess = (
      req.user.role === 'admin' && task.organisation_id === req.organisationId
    ) || (
      task.assigned_to === req.user.id
    );
    
    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this task'
      });
    }
    
    res.json({
      success: true,
      data: task
    });
    
  } catch (error) {
    console.error('❌ Get task by ID error:', error);
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
    const { id } = req.params;
    const updates = req.body;
    
    console.log('✏️ Updating task:', id, 'by user:', req.user.email);
    console.log('📦 Updates:', JSON.stringify(updates, null, 2));
    
    // Get existing task
    const task = await localDB.getTaskById(id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    // Check update permissions
    const canUpdate = (
      req.user.role === 'admin' && task.organisation_id === req.organisationId
    ) || (
      task.assigned_to === req.user.id // Contributors can update their own tasks
    );
    
    if (!canUpdate) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this task'
      });
    }
    
    // Validate updates based on role
    const allowedUpdates = {};
    
    if (req.user.role === 'admin') {
      // Admins can update most fields
      const adminAllowedFields = [
        'assigned_to', 'scope', 'activity', 'source', 
        'start_date', 'end_date', 'deadline', 'comments', 
        'status', 'priority'
      ];
      
      adminAllowedFields.forEach(field => {
        if (updates[field] !== undefined) {
          allowedUpdates[field] = updates[field];
        }
      });
      
      // If changing assignee, validate the new user
      if (updates.assigned_to && updates.assigned_to !== task.assigned_to) {
        const newAssignee = await localDB.findUserById(updates.assigned_to);
        if (!newAssignee || newAssignee.organisation_id !== req.organisationId) {
          return res.status(400).json({
            success: false,
            message: 'Invalid assignee or not in your organisation'
          });
        }
        allowedUpdates.assigned_to_name = newAssignee.name;
      }
      
    } else {
      // Contributors can only update status and add comments
      const contributorAllowedFields = ['status', 'comments'];
      
      contributorAllowedFields.forEach(field => {
        if (updates[field] !== undefined) {
          allowedUpdates[field] = updates[field];
        }
      });
    }
    
    // Validate status transitions
    if (allowedUpdates.status) {
      const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
      if (!validStatuses.includes(allowedUpdates.status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status'
        });
      }
    }
    
    // Validate dates if being updated
    if (allowedUpdates.start_date || allowedUpdates.end_date || allowedUpdates.deadline) {
      const startDate = new Date(allowedUpdates.start_date || task.start_date);
      const endDate = new Date(allowedUpdates.end_date || task.end_date);
      const deadline = new Date(allowedUpdates.deadline || task.deadline);
      
      if (startDate >= endDate) {
        return res.status(400).json({
          success: false,
          message: 'Start date must be before end date'
        });
      }
    }
    
    if (Object.keys(allowedUpdates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid updates provided'
      });
    }
    
    // Update task
    await localDB.updateTask(id, allowedUpdates);
    
    // Get updated task
    const updatedTask = await localDB.getTaskById(id);
    
    // Log activity
    const actionDetails = Object.keys(allowedUpdates).map(key => 
      `${key}: ${allowedUpdates[key]}`
    ).join(', ');
    
    await localDB.logActivity({
      userId: req.user.id,
      action: 'task_updated',
      resourceType: 'task',
      resourceId: id,
      details: `Updated task (${actionDetails})`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    console.log(`✅ Task ${id} updated successfully`);
    
    res.json({
      success: true,
      data: updatedTask,
      message: 'Task updated successfully'
    });
    
  } catch (error) {
    console.error('❌ Update task error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update task'
    });
  }
};

// @desc    Delete task (Admin only)
// @route   DELETE /api/tasks/:id
// @access  Private (Admin only)
const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🗑️ Deleting task:', id, 'by admin:', req.user.email);
    
    // Get task to verify access
    const task = await localDB.getTaskById(id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    // Check if user can delete (admin only, same organisation)
    if (task.organisation_id !== req.organisationId) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete tasks in your organisation'
      });
    }
    
    // Delete task
    await localDB.deleteTask(id);
    
    // Log activity
    await localDB.logActivity({
      userId: req.user.id,
      action: 'task_deleted',
      resourceType: 'task',
      resourceId: id,
      details: `Deleted task: ${task.activity} (assigned to ${task.assigned_to_name})`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    console.log(`✅ Task ${id} deleted successfully`);
    
    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ Delete task error:', error);
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
    console.log('📊 Getting task stats for user:', req.user.email, 'org:', req.organisationId);
    
    let stats;
    
    if (req.user.role === 'admin') {
      // Admin gets organisation-wide stats
      stats = await localDB.getTaskStats(req.organisationId);
    } else {
      // Contributors get their own stats
      stats = await localDB.getTaskStats(req.organisationId, req.user.id);
    }
    
    res.json({
      success: true,
      data: stats,
      user_role: req.user.role,
      organisation: req.organisation?.name || 'N/A'
    });
    
  } catch (error) {
    console.error('❌ Get task stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch task statistics'
    });
  }
};

// @desc    Get users available for task assignment (Admin only)
// @route   GET /api/tasks/assignable-users
// @access  Private (Admin only)
const getAssignableUsers = async (req, res) => {
    try {
      console.log('👥 Getting assignable users for org:', req.organisationId);
      
      // Get all active users in the organisation (excluding admin user)
      const users = await localDB.getAllUsers({
        status: 'active',
        organisation_id: req.organisationId
      });
      
      if (!users) {
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch users'
        });
      }
      
      // Filter to contributors and analysts (users who can be assigned tasks)
      const assignableUsers = users
        .filter(user => 
          ['contributor', 'analyst'].includes(user.role) && 
          user.id !== req.user.id // Don't include the admin themselves
        )
        .map(user => {
          // Parse restrictions if it's a string
          let restrictions = null;
          if (user.restrictions) {
            try {
              restrictions = typeof user.restrictions === 'string' 
                ? JSON.parse(user.restrictions) 
                : user.restrictions;
            } catch (e) {
              console.warn(`Failed to parse restrictions for user ${user.id}:`, e);
              restrictions = null;
            }
          }
          
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            restrictions: restrictions,
            allowedScopes: restrictions?.allowedScopes || [1, 2, 3],
            allowedActivities: restrictions?.allowedActivities || null
          };
        });
      
      console.log(`✅ Found ${assignableUsers.length} assignable users`);
      console.log('📋 Users:', assignableUsers.map(u => ({ id: u.id, name: u.name, role: u.role })));
      
      res.json({
        success: true,
        data: assignableUsers,
        total: assignableUsers.length,
        organisation: req.organisation?.name || 'N/A'
      });
      
    } catch (error) {
      console.error('❌ Get assignable users error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch assignable users'
      });
    }
  };
  
  module.exports = { getAssignableUsers };

// @desc    Get tasks due soon (for notifications)
// @route   GET /api/tasks/due-soon
// @access  Private
const getTasksDueSoon = async (req, res) => {
  try {
    const { days = 3 } = req.query;
    
    console.log(`⏰ Getting tasks due within ${days} days for org:`, req.organisationId);
    
    let tasks;
    
    if (req.user.role === 'admin') {
      // Admin gets all tasks due soon in organisation
      tasks = await localDB.getTasksDueSoon(parseInt(days), req.organisationId);
    } else {
      // Contributors get their own tasks due soon
      tasks = await localDB.getTasksDueSoon(parseInt(days), req.organisationId);
      tasks = tasks.filter(task => task.assigned_to === req.user.id);
    }
    
    res.json({
      success: true,
      data: tasks,
      total: tasks.length,
      days: parseInt(days)
    });
    
  } catch (error) {
    console.error('❌ Get tasks due soon error:', error);
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