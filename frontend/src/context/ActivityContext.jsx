// Enhanced ActivityContext.jsx with improved real-time logging and admin panel integration
import { createContext, useContext, useCallback } from 'react';
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

  // Enhanced activity logging with better error handling and admin integration
  const logActivity = useCallback(async (action, resourceType = null, resourceId = null, details = null) => {
    if (!user) return;

    try {
      const timestamp = new Date().toISOString();
      const activityData = {
        action,
        resourceType,
        resourceId,
        details,
        timestamp,
        userAgent: navigator.userAgent,
        url: window.location.pathname,
        referrer: document.referrer,
        sessionId: generateSessionId(),
        browserInfo: getBrowserInfo(),
        screenResolution: `${window.screen.width}x${window.screen.height}`
      };

      // Try to log to backend first
      try {
        await activityAPI.logActivity(activityData);
      } catch (error) {
        console.warn('Backend activity logging failed, using localStorage only:', error);
      }
      
      // Always store in localStorage for offline scenarios and admin panel
      const localActivities = JSON.parse(localStorage.getItem('user_activities') || '[]');
      const newActivity = {
        ...activityData,
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          email: user.email
        },
        id: generateUniqueId(),
        severity: classifyActivitySeverity(action),
        category: categorizeActivity(action)
      };
      
      localActivities.push(newActivity);
      
      // Keep only last 200 activities in localStorage to prevent storage overflow
      if (localActivities.length > 200) {
        localActivities.splice(0, localActivities.length - 200);
      }
      
      localStorage.setItem('user_activities', JSON.stringify(localActivities));

      // Dispatch custom event for real-time updates in admin panel
      window.dispatchEvent(new CustomEvent('user-activity-logged', {
        detail: { activity: newActivity, user: user }
      }));

    } catch (error) {
      console.warn('Failed to log activity:', error);
      // Don't throw error as this is non-critical functionality
    }
  }, [user]);

  // Generate unique session ID
  const generateSessionId = useCallback(() => {
    const sessionKey = 'carbon_accounting_session_id';
    let sessionId = sessionStorage.getItem(sessionKey);
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem(sessionKey, sessionId);
    }
    return sessionId;
  }, []);

  // Generate unique activity ID
  const generateUniqueId = () => {
    return `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // Get browser information
  const getBrowserInfo = () => {
    const ua = navigator.userAgent;
    const browser = {
      name: 'Unknown',
      version: 'Unknown',
      os: 'Unknown'
    };

    // Detect browser
    if (ua.includes('Chrome')) browser.name = 'Chrome';
    else if (ua.includes('Firefox')) browser.name = 'Firefox';
    else if (ua.includes('Safari')) browser.name = 'Safari';
    else if (ua.includes('Edge')) browser.name = 'Edge';

    // Detect OS
    if (ua.includes('Windows')) browser.os = 'Windows';
    else if (ua.includes('Mac')) browser.os = 'MacOS';
    else if (ua.includes('Linux')) browser.os = 'Linux';
    else if (ua.includes('Android')) browser.os = 'Android';
    else if (ua.includes('iOS')) browser.os = 'iOS';

    return browser;
  };

  // Classify activity severity for admin monitoring
  const classifyActivitySeverity = (action) => {
    const highSeverity = [
      'deleted_emission',
      'admin_user_role_changed',
      'admin_user_deleted',
      'security_breach',
      'failed_login',
      'password_reset'
    ];
    
    const mediumSeverity = [
      'created_emission',
      'updated_emission',
      'verified_emission',
      'exported_data',
      'admin_viewed_all_users',
      'bulk_operation'
    ];
    
    const lowSeverity = [
      'viewed_dashboard',
      'viewed_analytics',
      'viewed_monitor',
      'page_view',
      'login',
      'logout'
    ];

    if (highSeverity.some(h => action.includes(h))) return 'high';
    if (mediumSeverity.some(m => action.includes(m))) return 'medium';
    if (lowSeverity.some(l => action.includes(l))) return 'low';
    return 'medium';
  };

  // Categorize activities for better organization
  const categorizeActivity = (action) => {
    if (action.includes('emission')) return 'emissions';
    if (action.includes('admin')) return 'administration';
    if (action.includes('login') || action.includes('logout')) return 'authentication';
    if (action.includes('viewed') || action.includes('page')) return 'navigation';
    if (action.includes('export') || action.includes('download')) return 'data_operations';
    if (action.includes('search') || action.includes('filter')) return 'search_filter';
    return 'general';
  };

  // Enhanced specific activity logging functions
  const logPageView = useCallback((pageName, additionalData = null) => {
    const details = additionalData 
      ? `Viewed ${pageName} page - ${JSON.stringify(additionalData)}`
      : `Viewed ${pageName} page`;
    logActivity('page_view', 'page', null, details);
  }, [logActivity]);

  const logEmissionAction = useCallback((action, emissionId, details, emissionData = null) => {
    const enhancedDetails = emissionData 
      ? `${details} | Scope: ${emissionData.scope} | Amount: ${emissionData.amount} ${emissionData.unit} | Emissions: ${emissionData.calculatedEmissions?.toFixed(2)} CO₂e`
      : details;
    logActivity(`emission_${action}`, 'emission', emissionId, enhancedDetails);
  }, [logActivity]);

  const logUserAction = useCallback((action, targetUserId, details) => {
    logActivity(`user_${action}`, 'user', targetUserId, details);
  }, [logActivity]);

  const logDownload = useCallback((fileType, fileName, recordCount = null) => {
    const details = recordCount 
      ? `Downloaded ${fileType}: ${fileName} (${recordCount} records)`
      : `Downloaded ${fileType}: ${fileName}`;
    logActivity('download', 'file', null, details);
  }, [logActivity]);

  const logSearch = useCallback((query, results, filters = null) => {
    const details = filters 
      ? `Searched for: "${query}" (${results} results) | Filters: ${JSON.stringify(filters)}`
      : `Searched for: "${query}" (${results} results)`;
    logActivity('search', 'search', null, details);
  }, [logActivity]);

  const logDataExport = useCallback((exportType, format, recordCount, filters = null) => {
    const details = filters 
      ? `Exported ${recordCount} ${exportType} records as ${format} | Filters: ${JSON.stringify(filters)}`
      : `Exported ${recordCount} ${exportType} records as ${format}`;
    logActivity('export', 'data', null, details);
  }, [logActivity]);

  const logDashboardInteraction = useCallback((interaction, componentName, additionalData = null) => {
    const details = additionalData 
      ? `${interaction} on ${componentName} - ${JSON.stringify(additionalData)}`
      : `${interaction} on ${componentName}`;
    logActivity('dashboard_interaction', 'component', null, details);
  }, [logActivity]);

  const logFormSubmission = useCallback((formType, success, errorMessage = null, formData = null) => {
    let details = success ? `Successfully submitted ${formType}` : `Failed to submit ${formType}`;
    if (errorMessage) details += ` - Error: ${errorMessage}`;
    if (formData) details += ` - Data: ${JSON.stringify(formData, null, 0)}`;
    logActivity('form_submission', 'form', null, details);
  }, [logActivity]);

  const logChartInteraction = useCallback((chartType, action, dataPoint = null) => {
    const details = dataPoint 
      ? `${action} on ${chartType} chart - ${JSON.stringify(dataPoint)}`
      : `${action} on ${chartType} chart`;
    logActivity('chart_interaction', 'chart', null, details);
  }, [logActivity]);

  const logFilterChange = useCallback((filterType, filterValue, previousValue = null) => {
    const details = previousValue 
      ? `Changed ${filterType} filter from "${previousValue}" to "${filterValue}"`
      : `Changed ${filterType} filter to: ${filterValue}`;
    logActivity('filter_change', 'filter', null, details);
  }, [logActivity]);

  const logModalAction = useCallback((modalName, action, data = null) => {
    const details = data 
      ? `${action} ${modalName} modal - ${JSON.stringify(data)}`
      : `${action} ${modalName} modal`;
    logActivity('modal_action', 'modal', null, details);
  }, [logActivity]);

  // Enhanced bulk operation logging for admin actions
  const logBulkOperation = useCallback((operation, resourceType, count, criteria = null) => {
    const details = criteria 
      ? `Performed ${operation} on ${count} ${resourceType}(s) | Criteria: ${JSON.stringify(criteria)}`
      : `Performed ${operation} on ${count} ${resourceType}(s)`;
    logActivity('bulk_operation', resourceType, null, details);
  }, [logActivity]);

  // Security-related logging
  const logSecurityEvent = useCallback((eventType, details, severity = 'medium') => {
    logActivity(`security_${eventType}`, 'security', null, details);
  }, [logActivity]);

  // Performance monitoring
  const logPerformanceMetric = useCallback((metricName, value, context = null) => {
    const details = context 
      ? `${metricName}: ${value} | Context: ${JSON.stringify(context)}`
      : `${metricName}: ${value}`;
    logActivity('performance_metric', 'performance', null, details);
  }, [logActivity]);

  // Activity tracking hooks for common patterns
  const withActivityLogging = useCallback((action, resourceType, resourceId) => {
    return async (callback, details) => {
      const startTime = performance.now();
      try {
        const result = await callback();
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);
        
        logActivity(`${action}_success`, resourceType, resourceId, 
          `${details} (completed in ${duration}ms)`);
        return result;
      } catch (error) {
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);
        
        logActivity(`${action}_error`, resourceType, resourceId, 
          `${details} - Error: ${error.message} (failed after ${duration}ms)`);
        throw error;
      }
    };
  }, [logActivity]);

  // Get recent activities with enhanced filtering
  const getRecentActivities = useCallback((limit = 10, filters = {}) => {
    try {
      const activities = JSON.parse(localStorage.getItem('user_activities') || '[]');
      let filteredActivities = activities;

      // Apply filters
      if (filters.category) {
        filteredActivities = filteredActivities.filter(a => a.category === filters.category);
      }
      if (filters.severity) {
        filteredActivities = filteredActivities.filter(a => a.severity === filters.severity);
      }
      if (filters.dateRange) {
        const cutoffDate = new Date();
        cutoffDate.setHours(cutoffDate.getHours() - filters.dateRange);
        filteredActivities = filteredActivities.filter(a => new Date(a.timestamp) >= cutoffDate);
      }
      if (filters.userId) {
        filteredActivities = filteredActivities.filter(a => a.user?.id === filters.userId);
      }

      return filteredActivities.slice(-limit).reverse();
    } catch (error) {
      console.warn('Failed to get recent activities:', error);
      return [];
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
      return true;
    } catch (error) {
      console.warn('Failed to clear activities:', error);
      return false;
    }
  }, []);

  // Enhanced activity statistics with more detailed breakdown
  const getActivityStats = useCallback(() => {
    try {
      const activities = JSON.parse(localStorage.getItem('user_activities') || '[]');
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thisMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const stats = {
        total: activities.length,
        today: activities.filter(a => new Date(a.timestamp) >= today).length,
        thisWeek: activities.filter(a => new Date(a.timestamp) >= thisWeek).length,
        thisMonth: activities.filter(a => new Date(a.timestamp) >= thisMonth).length,
        byAction: {},
        byResourceType: {},
        byCategory: {},
        bySeverity: {},
        byHour: new Array(24).fill(0),
        uniqueSessions: new Set(activities.map(a => a.sessionId)).size
      };

      activities.forEach(activity => {
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
        const hour = new Date(activity.timestamp).getHours();
        stats.byHour[hour] += 1;
      });

      return stats;
    } catch (error) {
      console.warn('Failed to get activity stats:', error);
      return { 
        total: 0, today: 0, thisWeek: 0, thisMonth: 0, 
        byAction: {}, byResourceType: {}, byCategory: {}, bySeverity: {},
        byHour: new Array(24).fill(0), uniqueSessions: 0
      };
    }
  }, []);

  // Get activity summary for admin dashboard
  const getActivitySummaryForAdmin = useCallback(() => {
    const activities = JSON.parse(localStorage.getItem('user_activities') || '[]');
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const summary = {
      totalActivities: activities.length,
      recentActivities: activities.filter(a => new Date(a.timestamp) >= last24Hours).length,
      criticalActivities: activities.filter(a => a.severity === 'high').length,
      uniqueUsers: new Set(activities.map(a => a.user?.id)).size,
      mostActiveUsers: [],
      activityTrends: [],
      securityEvents: activities.filter(a => a.category === 'security').length
    };

    // Calculate most active users
    const userActivityCounts = {};
    activities.forEach(activity => {
      const userId = activity.user?.id;
      if (userId) {
        userActivityCounts[userId] = (userActivityCounts[userId] || 0) + 1;
      }
    });

    summary.mostActiveUsers = Object.entries(userActivityCounts)
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return summary;
  }, []);

  const value = {
    // Core logging function
    logActivity,
    
    // Specific logging functions
    logPageView,
    logEmissionAction,
    logUserAction,
    logDownload,
    logSearch,
    logDataExport,
    logDashboardInteraction,
    logFormSubmission,
    logChartInteraction,
    logFilterChange,
    logModalAction,
    logBulkOperation,
    logSecurityEvent,
    logPerformanceMetric,
    
    // Helper functions
    withActivityLogging,
    getRecentActivities,
    clearLocalActivities,
    getActivityStats,
    getActivitySummaryForAdmin
  };

  return (
    <ActivityContext.Provider value={value}>
      {children}
    </ActivityContext.Provider>
  );
};

// Activity logging hook for components with enhanced features
export const useActivityLogger = () => {
  const { 
    logActivity, 
    logPageView, 
    logEmissionAction, 
    logFormSubmission,
    logPerformanceMetric 
  } = useActivity();
  
  // Page view effect with performance tracking
  const usePageView = (pageName, dependencies = []) => {
    React.useEffect(() => {
      const startTime = performance.now();
      logPageView(pageName);
      
      return () => {
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);
        logPerformanceMetric('page_view_duration', duration, { page: pageName });
      };
    }, dependencies);
  };

  // Form submission logger with validation tracking
  const useFormLogger = () => {
    return React.useCallback(async (formType, submitFunction, validationData = null) => {
      const startTime = performance.now();
      try {
        const result = await submitFunction();
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);
        
        logFormSubmission(formType, true, null, { 
          duration, 
          validation: validationData 
        });
        return result;
      } catch (error) {
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);
        
        logFormSubmission(formType, false, error.message, { 
          duration,
          validation: validationData 
        });
        throw error;
      }
    }, []);
  };

  // Enhanced click event logger with element tracking
  const useClickLogger = () => {
    return React.useCallback((elementName, elementType = 'button', additionalData = null) => {
      logActivity('click', 'ui_element', null, 
        `Clicked ${elementType}: ${elementName}${additionalData ? ` - ${JSON.stringify(additionalData)}` : ''}`
      );
    }, [logActivity]);
  };

  return {
    logActivity,
    logPageView,
    logEmissionAction,
    logFormSubmission,
    usePageView,
    useFormLogger,
    useClickLogger
  };
};

// HOC for automatic activity logging with enhanced features
export const withActivityTracking = (WrappedComponent, componentName, trackingOptions = {}) => {
  return function ActivityTrackedComponent(props) {
    const { logPageView, logPerformanceMetric } = useActivity();
    const mountTime = React.useRef(null);
    
    React.useEffect(() => {
      mountTime.current = performance.now();
      logPageView(componentName);
      
      return () => {
        if (mountTime.current) {
          const unmountTime = performance.now();
          const componentLifetime = Math.round(unmountTime - mountTime.current);
          logPerformanceMetric('component_lifetime', componentLifetime, { 
            component: componentName 
          });
        }
      };
    }, []);

    // Track prop changes if enabled
    React.useEffect(() => {
      if (trackingOptions.trackPropChanges) {
        logActivity('component_prop_change', 'component', null, 
          `${componentName} props changed: ${JSON.stringify(props)}`);
      }
    }, [props]);
    
    return <WrappedComponent {...props} />;
  };
};

export default ActivityProvider;