// backend/routes/emissions.js - Updated with new emission factors endpoints
const express = require('express');
const { requireAdmin, authorizeRoles } = require('../middleware/auth');
const {
  getEmissions,
  getEmissionById,
  createEmission,
  updateEmission,
  deleteEmission,
  verifyEmission,
  getEmissionStats,
  getEmissionCategories,
  getEmissionFactors,
  getUserAllowedActivities,
  getDiagnostics,
  syncEmissionsToActivities
} = require('../controllers/emissionController');

const router = express.Router();

// Statistics and metadata endpoints (before :id routes to avoid conflicts)
router.get('/stats', getEmissionStats);
router.get('/categories', getEmissionCategories);
router.get('/factors', getEmissionFactors);
router.get('/user/allowed-activities', getUserAllowedActivities);
router.get('/diagnostics', getDiagnostics);

// Sync endpoint (admin only)
router.post('/sync-to-activities', requireAdmin, syncEmissionsToActivities);

// CRUD operations
router.get('/', getEmissions);
router.get('/:id', getEmissionById);
router.post('/', createEmission);
router.patch('/:id', updateEmission);
router.patch('/:id/verify', authorizeRoles('admin', 'analyst'), verifyEmission);
router.delete('/:id', deleteEmission);

module.exports = router;