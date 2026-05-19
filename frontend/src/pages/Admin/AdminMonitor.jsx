// AdminMonitor.jsx - MongoDB-compatible Admin Monitor with Organisation Filtering
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
import { formatDateTime } from '../../utils/formatters';

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
    const refreshInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      loadData();
    }, 120000);
    
    return () => {
      clearTimeout(initialLoadTimeout);
      clearTimeout(updateTimeout);
      window.removeEventListener('emission-added', handleDataUpdate);
      window.removeEventListener('user-activity-logged', handleDataUpdate);
      clearInterval(refreshInterval);
    };
  }, [user?.id]);

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
      
      console.log('🔐 Loading admin data from MongoDB database...');
      
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
      console.log('📊 Fetching dashboard from MongoDB backend...');
      console.log('🏢 Current user organisation:', user?.organisation_id || user?.organizationId);
      
      const response = await adminAPI.getDashboard();
      
      // Handle both response formats
      let dashboardData = response.data || response;
      
      // Get organisation-specific users from backend
      const usersResponse = await adminAPI.getAllUsers({
        limit: 1000
      });
      
      const allUsers = usersResponse.data || usersResponse || [];
      
      console.log('✅ Dashboard loaded:', {
        userStats: dashboardData.userStats,
        activityStats: dashboardData.activityStats,
        emissionStats: dashboardData.emissionStats,
        totalUsers: allUsers.length
      });
      
      setAdminData(prev => ({
        ...prev,
        dashboard: {
          ...dashboardData,
          allUsers: allUsers
        }
      }));
    } catch (error) {
      console.error('❌ Dashboard load error:', error);
      throw error;
    }
  };

  const loadActivities = async () => {
    try {
      console.log('📋 Fetching activities from MongoDB backend...');
      console.log('🏢 Current user organisation:', user?.organisation_id || user?.organizationId);
      
      const params = {
        page: pagination.currentPage,
        limit: pagination.itemsPerPage,
        userId: filters.userId !== 'all' ? filters.userId : undefined,
        action: filters.action !== 'all' ? filters.action : undefined,
        search: searchQuery || undefined
      };
      
      const response = await adminAPI.getAllActivities(params);
      
      // Handle different response formats
      let activitiesData, paginationData;
      
      if (response.data && response.pagination) {
        // Format: { data: [...], pagination: {...} }
        activitiesData = response.data;
        paginationData = response.pagination;
      } else if (Array.isArray(response)) {
        // Format: [...]
        activitiesData = response;
        paginationData = {
          currentPage: 1,
          totalPages: 1,
          totalItems: response.length,
          itemsPerPage: response.length
        };
      } else if (response.activities) {
        // Format: { activities: [...], pagination: {...} }
        activitiesData = response.activities;
        paginationData = response.pagination || {
          currentPage: 1,
          totalPages: 1,
          totalItems: response.activities.length,
          itemsPerPage: response.activities.length
        };
      } else {
        activitiesData = [];
        paginationData = {
          currentPage: 1,
          totalPages: 1,
          totalItems: 0,
          itemsPerPage: pagination.itemsPerPage
        };
      }
      
      console.log('✅ Activities loaded:', {
        count: activitiesData.length,
        pagination: paginationData
      });
      
      setAdminData(prev => ({
        ...prev,
        activities: activitiesData
      }));
      
      setPagination(paginationData);
    } catch (error) {
      console.error('❌ Activities load error:', error);
      throw error;
    }
  };

  const loadUserSummary = async () => {
    try {
      console.log('👥 Fetching user summary from MongoDB backend...');
      console.log('🏢 Current user organisation:', user?.organisation_id || user?.organizationId);
      
      const response = await adminAPI.getUserSummary({ 
        timeframe: filters.timeframe 
      });
      
      // Handle response format
      const summaryData = response.data || response;
      
      console.log('✅ User summary loaded:', summaryData);
      
      // Transform userActivities to userStats format
      const userStats = (summaryData.userActivities || []).map(activity => ({
        userId: activity.user?.id || activity.user?._id,
        user: activity.user,
        totalActivities: activity.activityCount,
        uniqueActions: 1, // Backend doesn't provide this yet
        lastActivity: activity.lastActivity
      }));
      
      setAdminData(prev => ({
        ...prev,
        userSummary: {
          userStats: userStats,
          systemStats: {
            totalUsers: userStats.length,
            totalActivities: summaryData.totalActivities || 0,
            totalEmissions: 0, // Not provided by user-summary endpoint
            recentActivities: summaryData.totalActivities || 0
          },
          actionBreakdown: summaryData.actionBreakdown || []
        }
      }));
    } catch (error) {
      console.error('❌ User summary load error:', error);
      throw error;
    }
  };

  const handleRefresh = () => {
    logActivity('admin_action', 'admin_monitor', null, 'Manually refreshed admin monitor data', {
      tab: activeTab
    });
    loadData();
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
    return formatDateTime(timestamp);
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
    if (action.includes('create') || action.includes('added')) return 'bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-300';
    if (action.includes('update') || action.includes('verified')) return 'bg-blue-100 text-blue-800';
    if (action.includes('admin')) return 'bg-purple-100 text-purple-800';
    if (action.includes('login') || action.includes('logout')) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'high':
      case 'critical':
        return 'text-red-600 bg-red-50';
      case 'medium':
      case 'warning':
        return 'text-yellow-600 bg-yellow-50';
      case 'low':
      case 'info':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
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
        <div className="bg-green-50 dark:bg-green-950/25 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm text-green-800 dark:text-green-300">
                  <strong>Data Source:</strong> Backend MongoDB Database (Real-time data from MongoDB)
                </p>
                {user?.organisation?.name && (
                  <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                    <strong>Organisation Scope:</strong> Showing data for {user.organisation.name} only
                  </p>
                )}
              </div>
            </div>
            {(user?.organisation_id || user?.organizationId) && (
              <span className="text-xs text-green-600 dark:text-green-300 bg-white dark:bg-slate-800 px-2 py-1 rounded border border-green-300 dark:border-green-700">
                Org ID: {user.organisation_id || user.organizationId}
              </span>
            )}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="app-card p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-950/40 rounded-lg">
                <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{userStats?.total || 0}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {userStats?.active || 0} active
                </p>
              </div>
            </div>
          </div>

          <div className="app-card p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-950/40 rounded-lg">
                <Activity className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Activities Today</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{activityStats?.today || 0}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {activityStats?.thisWeek || 0} this week
                </p>
              </div>
            </div>
          </div>

          <div className="app-card p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-950/30 rounded-lg">
                <Database className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Emissions</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{emissionStats?.total || 0}</p>
                {emissionStats?.pending > 0 && (
                  <p className="text-xs text-yellow-600 mt-1">
                    {emissionStats.pending} pending
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="app-card p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 dark:bg-purple-950/35 rounded-lg">
                <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">This Week</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{emissionStats?.thisWeek || 0}</p>
                <p className="text-xs text-gray-500 mt-1">New emissions</p>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Stats */}
        {userStats && (
          <div className="app-card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">User Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">New Today</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{userStats.newToday || 0}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">New This Week</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{userStats.newThisWeek || 0}</p>
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
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <Info className="w-4 h-4 text-emerald-600" />
              <p className="text-sm text-emerald-800 dark:text-emerald-300">
                <strong>Organisation Filter Active:</strong> Displaying activities for <strong>{user.organisation.name}</strong> only
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="app-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search activities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800/80 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-80"
                />
              </div>
              
              <select
                value={filters.timeframe}
                onChange={(e) => handleFilterChange('timeframe', e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800/80 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
        <div className="app-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 dark:text-emerald-300 uppercase">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 dark:text-emerald-300 uppercase">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 dark:text-emerald-300 uppercase">Details</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 dark:text-emerald-300 uppercase">Timestamp</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-900/40 divide-y divide-gray-200 dark:divide-slate-700">
                {adminData.activities.map((activity, index) => (
                  <tr key={activity._id || activity.id || index} className="hover:bg-gray-50 dark:hover:bg-slate-800/40">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-medium">
                            {activity.user?.avatar || activity.user?.name?.charAt(0)?.toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
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
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 max-w-xs truncate" title={activity.details}>
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
                  className="px-3 py-1 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-800/50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {pagination.currentPage} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, currentPage: Math.min(prev.totalPages, prev.currentPage + 1) }))}
                  disabled={pagination.currentPage === pagination.totalPages}
                  className="px-3 py-1 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-800/50"
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
            <div className="app-card p-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{systemStats.totalUsers || 0}</p>
            </div>
            <div className="app-card p-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Activities</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{systemStats.totalActivities || 0}</p>
            </div>
            <div className="app-card p-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Emissions</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{systemStats.totalEmissions || 0}</p>
            </div>
            <div className="app-card p-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Recent Activities</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{systemStats.recentActivities || 0}</p>
            </div>
          </div>
        )}

        {/* User Stats Table */}
        {userStats && userStats.length > 0 && (
          <div className="app-card overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">User Activity Summary</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-slate-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 dark:text-emerald-300 uppercase">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 dark:text-emerald-300 uppercase">Total Activities</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 dark:text-emerald-300 uppercase">Unique Actions</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 dark:text-emerald-300 uppercase">Last Activity</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-900/40 divide-y divide-gray-200 dark:divide-slate-700">
                  {userStats.map((userStat, index) => (
                    <tr key={userStat.userId || index} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center">
                            <span className="text-white text-sm font-medium">
                              {userStat.user?.name?.charAt(0)?.toUpperCase() || 'U'}
                            </span>
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {userStat.user?.name || 'Unknown User'}
                            </div>
                            <div className="text-sm text-gray-500">
                              {userStat.user?.role || userStat.user?.email || 'N/A'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium">
                        {userStat.totalActivities || 0}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400">You need admin privileges to access this page.</p>
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
        <div className="app-card p-12 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Error Loading Data</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
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
            <span className="text-xs text-green-600 dark:text-green-300 bg-green-50 dark:bg-green-950/40 px-2 py-1 rounded flex items-center space-x-1 border border-green-200/80 dark:border-green-800">
              <Database className="w-3 h-3" />
              <span>MongoDB</span>
            </span>
            {user?.organisation?.name && (
              <span className="text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/60 font-medium">
                🏢 {user.organisation.name}
              </span>
            )}
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Live monitoring</span>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-500">
              Updated: {formatDateTime(lastUpdate)}
            </span>
          </div>
        }
      />

      {/* Tab Navigation */}
      <div className="app-card overflow-hidden">
        <div className="border-b border-gray-200 dark:border-slate-700">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-slate-500'
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