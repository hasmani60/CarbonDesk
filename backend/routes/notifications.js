// ===== backend/routes/notifications.js =====
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ 
    success: true, 
    data: [] 
  });
});

router.patch('/:id/read', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Notification marked as read' 
  });
});

module.exports = router;