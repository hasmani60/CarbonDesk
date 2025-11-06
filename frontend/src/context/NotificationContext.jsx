// NotificationContext.jsx - Real notifications only (clears dummy data)
import { createContext, useContext, useState, useEffect } from 'react';
import { notificationAPI } from '../services/api';

const NotificationContext = createContext();

const NOTIFICATIONS_STORAGE_KEY = 'carbon_accounting_notifications';

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Load and clean notifications on mount
  useEffect(() => {
    loadAndCleanNotifications();
  }, []);

  const loadAndCleanNotifications = () => {
    try {
      const stored = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      if (stored) {
        const parsedNotifications = JSON.parse(stored);
        
        // Filter out dummy/sample notifications
        const realNotifications = parsedNotifications.filter(notification => {
          // Remove notifications with IDs starting with 'sample_'
          if (notification._id?.startsWith('sample_')) {
            return false;
          }
          
          // Remove notifications with type 'deadline_reminder' or 'task_assigned' 
          // that were created as samples
          if (notification.user?.name === 'System' && notification.type === 'deadline_reminder') {
            return false;
          }
          if (notification.user?.name === 'Admin User' && notification.type === 'task_assigned') {
            return false;
          }
          
          return true;
        });
        
        setNotifications(realNotifications);
        setUnreadCount(realNotifications.filter(n => !n.read).length);
        
        // Save cleaned notifications back to localStorage
        if (realNotifications.length !== parsedNotifications.length) {
          saveNotifications(realNotifications);
        }
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
      // In production, this would fetch from the API
      // const response = await notificationAPI.getAll();
      // setNotifications(response.data);
      
      // For now, load from localStorage
      loadAndCleanNotifications();
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
        avatar: user.name.split(' ').map(n => n[0]).join('').toUpperCase()
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

  const markAllAsReadAndDelete = async () => {
    try {
      // First mark all as read
      await markAllAsRead();
      
      // Then delete all notifications after a short delay for visual feedback
      setTimeout(() => {
        setNotifications([]);
        setUnreadCount(0);
        saveNotifications([]);
      }, 300);
    } catch (error) {
      console.error('Error marking all as read and deleting:', error);
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
    try {
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
      
      return newNotification;
    } catch (error) {
      console.error('Error adding notification:', error);
      return null;
    }
  };

  const clearAllNotifications = () => {
    try {
      setNotifications([]);
      setUnreadCount(0);
      localStorage.removeItem(NOTIFICATIONS_STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  // Get only the last 3 notifications for the notification panel
  const getRecentNotifications = () => {
    return notifications.slice(0, 3);
  };

  const value = {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    addEmissionNotification,
    markAsRead,
    markAllAsRead,
    markAllAsReadAndDelete,
    deleteNotification,
    addNotification,
    clearAllNotifications,
    getRecentNotifications
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};