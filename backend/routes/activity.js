const express = require('express');
const router = express.Router();
const { authorizeRoles } = require('../middleware/auth');
const {
  logActivity,
  getRecentActivities,
  getUserActivities
} = require('../controllers/activityController');

// All routes protected by authenticateToken in server.js

// Activity logging (any authenticated user)
router.post('/log', logActivity);

// User specific activities (users can view their own, admins can view any)
router.get('/user/:id', getUserActivities);

// System-wide recent activities (restricted to admins and analysts)
router.get('/recent', authorizeRoles('admin', 'analyst'), getRecentActivities);

module.exports = router;
