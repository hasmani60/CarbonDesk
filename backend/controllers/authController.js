// controllers/authController.js - Fixed to ensure clean organisation context
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const localDB = require('../database/localDB');
const logger = require('../utils/logger');

// Generate JWT Token with role information and restrictions
const generateToken = (user) => {
  logger.debug('Generating token for user', {
    id: user.id,
    email: user.email,
    role: user.role,
    organisation_id: user.organisation_id
  });

  return jwt.sign(
    { 
      id: user.id,
      role: user.role,
      organisation_id: user.organisation_id, // CRITICAL: Include in token
      restrictions: user.restrictions
    }, 
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '30d' }
  );
};

// @desc    Register user (Admin only for creating users)
// @route   POST /api/auth/register
// @access  Private (Admin only)
const register = async (req, res) => {
  try {
    const { name, email, password, role = 'contributor', restrictions = null } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password'
      });
    }

    // Validate role
    const validRoles = ['admin', 'analyst', 'contributor', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified. Must be one of: admin, analyst, contributor, viewer'
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

    // Create user
    const userData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role,
      status: 'active',
      restrictions: restrictions
    };

    const user = await localDB.createUser(userData);

    // Generate token
    const token = generateToken(user);

    // Log registration activity
    await localDB.logActivity({
      userId: user.id,
      action: 'user_registered',
      resourceType: 'user',
      resourceId: user.id,
      details: `User ${user.name} registered with role: ${user.role}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    logger.info('User registered successfully', { email: user.email, role: user.role });

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          restrictions: user.restrictions,
          organisation_id: user.organisation_id,
          lastLogin: new Date()
        }
      }
    });
  } catch (error) {
    logger.error('Registration error', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Registration failed'
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    logger.audit('Login attempt', { email });

    // Validate email and password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find user in local database
    const user = await localDB.findUserByEmail(email.toLowerCase());
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }


    // Check if account is active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account is not active. Please contact administrator.'
      });
    }

    // Verify password
    const isPasswordCorrect = await localDB.verifyPassword(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last login
    await localDB.updateLastLogin(user.id);

    // Log login activity
    await localDB.logActivity({
      userId: user.id,
      action: 'login',
      resourceType: 'user',
      resourceId: user.id,
      details: 'User logged in successfully',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    const token = generateToken(user);

    logger.audit('Login successful', { email, organisationId: user.organisation_id });

    // CRITICAL: Return complete user data with organisation context
    return res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          restrictions: user.restrictions,
          organisation_id: user.organisation_id, // CRITICAL
          lastLogin: new Date()
        }
      },
      message: user.organisation_id 
        ? `Welcome back! Logged into organisation ID: ${user.organisation_id}` 
        : 'Welcome back! Please contact admin to assign you to an organisation.'
    });

  } catch (error) {
    logger.error('Login error', error);
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.'
    });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/verify
// @access  Private
const verifyToken = async (req, res) => {
  try {
    // Get user from local database
    const user = await localDB.findUserById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }


    return res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        restrictions: user.restrictions,
        organisation_id: user.organisation_id, // CRITICAL
        lastLogin: user.last_login
      }
    });
  } catch (error) {
    logger.error('Token verification error', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res) => {
  try {
    // Log logout activity
    await localDB.logActivity({
      userId: req.user.id,
      action: 'logout',
      resourceType: 'user',
      resourceId: req.user.id,
      details: 'User logged out',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('Logout error', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update user profile
// @route   PATCH /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { name, email, phone, company, bio } = req.body;

    const updates = {};
    if (name) updates.name = name;
    if (email) updates.email = email;
    // Note: phone, company, bio would need additional columns in database
    
    await localDB.updateUser(req.user.id, updates);
    
    // Get updated user
    const updatedUser = await localDB.findUserById(req.user.id);

    // Log profile update activity
    await localDB.logActivity({
      userId: req.user.id,
      action: 'profile_update',
      resourceType: 'user',
      resourceId: req.user.id,
      details: 'User updated profile information',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    return res.json({
      success: true,
      data: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        status: updatedUser.status,
        restrictions: updatedUser.restrictions,
        organisation_id: updatedUser.organisation_id
      }
    });
  } catch (error) {
    logger.error('Profile update error', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Change password
// @route   PATCH /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    // Get user and verify current password
    const user = await localDB.findUserById(req.user.id);
    const isCurrentPasswordCorrect = await localDB.verifyPassword(currentPassword, user.password);
    
    if (!isCurrentPasswordCorrect) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password and update
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await localDB.updateUser(req.user.id, { password: hashedPassword });

    // Log password change activity
    await localDB.logActivity({
      userId: req.user.id,
      action: 'password_change',
      resourceType: 'user',
      resourceId: req.user.id,
      details: 'User changed password',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    return res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    logger.error('Password change error', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  register,
  login,
  verifyToken,
  logout,
  updateProfile,
  changePassword
};