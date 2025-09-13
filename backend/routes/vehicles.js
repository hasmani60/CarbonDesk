// routes/vehicles.js
const express = require('express');
const { 
  getVehicles, 
  createVehicle, 
  updateVehicle, 
  deleteVehicle,
  getVehicleById 
} = require('../controllers/vehicleController');
const { authorizeRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/', getVehicles);
router.post('/', authorizeRoles('admin', 'analyst'), createVehicle);
router.get('/:id', getVehicleById);
router.patch('/:id', authorizeRoles('admin', 'analyst'), updateVehicle);
router.delete('/:id', authorizeRoles('admin'), deleteVehicle);

module.exports = router;