// controllers/userController.js - Fixed to use req.user.organisation_id
const { User, ActivityLog } = require('../models');
const bcrypt = require('bcryptjs');
const { assertOrganisationUserCapacity } = require('../utils/orgUserCapacity');

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
};

// Helper function to get organisation ID from request
const getOrganisationId = (req) => {
  return req.organisationId || req.user?.organisation_id || req.user?.organizationId;
};

// @desc    Get all users (scoped to organisation)
// @route   GET /api/users
// @access  Private (Admin, Analyst)
const getUsers = async (req, res) => {
  try {
    const organisationId = getOrganisationId(req);
    
    const query = {
      organisation_id: organisationId
    };

    if (req.query.role && req.query.role !== 'all') {
      query.role = req.query.role;
    }

    if (req.query.status && req.query.status !== 'all') {
      query.status = req.query.status;
    }

    if (req.query.search) {
      query.$or = [
        { name: new RegExp(req.query.search, 'i') },
        { email: new RegExp(req.query.search, 'i') }
      ];
    }

    let usersQuery = User.find(query).select('-password');

    if (req.query.limit) {
      usersQuery = usersQuery.limit(parseInt(req.query.limit));
    }

    const users = await usersQuery.sort({ created_at: -1 });

    const sanitizedUsers = users.map(user => ({
      id: user._id.toString(),
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      organisation_id: user.organisation_id,
      restrictions: user.restrictions,
      createdAt: user.created_at,
      created_at: user.created_at,
      lastLogin: user.last_login,
      last_login: user.last_login
    }));

    res.json({
      success: true,
      data: sanitizedUsers,
      total: sanitizedUsers.length
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch users'
    });
  }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const organisationId = getOrganisationId(req);

    // Check organisation access
    if (user.organisation_id !== organisationId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this user'
      });
    }

    res.json({
      success: true,
      data: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        organisation_id: user.organisation_id,
        restrictions: user.restrictions,
        created_at: user.created_at,
        updated_at: user.updated_at,
        last_login: user.last_login
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch user'
    });
  }
};

