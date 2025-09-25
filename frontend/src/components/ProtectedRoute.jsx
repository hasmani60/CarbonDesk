// components/ProtectedRoute.jsx - Enhanced with strict RBAC enforcement
import { useAuth } from '../context/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import { Shield, Lock, AlertCircle } from 'lucide-react';

const ProtectedRoute = ({ children, requiredRoles = [], requiredPermissions = [] }) => {
  const { isAuthenticated, loading, user, hasRole, hasPermission, canAccessPage } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Extract page from current path
  const currentPage = location.pathname.split('/')[1] || 'dashboard';

  // STRICT RBAC: Check if user can access the current page
  const pageAccessCheck = canAccessPage(`/${currentPage}`);
  
  // Define strict role-based page access
  const strictRolePageAccess = {
    admin: ['dashboard', 'input', 'monitor', 'analytics', 'settings', 'admin'],
    analyst: ['analytics', 'settings'],
    contributor: ['input', 'settings'],
    viewer: ['dashboard', 'monitor', 'analytics', 'settings']
  };

  const userAllowedPages = strictRolePageAccess[user?.role] || [];
  const hasPageAccess = userAllowedPages.includes(currentPage) || 
                       (currentPage === 'admin' && user?.role === 'admin');

  // Check required roles if specified
  if (requiredRoles.length > 0 && !hasRole(requiredRoles)) {
    return (
      <AccessDeniedPage 
        reason="role"
        userRole={user?.role}
        requiredRoles={requiredRoles}
        currentPath={location.pathname}
      />
    );
  }

  // Check required permissions if specified
  if (requiredPermissions.length > 0) {
    const hasRequiredPermissions = requiredPermissions.every(permission => hasPermission(permission));
    if (!hasRequiredPermissions) {
      return (
        <AccessDeniedPage 
          reason="permission"
          userRole={user?.role}
          requiredPermissions={requiredPermissions}
          currentPath={location.pathname}
        />
      );
    }
  }

  // STRICT RBAC: Check page access
  if (!hasPageAccess) {
    return (
      <AccessDeniedPage 
        reason="page"
        userRole={user?.role}
        currentPath={location.pathname}
        allowedPages={userAllowedPages}
      />
    );
  }

  // Additional restrictions for contributors
  if (user?.role === 'contributor' && user?.restrictions) {
    if (user.restrictions.restrictedPages?.includes(`/${currentPage}`)) {
      return (
        <AccessDeniedPage 
          reason="restriction"
          userRole={user?.role}
          currentPath={location.pathname}
          restrictions={user.restrictions}
        />
      );
    }
  }

  return children;
};

