const express = require('express');
const router = express.Router();
const { authorizeRoles } = require('../middleware/auth');
const {
  searchPortsHandler,
  getPortHandler,
  calculateDistanceHandler
} = require('../controllers/seaController');

const readRoles = ['admin', 'analyst', 'contributor', 'viewer'];

router.get('/ports', authorizeRoles(...readRoles), searchPortsHandler);
router.get('/ports/:code', authorizeRoles(...readRoles), getPortHandler);
router.get('/distance', authorizeRoles(...readRoles), calculateDistanceHandler);

module.exports = router;
