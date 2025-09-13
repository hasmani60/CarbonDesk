// routes/notifications.js
const express = require('express');
const { 
  getNotifications, 
  markAsRead, 
  markAllAsRead, 
  deleteNotification 
} = require('../controllers/notificationController');

const router = express.Router();

router.get('/', getNotifications);
router.patch('/:id/read', markAsRead);
router.patch('/mark-all-read', markAllAsRead);
router.delete('/:id', deleteNotification);

module.exports = router;