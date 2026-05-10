// routes/users.js - MongoDB-compatible user routes
const express = require('express');
const { requireAdmin, authorizeRoles } = require('../middleware/auth');
const {
  getUsers,
  getUserById,
  createUser,
  updateUserRole,
  updateUserRestrictions,
  updateUserStatus,
  deleteUser,
  getUserActivities,
  getUserStats,
  getRBACOptions,
  bulkUpdateUsers
} = require('../controllers/userController');

const router = express.Router();

// All routes protected by authenticateToken + addOrganisationContext in server.js

// Specific routes first (before /:id)
router.get('/stats', authorizeRoles('admin', 'analyst'), getUserStats);
router.get('/rbac-options', requireAdmin, getRBACOptions);
router.patch('/bulk', requireAdmin, bulkUpdateUsers);

// General routes
router.get('/', authorizeRoles('admin', 'analyst'), getUsers);
router.post('/', requireAdmin, createUser);

// Parameterized routes last
router.get('/:id', getUserById);
router.get('/:id/activities', requireAdmin, getUserActivities);
router.patch('/:id/role', requireAdmin, updateUserRole);
router.patch('/:id/restrictions', requireAdmin, updateUserRestrictions);
router.patch('/:id/status', requireAdmin, updateUserStatus);
router.delete('/:id', requireAdmin, deleteUser);

module.exports = router;