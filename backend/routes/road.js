const express = require('express');
const router = express.Router();
const { authorizeRoles } = require('../middleware/auth');
const {
  searchPlacesHandler,
  getPlaceHandler,
  getFactorySiteHandler,
  saveFactorySiteHandler,
  clearFactorySiteHandler,
  calculateDistanceHandler
} = require('../controllers/roadController');

const readRoles = ['admin', 'analyst', 'contributor', 'viewer'];

router.get('/places', authorizeRoles(...readRoles), searchPlacesHandler);
router.get('/places/:placeId', authorizeRoles(...readRoles), getPlaceHandler);
router.get('/factory-site', authorizeRoles(...readRoles), getFactorySiteHandler);
router.put('/factory-site', authorizeRoles('admin'), saveFactorySiteHandler);
router.delete('/factory-site', authorizeRoles('admin'), clearFactorySiteHandler);
router.get('/distance', authorizeRoles(...readRoles), calculateDistanceHandler);

module.exports = router;
