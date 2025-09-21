// routes/admin.js - Updated without audit logs functionality
const express = require('express');
const {
  getAllActivities,
  getUserActivitySummary,
  getAdminDashboard
  // Removed getAuditLogs import
} = require('../controllers/adminController');

const router = express.Router();

// All routes here are already protected by requireAdmin middleware in server.js
router.get('/dashboard', getAdminDashboard);
router.get('/activities', getAllActivities);
router.get('/user-summary', getUserActivitySummary);

// Removed audit-logs route completely
// router.get('/audit-logs', getAuditLogs); // REMOVED

module.exports = router;