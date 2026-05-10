const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const { toClient } = require('../services/notificationService');

const recipientQuery = (req) => ({
  organisation_id: req.organisationId,
  recipient_id: req.user.id
});

// @desc    List notifications for current user (organisation-scoped)
// @route   GET /api/notifications
const getNotifications = async (req, res) => {
  try {
    if (!req.organisationId) {
      return res.json({
        success: true,
        data: { items: [], unreadCount: 0 }
      });
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const filter = recipientQuery(req);

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ created_at: -1 }).limit(limit).lean(),
      Notification.countDocuments({ ...filter, read: false })
    ]);

    res.json({
      success: true,
      data: {
        items: notifications.map((n) => toClient(n)),
        unreadCount
      }
    });
  } catch (error) {
    console.error('getNotifications:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to load notifications'
    });
  }
};

// @route   GET /api/notifications/unread-count
const getUnreadCount = async (req, res) => {
  try {
    if (!req.organisationId) {
      return res.json({ success: true, data: { unreadCount: 0 } });
    }
    const unreadCount = await Notification.countDocuments({
      ...recipientQuery(req),
      read: false
    });
    res.json({ success: true, data: { unreadCount } });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to count unread'
    });
  }
};

// @desc    Mark notification as read
// @route   PATCH /api/notifications/:id/read
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid notification id' });
    }
    if (!req.organisationId) {
      return res.status(403).json({ success: false, message: 'Organisation required' });
    }

    const updated = await Notification.findOneAndUpdate(
      {
        _id: id,
        ...recipientQuery(req)
      },
      { $set: { read: true, read_at: new Date() } },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update notification'
    });
  }
};

// @desc    Mark all as read
// @route   PATCH /api/notifications/read-all
const markAllAsRead = async (req, res) => {
  try {
    if (!req.organisationId) {
      return res.status(403).json({ success: false, message: 'Organisation required' });
    }

    await Notification.updateMany(
      {
        ...recipientQuery(req),
        read: false
      },
      { $set: { read: true, read_at: new Date() } }
    );

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to mark all read'
    });
  }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid notification id' });
    }
    if (!req.organisationId) {
      return res.status(403).json({ success: false, message: 'Organisation required' });
    }

    const result = await Notification.deleteOne({
      _id: id,
      ...recipientQuery(req)
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete notification'
    });
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification
};
