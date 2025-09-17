// pages/Admin/AdminMonitor.jsx - Admin monitoring dashboard
import { useState, useEffect } from 'react';
import { 
  Users, 
  Activity, 
  Eye, 
  Shield, 
  AlertTriangle, 
  Search, 
  Filter,
  Download,
  RefreshCw,
  Calendar,
  Clock,
  Globe
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { adminAPI } from '../../services/api';
import PageHeader from '../../components/PageHeader/PageHeader';
import toast from 'react-hot-toast';

const AdminMonitor = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [adminData, setAdminData] = useState({
    dashboard: null,
    activities: [],
    auditLogs: [],
    userSummary: null
  });
  const [filters, setFilters] = useState({
    timeframe: '7days',
    userId: 'all',
    action: 'all',
    severity: 'all'
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
    { id: 'audit', label: 'Audit Logs', icon: Shield, description: 'Security and compliance logs' },
    { id: 'users', label: 'User Summary', icon: Users, description: 'User activity summary and statistics' }
  ];

  useEffect(() => {
    loadData();
  }, [activeTab, filters, pagination.currentPage]);

  const loadData = async () => {
    if (user?.role !== 'admin') {
      toast.error('Admin access required');
      return;
    }

    try {
      setLoading(true);
      
      switch (activeTab) {
        case 'dashboard':
          await loadDashboard();
          break;
        case 'activities':
          await loadActivities();
          break;
        case 'audit':
          await loadAuditLogs();
          break;
        case 'users':
          await loadUserSummary();
          break;
      }
    } catch (error) {
      console.error('Load data error:', error);
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = async () => {
    const response = await adminAPI.getDashboard();
    setAdminData(prev => ({ ...prev, dashboard: response }));
  };

  const loadActivities = async () => {
    const response = await adminAPI.getAllActivities({
      page: pagination.currentPage,
      limit: pagination.itemsPerPage,
      userId: filters.userId !== 'all' ? filters.userId : undefined,
      action: filters.action !== 'all' ? filters.action : undefined,
      search: searchQuery
    });
    setAdminData(prev => ({ ...prev, activities: response.data }));
    setPagination(prev => ({ ...prev, ...response.pagination }));
  };

  const loadAuditLogs = async () => {
    const response = await adminAPI.getAuditLogs({
      page: pagination.currentPage,
      limit: pagination.itemsPerPage,
      userId: filters.userId !== 'all' ? filters.userId : undefined,
      action: filters.action !== 'all' ? filters.action : undefined,
      severity: filters.severity !== 'all' ? filters.severity : undefined
    });
    setAdminData(prev => ({ ...prev, auditLogs: response.data }));
    setPagination(prev => ({ ...prev, ...response.pagination }));
  };

  const loadUserSummary = async () => {
    const response = await adminAPI.getUserSummary({
      timeframe: filters.timeframe
    });
    setAdminData(prev => ({ ...prev, userSummary: response }));
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  const handleExport = async (type) => {
    try {
      const response = await adminAPI.exportLogs('xlsx');
      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `admin_${type}_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`${type} exported successfully`);
    } catch (error) {
      toast.error('Export failed');
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const getActionBadgeColor = (action) => {
    if (action.includes('delete')) return 'bg-red-100 text-red-800';
    if (action.includes('create')) return 'bg-green-100 text-green-800';
    if (action.includes('update')) return 'bg-blue-100 text-blue-800';
    if (action.includes('admin')) return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getSeverityBadgeColor = (severity) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const renderDashboard = () => {
    if (!adminData.dashboard) return <div>Loading dashboard...</div>;

    const { userStats, activityStats, emissionStats, topUsers, criticalActivities } = adminData.dashboard;

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
                <p className="text-2xl font-bold text-gray-900">{userStats.total}</p>
                <p className="text-sm text-green-600">+{userStats.newThisWeek} this week</p>
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
                <p className="text-2xl font-bold text-gray-900">{activityStats.today}</p>
                <p className="text-sm text-gray-600">{activityStats.thisWeek} this week</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Globe className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending Emissions</p>
                <p className="text-2xl font-bold text-gray-900">{emissionStats.pending}</p>
                <p className="text-sm text-gray-600">{emissionStats.verified} verified</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Critical Activities</p>
                <p className="text-2xl font-bold text-gray-900">{criticalActivities.length}</p>
                <p className="text-sm text-red-600">Last 24 hours</p>
              </div>
            </div>
          </div>
        </div>

        {/* Top Active Users */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Most Active Users (7 days)</h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {topUsers.map((userActivity, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {userActivity.user.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{userActivity.user.name}</p>
                        <p className="text-sm text-gray-500">{userActivity.user.role}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">{userActivity.activityCount}</p>
                      <p className="text-sm text-gray-500">activities</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Critical Activities */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Recent Critical Activities</h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {criticalActivities.slice(0, 5).map((activity, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{activity.actionDisplay}</p>
                      <p className="text-xs text-gray-500">{activity.user?.name} • {formatTimestamp(activity.createdAt)}</p>
                      <p className="text-xs text-gray-600 mt-1">{activity.details}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getSeverityBadgeColor(activity.severity)}`}>
                      {activity.severity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderActivities = () => {
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
                value={filters.action}
                onChange={(e) => handleFilterChange('action', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All Actions</option>
                <option value="login">Login/Logout</option>
                <option value="emission">Emissions</option>
                <option value="admin">Admin Actions</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleExport('activities')}
                className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
              
              <button
                onClick={loadData}
                className="flex items-center space-x-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh</span>
              </button>
            </div>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase">IP Address</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {adminData.activities.map((activity) => (
                  <tr key={activity._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-medium">
                            {activity.user.avatar}
                          </span>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">{activity.user.name}</div>
                          <div className="text-sm text-gray-500">{activity.user.role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getActionBadgeColor(activity.action)}`}>
                        {activity.actionDisplay}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {activity.details}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-4 h-4" />
                        <span>{formatTimestamp(activity.createdAt)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {activity.ipAddress}
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

  if (user?.role !== 'admin') {
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

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Admin Monitor"
        breadcrumb={[
          { label: 'App', href: '/' },
          { label: 'Admin Monitor' }
        ]}
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
              {activeTab === 'audit' && renderActivities()} {/* Similar to activities but filtered */}
              {activeTab === 'users' && renderDashboard()} {/* Will show user summary */}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminMonitor;