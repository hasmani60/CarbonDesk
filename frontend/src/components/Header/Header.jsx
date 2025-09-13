import { useAuth } from '../../context/AuthContext';
import { Bell, User, Settings } from 'lucide-react';
import { useState } from 'react';

const Header = () => {
  const { user } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="bg-white shadow-sm border-b px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Page Title will be handled by individual pages */}
        <div className="flex-1"></div>
        
        {/* Right side - User actions */}
        <div className="flex items-center space-x-4">
          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Bell className="w-5 h-5" />
              {/* Notification badge */}
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
            </button>
            
            {/* Notification dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border z-50">
                <div className="p-4 border-b">
                  <h3 className="text-lg font-semibold">Notifications</h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  <div className="p-4 text-sm text-gray-600">
                    No new notifications
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Profile */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center">
              <span className="text-white font-medium text-sm">
                {user?.name ? user.name.split(' ').map(n => n[0]).join('') : 'JD'}
              </span>
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium text-gray-900">
                {user?.name || 'Jhon Doe'}
              </p>
              <p className="text-xs text-gray-500">
                {user?.email || 'jhondoe@gmail.com'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;