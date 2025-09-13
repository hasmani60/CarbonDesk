// routes/auth.js
const express = require('express');
const { 
  register, 
  login, 
  verifyToken, 
  logout, 
  updateProfile, 
  changePassword 
} = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/verify', authenticateToken, verifyToken);
router.post('/logout', authenticateToken, logout);
router.patch('/profile', authenticateToken, updateProfile);
router.patch('/change-password', authenticateToken, changePassword);

module.exports = router;