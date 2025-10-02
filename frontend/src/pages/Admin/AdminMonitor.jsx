// AdminMonitor.jsx - Real API Data Only, No Fallbacks
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
  AlertCircle
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
    
    window.addEventListener('emission-added', handleEmissionAdded);
    const refreshInterval = setInterval(loadData, 30000);
    
    return () => {
      window.removeEventListener('emission-added', handleEmissionAdded);
      clearInterval(refreshInterval);
    };
  }, [user]);

  useEffect(() => {
    if (isAdmin()) {
      loadData();
    }
  }, [activeTab, filters, pagination.currentPage, searchQuery]);

  const handleEmissionAdded = () => {
    setTimeout(loadData, 500);
  };

  const loadData = async () => {
    if (!isAdmin()) return;

    try {
      setLoading(true);
      setError(null);
      
      console.log('🔐 Loading admin data for organisation:', user?.organisation_id);
      
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
      setError('Failed to load admin data. Please check your connection.');
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = async () => {
    try {
      const dashboardData = await adminAPI.getDashboard();
      setAdminData(prev => ({ ...prev, dashboard: dashboardData }));
      console.log('✅ Dashboard data loaded');
    } catch (error) {
      console.error('❌ Dashboard API error:', error);
      throw error;
    }
  };

  const loadActivities = async () => {
    try {
      // Load from API only
      const activities = await adminAPI.getAllActivities({
        timeframe: filters.timeframe,
        userId: filters.userId !== 'all' ? filters.userId : undefined,
        action: filters.action !== 'all' ? filters.action : undefined,
        search: searchQuery,
        page: pagination.currentPage,
        limit: pagination.itemsPerPage
      });
      
      setAdminData(prev => ({ ...prev, activities: activities.data || [] }));
      
      if (activities.pagination) {
        setPagination(prev => ({
          ...prev,
          ...activities.pagination
        }));
      }
      
      console.log(`✅ Loaded ${activities.data?.length || 0} activities`);
    } catch (error) {
      console.error('❌ Activities API error:', error);
      throw error;
    }
  };

  const loadUserSummary = async () => {
    try {
      const userSummary = await adminAPI.getUserActivitySummary({
        timeframe: filters.timeframe
      });
      
      setAdminData(prev => ({ ...prev, userSummary }));
      console.log('✅ User summary loaded');
    } catch (error) {
      console.error('❌ User summary API error:', error);
      throw error;
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
      'created_emission': 'Created Emission',
      'updated_emission': 'Updated Emission',
      'deleted_emission': 'Deleted Emission',
      'verified_emission': 'Verified Emission'
    };
    
    return actionMap[action] || action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getActionBadgeColor = (action) => {
    if (action.includes('delete') || action.includes('rejected')) return 'bg-red-100 text-red-800';
    if (action.includes('create') || action.includes('added')) return 'bg-green-100 text-green-800';
    if (action.includes('update') || action.includes('verified')) return 'bg-blue-100 text-blue-800';
    if (action.includes('admin')) return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  const renderDashboard = () => {
    if (!adminData.dashboard) {
      return (
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No dashboard data available</p>
        </div>
      );
    }

    const { userStats, activityStats, emissionStats } = adminData.dashboard;

    return (
      <div className="space-y-6">
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
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderActivities = () => {
    if (!adminData.activities || adminData.activities.length === 0) {
      return (
        <div className="text-center py-12">
          <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">No activities found</p>
          <p className="text-sm text-gray-500">Activities will appear here once users start interacting with the system</p>
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
                {adminData.activities.map((activity) => (
                  <tr key={activity._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-medium">
                            {activity.user?.name?.charAt(0) || 'U'}
                          </span>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">{activity.user?.name || 'Unknown'}</div>
                          <div className="text-sm text-gray-500">{activity.user?.role || 'N/A'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getActionBadgeColor(activity.action)}`}>
                        {formatActionDisplay(activity.action)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" title={activity.details}>
                      {activity.details || 'No details'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-4 h-4" />
                        <span>{formatTimestamp(activity.createdAt)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
        </div>
      );
    }

    const { userStats, systemStats } = adminData.userSummary;

    return (
      <div className="space-y-6">
        {/* System Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <p className="text-sm font-medium text-gray-600">Total Users</p>
            <p className="text-2xl font-bold text-gray-900">{systemStats?.totalUsers || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <p className="text-sm font-medium text-gray-600">Total Activities</p>
            <p className="text-2xl font-bold text-gray-900">{systemStats?.totalActivities || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <p className="text-sm font-medium text-gray-600">Total Emissions</p>
            <p className="text-2xl font-bold text-gray-900">{systemStats?.totalEmissions || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <p className="text-sm font-medium text-gray-600">Recent Activities</p>
            <p className="text-2xl font-bold text-gray-900">{systemStats?.recentActivities || 0}</p>
          </div>
        </div>

        {/* User Stats Table */}
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase">Emissions Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase">Last Activity</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {userStats?.map((userStat, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-medium">
                            {userStat.user?.name?.charAt(0) || 'U'}
                          </span>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">{userStat.user?.name || 'Unknown'}</div>
                          <div className="text-sm text-gray-500">{userStat.user?.role || 'N/A'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                      {userStat.totalActivities || 0}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {userStat.emissionCount || 0}
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