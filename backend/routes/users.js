// ===== backend/routes/users.js =====
const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const {
  getUsers,
  getUserById,
  createUser,
  updateUserRole,
  updateUserStatus,
  deleteUser,
  getUserStats,
  bulkUpdateUsers
} = require('../controllers/userController');

const router = express.Router();

// All routes are already protected by authenticateToken in server.js
router.get('/', getUsers);
router.get('/stats', getUserStats);
router.get('/:id', getUserById);
router.post('/', requireAdmin, createUser);
router.patch('/:id/role', requireAdmin, updateUserRole);
router.patch('/:id/status', requireAdmin, updateUserStatus);
router.delete('/:id', requireAdmin, deleteUser);
router.patch('/bulk', requireAdmin, bulkUpdateUsers);

module.exports = router;