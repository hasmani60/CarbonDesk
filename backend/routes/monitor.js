// ===== backend/routes/monitor.js =====
const express = require('express');
const router = express.Router();

// Placeholder monitor routes
router.get('/activities', (req, res) => {
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

router.get('/tasks', (req, res) => {
  res.json({ 
    success: true, 
    data: [] 
  });
});

router.post('/tasks', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Task created successfully',
    data: req.body 
  });
});

module.exports = router;