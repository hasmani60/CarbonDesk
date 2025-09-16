// Updated NotificationContext.jsx with emission notification creation
import { createContext, useContext, useState, useEffect } from 'react';
import { notificationAPI } from '../services/api';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

const NOTIFICATIONS_STORAGE_KEY = 'carbon_accounting_notifications';

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = () => {
    try {
      const stored = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      if (stored) {
        const parsedNotifications = JSON.parse(stored);
        setNotifications(parsedNotifications);
        setUnreadCount(parsedNotifications.filter(n => !n.read).length);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const saveNotifications = (notificationsList) => {
    try {
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notificationsList));
    } catch (error) {
      console.error('Error saving notifications:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      // For now, we'll use localStorage. In a real app, this would fetch from API
      loadNotifications();
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const createEmissionNotification = (user, emissionData) => {
    const notification = {
      _id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'emission_submitted',
      title: 'Emission Data Added',
      message: `${user.name} added ${emissionData.category} - ${emissionData.activityType || emissionData.subcategory} on ${new Date().toLocaleDateString()}.`,
      user: {
        name: user.name,
        avatar: user.name.split(' ').map(n => n[0]).join('')
      },
      date: new Date().toLocaleDateString(),
      deadline: 'Today',
      read: false,
      priority: 'medium',
      createdAt: new Date().toISOString(),
      data: {
        emissionId: emissionData.id,
        scope: emissionData.scope,
        category: emissionData.category,
        amount: emissionData.amount,
        unit: emissionData.unit
      }
    };

    return notification;
  };

  const addEmissionNotification = (user, emissionData) => {
    try {
      const notification = createEmissionNotification(user, emissionData);
      const updatedNotifications = [notification, ...notifications];
      
      setNotifications(updatedNotifications);
      setUnreadCount(prev => prev + 1);
      saveNotifications(updatedNotifications);
      
      return notification;
    } catch (error) {
      console.error('Error adding emission notification:', error);
      return null;
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const updatedNotifications = notifications.map(notification => 
        notification._id === notificationId 
          ? { ...notification, read: true, readAt: new Date().toISOString() }
          : notification
      );
      
      setNotifications(updatedNotifications);
      setUnreadCount(prev => Math.max(0, prev - 1));
      saveNotifications(updatedNotifications);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const updatedNotifications = notifications.map(notification => ({ 
        ...notification, 
        read: true,
        readAt: new Date().toISOString()
      }));
      
      setNotifications(updatedNotifications);
      setUnreadCount(0);
      saveNotifications(updatedNotifications);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      const notificationToDelete = notifications.find(n => n._id === notificationId);
      const updatedNotifications = notifications.filter(notification => 
        notification._id !== notificationId
      );
      
      setNotifications(updatedNotifications);
      
      // Update unread count if the deleted notification was unread
      if (notificationToDelete && !notificationToDelete.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      
      saveNotifications(updatedNotifications);
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const addNotification = (notification) => {
    const newNotification = {
      ...notification,
      _id: notification._id || `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: notification.createdAt || new Date().toISOString(),
      read: notification.read || false
    };
    
    const updatedNotifications = [newNotification, ...notifications];
    setNotifications(updatedNotifications);
    
    if (!newNotification.read) {
      setUnreadCount(prev => prev + 1);
    }
    
    saveNotifications(updatedNotifications);
  };

  // Create sample notifications for demo purposes
  const createSampleNotifications = () => {
    const sampleNotifications = [
      {
        _id: 'sample_1',
        type: 'deadline_reminder',
        title: 'Deadline Reminder',
        message: 'Monthly emission reporting deadline is approaching. Please submit pending data.',
        deadline: 'Tomorrow',
        user: { name: 'System', avatar: 'SY' },
        date: new Date().toLocaleDateString(),
        read: false,
        createdAt: new Date().toISOString()
      },
      {
        _id: 'sample_2',
        type: 'task_assigned',
        title: 'Task Assigned',
        message: 'You have been assigned to verify Scope 1 emissions for Factory A.',
        deadline: '3 days',
        user: { name: 'Admin User', avatar: 'AU' },
        date: new Date(Date.now() - 86400000).toLocaleDateString(),
        read: false,
        createdAt: new Date(Date.now() - 86400000).toISOString()
      }
    ];

    return sampleNotifications;
  };

  // Initialize with sample notifications if none exist
  useEffect(() => {
    if (notifications.length === 0) {
      const samples = createSampleNotifications();
      setNotifications(samples);
      setUnreadCount(samples.filter(n => !n.read).length);
      saveNotifications(samples);
    }
  }, []);

  const value = {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    addEmissionNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    addNotification
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};