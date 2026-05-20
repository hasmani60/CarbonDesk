import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import {
  Bell,
  X,
  PlusCircle,
  Activity,
  Download,
  Sun,
  Moon,
  BarChart3,
  ClipboardList,
  Clock,
  RefreshCw,
  Megaphone
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useState, useEffect } from 'react';
import { formatDate } from '../../utils/formatters';

const NOTIFICATION_ICONS = {
  emission_submitted: BarChart3,
  task_assigned: ClipboardList,
  deadline_reminder: Clock,
  system_update: RefreshCw,
  default: Megaphone
};

const Header = () => {
  const { user } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, refreshNotifications } =
    useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (showNotifications && refreshNotifications) {
      refreshNotifications({ silent: true });
    }
  }, [showNotifications, refreshNotifications]);

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      await markAsRead(notification._id);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    setShowNotifications(false);
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));

    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    return formatDate(date);
  };

  const NotificationIcon = ({ type }) => {
    const Icon = NOTIFICATION_ICONS[type] || NOTIFICATION_ICONS.default;
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
    );
  };

  const initials =
    user?.name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U';

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-4 px-6 md:px-8 h-14">
        <nav className="hidden md:flex items-center gap-2">
          <Link to="/input" className="btn-primary">
            <PlusCircle className="w-4 h-4" />
            <span>Log emissions</span>
          </Link>
          <Link to="/monitor" className="btn-ghost">
            <Activity className="w-4 h-4" />
            <span>Thresholds</span>
          </Link>
          <Link to="/analytics" className="btn-ghost">
            <Download className="w-4 h-4" />
            <span>Reports</span>
          </Link>
        </nav>

        <div className="flex items-center gap-1 sm:gap-2 ml-auto">
          <button type="button" onClick={toggleTheme} className="icon-btn" aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNotifications(!showNotifications)}
              className="icon-btn relative"
              aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
            >
              <Bell className="w-[18px] h-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[14px] h-[14px] px-0.5 bg-red-600 text-white text-[9px] leading-none rounded-full flex items-center justify-center font-semibold border border-white dark:border-zinc-900">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-[22rem] app-card shadow-lg z-50 max-h-[85vh] overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="badge bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {unreadCount > 0 && (
                      <button type="button" onClick={handleMarkAllRead} className="btn-ghost text-xs py-1.5 px-2">
                        Mark all read
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowNotifications(false)}
                      className="icon-btn"
                      aria-label="Close notifications"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {notifications?.length > 0 ? (
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {notifications.slice(0, 10).map((notification) => (
                        <div
                          key={notification._id}
                          onClick={() => handleNotificationClick(notification)}
                          className={`px-4 py-3 cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60 ${
                            !notification.read ? 'bg-zinc-50/80 dark:bg-zinc-800/40' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <NotificationIcon type={notification.type} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-0.5">
                                <p
                                  className={`text-sm leading-snug ${
                                    !notification.read
                                      ? 'font-medium text-zinc-900 dark:text-zinc-50'
                                      : 'text-zinc-600 dark:text-zinc-400'
                                  }`}
                                >
                                  {notification.title}
                                </p>
                                {!notification.read && (
                                  <span className="w-1.5 h-1.5 mt-1.5 shrink-0 rounded-full bg-[hsl(var(--primary))]" />
                                )}
                              </div>
                              <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
                                {notification.message}
                              </p>
                              <div className="flex items-center justify-between mt-2 gap-2 text-caption">
                                {notification.user && (
                                  <span className="truncate">{notification.user.name}</span>
                                )}
                                <span className="shrink-0">{formatTimeAgo(notification.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-6 py-10 text-center">
                      <Bell className="w-8 h-8 mx-auto mb-2 text-zinc-300 dark:text-zinc-600" />
                      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">No notifications</p>
                      <p className="text-caption mt-1">Updates will appear here when available.</p>
                    </div>
                  )}
                </div>

                {notifications?.length > 10 && (
                  <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 text-center">
                    <button type="button" className="text-sm font-medium text-[hsl(var(--primary))] hover:underline">
                      View all
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 pl-3 ml-1 border-l border-zinc-200 dark:border-zinc-800">
            <div className="w-8 h-8 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center">
              <span className="text-white text-xs font-semibold">{initials}</span>
            </div>
            <div className="hidden md:block min-w-0">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50 truncate">{user?.name || 'User'}</p>
              <p className="text-caption truncate max-w-[12rem]">{user?.email || 'user@example.com'}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
