// routes/organization.js
const express = require('express');
const { 
  getBoundary, 
  updateBoundary, 
  getSettings, 
  updateSettings 
} = require('../controllers/organizationController');
const { authorizeRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/boundary', getBoundary);
router.patch('/boundary', authorizeRoles('admin'), updateBoundary);
router.get('/settings', getSettings);
router.patch('/settings', authorizeRoles('admin'), updateSettings);

module.exports = router;