// @desc    Create new user
// @route   POST /api/users
// @access  Private (Admin only)
const createUser = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      status,
      allowedScopes,
      allowedActivities,
      restrictedPages,
      restrictions
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    const validRoles = ['admin', 'analyst', 'contributor', 'viewer'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Build restrictions object
    let userRestrictions = null;

    if (restrictions && typeof restrictions === 'object') {
      userRestrictions = restrictions;
    } else if ((role || 'contributor') === 'contributor') {
      if (allowedScopes || allowedActivities || restrictedPages) {
        userRestrictions = {
          allowedScopes: Array.isArray(allowedScopes) ? allowedScopes : [],
          allowedActivities: Array.isArray(allowedActivities) ? allowedActivities : [],
          restrictedPages: Array.isArray(restrictedPages) ? restrictedPages : []
        };
      }
    }

    const hashedPassword = await hashPassword(password);
    const organisationId = getOrganisationId(req);

    if (organisationId) {
      try {
        await assertOrganisationUserCapacity(organisationId);
      } catch (capErr) {
        return res.status(capErr.statusCode || 400).json({
          success: false,
          message: capErr.message
        });
      }
    }

    const newUser = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: role || 'contributor',
      status: status || 'active',
      restrictions: userRestrictions,
      organisation_id: organisationId,
      email_verified: true
    });

    await ActivityLog.create({
      user_id: req.user.id,
      action: 'user_created',
      resource_type: 'user',
      resource_id: newUser._id.toString(),
      details: `Created user: ${newUser.name} (${newUser.email}) with role: ${newUser.role}`,
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    const sanitizedUser = {
      id: newUser._id.toString(),
      _id: newUser._id.toString(),
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      status: newUser.status,
      organisation_id: newUser.organisation_id,
      restrictions: newUser.restrictions,
      createdAt: newUser.created_at,
      created_at: newUser.created_at
    };

    res.status(201).json({
      success: true,
      data: sanitizedUser,
      message: 'User created successfully'
    });

  } catch (error) {
    res.status(500).json({
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
    const { id } = req.params;
    const { role } = req.body;

    const validRoles = ['admin', 'analyst', 'contributor', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const organisationId = getOrganisationId(req);

    // MongoDB compatibility: Ensure both are strings
    const userOrgId = String(user.organisation_id);
    const reqOrgId = String(organisationId);

    if (userOrgId !== reqOrgId) {
      console.log('❌ Update Role - Organisation mismatch!');
      console.log('  User org:', userOrgId);
      console.log('  Request org:', reqOrgId);
      return res.status(403).json({
        success: false,
        message: 'You can only update users in your organisation'
      });
    }

    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot change your own role'
      });
    }

    user.role = role;
    user.updated_at = new Date();
    await user.save();

    await ActivityLog.create({
      user_id: req.user.id,
      action: 'user_role_updated',
      resource_type: 'user',
      resource_id: id,
      details: `Updated user ${user.email} role to ${role}`,
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    res.json({
      success: true,
      data: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        organisation_id: user.organisation_id,
        restrictions: user.restrictions
      },
      message: 'User role updated successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update user role'
    });
  }
};

// @desc    Update user restrictions
// @route   PATCH /api/users/:id/restrictions
// @access  Private (Admin only)
const updateUserRestrictions = async (req, res) => {
  try {
    const { id } = req.params;
    const { restrictions } = req.body;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const organisationId = getOrganisationId(req);

    // MongoDB compatibility: Ensure both are strings
    const userOrgId = String(user.organisation_id);
    const reqOrgId = String(organisationId);

    if (userOrgId !== reqOrgId) {
      return res.status(403).json({
        success: false,
        message: 'You can only update users in your organisation'
      });
    }

    user.restrictions = restrictions;
    user.updated_at = new Date();
    await user.save();

    await ActivityLog.create({
      user_id: req.user.id,
      action: 'user_restrictions_updated',
      resource_type: 'user',
      resource_id: id,
      details: `Updated restrictions for user ${user.email}`,
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    res.json({
      success: true,
      data: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        restrictions: user.restrictions
      },
      message: 'User restrictions updated successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update user restrictions'
    });
  }
};

// @desc    Update user status
// @route   PATCH /api/users/:id/status
// @access  Private (Admin only)
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['active', 'inactive', 'deleted'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const organisationId = getOrganisationId(req);

    console.log('🔍 Update User Status - Organisation Check:');
    console.log('  User organisation_id:', user.organisation_id);
    console.log('  Request organisationId (from helper):', organisationId);
    console.log('  req.organisationId:', req.organisationId);
    console.log('  req.user.organisation_id:', req.user?.organisation_id);

    // MongoDB compatibility: Ensure both are strings
    const userOrgId = String(user.organisation_id);
    const reqOrgId = String(organisationId);

    if (userOrgId !== reqOrgId) {
      console.log('❌ Organisation mismatch!');
      console.log('  User org (string):', userOrgId);
      console.log('  Request org (string):', reqOrgId);
      return res.status(403).json({
        success: false,
        message: 'You can only update users in your organisation'
      });
    }

    if (id === req.user.id && status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account'
      });
    }

    user.status = status;
    user.updated_at = new Date();
    await user.save();

    await ActivityLog.create({
      user_id: req.user.id,
      action: 'user_status_updated',
      resource_type: 'user',
      resource_id: id,
      details: `Updated user ${user.email} status to ${status}`,
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    console.log('✅ User status updated successfully');

    res.json({
      success: true,
      data: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        organisation_id: user.organisation_id,
        restrictions: user.restrictions
      },
      message: 'User status updated successfully'
    });

  } catch (error) {
    console.error('❌ Error updating user status:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update user status'
    });
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private (Admin only)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const organisationId = getOrganisationId(req);

    // MongoDB compatibility: Ensure both are strings
    const userOrgId = String(user.organisation_id);
    const reqOrgId = String(organisationId);

    if (userOrgId !== reqOrgId) {
      console.log('❌ Delete User - Organisation mismatch!');
      console.log('  User org:', userOrgId);
      console.log('  Request org:', reqOrgId);
      return res.status(403).json({
        success: false,
        message: 'You can only delete users in your organisation'
      });
    }

    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    await User.findByIdAndDelete(id);

    await ActivityLog.create({
      user_id: req.user.id,
      action: 'user_deleted',
      resource_type: 'user',
      resource_id: id,
      details: `Deleted user: ${user.name} (${user.email})`,
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete user'
    });
  }
};

