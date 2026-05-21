// components/Sidebar/Sidebar.jsx - Retractable Sidebar with Sustain360 Logo
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
  Menu,
  Building2,
  Sparkles,
  Leaf
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useState, useEffect } from 'react';
// Import the logo - adjust the path based on your project structure
import Sustain360Logo from '../../assets/Sustain360_Logo.svg';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdmin, getEffectiveAllowedScopes } = useAuth();
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
            { path: '/input?section=emissions&scope=1', label: 'Scope 1' },
            { path: '/input?section=emissions&scope=2', label: 'Scope 2' },
            { path: '/input?section=emissions&scope=3', label: 'Scope 3' },
            { path: '/input?section=production', label: 'Production' },
            { path: '/input?section=commute', label: 'Employee commuting' }
          ]
        },
        { path: '/monitor', icon: Monitor, label: 'Monitor' },
        { path: '/analytics', icon: BarChart3, label: 'Analytics' },
        { path: '/offset-opportunities', icon: Leaf, label: 'Offset Opportunities' },
        { path: '/reports', icon: Sparkles, label: 'AI Reports' },
        { path: '/organisation', icon: Building2, label: 'Organisation' },
        { path: '/settings', icon: Settings, label: 'Settings' }
      ],
      analyst: [
        { path: '/monitor', icon: Monitor, label: 'Monitor' },
        { path: '/analytics', icon: BarChart3, label: 'Analytics' },
        { path: '/offset-opportunities', icon: Leaf, label: 'Offset Opportunities' },
        { path: '/organisation', icon: Building2, label: 'Organisation' },
        { path: '/settings', icon: Settings, label: 'Settings' }
      ],
      contributor: [
        { 
          path: '/input', 
          icon: FileText, 
          label: 'Input',
          hasSubmenu: true,
          submenu: [
            { path: '/input?section=emissions&scope=1', label: 'Scope 1' },
            { path: '/input?section=emissions&scope=2', label: 'Scope 2' },
            { path: '/input?section=emissions&scope=3', label: 'Scope 3' },
            { path: '/input?section=production', label: 'Production' },
            { path: '/input?section=commute', label: 'Employee commuting' }
          ]
        },
        { path: '/offset-opportunities', icon: Leaf, label: 'Offset Opportunities' },
        { path: '/organisation', icon: Building2, label: 'Organisation' },
        { path: '/settings', icon: Settings, label: 'Settings' }
      ],
      viewer: [
        { path: '/dashboard', icon: Home, label: 'Dashboard' },
        { path: '/monitor', icon: Monitor, label: 'Monitor' },
        { path: '/analytics', icon: BarChart3, label: 'Analytics' },
        { path: '/offset-opportunities', icon: Leaf, label: 'Offset Opportunities' },
        { path: '/organisation', icon: Building2, label: 'Organisation' },
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
        if (item.path === '/input' && user.restrictions) {
          const effective = getEffectiveAllowedScopes ? getEffectiveAllowedScopes() : [];
          const hasScopeOrActivityRbac =
            (Array.isArray(user.restrictions.allowedScopes) &&
              user.restrictions.allowedScopes.length > 0) ||
            (Array.isArray(user.restrictions.allowedActivities) &&
              user.restrictions.allowedActivities.length > 0);
          if (hasScopeOrActivityRbac && effective.length > 0) {
            item.submenu = item.submenu.filter((subItem) => {
              const scopeNum = subItem.path.split('scope=')[1];
              const sn = parseInt(String(scopeNum), 10);
              if (!Number.isFinite(sn)) return false;
              return effective.some((s) => parseInt(String(s), 10) === sn);
            });
          }
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
    if (path === '/offset-opportunities') {
      return location.pathname.startsWith('/offset-opportunities');
    }
    return location.pathname === path;
  };

  // FIXED: Correct submenu active state checking
  const isSubmenuActive = (path) => {
    if (location.pathname !== '/input') return false;
    const locParams = new URLSearchParams(location.search);
    const pathParams = new URLSearchParams(path.split('?')[1] || '');

    const pathSection = pathParams.get('section');
    if (pathSection === 'production' || pathSection === 'commute') {
      return locParams.get('section') === pathSection;
    }

    if (pathParams.get('scope')) {
      const pathScope = pathParams.get('scope');
      const currentScope = locParams.get('scope');
      const currentSection = locParams.get('section');
      const onEmissions = !currentSection || currentSection === 'emissions';
      return onEmissions && currentScope === pathScope;
    }

    return false;
  };

  const getNavItemClasses = (active, { submenu = false } = {}) => {
    if (isCollapsed) {
      return ['sidebar-nav-item-icon w-full', active && 'sidebar-nav-item-icon-active'].filter(Boolean).join(' ');
    }
    return [
      'sidebar-nav-item w-full',
      submenu && 'justify-between',
      active && 'sidebar-nav-item-active',
      active && 'sidebar-nav-item-active-indicator'
    ]
      .filter(Boolean)
      .join(' ');
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
        } app-sidebar transition-[width] duration-200 ease-out relative overflow-visible ${
          isMobile ? 'fixed inset-y-0 left-0 z-40' : ''
        } z-20`}
      >
        {/* Logo/Brand Section */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 relative">
          {/* Toggle Button - Desktop */}
          {!isMobile && (
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="absolute -right-3 top-6 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full p-1 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors z-10"
            >
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-300" />
              ) : (
                <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
              )}
            </button>
          )}

          <div className={isCollapsed ? 'flex justify-center' : 'brand-lockup'}>
            <div className="brand-mark" aria-hidden>
              CD
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="brand-name truncate">Carbon Desk</p>
                <p className="brand-tagline">Emissions intelligence</p>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <div className="mt-3 flex items-center gap-2 px-0.5">
              <img
                src={Sustain360Logo}
                alt=""
                className="h-5 w-auto opacity-60 dark:opacity-50 object-contain"
                aria-hidden
              />
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">by Sustain360</span>
            </div>
          )}

          {user?.role && !isCollapsed && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="badge bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-700">
                <userRoleInfo.icon className={`w-3 h-3 ${userRoleInfo.color}`} />
                {userRoleInfo.label}
              </span>
              {user.role === 'contributor' && user.restrictions && (
                <span className="text-caption text-amber-700 dark:text-amber-400">Restricted</span>
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
        <nav className="flex-1 py-3 overflow-x-visible overflow-y-auto">
          {!isCollapsed && <p className="sidebar-section-label">Platform</p>}
          <ul className={`space-y-0.5 ${isCollapsed ? 'px-1.5' : 'px-3'}`}>
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
                      className={getNavItemClasses(isActive(item.path), { submenu: true })}
                      title={isCollapsed ? item.label : ''}
                    >
                      {isCollapsed ? (
                        <item.icon
                          className={`w-[18px] h-[18px] shrink-0 ${isActive(item.path) ? 'text-[hsl(var(--primary))]' : ''}`}
                        />
                      ) : (
                        <>
                          <div className="flex items-center gap-3 min-w-0">
                            <item.icon
                              className={`w-[18px] h-[18px] shrink-0 ${isActive(item.path) ? 'text-[hsl(var(--primary))]' : ''}`}
                            />
                            <span className="truncate">{item.label}</span>
                            {item.label === 'Admin Panel' && <Shield className="w-3 h-3 shrink-0 text-red-500" />}
                          </div>
                          <ChevronDown
                            className={`w-4 h-4 shrink-0 transition-transform ${
                              (item.path === '/input' && isInputExpanded) ||
                              (item.path === '/admin' && isAdminExpanded)
                                ? 'rotate-180'
                                : ''
                            }`}
                          />
                        </>
                      )}
                    </button>
                    
                    {/* Submenu - Regular (Expanded Sidebar) */}
                    {!isCollapsed && ((item.path === '/input' && isInputExpanded) || 
                      (item.path === '/admin' && isAdminExpanded)) && (
                      <ul className="ml-9 mt-2 space-y-2 animate-slideDown">
                        {item.submenu.map((subItem) => (
                          <li key={subItem.path}>
                            <Link
                              to={subItem.path}
                              className={
                                isSubmenuActive(subItem.path)
                                  ? 'sidebar-subnav-item-active sidebar-subnav-item'
                                  : 'sidebar-subnav-item'
                              }
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
                      <div className="absolute left-full top-0 ml-2 app-card shadow-md py-2 px-1 min-w-[180px] z-50">
                        {/* Arrow pointing to sidebar */}
                        <div className="absolute left-0 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
                          <div className="w-2 h-2 bg-white dark:bg-gray-800 border-l border-t border-gray-200 dark:border-gray-700 transform rotate-45"></div>
                        </div>
                        
                        {/* Menu Title */}
                        <div className="px-4 py-2 border-b border-gray-100 mb-2">
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
                              className={
                                isSubmenuActive(subItem.path)
                                  ? 'sidebar-subnav-item-active sidebar-subnav-item'
                                  : 'sidebar-subnav-item'
                              }
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
                    className={getNavItemClasses(isActive(item.path))}
                    title={isCollapsed ? item.label : ''}
                  >
                    <item.icon
                      className={`w-[18px] h-[18px] shrink-0 ${isActive(item.path) ? 'text-[hsl(var(--primary))]' : ''}`}
                    />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
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
                  <Link
                    to="/organisation"
                    className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <Building2 className="w-4 h-4 flex-shrink-0" />
                    <span>Organisation</span>
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
        <div className={`p-4 border-t border-zinc-200 dark:border-zinc-800 ${isCollapsed ? 'px-2' : ''}`}>
          {!isCollapsed ? (
            <>
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-9 h-9 bg-[hsl(var(--primary))] rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-medium text-sm">
                    {user?.name ? user.name.split(' ').map(n => n[0]).join('') : 'U'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {user?.name || 'User'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {user?.email || 'user@example.com'}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex justify-center mb-3">
              <div className="w-9 h-9 bg-[hsl(var(--primary))] rounded-full flex items-center justify-center">
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