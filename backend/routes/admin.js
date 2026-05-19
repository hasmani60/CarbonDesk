// routes/admin.js - MongoDB-compatible admin routes
const express = require('express');
const {
  getAllActivities,
  getUserActivitySummary,
  getAdminDashboard
} = require('../controllers/adminController');

const router = express.Router();

// All routes protected by requireAdmin in server.js
router.get('/dashboard', getAdminDashboard);
router.get('/activities', getAllActivities);
router.get('/user-summary', getUserActivitySummary);

module.exports = router;