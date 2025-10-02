// context/AuthContext.jsx - Enhanced with RBAC Support and Organization Context Clearing
import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState({});

  // Initialize authentication state
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      console.log('Initializing auth with token:', token ? 'present' : 'missing');

      // Verify token with backend
      const response = await authAPI.verifyToken();
      console.log('Token verification response:', response);
      
      if (response && (response.success !== false)) {
        const userData = response.data || response;
        setUser(userData);
        setPermissions(userData.permissions || {});
        setIsAuthenticated(true);
        console.log('Auth initialized for user:', userData.email, 'Role:', userData.role, 'Org ID:', userData.organisation_id, 'Restrictions:', userData.restrictions);
      } else {
        // Invalid token
        console.log('Token verification failed');
        localStorage.removeItem('token');
        setUser(null);
        setIsAuthenticated(false);
        setPermissions({});
      }
    } catch (error) {
      console.error('Auth initialization failed:', error);
      localStorage.removeItem('token');
      setUser(null);
      setIsAuthenticated(false);
      setPermissions({});
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials) => {
    try {
      setLoading(true);
      console.log('Login attempt with credentials:', { email: credentials.email });
      
      // CRITICAL: Clear ALL cached organization data before login
      console.log('Clearing cached organization data...');
      const keysToRemove = [
        'emissions',
        'dashboardData',
        'organisationId',
        'organizationId',
        'orgData',
        'cachedEmissions',
        'cachedDashboard'
      ];
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      const response = await authAPI.login(credentials);
      console.log('Raw login response:', response);
      
      // Handle different response formats
      let loginData;
      if (response && response.data) {
        // Standard format: { success: true, data: { token, user } }
        loginData = response.data;
      } else if (response && response.token && response.user) {
        // Direct format: { token, user }
        loginData = response;
      } else if (response) {
        // Response is the data itself
        loginData = response;
      } else {
        throw new Error('Invalid response format');
      }

      console.log('Processed login data:', loginData);

      if (!loginData.token || !loginData.user) {
        throw new Error('Missing token or user data in response');
      }

      const { token, user: userData } = loginData;
      
      // Store token
      localStorage.setItem('token', token);
      
      // CRITICAL: Log the organization_id from login response
      console.log('=================================');
      console.log('USER LOGIN ORGANIZATION CONTEXT:');
      console.log('User ID:', userData.id);
      console.log('User Email:', userData.email);
      console.log('User Role:', userData.role);
      console.log('Organisation ID:', userData.organisation_id);
      console.log('=================================');
      
      // Set user state
      setUser(userData);
      setPermissions(userData.permissions || {});
      setIsAuthenticated(true);
      
      console.log('Login successful for:', userData.email, 'Role:', userData.role, 'Org ID:', userData.organisation_id, 'Restrictions:', userData.restrictions);
      toast.success(`Welcome back, ${userData.name}!`);
      
      return { success: true, user: userData };
    } catch (error) {
      console.error('Login error in AuthContext:', error);
      
      // Extract error message
      let message = 'Login failed';
      
      if (error.response?.data?.message) {
        message = error.response.data.message;
      } else if (error.message && error.message !== 'Login failed') {
        message = error.message;
      } else if (error.status === 'NETWORK_ERROR') {
        message = 'Unable to connect to server. Please check if the backend is running.';
      }
      
      console.error('Final error message:', message);
      toast.error(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Call logout endpoint
      await authAPI.logout();
    } catch (error) {
      console.error('Logout API call failed:', error);
      // Continue with logout even if API call fails
    } finally {
      // Clear local state
      localStorage.removeItem('token');
      
      // ALSO CLEAR organization cached data on logout
      const keysToRemove = [
        'emissions',
        'dashboardData',
        'organisationId',
        'organizationId',
        'orgData',
        'cachedEmissions',
        'cachedDashboard'
      ];
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      setUser(null);
      setIsAuthenticated(false);
      setPermissions({});
      toast.success('Logged out successfully');
    }
  };

  const updateProfile = async (profileData) => {
    try {
      const response = await authAPI.updateProfile(profileData);
      const updatedUser = response.data || response;
      setUser(updatedUser);
      toast.success('Profile updated successfully');
      return updatedUser;
    } catch (error) {
      const message = error.response?.data?.message || 'Profile update failed';
      toast.error(message);
      throw error;
    }
  };

  const changePassword = async (passwordData) => {
    try {
      await authAPI.changePassword(passwordData);
      toast.success('Password changed successfully');
    } catch (error) {
      const message = error.response?.data?.message || 'Password change failed';
      toast.error(message);
      throw error;
    }
  };

  // Permission checking functions
  const hasPermission = (permission) => {
    if (!isAuthenticated || !permissions) return false;
    return permissions[permission] === true;
  };

  const hasRole = (roles) => {
    if (!isAuthenticated || !user?.role) return false;
    const roleArray = Array.isArray(roles) ? roles : [roles];
    return roleArray.includes(user.role);
  };

  const canAccess = (resource, action = 'read') => {
    if (!isAuthenticated) return false;
    
    // Admin has access to everything
    if (user?.role === 'admin') return true;
    
    const permissionKey = `${resource}_${action}`;
    return hasPermission(permissionKey);
  };

  // RBAC: Check if user can access specific scope
  const canAccessScope = (scope) => {
    if (!isAuthenticated) return false;
    
    // Admin and analysts have full access
    if (['admin', 'analyst'].includes(user?.role)) return true;
    
    // Viewers can access all scopes for viewing
    if (user?.role === 'viewer') return true;
    
    // Contributors with granular restrictions
    if (user?.role === 'contributor') {
      if (!user.restrictions) {
        return true; // No restrictions = full access (legacy users)
      }
      
      const { allowedScopes, allowedActivities } = user.restrictions;
      
      // Check if scope is explicitly allowed
      if (allowedScopes && allowedScopes.includes(parseInt(scope))) {
        return true;
      }
      
      // Check if user has any activities in this scope
      if (allowedActivities && allowedActivities.length > 0) {
        // Import emission factors to check which activities belong to this scope
        // For now, we'll do a simple check - you might want to import emissionFactors here
        const scopeActivities = {
          1: ['Fuel from Generator', 'Wood Burnt for Boilers', 'Fuel Used by Company vehicles', 'Refrigerant Purchased', 'Water Used', 'Water Recycled', 'Waste Generation', 'Fuel used in mess', 'Steam Production', 'AC service data'],
          2: ['Electricity Purchased'],
          3: ['Transport: Harbor to plant', 'Export of Material', 'Domestic Sales Transport', 'Employee transport', 'Business travel']
        };
        
        const activitiesInScope = scopeActivities[parseInt(scope)] || [];
        const hasActivityInScope = allowedActivities.some(activity => 
          activitiesInScope.includes(activity)
        );
        
        return hasActivityInScope;
      }
      
      // No explicit scope access and no activities in this scope
      return false;
    }
    
    return false;
  };

  // RBAC: Check if user can access specific activity
  const canAccessActivity = (activity) => {
    if (!isAuthenticated) return false;
    
    // Admin and analysts have full access
    if (['admin', 'analyst'].includes(user?.role)) return true;
    
    // Viewers can access all activities for viewing
    if (user?.role === 'viewer') return true;
    
    // Contributors with granular restrictions
    if (user?.role === 'contributor') {
      if (!user.restrictions) {
        return true; // No restrictions = full access (legacy users)
      }
      
      const { allowedScopes, allowedActivities } = user.restrictions;
      
      // If user has specific activity restrictions, check if this activity is allowed
      if (allowedActivities && allowedActivities.length > 0) {
        return allowedActivities.includes(activity);
      }
      
      // If no specific activity restrictions, check scope-level access
      // Find which scope this activity belongs to
      const scopeActivities = {
        1: ['Fuel from Generator', 'Wood Burnt for Boilers', 'Fuel Used by Company vehicles', 'Refrigerant Purchased', 'Water Used', 'Water Recycled', 'Waste Generation', 'Fuel used in mess', 'Steam Production', 'AC service data'],
        2: ['Electricity Purchased'],
        3: ['Transport: Harbor to plant', 'Export of Material', 'Domestic Sales Transport', 'Employee transport', 'Business travel']
      };
      
      for (let scope = 1; scope <= 3; scope++) {
        const activitiesInScope = scopeActivities[scope] || [];
        if (activitiesInScope.includes(activity)) {
          // Check if user has access to this scope
          if (allowedScopes && allowedScopes.includes(scope)) {
            return true;
          }
          break;
        }
      }
      
      return false;
    }
    
    return false;
  };

  // RBAC: Check if user can access specific page
  const canAccessPage = (page) => {
    if (!isAuthenticated) return false;
    
    // Admin has full access
    if (user?.role === 'admin') return true;
    
    // Define role-based page access
    const rolePageAccess = {
      analyst: ['/dashboard', '/input', '/monitor', '/analytics', '/settings'],
      contributor: ['/dashboard', '/input', '/monitor', '/settings'],
      viewer: ['/dashboard', '/monitor']
    };
    
    const allowedPages = rolePageAccess[user?.role] || [];
    
    if (!allowedPages.includes(page)) {
      return false;
    }
    
    // Check for specific restrictions
    if (user?.role === 'contributor' && user?.restrictions?.restrictedPages) {
      return !user.restrictions.restrictedPages.includes(page);
    }
    
    return true;
  };

  const getEffectiveAllowedScopes = () => {
    if (!isAuthenticated) return [];
    
    // Admin and analysts have full access
    if (['admin', 'analyst'].includes(user?.role)) return [1, 2, 3];
    
    // Viewers can see all scopes
    if (user?.role === 'viewer') return [1, 2, 3];
    
    // Contributors with restrictions
    if (user?.role === 'contributor') {
      if (!user.restrictions) {
        return [1, 2, 3]; // No restrictions = full access
      }
      
      const { allowedScopes, allowedActivities } = user.restrictions;
      const effectiveScopes = new Set();
      
      // Add explicitly allowed scopes
      if (allowedScopes) {
        allowedScopes.forEach(scope => effectiveScopes.add(scope));
      }
      
      // Add scopes that have allowed activities
      if (allowedActivities && allowedActivities.length > 0) {
        const scopeActivities = {
          1: ['Fuel from Generator', 'Wood Burnt for Boilers', 'Fuel Used by Company vehicles', 'Refrigerant Purchased', 'Water Used', 'Water Recycled', 'Waste Generation', 'Fuel used in mess', 'Steam Production', 'AC service data'],
          2: ['Electricity Purchased'],
          3: ['Transport: Harbor to plant', 'Export of Material', 'Domestic Sales Transport', 'Employee transport', 'Business travel']
        };
        
        allowedActivities.forEach(activity => {
          for (let scope = 1; scope <= 3; scope++) {
            const activitiesInScope = scopeActivities[scope] || [];
            if (activitiesInScope.includes(activity)) {
              effectiveScopes.add(scope);
              break;
            }
          }
        });
      }
      
      return Array.from(effectiveScopes).sort();
    }
    
    return [];
  };

  // RBAC: Get user's allowed scopes
  const getAllowedScopes = () => {
    return getEffectiveAllowedScopes();
  };
  
  // ADD this function to get user's allowed activities for a specific scope:
  const getAllowedActivitiesForScope = (scope) => {
    if (!isAuthenticated) return [];
    
    // Admin and analysts have full access
    if (['admin', 'analyst'].includes(user?.role)) {
      const scopeActivities = {
        1: ['Fuel from Generator', 'Wood Burnt for Boilers', 'Fuel Used by Company vehicles', 'Refrigerant Purchased', 'Water Used', 'Water Recycled', 'Waste Generation', 'Fuel used in mess', 'Steam Production', 'AC service data'],
        2: ['Electricity Purchased'],
        3: ['Transport: Harbor to plant', 'Export of Material', 'Domestic Sales Transport', 'Employee transport', 'Business travel']
      };
      return scopeActivities[scope] || [];
    }
    
    // Viewers can see all activities
    if (user?.role === 'viewer') {
      const scopeActivities = {
        1: ['Fuel from Generator', 'Wood Burnt for Boilers', 'Fuel Used by Company vehicles', 'Refrigerant Purchased', 'Water Used', 'Water Recycled', 'Waste Generation', 'Fuel used in mess', 'Steam Production', 'AC service data'],
        2: ['Electricity Purchased'],
        3: ['Transport: Harbor to plant', 'Export of Material', 'Domestic Sales Transport', 'Employee transport', 'Business travel']
      };
      return scopeActivities[scope] || [];
    }
    
    // Contributors with restrictions
    if (user?.role === 'contributor') {
      if (!user.restrictions) {
        const scopeActivities = {
          1: ['Fuel from Generator', 'Wood Burnt for Boilers', 'Fuel Used by Company vehicles', 'Refrigerant Purchased', 'Water Used', 'Water Recycled', 'Waste Generation', 'Fuel used in mess', 'Steam Production', 'AC service data'],
          2: ['Electricity Purchased'],
          3: ['Transport: Harbor to plant', 'Export of Material', 'Domestic Sales Transport', 'Employee transport', 'Business travel']
        };
        return scopeActivities[scope] || []; // No restrictions = full access
      }
      
      const { allowedScopes, allowedActivities } = user.restrictions;
      
      // If scope is explicitly allowed, return all activities in that scope
      if (allowedScopes && allowedScopes.includes(scope)) {
        const scopeActivities = {
          1: ['Fuel from Generator', 'Wood Burnt for Boilers', 'Fuel Used by Company vehicles', 'Refrigerant Purchased', 'Water Used', 'Water Recycled', 'Waste Generation', 'Fuel used in mess', 'Steam Production', 'AC service data'],
          2: ['Electricity Purchased'],
          3: ['Transport: Harbor to plant', 'Export of Material', 'Domestic Sales Transport', 'Employee transport', 'Business travel']
        };
        return scopeActivities[scope] || [];
      }
      
      // Otherwise, return only allowed activities for this scope
      if (allowedActivities && allowedActivities.length > 0) {
        const scopeActivities = {
          1: ['Fuel from Generator', 'Wood Burnt for Boilers', 'Fuel Used by Company vehicles', 'Refrigerant Purchased', 'Water Used', 'Water Recycled', 'Waste Generation', 'Fuel used in mess', 'Steam Production', 'AC service data'],
          2: ['Electricity Purchased'],
          3: ['Transport: Harbor to plant', 'Export of Material', 'Domestic Sales Transport', 'Employee transport', 'Business travel']
        };
        
        const activitiesInScope = scopeActivities[scope] || [];
        return allowedActivities.filter(activity => activitiesInScope.includes(activity));
      }
      
      return [];
    }
    
    return [];
  };

  // RBAC: Get user's allowed activities
  const getAllowedActivities = () => {
    if (!isAuthenticated) return [];
    
    // Admin and analysts have full access
    if (['admin', 'analyst'].includes(user?.role)) return [];
    
    // Contributors with restrictions
    if (user?.role === 'contributor') {
      if (!user.restrictions || !user.restrictions.allowedActivities) {
        return []; // No restrictions = full access
      }
      return user.restrictions.allowedActivities;
    }
    
    return [];
  };

  // Role-based access control helpers
  const isAdmin = () => hasRole('admin');
  const isAnalyst = () => hasRole(['admin', 'analyst']);
  const isContributor = () => hasRole(['admin', 'analyst', 'contributor']);
  const isViewer = () => hasRole(['admin', 'analyst', 'contributor', 'viewer']);

  // Specific permission helpers
  const canManageUsers = () => isAdmin();
  const canCreateUsers = () => isAdmin();
  const canViewAllUsers = () => hasRole(['admin', 'analyst']);
  const canCreateEmissions = () => hasRole(['admin', 'analyst', 'contributor']);
  const canViewAllEmissions = () => hasRole(['admin', 'analyst']);
  const canVerifyEmissions = () => hasRole(['admin', 'analyst']);
  const canDeleteEmissions = () => hasRole(['admin', 'analyst']);
  const canViewAnalytics = () => hasRole(['admin', 'analyst', 'contributor', 'viewer']);
  const canExportData = () => hasRole(['admin', 'analyst']);
  const canManageSystem = () => isAdmin();
  const canViewUserActivities = () => isAdmin();

  // Get role display information
  const getRoleInfo = () => {
    if (!user?.role) return null;
    
    const roleMap = {
      admin: {
        label: 'Administrator',
        description: 'Full system access and user management',
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        permissions: ['All system functions', 'User management', 'System settings']
      },
      analyst: {
        label: 'Analyst',
        description: 'Data analysis and reporting capabilities',
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
        permissions: ['Data analysis', 'Emissions verification', 'Report generation']
      },
      contributor: {
        label: 'Contributor',
        description: 'Data entry and own data management',
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        permissions: ['Data entry', 'View own data', 'Basic analytics']
      },
      viewer: {
        label: 'Viewer',
        description: 'Read-only access to data',
        color: 'text-gray-600',
        bgColor: 'bg-gray-100',
        permissions: ['View data', 'Basic analytics', 'Read-only access']
      }
    };

    const roleInfo = roleMap[user.role] || roleMap.viewer;
    
    // Add restriction info for contributors
    if (user.role === 'contributor' && user.restrictions) {
      const restrictions = [];
      
      if (user.restrictions.allowedScopes && user.restrictions.allowedScopes.length < 3) {
        restrictions.push(`Limited to Scopes: ${user.restrictions.allowedScopes.join(', ')}`);
      }
      
      if (user.restrictions.allowedActivities && user.restrictions.allowedActivities.length > 0) {
        restrictions.push(`${user.restrictions.allowedActivities.length} specific activities`);
      }
      
      if (restrictions.length > 0) {
        roleInfo.restrictions = restrictions;
        roleInfo.description += ' (with restrictions)';
      }
    }
    
    return roleInfo;
  };

  const value = {
    // State
    user,
    isAuthenticated,
    loading,
    permissions,
    
    // Actions
    login,
    logout,
    updateProfile,
    changePassword,
    
    // Permission checks
    hasPermission,
    hasRole,
    canAccess,
    
    // RBAC functions
    canAccessScope,
    canAccessActivity,
    canAccessPage,
    getAllowedScopes,
    getAllowedActivities,
    getEffectiveAllowedScopes,
    getAllowedActivitiesForScope,
    
    // Role helpers
    isAdmin,
    isAnalyst,
    isContributor,
    isViewer,
    
    // Specific permissions
    canManageUsers,
    canCreateUsers,
    canViewAllUsers,
    canCreateEmissions,
    canViewAllEmissions,
    canVerifyEmissions,
    canDeleteEmissions,
    canViewAnalytics,
    canExportData,
    canManageSystem,
    canViewUserActivities,
    
    // Role info
    getRoleInfo
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};