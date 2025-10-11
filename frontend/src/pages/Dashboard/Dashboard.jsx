// Dashboard.jsx - Organization-Filtered Dashboard with Real Data Only
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { RefreshCw, Plus, BarChart3, Filter, Users, Activity, Shield, Eye, Database, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useActivity } from '../../context/ActivityContext';
import { dashboardAPI, adminAPI, isAdmin, canViewAllData } from '../../services/api';
import { getEmissions, getEmissionsStats, getTotalEmissions } from '../../utils/localStorage';
import PageHeader from '../../components/PageHeader/PageHeader';
import NotificationCard from '../../components/NotificationCard/NotificationCard';

const Dashboard = () => {
  const { user } = useAuth();
  const { notifications } = useNotifications();
  const { logPageView, logActivity, getActivityStats, getActivitySummaryForAdmin } = useActivity();
  const [dashboardData, setDashboardData] = React.useState({
    scope1: { total: 0, percentage: 0, topCategories: [], count: 0 },
    scope2: { total: 0, percentage: 0, topCategories: [], count: 0 },
    scope3: { total: 0, percentage: 0, topCategories: [], count: 0 },
    totalEmissions: 0,
    totalEntries: 0
  });
  const [adminData, setAdminData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [userActivityStats, setUserActivityStats] = React.useState(null);
  const [lastUpdate, setLastUpdate] = React.useState(new Date());

  // Colors for each scope's pie chart
  const COLORS = {
    scope1: ['#065f46', '#047857', '#059669'],
    scope2: ['#1e40af', '#1d4ed8', '#2563eb'],
    scope3: ['#7c2d12', '#dc2626', '#ef4444']
  };

  React.useEffect(() => {
    logPageView('Dashboard');
    fetchDashboardData();
    loadUserActivityStats();
    
    // Listen for real-time updates when emissions are added
    const handleEmissionAdded = () => {
      setTimeout(fetchDashboardData, 500);
    };
    
    window.addEventListener('emission-added', handleEmissionAdded);
    
    // Set up periodic refresh every 5 minutes
    const refreshInterval = setInterval(fetchDashboardData, 5 * 60 * 1000);
    
    return () => {
      window.removeEventListener('emission-added', handleEmissionAdded);
      clearInterval(refreshInterval);
    };
  }, []);

  // Helper function to log dashboard interactions
  const logDashboardInteraction = (action, details) => {
    logActivity(`dashboard_${action}`, 'dashboard', null, details, {
      dashboardSection: action,
      interactionDetails: details
    });
  };

  const loadUserActivityStats = () => {
    try {
      const stats = getActivityStats();
      setUserActivityStats(stats);
    } catch (error) {
      console.error('Error loading activity stats:', error);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 Fetching dashboard data for organisation:', user?.organisation_id);
      
      // Load user's emission data (already filtered by organisation)
      const allEmissions = getEmissions();
      const stats = getEmissionsStats();
      
      if (allEmissions.length === 0) {
        console.log('⚠️ No emissions found for current organisation');
      }
      
      const processedData = processDashboardData(stats, allEmissions);
      setDashboardData(processedData);
      setLastUpdate(new Date());

      // Load admin data if user is admin
      if (isAdmin(user?.role)) {
        try {
          const adminDashboard = await adminAPI.getDashboard();
          setAdminData(adminDashboard);
          console.log('✅ Admin dashboard data loaded from API');
        } catch (error) {
          console.warn('⚠️ Admin dashboard API unavailable, using local data:', error.message);
          
          // FALLBACK: Use local data from ActivityContext
          const activitySummary = getActivitySummaryForAdmin();
          
          const localAdminData = {
            userStats: {
              total: activitySummary.uniqueUsers || 0,
              active: activitySummary.uniqueUsers || 0
            },
            activityStats: {
              today: activitySummary.recentActivities || userActivityStats?.today || 0,
              thisWeek: activitySummary.weeklyActivities || userActivityStats?.thisWeek || 0
            },
            emissionStats: {
              total: processedData.totalEntries,
              pending: 0, // Can't determine from localStorage
              approved: processedData.totalEntries
            }
          };
          
          setAdminData(localAdminData);
          console.log('✅ Admin dashboard data loaded from localStorage:', localAdminData);
        }
      }
      
    } catch (error) {
      console.error('❌ Error fetching dashboard data:', error);
      setError('Failed to load dashboard data. Please try refreshing.');
    } finally {
      setLoading(false);
    }
  };

  const processDashboardData = (stats, emissions) => {
    const totalEmissions = stats.scope1.total + stats.scope2.total + stats.scope3.total;
    const totalEntries = emissions.length;
    
    console.log('📊 Processing dashboard data:', {
      totalEntries,
      totalEmissions: totalEmissions.toFixed(2),
      scope1Count: emissions.filter(e => e.scope === 1).length,
      scope2Count: emissions.filter(e => e.scope === 2).length,
      scope3Count: emissions.filter(e => e.scope === 3).length
    });
    
    const processScope = (scopeData, scopeTotal, scopeNumber) => {
      const scopeEntries = emissions.filter(e => e.scope === scopeNumber).length;
      
      const topCategories = Object.entries(scopeData.activities)
        .map(([name, data]) => ({
          name: name.length > 25 ? name.substring(0, 25) + '...' : name,
          fullName: name,
          value: data.total,
          percentage: scopeTotal > 0 ? (data.total / scopeTotal) * 100 : 0,
          count: data.count
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);

      // Fill empty slots to ensure we always have 3 categories for display
      while (topCategories.length < 3) {
        topCategories.push({
          name: 'No Data',
          fullName: 'No Data Available',
          value: 0,
          percentage: 0,
          count: 0
        });
      }

      return {
        total: scopeTotal,
        percentage: totalEmissions > 0 ? (scopeTotal / totalEmissions) * 100 : 0,
        topCategories,
        count: scopeEntries
      };
    };

    return {
      scope1: processScope(stats.scope1, stats.scope1.total, 1),
      scope2: processScope(stats.scope2, stats.scope2.total, 2),
      scope3: processScope(stats.scope3, stats.scope3.total, 3),
      totalEmissions,
      totalEntries
    };
  };

  const formatNumber = (value) => {
    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
    if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
    return value.toFixed(1);
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900">{data.payload.fullName}</p>
          <p style={{ color: data.color }}>
            Value: {formatNumber(data.value)} CO₂e
          </p>
          <p style={{ color: data.color }}>
            Percentage: {data.payload.percentage.toFixed(1)}%
          </p>
          <p className="text-gray-600 text-sm">
            Entries: {data.payload.count}
          </p>
        </div>
      );
    }
    return null;
  };

  const handleGenerateInsight = (scope) => {
    logDashboardInteraction('generate_insight', `Scope ${scope}`);
    window.location.href = `/analytics?scope=${scope}`;
  };

  const handleQuickAction = (action) => {
    logDashboardInteraction('quick_action', action);
    switch (action) {
      case 'add_emission':
        window.location.href = '/input';
        break;
      case 'view_monitor':
        window.location.href = '/monitor';
        break;
      case 'admin_panel':
        window.location.href = '/admin/monitor';
        break;
      default:
        console.log('Unknown quick action:', action);
    }
  };

  const getRoleDescription = (role) => {
    const descriptions = {
      admin: "Full system access with user management and monitoring capabilities.",
      analyst: "Advanced data analysis and reporting access across all user data.",
      contributor: "Create and manage your own emission records and view analytics.",
      viewer: "View emission data and analytics in read-only mode."
    };
    return descriptions[role] || "Welcome to the Carbon Accounting platform.";
  };

  const getRoleBadgeColor = (role) => {
    const colors = {
      admin: 'bg-red-100 text-red-800',
      analyst: 'bg-blue-100 text-blue-800',
      contributor: 'bg-green-100 text-green-800',
      viewer: 'bg-gray-100 text-gray-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const getScopeDescription = (scopeNumber) => {
    const descriptions = {
      1: "Direct emissions from owned or controlled sources like fuel combustion and company vehicles.",
      2: "Indirect emissions from purchased electricity, steam, heating, and cooling.",
      3: "All other indirect emissions from business travel, employee commuting, and supply chain."
    };
    return descriptions[scopeNumber];
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Show empty state if no data
  if (dashboardData.totalEntries === 0) {
    return (
      <div className="space-y-6">
        <PageHeader 
          title="Dashboard"
          breadcrumb={[{ label: 'App', href: '/' }, { label: 'Dashboard' }]}
        />
        
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">No Data Available</h2>
          <p className="text-gray-600 mb-6">
            Your organisation doesn't have any emission data yet.
            {user?.organisation?.name && (
              <span className="block mt-2 text-sm">
                Organisation: <strong>{user.organisation.name}</strong>
              </span>
            )}
          </p>
          <button
            onClick={() => window.location.href = '/input'}
            className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 inline-flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Add Your First Emission</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header with Role-based Content */}
      <div className="bg-gradient-to-r from-green-100 to-emerald-50 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2 flex items-center space-x-2">
              <span>{getGreeting()}, {user?.name || 'User'} 👋</span>
              {isAdmin(user?.role) && <Shield className="w-5 h-5 text-red-500" />}
            </h1>
            <p className="text-gray-600 mb-2">
              {getRoleDescription(user?.role)}
            </p>
            {user?.organisation?.name && (
              <p className="text-sm text-emerald-700 font-medium mb-2">
                Organisation: {user.organisation.name}
              </p>
            )}
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <span className="flex items-center space-x-1">
                <Database className="w-4 h-4" />
                <span>{dashboardData.totalEntries} total entries</span>
              </span>
              {userActivityStats && (
                <>
                  <span className="flex items-center space-x-1">
                    <Activity className="w-4 h-4" />
                    <span>{userActivityStats.today} activities today</span>
                  </span>
                  <span>{userActivityStats.thisWeek} this week</span>
                </>
              )}
              <span className="text-xs">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </span>
            </div>
          </div>
          <div className="hidden md:flex items-center space-x-4">
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleBadgeColor(user?.role)}`}>
              {user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}
            </div>
            <div className="w-32 h-32 bg-green-200 rounded-full flex items-center justify-center">
              <svg className="w-20 h-20 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Page Header */}
      <PageHeader 
        title="Dashboard"
        breadcrumb={[{ label: 'App', href: '/' }, { label: 'Dashboard' }]}
        action={
          <div className="flex items-center space-x-3">
            {canViewAllData(user?.role) && (
              <button 
                onClick={() => handleQuickAction('view_monitor')}
                className="flex items-center space-x-2 px-3 py-2 text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-50"
              >
                <Eye className="w-4 h-4" />
                <span>Monitor</span>
              </button>
            )}
            {isAdmin(user?.role) && (
              <button 
                onClick={() => handleQuickAction('admin_panel')}
                className="flex items-center space-x-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <Shield className="w-4 h-4" />
                <span>Admin</span>
              </button>
            )}
            <button 
              onClick={fetchDashboardData}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-lg"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        }
      />

      {/* Admin Summary (Admin Only) */}
      {isAdmin(user?.role) && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <Shield className="w-5 h-5 text-red-500" />
              <span>System Overview</span>
            </h2>
            <button 
              onClick={() => handleQuickAction('admin_panel')}
              className="text-red-600 hover:text-red-700 text-sm font-medium"
            >
              View Details →
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {adminData?.userStats?.total || adminData?.totalUsers || 0}
              </p>
              <p className="text-sm text-gray-600">Total Users</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {adminData?.activityStats?.today || userActivityStats?.today || 0}
              </p>
              <p className="text-sm text-gray-600">Activities Today</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {adminData?.emissionStats?.pending || adminData?.pendingReviews || 0}
              </p>
              <p className="text-sm text-gray-600">Pending Reviews</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">
                {adminData?.emissionStats?.total || dashboardData.totalEntries}
              </p>
              <p className="text-sm text-gray-600">Total Entries</p>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Entries</p>
              <p className="text-2xl font-bold text-gray-900">
                {dashboardData.totalEntries}
              </p>
              <p className="text-xs text-gray-500 mt-1">Emission records</p>
            </div>
            <div className="p-2 bg-gray-100 rounded-lg">
              <Database className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Scope 1 Entries</p>
              <p className="text-2xl font-bold text-gray-900">
                {dashboardData.scope1.count}
              </p>
              <p className="text-xs text-emerald-600 mt-1">{formatNumber(dashboardData.scope1.total)} CO₂e</p>
            </div>
            <div className="p-2 bg-emerald-100 rounded-lg">
              <div className="w-6 h-6 bg-emerald-600 rounded flex items-center justify-center">
                <span className="text-white text-sm font-bold">1</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Scope 2 Entries</p>
              <p className="text-2xl font-bold text-gray-900">
                {dashboardData.scope2.count}
              </p>
              <p className="text-xs text-blue-600 mt-1">{formatNumber(dashboardData.scope2.total)} CO₂e</p>
            </div>
            <div className="p-2 bg-blue-100 rounded-lg">
              <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
                <span className="text-white text-sm font-bold">2</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Scope 3 Entries</p>
              <p className="text-2xl font-bold text-gray-900">
                {dashboardData.scope3.count}
              </p>
              <p className="text-xs text-red-600 mt-1">{formatNumber(dashboardData.scope3.total)} CO₂e</p>
            </div>
            <div className="p-2 bg-red-100 rounded-lg">
              <div className="w-6 h-6 bg-red-600 rounded flex items-center justify-center">
                <span className="text-white text-sm font-bold">3</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Emission Scope Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {['scope1', 'scope2', 'scope3'].map((scope, index) => {
          const scopeData = dashboardData[scope];
          const scopeNumber = index + 1;
          const colors = COLORS[scope];
          
          return (
            <div key={scope} className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Scope {scopeNumber} Entries
                </h3>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">{scopeData.count} entries</span>
                  <div className="flex space-x-2">
                    {(user?.role === 'admin' || user?.role === 'analyst' || user?.role === 'contributor') && (
                      <button 
                        onClick={() => handleQuickAction('add_emission')}
                        className="text-emerald-600 text-sm font-medium hover:text-emerald-700"
                      >
                        Add
                      </button>
                    )}
                    {canViewAllData(user?.role) && (
                      <button 
                        onClick={() => handleQuickAction('view_monitor')}
                        className="text-emerald-600 text-sm font-medium hover:text-emerald-700"
                      >
                        View
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Pie Chart */}
              <div className="h-48 mb-4 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={scopeData.topCategories}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {scopeData.topCategories.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={colors[idx]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Total in center */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">
                      {formatNumber(scopeData.total)}
                    </div>
                    <div className="text-xs text-gray-600">CO₂e</div>
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="space-y-1 mb-4">
                {scopeData.topCategories.map((category, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-full mr-2" 
                        style={{ backgroundColor: colors[idx] }}
                      ></div>
                      <span className="text-gray-700 max-w-[120px] truncate" title={category.fullName}>
                        {category.name}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-600">
                        {category.percentage.toFixed(1)}%
                      </span>
                      <span className="text-gray-500">
                        ({category.count})
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Description */}
              <p className="text-sm text-gray-600 mb-4 text-center">
                {getScopeDescription(scopeNumber)}
              </p>

              {/* Generate Insight Button */}
              <button 
                onClick={() => handleGenerateInsight(scopeNumber)}
                className="w-full bg-emerald-600 text-white py-2 px-4 rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center space-x-2"
              >
                <BarChart3 className="w-4 h-4" />
                <span>Generate Insight</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Notifications Section */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
            <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded-full">
              {notifications?.length || 0}
            </span>
          </div>
          <button 
            onClick={() => logDashboardInteraction('filter', 'notifications')}
            className="flex items-center space-x-2 text-gray-500 hover:text-gray-700"
          >
            <Filter className="w-4 h-4" />
            <span>Filter</span>
          </button>
        </div>
        
        <div className="p-6">
          {notifications && notifications.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {notifications.slice(0, 8).map((notification, index) => (
                <NotificationCard key={notification._id || index} notification={notification} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-2">No notifications</div>
              <p className="text-sm text-gray-500">You're all caught up!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;