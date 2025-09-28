// controllers/userController.js - Updated with Local DB and Enhanced RBAC
const bcrypt = require('bcryptjs');
const localDB = require('../database/localDB');
const { emissionFactors } = require('../data/emissionFactors'); // Import emission factors for activity selection

// Helper function to log admin activity
const logAdminActivity = async (adminId, action, resourceType, resourceId, details, req) => {
  try {
    await localDB.logActivity({
      userId: adminId,
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

    const filters = {};
    if (role && role !== 'all') filters.role = role;
    if (status && status !== 'all') filters.status = status;
    if (search) filters.search = search;
    if (limit !== 'all') filters.limit = parseInt(limit);

    const users = await localDB.getAllUsers(filters);

    // Calculate statistics for each user
    const usersWithStats = users.map(user => ({
      ...user,
      statistics: {
        emissionCount: 0, // Would need to calculate from emissions
        recentActivityCount: 0, // Would need to calculate from activities
        joinedDaysAgo: Math.floor((new Date() - new Date(user.created_at)) / (1000 * 60 * 60 * 24))
      }
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
        totalPages: Math.ceil(users.length / parseInt(limit)),
        totalItems: users.length,
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
    const user = await localDB.findUserById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's recent activities
    const recentActivities = await localDB.getUserActivities(user.id, 10);

    const userWithStats = {
      ...user,
      statistics: {
        recentActivities,
        totalActivities: recentActivities.length,
        totalEmissionRecords: 0 // Would calculate from emissions
      }
    };

    // Log this admin activity
    await logAdminActivity(
      req.user.id,
      'viewed_user_detail',
      'user',
      user.id,
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

// @desc    Create new user (Admin only) - ENHANCED WITH RBAC
// @route   POST /api/users
// @access  Private (Admin only)
const createUser = async (req, res) => {
  try {
    console.log('📝 CREATE USER REQUEST BODY:', JSON.stringify(req.body, null, 2));
    
    const { 
      name, 
      email, 
      password, 
      role = 'contributor', 
      status = 'active',
      // Enhanced RBAC restrictions
      allowedScopes = [],
      allowedActivities = [],
      restrictedPages = []
    } = req.body;

    console.log('📊 EXTRACTED VALUES:');
    console.log('- Name:', name);
    console.log('- Email:', email);
    console.log('- Role:', role);
    console.log('- Allowed Scopes:', allowedScopes);
    console.log('- Allowed Activities:', allowedActivities);
    console.log('- Restricted Pages:', restrictedPages);

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

    // Check if user already exists
    const existingUser = await localDB.findUserByEmail(email.toLowerCase());
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // ENHANCED: Build restrictions object (even for non-contributors for debugging)
    let restrictions = null;
    
    // For contributors, always create restrictions object
    if (role === 'contributor') {
      console.log('🔒 BUILDING RESTRICTIONS FOR CONTRIBUTOR:');
      
      // Ensure we have arrays
      const finalAllowedScopes = Array.isArray(allowedScopes) ? allowedScopes : [];
      const finalAllowedActivities = Array.isArray(allowedActivities) ? allowedActivities : [];
      const finalRestrictedPages = Array.isArray(restrictedPages) ? restrictedPages : [];
      
      console.log('- Final Allowed Scopes:', finalAllowedScopes);
      console.log('- Final Allowed Activities:', finalAllowedActivities);
      console.log('- Final Restricted Pages:', finalRestrictedPages);

      // Build restrictions object
      restrictions = {
        allowedScopes: finalAllowedScopes,
        allowedActivities: finalAllowedActivities,
        restrictedPages: finalRestrictedPages,
        createdAt: new Date().toISOString(),
        createdBy: req.user.id,
        version: '2.0'
      };

      console.log('📦 FINAL RESTRICTIONS OBJECT:', JSON.stringify(restrictions, null, 2));

      // Validate that contributor has some access
      const hasAnyAccess = finalAllowedScopes.length > 0 || finalAllowedActivities.length > 0;
      
      if (!hasAnyAccess) {
        console.log('❌ VALIDATION FAILED: No access granted');
        return res.status(400).json({
          success: false,
          message: 'Contributor must have access to at least one scope or activity'
        });
      }
    } else {
      console.log(`ℹ️  Role is ${role}, no restrictions needed`);
    }

    // Create user data object
    const userData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role,
      status,
      restrictions: restrictions
    };

    console.log('👤 USER DATA TO BE CREATED:', {
      ...userData,
      password: '[HIDDEN]',
      restrictions: userData.restrictions
    });

    // Create user
    const user = await localDB.createUser(userData);
    console.log('✅ USER CREATED SUCCESSFULLY:', user.id);

    // Verify the user was created with restrictions
    const verifyUser = await localDB.findUserById(user.id);
    console.log('🔍 VERIFICATION - User from DB:', {
      id: verifyUser.id,
      name: verifyUser.name,
      email: verifyUser.email,
      role: verifyUser.role,
      restrictions: verifyUser.restrictions
    });

    // Log this admin activity with enhanced details
    await logAdminActivity(
      req.user.id,
      'created_user_with_granular_access',
      'user',
      user.id,
      `Created new user: ${user.name} (${user.email}) with role: ${user.role}` +
      (restrictions ? 
        ` | Scopes: [${restrictions.allowedScopes.join(', ')}] | Activities: ${restrictions.allowedActivities.length}` : 
        ' | No restrictions'
      ),
      req
    );

    // Return user without password
    const userResponse = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      restrictions: user.restrictions,
      createdAt: new Date(),
      statistics: {
        emissionCount: 0,
        recentActivityCount: 1,
        joinedDaysAgo: 0
      }
    };

    // Generate success message with access summary
    let successMessage = `User created successfully with role: ${role}`;
    if (restrictions && restrictions.allowedScopes.length > 0) {
      successMessage += ` | Scope access: ${restrictions.allowedScopes.join(', ')}`;
    }
    if (restrictions && restrictions.allowedActivities.length > 0) {
      successMessage += ` | Activity restrictions: ${restrictions.allowedActivities.length} specific activities`;
    }

    console.log('🎉 SUCCESS MESSAGE:', successMessage);

    res.status(201).json({
      success: true,
      data: userResponse,
      message: successMessage
    });
  } catch (error) {
    console.error('❌ CREATE USER ERROR:', error);
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

    const user = await localDB.findUserById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent user from changing their own role
    if (user.id.toString() === req.user.id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot change your own role'
      });
    }

    const oldRole = user.role;
    
    // Update user role
    await localDB.updateUser(user.id, { role });

    // Log this admin activity
    await logAdminActivity(
      req.user.id,
      'updated_user_role',
      'user',
      user.id,
      `Changed user role: ${user.name} from ${oldRole} to ${role}`,
      req
    );

    // Get updated user
    const updatedUser = await localDB.findUserById(user.id);

    res.json({
      success: true,
      data: updatedUser,
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

// @desc    Update user restrictions (for contributors)
// @route   PATCH /api/users/:id/restrictions
// @access  Private (Admin only)
const updateUserRestrictions = async (req, res) => {
  try {
    const { allowedScopes, allowedActivities, restrictedPages } = req.body;
    
    const user = await localDB.findUserById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role !== 'contributor') {
      return res.status(400).json({
        success: false,
        message: 'Enhanced restrictions can only be applied to contributors'
      });
    }

    // Validate the new restrictions format
    const validScopes = [1, 2, 3];
    if (allowedScopes && allowedScopes.length > 0) {
      const invalidScopes = allowedScopes.filter(scope => !validScopes.includes(scope));
      if (invalidScopes.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid scopes: ${invalidScopes.join(', ')}`
        });
      }
    }

    // Validate activities against available emission factors
    const availableActivities = {
      1: Object.keys(emissionFactors.scope1 || {}),
      2: Object.keys(emissionFactors.scope2 || {}),
      3: Object.keys(emissionFactors.scope3 || {})
    };

    if (allowedActivities && allowedActivities.length > 0) {
      const allValidActivities = [
        ...availableActivities[1],
        ...availableActivities[2],
        ...availableActivities[3]
      ];
      
      const invalidActivities = allowedActivities.filter(activity => 
        !allValidActivities.includes(activity)
      );
      
      if (invalidActivities.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid activities: ${invalidActivities.join(', ')}`
        });
      }
    }

    // Build enhanced restrictions
    const restrictions = {
      allowedScopes: allowedScopes || [],
      allowedActivities: allowedActivities || [],
      restrictedPages: restrictedPages || [],
      updatedAt: new Date(),
      updatedBy: req.user.id,
      version: '2.0'
    };

    // Ensure user has some access
    const hasAnyAccess = restrictions.allowedScopes.length > 0 || 
                        restrictions.allowedActivities.length > 0;
    
    if (!hasAnyAccess) {
      return res.status(400).json({
        success: false,
        message: 'User must have access to at least one scope or activity'
      });
    }

    // Update user restrictions
    await localDB.updateUser(user.id, { restrictions });

    // Log this admin activity
    await logAdminActivity(
      req.user.id,
      'updated_user_restrictions_granular',
      'user',
      user.id,
      `Updated granular restrictions for contributor: ${user.name} | ` +
      `Scopes: [${restrictions.allowedScopes.join(', ')}] | ` +
      `Activities: ${restrictions.allowedActivities.length}`,
      req
    );

    // Get updated user
    const updatedUser = await localDB.findUserById(user.id);

    res.json({
      success: true,
      data: updatedUser,
      message: 'Enhanced user restrictions updated successfully'
    });
  } catch (error) {
    console.error('Update user restrictions error:', error);
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

    const user = await localDB.findUserById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent user from changing their own status
    if (user.id.toString() === req.user.id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot change your own status'
      });
    }

    const oldStatus = user.status;
    
    // Update user status
    await localDB.updateUser(user.id, { status });

    // Log this admin activity
    await logAdminActivity(
      req.user.id,
      'updated_user_status',
      'user',
      user.id,
      `Changed user status: ${user.name} from ${oldStatus} to ${status}`,
      req
    );

    // Get updated user
    const updatedUser = await localDB.findUserById(user.id);

    res.json({
      success: true,
      data: updatedUser,
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
    const user = await localDB.findUserById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent admin from deleting themselves
    if (user.id.toString() === req.user.id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    // Soft delete the user
    await localDB.deleteUser(user.id);

    // Log this admin activity
    await logAdminActivity(
      req.user.id,
      'deleted_user',
      'user',
      user.id,
      `Deleted user: ${user.name} (${user.email})`,
      req
    );

    res.json({
      success: true,
      message: 'User deleted successfully',
      data: {
        deletedUser: user.name,
        originalEmail: user.email
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
    const stats = await localDB.getUserStats();

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
        overview: {
          totalUsers: stats.totalUsers || 0,
          activeUsers: stats.activeUsers || 0,
          inactiveUsers: stats.inactiveUsers || 0,
          suspendedUsers: 0, // Would need to add this to query
          adminUsers: stats.adminUsers || 0,
          analystUsers: stats.analystUsers || 0,
          contributorUsers: stats.contributorUsers || 0,
          viewerUsers: stats.viewerUsers || 0
        },
        registrationTrends: [] // Would need to implement date-based grouping
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

// @desc    Get available scopes and activities for RBAC setup
// @route   GET /api/users/rbac-options
// @access  Private (Admin only)
const getRBACOptions = async (req, res) => {
  try {
    const rbacOptions = {
      scopes: [
        { value: 1, label: 'Scope 1 - Direct Emissions' },
        { value: 2, label: 'Scope 2 - Indirect Emissions (Energy)' },
        { value: 3, label: 'Scope 3 - Indirect Emissions (Value Chain)' }
      ],
      activities: {
        1: Object.keys(emissionFactors.scope1 || {}),
        2: Object.keys(emissionFactors.scope2 || {}),
        3: Object.keys(emissionFactors.scope3 || {})
      },
      activityDetails: {
        1: emissionFactors.scope1 || {},
        2: emissionFactors.scope2 || {},
        3: emissionFactors.scope3 || {}
      },
      roles: [
        { value: 'admin', label: 'Administrator', description: 'Full system access' },
        { value: 'analyst', label: 'Analyst', description: 'Analytics & Settings access only' },
        { value: 'contributor', label: 'Contributor', description: 'Input & Settings access (with optional restrictions)' },
        { value: 'viewer', label: 'Viewer', description: 'Dashboard, Monitor, Analytics & Settings (read-only)' }
      ]
    };

    res.json({
      success: true,
      data: rbacOptions
    });
  } catch (error) {
    console.error('Get RBAC options error:', error);
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
    const allowedFields = ['role', 'status', 'restrictions'];
    const updateFields = Object.keys(updates);
    const invalidFields = updateFields.filter(field => !allowedFields.includes(field));
    
    if (invalidFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid fields: ${invalidFields.join(', ')}`
      });
    }

    let modifiedCount = 0;
    for (const userId of userIds) {
      try {
        await localDB.updateUser(userId, updates);
        modifiedCount++;
      } catch (error) {
        console.error(`Failed to update user ${userId}:`, error);
      }
    }

    // Log this admin activity
    await logAdminActivity(
      req.user.id,
      'bulk_updated_users',
      'user',
      null,
      `Bulk updated ${modifiedCount} users with: ${JSON.stringify(updates)}`,
      req
    );

    res.json({
      success: true,
      data: {
        matched: userIds.length,
        modified: modifiedCount
      },
      message: `Successfully updated ${modifiedCount} users`
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
  updateUserRestrictions, // NEW: For managing contributor restrictions
  updateUserStatus,
  deleteUser,
  getUserStats,
  getRBACOptions, // NEW: For getting RBAC dropdown options
  bulkUpdateUsers
};