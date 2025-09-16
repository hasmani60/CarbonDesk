import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('token');
      console.log('AuthContext - Initializing with token:', token ? 'Yes' : 'No'); // Debug log
      
      if (token) {
        try {
          // Try to verify token and get user data
          console.log('AuthContext - Verifying token...'); // Debug log
          const userData = await authAPI.verifyToken();
          console.log('AuthContext - Token verified, user data:', userData); // Debug log
          setUser(userData);
        } catch (error) {
          // If token verification fails, remove invalid token
          console.error('AuthContext - Token verification failed:', error);
          localStorage.removeItem('token');
          setUser(null);
          
          // Don't show error toast on initial load, only if it's a network error
          if (error.status === 'NETWORK_ERROR') {
            toast.error('Backend server is not running. Please start the backend server.');
          }
        }
      } else {
        console.log('AuthContext - No token found'); // Debug log
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (credentials) => {
    try {
      console.log('AuthContext - Attempting login...'); // Debug log
      const response = await authAPI.login(credentials);
      console.log('AuthContext - Login response:', response); // Debug log
      
      const { token, user: userData } = response.data || response;
      
      if (!token || !userData) {
        throw new Error('Invalid login response format');
      }
      
      localStorage.setItem('token', token);
      setUser(userData);
      
      console.log('AuthContext - Login successful, user set:', userData); // Debug log
      toast.success('Login successful!');
      return response;
    } catch (error) {
      console.error('AuthContext - Login error:', error); // Debug log
      const message = error.response?.data?.message || error.message || 'Login failed';
      toast.error(message);
      throw error;
    }
  };

  const register = async (userData) => {
    try {
      const response = await authAPI.register(userData);
      const { token, user: newUser } = response.data || response;
      
      localStorage.setItem('token', token);
      setUser(newUser);
      
      toast.success('Registration successful!');
      return response;
    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed';
      toast.error(message);
      throw error;
    }
  };

  const logout = async () => {
    try {
      console.log('AuthContext - Logging out...'); // Debug log
      await authAPI.logout();
    } catch (error) {
      console.error('AuthContext - Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      setUser(null);
      toast.success('Logged out successfully');
      console.log('AuthContext - Logout complete'); // Debug log
    }
  };

  const updateProfile = async (profileData) => {
    try {
      const updatedUser = await authAPI.updateProfile(profileData);
      setUser(updatedUser.data || updatedUser);
      toast.success('Profile updated successfully!');
      return updatedUser;
    } catch (error) {
      const message = error.response?.data?.message || 'Profile update failed';
      toast.error(message);
      throw error;
    }
  };

  const value = {
    user,
    login,
    register,
    logout,
    updateProfile,
    loading,
    isAuthenticated: !!user
  };

  console.log('AuthContext - Current state:', { user: !!user, loading, isAuthenticated: !!user }); // Debug log

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};