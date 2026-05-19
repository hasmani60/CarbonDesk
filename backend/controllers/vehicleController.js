const { Vehicle, Activity } = require('../models');

// @desc    Get all vehicles
// @route   GET /api/vehicles
// @access  Private
const getVehicles = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      type,
      category,
      status,
      search
    } = req.query;

    const query = {};
    
    if (type && type !== 'all') query.type = type;
    if (category && category !== 'all') query.category = category;
    if (status && status !== 'all') query.status = status;
    
    if (search) {
      query.$or = [
        { registrationNumber: new RegExp(search, 'i') },
        { make: new RegExp(search, 'i') },
        { model: new RegExp(search, 'i') }
      ];
    }

    // Sample data since we don't have real database yet
    const sampleVehicles = Array(12).fill(null).map((_, index) => ({
      _id: `vehicle_${index + 1}`,
      registrationNumber: 'GJ 05 1234',
      model: 'Classic 350',
      mileage: 55,
      type: index % 4 === 0 ? 'motorcycle' : index % 4 === 1 ? 'truck' : 'car',
      category: index % 2 === 0 ? 'company' : 'personal',
      owner: { name: 'Jhon Doe', _id: 'owner1' },
      driver: { name: 'Jhon Doe', _id: 'driver1' },
      status: 'active'
    }));

    res.json({
      success: true,
      data: sampleVehicles,
      pagination: {
        currentPage: parseInt(page),
        totalPages: 1,
        totalItems: 12,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Create vehicle
// @route   POST /api/vehicles
// @access  Private
const createVehicle = async (req, res) => {
  try {
    const vehicleData = {
      ...req.body,
      owner: req.user.id,
      _id: `vehicle_${Date.now()}`
    };

    res.status(201).json({
      success: true,
      data: vehicleData,
      message: 'Vehicle created successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get vehicle by ID
// @route   GET /api/vehicles/:id
// @access  Private
const getVehicleById = async (req, res) => {
  try {
    const sampleVehicle = {
      _id: req.params.id,
      registrationNumber: 'GJ 05 1234',
      model: 'Classic 350',
      mileage: 55,
      type: 'motorcycle',
      category: 'company',
      owner: { name: 'Jhon Doe', _id: 'owner1' },
      driver: { name: 'Jhon Doe', _id: 'driver1' },
      status: 'active'
    };

    res.json({
      success: true,
      data: sampleVehicle
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update vehicle
// @route   PATCH /api/vehicles/:id
// @access  Private
const updateVehicle = async (req, res) => {
  try {
    const updatedVehicle = {
      ...req.body,
      _id: req.params.id
    };

    res.json({
      success: true,
      data: updatedVehicle,
      message: 'Vehicle updated successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete vehicle
// @route   DELETE /api/vehicles/:id
// @access  Private
const deleteVehicle = async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Vehicle deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getVehicles,
  createVehicle,
  getVehicleById,
  updateVehicle,
  deleteVehicle
};