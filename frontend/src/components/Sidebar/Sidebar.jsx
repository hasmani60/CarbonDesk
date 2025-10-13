// components/Sidebar/Sidebar.jsx - Retractable Sidebar with Enhanced UX
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
  ChevronRight,
  Shield,
  Activity,
  Eye,
  UserCog,
  Crown,
  Users,
  Menu
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useState, useEffect } from 'react';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuth();
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const [isAdminExpanded, setIsAdminExpanded] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [hoveredSubmenu, setHoveredSubmenu] = useState(null);

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setIsCollapsed(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-collapse on mobile when route changes
  useEffect(() => {
    if (isMobile) {
      setIsCollapsed(true);
    }
  }, [location.pathname, isMobile]);

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
      admin: { label: 'Administrator', color: 'text-red-600', bgColor: 'bg-red-100', icon: Crown },
      analyst: { label: 'Analyst', color: 'text-blue-600', bgColor: 'bg-blue-100', icon: BarChart3 },
      contributor: { label: 'Contributor', color: 'text-green-600', bgColor: 'bg-green-100', icon: FileText },
      viewer: { label: 'Viewer', color: 'text-gray-600', bgColor: 'bg-gray-100', icon: Eye }
    };
    return roleMap[role] || { label: role, color: 'text-gray-600', bgColor: 'bg-gray-100', icon: Users };
  };

  const userRoleInfo = getRoleDisplay(user?.role);

  return (
    <>
      {/* Mobile Menu Button */}
      {isMobile && (
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-lg md:hidden"
        >
          <Menu className="w-6 h-6 text-gray-700" />
        </button>
      )}

      {/* Sidebar Container */}
      <div 
        className={`${
          isCollapsed ? 'w-20' : 'w-64'
        } bg-white shadow-lg flex flex-col transition-all duration-300 ease-in-out relative overflow-visible ${
          isMobile ? 'fixed inset-y-0 left-0 z-40' : ''
        }`}
      >
        {/* Logo/Brand Section */}
        <div className="p-4 border-b relative">
          {/* Toggle Button - Desktop */}
          {!isMobile && (
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="absolute -right-3 top-6 bg-white border border-gray-200 rounded-full p-1 hover:bg-gray-50 transition-colors shadow-sm z-10"
            >
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4 text-gray-600" />
              ) : (
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              )}
            </button>
          )}

          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-lg">C</span>
            </div>
            {!isCollapsed && (
              <div className="flex items-center space-x-2 overflow-hidden">
                <span className="text-lg font-semibold text-gray-900 whitespace-nowrap">Carbon Track</span>
              </div>
            )}
          </div>
          
          {/* User Role Badge */}
          {user?.role && !isCollapsed && (
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

          {/* Collapsed Role Indicator */}
          {user?.role && isCollapsed && (
            <div className="mt-2 flex justify-center">
              <div className={`w-2 h-2 rounded-full ${userRoleInfo.bgColor}`}></div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-x-visible overflow-y-auto">
          <ul className={`space-y-2 ${isCollapsed ? 'px-2' : 'px-3'}`}>
            {navItems.map((item) => (
              <li 
                key={item.path}
                className="relative"
                onMouseEnter={() => isCollapsed && item.hasSubmenu && setHoveredSubmenu(item.path)}
                onMouseLeave={() => isCollapsed && setHoveredSubmenu(null)}
              >
                {item.hasSubmenu ? (
                  <div>
                    <button
                      onClick={() => {
                        if (isCollapsed) {
                          setIsCollapsed(false);
                          if (item.path === '/input') {
                            setIsInputExpanded(true);
                          } else if (item.path === '/admin') {
                            setIsAdminExpanded(true);
                          }
                        } else {
                          if (item.path === '/input') {
                            setIsInputExpanded(!isInputExpanded);
                          } else if (item.path === '/admin') {
                            setIsAdminExpanded(!isAdminExpanded);
                          }
                        }
                      }}
                      className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all ${
                        isActive(item.path)
                          ? 'bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-800 shadow-sm'
                          : 'text-gray-600 hover:bg-gray-50'
                      } ${isCollapsed ? 'justify-center px-0' : 'justify-between'}`}
                      title={isCollapsed ? item.label : ''}
                    >
                      <div className={`flex items-center ${isCollapsed ? 'justify-center w-full' : 'space-x-3'}`}>
                        <item.icon className="w-5 h-5 flex-shrink-0" />
                        {!isCollapsed && (
                          <>
                            <span>{item.label}</span>
                            {item.label === 'Admin Panel' && (
                              <Shield className="w-3 h-3 text-red-500" />
                            )}
                          </>
                        )}
                      </div>
                      {!isCollapsed && (
                        <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${
                          (item.path === '/input' && isInputExpanded) || 
                          (item.path === '/admin' && isAdminExpanded)
                            ? 'rotate-180' : ''
                        }`} />
                      )}
                    </button>
                    
                    {/* Submenu - Regular (Expanded Sidebar) */}
                    {!isCollapsed && ((item.path === '/input' && isInputExpanded) || 
                      (item.path === '/admin' && isAdminExpanded)) && (
                      <ul className="ml-8 mt-2 space-y-1 animate-slideDown">
                        {item.submenu.map((subItem) => (
                          <li key={subItem.path}>
                            <Link
                              to={subItem.path}
                              className={`flex items-center space-x-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                                isSubmenuActive(subItem.path)
                                  ? 'bg-emerald-50 text-emerald-700 font-medium'
                                  : 'text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              {subItem.icon && <subItem.icon className="w-4 h-4" />}
                              <span>{subItem.label}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Hover Submenu - Collapsed Sidebar */}
                    {isCollapsed && hoveredSubmenu === item.path && (
                      <div className="absolute left-full top-0 ml-2 bg-white rounded-lg shadow-xl border border-gray-200 py-2 px-1 min-w-[160px] z-50 animate-scaleIn">
                        {/* Arrow pointing to sidebar */}
                        <div className="absolute left-0 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
                          <div className="w-2 h-2 bg-white border-l border-t border-gray-200 transform rotate-45"></div>
                        </div>
                        
                        {/* Menu Title */}
                        <div className="px-3 py-2 border-b border-gray-100 mb-1">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            {item.label}
                          </p>
                        </div>
                        
                        {/* Submenu Items */}
                        <div className="space-y-1 px-2">
                          {item.submenu.map((subItem) => (
                            <Link
                              key={subItem.path}
                              to={subItem.path}
                              className={`flex items-center space-x-2 px-3 py-2 text-sm rounded-md transition-colors ${
                                isSubmenuActive(subItem.path)
                                  ? 'bg-emerald-50 text-emerald-700 font-medium'
                                  : 'text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              {subItem.icon && <subItem.icon className="w-4 h-4 flex-shrink-0" />}
                              <span className="whitespace-nowrap">{subItem.label}</span>
                              {isSubmenuActive(subItem.path) && (
                                <div className="ml-auto w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                              )}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <Link
                    to={item.path}
                    className={`flex items-center py-2.5 text-sm font-medium rounded-lg transition-all ${
                      isActive(item.path)
                        ? 'bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-800 shadow-sm'
                        : 'text-gray-600 hover:bg-gray-50'
                    } ${isCollapsed ? 'justify-center px-0' : 'px-3 space-x-3'}`}
                    title={isCollapsed ? item.label : ''}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    {!isCollapsed && <span>{item.label}</span>}
                  </Link>
                )}
              </li>
            ))}
          </ul>

          {/* Admin Quick Actions */}
          {user?.role === 'admin' && !isCollapsed && (
            <div className="mt-8 px-3">
              <div className="border-t pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Quick Actions
                </p>
                <div className="space-y-2">
                  <Link
                    to="/admin/monitor"
                    className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <Activity className="w-4 h-4 flex-shrink-0" />
                    <span>User Activities</span>
                  </Link>
                  <Link
                    to="/admin/users"
                    className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <UserCog className="w-4 h-4 flex-shrink-0" />
                    <span>Add User</span>
                  </Link>
                </div>
              </div>
            </div>
          )}
          
          {/* Collapsed Admin Indicator */}
          {user?.role === 'admin' && isCollapsed && (
            <div className="mt-8 px-2">
              <div className="border-t pt-4 flex justify-center">
                <div className="w-2 h-2 bg-red-500 rounded-full" title="Admin"></div>
              </div>
            </div>
          )}
        </nav>

        {/* User Profile Section */}
        <div className={`p-4 border-t bg-gradient-to-br from-gray-50 to-white ${isCollapsed ? 'px-2' : ''}`}>
          {!isCollapsed ? (
            <>
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-full flex items-center justify-center flex-shrink-0">
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
                <div className="mb-3 p-3 bg-white rounded-lg border border-gray-100 shadow-sm">
                  <div className="text-xs text-gray-500 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span>This Month:</span>
                      <span className="font-semibold text-gray-700">12 entries</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Total CO₂e:</span>
                      <span className="font-semibold text-emerald-600">2.4K kg</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex justify-center mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-full flex items-center justify-center">
                <span className="text-white font-medium text-sm">
                  {user?.name ? user.name.split(' ').map(n => n[0]).join('') : 'U'}
                </span>
              </div>
            </div>
          )}
          
          <button
            onClick={handleLogout}
            className={`flex items-center w-full px-3 py-2 text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors ${
              isCollapsed ? 'justify-center' : 'space-x-2'
            }`}
            title={isCollapsed ? 'Logout' : ''}
          >
            <LogOut className="w-4 h-4" />
            {!isCollapsed && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* Mobile Overlay */}
      {isMobile && !isCollapsed && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsCollapsed(true)}
        />
      )}
    </>
  );
};

export default Sidebar;