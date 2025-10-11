// backend/controllers/userController.js
// Complete user controller with RBAC restrictions support

const localDB = require('../database/localDB');
const { scopeQuery } = require('../middleware/organisationScope');

// @desc    Get all users (scoped to organisation)
// @route   GET /api/users
// @access  Private (Admin, Analyst)
const getUsers = async (req, res) => {
  try {
    console.log('👥 Getting users for org:', req.organisationId, 'by:', req.user.email);
    
    // Build filters
    const filters = {
      role: req.query.role,
      status: req.query.status,
      search: req.query.search,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined
    };
    
    // ADD ORGANISATION FILTER (Critical!)
    if (req.organisationId) {
      filters.organisation_id = req.organisationId;
      console.log('🔒 Filtering users by organisation:', req.organisationId);
    } else {
      console.warn('⚠️  No organisation filter - user may see all users!');
    }
    
    // Get users from database
    const users = await localDB.getAllUsers(filters);
    
    // Remove sensitive data (password already excluded by getAllUsers)
    const sanitizedUsers = users.map(user => ({
      id: user.id,
      _id: user.id, // Add _id for frontend compatibility
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      organisation_id: user.organisation_id,
      restrictions: user.restrictions,
      createdAt: user.created_at,
      created_at: user.created_at,
      lastLogin: user.last_login,
      last_login: user.last_login,
      statistics: {
        totalActivities: 0,
        lastActivity: user.last_login
      }
    }));
    
    console.log(`✅ Found ${sanitizedUsers.length} users in organisation: ${req.organisation?.name}`);
    
    res.json({
      success: true,
      data: sanitizedUsers,
      total: sanitizedUsers.length,
      organisation: req.organisation?.name || 'N/A',
      filters: {
        role: filters.role,
        status: filters.status,
        search: filters.search
      }
    });
    
  } catch (error) {
    console.error('❌ Get users error:', error);
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
    const { id } = req.params;
    
    console.log('🔍 Getting user:', id, 'for org:', req.organisationId);
    
    // Get user
    const user = await localDB.findUserById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if user belongs to same organisation
    if (user.organisation_id !== req.organisationId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this user'
      });
    }
    
    // Remove sensitive data
    const sanitizedUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      organisation_id: user.organisation_id,
      restrictions: user.restrictions,
      created_at: user.created_at,
      updated_at: user.updated_at,
      last_login: user.last_login
    };
    
    res.json({
      success: true,
      data: sanitizedUser
    });
    
  } catch (error) {
    console.error('❌ Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch user'
    });
  }
};

