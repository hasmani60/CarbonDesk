// services/api.js - Updated API service with 429 Retry Logic and Advanced Analytics
import axios from 'axios';

// Base API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

// Create axios instance with default configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // Increased from 15000 to 30000 (30 seconds)
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
    
    // 403 Forbidden - access denied
    if (error.response?.status === 403) {
      return Promise.reject({
        message: error.response.data?.message || 'Access denied. Insufficient permissions.',
        status: 'ACCESS_DENIED'
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
  changePassword: (passwordData) => apiClient.patch('/auth/change-password', passwordData)
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
  getTopEmitters: (params) => apiClient.get('/analytics/top-emitters', { params }),
  getUserAnalytics: (userId, params) => apiClient.get('/analytics/user', { 
    params: { userId, ...params } 
  }),

  // ===== NEW: SCOPE MIGRATION ANALYSIS =====
  /**
   * Get scope migration analysis data
   * @param {Object} params - Query parameters
   * @param {string} params.startDate - Start date (ISO format)
   * @param {string} params.endDate - End date (ISO format)
   * @param {string} params.timeGranularity - 'month' | 'quarter' | 'year'
   * @returns {Promise} Scope migration data with insights
   */
  getScopeMigration: (params = {}) => {
    const defaultParams = {
      timeGranularity: 'quarter',
      ...params
    };
    return apiClient.get('/analytics/scope-migration', { params: defaultParams });
  },

  /**
   * Get burden shifting detection analysis
   * @param {Object} params - Query parameters
   * @returns {Promise} Burden shifting insights
   */
  getBurdenShifting: (params = {}) => {
    return apiClient.get('/analytics/burden-shifting', { params });
  },

  /**
   * Get emission flow matrix between scopes
   * @param {Object} params - Query parameters
   * @returns {Promise} Flow matrix data for Sankey diagram
   */
  getEmissionFlows: (params = {}) => {
    return apiClient.get('/analytics/emission-flows', { params });
  },

  // ===== NEW: HOTSPOT PARETO ANALYSIS =====
  /**
   * Get Pareto analysis data with drill-down capability
   * @param {Object} params - Query parameters
   * @param {number|string} params.scope - 1 | 2 | 3 | 'all'
   * @param {string} params.drilldownLevel - 'scope' | 'category' | 'activity' | 'asset'
   * @param {string} params.parentId - Parent ID for drill-down (optional)
   * @param {Object} params.dateRange - { start, end }
   * @returns {Promise} Pareto analysis data
   */
  getHotspotPareto: (params = {}) => {
    const defaultParams = {
      scope: 'all',
      drilldownLevel: 'scope',
      ...params
    };
    return apiClient.get('/analytics/hotspot-pareto', { params: defaultParams });
  },

  /**
   * Get children items for Pareto drill-down
   * @param {string} parentId - Parent item identifier
   * @param {Object} params - Additional query parameters
   * @returns {Promise} Child items for drill-down
   */
  getParetoChildren: (parentId, params = {}) => {
    return apiClient.get(`/analytics/hotspot-pareto/${parentId}/children`, { params });
  },

  /**
   * Get concentration risk metrics
   * @param {Object} params - Query parameters
   * @returns {Promise} Concentration risk analysis
   */
  getConcentrationRisk: (params = {}) => {
    return apiClient.get('/analytics/concentration-risk', { params });
  },

  /**
   * Get reduction potential analysis
   * @param {Object} params - Query parameters
   * @param {number} params.reductionPercentage - Target reduction % (default 50)
   * @returns {Promise} Reduction potential metrics
   */
  getReductionPotential: (params = {}) => {
    const defaultParams = {
      reductionPercentage: 50,
      ...params
    };
    return apiClient.get('/analytics/reduction-potential', { params: defaultParams });
  },

  // ===== NEW: EMISSIONS TRAJECTORY ANALYSIS =====
  /**
   * Get emissions trajectory analysis vs science-based targets
   * @param {Object} params - Query parameters
   * @param {string} params.startDate - Start date
   * @param {string} params.endDate - End date
   * @param {string} params.targetScenario - '1.5C' | '2C' | '2C_low'
   * @param {number} params.baselineYear - Baseline year for targets
   * @returns {Promise} Trajectory analysis with alignment metrics
   */
  getEmissionsTrajectory: (params = {}) => {
    const defaultParams = {
      targetScenario: '1.5C',
      ...params
    };
    return apiClient.get('/analytics/emissions-trajectory', { params: defaultParams });
  },

  /**
   * Get trajectory alignment status
   * @param {Object} params - Query parameters
   * @returns {Promise} Alignment metrics and recommendations
   */
  getTrajectoryAlignment: (params = {}) => {
    return apiClient.get('/analytics/trajectory-alignment', { params });
  },

  // ===== NEW: VELOCITY & ACCELERATION ANALYSIS =====
  /**
   * Get emissions velocity and acceleration metrics
   * @param {Object} params - Query parameters
   * @param {string} params.startDate - Start date
   * @param {string} params.endDate - End date
   * @param {string} params.granularity - 'month' | 'quarter' | 'year'
   * @returns {Promise} Velocity and acceleration data with inflection points
   */
  getEmissionsVelocity: (params = {}) => {
    const defaultParams = {
      granularity: 'quarter',
      ...params
    };
    return apiClient.get('/analytics/emissions-velocity', { params: defaultParams });
  },

  /**
   * Get inflection points (trend reversals)
   * @param {Object} params - Query parameters
   * @returns {Promise} Detected inflection points with context
   */
  getInflectionPoints: (params = {}) => {
    return apiClient.get('/analytics/inflection-points', { params });
  },

  // ===== NEW: MACC ANALYSIS =====
  /**
   * Get Marginal Abatement Cost Curve analysis
   * @param {Object} params - Query parameters
   * @param {number} params.scope - Filter by scope (optional)
   * @param {string} params.category - Filter by category (optional)
   * @returns {Promise} MACC analysis with cost-effectiveness ranking
   */
  getMACCAnalysis: (params = {}) => {
    return apiClient.get('/analytics/macc', { params });
  },

  /**
   * Create or update MACC opportunity
   * @param {Object} opportunityData - MACC opportunity data
   * @returns {Promise} Created/updated opportunity
   */
  saveMACCOpportunity: (opportunityData) => {
    return apiClient.post('/analytics/macc/opportunities', opportunityData);
  },

  /**
   * Get MACC opportunities
   * @param {Object} params - Query parameters
   * @returns {Promise} List of MACC opportunities
   */
  getMACCOpportunities: (params = {}) => {
    return apiClient.get('/analytics/macc/opportunities', { params });
  },

  /**
   * Delete MACC opportunity
   * @param {number} opportunityId - Opportunity ID
   * @returns {Promise} Deletion confirmation
   */
  deleteMACCOpportunity: (opportunityId) => {
    return apiClient.delete(`/analytics/macc/opportunities/${opportunityId}`);
  },

  // ===== EXPORT FUNCTIONS FOR ADVANCED ANALYTICS =====
  /**
   * Export scope migration analysis
   * @param {string} format - 'csv' | 'json' | 'pdf'
   * @param {Object} filters - Filter parameters
   * @returns {Promise<Blob>} File blob
   */
  exportScopeMigration: (format = 'csv', filters = {}) => {
    return apiClient.get('/analytics/scope-migration/export', {
      params: { format, ...filters },
      responseType: 'blob'
    });
  },

  /**
   * Export Pareto analysis
   * @param {string} format - 'csv' | 'json' | 'pdf'
   * @param {Object} filters - Filter parameters
   * @returns {Promise<Blob>} File blob
   */
  exportParetoAnalysis: (format = 'csv', filters = {}) => {
    return apiClient.get('/analytics/hotspot-pareto/export', {
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

// Monitor API
export const monitorAPI = {
  getActivities: (params) => apiClient.get('/monitor/activities', { params }),
  createTask: (taskData) => apiClient.post('/monitor/tasks', taskData),
  updateTask: (id, taskData) => apiClient.patch(`/monitor/tasks/${id}`, taskData),
  deleteTask: (id) => apiClient.delete(`/monitor/tasks/${id}`),
  getTasks: (params) => apiClient.get('/monitor/tasks', { params }),
  assignActivity: (assignmentData) => apiClient.post('/monitor/assign', assignmentData),
  getMyTasks: (params) => apiClient.get('/monitor/tasks', { params: { ...params, assignedToMe: true } }),
  getTaskById: (id) => apiClient.get(`/monitor/tasks/${id}`),
  updateTaskStatus: (id, status) => apiClient.patch(`/monitor/tasks/${id}`, { status })
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
  logActivity: (activityData) => apiClient.post('/activity/log', activityData),
  getUserActivities: (userId, params) => apiClient.get(`/activity/user/${userId}`, { params }),
  getRecentActivities: (params) => apiClient.get('/activity/recent', { params })
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