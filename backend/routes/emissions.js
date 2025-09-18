// ===== backend/routes/emissions.js =====
const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const {
  getEmissions,
  getEmissionById,
  createEmission,
  updateEmission,
  deleteEmission,
  verifyEmission,
  getEmissionStats,
  getEmissionCategories
} = require('../controllers/emissionController');

const router = express.Router();

router.get('/', getEmissions);
router.get('/categories', getEmissionCategories);
router.get('/stats', getEmissionStats);
router.get('/:id', getEmissionById);
router.post('/', createEmission);
router.patch('/:id', updateEmission);
router.patch('/:id/verify', requireAdmin, verifyEmission);
router.delete('/:id', deleteEmission);

module.exports = router;
