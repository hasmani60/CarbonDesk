import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, 
  BarChart3, 
  FileText, 
  Monitor, 
  Users, 
  Settings, 
  LogOut,
  ChevronDown,
  ChevronLeft
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useState } from 'react';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isInputExpanded, setIsInputExpanded] = useState(false);

  const navItems = [
    { path: '/dashboard', icon: Home, label: 'Dashboard' },
    { 
      path: '/input', 
      icon: FileText, 
      label: 'Input',
      hasSubmenu: true,
      submenu: [
        { path: '/input?scope=1', label: 'Scope 1' },
        { path: '/input?scope=2', label: 'Scope 2' },
        { path: '/input?scope=3', label: 'Scope 3' }
      ]
    },
    { path: '/monitor', icon: Monitor, label: 'Monitor' },
    { path: '/analytics', icon: BarChart3, label: 'Analytics' },
    { path: '/permissions', icon: Users, label: 'Permission' },
    { path: '/settings', icon: Settings, label: 'Settings' }
  ];

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const isActive = (path) => {
    if (path === '/input') {
      return location.pathname === '/input';
    }
    return location.pathname === path;
  };

  return (
    <div className="w-64 bg-white shadow-lg flex flex-col">
      {/* Logo/Brand Section */}
      <div className="p-4 border-b">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">L</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-lg font-semibold text-gray-900">Tool Name</span>
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        <ul className="space-y-2 px-3">
          {navItems.map((item) => (
            <li key={item.path}>
              {item.hasSubmenu ? (
                <div>
                  <button
                    onClick={() => setIsInputExpanded(!isInputExpanded)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isActive(item.path)
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <item.icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 transition-transform ${
                      isInputExpanded ? 'rotate-180' : ''
                    }`} />
                  </button>
                  {isInputExpanded && (
                    <ul className="ml-8 mt-2 space-y-1">
                      {item.submenu.map((subItem) => (
                        <li key={subItem.path}>
                          <Link
                            to={subItem.path}
                            className="block px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                          >
                            {subItem.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <Link
                  to={item.path}
                  className={`flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive(item.path)
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* User Profile Section */}
      <div className="p-4 border-t">
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center">
            <span className="text-white font-medium text-sm">
              {user?.name ? user.name.split(' ').map(n => n[0]).join('') : 'JD'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.name || 'Jhon Doe'}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {user?.email || 'jhondoe@gmail.com'}
            </p>
          </div>
        </div>
        
        <button
          onClick={handleLogout}
          className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;