// controllers/userController.js - Enhanced user management for admins
const { User, Activity, Emission } = require('../models');

// Helper function to log admin activity
const logAdminActivity = async (adminId, action, resourceType, resourceId, details, req) => {
  try {
    await Activity.create({
      user: adminId,
      action: `admin_${action}`,
      resourceType,
      resourceId,
      details,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
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
      const emissionCount = await Emission.countDocuments({ user: user._id });
      const recentActivityCount = await Activity.countDocuments({
        user: user._id,
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      });

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
    ]);

    // Get user's recent activities
    const recentActivities = await Activity.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('action createdAt details');

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

// @desc    Create new user (Admin only)
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

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Validate role
    const validRoles = ['admin', 'analyst', 'contributor', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified'
      });
    }

    // Create user
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

    // Return user without password
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt
    };

    res.status(201).json({
      success: true,
      data: userResponse,
      message: 'User created successfully'
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update user role
// @route   PATCH /api/users/:id/role
// @access  Private (Admin only)
const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    
    if (!['admin', 'analyst', 'viewer', 'contributor'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified'
      });
    }

    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const oldRole = user.role;
    
    user.role = role;
    await user.save();

    // Log this admin activity
    await logAdminActivity(
      req.user.id,
      'user_role_changed',
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
      details: `Your role was changed from ${oldRole} to ${role} by admin`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      data: user,
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
    
    if (!['active', 'inactive', 'suspended'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status specified'
      });
    }

    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const oldStatus = user.status;
    
    user.status = status;
    await user.save();

    // Log this admin activity
    await logAdminActivity(
      req.user.id,
      'user_status_changed',
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
      details: `Your account status was changed from ${oldStatus} to ${status} by admin`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
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
    const emissionCount = await Emission.countDocuments({ user: user._id });
    
    // Soft delete: set status to inactive instead of hard delete
    // This preserves data integrity for emissions and activities
    user.status = 'inactive';
    user.email = `deleted_${Date.now()}_${user.email}`;
    await user.save();

    // Log this admin activity
    await logAdminActivity(
      req.user.id,
      'user_deleted',
      'user',
      user._id,
      `Deleted user: ${user.name} (had ${emissionCount} emission records)`,
      req
    );

    res.json({
      success: true,
      message: 'User deleted successfully'
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