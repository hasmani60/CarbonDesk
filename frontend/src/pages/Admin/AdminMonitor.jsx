// AdminMonitor.jsx - Uses Backend SQLite Database via API
import { useState, useEffect } from 'react';
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
  CheckCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useActivity } from '../../context/ActivityContext';
import { adminAPI } from '../../services/api';
import PageHeader from '../../components/PageHeader/PageHeader';
import toast from 'react-hot-toast';

const AdminMonitor = () => {
  const { user, isAdmin } = useAuth();
  const { logActivity } = useActivity();
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
    
    loadData();
    
    // Listen for real-time updates
    const handleDataUpdate = () => setTimeout(loadData, 500);
    
    window.addEventListener('emission-added', handleDataUpdate);
    window.addEventListener('user-activity-logged', handleDataUpdate);
    
    const refreshInterval = setInterval(loadData, 30000);
    
    return () => {
      window.removeEventListener('emission-added', handleDataUpdate);
      window.removeEventListener('user-activity-logged', handleDataUpdate);
      clearInterval(refreshInterval);
    };
  }, [user]);

  useEffect(() => {
    if (isAdmin()) {
      loadData();
    }
  }, [activeTab, filters, pagination.currentPage, searchQuery]);

  const loadData = async () => {
    if (!isAdmin()) return;

    try {
      setLoading(true);
      setError(null);
      
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
      setError(error.message || 'Failed to load admin data. Please try again.');
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = async () => {
    try {
      console.log('📊 Fetching dashboard from backend...');
      const response = await adminAPI.getDashboard();
      
      // Handle both response formats
      const dashboardData = response.data || response;
      
      setAdminData(prev => ({ ...prev, dashboard: dashboardData }));
      setDataSource('backend');
      console.log('✅ Dashboard data loaded from SQLite database:', dashboardData);
    } catch (error) {
      console.error('❌ Dashboard API error:', error);
      throw new Error('Failed to load dashboard data from database');
    }
  };

  const loadActivities = async () => {
    try {
      console.log('📊 Fetching activities from backend...');
      
      // Build query parameters
      const params = {
        page: pagination.currentPage,
        limit: pagination.itemsPerPage
      };
      
      if (filters.userId && filters.userId !== 'all') {
        params.userId = filters.userId;
      }
      
      if (filters.action && filters.action !== 'all') {
        params.action = filters.action;
      }
      
      if (searchQuery) {
        params.search = searchQuery;
      }
      
      // Map timeframe to date range
      const now = new Date();
      switch (filters.timeframe) {
        case '24hours':
          params.startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
          break;
        case '7days':
          params.startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
          break;
        case '30days':
          params.startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
          break;
        // 'all' - no date filter
      }
      
      const response = await adminAPI.getAllActivities(params);
      
      // Handle response format
      const activitiesData = response.data || response;
      const paginationData = response.pagination;
      
      setAdminData(prev => ({ ...prev, activities: activitiesData || [] }));
      
      if (paginationData) {
        setPagination(prev => ({
          ...prev,
          totalPages: paginationData.totalPages,
          totalItems: paginationData.totalItems
        }));
      }
      
      setDataSource('backend');
      console.log(`✅ Loaded ${activitiesData?.length || 0} activities from SQLite database`);
    } catch (error) {
      console.error('❌ Activities API error:', error);
      throw new Error('Failed to load activities from database');
    }
  };

  const loadUserSummary = async () => {
    try {
      console.log('📊 Fetching user summary from backend...');
      
      const params = {
        timeframe: filters.timeframe
      };
      
      const response = await adminAPI.getUserSummary(params);
      
      // Handle response format
      const summaryData = response.data || response;
      
      setAdminData(prev => ({ ...prev, userSummary: summaryData }));
      setDataSource('backend');
      console.log('✅ User summary loaded from SQLite database');
    } catch (error) {
      console.error('❌ User summary API error:', error);
      throw new Error('Failed to load user summary from database');
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, currentPage: 1 }));
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
        {/* Data Source Indicator */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <p className="text-sm text-green-800">
              <strong>Data Source:</strong> Backend SQLite Database (Real-time data from local database)
            </p>
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
        </div>
      );
    }

    return (
      <div className="space-y-6">
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
              className="flex items-center space-x-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
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
              <span className="text-sm text-gray-600">{user.organisation.name}</span>
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