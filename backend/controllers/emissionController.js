// controllers/emissionController.js - Updated for multi-user support
const { Emission, Activity } = require('../models');

// Helper function to log activity
const logActivity = async (userId, action, resourceType, resourceId, details, req) => {
  try {
    await Activity.create({
      user: userId,
      action,
      resourceType,
      resourceId,
      details,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};

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

    let query = {};

    // Apply user-based filtering
    if (req.user.role !== 'admin') {
      // Non-admin users can only see their own emissions
      query.user = req.user.id;
    } else if (req.query.userId) {
      // Admin can filter by specific user
      query.user = req.query.userId;
    }

    // Apply other filters
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

    // Log access activity
    await logActivity(
      req.user.id,
      'viewed_emissions',
      'emission',
      null,
      `Viewed ${emissions.length} emission records`,
      req
    );

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
    console.error('Get emissions error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get emission by ID
// @route   GET /api/emissions/:id
// @access  Private
const getEmissionById = async (req, res) => {
  try {
    let query = { _id: req.params.id };
    
    // Non-admin users can only see their own emissions
    if (req.user.role !== 'admin') {
      query.user = req.user.id;
    }

    const emission = await Emission.findOne(query)
      .populate('user', 'name email role')
      .populate('verifiedBy', 'name email');

    if (!emission) {
      return res.status(404).json({
        success: false,
        message: 'Emission not found or access denied'
      });
    }

    // Log access activity
    await logActivity(
      req.user.id,
      'viewed_emission_detail',
      'emission',
      emission._id,
      `Viewed emission: ${emission.activityType}`,
      req
    );

    res.json({
      success: true,
      data: emission
    });
  } catch (error) {
    console.error('Get emission by ID error:', error);
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
      user: req.user.id  // Always set to current user
    };

    // Set default emission factor if not provided
    if (!emissionData.emissionFactor) {
      emissionData.emissionFactor = getEmissionFactor(emissionData.source, emissionData.unit);
    }

    const emission = await Emission.create(emissionData);
    await emission.populate('user', 'name email');

    // Log creation activity
    await logActivity(
      req.user.id,
      'created_emission',
      'emission',
      emission._id,
      `Created emission record: ${emission.activityType} - ${emission.amount} ${emission.unit}`,
      req
    );

    res.status(201).json({
      success: true,
      data: emission,
      message: 'Emission record created successfully'
    });
  } catch (error) {
    console.error('Create emission error:', error);
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
    let query = { _id: req.params.id };
    
    // Non-admin users can only update their own emissions
    if (req.user.role !== 'admin') {
      query.user = req.user.id;
    }

    const emission = await Emission.findOne(query);

    if (!emission) {
      return res.status(404).json({
        success: false,
        message: 'Emission not found or access denied'
      });
    }

    // Store original values for audit log
    const originalData = {
      activityType: emission.activityType,
      amount: emission.amount,
      unit: emission.unit,
      status: emission.status
    };

    const updatedEmission = await Emission.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('user', 'name email');

    // Log update activity with details of what changed
    const changes = [];
    Object.keys(req.body).forEach(key => {
      if (originalData[key] && originalData[key] !== req.body[key]) {
        changes.push(`${key}: ${originalData[key]} → ${req.body[key]}`);
      }
    });

    await logActivity(
      req.user.id,
      'updated_emission',
      'emission',
      updatedEmission._id,
      `Updated emission record: ${updatedEmission.activityType}${changes.length ? `. Changes: ${changes.join(', ')}` : ''}`,
      req
    );

    res.json({
      success: true,
      data: updatedEmission,
      message: 'Emission record updated successfully'
    });
  } catch (error) {
    console.error('Update emission error:', error);
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
    let query = { _id: req.params.id };
    
    // Non-admin users can only delete their own emissions
    if (req.user.role !== 'admin') {
      query.user = req.user.id;
    }

    const emission = await Emission.findOne(query);

    if (!emission) {
      return res.status(404).json({
        success: false,
        message: 'Emission not found or access denied'
      });
    }

    await emission.deleteOne();

    // Log deletion activity
    await logActivity(
      req.user.id,
      'deleted_emission',
      'emission',
      req.params.id,
      `Deleted emission record: ${emission.activityType} - ${emission.amount} ${emission.unit}`,
      req
    );

    res.json({
      success: true,
      message: 'Emission record deleted successfully'
    });
  } catch (error) {
    console.error('Delete emission error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Verify emission (Admin only)
// @route   PATCH /api/emissions/:id/verify
// @access  Private (Admin)
const verifyEmission = async (req, res) => {
  try {
    const { status, comments } = req.body;

    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either verified or rejected'
      });
    }

    const emission = await Emission.findById(req.params.id)
      .populate('user', 'name email');

    if (!emission) {
      return res.status(404).json({
        success: false,
        message: 'Emission not found'
      });
    }

    emission.status = status;
    emission.verifiedBy = req.user.id;
    emission.verificationDate = new Date();
    emission.verificationComments = comments;

    await emission.save();
    await emission.populate('verifiedBy', 'name email');

    // Log verification activity
    await logActivity(
      req.user.id,
      'verified_emission',
      'emission',
      emission._id,
      `${status === 'verified' ? 'Verified' : 'Rejected'} emission record: ${emission.activityType} (User: ${emission.user.name})`,
      req
    );

    // Log activity for the emission owner
    await logActivity(
      emission.user._id,
      'emission_status_changed',
      'emission',
      emission._id,
      `Your emission record "${emission.activityType}" was ${status} by admin`,
      req
    );

    res.json({
      success: true,
      data: emission,
      message: `Emission record ${status} successfully`
    });
  } catch (error) {
    console.error('Verify emission error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get user's emission statistics
// @route   GET /api/emissions/stats
// @access  Private
const getEmissionStats = async (req, res) => {
  try {
    let matchStage = {};
    
    // Apply user-based filtering
    if (req.user.role !== 'admin') {
      matchStage.user = req.user.id;
    } else if (req.query.userId) {
      matchStage.user = req.query.userId;
    }

    const stats = await Emission.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            scope: '$scope',
            status: '$status'
          },
          totalEmissions: { $sum: '$totalEmissions' },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.scope',
          statuses: {
            $push: {
              status: '$_id.status',
              totalEmissions: '$totalEmissions',
              count: '$count'
            }
          },
          totalEmissions: { $sum: '$totalEmissions' },
          totalCount: { $sum: '$count' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Log stats access
    await logActivity(
      req.user.id,
      'viewed_emission_stats',
      'emission',
      null,
      'Viewed emission statistics',
      req
    );

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get emission stats error:', error);
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
  getEmissionById,
  createEmission,
  updateEmission,
  deleteEmission,
  verifyEmission,
  getEmissionStats,
  getEmissionCategories
};