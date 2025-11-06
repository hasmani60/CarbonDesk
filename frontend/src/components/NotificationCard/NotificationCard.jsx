// Updated NotificationCard.jsx with improved display and real data handling
// UPDATED: Mark as read now removes the notification from view
import { Clock, Bell, Trash2, Check } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';

export const NotificationCard = ({ notification }) => {
  const { markAsRead, deleteNotification } = useNotifications();

  const getDeadlineColor = (deadline) => {
    if (!deadline) return 'text-gray-600';
    if (deadline === 'Today' || deadline.includes('hour')) return 'text-red-600';
    if (deadline === 'Tomorrow' || deadline.includes('1 day')) return 'text-orange-600';
    return 'text-gray-600';
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

  const formatDate = (dateString) => {
    if (!dateString) return new Date().toLocaleDateString();
    
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    return date.toLocaleDateString();
  };

  const handleMarkAsRead = async (e) => {
    e.stopPropagation();
    if (!notification.read) {
      // Mark as read first
      await markAsRead(notification._id);
      
      // Then delete notification after small delay for visual feedback
      setTimeout(async () => {
        await deleteNotification(notification._id);
      }, 300);
    }
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    await deleteNotification(notification._id);
  };

  return (
    <div className={`rounded-lg p-4 border transition-all hover:shadow-md ${
      !notification.read ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-lg">{getNotificationIcon(notification.type)}</span>
          {notification.deadline && (
            <span className={`text-sm font-medium ${getDeadlineColor(notification.deadline)}`}>
              Deadline: {notification.deadline}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {/* Mark as Read Button - Only show for unread notifications */}
          {!notification.read && (
            <button
              onClick={handleMarkAsRead}
              className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100 rounded transition-colors"
              title="Mark as read and remove"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          {/* Delete Button */}
          <button
            onClick={handleDelete}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Delete notification"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <Clock className="w-4 h-4 text-gray-400" />
        </div>
      </div>

      <div className="flex items-start space-x-3 mb-3">
        <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-white text-sm font-medium">
            {notification.user?.avatar || 'SY'}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 mb-1">
            {notification.user?.name || 'System'}
          </div>
          <div className="text-xs text-gray-500">
            {formatDate(notification.createdAt)}
          </div>
        </div>
        {!notification.read && (
          <div className="w-2 h-2 bg-emerald-500 rounded-full flex-shrink-0 mt-2" title="Unread"></div>
        )}
      </div>

      <div className="mb-3">
        <h4 className="text-sm font-semibold text-gray-900 mb-1">
          {notification.title}
        </h4>
        <p className="text-sm text-gray-600 leading-relaxed">
          {notification.message}
        </p>
      </div>

      {/* Additional notification data */}
      {notification.data && (
        <div className="text-xs text-gray-500 bg-white rounded p-2 border">
          {notification.data.category && (
            <div className="flex items-center justify-between">
              <span>Category:</span>
              <span className="font-medium">{notification.data.category}</span>
            </div>
          )}
          {notification.data.amount && notification.data.unit && (
            <div className="flex items-center justify-between">
              <span>Amount:</span>
              <span className="font-medium">{notification.data.amount} {notification.data.unit}</span>
            </div>
          )}
          {notification.data.scope && (
            <div className="flex items-center justify-between">
              <span>Scope:</span>
              <span className="font-medium">Scope {notification.data.scope}</span>
            </div>
          )}
        </div>
      )}

      {/* Priority indicator */}
      {notification.priority && notification.priority !== 'medium' && (
        <div className="mt-2 flex justify-end">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
            notification.priority === 'high' ? 'bg-red-100 text-red-700' :
            notification.priority === 'urgent' ? 'bg-red-200 text-red-800' :
            'bg-yellow-100 text-yellow-700'
          }`}>
            {notification.priority.toUpperCase()}
          </span>
        </div>
      )}
    </div>
  );
};

export default NotificationCard;