// Updated Header.jsx with proper alignment
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { Bell, User, Settings, X } from 'lucide-react';
import { useState } from 'react';

const Header = () => {
  const { user } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);

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
    return date.toLocaleDateString();
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'emission_submitted':
        return '📊';
      case 'task_assigned':
        return '📋';
      case 'deadline_reminder':
        return '⏰';
      case 'system_update':
        return '🔄';
      default:
        return '📢';
    }
  };

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="flex items-center justify-between px-6 py-3">
        {/* Left side - Page Title (handled by individual pages) */}
        <div className="flex-1"></div>
        
        {/* Right side - User actions */}
        <div className="flex items-center space-x-4">
          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-center"
              aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
            >
              <Bell className="w-5 h-5" />
              {/* Notification badge - Top-right corner with clear separation */}
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 min-w-[14px] h-[14px] px-0.5 bg-red-500 text-white text-[8px] leading-none rounded-full flex items-center justify-center font-bold shadow-lg border border-white translate-x-1/4 -translate-y-1/4">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            
            {/* Notification dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border z-50 max-h-96 overflow-hidden">
                <div className="p-4 border-b flex items-center justify-between bg-gradient-to-r from-emerald-50 to-white">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded-full font-medium">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-emerald-600 text-sm hover:text-emerald-700 font-medium transition-colors"
                      >
                        Mark all read
                      </button>
                    )}
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                <div className="max-h-80 overflow-y-auto">
                  {notifications && notifications.length > 0 ? (
                    <div className="divide-y divide-gray-100">
                      {notifications.slice(0, 10).map((notification) => (
                        <div
                          key={notification._id}
                          onClick={() => handleNotificationClick(notification)}
                          className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                            !notification.read ? 'bg-emerald-50' : ''
                          }`}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0 text-2xl">
                              {getNotificationIcon(notification.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <p className={`text-sm font-medium ${
                                  !notification.read ? 'text-gray-900' : 'text-gray-600'
                                }`}>
                                  {notification.title}
                                </p>
                                {!notification.read && (
                                  <div className="w-2 h-2 bg-emerald-500 rounded-full flex-shrink-0 ml-2"></div>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                {notification.message}
                              </p>
                              <div className="flex items-center justify-between mt-2">
                                <div className="flex items-center space-x-2">
                                  {notification.user && (
                                    <>
                                      <div className="w-5 h-5 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-full flex items-center justify-center">
                                        <span className="text-white text-xs font-medium">
                                          {notification.user.avatar}
                                        </span>
                                      </div>
                                      <span className="text-xs text-gray-500 font-medium">
                                        {notification.user.name}
                                      </span>
                                    </>
                                  )}
                                </div>
                                <div className="flex items-center space-x-2 text-xs text-gray-500">
                                  {notification.deadline && (
                                    <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full font-medium">
                                      {notification.deadline}
                                    </span>
                                  )}
                                  <span>{formatTimeAgo(notification.createdAt)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-gray-500">
                      <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-sm font-medium text-gray-600">No notifications yet</p>
                      <p className="text-xs text-gray-500 mt-1">We'll notify you when something important happens</p>
                    </div>
                  )}
                </div>
                
                {notifications && notifications.length > 10 && (
                  <div className="p-4 border-t bg-gray-50 text-center">
                    <button className="text-emerald-600 text-sm hover:text-emerald-700 font-medium transition-colors">
                      View all notifications
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User Profile */}
          <div className="flex items-center space-x-3 pl-3 border-l border-gray-200">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-full flex items-center justify-center shadow-sm">
              <span className="text-white font-semibold text-sm">
                {user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U'}
              </span>
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-semibold text-gray-900">
                {user?.name || 'User'}
              </p>
              <p className="text-xs text-gray-500">
                {user?.email || 'user@example.com'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;