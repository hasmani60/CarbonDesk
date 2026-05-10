// NotificationContext.jsx — inbox from MongoDB + polling / tab focus / emission events
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState
} from 'react';
import { notificationAPI } from '../services/api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext();

const POLL_MS = 60_000;

export const NotificationProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const refreshNotifications = useCallback(
    async ({ silent } = {}) => {
      if (!isAuthenticated || !user?.id) return;
      try {
        if (!silent) setLoading(true);
        const res = await notificationAPI.getAll({ limit: 50 });
        const items = Array.isArray(res?.items) ? res.items : [];
        const unread =
          typeof res?.unreadCount === 'number'
            ? res.unreadCount
            : items.filter((n) => !n.read).length;
        setNotifications(items);
        setUnreadCount(unread);
      } catch (error) {
        console.error('Failed to load notifications:', error);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [isAuthenticated, user?.id]
  );

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setNotifications([]);
      setUnreadCount(0);
      return undefined;
    }

    refreshNotifications({ silent: false });

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      refreshNotifications({ silent: true });
    }, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshNotifications({ silent: true });
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    const onEmissionAdded = () => refreshNotifications({ silent: true });
    window.addEventListener('emission-added', onEmissionAdded);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('emission-added', onEmissionAdded);
    };
  }, [isAuthenticated, user?.id, user?.organisation_id, refreshNotifications]);

  const markAsRead = async (notificationId) => {
    if (!notificationId) return;
    try {
      await notificationAPI.markAsRead(String(notificationId));
      await refreshNotifications({ silent: true });
    } catch (error) {
      console.error('markAsRead failed:', error);
      await refreshNotifications({ silent: true });
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationAPI.markAllAsRead();
      await refreshNotifications({ silent: true });
    } catch (error) {
      console.error('markAllAsRead failed:', error);
      await refreshNotifications({ silent: true });
    }
  };

  const markAllAsReadAndDelete = async () => {
    await markAllAsRead();
  };

  const deleteNotification = async (notificationId) => {
    if (!notificationId) return;
    try {
      await notificationAPI.delete(String(notificationId));
      await refreshNotifications({ silent: true });
    } catch (error) {
      console.error('deleteNotification failed:', error);
      await refreshNotifications({ silent: true });
    }
  };

  const value = {
    notifications,
    unreadCount,
    loading,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
    markAllAsReadAndDelete,
    deleteNotification
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
