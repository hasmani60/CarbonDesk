// routes/tasks.js - MongoDB-compatible task routes with FIXED middleware
const express = require('express');
const router = express.Router();
const { authorizeRoles } = require('../middleware/auth');
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

// All routes protected by authenticateToken + addOrganisationContext + requireOrganisation in server.js

// FIXED: Use authorizeRoles instead of requireAdmin for consistency
// Specific routes first (before /:id)
router.get('/assignable-users', authorizeRoles('admin'), getAssignableUsers);
router.get('/stats', authorizeRoles('admin', 'analyst', 'contributor'), getTaskStats);
router.get('/due-soon', authorizeRoles('admin', 'analyst', 'contributor'), getTasksDueSoon);

// General routes
router.get('/', authorizeRoles('admin', 'analyst', 'contributor'), getTasks);
router.post('/', authorizeRoles('admin'), createTask);

// Parameterized routes last
router.get('/:id', authorizeRoles('admin', 'analyst', 'contributor'), getTaskById);
router.patch('/:id', authorizeRoles('admin', 'analyst', 'contributor'), updateTask);
router.delete('/:id', authorizeRoles('admin'), deleteTask);

module.exports = router;