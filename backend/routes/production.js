const express = require('express');
const router = express.Router();
const { authorizeRoles } = require('../middleware/auth');
const {
  listProduction,
  getProductionSummary,
  createProduction,
  updateProduction,
  deleteProduction
} = require('../controllers/productionController');

const readRoles = ['admin', 'analyst', 'contributor', 'viewer'];
const writeRoles = ['admin', 'analyst', 'contributor'];
const manageRoles = ['admin', 'analyst'];

router.get('/summary', authorizeRoles(...readRoles), getProductionSummary);
router.get('/', authorizeRoles(...readRoles), listProduction);
router.post('/', authorizeRoles(...writeRoles), createProduction);
router.put('/:id', authorizeRoles(...writeRoles), updateProduction);
router.delete('/:id', authorizeRoles(...manageRoles), deleteProduction);

module.exports = router;
