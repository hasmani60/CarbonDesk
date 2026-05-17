// services/api.js - Updated API service with 429 Retry Logic and Advanced Analytics
import axios from 'axios';

// Base API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

// Create axios instance with default configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // Increased from 15000 to 30000 (30 seconds)
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
    console.log('API Request:', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor with 429 retry logic and error handling
apiClient.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.status, response.data);
    
    if (response.data?.success !== false) {
      return response.data?.data ? response.data.data : response.data;
    } else {
      return Promise.reject(new Error(response.data.message || 'Request failed'));
    }
  },
  async (error) => {
    const config = error.config;
    
    // ============================================
    // HANDLE 429 RATE LIMIT ERRORS WITH RETRY
    // ============================================
    if (error.response?.status === 429) {
      // Initialize retry count if not present
      if (!config._retryCount) {
        config._retryCount = 0;
      }
      
      // Retry up to 3 times with exponential backoff
      if (config._retryCount < 3) {
        config._retryCount += 1;
        
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, config._retryCount) * 1000;
        
        console.warn(
          `⚠️ Rate limited (429). Retrying in ${delay}ms... (Attempt ${config._retryCount}/3)`
        );
        
        // Show user-friendly notification if available
        if (window.showNotification) {
          window.showNotification(
            `Too many requests. Retrying in ${delay / 1000} seconds...`,
            'warning'
          );
        }
        
        // Wait for the delay period
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Retry the request
        return apiClient(config);
      } else {
        // Max retries reached
        console.error('❌ Rate limit retry failed after 3 attempts');
        
        if (window.showNotification) {
          window.showNotification(
            'Too many requests. Please wait a moment and try again.',
            'error'
          );
        }
        
        return Promise.reject({
          message: 'Too many requests. Please wait a moment before trying again.',
          status: 'RATE_LIMITED',
          retryAfter: error.response?.headers['retry-after'] || 60
        });
      }
    }
    
    // ============================================
    // HANDLE OTHER ERRORS
    // ============================================
    
    console.error('API Error:', error.response?.status, error.response?.data || error.message);
    
    // Network errors
    if (!error.response) {
      console.error('Network error - backend may not be running');
      return Promise.reject({
        message: 'Unable to connect to server. Please check if the backend is running.',
        status: 'NETWORK_ERROR'
      });
    }

    // 401 Unauthorized - redirect to login
    if (error.response?.status === 401) {
      if (!window.location.pathname.includes('/login')) {
        console.log('401 error - removing token and redirecting to login');
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    
    // 403 Forbidden - access denied (preserve code e.g. EMAIL_NOT_VERIFIED)
    if (error.response?.status === 403) {
      return Promise.reject({
        message: error.response.data?.message || 'Access denied. Insufficient permissions.',
        status: 'ACCESS_DENIED',
        code: error.response.data?.code,
        quota: error.response.data?.quota,
        response: error.response
      });
    }
    
    // 408 Request Timeout
    if (error.response?.status === 408 || error.code === 'ECONNABORTED') {
      return Promise.reject({
        message: 'Request timeout. Please try again.',
        status: 'TIMEOUT'
      });
    }
    
    // 500 Internal Server Error
    if (error.response?.status === 500) {
      return Promise.reject({
        message: error.response.data?.message || 'Internal server error. Please try again later.',
        status: 'SERVER_ERROR'
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
  changePassword: (passwordData) => apiClient.patch('/auth/change-password', passwordData),
  /** @param {string} token - raw token from verification link */
  verifyEmail: (token) =>
    apiClient.get('/auth/verify-email', { params: { token } }),
  requestVerificationEmail: (email) =>
    apiClient.post('/auth/request-verification-email', { email }),
  forgotPassword: (email) => apiClient.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) =>
    apiClient.post('/auth/reset-password', { token, password })
};

// Admin API
export const adminAPI = {
  getDashboard: () => apiClient.get('/admin/dashboard'),
  getSystemStats: () => apiClient.get('/admin/system-stats'),
  getAllActivities: (params) => apiClient.get('/admin/activities', { params }),
  getUserSummary: (params) => apiClient.get('/admin/user-summary', { params }),
  exportActivities: (format, filters) => apiClient.get('/admin/export-activities', { 
    params: { format, ...filters },
    responseType: 'blob'
  }),
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

// Emissions API
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
  getMyEmissions: (params) => apiClient.get('/emissions', { params }),
  getMyStats: () => apiClient.get('/emissions/stats')
};

// Analytics API - ENHANCED WITH NEW ENDPOINTS
export const analyticsAPI = {
  // Existing endpoints
  getTrends: (params) => apiClient.get('/analytics/trends', { params }),
  getScopeComparison: (params) => apiClient.get('/analytics/scope-comparison', { params }),
  getEmissionsByCategory: (params) => apiClient.get('/analytics/by-category', { params }),
  getMonthlyData: (params) => apiClient.get('/analytics/monthly', { params }),
  getYearlyData: (params) => apiClient.get('/analytics/yearly', { params }),
  getTopCategories: (params) => apiClient.get('/analytics/top-categories', { params }),
  getTopUsers: (params) => apiClient.get('/analytics/top-users', { params }),
  getReductionOpportunities: (params) => apiClient.get('/analytics/reduction-opportunities', { params }),
  
  // NEW: Advanced Analytics Endpoints
  
  /**
   * Get user performance comparison
   * @param {Object} params - { startDate, endDate, userId?, limit? }
   * @returns {Promise<Object>} Performance metrics by user
   */
  getUserPerformance: (params) => apiClient.get('/analytics/user-performance', { params }),
  
  /**
   * Get activity pattern analysis
   * @param {Object} params - { startDate, endDate, userId?, period? }
   * @returns {Promise<Object>} Activity patterns over time
   */
  getActivityPatterns: (params) => apiClient.get('/analytics/activity-patterns', { params }),
  
  /**
   * Get emissions trajectory analysis
   * @param {Object} params - { startDate, endDate, scope?, category? }
   * @returns {Promise<Object>} Projected emissions trends
   */
  getEmissionsTrajectory: (params) => apiClient.get('/analytics/emissions-trajectory', { params }),
  
  /**
   * Get emissions velocity (rate of change)
   * @param {Object} params - { startDate, endDate, scope? }
   * @returns {Promise<Object>} Rate of change analysis
   */
  getEmissionsVelocity: (params) => apiClient.get('/analytics/emissions-velocity', { params }),
  
  /**
   * Get scope breakdown analysis
   * @param {Object} params - { startDate, endDate, userId? }
   * @returns {Promise<Object>} Detailed scope breakdown
   */
  getScopeBreakdown: (params) => apiClient.get('/analytics/scope-breakdown', { params }),
  
  /**
   * Get category trends over time
   * @param {Object} params - { startDate, endDate, scope?, limit? }
   * @returns {Promise<Object>} Category trends
   */
  getCategoryTrends: (params) => apiClient.get('/analytics/category-trends', { params }),
  
  /**
   * Get data quality metrics
   * @param {Object} params - { startDate, endDate, userId? }
   * @returns {Promise<Object>} Data completeness and quality metrics
   */
  getDataQuality: (params) => apiClient.get('/analytics/data-quality', { params }),
  
  /**
   * Get verification statistics
   * @param {Object} params - { startDate, endDate, userId? }
   * @returns {Promise<Object>} Verification rates and timing
   */
  getVerificationStats: (params) => apiClient.get('/analytics/verification-stats', { params }),
  
  /**
   * Get comparative benchmarking
   * @param {Object} params - { startDate, endDate, scope?, category? }
   * @returns {Promise<Object>} Benchmark comparisons
   */
  getBenchmarking: (params) => apiClient.get('/analytics/benchmarking', { params }),
  
  /**
   * Get anomaly detection
   * @param {Object} params - { startDate, endDate, sensitivity? }
   * @returns {Promise<Object>} Detected anomalies in emissions data
   */
  getAnomalies: (params) => apiClient.get('/analytics/anomalies', { params }),
  
  /**
   * Get seasonal analysis
   * @param {Object} params - { startYear, endYear, scope? }
   * @returns {Promise<Object>} Seasonal patterns
   */
  getSeasonalAnalysis: (params) => apiClient.get('/analytics/seasonal-analysis', { params }),

  /** Organisation-wide rollup (scopes + totals) — matches GET /api/analytics/overview */
  getOverview: (params) => apiClient.get('/analytics/overview', { params }),
  
  getScopeMigration: (params) => apiClient.get('/analytics/scope-migration', { params }),
  getPareto: (params) => apiClient.get('/analytics/pareto', { params }),
  getScope3TransportBreakdown: (params) =>
    apiClient.get('/analytics/scope3-transport-breakdown', { params }),
  getParetoDrilldown: (category) => apiClient.get(`/analytics/pareto/drilldown/${encodeURIComponent(category)}`),
  getVelocity: (params) => apiClient.get('/analytics/velocity', { params }),
  
  /**
   * Get MACC (Marginal Abatement Cost Curve) analysis
   * @param {Object} params - { startDate, endDate }
   * @returns {Promise<Object>} Cost-effectiveness of reduction opportunities
   */
  getMACCAnalysis: (params) => apiClient.get('/analytics/macc', { params }),
  saveMACCOpportunity: (opportunityData) => apiClient.post('/analytics/macc/opportunity', opportunityData),
  
  /**
   * Get predictive insights
   * @param {Object} params - { forecastMonths?, scope?, category? }
   * @returns {Promise<Object>} Predictive analysis
   */
  getPredictiveInsights: (params) => apiClient.get('/analytics/predictive-insights', { params }),
  
  /**
   * Get compliance tracking
   * @param {Object} params - { year?, standard? }
   * @returns {Promise<Object>} Compliance metrics
   */
  getComplianceTracking: (params) => apiClient.get('/analytics/compliance-tracking', { params }),
  
  /**
   * Export performance analysis
   * @param {string} format - 'csv' | 'json' | 'pdf'
   * @param {Object} filters - Filter parameters
   * @returns {Promise<Blob>} File blob
   */
  exportPerformanceAnalysis: (format = 'csv', filters = {}) => {
    return apiClient.get('/analytics/user-performance/export', {
      params: { format, ...filters },
      responseType: 'blob'
    });
  },
  
  /**
   * Export trajectory analysis
   * @param {string} format - 'csv' | 'json' | 'pdf'
   * @param {Object} filters - Filter parameters
   * @returns {Promise<Blob>} File blob
   */
  exportTrajectoryAnalysis: (format = 'csv', filters = {}) => {
    return apiClient.get('/analytics/emissions-trajectory/export', {
      params: { format, ...filters },
      responseType: 'blob'
    });
  },

  /**
   * Export velocity analysis
   * @param {string} format - 'csv' | 'json' | 'pdf'
   * @param {Object} filters - Filter parameters
   * @returns {Promise<Blob>} File blob
   */
  exportVelocityAnalysis: (format = 'csv', filters = {}) => {
    return apiClient.get('/analytics/emissions-velocity/export', {
      params: { format, ...filters },
      responseType: 'blob'
    });
  },

  /**
   * Export MACC analysis
   * @param {string} format - 'csv' | 'json' | 'pdf'
   * @param {Object} filters - Filter parameters
   * @returns {Promise<Blob>} File blob
   */
  exportMACCAnalysis: (format = 'csv', filters = {}) => {
    return apiClient.get('/analytics/macc/export', {
      params: { format, ...filters },
      responseType: 'blob'
    });
  }
};

// AI Reports API (async generation via n8n)
export const reportsAPI = {
  getQuota: () => apiClient.get('/reports/quota'),
  getFilterOptions: () => apiClient.get('/reports/filter-options'),
  generate: (filters) => apiClient.post('/reports/generate', filters),
  getById: (id) => apiClient.get(`/reports/${id}`),
  list: (params) => apiClient.get('/reports', { params }),
  cancel: (id) => apiClient.patch(`/reports/${id}/cancel`),
  saveChartImages: (id, chartImages) =>
    apiClient.patch(`/reports/${id}/chart-images`, { chartImages })
};

// Monitor API
export const monitorAPI = {
  getActivities: (params) => apiClient.get('/activities', { params }),
  createTask: (taskData) => apiClient.post('/tasks', taskData),
  updateTask: (id, taskData) => apiClient.patch(`/tasks/${id}`, taskData),
  deleteTask: (id) => apiClient.delete(`/tasks/${id}`),
  getTasks: (params) => apiClient.get('/tasks', { params }),
  getTaskStats: (params) => apiClient.get('/tasks/stats', { params }),
  getAssignableUsers: (params) => apiClient.get('/tasks/assignable-users', { params }),
  assignActivity: (assignmentData) => apiClient.post('/tasks/assign', assignmentData),
  getMyTasks: (params) => apiClient.get('/tasks', { params: { ...params, assignedToMe: true } }),
  getTaskById: (id) => apiClient.get(`/tasks/${id}`),
  updateTaskStatus: (id, status) => apiClient.patch(`/tasks/${id}`, { status })
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
  getCurrentUser: () => apiClient.get('/users/me'),
  getStats: () => apiClient.get('/users/stats'),
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
  getMyVehicles: (params) => apiClient.get('/vehicles', { params: { ...params, owner: 'me' } })
};

// Employees API (Scope 3 Category 7 — commute)
export const employeesAPI = {
  list: (params) => apiClient.get('/employees', { params }),
  create: (data) => apiClient.post('/employees', data),
  update: (id, data) => apiClient.put(`/employees/${id}`, data),
  remove: (id) => apiClient.delete(`/employees/${id}`),
  getAttendance: (date) =>
    apiClient.get('/employees/attendance', { params: { date } }),
  bulkAttendance: (payload) => apiClient.post('/employees/attendance/bulk', payload),
  getEmissions: (month) =>
    apiClient.get('/employees/emissions', { params: { month } }),
  getCommuteTotal: (params) =>
    apiClient.get('/employees/commute-total', { params })
};

// Flights API — airport search & great-circle distance
export const flightsAPI = {
  searchAirports: (q, limit = 20) =>
    apiClient.get('/flights/airports', { params: { q, limit } }),
  getAirport: (iata) => apiClient.get(`/flights/airports/${iata}`),
  getDistance: ({ origin, destination, roundTrip }) =>
    apiClient.get('/flights/distance', {
      params: {
        origin,
        destination,
        roundTrip: roundTrip ? 'true' : undefined
      }
    })
};

// Generators API
export const generatorsAPI = {
  getAll: (params) => apiClient.get('/generators', { params }),
  getById: (id) => apiClient.get(`/generators/${id}`),
  create: (generatorData) => apiClient.post('/generators', generatorData),
  update: (id, generatorData) => apiClient.patch(`/generators/${id}`, generatorData),
  delete: (id) => apiClient.delete(`/generators/${id}`)
};

// Organisation API - MongoDB Compatible (British spelling, plural endpoint)
export const organisationAPI = {
  // Organisation Details (Admin only)
  getDetails: () => apiClient.get('/organisations/details'),
  updateDetails: (organisationData) => apiClient.patch('/organisations/details', organisationData)
};

// Organization API - Alias for American spelling compatibility
export const organizationAPI = organisationAPI;

// Notifications API
export const notificationAPI = {
  getAll: (params) => apiClient.get('/notifications', { params }),
  getById: (id) => apiClient.get(`/notifications/${id}`),
  create: (notificationData) => apiClient.post('/notifications', notificationData),
  markAsRead: (id) => apiClient.patch(`/notifications/${id}/read`),
  markAllAsRead: () => apiClient.patch('/notifications/read-all'),
  delete: (id) => apiClient.delete(`/notifications/${id}`),
  getMyNotifications: (params) => apiClient.get('/notifications', { params }),
  getUnreadCount: () => apiClient.get('/notifications/unread-count')
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
  }),
  exportUsers: (format, filters) => apiClient.get('/export/users', { 
    params: { format, ...filters },
    responseType: 'blob'
  })
};

// Activity Logging API
export const activityAPI = {
  logActivity: (activityData) => apiClient.post('/activities/log', activityData),
  getUserActivities: (userId, params) => apiClient.get(`/activities/user/${userId}`, { params }),
  getRecentActivities: (params) => apiClient.get('/activities/recent', { params })
};

// RBAC Utility functions
export const hasRole = (userRole, requiredRoles) => {
  if (!userRole || !requiredRoles) return false;
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  return roles.includes(userRole);
};

export const isAdmin = (userRole) => hasRole(userRole, 'admin');
export const isAnalyst = (userRole) => hasRole(userRole, ['admin', 'analyst']);
export const isContributor = (userRole) => hasRole(userRole, ['admin', 'analyst', 'contributor']);
export const isViewer = (userRole) => hasRole(userRole, ['admin', 'analyst', 'contributor', 'viewer']);

export const canManageUsers = (userRole) => isAdmin(userRole);
export const canCreateUsers = (userRole) => isAdmin(userRole);
export const canViewAllUsers = (userRole) => hasRole(userRole, ['admin', 'analyst']);
export const canViewAllData = (userRole) => hasRole(userRole, ['admin', 'analyst']);
export const canCreateEmissions = (userRole) => hasRole(userRole, ['admin', 'analyst', 'contributor']);
export const canVerifyEmissions = (userRole) => hasRole(userRole, ['admin', 'analyst']);
export const canDeleteEmissions = (userRole) => hasRole(userRole, ['admin', 'analyst']);
export const canViewData = (userRole) => hasRole(userRole, ['admin', 'analyst', 'contributor', 'viewer']);
export const canExportData = (userRole) => hasRole(userRole, ['admin', 'analyst']);
export const canManageSystem = (userRole) => isAdmin(userRole);

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

export default {
  authAPI,
  adminAPI,
  dashboardAPI,
  emissionsAPI,
  analyticsAPI,
  reportsAPI,
  monitorAPI,
  usersAPI,
  vehiclesAPI,
  employeesAPI,
  flightsAPI,
  generatorsAPI,
  organisationAPI,
  organizationAPI,
  notificationAPI,
  exportAPI,
  activityAPI,
  hasRole,
  isAdmin,
  isAnalyst,
  isContributor,
  isViewer,
  canManageUsers,
  canCreateUsers,
  canViewAllUsers,
  canViewAllData,
  canCreateEmissions,
  canVerifyEmissions,
  canDeleteEmissions,
  canViewData,
  canExportData,
  canManageSystem
};