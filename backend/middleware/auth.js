// middleware/auth.js
const jwt = require('jsonwebtoken');

// Demo user data (same as in authController)
const demoUser = {
  _id: 'demo_user_id',
  name: 'Demo User',
  email: 'demo@example.com',
  role: 'admin',
  status: 'active'
};

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    console.log('Auth middleware - Token received:', token ? 'Yes' : 'No'); // Debug log

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required'
      });
    }

    // Verify the JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    console.log('Auth middleware - Token decoded:', decoded); // Debug log

    // For demo mode, always use the demo user if token is valid
    if (decoded && decoded.id) {
      req.user = {
        id: demoUser._id,
        name: demoUser.name,
        email: demoUser.email,
        role: demoUser.role,
        status: demoUser.status
      };
      
      console.log('Auth middleware - User set:', req.user); // Debug log
      next();
    } else {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

  } catch (error) {
    console.error('Auth middleware error:', error.message); // Debug log
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }
    next();
  };
};

module.exports = { authenticateToken, authorizeRoles };