// components/ProtectedRoute.jsx - Enhanced with automatic redirect for restricted users
import { useAuth } from '../context/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';

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

  // Helper function to get first accessible route for user
  const getFirstAccessibleRoute = () => {
    const roleRouteMap = {
      admin: '/dashboard',
      analyst: '/analytics',
      contributor: '/input',
      viewer: '/dashboard'
    };
    return roleRouteMap[user?.role] || '/settings';
  };

  // Check required roles if specified
  if (requiredRoles.length > 0 && !hasRole(requiredRoles)) {
    return <Navigate to={getFirstAccessibleRoute()} replace />;
  }

  // Check required permissions if specified
  if (requiredPermissions.length > 0) {
    const hasRequiredPermissions = requiredPermissions.every(permission => hasPermission(permission));
    if (!hasRequiredPermissions) {
      return <Navigate to={getFirstAccessibleRoute()} replace />;
    }
  }

  // STRICT RBAC: Check page access
  if (!hasPageAccess) {
    return <Navigate to={getFirstAccessibleRoute()} replace />;
  }

  // Additional restrictions for contributors
  if (user?.role === 'contributor' && user?.restrictions) {
    if (user.restrictions.restrictedPages?.includes(`/${currentPage}`)) {
      return <Navigate to={getFirstAccessibleRoute()} replace />;
    }
  }

  return children;
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