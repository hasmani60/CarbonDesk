const { Generator } = require('../models');

const getGenerators = async (req, res) => {
  try {
    // Sample data for testing
    const sampleGenerators = Array(8).fill(null).map((_, index) => ({
      _id: `generator_${index + 1}`,
      name: 'Main Generator 1',
      type: 'Diesel Generator',
      capacity: { value: 500, unit: 'kW' },
      location: { building: 'Building A' },
      status: 'active'
    }));

    res.json({
      success: true,
      data: sampleGenerators
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const createGenerator = async (req, res) => {
  try {
    res.status(201).json({
      success: true,
      data: { ...req.body, _id: `generator_${Date.now()}` },
      message: 'Generator created successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

const updateGenerator = async (req, res) => {
  try {
    res.json({
      success: true,
      data: { ...req.body, _id: req.params.id },
      message: 'Generator updated successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

const deleteGenerator = async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Generator deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getGenerators,
  createGenerator,
  updateGenerator,
  deleteGenerator
};