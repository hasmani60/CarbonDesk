// Dashboard.jsx - Organization-Filtered Dashboard with MongoDB Backend + Original UI
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { RefreshCw, Plus, BarChart3, Filter, Users, Activity, Shield, Eye, Database, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatDateTime } from '../../utils/formatters';
import { useNotifications } from '../../context/NotificationContext';
import { useActivity } from '../../context/ActivityContext';
import { dashboardAPI, adminAPI, isAdmin, canViewAllData } from '../../services/api';
import PageHeader from '../../components/PageHeader/PageHeader';
import NotificationCard from '../../components/NotificationCard/NotificationCard';
import TaskWidget from '../../components/TaskWidget/TaskWidget';

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
    
    const refreshInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      fetchDashboardData();
    }, 5 * 60 * 1000);
    
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
      
      console.log('📊 Fetching dashboard data from MongoDB for organisation:', user?.organisation_id);
      
      // Fetch from MongoDB backend
      const summary = await dashboardAPI.getSummary();
      
      console.log('✅ Dashboard data received from MongoDB:', summary);
      
      // Transform MongoDB response to match original localStorage format
      const processedData = transformMongoDBData(summary);
      setDashboardData(processedData);
      setLastUpdate(new Date());

      // Load admin data if user is admin
      if (isAdmin(user?.role)) {
        try {
          console.log('📊 Loading admin data for organisation:', user?.organisation_id);
          
          // Get organisation-specific users from backend
          const usersResponse = await adminAPI.getAllUsers({ limit: 1000 });
          const usersData = usersResponse.data || usersResponse || [];
          const totalUsersInOrg = usersData.length;
          const activeUsersInOrg = usersData.filter(u => u.status === 'active').length;
          
          console.log('👥 Users in organisation:', totalUsersInOrg);
          
          // Get activity summary
          const activitySummary = getActivitySummaryForAdmin();
          
          // Build organisation-scoped admin data
          const organisationAdminData = {
            userStats: {
              total: summary.user_stats?.total_users || totalUsersInOrg,
              active: summary.user_stats?.active_users || activeUsersInOrg,
              inactive: (summary.user_stats?.total_users || totalUsersInOrg) - (summary.user_stats?.active_users || activeUsersInOrg)
            },
            activityStats: {
              today: activitySummary.recentActivities || userActivityStats?.today || 0,
              thisWeek: activitySummary.weeklyActivities || userActivityStats?.thisWeek || 0,
              total: activitySummary.totalActivities || 0
            },
            emissionStats: {
              total: processedData.totalEntries,
              pending: summary.overview?.draft_count || 0,
              approved: summary.overview?.verified_count || 0,
              thisWeek: (summary.recent_emissions || []).filter(e => {
                const emissionDate = new Date(e.created_at || e.date);
                const thisWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                return emissionDate >= thisWeek;
              }).length
            },
            totalUsers: summary.user_stats?.total_users || totalUsersInOrg,
            pendingReviews: summary.overview?.draft_count || 0
          };
          
          setAdminData(organisationAdminData);
          console.log('✅ Admin dashboard data loaded:', organisationAdminData);
          
        } catch (error) {
          console.warn('⚠️ Admin dashboard API unavailable:', error.message);
          
          // FALLBACK: Use activity summary from context
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
              pending: 0,
              approved: processedData.totalEntries
            }
          };
          
          setAdminData(localAdminData);
        }
      }
      
    } catch (error) {
      console.error('❌ Error fetching dashboard data:', error);
      setError('Failed to load dashboard data. Please try refreshing.');
    } finally {
      setLoading(false);
    }
  };

  // Transform MongoDB response to original dashboard data format
  const transformMongoDBData = (summary) => {
    const totalEmissions = summary.overview?.total_emissions || 0;
    const totalEntries = summary.overview?.total_count || 0;
    
    console.log('📊 Transforming MongoDB data:', {
      totalEntries,
      totalEmissions: totalEmissions.toFixed(2),
      scope1: summary.by_scope?.scope_1,
      scope2: summary.by_scope?.scope_2,
      scope3: summary.by_scope?.scope_3
    });
    
    const processScope = (scopeData, scopeNumber) => {
      const scopeTotal = scopeData?.total_co2e || 0;
      const scopeCount = scopeData?.count || 0;
      const scopeKey = `scope_${scopeNumber}`;

      const normScope = (s) => {
        if (s == null || s === '') return null;
        const n = Number(s);
        return Number.isFinite(n) ? n : null;
      };

      const fromPerScope = summary.top_activities_by_scope?.[scopeKey];
      let scopeActivities = Array.isArray(fromPerScope) && fromPerScope.length
        ? fromPerScope.slice(0, 3)
        : (summary.top_activities || [])
            .filter(a => normScope(a.scope) === scopeNumber)
            .slice(0, 3);

      let topCategories = scopeActivities.map(activity => {
        const label = activity.activity || 'Activity';
        return {
          name: label.length > 25 ? label.substring(0, 25) + '...' : label,
          fullName: label,
          value: activity.total_co2e,
          percentage: scopeTotal > 0 ? (activity.total_co2e / scopeTotal) * 100 : 0,
          count: activity.count
        };
      });

      if (topCategories.length === 0 && scopeTotal > 0) {
        topCategories = [
          {
            name: scopeCount === 1 ? 'Emissions' : 'All activities',
            fullName: `All Scope ${scopeNumber} emissions`,
            value: scopeTotal,
            percentage: 100,
            count: scopeCount
          }
        ];
      }

      if (scopeTotal === 0) {
        while (topCategories.length < 3) {
          topCategories.push({
            name: 'No Data',
            fullName: 'No Data Available',
            value: 0,
            percentage: 0,
            count: 0
          });
        }
      }

      return {
        total: scopeTotal,
        percentage: totalEmissions > 0 ? (scopeTotal / totalEmissions) * 100 : 0,
        topCategories,
        count: scopeCount
      };
    };

    return {
      scope1: processScope(summary.by_scope?.scope_1, 1),
      scope2: processScope(summary.by_scope?.scope_2, 2),
      scope3: processScope(summary.by_scope?.scope_3, 3),
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
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900 dark:text-white">{data.payload.fullName}</p>
          <p style={{ color: data.color }}>
            Value: {formatNumber(data.value)} CO₂e
          </p>
          <p style={{ color: data.color }}>
            Percentage: {data.payload.percentage.toFixed(1)}%
          </p>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
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
      admin: 'bg-red-100 dark:bg-red-900/50 text-red-800',
      analyst: 'bg-blue-100 dark:bg-blue-900/50 text-blue-800',
      contributor: 'bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-300',
      viewer: 'bg-gray-100 dark:bg-gray-700 text-gray-800'
    };
    return colors[role] || 'bg-gray-100 dark:bg-gray-700 text-gray-800';
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
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
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
        
        <div className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-xl motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-xl transition-all duration-300 motion-reduce:hover:translate-y-0 shadow-glass dark:shadow-glass-dark rounded-2xl border border-white/20 dark:border-slate-700/50 p-12 text-center">
          <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">No Data Available</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
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
      <div className="bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-700 dark:from-emerald-900 dark:via-teal-900 dark:to-slate-900 rounded-3xl p-8 shadow-teal-lg dark:shadow-glass-dark border border-white/20 dark:border-slate-700 relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white/10 blur-3xl mix-blend-overlay pointer-events-none"></div>
        <div className="absolute bottom-0 right-32 -mb-16 w-48 h-48 rounded-full bg-teal-300/20 blur-2xl mix-blend-overlay pointer-events-none"></div>
        
        <div className="flex items-center justify-between relative z-10">
          <div>
            <h1 className="text-3xl font-extrabold text-white mb-2 drop-shadow-md">
              {getGreeting()}, {user?.name || 'User'} 👋
            </h1>
            <p className="text-emerald-50 text-lg font-medium mb-3 opacity-90">
              {getRoleDescription(user?.role)}
            </p>
            {user?.organisation?.name && (
              <p className="text-sm text-emerald-100 font-semibold mb-3 flex items-center bg-black/10 w-fit px-3 py-1 rounded-full backdrop-blur-sm border border-white/10">
                <span className="w-2 h-2 rounded-full bg-green-400 mr-2 animate-pulse"></span>
                {user.organisation.name}
              </p>
            )}
            <div className="flex items-center space-x-4 text-sm text-emerald-50 font-medium">
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
                Last updated: {formatDateTime(lastUpdate)}
              </span>
            </div>
          </div>
          <div className="hidden md:flex items-center space-x-4">
            <div className={`px-4 py-1.5 rounded-full text-sm font-bold shadow-sm border border-white/20 backdrop-blur-md ${
              user?.role === 'admin' ? 'bg-red-500/20 text-red-50' :
              user?.role === 'analyst' ? 'bg-blue-500/20 text-blue-50' :
              user?.role === 'contributor' ? 'bg-emerald-400/20 text-emerald-50' :
              'bg-white/20 text-white'
            }`}>
              {user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}
            </div>
            <div className="w-32 h-32 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.1)]">
              <svg className="w-16 h-16 text-white drop-shadow-md" fill="currentColor" viewBox="0 0 24 24">
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
      {isAdmin(user?.role) && adminData && (
        <div className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-xl motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-xl transition-all duration-300 motion-reduce:hover:translate-y-0 shadow-glass dark:shadow-glass-dark rounded-2xl border border-white/20 dark:border-slate-700/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
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
                {adminData.totalUsers || adminData.userStats?.total || 0}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Users</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {adminData.activityStats?.today || userActivityStats?.today || 0}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Activities Today</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {adminData.pendingReviews || adminData.emissionStats?.pending || 0}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Pending Reviews</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">
                {adminData.emissionStats?.total || dashboardData.totalEntries}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Entries</p>
            </div>
          </div>
        </div>
      )}

      {/* Task Widget for Contributors and Analysts */}
      {['contributor', 'analyst'].includes(user?.role) && (
        <TaskWidget 
          maxTasks={5}
          showQuickActions={true}
          className="mb-6"
        />
      )}

      {/* Key Metrics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-xl motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-xl transition-all duration-300 motion-reduce:hover:translate-y-0 shadow-glass dark:shadow-glass-dark rounded-2xl border border-white/20 dark:border-slate-700/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Entries</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {dashboardData.totalEntries}
              </p>
              <p className="text-xs text-gray-500 mt-1">Emission records</p>
            </div>
            <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <Database className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </div>
          </div>
        </div>

        <div className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-xl motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-xl transition-all duration-300 motion-reduce:hover:translate-y-0 shadow-glass dark:shadow-glass-dark rounded-2xl border border-white/20 dark:border-slate-700/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Scope 1 Entries</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {dashboardData.scope1.count}
              </p>
              <p className="text-xs text-emerald-600 mt-1">{formatNumber(dashboardData.scope1.total)} CO₂e</p>
            </div>
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
              <div className="w-6 h-6 bg-emerald-600 rounded flex items-center justify-center">
                <span className="text-white text-sm font-bold">1</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-xl motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-xl transition-all duration-300 motion-reduce:hover:translate-y-0 shadow-glass dark:shadow-glass-dark rounded-2xl border border-white/20 dark:border-slate-700/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Scope 2 Entries</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {dashboardData.scope2.count}
              </p>
              <p className="text-xs text-blue-600 mt-1">{formatNumber(dashboardData.scope2.total)} CO₂e</p>
            </div>
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
                <span className="text-white text-sm font-bold">2</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-xl motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-xl transition-all duration-300 motion-reduce:hover:translate-y-0 shadow-glass dark:shadow-glass-dark rounded-2xl border border-white/20 dark:border-slate-700/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Scope 3 Entries</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {dashboardData.scope3.count}
              </p>
              <p className="text-xs text-red-600 mt-1">{formatNumber(dashboardData.scope3.total)} CO₂e</p>
            </div>
            <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg">
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
          const pieSlices = scopeData.topCategories.filter((c) => c.value > 0);

          return (
            <div key={scope} className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-xl motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-xl transition-all duration-300 motion-reduce:hover:translate-y-0 shadow-glass dark:shadow-glass-dark rounded-2xl border border-white/20 dark:border-slate-700/50 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Scope {scopeNumber} Entries
                </h3>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{scopeData.count} entries</span>
                  <div className="flex space-x-2">
                    {(user?.role === 'admin' || user?.role === 'analyst' || user?.role === 'contributor') && (
                      <button 
                        onClick={() => handleQuickAction('add_emission')}
                        className="text-emerald-600 text-sm font-medium hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                      >
                        Add
                      </button>
                    )}
                    {canViewAllData(user?.role) && (
                      <button 
                        onClick={() => handleQuickAction('view_monitor')}
                        className="text-emerald-600 text-sm font-medium hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                      >
                        View
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Pie Chart */}
              <div className="h-48 min-h-[192px] mb-4 relative w-full">
                {pieSlices.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minHeight={192}>
                    <PieChart>
                      <Pie
                        data={pieSlices}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={pieSlices.length > 1 ? 2 : 0}
                        dataKey="value"
                      >
                        {pieSlices.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={colors[idx % colors.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full min-h-[192px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 text-sm text-gray-500 dark:border-slate-600 dark:bg-slate-800/50 dark:text-gray-400">
                    No emissions in this scope
                  </div>
                )}
                {/* Total in center */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900 dark:text-white">
                      {formatNumber(scopeData.total)}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">CO₂e</div>
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
                      <span className="text-gray-800 dark:text-gray-200 max-w-[120px] truncate" title={category.fullName}>
                        {category.name}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-600 dark:text-gray-400">
                        {category.percentage.toFixed(1)}%
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">
                        ({category.count})
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Description */}
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 text-center">
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
      <div className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-xl motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-xl transition-all duration-300 motion-reduce:hover:translate-y-0 shadow-glass dark:shadow-glass-dark rounded-2xl border border-white/20 dark:border-slate-700/50">
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Notifications</h2>
            <span className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 text-xs px-2 py-1 rounded-full">
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