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
import KpiCard from '../../components/ui/KpiCard';
import PanelHeader from '../../components/ui/PanelHeader';
import { SkeletonDashboard } from '../../components/ui/Skeleton';

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
      const isNetwork =
        error?.status === 'NETWORK_ERROR' ||
        error?.message?.includes('connect') ||
        error?.message?.includes('timed out');
      setError(
        isNetwork
          ? 'Cannot reach the API. Check your connection and that VITE_API_URL in frontend/.env points to your hosted backend (e.g. https://carbondesk.onrender.com/api).'
          : 'Failed to load dashboard data. Please try refreshing.'
      );
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
    return <SkeletonDashboard />;
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
        
        <div className="app-card p-12 text-center">
          <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-heading font-semibold text-gray-900 dark:text-white mb-2">No Data Available</h2>
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

  const roleBadgeClass =
    user?.role === 'admin'
      ? 'badge-role-admin'
      : user?.role === 'analyst'
        ? 'badge-role-analyst'
        : user?.role === 'contributor'
          ? 'badge-role-contributor'
          : 'badge bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700';

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title={`${getGreeting()}, ${user?.name?.split(' ')[0] || 'there'}`}
        subtitle={getRoleDescription(user?.role)}
        breadcrumb={[{ label: 'Home', href: '/dashboard' }, { label: 'Dashboard' }]}
        meta={
          <>
            {user?.organisation?.name && (
              <span className="badge bg-zinc-50 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">
                {user.organisation.name}
              </span>
            )}
            <span className={`${roleBadgeClass} capitalize`}>
              {user?.role || 'user'}
            </span>
            <span className="inline-flex items-center gap-1">
              <Database className="w-3.5 h-3.5" />
              {dashboardData.totalEntries} entries
            </span>
            {userActivityStats && (
              <span className="inline-flex items-center gap-1">
                <Activity className="w-3.5 h-3.5" />
                {userActivityStats.today} today · {userActivityStats.thisWeek} this week
              </span>
            )}
            <span>Updated {formatDateTime(lastUpdate)}</span>
          </>
        }
        action={
          <div className="flex items-center gap-2">
            {canViewAllData(user?.role) && (
              <button type="button" onClick={() => handleQuickAction('view_monitor')} className="btn-secondary">
                <Eye className="w-4 h-4" />
                <span>Monitor</span>
              </button>
            )}
            {isAdmin(user?.role) && (
              <button type="button" onClick={() => handleQuickAction('admin_panel')} className="btn-danger">
                <Shield className="w-4 h-4" />
                <span>Admin</span>
              </button>
            )}
            <button type="button" onClick={fetchDashboardData} className="icon-btn" aria-label="Refresh dashboard">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        }
      />

      {/* Admin Summary (Admin Only) */}
      {isAdmin(user?.role) && adminData && (
        <div className="app-card p-6 md:p-8">
          <PanelHeader
            title="Organisation pulse"
            description="Live activity across your tenant"
            action={
              <button
                type="button"
                onClick={() => handleQuickAction('admin_panel')}
                className="btn-ghost text-sm"
              >
                Admin panel →
              </button>
            }
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="Users"
              value={adminData.totalUsers || adminData.userStats?.total || 0}
              icon={Users}
            />
            <KpiCard
              label="Activities today"
              value={adminData.activityStats?.today || userActivityStats?.today || 0}
              icon={Activity}
            />
            <KpiCard
              label="Pending review"
              value={adminData.pendingReviews || adminData.emissionStats?.pending || 0}
              icon={Shield}
            />
            <KpiCard
              label="Total entries"
              value={adminData.emissionStats?.total || dashboardData.totalEntries}
              icon={Database}
            />
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

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Total entries"
          value={dashboardData.totalEntries}
          hint="Emission records"
          icon={Database}
        />
        <KpiCard
          label="Scope 1"
          value={dashboardData.scope1.count}
          hint={`${formatNumber(dashboardData.scope1.total)} tCO₂e`}
          scope={1}
        />
        <KpiCard
          label="Scope 2"
          value={dashboardData.scope2.count}
          hint={`${formatNumber(dashboardData.scope2.total)} tCO₂e`}
          scope={2}
        />
        <KpiCard
          label="Scope 3"
          value={dashboardData.scope3.count}
          hint={`${formatNumber(dashboardData.scope3.total)} tCO₂e`}
          scope={3}
        />
      </div>

      {/* Emission Scope Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
        {['scope1', 'scope2', 'scope3'].map((scope, index) => {
          const scopeData = dashboardData[scope];
          const scopeNumber = index + 1;
          const colors = COLORS[scope];
          const pieSlices = scopeData.topCategories.filter((c) => c.value > 0);

          return (
            <div key={scope} className="app-card app-card-interactive p-6 md:p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="panel-title">
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
      <div className="premium-glass-panel">
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-heading font-semibold text-gray-900 dark:text-white">Notifications</h2>
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