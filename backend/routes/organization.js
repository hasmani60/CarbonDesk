// ===== backend/routes/organization.js =====
const express = require('express');
const router = express.Router();

router.get('/boundary', (req, res) => {
  res.json({ 
    success: true, 
    data: {
      scopeDefinition: 'All owned and controlled facilities',
      includedFacilities: [],
      excludedFacilities: []
    }
  });
});

router.get('/settings', (req, res) => {
  res.json({ 
    success: true, 
    data: {
      fiscalYearStart: new Date(new Date().getFullYear(), 0, 1),
      currency: 'USD',
      timezone: 'UTC'
    }
  });
});

module.exports = router;