// Enhanced Access Denied component
const AccessDeniedPage = ({ 
  reason, 
  userRole, 
  requiredRoles = [], 
  requiredPermissions = [], 
  currentPath, 
  allowedPages = [],
  restrictions = null 
}) => {
  const getAccessibleRoutes = () => {
    const roleRouteMap = {
      admin: [
        { path: '/dashboard', name: 'Dashboard' },
        { path: '/input', name: 'Input' },
        { path: '/monitor', name: 'Monitor' },
        { path: '/analytics', name: 'Analytics' },
        { path: '/settings', name: 'Settings' },
        { path: '/admin', name: 'Admin Panel' }
      ],
      analyst: [
        { path: '/analytics', name: 'Analytics' },
        { path: '/settings', name: 'Settings' }
      ],
      contributor: [
        { path: '/input', name: 'Input' },
        { path: '/settings', name: 'Settings' }
      ],
      viewer: [
        { path: '/dashboard', name: 'Dashboard' },
        { path: '/monitor', name: 'Monitor' },
        { path: '/analytics', name: 'Analytics' },
        { path: '/settings', name: 'Settings' }
      ]
    };

    return roleRouteMap[userRole] || [];
  };

  const getReasonMessage = () => {
    switch (reason) {
      case 'role':
        return {
          title: 'Insufficient Role Privileges',
          message: `Your role (${userRole}) doesn't have access to this page.`,
          details: `Required roles: ${requiredRoles.join(', ')}`,
          icon: Shield
        };
      case 'permission':
        return {
          title: 'Missing Permissions',
          message: `You don't have the required permissions to access this page.`,
          details: `Required permissions: ${requiredPermissions.join(', ')}`,
          icon: Lock
        };
      case 'page':
        return {
          title: 'Page Access Restricted',
          message: `Your role (${userRole}) doesn't have access to ${currentPath}.`,
          details: `This page is restricted by your role-based access control settings.`,
          icon: AlertCircle
        };
      case 'restriction':
        return {
          title: 'Additional Restrictions Applied',
          message: `This page has been specifically restricted for your account.`,
          details: `Contact your administrator to modify your access restrictions.`,
          icon: Lock
        };
      default:
        return {
          title: 'Access Denied',
          message: 'You do not have permission to access this page.',
          details: 'Please contact your administrator for assistance.',
          icon: Shield
        };
    }
  };

  const reasonInfo = getReasonMessage();
  const IconComponent = reasonInfo.icon;
  const accessibleRoutes = getAccessibleRoutes();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-lg w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <IconComponent className="w-8 h-8 text-red-600" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-4">{reasonInfo.title}</h1>
        
        <p className="text-gray-600 mb-2">{reasonInfo.message}</p>
        <p className="text-sm text-gray-500 mb-6">{reasonInfo.details}</p>

        {/* Role and Restrictions Info */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="text-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-yellow-800">Your Role:</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                userRole === 'admin' ? 'bg-red-100 text-red-800' :
                userRole === 'analyst' ? 'bg-blue-100 text-blue-800' :
                userRole === 'contributor' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {userRole?.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-yellow-800">Attempted Access:</span>
              <span className="text-yellow-700 font-mono text-xs">{currentPath}</span>
            </div>
            {restrictions && (
              <div className="mt-2 pt-2 border-t border-yellow-200">
                <p className="text-xs text-yellow-700">
                  <strong>Additional Restrictions:</strong>
                </p>
                {restrictions.allowedScopes && restrictions.allowedScopes.length < 3 && (
                  <p className="text-xs text-yellow-600">• Limited to Scopes: {restrictions.allowedScopes.join(', ')}</p>
                )}
                {restrictions.allowedActivities && restrictions.allowedActivities.length > 0 && (
                  <p className="text-xs text-yellow-600">• Limited to {restrictions.allowedActivities.length} specific activities</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Available Pages */}
        {accessibleRoutes.length > 0 && (
          <div className="mb-6">
            <p className="text-sm font-medium text-gray-700 mb-3">Pages you can access:</p>
            <div className="grid grid-cols-1 gap-2">
              {accessibleRoutes.map(route => (
                <a
                  key={route.path}
                  href={route.path}
                  className="text-left p-3 border border-gray-200 rounded-lg hover:bg-emerald-50 hover:border-emerald-200 transition-colors group"
                >
                  <div className="font-medium text-gray-900 group-hover:text-emerald-700">
                    {route.name}
                  </div>
                  <div className="text-sm text-gray-500 font-mono">
                    {route.path}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={() => window.history.back()}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Go Back
          </button>
          {accessibleRoutes.length > 0 && (
            <a
              href={accessibleRoutes[0].path}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-center"
            >
              {accessibleRoutes[0].name}
            </a>
          )}
        </div>

        {/* Support Info */}
        <div className="mt-6 pt-4 border-t text-xs text-gray-500">
          <p>Need different access? Contact your system administrator.</p>
          <p className="mt-1">Error Code: RBAC_{reason?.toUpperCase()}_{userRole?.toUpperCase()}</p>
        </div>
      </div>
    </div>
  );
};

// Higher-order component for role-based access
export const withRoleGuard = (Component, allowedRoles = []) => {
  return function RoleGuardedComponent(props) {
    return (
      <ProtectedRoute requiredRoles={allowedRoles}>
        <Component {...props} />
      </ProtectedRoute>
    );
  };
};

// Higher-order component for permission-based access
export const withPermissionGuard = (Component, requiredPermissions = []) => {
  return function PermissionGuardedComponent(props) {
    return (
      <ProtectedRoute requiredPermissions={requiredPermissions}>
        <Component {...props} />
      </ProtectedRoute>
    );
  };
};

// Specific route guards for common use cases
export const AdminOnly = ({ children }) => (
  <ProtectedRoute requiredRoles={['admin']}>
    {children}
  </ProtectedRoute>
);

export const AnalystOrAdmin = ({ children }) => (
  <ProtectedRoute requiredRoles={['admin', 'analyst']}>
    {children}
  </ProtectedRoute>
);

export const ContributorOrAbove = ({ children }) => (
  <ProtectedRoute requiredRoles={['admin', 'analyst', 'contributor']}>
    {children}
  </ProtectedRoute>
);

export const AllAuthenticated = ({ children }) => (
  <ProtectedRoute>
    {children}
  </ProtectedRoute>
);

export default ProtectedRoute;