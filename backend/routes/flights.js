const express = require('express');
const router = express.Router();
const { authorizeRoles } = require('../middleware/auth');
const {
  searchAirportsHandler,
  getAirportHandler,
  calculateDistanceHandler
} = require('../controllers/flightController');

const readRoles = ['admin', 'analyst', 'contributor', 'viewer'];

router.get('/airports', authorizeRoles(...readRoles), searchAirportsHandler);
router.get('/airports/:iata', authorizeRoles(...readRoles), getAirportHandler);
router.get('/distance', authorizeRoles(...readRoles), calculateDistanceHandler);

module.exports = router;
