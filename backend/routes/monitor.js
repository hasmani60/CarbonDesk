// routes/monitor.js - MongoDB-compatible monitor routes
const express = require('express');
const router = express.Router();
const { authorizeRoles } = require('../middleware/auth');

// All routes protected by authenticateToken + addOrganisationContext in server.js

// Placeholder monitor routes - extend with actual controllers as needed
router.get('/activities', authorizeRoles('admin', 'analyst', 'viewer'), (req, res) => {
  res.json({ 
    success: true, 
    data: [],
    pagination: {
      currentPage: 1,
      totalPages: 1,
      totalItems: 0
    }
  });
});

router.get('/tasks', authorizeRoles('admin', 'analyst', 'contributor', 'viewer'), (req, res) => {
  res.json({ 
    success: true, 
    data: [] 
  });
});

router.post('/tasks', authorizeRoles('admin'), (req, res) => {
  res.json({ 
    success: true, 
    message: 'Task created successfully',
    data: req.body 
  });
});

module.exports = router;