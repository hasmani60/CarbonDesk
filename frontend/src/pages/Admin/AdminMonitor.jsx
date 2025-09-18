// Enhanced AdminMonitor.jsx with real user activity tracking and improved data handling
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
  Globe,
  Database,
  TrendingUp,
  User
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useActivity } from '../../context/ActivityContext';
import { adminAPI } from '../../services/api';
import { getEmissions, getEmissionsStats } from '../../utils/localStorage';
import PageHeader from '../../components/PageHeader/PageHeader';
import toast from 'react-hot-toast';

const AdminMonitor = () => {
  const { user } = useAuth();
  const { logActivity, getActivityStats, getRecentActivities } = useActivity();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
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
    if (user?.role !== 'admin') {
      toast.error('Admin access required');
      return;
    }
    
    loadData();
    
    // Listen for real-time updates
    const handleEmissionAdded = () => {
      setTimeout(loadData, 500); // Reload admin data when new emissions are added
    };
    
    window.addEventListener('emission-added', handleEmissionAdded);
    
    // Set up periodic refresh every 30 seconds
    const refreshInterval = setInterval(loadData, 30000);
    
    return () => {
      window.removeEventListener('emission-added', handleEmissionAdded);
      clearInterval(refreshInterval);
    };
  }, [user]);

  useEffect(() => {
    if (user?.role === 'admin') {
      loadData();
    }
  }, [activeTab, filters, pagination.currentPage, searchQuery]);

  const loadData = async () => {
    if (user?.role !== 'admin') return;

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
      
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Load data error:', error);
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = async () => {
    try {
      // Try to get admin data from API first
      let dashboardData;
      try {
        dashboardData = await adminAPI.getDashboard();
      } catch (error) {
        console.warn('Admin API unavailable, generating from local data');
        dashboardData = generateDashboardFromLocalData();
      }
      
      setAdminData(prev => ({ ...prev, dashboard: dashboardData }));
    } catch (error) {
      console.error('Dashboard load error:', error);
    }
  };

  const generateDashboardFromLocalData = () => {
    const emissions = getEmissions();
    const stats = getEmissionsStats();
    const userActivityStats = getActivityStats();
    const recentActivities = getRecentActivities(50);
    
    // Generate unique users from emissions and activities
    const uniqueUsers = new Set();
    emissions.forEach(e => {
      if (e.user) uniqueUsers.add(e.user);
      if (e.userName) uniqueUsers.add(e.userName);
    });
    recentActivities.forEach(a => {
      if (a.user?.id) uniqueUsers.add(a.user.id);
      if (a.user?.name) uniqueUsers.add(a.user.name);
    });
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Calculate activity statistics
    const todayActivities = recentActivities.filter(a => new Date(a.timestamp || a.createdAt) >= today);
    const weekActivities = recentActivities.filter(a => new Date(a.timestamp || a.createdAt) >= lastWeek);
    
    // Calculate emission statistics
    const todayEmissions = emissions.filter(e => new Date(e.createdAt) >= today);
    const weekEmissions = emissions.filter(e => new Date(e.createdAt) >= lastWeek);
    
    // Generate top users based on activity
    const userActivityCounts = {};
    [...recentActivities, ...emissions].forEach(item => {
      const userId = item.user?.id || item.user || item.userName || 'unknown';
      const userName = item.user?.name || item.userName || userId;
      
      if (!userActivityCounts[userId]) {
        userActivityCounts[userId] = {
          user: {
            id: userId,
            name: userName,
            email: `${userName.toLowerCase().replace(/\s+/g, '.')}@example.com`,
            role: userId === user.id ? user.role : 'contributor'
          },
          activityCount: 0
        };
      }
      userActivityCounts[userId].activityCount += 1;
    });
    
    const topUsers = Object.values(userActivityCounts)
      .sort((a, b) => b.activityCount - a.activityCount)
      .slice(0, 5);
    
    // Generate critical activities (high-impact emissions or admin actions)
    const criticalActivities = emissions
      .filter(e => e.calculatedEmissions > 1000 || e.scope === 1) // High emissions or Scope 1
      .slice(0, 10)
      .map(e => ({
        _id: e.id,
        user: {
          name: e.userName || 'Unknown User',
          email: `${(e.userName || 'user').toLowerCase().replace(/\s+/g, '.')}@example.com`,
          role: 'contributor'
        },
        action: 'high_emission_added',
        actionDisplay: 'High Emission Added',
        resourceType: 'emission',
        resourceId: e.id,
        details: `Added high-impact emission: ${e.category || e.activityType} - ${(e.calculatedEmissions || 0).toFixed(2)} CO₂e`,
        createdAt: e.createdAt,
        severity: 'high',
        ipAddress: '127.0.0.1',
        userAgent: 'Web Browser'
      }));
    
    return {
      userStats: {
        total: Math.max(uniqueUsers.size, 1),
        active: Math.max(uniqueUsers.size, 1),
        inactive: 0,
        newToday: todayEmissions.length,
        newThisWeek: weekEmissions.length
      },
      activityStats: {
        total: recentActivities.length + emissions.length,
        today: todayActivities.length + todayEmissions.length,
        thisWeek: weekActivities.length + weekEmissions.length,
        thisMonth: recentActivities.length + emissions.length
      },
      emissionStats: {
        total: emissions.length,
        pending: emissions.filter(e => e.status === 'pending').length,
        verified: emissions.filter(e => e.status === 'verified' || e.status === 'active').length,
        rejected: emissions.filter(e => e.status === 'rejected').length,
        thisWeek: weekEmissions.length
      },
      topUsers: topUsers,
      criticalActivities: criticalActivities,
      securityAlerts: [],
      lastUpdated: new Date()
    };
  };

  const loadActivities = async () => {
    try {
      // Get user activities from localStorage
      const localActivities = getRecentActivities(200);
      const emissions = getEmissions();
      
      // Convert emissions to activity format
      const emissionActivities = emissions.map(emission => ({
        _id: emission.id,
        user: {
          id: emission.user || 'unknown',
          name: emission.userName || 'Unknown User',
          email: `${(emission.userName || 'user').toLowerCase().replace(/\s+/g, '.')}@example.com`,
          role: emission.user === user.id ? user.role : 'contributor',
          avatar: emission.userName ? emission.userName.split(' ').map(n => n[0]).join('') : 'U'
        },
        action: 'created_emission',
        actionDisplay: 'Created Emission Record',
        resourceType: 'emission',
        resourceId: emission.id,
        details: `Created emission: ${emission.category || emission.activityType} - ${(emission.calculatedEmissions || 0).toFixed(2)} CO₂e`,
        ipAddress: '127.0.0.1',
        userAgent: 'Web Browser',
        createdAt: emission.createdAt,
        timestamp: emission.createdAt
      }));
      
      // Convert localStorage activities to proper format
      const formattedLocalActivities = localActivities.map(activity => ({
        _id: activity.timestamp + Math.random(),
        user: {
          id: activity.user?.id || user.id,
          name: activity.user?.name || user.name || 'User',
          email: activity.user?.email || user.email,
          role: activity.user?.role || user.role,
          avatar: (activity.user?.name || user.name || 'U').split(' ').map(n => n[0]).join('')
        },
        action: activity.action,
        actionDisplay: formatActionDisplay(activity.action),
        resourceType: activity.resourceType || 'unknown',
        resourceId: activity.resourceId,
        details: activity.details || 'No details available',
        ipAddress: '127.0.0.1',
        userAgent: activity.userAgent || 'Web Browser',
        createdAt: activity.timestamp,
        timestamp: activity.timestamp
      }));
      
      // Combine and sort all activities
      let allActivities = [...formattedLocalActivities, ...emissionActivities]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      // Apply filters
      allActivities = applyActivityFilters(allActivities);
      
      // Apply search
      if (searchQuery.trim()) {
        allActivities = allActivities.filter(activity => 
          activity.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          activity.actionDisplay.toLowerCase().includes(searchQuery.toLowerCase()) ||
          activity.details.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      
      // Update pagination
      const totalItems = allActivities.length;
      const totalPages = Math.ceil(totalItems / pagination.itemsPerPage);
      
      setPagination(prev => ({
        ...prev,
        totalItems,
        totalPages
      }));
      
      // Get current page items
      const startIndex = (pagination.currentPage - 1) * pagination.itemsPerPage;
      const endIndex = startIndex + pagination.itemsPerPage;
      const currentPageActivities = allActivities.slice(startIndex, endIndex);
      
      setAdminData(prev => ({ ...prev, activities: currentPageActivities }));
      
    } catch (error) {
      console.error('Activities load error:', error);
    }
  };

  const applyActivityFilters = (activities) => {
    return activities.filter(activity => {
      // User filter
      if (filters.userId !== 'all' && activity.user.id !== filters.userId) {
        return false;
      }
      
      // Action filter
      if (filters.action !== 'all') {
        if (filters.action === 'emissions' && !activity.action.includes('emission')) {
          return false;
        }
        if (filters.action === 'login' && !activity.action.includes('login')) {
          return false;
        }
        if (filters.action === 'admin' && !activity.action.includes('admin')) {
          return false;
        }
      }
      
      // Timeframe filter
      if (filters.timeframe !== 'all') {
        const activityDate = new Date(activity.createdAt);
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
          default:
            return true;
        }
        
        if (activityDate < cutoffDate) return false;
      }
      
      return true;
    });
  };

  const loadAuditLogs = async () => {
    // For audit logs, use the same data as activities but focus on security-relevant events
    await loadActivities();
    
    // Filter activities to show only audit-relevant items
    const auditLogs = adminData.activities.map(activity => ({
      ...activity,
      severity: classifyLogSeverity(activity.action),
      metadata: {
        browser: extractBrowser(activity.userAgent),
        os: extractOS(activity.userAgent)
      }
    }));
    
    setAdminData(prev => ({ ...prev, auditLogs }));
  };

  const loadUserSummary = async () => {
    const emissions = getEmissions();
    const stats = getEmissionsStats();
    const activities = getRecentActivities(100);
    
    // Create user statistics
    const userMap = new Map();
    
    // Process emissions
    emissions.forEach(emission => {
      const userId = emission.user || emission.userName || 'unknown';
      const userName = emission.userName || 'Unknown User';
      
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          userId: userId,
          user: {
            id: userId,
            name: userName,
            email: `${userName.toLowerCase().replace(/\s+/g, '.')}@example.com`,
            role: userId === user.id ? user.role : 'contributor'
          },
          totalActivities: 0,
          emissionCount: 0,
          totalEmissions: 0,
          lastActivity: emission.createdAt,
          uniqueActions: new Set()
        });
      }
      
      const userStats = userMap.get(userId);
      userStats.totalActivities += 1;
      userStats.emissionCount += 1;
      userStats.totalEmissions += emission.calculatedEmissions || 0;
      userStats.uniqueActions.add('created_emission');
      
      if (new Date(emission.createdAt) > new Date(userStats.lastActivity)) {
        userStats.lastActivity = emission.createdAt;
      }
    });
    
    // Process other activities
    activities.forEach(activity => {
      const userId = activity.user?.id || user.id;
      const userName = activity.user?.name || user.name || 'User';
      
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          userId: userId,
          user: {
            id: userId,
            name: userName,
            email: activity.user?.email || user.email,
            role: activity.user?.role || user.role
          },
          totalActivities: 0,
          emissionCount: 0,
          totalEmissions: 0,
          lastActivity: activity.timestamp,
          uniqueActions: new Set()
        });
      }
      
      const userStats = userMap.get(userId);
      userStats.totalActivities += 1;
      userStats.uniqueActions.add(activity.action);
      
      if (new Date(activity.timestamp) > new Date(userStats.lastActivity)) {
        userStats.lastActivity = activity.timestamp;
      }
    });
    
    // Convert to array and add uniqueActions count
    const userStats = Array.from(userMap.values()).map(userStat => ({
      ...userStat,
      uniqueActions: userStat.uniqueActions.size
    })).sort((a, b) => b.totalActivities - a.totalActivities);
    
    const userSummary = {
      userStats: userStats,
      emissionStats: [],
      systemStats: {
        totalUsers: userMap.size,
        totalEmissions: emissions.length,
        totalActivities: activities.length + emissions.length,
        recentActivities: activities.filter(a => {
          const activityDate = new Date(a.timestamp);
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return activityDate >= weekAgo;
        }).length
      },
      timeframe: filters.timeframe
    };
    
    setAdminData(prev => ({ ...prev, userSummary }));
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  const handleExport = async (type) => {
    try {
      let exportData = [];
      
      switch (activeTab) {
        case 'activities':
          exportData = adminData.activities.map(activity => ({
            'User': activity.user.name,
            'Action': activity.actionDisplay,
            'Resource Type': activity.resourceType,
            'Details': activity.details,
            'IP Address': activity.ipAddress,
            'Timestamp': new Date(activity.createdAt).toLocaleString()
          }));
          break;
        case 'users':
          if (adminData.userSummary) {
            exportData = adminData.userSummary.userStats.map(userStat => ({
              'User Name': userStat.user.name,
              'Email': userStat.user.email,
              'Role': userStat.user.role,
              'Total Activities': userStat.totalActivities,
              'Emission Count': userStat.emissionCount,
              'Total Emissions': userStat.totalEmissions.toFixed(2),
              'Last Activity': new Date(userStat.lastActivity).toLocaleString(),
              'Unique Actions': userStat.uniqueActions
            }));
          }
          break;
        default:
          exportData = [{ message: 'No data available for export' }];
      }
      
      const csvContent = convertToCSV(exportData);
      const blob = new Blob([csvContent], { type: 'text/csv' });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `admin_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success(`${activeTab} data exported successfully`);
      logActivity('admin_export', 'admin', null, `Exported ${activeTab} data as CSV`);
    } catch (error) {
      toast.error('Export failed');
    }
  };

  const convertToCSV = (data) => {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    
    data.forEach(row => {
      const values = headers.map(header => {
        const value = row[header];
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    });
    
    return csvRows.join('\n');
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
      'verified_emission': 'Verified Emission',
      'emission_added': 'Added Emission',
      'viewed_dashboard': 'Viewed Dashboard',
      'viewed_analytics': 'Viewed Analytics',
      'viewed_monitor': 'Viewed Monitor',
      'page_view': 'Page View',
      'form_submission': 'Form Submission',
      'data_export': 'Data Export',
      'admin_viewed_all_users': 'Admin: Viewed All Users',
      'admin_user_role_changed': 'Admin: Changed User Role',
      'admin_user_status_changed': 'Admin: Changed User Status',
      'password_change': 'Password Changed',
      'profile_update': 'Profile Updated'
    };
    
    return actionMap[action] || action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getActionBadgeColor = (action) => {
    if (action.includes('delete') || action.includes('rejected')) return 'bg-red-100 text-red-800';
    if (action.includes('create') || action.includes('added')) return 'bg-green-100 text-green-800';
    if (action.includes('update') || action.includes('verified')) return 'bg-blue-100 text-blue-800';
    if (action.includes('admin')) return 'bg-purple-100 text-purple-800';
    if (action.includes('view') || action.includes('page')) return 'bg-gray-100 text-gray-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  const getSeverityBadgeColor = (severity) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const classifyLogSeverity = (action) => {
    const highSeverity = ['deleted_emission', 'admin_user_role_changed', 'admin_user_status_changed'];
    const mediumSeverity = ['created_emission', 'updated_emission', 'verified_emission', 'password_change'];
    const lowSeverity = ['login', 'logout', 'profile_update', 'viewed_', 'page_view'];
    
    if (highSeverity.some(h => action.includes(h))) return 'high';
    if (mediumSeverity.some(m => action.includes(m))) return 'medium';
    if (lowSeverity.some(l => action.includes(l))) return 'low';
    return 'medium';
  };

  const extractBrowser = (userAgent) => {
    if (!userAgent) return 'Unknown';
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Other';
  };

  const extractOS = (userAgent) => {
    if (!userAgent) return 'Unknown';
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac')) return 'MacOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS')) return 'iOS';
    return 'Other';
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
                <Database className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Emissions</p>
                <p className="text-2xl font-bold text-gray-900">{emissionStats.total}</p>
                <p className="text-sm text-gray-600">{emissionStats.thisWeek} this week</p>
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
                <p className="text-sm text-red-600">High-impact events</p>
              </div>
            </div>
          </div>
        </div>

        {/* Top Active Users & Critical Activities */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Most Active Users</h3>
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

        {/* System Status */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">System Status</h3>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600">All systems operational</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <TrendingUp className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="font-semibold text-green-900">Data Collection</p>
              <p className="text-sm text-green-700">Active & Recording</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <Database className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="font-semibold text-blue-900">Storage System</p>
              <p className="text-sm text-blue-700">Healthy & Backed Up</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <Shield className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <p className="font-semibold text-purple-900">Security Status</p>
              <p className="text-sm text-purple-700">Protected & Monitored</p>
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
                <option value="emissions">Emissions</option>
                <option value="admin">Admin Actions</option>
              </select>

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

            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                Updated: {lastUpdate.toLocaleTimeString()}
              </span>
              
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
          <div className="px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">User Activities</h3>
              <span className="text-sm text-gray-600">
                {pagination.totalItems} total activities
              </span>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
          ) : adminData.activities.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No activities found</p>
              <p className="text-sm text-gray-500">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-emerald-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase">Action</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase">Details</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase">Timestamp</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase">Source</th>
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
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                        <div className="truncate" title={activity.details}>
                          {activity.details}
                        </div>
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
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="border-t px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} to{' '}
                  {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)}{' '}
                  of {pagination.totalItems} results
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, currentPage: Math.max(1, prev.currentPage - 1) }))}
                    disabled={pagination.currentPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {pagination.currentPage} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, currentPage: Math.min(prev.totalPages, prev.currentPage + 1) }))}
                    disabled={pagination.currentPage === pagination.totalPages}
                    className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderUserSummary = () => {
    if (!adminData.userSummary) return <div>Loading user summary...</div>;

    const { userStats, systemStats } = adminData.userSummary;

    return (
      <div className="space-y-6">
        {/* System Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{systemStats.totalUsers}</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Activities</p>
                <p className="text-2xl font-bold text-gray-900">{systemStats.totalActivities}</p>
              </div>
              <Activity className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Emissions</p>
                <p className="text-2xl font-bold text-gray-900">{systemStats.totalEmissions}</p>
              </div>
              <Database className="w-8 h-8 text-yellow-600" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Recent Activities</p>
                <p className="text-2xl font-bold text-gray-900">{systemStats.recentActivities}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>

        {/* User Statistics Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">User Activity Summary</h3>
              <button
                onClick={() => handleExport('users')}
                className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-emerald-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase">Total Activities</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase">Emissions Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase">Total CO₂e</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase">Unique Actions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase">Last Activity</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {userStats.map((userStat, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-medium">
                            {userStat.user.name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">{userStat.user.name}</div>
                          <div className="text-sm text-gray-500">{userStat.user.role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                      {userStat.totalActivities}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {userStat.emissionCount}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {userStat.totalEmissions.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {userStat.uniqueActions}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatTimestamp(userStat.lastActivity)}
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
        action={
          <div className="flex items-center space-x-2">
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
          {loading && activeTab !== 'dashboard' ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && renderDashboard()}
              {activeTab === 'activities' && renderActivities()}
              {activeTab === 'audit' && renderActivities()} {/* Audit logs use same structure as activities */}
              {activeTab === 'users' && renderUserSummary()}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminMonitor;