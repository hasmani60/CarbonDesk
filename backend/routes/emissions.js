// routes/emissions.js
const express = require('express');
const { 
  getEmissions, 
  createEmission, 
  updateEmission, 
  deleteEmission, 
  getEmissionCategories 
} = require('../controllers/emissionController');
const { authorizeRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/', getEmissions);
router.post('/', createEmission);
router.patch('/:id', updateEmission);
router.delete('/:id', authorizeRoles('admin', 'analyst'), deleteEmission);
router.get('/categories', getEmissionCategories);

module.exports = router;