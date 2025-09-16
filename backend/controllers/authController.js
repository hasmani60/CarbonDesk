// controllers/authController.js
const jwt = require('jsonwebtoken');

// Simple demo user for when MongoDB is not available
const demoUser = {
  _id: 'demo_user_id',
  name: 'Demo User', 
  email: 'demo@example.com',
  password: 'password123',
  role: 'admin',
  status: 'active',
  lastLogin: new Date()
};

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
    res.status(400).json({
      success: false,
      message: 'Registration is not available in demo mode. Please use demo credentials: demo@example.com / password123'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
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

    // Check credentials against demo user
    if (email.toLowerCase() !== demoUser.email.toLowerCase() || password !== demoUser.password) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Use demo@example.com / password123'
      });
    }

    // Generate token
    const token = generateToken(demoUser._id);

    console.log('Login successful for:', email); // Debug log

    res.json({
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
    // In demo mode, always return the demo user for any valid token
    res.json({
      success: true,
      data: {
        id: demoUser._id,
        name: demoUser.name,
        email: demoUser.email,
        role: demoUser.role,
        status: demoUser.status,
        lastLogin: demoUser.lastLogin
      }
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
    res.status(400).json({
      success: false,
      message: 'Profile updates are not available in demo mode'
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
    res.status(400).json({
      success: false,
      message: 'Password changes are not available in demo mode'
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