// context/AuthContext.jsx - Fixed with better API response handling
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
        console.log('Auth initialized for user:', userData.email, 'Role:', userData.role);
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
      
      // Set user state
      setUser(userData);
      setPermissions(userData.permissions || {});
      setIsAuthenticated(true);
      
      console.log('Login successful for:', userData.email, 'Role:', userData.role);
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
  const canViewAnalytics = () => isViewer(); // All roles can view analytics
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

    return roleMap[user.role] || roleMap.viewer;
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