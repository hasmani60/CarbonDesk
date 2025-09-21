// controllers/userController.js - Complete with all required functions
const bcrypt = require('bcryptjs');

// Helper function to check if MongoDB is connected
const isMongoConnected = () => {
  try {
    const mongoose = require('mongoose');
    return mongoose.connection && mongoose.connection.readyState === 1;
  } catch (error) {
    return false;
  }
};

// Helper function to log admin activity
const logAdminActivity = async (adminId, action, resourceType, resourceId, details, req) => {
  try {
    if (!isMongoConnected()) {
      console.log('MongoDB not connected - skipping activity log');
      return;
    }
    const { Activity } = require('../models');
    await Activity.create({
      user: adminId,
      action: `admin_${action}`,
      resourceType,
      resourceId,
      details,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        browser: extractBrowser(req.get('User-Agent')),
        os: extractOS(req.get('User-Agent'))
      }
    });
  } catch (error) {
    console.error('Failed to log admin activity:', error);
  }
};

// @desc    Get all users
// @route   GET /api/users
// @access  Private (Admin only)
const getUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      role,
      status,
      search
    } = req.query;

    // Check if MongoDB is connected
    if (!isMongoConnected()) {
      return res.json({
        success: true,
        data: getDemoUsers(),
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: 4,
          itemsPerPage: 10
        }
      });
    }

    const { User, Activity, Emission } = require('../models');
    const query = {};
    
    if (role && role !== 'all') query.role = role;
    if (status && status !== 'all') query.status = status;
    
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    // Add additional user statistics
    const usersWithStats = await Promise.all(users.map(async (user) => {
      const emissionCount = await Emission.countDocuments({ user: user._id }).catch(() => 0);
      const recentActivityCount = await Activity.countDocuments({
        user: user._id,
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }).catch(() => 0);

      return {
        ...user.toObject(),
        statistics: {
          emissionCount,
          recentActivityCount,
          joinedDaysAgo: Math.floor((new Date() - user.createdAt) / (1000 * 60 * 60 * 24))
        }
      };
    }));

    // Log this admin activity
    await logAdminActivity(
      req.user.id,
      'viewed_all_users',
      'user',
      null,
      `Viewed ${users.length} users`,
      req
    );

    res.json({
      success: true,
      data: usersWithStats,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get user by ID with detailed info
// @route   GET /api/users/:id
// @access  Private (Admin only)
const getUserById = async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database connection required to get user details.'
      });
    }

    const { User, Emission, Activity } = require('../models');
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's emission statistics
    const emissionStats = await Emission.aggregate([
      { $match: { user: user._id } },
      {
        $group: {
          _id: '$scope',
          count: { $sum: 1 },
          totalEmissions: { $sum: '$totalEmissions' }
        }
      }
    ]).catch(() => []);

    // Get user's recent activities
    const recentActivities = await Activity.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('action createdAt details')
      .catch(() => []);

    const userWithStats = {
      ...user.toObject(),
      statistics: {
        emissionStats,
        recentActivities,
        totalEmissions: emissionStats.reduce((sum, stat) => sum + stat.totalEmissions, 0),
        totalEmissionRecords: emissionStats.reduce((sum, stat) => sum + stat.count, 0)
      }
    };

    // Log this admin activity
    await logAdminActivity(
      req.user.id,
      'viewed_user_detail',
      'user',
      user._id,
      `Viewed detailed profile of user: ${user.name}`,
      req
    );

    res.json({
      success: true,
      data: userWithStats
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Create new user (Admin only) - MAIN ADD USER FUNCTIONALITY
// @route   POST /api/users
// @access  Private (Admin only)
const createUser = async (req, res) => {
  try {
    const { name, email, password, role = 'contributor', status = 'active' } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required'
      });
    }

    // Validate email format
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Validate role
    const validRoles = ['admin', 'analyst', 'contributor', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role specified. Must be one of: ${validRoles.join(', ')}`
      });
    }

    // Validate status
    const validStatuses = ['active', 'inactive', 'suspended'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status specified. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Check if MongoDB is connected
    if (!isMongoConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database connection required to create users. Please try again later.'
      });
    }

    const { User, Activity } = require('../models');

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create user with enhanced validation
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role,
      status
    });

    // Log this admin activity
    await logAdminActivity(
      req.user.id,
      'created_user',
      'user',
      user._id,
      `Created new user: ${user.name} (${user.email}) with role: ${user.role}`,
      req
    );

    // Log user creation from user's perspective
    await Activity.create({
      user: user._id,
      action: 'user_registered',
      resourceType: 'user',
      resourceId: user._id,
      details: `Account created by admin: ${req.user.name || 'System Admin'}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        browser: extractBrowser(req.get('User-Agent')),
        os: extractOS(req.get('User-Agent')),
        createdBy: req.user.id
      }
    });

    // Return user without password
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      permissions: user.permissions,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      statistics: {
        emissionCount: 0,
        recentActivityCount: 1,
        joinedDaysAgo: 0
      }
    };

    res.status(201).json({
      success: true,
      data: userResponse,
      message: `User created successfully with role: ${role}`
    });
  } catch (error) {
    console.error('Create user error:', error);
    
    // Handle MongoDB validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    res.status(400).json({
      success: false,
      message: error.message || 'Failed to create user'
    });
  }
};

