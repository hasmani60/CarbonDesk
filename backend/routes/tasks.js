// backend/routes/tasks.js
// Task Management API Routes - FIXED (Added assignable-users endpoint)

const express = require('express');
const router = express.Router();

const { 
  requireAdmin, 
  authorizeRoles 
} = require('../middleware/auth');

const {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  getTaskStats,
  getTasksDueSoon,
  getAssignableUsers
} = require('../controllers/taskController');

// ============================================
// NOTE: authenticateToken, addOrganisationContext, 
// and requireOrganisation are applied in server.js
// ============================================

// ============================================
// SPECIFIC ROUTES FIRST (before /:id)
// ============================================

// @desc    Get assignable users for task assignment
// @route   GET /api/tasks/assignable-users
// @access  Private (Admin only)
router.get('/assignable-users', 
  requireAdmin, 
  getAssignableUsers
);

// @desc    Get task statistics
// @route   GET /api/tasks/stats
// @access  Private (Admin, Analyst, Contributor)
router.get('/stats', 
  authorizeRoles('admin', 'analyst', 'contributor'), 
  getTaskStats
);

// @desc    Get tasks due soon
// @route   GET /api/tasks/due-soon
// @access  Private (Admin, Analyst, Contributor)
// @query   ?days=3
router.get('/due-soon', 
  authorizeRoles('admin', 'analyst', 'contributor'), 
  getTasksDueSoon
);

// ============================================
// GENERAL ROUTES
// ============================================

// @desc    Get tasks (filtered by user role)
// @route   GET /api/tasks
// @access  Private (Admin, Analyst, Contributor)
// @query   ?status=pending&scope=1&search=text&assigned_to=userId(admin only)
router.get('/', 
  authorizeRoles('admin', 'analyst', 'contributor'), 
  getTasks
);

// @desc    Create new task
// @route   POST /api/tasks
// @access  Private (Admin only)
// @body    { assignedToUserId, scope, activity, source, startDate, endDate, deadline, comments, priority }
router.post('/', 
  requireAdmin, 
  createTask
);

// ============================================
// PARAMETERIZED ROUTES LAST (after specific routes)
// ============================================

// @desc    Get task by ID
// @route   GET /api/tasks/:id
// @access  Private (Admin or assigned user)
router.get('/:id', 
  authorizeRoles('admin', 'analyst', 'contributor'), 
  getTaskById
);

// @desc    Update task
// @route   PATCH /api/tasks/:id
// @access  Private (Admin or assigned user)
// @body    Updates object (role-dependent allowed fields)
router.patch('/:id', 
  authorizeRoles('admin', 'analyst', 'contributor'), 
  updateTask
);

// @desc    Delete task
// @route   DELETE /api/tasks/:id
// @access  Private (Admin only)
router.delete('/:id', 
  requireAdmin, 
  deleteTask
);

module.exports = router;