// @desc    Get user activities
// @route   GET /api/users/:id/activities
// @access  Private (Admin only)
const getUserActivities = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const organisationId = getOrganisationId(req);

    // MongoDB compatibility: Ensure both are strings
    const userOrgId = String(user.organisation_id);
    const reqOrgId = String(organisationId);

    if (userOrgId !== reqOrgId) {
      return res.status(403).json({
        success: false,
        message: 'You can only view activities for users in your organisation'
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const activities = await ActivityLog.find({ user_id: id })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ActivityLog.countDocuments({ user_id: id });

    const formattedActivities = activities.map(activity => ({
      _id: activity._id.toString(),
      action: activity.action,
      resourceType: activity.resource_type,
      resourceId: activity.resource_id,
      details: activity.details,
      ipAddress: activity.ip_address,
      userAgent: activity.user_agent,
      createdAt: activity.created_at
    }));

    res.json({
      success: true,
      data: formattedActivities,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch user activities'
    });
  }
};

// @desc    Get user statistics
// @route   GET /api/users/stats
// @access  Private (Admin, Analyst)
const getUserStats = async (req, res) => {
  try {
    const organisationId = getOrganisationId(req);
    
    const totalUsers = await User.countDocuments({ organisation_id: organisationId });
    const activeUsers = await User.countDocuments({ organisation_id: organisationId, status: 'active' });
    const inactiveUsers = await User.countDocuments({ organisation_id: organisationId, status: 'inactive' });
    const deletedUsers = await User.countDocuments({ organisation_id: organisationId, status: 'deleted' });
    
    const adminUsers = await User.countDocuments({ organisation_id: organisationId, role: 'admin' });
    const analystUsers = await User.countDocuments({ organisation_id: organisationId, role: 'analyst' });
    const contributorUsers = await User.countDocuments({ organisation_id: organisationId, role: 'contributor' });
    const viewerUsers = await User.countDocuments({ organisation_id: organisationId, role: 'viewer' });

    const stats = {
      totalUsers,
      activeUsers,
      inactiveUsers,
      suspendedUsers: deletedUsers,
      adminUsers,
      analystUsers,
      contributorUsers,
      viewerUsers
    };

    res.json({
      success: true,
      data: {
        overview: stats
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch user statistics'
    });
  }
};

// @desc    Get RBAC options
// @route   GET /api/users/rbac-options
// @access  Private (Admin)
const getRBACOptions = async (req, res) => {
  try {
    const rbacOptions = {
      roles: [
        {
          value: 'admin',
          label: 'Administrator',
          description: 'Full access to all features and data within the organisation',
          permissions: ['manage_users', 'manage_emissions', 'view_analytics', 'manage_settings']
        },
        {
          value: 'analyst',
          label: 'Analyst',
          description: 'Analytics and verification capabilities',
          permissions: ['view_analytics', 'verify_emissions', 'view_reports']
        },
        {
          value: 'contributor',
          label: 'Contributor',
          description: 'Data entry and management',
          permissions: ['create_emissions', 'edit_own_emissions', 'view_own_data']
        },
        {
          value: 'viewer',
          label: 'Viewer',
          description: 'Read-only access to data and analytics',
          permissions: ['view_data', 'view_analytics']
        }
      ],
      scopes: [
        { value: 1, label: 'Scope 1', description: 'Direct emissions' },
        { value: 2, label: 'Scope 2', description: 'Indirect emissions from purchased energy' },
        { value: 3, label: 'Scope 3', description: 'Indirect emissions from value chain' }
      ],
      restrictionTypes: [
        {
          key: 'allowedScopes',
          label: 'Allowed Scopes',
          description: 'Limit which emission scopes the user can access',
          type: 'multi-select'
        },
        {
          key: 'allowedActivities',
          label: 'Allowed Activities',
          description: 'Limit which activities the user can perform',
          type: 'multi-select'
        },
        {
          key: 'restrictedPages',
          label: 'Restricted Pages',
          description: 'Pages the user cannot access',
          type: 'multi-select'
        }
      ]
    };

    res.json({
      success: true,
      data: rbacOptions
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch RBAC options'
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
        message: 'userIds array is required'
      });
    }

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'updates object is required'
      });
    }

    const organisationId = getOrganisationId(req);

    const results = {
      success: [],
      failed: []
    };

    // Update each user
    for (const userId of userIds) {
      try {
        const user = await User.findById(userId);

        if (!user) {
          results.failed.push({ userId, reason: 'User not found' });
          continue;
        }

        // MongoDB compatibility: Ensure both are strings
        const userOrgId = String(user.organisation_id);
        const reqOrgId = String(organisationId);

        if (userOrgId !== reqOrgId) {
          results.failed.push({ userId, reason: 'Not in your organisation' });
          continue;
        }

        // Don't allow updating own account in bulk
        if (userId === req.user.id) {
          results.failed.push({ userId, reason: 'Cannot update own account' });
          continue;
        }

        // Apply updates
        Object.keys(updates).forEach(key => {
          if (key !== '_id' && key !== 'organisation_id' && key !== 'password') {
            user[key] = updates[key];
          }
        });

        user.updated_at = new Date();
        await user.save();

        results.success.push(userId);

        // Log activity
        await ActivityLog.create({
          user_id: req.user.id,
          action: 'user_bulk_updated',
          resource_type: 'user',
          resource_id: userId,
          details: `Bulk updated user ${user.email}`,
          ip_address: req.ip,
          user_agent: req.get('User-Agent')
        });

      } catch (error) {
        results.failed.push({ userId, reason: error.message });
      }
    }

    res.json({
      success: true,
      data: results,
      message: `Updated ${results.success.length} of ${userIds.length} users`
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to bulk update users'
    });
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUserRole,
  updateUserRestrictions,
  updateUserStatus,
  deleteUser,
  getUserActivities,
  getUserStats,
  getRBACOptions,
  bulkUpdateUsers
};