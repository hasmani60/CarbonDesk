// Enhanced ActivityContext.jsx with integrated admin monitoring and user activity tracking
import { createContext, useContext, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { activityAPI } from '../services/api';

const ActivityContext = createContext();

export const useActivity = () => {
  const context = useContext(ActivityContext);
  if (!context) {
    throw new Error('useActivity must be used within an ActivityProvider');
  }
  return context;
};

export const ActivityProvider = ({ children }) => {
  const { user } = useAuth();

  // Initialize activity logging system
  useEffect(() => {
    initializeActivityLogging();
  }, [user]);

  const initializeActivityLogging = () => {
    // Ensure localStorage structure exists
    if (!localStorage.getItem('user_activities')) {
      localStorage.setItem('user_activities', JSON.stringify([]));
    }
    
    // Clean up old activities (keep last 500)
    try {
      const activities = JSON.parse(localStorage.getItem('user_activities') || '[]');
      if (activities.length > 500) {
        const recentActivities = activities.slice(-500);
        localStorage.setItem('user_activities', JSON.stringify(recentActivities));
      }
    } catch (error) {
      console.warn('Failed to clean up old activities:', error);
    }
  };

  // Enhanced activity logging with better error handling and admin integration
  const logActivity = useCallback(async (action, resourceType = null, resourceId = null, details = null, additionalData = {}) => {
    if (!user) return;

    try {
      const timestamp = new Date().toISOString();
      const sessionId = getOrCreateSessionId();
      const browserInfo = getBrowserInfo();
      
      const activityData = {
        id: generateUniqueId(),
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          email: user.email,
          organisation_id: user.organisation_id || user.organizationId || null  // ← ADD THIS LINE
        },
        organisation_id: user.organisation_id || user.organizationId || null,  // ← ADD THIS LINE
        action,
        resourceType,
        resourceId,
        details,
        timestamp,
        sessionId,
        ipAddress: await getClientIP(),
        userAgent: navigator.userAgent,
        url: window.location.pathname + window.location.search,
        referrer: document.referrer,
        browserInfo,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        severity: classifyActivitySeverity(action),
        category: categorizeActivity(action),
        ...additionalData
      };

      // Store in localStorage for immediate access and offline scenarios
      const localActivities = JSON.parse(localStorage.getItem('user_activities') || '[]');
      localActivities.push(activityData);
      
      // Keep only last 500 activities in localStorage to prevent storage overflow
      if (localActivities.length > 500) {
        localActivities.splice(0, localActivities.length - 500);
      }
      
      localStorage.setItem('user_activities', JSON.stringify(localActivities));

      // Dispatch custom event for real-time updates in admin panel and other components
      window.dispatchEvent(new CustomEvent('user-activity-logged', {
        detail: { 
          activity: activityData, 
          user: user,
          timestamp: new Date(),
          isRealTime: true
        }
      }));

      // Also trigger a user-specific event
      window.dispatchEvent(new CustomEvent(`user-activity-${user.id}`, {
        detail: activityData
      }));

      // Try to send to backend API (non-blocking)
      try {
        await sendActivityToBackend(activityData);
      } catch (error) {
        console.warn('Backend activity logging failed (non-critical):', error);
        // Store in a separate queue for retry later
        queueFailedActivity(activityData);
      }

      // Update session activity counter
      updateSessionActivityCount();

    } catch (error) {
      console.warn('Failed to log activity:', error);
      // Don't throw error as this is non-critical functionality
    }
  }, [user]);

// Send activity to backend
const sendActivityToBackend = async (activityData) => {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    const result = await activityAPI.logActivity(activityData);
    console.log('Activity logged to backend:', result);
  } catch (error) {
    // Activity logging is non-critical, don't throw or block UI
    console.warn('Backend activity logging failed (non-critical):', error.message);
  }
};


  // Queue failed activities for retry
  const queueFailedActivity = (activityData) => {
    try {
      const failedQueue = JSON.parse(localStorage.getItem('failed_activities') || '[]');
      failedQueue.push({
        ...activityData,
        failedAt: new Date().toISOString(),
        retryCount: 0
      });
      
      // Keep only last 50 failed activities
      if (failedQueue.length > 50) {
        failedQueue.splice(0, failedQueue.length - 50);
      }
      
      localStorage.setItem('failed_activities', JSON.stringify(failedQueue));
    } catch (error) {
      console.warn('Failed to queue activity for retry:', error);
    }
  };

  // Retry failed activities
  const retryFailedActivities = useCallback(async () => {
    try {
      const failedQueue = JSON.parse(localStorage.getItem('failed_activities') || '[]');
      if (failedQueue.length === 0) return;

      const successfulRetries = [];
      for (const failedActivity of failedQueue) {
        try {
          await sendActivityToBackend(failedActivity);
          successfulRetries.push(failedActivity.id);
        } catch (error) {
          // Increment retry count
          failedActivity.retryCount = (failedActivity.retryCount || 0) + 1;
          // Remove if too many retries
          if (failedActivity.retryCount > 3) {
            successfulRetries.push(failedActivity.id);
          }
        }
      }

      // Remove successfully sent or max-retry activities
      const remainingFailed = failedQueue.filter(
        activity => !successfulRetries.includes(activity.id)
      );
      localStorage.setItem('failed_activities', JSON.stringify(remainingFailed));
      
      if (successfulRetries.length > 0) {
        console.log(`Retried ${successfulRetries.length} failed activities`);
      }
    } catch (error) {
      console.warn('Failed to retry activities:', error);
    }
  }, []);

  // Get or create session ID
  const getOrCreateSessionId = () => {
    const sessionKey = 'carbon_accounting_session_id';
    let sessionId = sessionStorage.getItem(sessionKey);
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem(sessionKey, sessionId);
      sessionStorage.setItem('session_start', new Date().toISOString());
      sessionStorage.setItem('activity_count', '0');
    }
    return sessionId;
  };

  // Update session activity count
  const updateSessionActivityCount = () => {
    try {
      const currentCount = parseInt(sessionStorage.getItem('activity_count') || '0');
      sessionStorage.setItem('activity_count', String(currentCount + 1));
    } catch (error) {
      console.warn('Failed to update session activity count:', error);
    }
  };

  // Generate unique activity ID
  const generateUniqueId = () => {
    return `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // Get client IP (best effort)
  const getClientIP = async () => {
    try {
      // Try to get IP from a public service (non-blocking)
      const response = await fetch('https://api.ipify.org?format=json', {
        timeout: 2000
      });
      const data = await response.json();
      return data.ip || 'unknown';
    } catch (error) {
      return 'unknown';
    }
  };

  // Get browser information
  const getBrowserInfo = () => {
    const ua = navigator.userAgent;
    const browser = {
      name: 'Unknown',
      version: 'Unknown',
      os: 'Unknown',
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onlineStatus: navigator.onLine
    };

    // Detect browser
    if (ua.includes('Chrome') && !ua.includes('Edg')) browser.name = 'Chrome';
    else if (ua.includes('Firefox')) browser.name = 'Firefox';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser.name = 'Safari';
    else if (ua.includes('Edg')) browser.name = 'Edge';
    else if (ua.includes('Opera') || ua.includes('OPR')) browser.name = 'Opera';

    // Detect OS
    if (ua.includes('Windows NT')) browser.os = 'Windows';
    else if (ua.includes('Mac OS X')) browser.os = 'MacOS';
    else if (ua.includes('Linux')) browser.os = 'Linux';
    else if (ua.includes('Android')) browser.os = 'Android';
    else if (ua.includes('like Mac') && ua.includes('Mobile')) browser.os = 'iOS';

    return browser;
  };

  // Classify activity severity for admin monitoring
  const classifyActivitySeverity = (action) => {
    const highSeverity = [
      'admin_deleted_user',
      'admin_changed_user_role',
      'deleted_emission',
      'security_breach',
      'failed_login_multiple',
      'password_reset_admin',
      'bulk_delete',
      'system_configuration_change'
    ];
    
    const mediumSeverity = [
      'admin_created_user',
      'admin_updated_user',
      'created_emission',
      'updated_emission',
      'verified_emission',
      'exported_data',
      'bulk_operation',
      'password_change',
      'profile_update',
      'role_change_request'
    ];
    
    const lowSeverity = [
      'login',
      'logout',
      'viewed_dashboard',
      'viewed_analytics',
      'viewed_monitor',
      'page_view',
      'search',
      'filter_change',
      'modal_interaction'
    ];

    if (highSeverity.some(h => action.toLowerCase().includes(h.toLowerCase()))) return 'high';
    if (mediumSeverity.some(m => action.toLowerCase().includes(m.toLowerCase()))) return 'medium';
    if (lowSeverity.some(l => action.toLowerCase().includes(l.toLowerCase()))) return 'low';
    return 'medium';
  };

  // Categorize activities for better organization
  const categorizeActivity = (action) => {
    const categories = {
      authentication: ['login', 'logout', 'register', 'password', 'token'],
      administration: ['admin', 'user_management', 'role', 'permission', 'system'],
      emissions: ['emission', 'scope', 'factor', 'calculation'],
      navigation: ['viewed', 'page_view', 'visited', 'accessed'],
      data_operations: ['export', 'import', 'download', 'upload', 'sync'],
      search_filter: ['search', 'filter', 'sort', 'query'],
      ui_interaction: ['click', 'modal', 'form', 'button', 'chart'],
      security: ['security', 'breach', 'unauthorized', 'failed']
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => action.toLowerCase().includes(keyword))) {
        return category;
      }
    }
    
    return 'general';
  };

  // Enhanced specific activity logging functions
  const logPageView = useCallback((pageName, additionalData = {}) => {
    const details = `Viewed ${pageName} page`;
    logActivity('page_view', 'page', null, details, {
      pageName,
      loadTime: performance.now(),
      ...additionalData
    });
  }, [logActivity]);

  const logUserLogin = useCallback((loginMethod = 'standard') => {
    logActivity('login', 'authentication', user?.id, `User logged in via ${loginMethod}`, {
      loginMethod,
      sessionStart: new Date().toISOString(),
      deviceInfo: getBrowserInfo()
    });
  }, [logActivity, user]);

  const logUserLogout = useCallback((logoutReason = 'manual') => {
    const sessionStart = sessionStorage.getItem('session_start');
    const activityCount = sessionStorage.getItem('activity_count');
    const sessionDuration = sessionStart ? 
      Math.round((new Date() - new Date(sessionStart)) / 1000) : 0;
    
    logActivity('logout', 'authentication', user?.id, `User logged out (${logoutReason})`, {
      logoutReason,
      sessionDuration: `${sessionDuration} seconds`,
      activitiesInSession: activityCount || '0',
      sessionEnd: new Date().toISOString()
    });
  }, [logActivity, user]);

  const logEmissionAction = useCallback((action, emissionId, details, emissionData = {}) => {
    const enhancedDetails = emissionData && Object.keys(emissionData).length > 0
      ? `${details} | Scope: ${emissionData.scope} | Amount: ${emissionData.amount} ${emissionData.unit} | CO₂e: ${emissionData.calculatedEmissions?.toFixed(2)}`
      : details;
      
    logActivity(`emission_${action}`, 'emission', emissionId, enhancedDetails, {
      emissionData,
      calculatedAt: new Date().toISOString()
    });
  }, [logActivity]);

  const logAdminAction = useCallback((action, targetId, details, actionData = {}) => {
    logActivity(`admin_${action}`, 'administration', targetId, details, {
      adminAction: true,
      adminId: user?.id,
      adminName: user?.name,
      ...actionData
    });
  }, [logActivity, user]);

  const logSecurityEvent = useCallback((eventType, details, severity = 'high') => {
    logActivity(`security_${eventType}`, 'security', null, details, {
      securityEvent: true,
      reportedAt: new Date().toISOString(),
      severity,
      requiresAttention: severity === 'high'
    });
  }, [logActivity]);

  const logFormSubmission = useCallback((formType, success, errorMessage = null, formData = {}) => {
    const details = success 
      ? `Successfully submitted ${formType}`
      : `Failed to submit ${formType}: ${errorMessage}`;
      
    logActivity('form_submission', 'form', null, details, {
      formType,
      success,
      errorMessage,
      formDataSummary: Object.keys(formData).length > 0 ? `${Object.keys(formData).length} fields` : 'no data',
      submittedAt: new Date().toISOString()
    });
  }, [logActivity]);

  const logDataExport = useCallback((exportType, format, recordCount, filters = null) => {
    const details = filters 
      ? `Exported ${recordCount} ${exportType} records as ${format} with filters`
      : `Exported ${recordCount} ${exportType} records as ${format}`;
      
    logActivity('data_export', 'export', null, details, {
      exportType,
      format,
      recordCount,
      filters: filters ? JSON.stringify(filters) : null,
      exportedAt: new Date().toISOString()
    });
  }, [logActivity]);

  const logSearch = useCallback((query, results, context = null) => {
    const details = `Searched for: "${query}" (${results} results)`;
    logActivity('search', 'search', null, details, {
      query,
      resultsCount: results,
      context,
      searchedAt: new Date().toISOString()
    });
  }, [logActivity]);

  // Get recent activities with enhanced filtering
  const getRecentActivities = useCallback((limit = 10, filters = {}) => {
    try {
      const activities = JSON.parse(localStorage.getItem('user_activities') || '[]');
      let filteredActivities = [...activities]; // Create a copy

      // Apply filters
      if (user && (user.organisation_id || user.organizationId)) {
        const userOrgId = user.organisation_id || user.organizationId;
        console.log('🏢 Filtering activities by organisation:', userOrgId);
        
        filteredActivities = filteredActivities.filter(a => {
          // Check both user.organisation_id and top-level organisation_id
          const activityOrgId = a.organisation_id || a.user?.organisation_id;
          const matches = activityOrgId === userOrgId;
          
          if (!matches && activityOrgId) {
            console.log('🚫 Filtered out activity from different org:', {
              activityOrg: activityOrgId,
              userOrg: userOrgId,
              action: a.action
            });
          }
          
          return matches;
        });
        
        console.log(`✅ Filtered activities: ${filteredActivities.length} activities from organisation ${userOrgId}`);
      }

      if (filters.category) {
        filteredActivities = filteredActivities.filter(a => a.category === filters.category);
      }
      if (filters.severity) {
        filteredActivities = filteredActivities.filter(a => a.severity === filters.severity);
      }
      if (filters.action) {
        filteredActivities = filteredActivities.filter(a => 
          a.action.toLowerCase().includes(filters.action.toLowerCase())
        );
      }
      if (filters.dateRange) {
        const cutoffDate = new Date();
        cutoffDate.setHours(cutoffDate.getHours() - filters.dateRange);
        filteredActivities = filteredActivities.filter(a => new Date(a.timestamp) >= cutoffDate);
      }
      if (filters.startDate && filters.endDate) {
        const start = new Date(filters.startDate);
        const end = new Date(filters.endDate);
        filteredActivities = filteredActivities.filter(a => {
          const activityDate = new Date(a.timestamp);
          return activityDate >= start && activityDate <= end;
        });
      }

      // Sort by timestamp (newest first) and limit
      return filteredActivities
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);
    } catch (error) {
      console.warn('Failed to get recent activities:', error);
      return [];
    }
  }, [user]);

  // Get activity summary for admin dashboard
  const getActivitySummaryForAdmin = useCallback(() => {
    try {
      const activities = getRecentActivities(1000, {}); // Get all recent activities
      const now = new Date();
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const summary = {
        totalActivities: activities.length,
        recentActivities: activities.filter(a => new Date(a.timestamp) >= last24Hours).length,
        weeklyActivities: activities.filter(a => new Date(a.timestamp) >= lastWeek).length,
        criticalActivities: activities.filter(a => a.severity === 'high').length,
        uniqueUsers: new Set(activities.map(a => a.user?.id)).size,
        activeSessions: new Set(activities
          .filter(a => new Date(a.timestamp) >= last24Hours)
          .map(a => a.sessionId)
        ).size,
        topActions: {},
        topUsers: [],
        securityEvents: activities.filter(a => a.category === 'security').length,
        systemHealth: 'good' // Default
      };

      // Calculate top actions
      activities.forEach(activity => {
        summary.topActions[activity.action] = (summary.topActions[activity.action] || 0) + 1;
      });

      // Calculate most active users
      const userActivityCounts = {};
      activities.forEach(activity => {
        const userId = activity.user?.id;
        if (userId) {
          userActivityCounts[userId] = (userActivityCounts[userId] || 0) + 1;
        }
      });

      summary.topUsers = Object.entries(userActivityCounts)
        .map(([userId, count]) => ({ userId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Determine system health
      const recentCritical = activities.filter(a => 
        a.severity === 'high' && new Date(a.timestamp) >= last24Hours
      ).length;
      
      if (recentCritical > 5) summary.systemHealth = 'critical';
      else if (recentCritical > 2) summary.systemHealth = 'warning';

      return summary;
    } catch (error) {
      console.warn('Failed to get activity summary:', error);
      return {
        totalActivities: 0,
        recentActivities: 0,
        weeklyActivities: 0,
        criticalActivities: 0,
        uniqueUsers: 0,
        activeSessions: 0,
        topActions: {},
        topUsers: [],
        securityEvents: 0,
        systemHealth: 'unknown'
      };
    }
  }, [getRecentActivities]);

  // Enhanced activity statistics
  const getActivityStats = useCallback((timeRange = '7days') => {
    try {
      const activities = JSON.parse(localStorage.getItem('user_activities') || '[]');
      const now = new Date();
      let cutoffDate;
      
      switch (timeRange) {
        case '24hours':
          cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7days':
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30days':
          cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoffDate = new Date(0); // All time
      }

      const relevantActivities = activities.filter(a => new Date(a.timestamp) >= cutoffDate);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const stats = {
        total: relevantActivities.length,
        today: relevantActivities.filter(a => new Date(a.timestamp) >= today).length,
        thisWeek: relevantActivities.filter(a => new Date(a.timestamp) >= thisWeek).length,
        byAction: {},
        byResourceType: {},
        byCategory: {},
        bySeverity: {},
        byHour: new Array(24).fill(0),
        byDay: new Array(7).fill(0),
        uniqueSessions: new Set(relevantActivities.map(a => a.sessionId)).size,
        uniqueUsers: new Set(relevantActivities.map(a => a.user?.id)).size,
        avgActivitiesPerUser: 0,
        peakHour: 0,
        peakDay: 0
      };

      relevantActivities.forEach(activity => {
        const activityDate = new Date(activity.timestamp);
        
        // Count by action
        stats.byAction[activity.action] = (stats.byAction[activity.action] || 0) + 1;
        
        // Count by resource type
        if (activity.resourceType) {
          stats.byResourceType[activity.resourceType] = (stats.byResourceType[activity.resourceType] || 0) + 1;
        }
        
        // Count by category
        if (activity.category) {
          stats.byCategory[activity.category] = (stats.byCategory[activity.category] || 0) + 1;
        }
        
        // Count by severity
        if (activity.severity) {
          stats.bySeverity[activity.severity] = (stats.bySeverity[activity.severity] || 0) + 1;
        }
        
        // Count by hour for activity patterns
        const hour = activityDate.getHours();
        stats.byHour[hour] += 1;
        
        // Count by day of week
        const day = activityDate.getDay();
        stats.byDay[day] += 1;
      });

      // Calculate averages and peaks
      stats.avgActivitiesPerUser = stats.uniqueUsers > 0 ? stats.total / stats.uniqueUsers : 0;
      stats.peakHour = stats.byHour.indexOf(Math.max(...stats.byHour));
      stats.peakDay = stats.byDay.indexOf(Math.max(...stats.byDay));

      return stats;
    } catch (error) {
      console.warn('Failed to get activity stats:', error);
      return {
        total: 0, today: 0, thisWeek: 0,
        byAction: {}, byResourceType: {}, byCategory: {}, bySeverity: {},
        byHour: new Array(24).fill(0), byDay: new Array(7).fill(0),
        uniqueSessions: 0, uniqueUsers: 0, avgActivitiesPerUser: 0,
        peakHour: 0, peakDay: 0
      };
    }
  }, []);

  // Clear local activities with confirmation
  const clearLocalActivities = useCallback((keepLast = 0) => {
    try {
      if (keepLast > 0) {
        const activities = JSON.parse(localStorage.getItem('user_activities') || '[]');
        const activitiesToKeep = activities.slice(-keepLast);
        localStorage.setItem('user_activities', JSON.stringify(activitiesToKeep));
      } else {
        localStorage.removeItem('user_activities');
      }
      
      // Also clear failed activities
      localStorage.removeItem('failed_activities');
      
      // Dispatch cleanup event
      window.dispatchEvent(new CustomEvent('activities-cleared', {
        detail: { clearedAt: new Date().toISOString(), keepLast }
      }));
      
      return true;
    } catch (error) {
      console.warn('Failed to clear activities:', error);
      return false;
    }
  }, []);

  const value = {
    // Core logging function
    logActivity,
    
    // Specific logging functions
    logPageView,
    logUserLogin,
    logUserLogout,
    logEmissionAction,
    logAdminAction,
    logSecurityEvent,
    logFormSubmission,
    logDataExport,
    logSearch,
    
    // Data retrieval functions
    getRecentActivities,
    getActivitySummaryForAdmin,
    getActivityStats,
    clearLocalActivities,
    
    // Utility functions
    retryFailedActivities
  };

  return (
    <ActivityContext.Provider value={value}>
      {children}
    </ActivityContext.Provider>
  );
};

// Activity logging hooks for components
export const useActivityLogger = () => {
  const { 
    logActivity, 
    logPageView, 
    logEmissionAction, 
    logFormSubmission,
    logSearch 
  } = useActivity();
  
  return {
    logActivity,
    logPageView,
    logEmissionAction,
    logFormSubmission,
    logSearch
  };
};

export default ActivityProvider;