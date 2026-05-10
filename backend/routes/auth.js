// routes/auth.js - MongoDB-compatible authentication routes
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  register,
  login,
  verifyToken,
  logout,
  updateProfile,
  changePassword,
  verifyEmailFromToken,
  requestVerificationEmail,
  forgotPassword,
  resetPassword
} = require('../controllers/authController');

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.get('/verify-email', verifyEmailFromToken);
router.post('/request-verification-email', requestVerificationEmail);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes
router.get('/verify', authenticateToken, verifyToken);
router.post('/logout', authenticateToken, logout);
router.patch('/profile', authenticateToken, updateProfile);
router.patch('/change-password', authenticateToken, changePassword);

module.exports = router;