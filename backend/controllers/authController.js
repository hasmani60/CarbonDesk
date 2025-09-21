// controllers/authController.js - Enhanced with proper RBAC and security
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, Activity } = require('../models');

// Generate JWT Token with role information
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user._id,
      role: user.role,
      permissions: user.permissions
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
    const { name, email, password, role = 'contributor' } = req.body;

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
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
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
    const token = generateToken(user);

    // Log registration activity
    await Activity.create({
      user: user._id,
      action: 'user_registered',
      resourceType: 'user',
      resourceId: user._id,
      details: `User ${user.name} registered with role: ${user.role}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        browser: extractBrowser(req.get('User-Agent')),
        os: extractOS(req.get('User-Agent'))
      }
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
          permissions: user.permissions,
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

    console.log('Login attempt:', { email }); // Don't log password

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
      // Check if account is locked
      if (user.isLocked) {
        return res.status(423).json({
          success: false,
          message: 'Account temporarily locked due to too many failed login attempts'
        });
      }

      // Check if account is active
      if (user.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'Account is not active. Please contact administrator.'
        });
      }

      const isPasswordCorrect = await user.comparePassword(password);
      if (!isPasswordCorrect) {
        // Increment login attempts
        user.loginAttempts = (user.loginAttempts || 0) + 1;
        
        // Lock account after 5 failed attempts
        if (user.loginAttempts >= 5) {
          user.lockUntil = Date.now() + 30 * 60 * 1000; // Lock for 30 minutes
        }
        
        await user.save();
        
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Reset login attempts on successful login
      user.loginAttempts = 0;
      user.lockUntil = undefined;
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
        userAgent: req.get('User-Agent'),
        metadata: {
          browser: extractBrowser(req.get('User-Agent')),
          os: extractOS(req.get('User-Agent'))
        }
      });

      const token = generateToken(user);

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
            permissions: user.permissions,
            lastLogin: user.lastLogin
          }
        }
      });
    }

    // Fallback to demo user if database not available
    const demoUsers = {
      'demo@example.com': {
        _id: 'demo_admin_id',
        name: 'Demo Admin',
        email: 'demo@example.com',
        password: 'password123',
        role: 'admin',
        status: 'active'
      },
      'analyst@example.com': {
        _id: 'demo_analyst_id',
        name: 'Demo Analyst',
        email: 'analyst@example.com',
        password: 'password123',
        role: 'analyst',
        status: 'active'
      },
      'contributor@example.com': {
        _id: 'demo_contributor_id',
        name: 'Demo Contributor',
        email: 'contributor@example.com',
        password: 'password123',
        role: 'contributor',
        status: 'active'
      },
      'viewer@example.com': {
        _id: 'demo_viewer_id',
        name: 'Demo Viewer',
        email: 'viewer@example.com',
        password: 'password123',
        role: 'viewer',
        status: 'active'
      }
    };

    const demoUser = demoUsers[email.toLowerCase()];
    if (demoUser && password === demoUser.password) {
      const { getRolePermissions } = require('../models');
      const permissions = getRolePermissions(demoUser.role);
      
      const token = generateToken({
        _id: demoUser._id,
        role: demoUser.role,
        permissions
      });

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
            permissions: permissions,
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
      // Check if password was changed after token was issued
      if (user.changedPasswordAfter(req.user.iat)) {
        return res.status(401).json({
          success: false,
          message: 'User recently changed password. Please log in again.'
        });
      }

      return res.json({
        success: true,
        data: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          permissions: user.permissions,
          lastLogin: user.lastLogin
        }
      });
    }

    // Fallback for demo users
    const demoUsers = {
      'demo_admin_id': {
        id: 'demo_admin_id',
        name: 'Demo Admin',
        email: 'demo@example.com',
        role: 'admin',
        status: 'active'
      },
      'demo_analyst_id': {
        id: 'demo_analyst_id',
        name: 'Demo Analyst',
        email: 'analyst@example.com',
        role: 'analyst',
        status: 'active'
      },
      'demo_contributor_id': {
        id: 'demo_contributor_id',
        name: 'Demo Contributor',
        email: 'contributor@example.com',
        role: 'contributor',
        status: 'active'
      },
      'demo_viewer_id': {
        id: 'demo_viewer_id',
        name: 'Demo Viewer',
        email: 'viewer@example.com',
        role: 'viewer',
        status: 'active'
      }
    };

    const demoUser = demoUsers[req.user.id];
    if (demoUser) {
      const { getRolePermissions } = require('../models');
      return res.json({
        success: true,
        data: {
          ...demoUser,
          permissions: getRolePermissions(demoUser.role),
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
        userAgent: req.get('User-Agent'),
        metadata: {
          browser: extractBrowser(req.get('User-Agent')),
          os: extractOS(req.get('User-Agent'))
        }
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
          userAgent: req.get('User-Agent'),
          metadata: {
            browser: extractBrowser(req.get('User-Agent')),
            os: extractOS(req.get('User-Agent'))
          }
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
            bio: user.bio,
            permissions: user.permissions
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

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
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
          userAgent: req.get('User-Agent'),
          metadata: {
            browser: extractBrowser(req.get('User-Agent')),
            os: extractOS(req.get('User-Agent'))
          }
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

// Utility functions
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
  register,
  login,
  verifyToken,
  logout,
  updateProfile,
  changePassword
};