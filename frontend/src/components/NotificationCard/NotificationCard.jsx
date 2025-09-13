// NotificationCard.jsx
import { Clock, Bell } from 'lucide-react';

export const NotificationCard = ({ notification }) => {
  const getDeadlineColor = (deadline) => {
    if (deadline === 'Today') return 'text-red-600';
    if (deadline === 'Tomorrow') return 'text-orange-600';
    return 'text-gray-600';
  };

  return (
    <div className="bg-gray-50 rounded-lg p-4 border">
      <div className="flex items-center justify-between mb-3">
        <span className={`text-sm font-medium ${getDeadlineColor(notification.deadline)}`}>
          Deadline: {notification.deadline}
        </span>
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-gray-400" />
          <Bell className="w-4 h-4 text-gray-400" />
          <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/>
          </svg>
        </div>
      </div>

      <div className="flex items-center mb-3">
        <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center mr-3">
          <span className="text-white text-sm font-medium">
            {notification.user?.avatar || 'AI'}
          </span>
        </div>
        <div>
          <div className="text-sm font-medium text-gray-900">
            {notification.user?.name || 'Jhon Doe'}
          </div>
          <div className="text-xs text-gray-500">
            {notification.date || 'May 20, 2025'}
          </div>
        </div>
      </div>

      <p className="text-sm text-gray-600">
        {notification.message || 'Lorem ipsum dolor sit amet, consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.'}
      </p>
    </div>
  );
};

export default NotificationCard;