// context/ActivityContext.jsx - Frontend activity logging context
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

  // Log user activity
  const logActivity = useCallback(async (action, resourceType = null, resourceId = null, details = null) => {
    if (!user) return;

    try {
      const activityData = {
        action,
        resourceType,
        resourceId,
        details,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.pathname,
        referrer: document.referrer
      };

      // Log to backend
      await activityAPI.logActivity(activityData);
      
      // Also store in localStorage for offline scenarios
      const localActivities = JSON.parse(localStorage.getItem('user_activities') || '[]');
      localActivities.push({
        ...activityData,
        user: {
          id: user.id,
          name: user.name,
          role: user.role
        }
      });
      
      // Keep only last 100 activities in localStorage
      if (localActivities.length > 100) {
        localActivities.splice(0, localActivities.length - 100);
      }
      
      localStorage.setItem('user_activities', JSON.stringify(localActivities));
    } catch (error) {
      console.warn('Failed to log activity:', error);
      // Don't throw error as this is non-critical functionality
    }
  }, [user]);

  // Specific activity logging functions
  const logPageView = useCallback((pageName) => {
    logActivity('page_view', 'page', null, `Viewed ${pageName} page`);
  }, [logActivity]);

  const logEmissionAction = useCallback((action, emissionId, details) => {
    logActivity(`emission_${action}`, 'emission', emissionId, details);
  }, [logActivity]);

  const logUserAction = useCallback((action, targetUserId, details) => {
    logActivity(`user_${action}`, 'user', targetUserId, details);
  }, [logActivity]);

  const logDownload = useCallback((fileType, fileName) => {
    logActivity('download', 'file', null, `Downloaded ${fileType}: ${fileName}`);
  }, [logActivity]);

  const logSearch = useCallback((query, results) => {
    logActivity('search', 'search', null, `Searched for: ${query} (${results} results)`);
  }, [logActivity]);

  const logDataExport = useCallback((exportType, format, recordCount) => {
    logActivity('export', 'data', null, `Exported ${recordCount} ${exportType} records as ${format}`);
  }, [logActivity]);

  const logDashboardInteraction = useCallback((interaction, componentName) => {
    logActivity('dashboard_interaction', 'component', null, `${interaction} on ${componentName}`);
  }, [logActivity]);

  const logFormSubmission = useCallback((formType, success, errorMessage = null) => {
    const details = success ? `Successfully submitted ${formType}` : `Failed to submit ${formType}: ${errorMessage}`;
    logActivity('form_submission', 'form', null, details);
  }, [logActivity]);

  const logChartInteraction = useCallback((chartType, action) => {
    logActivity('chart_interaction', 'chart', null, `${action} on ${chartType} chart`);
  }, [logActivity]);

  const logFilterChange = useCallback((filterType, filterValue) => {
    logActivity('filter_change', 'filter', null, `Changed ${filterType} filter to: ${filterValue}`);
  }, [logActivity]);

  const logModalAction = useCallback((modalName, action) => {
    logActivity('modal_action', 'modal', null, `${action} ${modalName} modal`);
  }, [logActivity]);

  // Activity tracking hooks for common patterns
  const withActivityLogging = useCallback((action, resourceType, resourceId) => {
    return async (callback, details) => {
      try {
        const result = await callback();
        logActivity(`${action}_success`, resourceType, resourceId, details);
        return result;
      } catch (error) {
        logActivity(`${action}_error`, resourceType, resourceId, `${details} - Error: ${error.message}`);
        throw error;
      }
    };
  }, [logActivity]);

  // Get recent activities from localStorage
  const getRecentActivities = useCallback((limit = 10) => {
    try {
      const activities = JSON.parse(localStorage.getItem('user_activities') || '[]');
      return activities.slice(-limit).reverse();
    } catch (error) {
      console.warn('Failed to get recent activities:', error);
      return [];
    }
  }, []);

  // Clear local activities
  const clearLocalActivities = useCallback(() => {
    localStorage.removeItem('user_activities');
  }, []);

  // Activity statistics
  const getActivityStats = useCallback(() => {
    try {
      const activities = JSON.parse(localStorage.getItem('user_activities') || '[]');
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const stats = {
        total: activities.length,
        today: activities.filter(a => new Date(a.timestamp) >= today).length,
        thisWeek: activities.filter(a => new Date(a.timestamp) >= thisWeek).length,
        byAction: {},
        byResourceType: {}
      };

      activities.forEach(activity => {
        stats.byAction[activity.action] = (stats.byAction[activity.action] || 0) + 1;
        if (activity.resourceType) {
          stats.byResourceType[activity.resourceType] = (stats.byResourceType[activity.resourceType] || 0) + 1;
        }
      });

      return stats;
    } catch (error) {
      console.warn('Failed to get activity stats:', error);
      return { total: 0, today: 0, thisWeek: 0, byAction: {}, byResourceType: {} };
    }
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
    
    // Helper functions
    withActivityLogging,
    getRecentActivities,
    clearLocalActivities,
    getActivityStats
  };

  return (
    <ActivityContext.Provider value={value}>
      {children}
    </ActivityContext.Provider>
  );
};

// Activity logging hook for components
export const useActivityLogger = () => {
  const { logActivity, logPageView, logEmissionAction } = useActivity();
  
  // Page view effect
  const usePageView = (pageName) => {
    React.useEffect(() => {
      logPageView(pageName);
    }, [pageName, logPageView]);
  };

  // Form submission logger
  const useFormLogger = () => {
    return React.useCallback(async (formType, submitFunction) => {
      try {
        const result = await submitFunction();
        logActivity('form_submit_success', 'form', null, `Successfully submitted ${formType}`);
        return result;
      } catch (error) {
        logActivity('form_submit_error', 'form', null, `Failed to submit ${formType}: ${error.message}`);
        throw error;
      }
    }, [logActivity]);
  };

  // Click event logger
  const useClickLogger = () => {
    return React.useCallback((elementName, additionalData = null) => {
      logActivity('click', 'ui_element', null, `Clicked ${elementName}${additionalData ? ` - ${additionalData}` : ''}`);
    }, [logActivity]);
  };

  return {
    logActivity,
    logPageView,
    logEmissionAction,
    usePageView,
    useFormLogger,
    useClickLogger
  };
};

// HOC for automatic activity logging
export const withActivityTracking = (WrappedComponent, componentName) => {
  return function ActivityTrackedComponent(props) {
    const { logPageView } = useActivity();
    
    React.useEffect(() => {
      logPageView(componentName);
    }, [logPageView]);
    
    return <WrappedComponent {...props} />;
  };
};

export default ActivityProvider;