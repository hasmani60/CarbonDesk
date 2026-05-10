// controllers/authController.js - With detailed error logging
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, ActivityLog } = require('../models');
const logger = require('../utils/logger');
const emailService = require('../utils/emailService');

const hashVerifyToken = (raw) =>
  crypto.createHash('sha256').update(String(raw), 'utf8').digest('hex');

// Helper functions
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
};

const verifyPassword = async (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword);
};

function publicUserDoc(userDoc) {
  if (!userDoc) return null;
  const u = userDoc.toObject ? userDoc.toObject() : userDoc;
  return {
    id: u._id.toString(),
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    restrictions: u.restrictions,
    organisation_id: u.organisation_id,
    settings: u.settings && typeof u.settings === 'object' ? u.settings : {},
    lastLogin: u.last_login,
    email_verified: u.email_verified !== false
  };
}

// Generate JWT Token
const generateToken = (user) => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'your-secret-key') {
    if (process.env.NODE_ENV === 'production') {
      logger.error('JWT_SECRET is not set or is using a default — refusing to sign tokens');
      throw new Error('Server misconfiguration: JWT_SECRET');
    }
  }
  const expires = process.env.JWT_EXPIRE || '30d';
  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      organisation_id: user.organisation_id,
      restrictions: user.restrictions
    },
    secret || 'development-only-secret',
    { expiresIn: expires }
  );
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Private (Admin only)
const register = async (req, res) => {
  try {
    const { name, email, password, role = 'contributor', restrictions = null } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password'
      });
    }

    const validRoles = ['admin', 'analyst', 'contributor', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified'
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    const hashedPassword = await hashPassword(password);

    const verifyOnRegister = process.env.EMAIL_VERIFICATION_ON_REGISTER === 'true';
    const verifyExpiresAt = verifyOnRegister
      ? new Date(Date.now() + 24 * 60 * 60 * 1000)
      : null;
    const rawVerification = verifyOnRegister ? crypto.randomBytes(32).toString('hex') : null;

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role,
      status: 'active',
      restrictions: restrictions,
      organisation_id: req.organisationId || '',
      email_verified: verifyOnRegister ? false : true,
      email_verification_token: rawVerification ? hashVerifyToken(rawVerification) : null,
      email_verification_expires: verifyExpiresAt
    });

    if (verifyOnRegister && rawVerification) {
      const send = await emailService.sendVerificationEmail(user, rawVerification);
      if (!send.sent) {
        logger.warn('Verification email not sent', { reason: send.reason, email: user.email });
      }
    }

    await ActivityLog.create({
      user_id: user._id.toString(),
      action: 'user_registered',
      resource_type: 'user',
      resource_id: user._id.toString(),
      details: `User ${user.name} registered with role: ${user.role}`,
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    if (verifyOnRegister) {
      return res.status(201).json({
        success: true,
        message:
          'Account created. Check your email to verify your address, then you can sign in.',
        data: { user: publicUserDoc(user) }
      });
    }

    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      data: {
        token,
        user: { ...publicUserDoc(user), lastLogin: new Date() }
      }
    });
  } catch (error) {
    console.error('❌ REGISTER ERROR:', error);
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

    console.log('🔐 Login attempt:', email);

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    console.log('1. Looking up user...');
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      console.log('❌ User not found');
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    console.log('✅ User found:', user.email);

    if (user.status !== 'active') {
      console.log('❌ User not active');
      return res.status(403).json({
        success: false,
        message: 'Account is not active. Please contact administrator.'
      });
    }

    if (
      process.env.REQUIRE_EMAIL_VERIFICATION === 'true' &&
      user.email_verified === false
    ) {
      return res.status(403).json({
        success: false,
        code: 'EMAIL_NOT_VERIFIED',
        message:
          'Please verify your email before signing in. Use the link we sent, or request a new verification email from the login page.'
      });
    }

    console.log('2. Verifying password...');
    const isPasswordCorrect = await verifyPassword(password, user.password);
    if (!isPasswordCorrect) {
      console.log('❌ Password incorrect');
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    console.log('✅ Password correct');
    console.log('3. Updating last_login...');

    try {
      user.last_login = new Date();
      await user.save();
      console.log('✅ User saved');
    } catch (saveError) {
      console.error('❌ Error saving user:', saveError);
      // Continue anyway - not critical
    }

    console.log('4. Creating activity log...');
    try {
      await ActivityLog.create({
        user_id: user._id.toString(),
        action: 'login',
        resource_type: 'user',
        resource_id: user._id.toString(),
        details: 'User logged in successfully',
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      console.log('✅ Activity log created');
    } catch (logError) {
      console.error('⚠️  Activity log failed:', logError.message);
      // Continue anyway - not critical
    }

    console.log('5. Generating token...');
    const token = generateToken(user);
    console.log('✅ Token generated');

    console.log('✅ Login successful for:', user.email);

    return res.json({
      success: true,
      data: {
        token,
        user: { ...publicUserDoc(user), lastLogin: new Date() }
      },
      message: user.organisation_id 
        ? `Welcome back! Logged into organisation ID: ${user.organisation_id}` 
        : 'Welcome back! Please contact admin to assign you to an organisation.'
    });

  } catch (error) {
    console.error('❌ LOGIN ERROR:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/verify
// @access  Private
const verifyToken = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.json({
      success: true,
      data: publicUserDoc(user)
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
    await ActivityLog.create({
      user_id: req.user.id,
      action: 'logout',
      resource_type: 'user',
      resource_id: req.user.id,
      details: 'User logged out',
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

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
    const {
      name,
      email,
      phone,
      company,
      position,
      bio,
      notifications,
      preferences
    } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (name !== undefined && String(name).trim()) {
      user.name = String(name).trim();
    }

    if (email !== undefined && String(email).trim()) {
      const nextEmail = String(email).toLowerCase().trim();
      if (nextEmail !== user.email) {
        const taken = await User.findOne({
          email: nextEmail,
          _id: { $ne: user._id }
        });
        if (taken) {
          return res.status(400).json({
            success: false,
            message: 'That email is already used by another account'
          });
        }
        user.email = nextEmail;
      }
    }

    const prevSettings =
      user.settings && typeof user.settings === 'object' ? { ...user.settings } : {};
    const profile = { ...(prevSettings.profile || {}) };
    if (phone !== undefined) profile.phone = String(phone);
    if (company !== undefined) profile.company = String(company);
    if (position !== undefined) profile.position = String(position);
    if (bio !== undefined) profile.bio = String(bio);

    const nextSettings = { ...prevSettings, profile };
    if (notifications !== undefined && typeof notifications === 'object') {
      nextSettings.notifications = {
        ...(prevSettings.notifications || {}),
        ...notifications
      };
    }
    if (preferences !== undefined && typeof preferences === 'object') {
      nextSettings.preferences = {
        ...(prevSettings.preferences || {}),
        ...preferences
      };
    }
    user.settings = nextSettings;
    user.updated_at = new Date();
    await user.save();

    await ActivityLog.create({
      user_id: req.user.id,
      action: 'profile_update',
      resource_type: 'user',
      resource_id: req.user.id,
      details: 'User updated profile/settings',
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    return res.json({
      success: true,
      data: publicUserDoc(user)
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

    const user = await User.findById(req.user.id);
    const isCurrentPasswordCorrect = await verifyPassword(currentPassword, user.password);
    
    if (!isCurrentPasswordCorrect) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    user.password = await hashPassword(newPassword);
    user.updated_at = new Date();
    await user.save();

    await ActivityLog.create({
      user_id: req.user.id,
      action: 'password_change',
      resource_type: 'user',
      resource_id: req.user.id,
      details: 'User changed password',
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    return res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Complete email verification (link from email)
// @route   GET /api/auth/verify-email?token=
// @access  Public
const verifyEmailFromToken = async (req, res) => {
  try {
    const raw = req.query.token;
    if (!raw || typeof raw !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Verification link is invalid or expired.'
      });
    }

    const hash = hashVerifyToken(raw.trim());
    const user = await User.findOne({
      email_verification_token: hash,
      email_verification_expires: { $gt: new Date() }
    }).select('+email_verification_token +email_verification_expires');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Verification link is invalid or expired.'
      });
    }

    user.email_verified = true;
    user.email_verification_token = null;
    user.email_verification_expires = null;
    user.updated_at = new Date();
    await user.save();

    return res.json({
      success: true,
      message: 'Email verified. You can sign in now.'
    });
  } catch (error) {
    console.error('verifyEmailFromToken:', error);
    return res.status(500).json({
      success: false,
      message: 'Could not verify email. Please try again or request a new link.'
    });
  }
};

/**
 * Resend verification email — always responds with the same message (no email enumeration).
 * @route POST /api/auth/request-verification-email
 */
const requestVerificationEmail = async (req, res) => {
  const generic = {
    success: true,
    message:
      'If that email is registered and still needs verification, we sent a new link.'
  };
  try {
    const email =
      req.body?.email && String(req.body.email).toLowerCase().trim();
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required.'
      });
    }

    const user = await User.findOne({ email }).select(
      '+email_verification_token +email_verification_expires'
    );

    if (!user || user.email_verified !== false) {
      return res.json(generic);
    }

    const raw = crypto.randomBytes(32).toString('hex');
    user.email_verification_token = hashVerifyToken(raw);
    user.email_verification_expires = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    );
    await user.save();

    const send = await emailService.sendVerificationEmail(user, raw);
    if (!send.sent) {
      logger.warn('requestVerificationEmail: SMTP not sent', {
        reason: send.reason,
        email
      });
    }

    return res.json(generic);
  } catch (error) {
    logger.error('requestVerificationEmail', error);
    return res.json(generic);
  }
};

const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token required'
      });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const newToken = jwt.sign(
      { 
        id: decoded.id, 
        email: decoded.email, 
        role: decoded.role,
        organisation_id: decoded.organisation_id
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token: newToken
    });
  } catch (error) {
    console.error('Refresh token error', error);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token'
    });
  }
};

module.exports = {
  register,
  login,
  verifyToken,
  logout,
  updateProfile,
  changePassword,
  refreshToken,
  verifyEmailFromToken,
  requestVerificationEmail
};