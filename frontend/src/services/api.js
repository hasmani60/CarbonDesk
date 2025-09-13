import axios from 'axios';

// Base API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

// Create axios instance with default configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
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
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
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

// Dashboard API
export const dashboardAPI = {
  getSummary: () => apiClient.get('/dashboard/summary'),
  getNotifications: () => apiClient.get('/dashboard/notifications'),
  getRecentActivity: () => apiClient.get('/dashboard/recent-activity')
};

// Emissions API
export const emissionsAPI = {
  getAll: (params) => apiClient.get('/emissions', { params }),
  getById: (id) => apiClient.get(`/emissions/${id}`),
  create: (emissionData) => apiClient.post('/emissions', emissionData),
  update: (id, emissionData) => apiClient.patch(`/emissions/${id}`, emissionData),
  delete: (id) => apiClient.delete(`/emissions/${id}`),
  getByScope: (scope) => apiClient.get(`/emissions/scope/${scope}`),
  getCategories: () => apiClient.get('/emissions/categories'),
  bulkCreate: (emissionsArray) => apiClient.post('/emissions/bulk', { emissions: emissionsArray })
};

// Analytics API
export const analyticsAPI = {
  getTrends: (params) => apiClient.get('/analytics/trends', { params }),
  getScopeComparison: (params) => apiClient.get('/analytics/scope-comparison', { params }),
  getEmissionsByCategory: (params) => apiClient.get('/analytics/by-category', { params }),
  getMonthlyData: (params) => apiClient.get('/analytics/monthly', { params }),
  getYearlyData: (params) => apiClient.get('/analytics/yearly', { params }),
  getTopEmitters: (params) => apiClient.get('/analytics/top-emitters', { params })
};

// Monitor API
export const monitorAPI = {
  getActivities: (params) => apiClient.get('/monitor/activities', { params }),
  createTask: (taskData) => apiClient.post('/monitor/tasks', taskData),
  updateTask: (id, taskData) => apiClient.patch(`/monitor/tasks/${id}`, taskData),
  deleteTask: (id) => apiClient.delete(`/monitor/tasks/${id}`),
  getTasks: (params) => apiClient.get('/monitor/tasks', { params }),
  assignActivity: (assignmentData) => apiClient.post('/monitor/assign', assignmentData)
};

// Users API
export const usersAPI = {
  getAll: (params) => apiClient.get('/users', { params }),
  getById: (id) => apiClient.get(`/users/${id}`),
  create: (userData) => apiClient.post('/users', userData),
  update: (id, userData) => apiClient.patch(`/users/${id}`, userData),
  delete: (id) => apiClient.delete(`/users/${id}`),
  updateRole: (id, role) => apiClient.patch(`/users/${id}/role`, { role }),
  updateStatus: (id, status) => apiClient.patch(`/users/${id}/status`, { status }),
  getCurrentUser: () => apiClient.get('/users/me')
};

// Vehicles API
export const vehiclesAPI = {
  getAll: (params) => apiClient.get('/vehicles', { params }),
  getById: (id) => apiClient.get(`/vehicles/${id}`),
  create: (vehicleData) => apiClient.post('/vehicles', vehicleData),
  update: (id, vehicleData) => apiClient.patch(`/vehicles/${id}`, vehicleData),
  delete: (id) => apiClient.delete(`/vehicles/${id}`),
  getByType: (type) => apiClient.get(`/vehicles/type/${type}`)
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

// Notifications API
export const notificationAPI = {
  getAll: (params) => apiClient.get('/notifications', { params }),
  getById: (id) => apiClient.get(`/notifications/${id}`),
  create: (notificationData) => apiClient.post('/notifications', notificationData),
  markAsRead: (id) => apiClient.patch(`/notifications/${id}/read`),
  markAllAsRead: () => apiClient.patch('/notifications/mark-all-read'),
  delete: (id) => apiClient.delete(`/notifications/${id}`)
};

// Export API
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
  })
};

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