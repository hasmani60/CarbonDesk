// ===== backend/routes/analytics.js =====
const express = require('express');
const router = express.Router();

// Placeholder analytics routes
router.get('/trends', (req, res) => {
  res.json({ 
    success: true, 
    data: [] 
  });
});

router.get('/scope-comparison', (req, res) => {
  res.json({ 
    success: true, 
    data: [] 
  });
});

router.get('/by-category', (req, res) => {
  res.json({ 
    success: true, 
    data: [] 
  });
});

module.exports = router;