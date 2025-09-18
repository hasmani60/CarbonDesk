// ===== backend/routes/dashboard.js =====
const express = require('express');
const {
  getDashboardSummary,
  getDashboardNotifications
} = require('../controllers/dashboardController');

const router = express.Router();

router.get('/summary', getDashboardSummary);
router.get('/notifications', getDashboardNotifications);

module.exports = router;