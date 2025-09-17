// services/api.js - Enhanced API service with admin and multi-user support
import axios from 'axios';

// Base API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

// Create axios instance with default configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log('API Request:', config.method?.toUpperCase(), config.url); // Debug log
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.status, response.data); // Debug log
    
    // For successful responses, return the appropriate data
    if (response.data?.success !== false) {
      // If the response has a data property, return it, otherwise return the whole response data
      return response.data?.data ? response.data.data : response.data;
    } else {
      // If success is explicitly false, treat as error
      return Promise.reject(new Error(response.data.message || 'Request failed'));
    }
  },
  (error) => {
    console.error('API Error:', error.response?.status, error.response?.data || error.message); // Debug log
    
    // Handle network errors gracefully
    if (!error.response) {
      console.error('Network error - backend may not be running');
      return Promise.reject({
        message: 'Unable to connect to server. Please check if the backend is running.',
        status: 'NETWORK_ERROR'
      });
    }

    if (error.response?.status === 401) {
      // Only redirect if we're not already on the login page
      if (!window.location.pathname.includes('/login')) {
        console.log('401 error - removing token and redirecting to login');
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    
    // Handle 403 errors (access denied)
    if (error.response?.status === 403) {
      return Promise.reject({
        message: error.response.data?.message || 'Access denied. Insufficient permissions.',
        status: 'ACCESS_DENIED'
      });
    }
    
    return Promise.reject(error);
  }
);

// Authentication API
export const authAPI = {
  login: (credentials) => apiClient.post('/auth/login', credentials),
  register: (userData) => apiClient.post('/auth/register', userData),
  logout: () => apiClient.post('/auth/logout'),
  verifyToken: () => apiClient.get('/auth/verify'),
  updateProfile: (profileData) => apiClient.patch('/auth/profile', profileData),
  changePassword: (passwordData) => apiClient.patch('/auth/change-password', passwordData)
};

// Admin API (Admin only endpoints)
export const adminAPI = {
  // Dashboard & Overview
  getDashboard: () => apiClient.get('/admin/dashboard'),
  getSystemStats: () => apiClient.get('/admin/system-stats'),
  
  // User Activity Monitoring
  getAllActivities: (params) => apiClient.get('/admin/activities', { params }),
  getUserSummary: (params) => apiClient.get('/admin/user-summary', { params }),
  getAuditLogs: (params) => apiClient.get('/admin/audit-logs', { params }),
  getLoginHistory: (params) => apiClient.get('/admin/login-history', { params }),
  getSecurityAlerts: () => apiClient.get('/admin/security-alerts'),
  
  // Export Functions
  exportLogs: (format, filters) => apiClient.get('/admin/export-logs', { 
    params: { format, ...filters },
    responseType: 'blob'
  }),
  
  // User Management (through users API with admin privileges)
  getAllUsers: (params) => apiClient.get('/users', { params }),
  createUser: (userData) => apiClient.post('/users', userData),
  updateUserRole: (userId, role) => apiClient.patch(`/users/${userId}/role`, { role }),
  updateUserStatus: (userId, status) => apiClient.patch(`/users/${userId}/status`, { status }),
  deleteUser: (userId) => apiClient.delete(`/users/${userId}`),
  getUserById: (userId) => apiClient.get(`/users/${userId}`),
  getUserStats: () => apiClient.get('/users/stats'),
  bulkUpdateUsers: (userIds, updates) => apiClient.patch('/users/bulk', { userIds, updates })
};

// Dashboard API
export const dashboardAPI = {
  getSummary: (userId) => apiClient.get('/dashboard/summary', { params: userId ? { userId } : {} }),
  getNotifications: () => apiClient.get('/dashboard/notifications'),
  getRecentActivity: () => apiClient.get('/dashboard/recent-activity')
};

// Emissions API - Enhanced with user filtering
export const emissionsAPI = {
  getAll: (params) => apiClient.get('/emissions', { params }),
  getById: (id) => apiClient.get(`/emissions/${id}`),
  create: (emissionData) => apiClient.post('/emissions', emissionData),
  update: (id, emissionData) => apiClient.patch(`/emissions/${id}`, emissionData),
  delete: (id) => apiClient.delete(`/emissions/${id}`),
  verify: (id, verificationData) => apiClient.patch(`/emissions/${id}/verify`, verificationData),
  getByScope: (scope, userId) => apiClient.get(`/emissions/scope/${scope}`, { 
    params: userId ? { userId } : {} 
  }),
  getCategories: () => apiClient.get('/emissions/categories'),
  getStats: (userId) => apiClient.get('/emissions/stats', { 
    params: userId ? { userId } : {} 
  }),
  bulkCreate: (emissionsArray) => apiClient.post('/emissions/bulk', { emissions: emissionsArray }),
  
  // User-specific endpoints
  getMyEmissions: (params) => apiClient.get('/emissions', { params }),
  getMyStats: () => apiClient.get('/emissions/stats')
};

// Analytics API - Enhanced with user filtering
export const analyticsAPI = {
  getTrends: (params) => apiClient.get('/analytics/trends', { params }),
  getScopeComparison: (params) => apiClient.get('/analytics/scope-comparison', { params }),
  getEmissionsByCategory: (params) => apiClient.get('/analytics/by-category', { params }),
  getMonthlyData: (params) => apiClient.get('/analytics/monthly', { params }),
  getYearlyData: (params) => apiClient.get('/analytics/yearly', { params }),
  getTopEmitters: (params) => apiClient.get('/analytics/top-emitters', { params }),
  
  // User-specific analytics
  getUserAnalytics: (userId, params) => apiClient.get('/analytics/user', { 
    params: { userId, ...params } 
  })
};

// Monitor API - Enhanced with user activity tracking
export const monitorAPI = {
  getActivities: (params) => apiClient.get('/monitor/activities', { params }),
  createTask: (taskData) => apiClient.post('/monitor/tasks', taskData),
  updateTask: (id, taskData) => apiClient.patch(`/monitor/tasks/${id}`, taskData),
  deleteTask: (id) => apiClient.delete(`/monitor/tasks/${id}`),
  getTasks: (params) => apiClient.get('/monitor/tasks', { params }),
  assignActivity: (assignmentData) => apiClient.post('/monitor/assign', assignmentData),
  
  // Task management
  getMyTasks: (params) => apiClient.get('/monitor/tasks', { params: { ...params, assignedToMe: true } }),
  getTaskById: (id) => apiClient.get(`/monitor/tasks/${id}`),
  updateTaskStatus: (id, status) => apiClient.patch(`/monitor/tasks/${id}`, { status })
};

// Users API - Enhanced for role-based access
export const usersAPI = {
  getAll: (params) => apiClient.get('/users', { params }),
  getById: (id) => apiClient.get(`/users/${id}`),
  create: (userData) => apiClient.post('/users', userData),
  update: (id, userData) => apiClient.patch(`/users/${id}`, userData),
  delete: (id) => apiClient.delete(`/users/${id}`),
  updateRole: (id, role) => apiClient.patch(`/users/${id}/role`, { role }),
  updateStatus: (id, status) => apiClient.patch(`/users/${id}/status`, { status }),
  getCurrentUser: () => apiClient.get('/users/me'),
  getStats: () => apiClient.get('/users/stats'),
  
  // Profile management
  getProfile: () => apiClient.get('/auth/verify'),
  updateProfile: (profileData) => apiClient.patch('/auth/profile', profileData),
  changePassword: (passwordData) => apiClient.patch('/auth/change-password', passwordData)
};

// Vehicles API
export const vehiclesAPI = {
  getAll: (params) => apiClient.get('/vehicles', { params }),
  getById: (id) => apiClient.get(`/vehicles/${id}`),
  create: (vehicleData) => apiClient.post('/vehicles', vehicleData),
  update: (id, vehicleData) => apiClient.patch(`/vehicles/${id}`, vehicleData),
  delete: (id) => apiClient.delete(`/vehicles/${id}`),
  getByType: (type) => apiClient.get(`/vehicles/type/${type}`),
  
  // User-specific vehicles
  getMyVehicles: (params) => apiClient.get('/vehicles', { params: { ...params, owner: 'me' } })
};

// Generators API
export const generatorsAPI = {
  getAll: (params) => apiClient.get('/generators', { params }),
  getById: (id) => apiClient.get(`/generators/${id}`),
  create: (generatorData) => apiClient.post('/generators', generatorData),
  update: (id, generatorData) => apiClient.patch(`/generators/${id}`, generatorData),
  delete: (id) => apiClient.delete(`/generators/${id}`)
};

// Organization API
export const organizationAPI = {
  getBoundary: () => apiClient.get('/organization/boundary'),
  updateBoundary: (boundaryData) => apiClient.patch('/organization/boundary', boundaryData),
  getSettings: () => apiClient.get('/organization/settings'),
  updateSettings: (settingsData) => apiClient.patch('/organization/settings', settingsData)
};

// Notifications API - Enhanced with user targeting
export const notificationAPI = {
  getAll: (params) => apiClient.get('/notifications', { params }),
  getById: (id) => apiClient.get(`/notifications/${id}`),
  create: (notificationData) => apiClient.post('/notifications', notificationData),
  markAsRead: (id) => apiClient.patch(`/notifications/${id}/read`),
  markAllAsRead: () => apiClient.patch('/notifications/mark-all-read'),
  delete: (id) => apiClient.delete(`/notifications/${id}`),
  
  // User-specific notifications
  getMyNotifications: (params) => apiClient.get('/notifications', { params }),
  getUnreadCount: () => apiClient.get('/notifications/unread-count')
};

// Export API - Enhanced with role-based filtering
export const exportAPI = {
  exportActivities: (format, filters) => apiClient.get('/export/activities', { 
    params: { format, ...filters },
    responseType: 'blob'
  }),
  exportEmissions: (format, filters) => apiClient.get('/export/emissions', { 
    params: { format, ...filters },
    responseType: 'blob'
  }),
  exportAnalytics: (format, filters) => apiClient.get('/export/analytics', { 
    params: { format, ...filters },
    responseType: 'blob'
  }),
  exportUsers: (format, filters) => apiClient.get('/export/users', { 
    params: { format, ...filters },
    responseType: 'blob'
  })
};

// Activity Logging API (for frontend activity tracking)
export const activityAPI = {
  logActivity: (activityData) => apiClient.post('/activity/log', activityData),
  getUserActivities: (userId, params) => apiClient.get(`/activity/user/${userId}`, { params }),
  getRecentActivities: (params) => apiClient.get('/activity/recent', { params })
};

// Utility functions for role checking
export const hasRole = (userRole, requiredRoles) => {
  if (!userRole || !requiredRoles) return false;
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  return roles.includes(userRole);
};

export const isAdmin = (userRole) => hasRole(userRole, 'admin');
export const canManageUsers = (userRole) => hasRole(userRole, ['admin', 'analyst']);
export const canViewAllData = (userRole) => hasRole(userRole, ['admin', 'analyst']);
export const canCreateEmissions = (userRole) => hasRole(userRole, ['admin', 'analyst', 'contributor']);
export const canViewData = (userRole) => hasRole(userRole, ['admin', 'analyst', 'contributor', 'viewer']);

// File upload utility
export const uploadFile = async (file, uploadPath = '/upload') => {
  const formData = new FormData();
  formData.append('file', file);
  
  return apiClient.post(uploadPath, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
};

// Bulk operations utility
export const bulkOperation = async (endpoint, operations) => {
  return apiClient.post(`/bulk/${endpoint}`, { operations });
};

// Real-time updates utility (if WebSocket is implemented)
export const subscribeToUpdates = (userId, callback) => {
  // This would connect to WebSocket for real-time updates
  // Implementation depends on whether you add Socket.io
  console.log('WebSocket subscription for user:', userId);
};

export default {
  authAPI,
  adminAPI,
  dashboardAPI,
  emissionsAPI,
  analyticsAPI,
  monitorAPI,
  usersAPI,
  vehiclesAPI,
  generatorsAPI,
  organizationAPI,
  notificationAPI,
  exportAPI,
  activityAPI,
  hasRole,
  isAdmin,
  canManageUsers,
  canViewAllData,
  canCreateEmissions,
  canViewData
};