// controllers/authController.js - Updated for multi-user support
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, Activity } = require('../models');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'your-secret-key', {
    expiresIn: '30d'
  });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const { name, email, password, role = 'contributor' } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password'
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
      status: 'active'
    });

    // Generate token
    const token = generateToken(user._id);

    // Log registration activity
    await Activity.create({
      user: user._id,
      action: 'user_registered',
      resourceType: 'user',
      resourceId: user._id,
      details: `User ${user.name} registered with role: ${user.role}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    console.log('User registered successfully:', user.email);

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          lastLogin: new Date()
        }
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
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

    console.log('Login attempt:', { email, password }); // Debug log

    // Validate email and password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Try to find user in database first
    let user;
    try {
      user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    } catch (dbError) {
      console.log('Database not available, checking demo credentials');
    }

    // If database user found, authenticate against database
    if (user) {
      const isPasswordCorrect = await user.comparePassword(password);
      if (!isPasswordCorrect) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Log login activity
      await Activity.create({
        user: user._id,
        action: 'login',
        resourceType: 'user',
        resourceId: user._id,
        details: `User logged in successfully`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      const token = generateToken(user._id);

      console.log('Database login successful for:', email);

      return res.json({
        success: true,
        data: {
          token,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
            lastLogin: user.lastLogin
          }
        }
      });
    }

    // Fallback to demo user if database not available
    const demoUser = {
      _id: 'demo_admin_id',
      name: 'Demo Admin',
      email: 'demo@example.com',
      password: 'password123',
      role: 'admin',
      status: 'active'
    };

    if (email.toLowerCase() === demoUser.email.toLowerCase() && password === demoUser.password) {
      const token = generateToken(demoUser._id);

      console.log('Demo login successful for:', email);

      return res.json({
        success: true,
        data: {
          token,
          user: {
            id: demoUser._id,
            name: demoUser.name,
            email: demoUser.email,
            role: demoUser.role,
            status: demoUser.status,
            lastLogin: new Date()
          }
        }
      });
    }

    // Invalid credentials
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password'
    });

  } catch (error) {
    console.error('Login error:', error);
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
    // Try to get user from database
    let user;
    try {
      user = await User.findById(req.user.id);
    } catch (dbError) {
      console.log('Database not available for token verification');
    }

    if (user) {
      return res.json({
        success: true,
        data: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          lastLogin: user.lastLogin
        }
      });
    }

    // Fallback for demo user
    if (req.user.id === 'demo_admin_id') {
      return res.json({
        success: true,
        data: {
          id: 'demo_admin_id',
          name: 'Demo Admin',
          email: 'demo@example.com',
          role: 'admin',
          status: 'active',
          lastLogin: new Date()
        }
      });
    }

    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  } catch (error) {
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
    try {
      await Activity.create({
        user: req.user.id,
        action: 'logout',
        resourceType: 'user',
        resourceId: req.user.id,
        details: `User logged out`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
    } catch (activityError) {
      console.log('Could not log activity:', activityError.message);
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
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

    // Try to update in database
    let user;
    try {
      user = await User.findById(req.user.id);
      if (user) {
        user.name = name || user.name;
        user.email = email || user.email;
        user.phone = phone || user.phone;
        user.company = company || user.company;
        user.bio = bio || user.bio;
        await user.save();

        // Log profile update activity
        await Activity.create({
          user: req.user.id,
          action: 'profile_update',
          resourceType: 'user',
          resourceId: req.user.id,
          details: `User updated profile information`,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });

        return res.json({
          success: true,
          data: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
            phone: user.phone,
            company: user.company,
            bio: user.bio
          }
        });
      }
    } catch (dbError) {
      console.log('Database not available for profile update');
    }

    // Demo mode fallback
    res.status(400).json({
      success: false,
      message: 'Profile updates require database connection'
    });
  } catch (error) {
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

    // Try to change password in database
    let user;
    try {
      user = await User.findById(req.user.id).select('+password');
      if (user) {
        const isCurrentPasswordCorrect = await user.comparePassword(currentPassword);
        if (!isCurrentPasswordCorrect) {
          return res.status(400).json({
            success: false,
            message: 'Current password is incorrect'
          });
        }

        user.password = newPassword;
        await user.save();

        // Log password change activity
        await Activity.create({
          user: req.user.id,
          action: 'password_change',
          resourceType: 'user',
          resourceId: req.user.id,
          details: `User changed password`,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });

        return res.json({
          success: true,
          message: 'Password changed successfully'
        });
      }
    } catch (dbError) {
      console.log('Database not available for password change');
    }

    res.status(400).json({
      success: false,
      message: 'Password changes require database connection'
    });
  } catch (error) {
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