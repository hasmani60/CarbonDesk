const { Notification } = require('../models');

// @desc    Get notifications
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      read,
      type
    } = req.query;

    // Sample notifications for testing
    const sampleNotifications = [
      {
        _id: '1',
        type: 'deadline_reminder',
        title: 'Deadline Reminder',
        message: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        deadline: '25/03/2025',
        user: { name: 'Jhon Doe', avatar: 'JD' },
        date: '25/03/2025',
        read: false,
        createdAt: new Date()
      },
      {
        _id: '2',
        type: 'task_assigned',
        title: 'Task Assigned',
        message: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        deadline: 'Tomorrow',
        user: { name: 'Jhon Doe', avatar: 'JD' },
        date: 'May 20, 2025',
        read: false,
        createdAt: new Date()
      },
      {
        _id: '3',
        type: 'emission_submitted',
        title: 'Emission Data Submitted',
        message: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        deadline: 'Today',
        user: { name: 'Jhon Doe', avatar: 'JD' },
        date: 'May 20, 2025',
        read: false,
        createdAt: new Date()
      }
    ];

    res.json({
      success: true,
      data: sampleNotifications,
      unreadCount: 3,
      pagination: {
        currentPage: parseInt(page),
        totalPages: 1,
        totalItems: 3,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Mark notification as read
// @route   PATCH /api/notifications/:id/read
// @access  Private
const markAsRead = async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Mark all notifications as read
// @route   PATCH /api/notifications/mark-all-read
// @access  Private
const markAllAsRead = async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
const deleteNotification = async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification
};