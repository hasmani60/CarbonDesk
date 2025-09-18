// ===== backend/routes/admin.js =====
const express = require('express');
const {
  getAllActivities,
  getUserActivitySummary,
  getAuditLogs,
  getAdminDashboard
} = require('../controllers/adminController');

const router = express.Router();

// All routes here are already protected by requireAdmin middleware in server.js
router.get('/dashboard', getAdminDashboard);
router.get('/activities', getAllActivities);
router.get('/user-summary', getUserActivitySummary);
router.get('/audit-logs', getAuditLogs);

module.exports = router;