// @desc    Update user role
// @route   PATCH /api/users/:id/role
// @access  Private (Admin only)
const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    
    const validRoles = ['admin', 'analyst', 'contributor', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role specified. Must be one of: ${validRoles.join(', ')}`
      });
    }

    // Check if MongoDB is connected
    if (!isMongoConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database connection required to update user roles.'
      });
    }

    const { User, Activity } = require('../models');
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent user from changing their own role
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot change your own role'
      });
    }

    const oldRole = user.role;
    
    user.role = role;
    await user.save();

    // Log this admin activity
    await logAdminActivity(
      req.user.id,
      'updated_user_role',
      'user',
      user._id,
      `Changed user role: ${user.name} from ${oldRole} to ${role}`,
      req
    );

    // Log activity for the affected user
    await Activity.create({
      user: user._id,
      action: 'role_changed',
      resourceType: 'user',
      resourceId: user._id,
      details: `Your role was changed from ${oldRole} to ${role} by admin: ${req.user.name || 'System Admin'}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        browser: extractBrowser(req.get('User-Agent')),
        os: extractOS(req.get('User-Agent')),
        changedBy: req.user.id,
        oldRole: oldRole,
        newRole: role
      }
    });

    res.json({
      success: true,
      data: {
        ...user.toObject(),
        permissions: user.permissions
      },
      message: `User role updated to ${role}`
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update user status
// @route   PATCH /api/users/:id/status
// @access  Private (Admin only)
const updateUserStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    const validStatuses = ['active', 'inactive', 'suspended'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status specified. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Check if MongoDB is connected
    if (!isMongoConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database connection required to update user status.'
      });
    }

    const { User, Activity } = require('../models');
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent user from changing their own status
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot change your own status'
      });
    }

    const oldStatus = user.status;
    
    user.status = status;
    await user.save();

    // Log this admin activity
    await logAdminActivity(
      req.user.id,
      'updated_user_status',
      'user',
      user._id,
      `Changed user status: ${user.name} from ${oldStatus} to ${status}`,
      req
    );

    // Log activity for the affected user
    await Activity.create({
      user: user._id,
      action: 'status_changed',
      resourceType: 'user',
      resourceId: user._id,
      details: `Your account status was changed from ${oldStatus} to ${status} by admin: ${req.user.name || 'System Admin'}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        browser: extractBrowser(req.get('User-Agent')),
        os: extractOS(req.get('User-Agent')),
        changedBy: req.user.id,
        oldStatus: oldStatus,
        newStatus: status
      }
    });

    res.json({
      success: true,
      data: user,
      message: `User status updated to ${status}`
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private (Admin only)
const deleteUser = async (req, res) => {
  try {
    // Check if MongoDB is connected
    if (!isMongoConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database connection required to delete users.'
      });
    }

    const { User, Emission } = require('../models');
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent admin from deleting themselves
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    // Get user's emission count before deletion
    const emissionCount = await Emission.countDocuments({ user: user._id }).catch(() => 0);
    
    // Soft delete: set status to inactive and modify email to prevent conflicts
    const originalEmail = user.email;
    user.status = 'inactive';
    user.email = `deleted_${Date.now()}_${user.email}`;
    await user.save();

    // Log this admin activity
    await logAdminActivity(
      req.user.id,
      'deleted_user',
      'user',
      user._id,
      `Deleted user: ${user.name} (${originalEmail}) - had ${emissionCount} emission records`,
      req
    );

    res.json({
      success: true,
      message: 'User deleted successfully',
      data: {
        deletedUser: user.name,
        originalEmail: originalEmail,
        emissionCount: emissionCount
      }
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get user statistics
// @route   GET /api/users/stats
// @access  Private (Admin only)
const getUserStats = async (req, res) => {
  try {
    // Check if MongoDB is connected
    if (!isMongoConnected()) {
      return res.json({
        success: true,
        data: {
          overview: {
            totalUsers: 4,
            activeUsers: 4,
            inactiveUsers: 0,
            suspendedUsers: 0,
            adminUsers: 1,
            analystUsers: 1,
            contributorUsers: 1,
            viewerUsers: 1
          },
          registrationTrends: []
        }
      });
    }

    const { User } = require('../models');

    const stats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          inactiveUsers: { $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] } },
          suspendedUsers: { $sum: { $cond: [{ $eq: ['$status', 'suspended'] }, 1, 0] } },
          adminUsers: { $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] } },
          analystUsers: { $sum: { $cond: [{ $eq: ['$role', 'analyst'] }, 1, 0] } },
          contributorUsers: { $sum: { $cond: [{ $eq: ['$role', 'contributor'] }, 1, 0] } },
          viewerUsers: { $sum: { $cond: [{ $eq: ['$role', 'viewer'] }, 1, 0] } }
        }
      }
    ]);

    // Get user registration trends (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const registrationTrends = await User.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Log this admin activity
    await logAdminActivity(
      req.user.id,
      'viewed_user_stats',
      'user',
      null,
      'Viewed user statistics',
      req
    );

    res.json({
      success: true,
      data: {
        overview: stats[0] || {
          totalUsers: 0,
          activeUsers: 0,
          inactiveUsers: 0,
          suspendedUsers: 0,
          adminUsers: 0,
          analystUsers: 0,
          contributorUsers: 0,
          viewerUsers: 0
        },
        registrationTrends
      }
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Bulk update users
// @route   PATCH /api/users/bulk
// @access  Private (Admin only)
const bulkUpdateUsers = async (req, res) => {
  try {
    const { userIds, updates } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'User IDs array is required'
      });
    }

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Updates object is required'
      });
    }

    // Check if MongoDB is connected
    if (!isMongoConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database connection required for bulk operations.'
      });
    }

    // Validate updates
    const allowedFields = ['role', 'status'];
    const updateFields = Object.keys(updates);
    const invalidFields = updateFields.filter(field => !allowedFields.includes(field));
    
    if (invalidFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid fields: ${invalidFields.join(', ')}`
      });
    }

    const { User } = require('../models');

    // Perform bulk update
    const result = await User.updateMany(
      { _id: { $in: userIds } },
      { $set: updates }
    );

    // Log this admin activity
    await logAdminActivity(
      req.user.id,
      'bulk_updated_users',
      'user',
      null,
      `Bulk updated ${result.modifiedCount} users with: ${JSON.stringify(updates)}`,
      req
    );

    res.json({
      success: true,
      data: {
        matched: result.matchedCount,
        modified: result.modifiedCount
      },
      message: `Successfully updated ${result.modifiedCount} users`
    });
  } catch (error) {
    console.error('Bulk update users error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Helper functions
const getDemoUsers = () => [
  {
    _id: 'demo_admin_id',
    name: 'Demo Admin',
    email: 'demo@example.com',
    role: 'admin',
    status: 'active',
    createdAt: new Date(),
    statistics: { emissionCount: 15, recentActivityCount: 5, joinedDaysAgo: 0 }
  },
  {
    _id: 'demo_analyst_id',
    name: 'Demo Analyst',
    email: 'analyst@example.com',
    role: 'analyst',
    status: 'active',
    createdAt: new Date(),
    statistics: { emissionCount: 10, recentActivityCount: 3, joinedDaysAgo: 0 }
  },
  {
    _id: 'demo_contributor_id',
    name: 'Demo Contributor',
    email: 'contributor@example.com',
    role: 'contributor',
    status: 'active',
    createdAt: new Date(),
    statistics: { emissionCount: 5, recentActivityCount: 2, joinedDaysAgo: 0 }
  },
  {
    _id: 'demo_viewer_id',
    name: 'Demo Viewer',
    email: 'viewer@example.com',
    role: 'viewer',
    status: 'active',
    createdAt: new Date(),
    statistics: { emissionCount: 0, recentActivityCount: 1, joinedDaysAgo: 0 }
  }
];

const extractBrowser = (userAgent) => {
  if (!userAgent) return 'Unknown';
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';
  return 'Other';
};

const extractOS = (userAgent) => {
  if (!userAgent) return 'Unknown';
  if (userAgent.includes('Windows')) return 'Windows';
  if (userAgent.includes('Mac')) return 'MacOS';
  if (userAgent.includes('Linux')) return 'Linux';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('iOS')) return 'iOS';
  return 'Other';
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUserRole,
  updateUserStatus,
  deleteUser,
  getUserStats,
  bulkUpdateUsers
};