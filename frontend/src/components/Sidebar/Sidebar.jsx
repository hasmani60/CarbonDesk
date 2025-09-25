// components/Sidebar/Sidebar.jsx - Fixed RBAC and scope routing
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, 
  BarChart3, 
  FileText, 
  Monitor, 
  Settings, 
  LogOut,
  ChevronDown,
  ChevronLeft,
  Shield,
  Activity,
  Eye,
  UserCog,
  Crown,
  Users
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useState } from 'react';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuth();
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const [isAdminExpanded, setIsAdminExpanded] = useState(false);

  // FIXED: Corrected role-based navigation according to requirements
  const getNavItemsForRole = (role) => {
    const baseNavItems = {
      admin: [
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
        { path: '/settings', icon: Settings, label: 'Settings' }
      ],
      analyst: [
        { path: '/analytics', icon: BarChart3, label: 'Analytics' },
        { path: '/settings', icon: Settings, label: 'Settings' }
      ],
      contributor: [
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
        { path: '/settings', icon: Settings, label: 'Settings' }
      ],
      viewer: [
        { path: '/dashboard', icon: Home, label: 'Dashboard' },
        { path: '/monitor', icon: Monitor, label: 'Monitor' },
        { path: '/analytics', icon: BarChart3, label: 'Analytics' },
        { path: '/settings', icon: Settings, label: 'Settings' }
      ]
    };

    return baseNavItems[role] || [];
  };

  // Admin-only navigation items
  const adminNavItems = [
    {
      path: '/admin',
      icon: Shield,
      label: 'Admin Panel',
      hasSubmenu: true,
      roles: ['admin'],
      submenu: [
        { path: '/admin/monitor', label: 'User Activities', icon: Activity },
        { path: '/admin/users', label: 'User Management', icon: UserCog }
      ]
    }
  ];

  // Get navigation items based on user role
  const getVisibleNavItems = () => {
    if (!user?.role) return [];
    
    let visibleBase = getNavItemsForRole(user.role);
    
    // Apply additional restrictions for contributors based on their permissions
    if (user.role === 'contributor' && user.restrictions) {
      visibleBase = visibleBase.filter(item => {
        // If contributor has scope restrictions, filter input submenu
        if (item.path === '/input' && user.restrictions.allowedScopes) {
          item.submenu = item.submenu.filter(subItem => {
            const scopeNum = subItem.path.split('scope=')[1];
            return user.restrictions.allowedScopes.includes(parseInt(scopeNum));
          });
        }
        
        // If contributor has no access to certain pages
        if (user.restrictions.restrictedPages && user.restrictions.restrictedPages.includes(item.path)) {
          return false;
        }
        
        return true;
      });
    }
    
    // Add admin items for admin users
    const visibleAdmin = user.role === 'admin' ? adminNavItems : [];
    
    return [...visibleBase, ...visibleAdmin];
  };

  const navItems = getVisibleNavItems();

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
    if (path === '/admin') {
      return location.pathname.startsWith('/admin');
    }
    return location.pathname === path;
  };

  // FIXED: Correct submenu active state checking
  const isSubmenuActive = (path) => {
    if (path.includes('scope=')) {
      const currentScope = new URLSearchParams(location.search).get('scope');
      const pathScope = path.split('scope=')[1];
      return location.pathname === '/input' && currentScope === pathScope;
    }
    return location.pathname === path;
  };

  const getRoleDisplay = (role) => {
    const roleMap = {
      admin: { label: 'Administrator', color: 'text-red-600', icon: Crown },
      analyst: { label: 'Analyst', color: 'text-blue-600', icon: BarChart3 },
      contributor: { label: 'Contributor', color: 'text-green-600', icon: FileText },
      viewer: { label: 'Viewer', color: 'text-gray-600', icon: Eye }
    };
    return roleMap[role] || { label: role, color: 'text-gray-600', icon: Users };
  };

  const userRoleInfo = getRoleDisplay(user?.role);

  return (
    <div className="w-64 bg-white shadow-lg flex flex-col">
      {/* Logo/Brand Section */}
      <div className="p-4 border-b">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">C</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-lg font-semibold text-gray-900">Carbon Track</span>
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </div>
        </div>
        
        {/* User Role Badge */}
        {user?.role && (
          <div className="mt-3 flex items-center space-x-2">
            <userRoleInfo.icon className={`w-4 h-4 ${userRoleInfo.color}`} />
            <span className={`text-xs font-medium ${userRoleInfo.color}`}>
              {userRoleInfo.label}
            </span>
            {/* Show restrictions for contributors */}
            {user.role === 'contributor' && user.restrictions && (
              <span className="text-xs text-orange-600">
                (Restricted)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        <ul className="space-y-2 px-3">
          {navItems.map((item) => (
            <li key={item.path}>
              {item.hasSubmenu ? (
                <div>
                  <button
                    onClick={() => {
                      if (item.path === '/input') {
                        setIsInputExpanded(!isInputExpanded);
                      } else if (item.path === '/admin') {
                        setIsAdminExpanded(!isAdminExpanded);
                      }
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isActive(item.path)
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <item.icon className="w-5 h-5" />
                      <span>{item.label}</span>
                      {item.label === 'Admin Panel' && (
                        <Shield className="w-3 h-3 text-red-500" />
                      )}
                    </div>
                    <ChevronDown className={`w-4 h-4 transition-transform ${
                      (item.path === '/input' && isInputExpanded) || 
                      (item.path === '/admin' && isAdminExpanded)
                        ? 'rotate-180' : ''
                    }`} />
                  </button>
                  
                  {/* Submenu */}
                  {((item.path === '/input' && isInputExpanded) || 
                    (item.path === '/admin' && isAdminExpanded)) && (
                    <ul className="ml-8 mt-2 space-y-1">
                      {item.submenu.map((subItem) => (
                        <li key={subItem.path}>
                          <Link
                            to={subItem.path}
                            className={`flex items-center space-x-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                              isSubmenuActive(subItem.path) // FIXED: Use correct submenu active check
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            {subItem.icon && <subItem.icon className="w-4 h-4" />}
                            <span>{subItem.label}</span>
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

        {/* Admin Quick Actions */}
        {user?.role === 'admin' && (
          <div className="mt-8 px-3">
            <div className="border-t pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Quick Actions
              </p>
              <div className="space-y-2">
                <Link
                  to="/admin/monitor"
                  className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <Activity className="w-4 h-4" />
                  <span>User Activities</span>
                </Link>
                <Link
                  to="/admin/users"
                  className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <UserCog className="w-4 h-4" />
                  <span>Add User</span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* User Profile Section */}
      <div className="p-4 border-t bg-gray-50">
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center">
            <span className="text-white font-medium text-sm">
              {user?.name ? user.name.split(' ').map(n => n[0]).join('') : 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.name || 'User'}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {user?.email || 'user@example.com'}
            </p>
          </div>
        </div>

        {/* User Stats for Contributors and above */}
        {user?.role && ['admin', 'analyst', 'contributor'].includes(user.role) && (
          <div className="mb-3 p-2 bg-white rounded-lg">
            <div className="text-xs text-gray-500 space-y-1">
              <div className="flex justify-between">
                <span>This Month:</span>
                <span className="font-medium text-gray-700">12 entries</span>
              </div>
              <div className="flex justify-between">
                <span>Total CO₂e:</span>
                <span className="font-medium text-emerald-600">2.4K</span>
              </div>
            </div>
          </div>
        )}
        
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