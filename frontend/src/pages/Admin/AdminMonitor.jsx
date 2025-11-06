// AdminMonitor.jsx - Uses Backend SQLite Database via API with Organisation Filtering
import { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  Activity, 
  Eye, 
  Search, 
  RefreshCw,
  Clock,
  Database,
  TrendingUp,
  Shield,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useActivity } from '../../context/ActivityContext';
import { adminAPI } from '../../services/api';
import PageHeader from '../../components/PageHeader/PageHeader';
import toast from 'react-hot-toast';

const AdminMonitor = () => {
  const { user, isAdmin } = useAuth();
  const { logActivity, getRecentActivities, getActivitySummaryForAdmin } = useActivity();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [dataSource, setDataSource] = useState('backend'); // Always backend now
  const [adminData, setAdminData] = useState({
    dashboard: null,
    activities: [],
    userSummary: null
  });
  const [filters, setFilters] = useState({
    timeframe: '7days',
    userId: 'all',
    action: 'all'
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 20
  });
  
  // Rate limiting state
  const [lastRequestTime, setLastRequestTime] = useState(0);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const MIN_REQUEST_INTERVAL = 2000; // 2 seconds between requests
  const loadDataTimeoutRef = useRef(null);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Eye, description: 'System overview and key metrics' },
    { id: 'activities', label: 'User Activities', icon: Activity, description: 'All user actions and activities' },
    { id: 'users', label: 'User Summary', icon: Users, description: 'User activity summary and statistics' }
  ];

  useEffect(() => {
    if (!isAdmin()) {
      toast.error('Admin access required');
      return;
    }
    
    console.log('🏢 AdminMonitor initialized for user:', {
      userId: user?.id,
      userName: user?.name,
      organisationId: user?.organisation_id || user?.organizationId,
      organisationName: user?.organisation?.name
    });
    
    // Log page view activity
    logActivity('page_view', 'page', null, 'Viewed Admin Monitor page', {
      pageName: 'Admin Monitor',
      tab: activeTab
    });
    
    // Debounced initial load - prevent React.StrictMode double call
    const initialLoadTimeout = setTimeout(() => {
      loadData();
    }, 300);
    
    // Listen for real-time updates with debouncing
    let updateTimeout;
    const handleDataUpdate = () => {
      clearTimeout(updateTimeout);
      updateTimeout = setTimeout(() => loadData(), 1000); // 1 second debounce
    };
    
    window.addEventListener('emission-added', handleDataUpdate);
    window.addEventListener('user-activity-logged', handleDataUpdate);
    
    // Increase refresh interval to reduce load
    const refreshInterval = setInterval(loadData, 60000); // Changed from 30s to 60s
    
    return () => {
      clearTimeout(initialLoadTimeout);
      clearTimeout(updateTimeout);
      window.removeEventListener('emission-added', handleDataUpdate);
      window.removeEventListener('user-activity-logged', handleDataUpdate);
      clearInterval(refreshInterval);
    };
  }, [user]); // Only depend on user, not other state

  useEffect(() => {
    if (isAdmin()) {
      // Log tab change activity
      logActivity('page_view', 'page', null, `Viewed ${activeTab} tab in Admin Monitor`, {
        pageName: 'Admin Monitor',
        tab: activeTab
      });
      
      // Debounce filter/tab changes to prevent rapid requests
      const debounceTimeout = setTimeout(() => {
        loadData();
      }, 500); // 500ms debounce
      
      return () => clearTimeout(debounceTimeout);
    }
  }, [activeTab, filters.timeframe, filters.userId, filters.action, pagination.currentPage]);

  // Separate useEffect for search query with longer debounce
  useEffect(() => {
    if (isAdmin() && activeTab === 'activities') {
      if (searchQuery) {
        // Log search activity
        logActivity('search', 'search', null, `Searched activities: "${searchQuery}"`, {
          context: 'Admin Monitor Activities',
          query: searchQuery
        });
      }
      
      const searchDebounceTimeout = setTimeout(() => {
        loadData();
      }, 800); // 800ms debounce for search
      
      return () => clearTimeout(searchDebounceTimeout);
    }
  }, [searchQuery]);

  const loadData = async () => {
    if (!isAdmin()) return;

    // Rate limiting check
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      console.log(`⏱️ Rate limited: waiting ${MIN_REQUEST_INTERVAL - timeSinceLastRequest}ms`);
      setIsRateLimited(true);
      
      // Schedule the request for later
      if (loadDataTimeoutRef.current) clearTimeout(loadDataTimeoutRef.current);
      loadDataTimeoutRef.current = setTimeout(() => {
        setIsRateLimited(false);
        loadData();
      }, MIN_REQUEST_INTERVAL - timeSinceLastRequest);
      
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setIsRateLimited(false);
      setLastRequestTime(now);
      
      console.log('🔐 Loading admin data from backend SQLite database...');
      
      switch (activeTab) {
        case 'dashboard':
          await loadDashboard();
          break;
        case 'activities':
          await loadActivities();
          break;
        case 'users':
          await loadUserSummary();
          break;
      }
      
      setLastUpdate(new Date());
    } catch (error) {
      console.error('❌ Admin data load error:', error);
      
      // Check if it's a 429 error
      if (error.response?.status === 429 || error.message?.includes('429')) {
        setError('Too many requests. Please wait a moment before refreshing.');
        toast.error('Rate limit reached. Slowing down requests...');
        setIsRateLimited(true);
        
        // Wait longer before allowing next request
        setTimeout(() => setIsRateLimited(false), 5000);
      } else {
        setError(error.message || 'Failed to load admin data. Please try again.');
        toast.error('Failed to load admin data');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = async () => {
    try {
      console.log('📊 Fetching dashboard from backend...');
      console.log('🏢 Current user organisation:', user?.organisation_id || user?.organizationId);
      
      const response = await adminAPI.getDashboard();
      
      // Handle both response formats
      let dashboardData = response.data || response;
      
      // Get organisation-specific users from backend
      const usersResponse = await adminAPI.getAllUsers({
        limit: 1000
      });
      
      const usersData = usersResponse.data || usersResponse || [];
      const totalUsersInOrg = usersData.length;
      
      console.log('👥 Users in current organisation:', totalUsersInOrg);
      
      // Count active users in organisation
      const activeUsersInOrg = usersData.filter(u => u.status === 'active').length;
      
      // Get organisation-filtered activities from ActivityContext
      const allActivities = getRecentActivities(1000, {}); // Already filtered by organisation
      
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      // Calculate organisation-specific activity stats
      const todayActivities = allActivities.filter(activity => {
        const activityDate = new Date(activity.timestamp || activity.createdAt);
        return activityDate >= today;
      }).length;
      
      const thisWeekActivities = allActivities.filter(activity => {
        const activityDate = new Date(activity.timestamp || activity.createdAt);
        return activityDate >= thisWeek;
      }).length;
      
      // Calculate new users today and this week
      const newToday = usersData.filter(u => {
        const createdDate = new Date(u.createdAt || u.created_at);
        return createdDate >= today;
      }).length;
      
      const newThisWeek = usersData.filter(u => {
        const createdDate = new Date(u.createdAt || u.created_at);
        return createdDate >= thisWeek;
      }).length;
      
      // Get organisation-specific emissions data
      let emissionStats = {
        total: 0,
        thisWeek: 0,
        pending: 0
      };
      
      try {
        // Try to fetch emissions from backend API
        // Assuming there's an endpoint to get all emissions
        console.log('📊 Fetching emissions data...');
        
        // Method 1: Try to get emissions from a dedicated endpoint
        let emissions = [];
        
        // Check if there's a getAllEmissions or getEmissions method
        if (typeof adminAPI.getAllEmissions === 'function') {
          const emissionsResponse = await adminAPI.getAllEmissions({
            limit: 10000
          });
          emissions = emissionsResponse.data || emissionsResponse || [];
        } else if (typeof adminAPI.getEmissions === 'function') {
          const emissionsResponse = await adminAPI.getEmissions({
            limit: 10000
          });
          emissions = emissionsResponse.data || emissionsResponse || [];
        } else {
          // Method 2: Parse from activities if no dedicated endpoint
          console.log('📊 Calculating emissions from activities...');
          const emissionActivities = allActivities.filter(activity => 
            activity.action?.includes('emission') && 
            activity.resourceType === 'emission'
          );
          
          // Extract unique emission IDs
          const uniqueEmissionIds = new Set();
          emissionActivities.forEach(activity => {
            if (activity.resourceId) {
              uniqueEmissionIds.add(activity.resourceId);
            }
          });
          
          // Use unique emission count as total
          emissionStats.total = uniqueEmissionIds.size;
          
          // Count emissions this week from activities
          const thisWeekEmissionActivities = emissionActivities.filter(activity => {
            const activityDate = new Date(activity.timestamp || activity.createdAt);
            return activityDate >= thisWeek && 
                   (activity.action === 'emission_created' || activity.action === 'created_emission');
          });
          
          const thisWeekEmissionIds = new Set();
          thisWeekEmissionActivities.forEach(activity => {
            if (activity.resourceId) {
              thisWeekEmissionIds.add(activity.resourceId);
            }
          });
          
          emissionStats.thisWeek = thisWeekEmissionIds.size;
          
          console.log('📊 Emissions calculated from activities:', emissionStats);
        }
        
        // If we got emissions from API, calculate stats
        if (emissions.length > 0) {
          console.log('📊 Processing', emissions.length, 'emissions from API');
          
          // Total emissions in organisation
          emissionStats.total = emissions.length;
          
          // Emissions this week
          emissionStats.thisWeek = emissions.filter(emission => {
            const emissionDate = new Date(emission.createdAt || emission.created_at || emission.date);
            return emissionDate >= thisWeek;
          }).length;
          
          // Pending emissions (if status field exists)
          emissionStats.pending = emissions.filter(emission => 
            emission.status === 'pending' || emission.verification_status === 'pending'
          ).length;
          
          console.log('📊 Emissions stats from API:', emissionStats);
        }
        
      } catch (emissionError) {
        console.warn('⚠️ Could not fetch emissions data:', emissionError.message);
        console.log('📊 Using emission stats from backend dashboard data');
        
        // Fallback to backend dashboard data if available
        if (dashboardData.emissionStats) {
          emissionStats = dashboardData.emissionStats;
        }
      }
      
      // Override stats with organisation-filtered data
      dashboardData = {
        ...dashboardData,
        userStats: {
          total: totalUsersInOrg,
          active: activeUsersInOrg,
          inactive: totalUsersInOrg - activeUsersInOrg,
          newToday: newToday,
          newThisWeek: newThisWeek
        },
        activityStats: {
          ...dashboardData.activityStats,
          today: todayActivities,
          thisWeek: thisWeekActivities,
          total: allActivities.length
        },
        emissionStats: emissionStats
      };
      
      // Dashboard data is now fully organisation-scoped
      console.log('✅ Dashboard data loaded (Organisation-Scoped):', {
        userStats: dashboardData.userStats,
        activityStats: dashboardData.activityStats,
        emissionStats: dashboardData.emissionStats,
        organisationId: user?.organisation_id || user?.organizationId,
        totalUsersInOrg: totalUsersInOrg,
        totalActivitiesFromContext: allActivities.length
      });
      
      setAdminData(prev => ({ ...prev, dashboard: dashboardData }));
      setDataSource('backend');
      console.log('✅ Dashboard data loaded from SQLite database');
    } catch (error) {
      console.error('❌ Dashboard API error:', error);
      throw new Error('Failed to load dashboard data from database');
    }
  };

  const loadActivities = async () => {
    try {
      console.log('📊 Fetching activities from backend...');
      console.log('🏢 Current user organisation:', user?.organisation_id || user?.organizationId);
      
      // Build filters for getRecentActivities
      const activityFilters = {};
      
      if (filters.action && filters.action !== 'all') {
        activityFilters.action = filters.action;
      }
      
      // Map timeframe to date range
      const now = new Date();
      if (filters.timeframe === '24hours') {
        activityFilters.startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        activityFilters.endDate = now.toISOString();
      } else if (filters.timeframe === '7days') {
        activityFilters.startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        activityFilters.endDate = now.toISOString();
      } else if (filters.timeframe === '30days') {
        activityFilters.startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        activityFilters.endDate = now.toISOString();
      }
      // 'all' - no date filter
      
      // Get organisation-filtered activities from ActivityContext
      let filteredActivities = getRecentActivities(10000, activityFilters); // Already filtered by organisation
      
      // Apply search query filter if provided
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredActivities = filteredActivities.filter(activity => {
          return (
            activity.user?.name?.toLowerCase().includes(query) ||
            activity.user?.email?.toLowerCase().includes(query) ||
            activity.action?.toLowerCase().includes(query) ||
            activity.details?.toLowerCase().includes(query)
          );
        });
      }
      
      // Apply user filter if provided
      if (filters.userId && filters.userId !== 'all') {
        filteredActivities = filteredActivities.filter(activity => 
          activity.user?.id === filters.userId
        );
      }
      
      console.log(`✅ Filtered activities: ${filteredActivities.length} activities from organisation`);
      
      // Manual pagination
      const totalItems = filteredActivities.length;
      const totalPages = Math.ceil(totalItems / pagination.itemsPerPage);
      const startIndex = (pagination.currentPage - 1) * pagination.itemsPerPage;
      const endIndex = startIndex + pagination.itemsPerPage;
      const paginatedActivities = filteredActivities.slice(startIndex, endIndex);
      
      setAdminData(prev => ({ ...prev, activities: paginatedActivities }));
      
      setPagination(prev => ({
        ...prev,
        totalPages: totalPages,
        totalItems: totalItems
      }));
      
      setDataSource('backend');
      console.log(`✅ Loaded ${paginatedActivities.length} of ${totalItems} activities (page ${pagination.currentPage} of ${totalPages})`);
    } catch (error) {
      console.error('❌ Activities load error:', error);
      throw new Error('Failed to load activities');
    }
  };

  const loadUserSummary = async () => {
    try {
      console.log('📊 Fetching user summary from backend...');
      console.log('🏢 Current user organisation:', user?.organisation_id || user?.organizationId);
      
      // Get organisation-specific users from backend
      const usersResponse = await adminAPI.getAllUsers({
        limit: 1000
      });
      
      const usersData = usersResponse.data || usersResponse || [];
      const totalUsersInOrg = usersData.length;
      
      console.log('👥 Users in current organisation:', totalUsersInOrg);
      
      // Get organisation-filtered activities from ActivityContext
      const allActivities = getRecentActivities(10000, {}); // Already filtered by organisation
      
      // Calculate stats per user
      const userActivityMap = {};
      
      allActivities.forEach(activity => {
        const userId = activity.user?.id;
        if (userId) {
          if (!userActivityMap[userId]) {
            userActivityMap[userId] = {
              userId: userId,
              user: activity.user,
              totalActivities: 0,
              uniqueActions: new Set(),
              lastActivity: null
            };
          }
          
          userActivityMap[userId].totalActivities += 1;
          userActivityMap[userId].uniqueActions.add(activity.action);
          
          const activityTime = new Date(activity.timestamp || activity.createdAt);
          if (!userActivityMap[userId].lastActivity || activityTime > new Date(userActivityMap[userId].lastActivity)) {
            userActivityMap[userId].lastActivity = activity.timestamp || activity.createdAt;
          }
        }
      });
      
      // Convert map to array and format
      const userStats = Object.values(userActivityMap).map(stat => ({
        ...stat,
        uniqueActions: stat.uniqueActions.size
      }));
      
      // Sort by total activities descending
      userStats.sort((a, b) => b.totalActivities - a.totalActivities);
      
      // Apply timeframe filter if needed
      let filteredUserStats = userStats;
      if (filters.timeframe !== 'all') {
        const now = new Date();
        let cutoffDate;
        
        switch (filters.timeframe) {
          case '24hours':
            cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case '7days':
            cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case '30days':
            cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        }
        
        if (cutoffDate) {
          // Recalculate for timeframe
          const timeframeActivities = allActivities.filter(a => 
            new Date(a.timestamp || a.createdAt) >= cutoffDate
          );
          
          const timeframeMap = {};
          timeframeActivities.forEach(activity => {
            const userId = activity.user?.id;
            if (userId) {
              if (!timeframeMap[userId]) {
                timeframeMap[userId] = {
                  userId: userId,
                  user: activity.user,
                  totalActivities: 0,
                  uniqueActions: new Set(),
                  lastActivity: null
                };
              }
              
              timeframeMap[userId].totalActivities += 1;
              timeframeMap[userId].uniqueActions.add(activity.action);
              
              const activityTime = new Date(activity.timestamp || activity.createdAt);
              if (!timeframeMap[userId].lastActivity || activityTime > new Date(timeframeMap[userId].lastActivity)) {
                timeframeMap[userId].lastActivity = activity.timestamp || activity.createdAt;
              }
            }
          });
          
          filteredUserStats = Object.values(timeframeMap).map(stat => ({
            ...stat,
            uniqueActions: stat.uniqueActions.size
          }));
          
          filteredUserStats.sort((a, b) => b.totalActivities - a.totalActivities);
        }
      }
      
      // Calculate system stats
      const now = new Date();
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const recentActivitiesCount = allActivities.filter(a => 
        new Date(a.timestamp || a.createdAt) >= last24Hours
      ).length;
      
      // Get total emissions count (from backend)
      let totalEmissions = 0;
      try {
        const dashboardResponse = await adminAPI.getDashboard();
        const dashboardData = dashboardResponse.data || dashboardResponse;
        totalEmissions = dashboardData.emissionStats?.total || 0;
      } catch (err) {
        console.warn('Could not fetch emissions count:', err);
      }
      
      const summaryData = {
        userStats: filteredUserStats,
        systemStats: {
          totalUsers: totalUsersInOrg,
          totalActivities: allActivities.length,
          totalEmissions: totalEmissions,
          recentActivities: recentActivitiesCount
        }
      };
      
      // User summary is already filtered by organisation
      console.log('✅ User summary loaded (Organisation-Scoped):', {
        totalUsers: totalUsersInOrg,
        userStatsCount: filteredUserStats.length,
        systemStats: summaryData.systemStats,
        organisationId: user?.organisation_id || user?.organizationId
      });
      
      setAdminData(prev => ({ ...prev, userSummary: summaryData }));
      setDataSource('backend');
      console.log('✅ User summary loaded with organisation filtering');
    } catch (error) {
      console.error('❌ User summary error:', error);
      throw new Error('Failed to load user summary');
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    
    // Log filter change activity
    logActivity('filter_change', 'filter', null, `Changed ${key} filter to ${value} in Admin Monitor`, {
      filterKey: key,
      filterValue: value,
      context: 'Admin Monitor'
    });
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatActionDisplay = (action) => {
    const actionMap = {
      'login': 'User Login',
      'logout': 'User Logout',
      'emission_created': 'Created Emission',
      'emission_updated': 'Updated Emission',
      'emission_deleted': 'Deleted Emission',
      'emission_verified': 'Verified Emission',
      'created_emission': 'Created Emission',
      'updated_emission': 'Updated Emission',
      'deleted_emission': 'Deleted Emission',
      'verified_emission': 'Verified Emission',
      'page_view': 'Page View',
      'dashboard_generate_insight': 'Generated Insight',
      'dashboard_quick_action': 'Quick Action',
      'admin_created_user': 'Admin: Created User',
      'admin_updated_user_role': 'Admin: Changed User Role',
      'admin_updated_user_status': 'Admin: Changed User Status',
      'admin_deleted_user': 'Admin: Deleted User'
    };
    
    return actionMap[action] || action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getActionBadgeColor = (action) => {
    if (action.includes('delete') || action.includes('rejected')) return 'bg-red-100 text-red-800';
    if (action.includes('create') || action.includes('added')) return 'bg-green-100 text-green-800';
    if (action.includes('update') || action.includes('verified')) return 'bg-blue-100 text-blue-800';
    if (action.includes('admin')) return 'bg-purple-100 text-purple-800';
    if (action.includes('login') || action.includes('logout')) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  const renderDashboard = () => {
    if (!adminData.dashboard) {
      return (
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No dashboard data available</p>
          <button
            onClick={loadDashboard}
            className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            Retry
          </button>
        </div>
      );
    }

    const { userStats, activityStats, emissionStats } = adminData.dashboard;

    return (
      <div className="space-y-6">
        {/* Data Source Indicator with Organisation Scope */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm text-green-800">
                  <strong>Data Source:</strong> Backend SQLite Database (Real-time data from local database)
                </p>
                {user?.organisation?.name && (
                  <p className="text-xs text-green-700 mt-1">
                    <strong>Organisation Scope:</strong> Showing data for {user.organisation.name} only
                  </p>
                )}
              </div>
            </div>
            {(user?.organisation_id || user?.organizationId) && (
              <span className="text-xs text-green-600 bg-white px-2 py-1 rounded border border-green-300">
                Org ID: {user.organisation_id || user.organizationId}
              </span>
            )}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{userStats?.total || 0}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {userStats?.active || 0} active
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Activity className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Activities Today</p>
                <p className="text-2xl font-bold text-gray-900">{activityStats?.today || 0}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {activityStats?.thisWeek || 0} this week
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Database className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Emissions</p>
                <p className="text-2xl font-bold text-gray-900">{emissionStats?.total || 0}</p>
                {emissionStats?.pending > 0 && (
                  <p className="text-xs text-yellow-600 mt-1">
                    {emissionStats.pending} pending
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">This Week</p>
                <p className="text-2xl font-bold text-gray-900">{emissionStats?.thisWeek || 0}</p>
                <p className="text-xs text-gray-500 mt-1">New emissions</p>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Stats */}
        {userStats && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">User Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">New Today</p>
                <p className="text-xl font-bold text-gray-900">{userStats.newToday || 0}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">New This Week</p>
                <p className="text-xl font-bold text-gray-900">{userStats.newThisWeek || 0}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Active Users</p>
                <p className="text-xl font-bold text-green-600">{userStats.active || 0}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Inactive Users</p>
                <p className="text-xl font-bold text-gray-400">{userStats.inactive || 0}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderActivities = () => {
    if (!adminData.activities || adminData.activities.length === 0) {
      return (
        <div className="text-center py-12">
          <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">No activities found</p>
          <p className="text-sm text-gray-500">
            {searchQuery || filters.timeframe !== 'all' || filters.action !== 'all'
              ? 'Try adjusting your filters'
              : 'Activities will appear here once users start interacting with the system'}
          </p>
          {user?.organisation?.name && (
            <p className="text-xs text-emerald-600 mt-2">
              Showing activities for: {user.organisation.name}
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Organisation Scope Information */}
        {user?.organisation?.name && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <Info className="w-4 h-4 text-emerald-600" />
              <p className="text-sm text-emerald-800">
                <strong>Organisation Filter Active:</strong> Displaying activities for <strong>{user.organisation.name}</strong> only
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search activities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 w-80"
                />
              </div>
              
              <select
                value={filters.timeframe}
                onChange={(e) => handleFilterChange('timeframe', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="24hours">Last 24 Hours</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="all">All Time</option>
              </select>
            </div>

            <button
              onClick={loadData}
              disabled={isRateLimited}
              className="flex items-center space-x-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title={isRateLimited ? 'Please wait...' : 'Refresh data'}
            >
              <RefreshCw className={`w-4 h-4 ${isRateLimited ? 'animate-spin' : ''}`} />
              <span>{isRateLimited ? 'Please wait...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Activities Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-emerald-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase">Details</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase">Timestamp</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {adminData.activities.map((activity, index) => (
                  <tr key={activity._id || activity.id || index} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-medium">
                            {activity.user?.avatar || activity.user?.name?.charAt(0)?.toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {activity.user?.name || 'Unknown User'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {activity.user?.role || activity.user?.email || 'N/A'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getActionBadgeColor(activity.action)}`}>
                        {activity.actionDisplay || formatActionDisplay(activity.action)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" title={activity.details}>
                      {activity.details || 'No details'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-4 h-4" />
                        <span>{formatTimestamp(activity.timestamp || activity.createdAt)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="px-6 py-4 border-t flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} to{' '}
                {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} of{' '}
                {pagination.totalItems} activities
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, currentPage: Math.max(1, prev.currentPage - 1) }))}
                  disabled={pagination.currentPage === 1}
                  className="px-3 py-1 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {pagination.currentPage} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, currentPage: Math.min(prev.totalPages, prev.currentPage + 1) }))}
                  disabled={pagination.currentPage === pagination.totalPages}
                  className="px-3 py-1 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderUserSummary = () => {
    if (!adminData.userSummary) {
      return (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No user summary data available</p>
          <button
            onClick={loadUserSummary}
            className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            Retry
          </button>
        </div>
      );
    }

    const { userStats, systemStats } = adminData.userSummary;

    return (
      <div className="space-y-6">
        {/* System Stats */}
        {systemStats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">{systemStats.totalUsers || 0}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <p className="text-sm font-medium text-gray-600">Total Activities</p>
              <p className="text-2xl font-bold text-gray-900">{systemStats.totalActivities || 0}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <p className="text-sm font-medium text-gray-600">Total Emissions</p>
              <p className="text-2xl font-bold text-gray-900">{systemStats.totalEmissions || 0}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <p className="text-sm font-medium text-gray-600">Recent Activities</p>
              <p className="text-2xl font-bold text-gray-900">{systemStats.recentActivities || 0}</p>
            </div>
          </div>
        )}

        {/* User Stats Table */}
        {userStats && userStats.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">User Activity Summary</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-emerald-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase">Total Activities</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase">Unique Actions</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase">Last Activity</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {userStats.map((userStat, index) => (
                    <tr key={userStat.userId || index} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center">
                            <span className="text-white text-sm font-medium">
                              {userStat.user?.name?.charAt(0)?.toUpperCase() || 'U'}
                            </span>
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">
                              {userStat.user?.name || 'Unknown User'}
                            </div>
                            <div className="text-sm text-gray-500">
                              {userStat.user?.role || userStat.user?.email || 'N/A'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                        {userStat.totalActivities || 0}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {userStat.uniqueActions || 0}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {userStat.lastActivity ? formatTimestamp(userStat.lastActivity) : 'Never'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!isAdmin()) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You need admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader 
          title="Admin Monitor"
          breadcrumb={[
            { label: 'Admin', href: '/admin' },
            { label: 'Monitor' }
          ]}
        />
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Error Loading Data</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={loadData}
            className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Admin Monitor"
        breadcrumb={[
          { label: 'Admin', href: '/admin' },
          { label: 'Monitor' }
        ]}
        action={
          <div className="flex items-center space-x-2">
            <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded flex items-center space-x-1">
              <Database className="w-3 h-3" />
              <span>SQLite DB</span>
            </span>
            {user?.organisation?.name && (
              <span className="text-sm text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 font-medium">
                🏢 {user.organisation.name}
              </span>
            )}
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-600">Live monitoring</span>
            </div>
            <span className="text-xs text-gray-500">
              Updated: {lastUpdate.toLocaleTimeString()}
            </span>
          </div>
        }
      />

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="border-b">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && renderDashboard()}
              {activeTab === 'activities' && renderActivities()}
              {activeTab === 'users' && renderUserSummary()}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminMonitor;