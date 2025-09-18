// routes/auth.js
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  register,
  login,
  verifyToken,
  logout,
  updateProfile,
  changePassword
} = require('../controllers/authController');

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.get('/verify', authenticateToken, verifyToken);
router.post('/logout', authenticateToken, logout);
router.patch('/profile', authenticateToken, updateProfile);
router.patch('/change-password', authenticateToken, changePassword);

module.exports = router;