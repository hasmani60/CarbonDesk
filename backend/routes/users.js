// routes/users.js
const express = require('express');
const { getUsers, updateUserRole, updateUserStatus } = require('../controllers/userController');
const { authorizeRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/', authorizeRoles('admin', 'analyst'), getUsers);
router.patch('/:id/role', authorizeRoles('admin'), updateUserRole);
router.patch('/:id/status', authorizeRoles('admin'), updateUserStatus);

module.exports = router;