// @desc    Create new user (admin only, scoped to organisation)
// @route   POST /api/users
// @access  Private (Admin only)
const createUser = async (req, res) => {
  try {
    console.log('➕ Creating user for org:', req.organisationId, 'by admin:', req.user.email);
    console.log('📦 Request body:', JSON.stringify(req.body, null, 2));
    
    const { 
      name, 
      email, 
      password, 
      role, 
      status,
      allowedScopes,
      allowedActivities,
      restrictedPages,
      restrictions // Also support restrictions object directly
    } = req.body;
    
    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required'
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }
    
    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }
    
    // Validate role
    const validRoles = ['admin', 'analyst', 'contributor', 'viewer'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
      });
    }
    
    // Check if email already exists
    const existingUser = await localDB.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }
    
    // CRITICAL: Build restrictions object properly
    let userRestrictions = null;
    
    // If restrictions object is provided directly, use it
    if (restrictions && typeof restrictions === 'object') {
      userRestrictions = restrictions;
    } 
    // Otherwise, build from individual fields (frontend sends these)
    else if ((role || 'contributor') === 'contributor') {
      // Only create restrictions object if at least one restriction is provided
      if (allowedScopes || allowedActivities || restrictedPages) {
        userRestrictions = {
          allowedScopes: Array.isArray(allowedScopes) ? allowedScopes : [],
          allowedActivities: Array.isArray(allowedActivities) ? allowedActivities : [],
          restrictedPages: Array.isArray(restrictedPages) ? restrictedPages : []
        };
        
        console.log('🔒 Built restrictions object:', JSON.stringify(userRestrictions, null, 2));
      }
    }
    
    // Prepare user data
    const userData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: role || 'contributor',
      status: status || 'active',
      restrictions: userRestrictions, // CRITICAL: Pass restrictions here
      organisation_id: req.organisationId // CRITICAL: Add organisation
    };
    
    console.log('🔐 Creating user with data:', {
      name: userData.name,
      email: userData.email,
      role: userData.role,
      status: userData.status,
      organisation_id: userData.organisation_id,
      restrictions: userData.restrictions
    });
    
    // Create user
    const newUser = await localDB.createUser(userData);
    
    console.log('✅ User created in database with ID:', newUser.id);
    console.log('🔒 Restrictions saved:', JSON.stringify(newUser.restrictions, null, 2));
    
    // Log activity
    await localDB.logActivity({
      userId: req.user.id,
      action: 'user_created',
      resourceType: 'user',
      resourceId: newUser.id,
      details: `Created user: ${newUser.name} (${newUser.email}) with role: ${newUser.role}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    // Remove password from response
    const sanitizedUser = {
      id: newUser.id,
      _id: newUser.id, // Add _id for frontend compatibility
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      status: newUser.status,
      organisation_id: newUser.organisation_id,
      restrictions: newUser.restrictions, // CRITICAL: Include restrictions in response
      createdAt: newUser.created_at,
      created_at: newUser.created_at
    };
    
    console.log(`✅ User created successfully: ${newUser.email} for organisation: ${req.organisation?.name}`);
    console.log('📤 Sending response with restrictions:', JSON.stringify(sanitizedUser.restrictions, null, 2));
    
    res.status(201).json({
      success: true,
      data: sanitizedUser,
      message: 'User created successfully'
    });
    
  } catch (error) {
    console.error('❌ Create user error:', error);
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
    
    console.log('✏️ Updating user role:', id, 'to:', role, 'by admin:', req.user.email);
    
    // Validate role
    const validRoles = ['admin', 'analyst', 'contributor', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
      });
    }
    
    // Get user to check organisation
    const user = await localDB.findUserById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if user belongs to same organisation
    if (user.organisation_id !== req.organisationId) {
      return res.status(403).json({
        success: false,
        message: 'You can only update users in your organisation'
      });
    }
    
    // Prevent admin from changing their own role
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot change your own role'
      });
    }
    
    // Update role
    await localDB.updateUser(id, { role });
    
    // Get updated user
    const updatedUser = await localDB.findUserById(id);
    
    // Log activity
    await localDB.logActivity({
      userId: req.user.id,
      action: 'user_role_updated',
      resourceType: 'user',
      resourceId: id,
      details: `Updated user ${user.email} role from ${user.role} to ${role}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    console.log(`✅ User role updated: ${user.email} -> ${role}`);
    
    res.json({
      success: true,
      data: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        status: updatedUser.status,
        organisation_id: updatedUser.organisation_id,
        restrictions: updatedUser.restrictions
      },
      message: 'User role updated successfully'
    });
    
  } catch (error) {
    console.error('❌ Update user role error:', error);
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
    const { 
      restrictions,
      allowedScopes,
      allowedActivities,
      restrictedPages
    } = req.body;
    
    console.log('✏️ Updating user restrictions:', id, 'by admin:', req.user.email);
    console.log('📦 Received data:', JSON.stringify(req.body, null, 2));
    
    // Get user to check organisation
    const user = await localDB.findUserById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if user belongs to same organisation
    if (user.organisation_id !== req.organisationId) {
      return res.status(403).json({
        success: false,
        message: 'You can only update users in your organisation'
      });
    }
    
    // Build restrictions object
    let userRestrictions = null;
    
    // If restrictions object is provided directly, use it
    if (restrictions && typeof restrictions === 'object') {
      userRestrictions = restrictions;
    }
    // Otherwise, build from individual fields
    else if (allowedScopes || allowedActivities || restrictedPages) {
      userRestrictions = {
        allowedScopes: Array.isArray(allowedScopes) ? allowedScopes : [],
        allowedActivities: Array.isArray(allowedActivities) ? allowedActivities : [],
        restrictedPages: Array.isArray(restrictedPages) ? restrictedPages : []
      };
    }
    
    console.log('🔒 Updating to restrictions:', JSON.stringify(userRestrictions, null, 2));
    
    // Update restrictions
    await localDB.updateUser(id, { restrictions: userRestrictions });
    
    // Get updated user
    const updatedUser = await localDB.findUserById(id);
    
    // Log activity
    await localDB.logActivity({
      userId: req.user.id,
      action: 'user_restrictions_updated',
      resourceType: 'user',
      resourceId: id,
      details: `Updated restrictions for user ${user.email}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    console.log(`✅ User restrictions updated: ${user.email}`);
    console.log('🔒 New restrictions:', JSON.stringify(updatedUser.restrictions, null, 2));
    
    res.json({
      success: true,
      data: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        restrictions: updatedUser.restrictions
      },
      message: 'User restrictions updated successfully'
    });
    
  } catch (error) {
    console.error('❌ Update user restrictions error:', error);
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
    
    console.log('✏️ Updating user status:', id, 'to:', status, 'by admin:', req.user.email);
    
    // Validate status
    const validStatuses = ['active', 'inactive', 'suspended'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }
    
    // Get user to check organisation
    const user = await localDB.findUserById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if user belongs to same organisation
    if (user.organisation_id !== req.organisationId) {
      return res.status(403).json({
        success: false,
        message: 'You can only update users in your organisation'
      });
    }
    
    // Prevent admin from deactivating themselves
    if (parseInt(id) === req.user.id && status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account'
      });
    }
    
    // Update status
    await localDB.updateUser(id, { status });
    
    // Get updated user
    const updatedUser = await localDB.findUserById(id);
    
    // Log activity
    await localDB.logActivity({
      userId: req.user.id,
      action: 'user_status_updated',
      resourceType: 'user',
      resourceId: id,
      details: `Updated user ${user.email} status from ${user.status} to ${status}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    console.log(`✅ User status updated: ${user.email} -> ${status}`);
    
    res.json({
      success: true,
      data: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        status: updatedUser.status
      },
      message: 'User status updated successfully'
    });
    
  } catch (error) {
    console.error('❌ Update user status error:', error);
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
    
    console.log('🗑️ Deleting user:', id, 'by admin:', req.user.email);
    
    // Get user to check organisation
    const user = await localDB.findUserById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if user belongs to same organisation
    if (user.organisation_id !== req.organisationId) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete users in your organisation'
      });
    }
    
    // Prevent admin from deleting themselves
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }
    
    // Soft delete (set status to inactive)
    await localDB.deleteUser(id);
    
    // Log activity
    await localDB.logActivity({
      userId: req.user.id,
      action: 'user_deleted',
      resourceType: 'user',
      resourceId: id,
      details: `Deleted user: ${user.email}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    console.log(`✅ User deleted: ${user.email}`);
    
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ Delete user error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete user'
    });
  }
};

// @desc    Get user statistics (scoped to organisation)
// @route   GET /api/users/stats
// @access  Private (Admin, Analyst)
const getUserStats = async (req, res) => {
  try {
    console.log('📊 Getting user stats for org:', req.organisationId);
    
    // Get stats scoped to organisation
    const stats = await new Promise((resolve, reject) => {
      localDB.db.get(
        `SELECT 
          COUNT(*) as totalUsers,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as activeUsers,
          SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactiveUsers,
          SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) as suspendedUsers,
          SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as adminUsers,
          SUM(CASE WHEN role = 'analyst' THEN 1 ELSE 0 END) as analystUsers,
          SUM(CASE WHEN role = 'contributor' THEN 1 ELSE 0 END) as contributorUsers,
          SUM(CASE WHEN role = 'viewer' THEN 1 ELSE 0 END) as viewerUsers
        FROM users
        WHERE organisation_id = ?`,
        [req.organisationId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    res.json({
      success: true,
      data: {
        overview: stats
      },
      organisation: req.organisation?.name || 'N/A'
    });
    
  } catch (error) {
    console.error('❌ Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch user statistics'
    });
  }
};

// @desc    Get RBAC options (roles and restrictions)
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
          description: 'Restrict which emission scopes the user can access',
          type: 'array'
        },
        {
          key: 'allowedActivities',
          label: 'Allowed Activities',
          description: 'Restrict which activities the user can work with',
          type: 'array'
        },
        {
          key: 'restrictedPages',
          label: 'Restricted Pages',
          description: 'Pages the user cannot access',
          type: 'array'
        }
      ]
    };
    
    res.json({
      success: true,
      data: rbacOptions
    });
    
  } catch (error) {
    console.error('❌ Get RBAC options error:', error);
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
    
    console.log('📦 Bulk updating users:', userIds, 'by admin:', req.user.email);
    
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
    
    const results = {
      success: [],
      failed: []
    };
    
    // Update each user
    for (const userId of userIds) {
      try {
        // Get user to check organisation
        const user = await localDB.findUserById(userId);
        
        if (!user) {
          results.failed.push({ userId, reason: 'User not found' });
          continue;
        }
        
        // Check if user belongs to same organisation
        if (user.organisation_id !== req.organisationId) {
          results.failed.push({ userId, reason: 'Not in your organisation' });
          continue;
        }
        
        // Don't allow updating own account in bulk
        if (parseInt(userId) === req.user.id) {
          results.failed.push({ userId, reason: 'Cannot update own account' });
          continue;
        }
        
        // Update user
        await localDB.updateUser(userId, updates);
        results.success.push(userId);
        
        // Log activity
        await localDB.logActivity({
          userId: req.user.id,
          action: 'user_bulk_updated',
          resourceType: 'user',
          resourceId: userId,
          details: `Bulk updated user ${user.email}`,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
        
      } catch (error) {
        results.failed.push({ userId, reason: error.message });
      }
    }
    
    console.log(`✅ Bulk update complete: ${results.success.length} success, ${results.failed.length} failed`);
    
    res.json({
      success: true,
      data: results,
      message: `Updated ${results.success.length} of ${userIds.length} users`
    });
    
  } catch (error) {
    console.error('❌ Bulk update error:', error);
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
  getUserStats,
  getRBACOptions,
  bulkUpdateUsers
};