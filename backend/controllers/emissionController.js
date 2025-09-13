// controllers/emissionController.js
const { Emission, Activity } = require('../models');

// @desc    Get all emissions
// @route   GET /api/emissions
// @access  Private
const getEmissions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      scope,
      category,
      status,
      startDate,
      endDate,
      search
    } = req.query;

    const query = {};

    // Apply filters
    if (scope) query.scope = scope;
    if (category) query.category = new RegExp(category, 'i');
    if (status) query.status = status;
    
    if (startDate || endDate) {
      query['accountingPeriod.start'] = {};
      if (startDate) query['accountingPeriod.start'].$gte = new Date(startDate);
      if (endDate) query['accountingPeriod.start'].$lte = new Date(endDate);
    }

    if (search) {
      query.$or = [
        { activityType: new RegExp(search, 'i') },
        { source: new RegExp(search, 'i') },
        { category: new RegExp(search, 'i') }
      ];
    }

    const emissions = await Emission.find(query)
      .populate('user', 'name email')
      .populate('verifiedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Emission.countDocuments(query);

    res.json({
      success: true,
      data: emissions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
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

// @desc    Create emission
// @route   POST /api/emissions
// @access  Private
const createEmission = async (req, res) => {
  try {
    const emissionData = {
      ...req.body,
      user: req.user.id
    };

    // Set default emission factor if not provided
    if (!emissionData.emissionFactor) {
      emissionData.emissionFactor = getEmissionFactor(emissionData.source, emissionData.unit);
    }

    const emission = await Emission.create(emissionData);
    await emission.populate('user', 'name email');

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: 'created_emission',
      resourceType: 'emission',
      resourceId: emission._id,
      details: `Created emission record for ${emission.activityType}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(201).json({
      success: true,
      data: emission
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update emission
// @route   PATCH /api/emissions/:id
// @access  Private
const updateEmission = async (req, res) => {
  try {
    const emission = await Emission.findById(req.params.id);

    if (!emission) {
      return res.status(404).json({
        success: false,
        message: 'Emission not found'
      });
    }

    // Check ownership or admin role
    if (emission.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this emission'
      });
    }

    const updatedEmission = await Emission.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('user', 'name email');

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: 'updated_emission',
      resourceType: 'emission',
      resourceId: updatedEmission._id,
      details: `Updated emission record for ${updatedEmission.activityType}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      data: updatedEmission
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete emission
// @route   DELETE /api/emissions/:id
// @access  Private
const deleteEmission = async (req, res) => {
  try {
    const emission = await Emission.findById(req.params.id);

    if (!emission) {
      return res.status(404).json({
        success: false,
        message: 'Emission not found'
      });
    }

    // Check ownership or admin role
    if (emission.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this emission'
      });
    }

    await emission.deleteOne();

    // Log activity
    await Activity.create({
      user: req.user.id,
      action: 'deleted_emission',
      resourceType: 'emission',
      resourceId: req.params.id,
      details: `Deleted emission record for ${emission.activityType}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Emission deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get emission categories
// @route   GET /api/emissions/categories
// @access  Private
const getEmissionCategories = async (req, res) => {
  try {
    const categories = {
      1: [
        'Stationary Combustion',
        'Mobile Combustion',
        'Process Emissions',
        'Fugitive Emissions'
      ],
      2: [
        'Purchased Electricity',
        'Purchased Heat/Steam',
        'Purchased Cooling'
      ],
      3: [
        'Business Travel',
        'Employee Commuting',
        'Waste Generated',
        'Purchased Goods and Services',
        'Upstream Transportation',
        'Downstream Transportation',
        'Processing of Sold Products',
        'Use of Sold Products',
        'End-of-life Treatment'
      ]
    };

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Helper function to get emission factors
const getEmissionFactor = (source, unit) => {
  const emissionFactors = {
    'diesel': { 'litres': 2.68, 'kg': 3.15 },
    'petrol': { 'litres': 2.31, 'kg': 3.15 },
    'natural_gas': { 'kg': 2.75, 'kWh': 0.18 },
    'electricity': { 'kWh': 0.82 },
    'coal': { 'kg': 2.42 },
    'lpg': { 'kg': 2.98 }
  };

  return emissionFactors[source]?.[unit] || 1.0;
};

module.exports = {
  getEmissions,
  createEmission,
  updateEmission,
  deleteEmission,
  getEmissionCategories
};