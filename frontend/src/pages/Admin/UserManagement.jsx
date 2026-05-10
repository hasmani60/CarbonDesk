// pages/Admin/UserManagement.jsx - Updated with Real Backend Data for Stats
import { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  UserPlus,
  Edit3,
  Trash2,
  XCircle,
  Crown,
  Shield,
  Eye,
  FileText,
  BarChart3,
  RefreshCw,
  Download,
  Settings,
  Lock,
  Activity,
  Database,
  AlertCircle,
  TrendingUp,
  ExternalLink,
  Info,
  Plus,
  Minus,
  Target,
  List,
  Check,
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useActivity } from '../../context/ActivityContext';
import { adminAPI } from '../../services/api';
import { emissionFactors } from '../../data/complete_emission_factors_db';
import PageHeader from '../../components/PageHeader/PageHeader';
import toast from 'react-hot-toast';

const UserManagement = () => {
  const { user, isAdmin } = useAuth();
  const { getRecentActivities, getActivitySummaryForAdmin } = useActivity();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showActivitiesModal, setShowActivitiesModal] = useState(false);
  const [selectedUserActivities, setSelectedUserActivities] = useState([]);
  const [userStats, setUserStats] = useState(null);
  const [rbacOptions, setRBACOptions] = useState(null);
  const [activitySummary, setActivitySummary] = useState(null);
  const [recentActivities, setRecentActivities] = useState([]);
  
  const [dashboardStats, setDashboardStats] = useState({
    totalUsers: 0,
    totalActivities: 0,
    recentActivities: 0,
    criticalActivities: 0,
    loading: true
  });
  
  const [filters, setFilters] = useState({
    role: 'all',
    status: 'all',
    activity: 'all'
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 10
  });
  
  const [lastRequestTime, setLastRequestTime] = useState(0);
  const MIN_REQUEST_INTERVAL = 2000;

  const getRestrictionsDisplay = (userItem) => {
    if (!userItem.restrictions) {
      return <span className="text-gray-500">None</span>;
    }

    const { allowedScopes, allowedActivities } = userItem.restrictions;
    const restrictions = [];

    if (allowedScopes && allowedScopes.length < 3) {
      restrictions.push(
        <div key="scopes" className="flex items-center space-x-1">
          <Lock className="w-3 h-3 text-orange-500" />
          <span className="text-orange-600">
            Scopes: {allowedScopes.join(', ')}
          </span>
        </div>
      );
    }

    if (allowedActivities && allowedActivities.length > 0) {
      const activityCountByScope = {};
      allowedActivities.forEach(activity => {
        for (let scope = 1; scope <= 3; scope++) {
          const scopeKey = `scope${scope}`;
          const scopeData = emissionFactors[scopeKey];
          if (scopeData) {
            const categories = Object.keys(scopeData);
            if (categories.includes(activity)) {
              activityCountByScope[scope] = (activityCountByScope[scope] || 0) + 1;
              break;
            }
          }
        }
      });

      const scopeActivityDetails = Object.entries(activityCountByScope)
        .map(([scope, count]) => `S${scope}:${count}`)
        .join(', ');

      restrictions.push(
        <div key="activities" className="flex items-center space-x-1">
          <Settings className="w-3 h-3 text-blue-500" />
          <span className="text-blue-600">
            Activities: {scopeActivityDetails}
          </span>
        </div>
      );
    }

    return restrictions.length > 0 ? (
      <div className="text-xs space-y-1">
        {restrictions}
      </div>
    ) : (
      <span className="text-gray-500">None</span>
    );
  };

  const loadDashboardStats = async () => {
    try {
      setDashboardStats(prev => ({ ...prev, loading: true }));
      
      console.log('📊 Loading dashboard stats with organisation filter...');
      
      // Get organisation-specific users
      const usersResponse = await adminAPI.getAllUsers({
        limit: 1000
      });
      
      const usersData = usersResponse.data || usersResponse || [];
      const totalUsersInOrg = usersData.length;
      
      console.log('👥 Users in current organisation:', totalUsersInOrg);
      
      // Get activities (will be filtered by organisation through getRecentActivities)
      const allActivities = getRecentActivities(1000, {}); // Get more for stats
      
      const now = new Date();
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const recentCount = allActivities.filter(activity => {
        const activityDate = new Date(activity.timestamp || activity.createdAt);
        return activityDate >= last24Hours;
      }).length;
      
      const criticalActions = [
        'deleted_emission',
        'admin_deleted_user',
        'admin_updated_user_role',
        'admin_created_user',
        'security_',
        'failed_login'
      ];
      
      const criticalCount = allActivities.filter(activity => 
        criticalActions.some(critical => 
          activity.action?.toLowerCase().includes(critical.toLowerCase())
        )
      ).length;
      
      setDashboardStats({
        totalUsers: totalUsersInOrg,
        totalActivities: allActivities.length, // ← Now organisation-filtered
        recentActivities: recentCount,
        criticalActivities: criticalCount,
        loading: false
      });
      
      console.log('✅ Dashboard stats loaded (Organisation-Scoped):', {
        totalUsers: totalUsersInOrg,
        totalActivities: allActivities.length,
        recentActivities: recentCount,
        criticalActivities: criticalCount
      });
      
    } catch (error) {
      console.error('❌ Error loading dashboard stats:', error);
      
      const localSummary = getActivitySummaryForAdmin();
      
      setDashboardStats({
        totalUsers: localSummary.totalUsers || 0,
        totalActivities: localSummary.totalActivities || 0,
        recentActivities: localSummary.recentActivities || 0,
        criticalActivities: localSummary.criticalActivities || 0,
        loading: false
      });
      
      if (error.response?.status !== 429) {
        toast.error('Failed to load dashboard statistics');
      }
    }
  };

  useEffect(() => {
    if (isAdmin()) {
      loadDashboardStats();
      
      const debounceTimeout = setTimeout(() => {
        loadUsers();
        loadUserStats();
        loadRBACOptions();
        loadActivitySummary();
        loadRecentActivities();
      }, 500);
      
      return () => clearTimeout(debounceTimeout);
    }
  }, [searchQuery, filters.role, filters.status, pagination.currentPage]);

  useEffect(() => {
    let updateTimeout;
    const handleActivityUpdate = (event) => {
      console.log('New activity logged:', event.detail);
      clearTimeout(updateTimeout);
      updateTimeout = setTimeout(() => {
        loadRecentActivities();
        loadActivitySummary();
        loadDashboardStats();
      }, 1000);
    };

    window.addEventListener('user-activity-logged', handleActivityUpdate);
    return () => {
      clearTimeout(updateTimeout);
      window.removeEventListener('user-activity-logged', handleActivityUpdate);
    };
  }, []);

  const loadUsers = async () => {
    const now = Date.now();
    if (now - lastRequestTime < MIN_REQUEST_INTERVAL) {
      console.log('⏱️ Rate limited: skipping request');
      return;
    }
    
    try {
      setLoading(true);
      setLastRequestTime(now);
      
      const response = await adminAPI.getAllUsers({
        search: searchQuery,
        role: filters.role !== 'all' ? filters.role : undefined,
        status: filters.status !== 'all' ? filters.status : undefined,
        page: pagination.currentPage,
        limit: pagination.itemsPerPage
      });

      if (response.success !== false) {
        const usersData = response.data || response || [];
        
        const enhancedUsers = await Promise.all(usersData.map(async (userItem) => {
          const userId = userItem._id || userItem.id; // MongoDB compatibility
          const userActivities = getRecentActivities(5, { userId });
          return {
            ...userItem,
            id: userId,  // MongoDB compatibility
            _id: userId, // MongoDB compatibility
            statistics: {
              ...userItem.statistics,
              recentActivities: userActivities,
              lastActivity: userActivities.length > 0 ? userActivities[0].timestamp : null,
              totalActivities: userActivities.length
            }
          };
        }));

        setUsers(enhancedUsers);
        if (response.pagination) {
          setPagination(prev => ({
            ...prev,
            ...response.pagination
          }));
        }
      }
    } catch (error) {
      console.error('Error loading users:', error);
      if (error.response?.status === 429) {
        toast.error('Too many requests. Please wait a moment...');
      } else {
        toast.error('Failed to load users');
      }
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadUserStats = async () => {
    try {
      const dashboardData = await adminAPI.getDashboard();
      
      setUserStats({
        overview: {
          totalUsers: dashboardData.userStats?.total || 0,
          activeUsers: dashboardData.userStats?.active || 0,
          inactiveUsers: dashboardData.userStats?.inactive || 0,
          suspendedUsers: 0,
          adminUsers: 0,
          analystUsers: 0,
          contributorUsers: 0,
          viewerUsers: 0
        }
      });
    } catch (error) {
      console.error('Error loading user stats:', error);
      setUserStats({
        overview: {
          totalUsers: 0,
          activeUsers: 0,
          inactiveUsers: 0,
          suspendedUsers: 0,
          adminUsers: 0,
          analystUsers: 0,
          contributorUsers: 0,
          viewerUsers: 0
        }
      });
    }
  };

  const loadRBACOptions = () => {
    const activitiesPerScope = {};
    
    ['1', '2', '3'].forEach(scope => {
      const scopeKey = `scope${scope}`;
      const scopeData = emissionFactors[scopeKey];
      if (scopeData) {
        activitiesPerScope[scope] = Object.keys(scopeData);
      }
    });

    console.log('📋 RBAC Options - Activities per scope:', activitiesPerScope);

    setRBACOptions({
      scopes: [
        { value: 1, label: 'Scope 1 - Direct Emissions', description: 'Direct emissions from owned or controlled sources' },
        { value: 2, label: 'Scope 2 - Indirect Emissions (Energy)', description: 'Indirect emissions from purchased energy' },
        { value: 3, label: 'Scope 3 - Indirect Emissions (Value Chain)', description: 'All other indirect emissions from value chain activities' }
      ],
      activities: activitiesPerScope,
      roles: [
        { value: 'admin', label: 'Administrator', description: 'Full system access' },
        { value: 'analyst', label: 'Analyst', description: 'Data analysis and reporting' },
        { value: 'contributor', label: 'Contributor', description: 'Data entry and management' },
        { value: 'viewer', label: 'Viewer', description: 'Read-only access' }
      ],
      pages: [
        { value: '/dashboard', label: 'Dashboard', icon: '📊' },
        { value: '/input', label: 'Add Emission', icon: '➕' },
        { value: '/monitor', label: 'Monitor', icon: '👁️' },
        { value: '/analytics', label: 'Analytics', icon: '📈' },
        { value: '/settings', label: 'Settings', icon: '⚙️' }
      ]
    });
  };

  const loadActivitySummary = () => {
    try {
      const summary = getActivitySummaryForAdmin();
      setActivitySummary(summary);
    } catch (error) {
      console.error('Error loading activity summary:', error);
      setActivitySummary({
        totalActivities: 0,
        recentActivities: 0,
        criticalActivities: 0
      });
    }
  };

  const loadRecentActivities = () => {
    try {
      console.log('📊 Loading recent activities for User Management...');
      console.log('👤 Current user:', user?.email, 'Org:', user?.organisation_id);
      
      // getRecentActivities will now automatically filter by organisation
      const activities = getRecentActivities(20, {});
      
      console.log('✅ Loaded activities (organisation-filtered):', activities.length);
      
      setRecentActivities(activities);
    } catch (error) {
      console.error('❌ Error loading recent activities:', error);
      setRecentActivities([]);
    }
  };

  const handleShowUserActivities = (userItem) => {
    const userId = userItem._id || userItem.id; // MongoDB compatibility
    const userActivities = getRecentActivities(50, { userId });
    setSelectedUserActivities(userActivities);
    setSelectedUser(userItem);
    setShowActivitiesModal(true);
  };

  const handleCreateUser = async (userData) => {
    try {
      setLoading(true);
      
      const dataToSend = {
        name: userData.name,
        email: userData.email,
        password: userData.password,
        role: userData.role,
        status: userData.status,
        allowedScopes: userData.allowedScopes || [],
        allowedActivities: userData.allowedActivities || [],
        restrictedPages: userData.restrictedPages || []
      };
      
      console.log('===========================================');
      console.log('CREATING USER WITH RESTRICTIONS:');
      console.log('User Data:', dataToSend);
      console.log('Allowed Scopes:', dataToSend.allowedScopes);
      console.log('Allowed Activities:', dataToSend.allowedActivities);
      console.log('Restricted Pages:', dataToSend.restrictedPages);
      console.log('===========================================');
      
      const response = await adminAPI.createUser(dataToSend);
      
      console.log('===========================================');
      console.log('CREATE USER RESPONSE:');
      console.log('Success:', response.success !== false);
      console.log('Response Data:', response.data || response);
      console.log('Restrictions in response:', response.data?.restrictions || response.restrictions);
      console.log('===========================================');
      
      if (response.success !== false) {
        toast.success(`User created successfully: ${userData.name}`);
        setShowUserModal(false);
        loadUsers();
        loadUserStats();
        loadActivitySummary();
        loadDashboardStats();
      } else {
        throw new Error(response.message || 'Unknown error');
      }
    } catch (error) {
      console.error('Create user error:', error);
      const message = error.response?.data?.message || error.message || 'Failed to create user';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUserRole = async (userId, newRole) => {
    try {
      await adminAPI.updateUserRole(userId, newRole);
      toast.success('User role updated successfully');
      loadUsers();
      loadUserStats();
      loadActivitySummary();
      loadDashboardStats();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update user role');
    }
  };

  const handleUpdateUserStatus = async (userId, newStatus) => {
    try {
      await adminAPI.updateUserStatus(userId, newStatus);
      toast.success('User status updated successfully');
      loadUsers();
      loadUserStats();
      loadActivitySummary();
      loadDashboardStats();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update user status');
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await adminAPI.deleteUser(userId);
      toast.success('User deleted successfully');
      loadUsers();
      loadUserStats();
      loadActivitySummary();
      loadDashboardStats();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete user');
    }
  };

  const handleExportUsers = async () => {
    try {
      const exportData = users.map(userItem => ({
        'Name': userItem.name,
        'Email': userItem.email,
        'Role': userItem.role,
        'Status': userItem.status,
        'Created': new Date(userItem.createdAt).toLocaleDateString(),
        'Last Login': userItem.lastLogin ? new Date(userItem.lastLogin).toLocaleDateString() : 'Never',
        'Total Activities': userItem.statistics?.totalActivities || 0,
        'Last Activity': userItem.statistics?.lastActivity ? new Date(userItem.statistics.lastActivity).toLocaleDateString() : 'Never',
        'Restrictions': userItem.restrictions ? JSON.stringify(userItem.restrictions) : 'None'
      }));

      const csvContent = convertToCSV(exportData);
      const blob = new Blob([csvContent], { type: 'text/csv' });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Users exported successfully');
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

  const getRoleBadgeColor = (role) => {
    const colors = {
      admin: 'bg-red-100 dark:bg-red-950/45 text-red-800 dark:text-red-300',
      analyst: 'bg-blue-100 dark:bg-blue-950/45 text-blue-800 dark:text-blue-300',
      contributor: 'bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-300',
      viewer: 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-200'
    };
    return colors[role] || 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-200';
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      active: 'bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-300',
      inactive: 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-200',
      suspended: 'bg-red-100 dark:bg-red-950/45 text-red-800 dark:text-red-300'
    };
    return colors[status] || 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-200';
  };

  const getRoleIcon = (role) => {
    const icons = {
      admin: <Crown className="w-3 h-3 mr-1" />,
      analyst: <BarChart3 className="w-3 h-3 mr-1" />,
      contributor: <FileText className="w-3 h-3 mr-1" />,
      viewer: <Eye className="w-3 h-3 mr-1" />
    };
    return icons[role] || null;
  };

  const getActivityIcon = (action) => {
    if (action.includes('login')) return <Users className="w-4 h-4" />;
    if (action.includes('emission')) return <Database className="w-4 h-4" />;
    if (action.includes('admin')) return <Shield className="w-4 h-4" />;
    if (action.includes('viewed')) return <Eye className="w-4 h-4" />;
    return <Activity className="w-4 h-4" />;
  };

  const getSeverityColor = (action) => {
    if (action.includes('delete') || action.includes('admin')) return 'text-red-600 bg-red-50 dark:text-red-300 dark:bg-red-950/50';
    if (action.includes('create') || action.includes('update')) return 'text-orange-600 bg-orange-50 dark:text-orange-300 dark:bg-orange-950/50';
    if (action.includes('viewed') || action.includes('login')) return 'text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-blue-950/50';
    return 'text-gray-600 bg-gray-50 dark:text-gray-300 dark:bg-slate-800';
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  if (!isAdmin()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400">You need admin privileges to manage users.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="User Management & Activity Monitoring"
        breadcrumb={[
          { label: 'Admin', href: '/admin' },
          { label: 'User Management' }
        ]}
        action={
          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportUsers}
              className="flex items-center space-x-2 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-200 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
            <button
              onClick={() => setShowUserModal(true)}
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors flex items-center space-x-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add User</span>
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="app-card p-4">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 dark:bg-blue-950/40 rounded-lg">
              <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {dashboardStats.loading ? (
                  <span className="text-gray-400">–</span>
                ) : (
                  dashboardStats.totalUsers
                )}
              </p>
            </div>
          </div>
        </div>
        
        <div className="app-card p-4">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 dark:bg-green-950/40 rounded-lg">
              <Activity className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Activities</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {dashboardStats.loading ? (
                  <span className="text-gray-400">–</span>
                ) : (
                  dashboardStats.totalActivities
                )}
              </p>
            </div>
          </div>
        </div>
        
        <div className="app-card p-4">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 dark:bg-orange-950/35 rounded-lg">
              <TrendingUp className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Recent (24h)</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {dashboardStats.loading ? (
                  <span className="text-gray-400">–</span>
                ) : (
                  dashboardStats.recentActivities
                )}
              </p>
            </div>
          </div>
        </div>
        
        <div className="app-card p-4">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 dark:bg-red-950/35 rounded-lg">
              <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Critical Activities</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {dashboardStats.loading ? (
                  <span className="text-gray-400">–</span>
                ) : (
                  dashboardStats.criticalActivities
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="app-card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <Activity className="w-5 h-5 mr-2 text-emerald-600" />
              Recent User Activities
            </h3>
            <button 
              onClick={() => {
                loadRecentActivities();
                loadDashboardStats();
              }}
              className="flex items-center space-x-2 text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>
        </div>
        
        <div className="p-4">
          {recentActivities.length > 0 ? (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {recentActivities.slice(0, 10).map((activity, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/60">
                  <div className={`p-2 rounded-lg ${getSeverityColor(activity.action)}`}>
                    {getActivityIcon(activity.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {activity.user?.name || 'Unknown User'}
                      </p>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatTimestamp(activity.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{activity.details}</p>
                    <div className="flex items-center mt-1 space-x-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${getRoleBadgeColor(activity.user?.role)}`}>
                        {activity.user?.role}
                      </span>
                      <span className="text-xs text-gray-400">
                        {activity.action.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No recent activities found</p>
            </div>
          )}
        </div>
      </div>

      <div className="app-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-80"
              />
            </div>
            
            <select
              value={filters.role}
              onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value }))}
              className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="analyst">Analyst</option>
              <option value="contributor">Contributor</option>
              <option value="viewer">Viewer</option>
            </select>

            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <button
            onClick={loadUsers}
            className="flex items-center space-x-2 px-3 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="app-card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">User Management</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Manage user accounts, roles, RBAC permissions, and monitor activities</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
            <span className="ml-2 text-gray-600 dark:text-gray-400">Loading users...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 mb-2">No users found</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Try adjusting your search criteria or add a new user</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">Activity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">Restrictions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-900/40 divide-y divide-gray-200 dark:divide-slate-700">
                {users.map((userItem) => {
                  const userId = userItem._id || userItem.id; // MongoDB compatibility
                  return (
                  <tr key={userId} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-medium">
                            {userItem.name ? userItem.name.split(' ').map(n => n[0]).join('') : 'U'}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{userItem.name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{userItem.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={userItem.role}
                        onChange={(e) => handleUpdateUserRole(userId, e.target.value)}
                        className="text-xs px-2 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        disabled={userId === user.id}
                      >
                        <option value="admin">Admin</option>
                        <option value="analyst">Analyst</option>
                        <option value="contributor">Contributor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <div className="mt-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(userItem.role)}`}>
                          {getRoleIcon(userItem.role)}
                          {userItem.role.charAt(0).toUpperCase() + userItem.role.slice(1)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={userItem.status}
                        onChange={(e) => handleUpdateUserStatus(userId, e.target.value)}
                        className={`text-xs px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 ${getStatusBadgeColor(userItem.status)}`}
                        disabled={userId === user.id}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="suspended">Suspended</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-900 dark:text-white font-medium">
                            {userItem.statistics?.totalActivities || 0} total
                          </span>
                          <button
                            onClick={() => handleShowUserActivities(userItem)}
                            className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 flex items-center"
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            View
                          </button>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Last: {userItem.statistics?.lastActivity ? formatTimestamp(userItem.statistics.lastActivity) : 'Never'}
                        </div>
                        {userItem.statistics?.recentActivities && userItem.statistics.recentActivities.length > 0 && (
                          <div className="text-xs text-blue-600 dark:text-blue-400">
                            Latest: {userItem.statistics.recentActivities[0].action.replace(/_/g, ' ')}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getRestrictionsDisplay(userItem)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(userItem.createdAt || userItem.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setSelectedUser(userItem)}
                          className="text-emerald-600 hover:text-emerald-900 dark:hover:text-emerald-300 transition-colors"
                          title="Edit User"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleShowUserActivities(userItem)}
                          className="text-blue-600 hover:text-blue-900 transition-colors"
                          title="View Activities"
                        >
                          <Activity className="w-4 h-4" />
                        </button>
                        {userId !== user.id && (
                          <button
                            onClick={() => handleDeleteUser(userId, userItem.name)}
                            className="text-red-600 hover:text-red-900 transition-colors"
                            title="Delete User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showUserModal && rbacOptions && (
        <CreateUserModal
          onSubmit={handleCreateUser}
          onClose={() => setShowUserModal(false)}
          loading={loading}
          rbacOptions={rbacOptions}
        />
      )}

      {showActivitiesModal && selectedUser && (
        <UserActivitiesModal
          user={selectedUser}
          activities={selectedUserActivities}
          onClose={() => {
            setShowActivitiesModal(false);
            setSelectedUser(null);
            setSelectedUserActivities([]);
          }}
        />
      )}
    </div>
  );
};

const UserActivitiesModal = ({ user, activities, onClose }) => {
  const [filteredActivities, setFilteredActivities] = useState(activities);
  const [activityFilter, setActivityFilter] = useState('all');

  useEffect(() => {
    if (activityFilter === 'all') {
      setFilteredActivities(activities);
    } else {
      setFilteredActivities(activities.filter(a => a.action.includes(activityFilter)));
    }
  }, [activities, activityFilter]);

  const getActivityIcon = (action) => {
    if (action.includes('login')) return <Users className="w-4 h-4" />;
    if (action.includes('emission')) return <Database className="w-4 h-4" />;
    if (action.includes('admin')) return <Shield className="w-4 h-4" />;
    if (action.includes('viewed')) return <Eye className="w-4 h-4" />;
    return <Activity className="w-4 h-4" />;
  };

  const getSeverityColor = (action) => {
    if (action.includes('delete') || action.includes('admin')) return 'text-red-600 bg-red-50 dark:text-red-300 dark:bg-red-950/50';
    if (action.includes('create') || action.includes('update')) return 'text-orange-600 bg-orange-50 dark:text-orange-300 dark:bg-orange-950/50';
    if (action.includes('viewed') || action.includes('login')) return 'text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-blue-950/50';
    return 'text-gray-600 bg-gray-50 dark:text-gray-300 dark:bg-slate-800';
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-600 shadow-2xl dark:shadow-black/40 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700 shrink-0">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">User Activities</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Activity history for {user.name} ({user.email})
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 border-b border-gray-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40">
          <div className="flex items-center space-x-4">
            <select
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Activities</option>
              <option value="login">Login Events</option>
              <option value="emission">Emission Activities</option>
              <option value="admin">Admin Actions</option>
              <option value="viewed">Page Views</option>
            </select>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Showing {filteredActivities.length} of {activities.length} activities
            </div>
          </div>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: '60vh' }}>
          {filteredActivities.length > 0 ? (
            <div className="p-6 space-y-4">
              {filteredActivities.map((activity, index) => (
                <div key={index} className="flex items-start space-x-4 p-4 rounded-lg border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                  <div className={`p-2 rounded-lg ${getSeverityColor(activity.action)}`}>
                    {getActivityIcon(activity.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                        {activity.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </h4>
                      <span className="text-sm text-gray-500">
                        {new Date(activity.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{activity.details}</p>
                    {activity.resourceType && (
                      <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                        <span>Resource: {activity.resourceType}</span>
                        {activity.resourceId && <span>ID: {activity.resourceId}</span>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">No activities found for the selected filter</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/80 shrink-0">
          <button
            onClick={onClose}
            className="w-full bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const CreateUserModal = ({ onSubmit, onClose, loading, rbacOptions }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'contributor',
    status: 'active',
    allowedScopes: [1, 2, 3],
    allowedActivities: [],
    restrictedPages: []
  });
  const [errors, setErrors] = useState({});
  const [showRestrictions, setShowRestrictions] = useState(false);
  const [scopeSelectionMode, setScopeSelectionMode] = useState({});
  const [expandedScopes, setExpandedScopes] = useState({ 1: false, 2: false, 3: false });
  const [accessPreview, setAccessPreview] = useState('');
  const [activitySearchTerm, setActivitySearchTerm] = useState({});

  const activitiesPerScope = rbacOptions?.activities || {
    1: [],
    2: [],
    3: []
  };

  console.log('📋 Create User Modal - Activities per scope:', activitiesPerScope);

  useEffect(() => {
    setShowRestrictions(formData.role === 'contributor');
    
    if (formData.role !== 'contributor') {
      setFormData(prev => ({
        ...prev,
        allowedScopes: [1, 2, 3],
        allowedActivities: [],
        restrictedPages: []
      }));
      setScopeSelectionMode({});
      setExpandedScopes({ 1: false, 2: false, 3: false });
    } else {
      setScopeSelectionMode(prev => {
        if (Object.keys(prev).length > 0) {
          return prev;
        }
        
        const initialMode = {};
        [1, 2, 3].forEach(scope => {
          initialMode[scope] = 'none';
        });
        
        return initialMode;
      });
    }
  }, [formData.role]);

  useEffect(() => {
    updateAccessPreview();
  }, [formData.allowedScopes, formData.allowedActivities, scopeSelectionMode]);

  const updateAccessPreview = () => {
    if (formData.role !== 'contributor') {
      setAccessPreview('Full access according to role permissions');
      return;
    }

    let preview = '';
    const scopesWithAccess = [];
    const activitiesWithAccess = [];

    formData.allowedScopes.forEach(scope => {
      if (scopeSelectionMode[scope] === 'scope') {
        scopesWithAccess.push(`Scope ${scope} (all activities)`);
      }
    });

    formData.allowedActivities.forEach(activity => {
      for (let scope = 1; scope <= 3; scope++) {
        if (activitiesPerScope[scope].includes(activity)) {
          activitiesWithAccess.push(`${activity} (Scope ${scope})`);
          break;
        }
      }
    });

    if (scopesWithAccess.length === 0 && activitiesWithAccess.length === 0) {
      preview = 'No access to any scopes or activities';
    } else {
      preview = [
        scopesWithAccess.length > 0 ? `Scope Access: ${scopesWithAccess.join(', ')}` : '',
        activitiesWithAccess.length > 0 ? `Activity Access: ${activitiesWithAccess.join(', ')}` : ''
      ].filter(Boolean).join('\n');
    }

    setAccessPreview(preview);
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (formData.role === 'contributor') {
      const hasAnyAccess = formData.allowedScopes.length > 0 || formData.allowedActivities.length > 0;
      if (!hasAnyAccess) {
        newErrors.access = 'User must have access to at least one scope or activity';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (validateForm()) {
      const finalFormData = { ...formData };
      
      if (formData.role === 'contributor') {
        const finalAllowedScopes = formData.allowedScopes.filter(scope => 
          scopeSelectionMode[scope] === 'scope'
        );
        
        finalFormData.allowedScopes = finalAllowedScopes;
        finalFormData.allowedActivities = formData.allowedActivities;
        finalFormData.restrictedPages = formData.restrictedPages || [];
      } else {
        finalFormData.allowedScopes = [];
        finalFormData.allowedActivities = [];
        finalFormData.restrictedPages = [];
      }
      
      console.log('🚀 Submitting user with final data:', finalFormData);
      onSubmit(finalFormData);
    }
  };

  const handleScopeSelectionModeChange = (scope, mode) => {
    setScopeSelectionMode(prev => ({
      ...prev,
      [scope]: mode
    }));
  
    if (mode === 'activity') {
      setExpandedScopes(prev => ({
        ...prev,
        [scope]: true
      }));
    }
  
    if (mode === 'scope') {
      setFormData(prev => ({
        ...prev,
        allowedScopes: [...new Set([...prev.allowedScopes, scope])],
        allowedActivities: prev.allowedActivities.filter(activity => 
          !activitiesPerScope[scope].includes(activity)
        )
      }));
    } else if (mode === 'activity') {
      setFormData(prev => ({
        ...prev,
        allowedScopes: prev.allowedScopes.filter(s => s !== scope)
      }));
    } else if (mode === 'none') {
      setFormData(prev => ({
        ...prev,
        allowedScopes: prev.allowedScopes.filter(s => s !== scope),
        allowedActivities: prev.allowedActivities.filter(activity => 
          !activitiesPerScope[scope].includes(activity)
        )
      }));
    }
  };
  
  const handleActivityChange = (scope, activity, checked) => {
    if (checked) {
      setFormData(prev => {
        const newAllowedActivities = [...new Set([...prev.allowedActivities, activity])];
        return {
          ...prev,
          allowedActivities: newAllowedActivities
        };
      });
      
      if (scopeSelectionMode[scope] !== 'activity') {
        setScopeSelectionMode(prev => ({
          ...prev,
          [scope]: 'activity'
        }));
      }
    } else {
      setFormData(prev => {
        const newAllowedActivities = prev.allowedActivities.filter(a => a !== activity);
        
        const remainingActivitiesInScope = newAllowedActivities.filter(a => 
          activitiesPerScope[scope].includes(a)
        );
        
        if (remainingActivitiesInScope.length === 0) {
          setTimeout(() => {
            setScopeSelectionMode(prev => ({
              ...prev,
              [scope]: 'none'
            }));
          }, 0);
        }
        
        return {
          ...prev,
          allowedActivities: newAllowedActivities
        };
      });
    }
    
    setTimeout(() => {
      updateAccessPreview();
    }, 0);
  };
  
  const toggleScopeExpanded = (scope) => {
    setExpandedScopes(prev => ({
      ...prev,
      [scope]: !prev[scope]
    }));
  };

  const handleSelectAllActivities = (scope) => {
    const allActivitiesInScope = activitiesPerScope[scope] || [];
    const newAllowedActivities = [
      ...formData.allowedActivities.filter(activity => 
        !allActivitiesInScope.includes(activity)
      ),
      ...allActivitiesInScope
    ];
    
    setFormData(prev => ({
      ...prev,
      allowedActivities: newAllowedActivities
    }));

    setScopeSelectionMode(prev => ({
      ...prev,
      [scope]: 'activity'
    }));
  };

  const handleClearAllActivities = (scope) => {
    const allActivitiesInScope = activitiesPerScope[scope] || [];
    const newAllowedActivities = formData.allowedActivities.filter(activity => 
      !allActivitiesInScope.includes(activity)
    );
    
    setFormData(prev => ({
      ...prev,
      allowedActivities: newAllowedActivities
    }));

    setScopeSelectionMode(prev => ({
      ...prev,
      [scope]: 'none'
    }));
  };

  const getFilteredActivities = (scope) => {
    const activities = activitiesPerScope[scope] || [];
    const searchTerm = activitySearchTerm[scope] || '';
    
    if (!searchTerm) return activities;
    
    return activities.filter(activity => 
      activity.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const getScopeAccessStatus = (scope) => {
    const mode = scopeSelectionMode[scope];
    if (mode === 'scope') return 'Full Access';
    if (mode === 'activity') {
      const count = formData.allowedActivities.filter(a => 
        activitiesPerScope[scope].includes(a)
      ).length;
      return `${count} Activities`;
    }
    return 'No Access';
  };

  const getScopeStatusColor = (scope) => {
    const mode = scopeSelectionMode[scope];
    if (mode === 'scope') return 'text-green-600 bg-green-50 dark:text-emerald-300 dark:bg-emerald-950/50';
    if (mode === 'activity') return 'text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-blue-950/50';
    return 'text-gray-600 bg-gray-50 dark:text-gray-300 dark:bg-slate-800';
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-600 shadow-2xl dark:shadow-black/40 w-full max-w-6xl max-h-[95vh] overflow-y-auto">
        <div className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm z-10 flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white pr-4">Create New User with Activity-Specific Access Control</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 dark:text-gray-100 ${
                  errors.name ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-slate-600'
                }`}
                placeholder="Enter full name"
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 dark:text-gray-100 ${
                  errors.email ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-slate-600'
                }`}
                placeholder="Enter email address"
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password *
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 dark:text-gray-100 ${
                errors.password ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-slate-600'
              }`}
              placeholder="Enter password"
            />
            {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Role *
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({...formData, role: e.target.value})}
                className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {rbacOptions.roles.map(role => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {rbacOptions.roles.find(r => r.value === formData.role)?.description}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value})}
                className="w-full p-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {showRestrictions && (
            <div className="border-t border-gray-200 dark:border-slate-700 pt-6">
              <div className="flex items-center space-x-2 mb-4">
                <Target className="w-5 h-5 text-orange-500" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Activity-Specific Access Control</h3>
                <span className="text-sm text-gray-500 dark:text-gray-400">(Contributor Role)</span>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2 flex items-center">
                  <Info className="w-4 h-4 mr-2" />
                  Enhanced Access Configuration:
                </h4>
                <ul className="text-sm text-blue-800 dark:text-blue-200/90 space-y-1">
                  <li>• <strong>Activity-Specific Access:</strong> Choose individual activity categories for granular control</li>
                  <li>• <strong>No Access:</strong> Completely deny access to a scope</li>
                  <li>• <strong>Note:</strong> Activity categories match exactly what users see in the Input page</li>
                </ul>
              </div>

              <div className="space-y-4">
                {[1, 2, 3].map(scope => (
                  <div key={scope} className="border border-gray-200 dark:border-slate-600 rounded-lg shadow-sm dark:shadow-black/30 overflow-hidden">
                    <div className="p-4 bg-gradient-to-r from-gray-50 to-white dark:from-slate-800/90 dark:to-slate-900/90 border-b border-gray-200 dark:border-slate-600">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-2">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-md ${
                              scope === 1 ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' :
                              scope === 2 ? 'bg-gradient-to-br from-blue-500 to-blue-600' : 
                              'bg-gradient-to-br from-purple-500 to-purple-600'
                            }`}>
                              {scope}
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900 dark:text-white">Scope {scope}</h4>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {rbacOptions.scopes.find(s => s.value === scope)?.description}
                              </p>
                              <div className="flex items-center space-x-2 mt-1">
                                <span className="text-xs text-gray-500 dark:text-gray-500">
                                  {activitiesPerScope[scope]?.length || 0} activity categories
                                </span>
                                {scopeSelectionMode[scope] === 'activity' && (
                                  <span className="text-xs text-blue-600 dark:text-blue-400">
                                    {formData.allowedActivities.filter(a => 
                                      activitiesPerScope[scope]?.includes(a)
                                    ).length} selected
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-3">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium shadow-sm ${getScopeStatusColor(scope)}`}>
                            {getScopeAccessStatus(scope)}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleScopeExpanded(scope)}
                            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                          >
                            {expandedScopes[scope] ? 
                              <ChevronUp className="w-5 h-5" /> : 
                              <ChevronDown className="w-5 h-5" />
                            }
                          </button>
                        </div>
                      </div>
                    </div>

                    {expandedScopes[scope] && (
                      <div className="p-4 bg-white dark:bg-slate-900/70">
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Access Level for Scope {scope}
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            <label className={`flex flex-col items-center space-y-2 p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md ${
                              scopeSelectionMode[scope] === 'activity' 
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 dark:border-blue-400 shadow-md' 
                                : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 hover:bg-gray-50 dark:hover:bg-slate-800'
                            }`}>
                              <input
                                type="radio"
                                name={`scope-${scope}-mode`}
                                value="activity"
                                checked={scopeSelectionMode[scope] === 'activity'}
                                onChange={() => handleScopeSelectionModeChange(scope, 'activity')}
                                className="text-blue-600 focus:ring-blue-500"
                              />
                              <Target className={`w-6 h-6 ${
                                scopeSelectionMode[scope] === 'activity' ? 'text-blue-600' : 'text-gray-400'
                              }`} />
                              <div className="text-center">
                                <div className="font-medium text-blue-700 dark:text-blue-200">Activity-Specific</div>
                                <div className="text-xs text-blue-600 dark:text-blue-400">Choose categories</div>
                              </div>
                            </label>

                            <label className={`flex flex-col items-center space-y-2 p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md ${
                              scopeSelectionMode[scope] === 'none' 
                                ? 'border-gray-500 bg-gray-50 dark:bg-slate-800 dark:border-gray-400 shadow-md' 
                                : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 hover:bg-gray-50 dark:hover:bg-slate-800'
                            }`}>
                              <input
                                type="radio"
                                name={`scope-${scope}-mode`}
                                value="none"
                                checked={scopeSelectionMode[scope] === 'none'}
                                onChange={() => handleScopeSelectionModeChange(scope, 'none')}
                                className="text-gray-600 focus:ring-gray-500"
                              />
                              <XCircle className={`w-6 h-6 ${
                                scopeSelectionMode[scope] === 'none' ? 'text-gray-600' : 'text-gray-400'
                              }`} />
                              <div className="text-center">
                                <div className="font-medium text-gray-700 dark:text-gray-200">No Access</div>
                                <div className="text-xs text-gray-600 dark:text-gray-400">Deny all access</div>
                              </div>
                            </label>
                          </div>
                        </div>

                        {scopeSelectionMode[scope] === 'activity' && (
                          <div className="mt-4 p-4 border-2 border-blue-200 dark:border-blue-800/80 rounded-lg bg-blue-50 dark:bg-blue-950/40">
                            <div className="flex items-center justify-between mb-4">
                              <label className="block text-sm font-medium text-blue-900 dark:text-blue-200 flex items-center">
                                <List className="w-4 h-4 mr-2" />
                                Select Activity Categories in Scope {scope}
                              </label>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs text-blue-700 dark:text-blue-200 bg-blue-100 dark:bg-blue-900/60 px-2 py-1 rounded-full">
                                  {formData.allowedActivities.filter(activity => 
                                    activitiesPerScope[scope]?.includes(activity)
                                  ).length} of {activitiesPerScope[scope]?.length || 0} selected
                                </span>
                              </div>
                            </div>

                            <div className="mb-4">
                              <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                <input
                                  type="text"
                                  placeholder="Search activity categories..."
                                  value={activitySearchTerm[scope] || ''}
                                  onChange={(e) => setActivitySearchTerm(prev => ({
                                    ...prev,
                                    [scope]: e.target.value
                                  }))}
                                  className="w-full pl-10 pr-4 py-2 border border-blue-300 dark:border-blue-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 dark:text-gray-100"
                                />
                              </div>
                            </div>

                            <div className="flex items-center space-x-2 mb-4">
                              <button
                                type="button"
                                onClick={() => handleSelectAllActivities(scope)}
                                className="flex items-center space-x-1 text-xs px-3 py-2 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-200 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800/70 transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Select All</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleClearAllActivities(scope)}
                                className="flex items-center space-x-1 text-xs px-3 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                              >
                                <Minus className="w-3 h-3" />
                                <span>Clear All</span>
                              </button>
                              {activitySearchTerm[scope] && (
                                <button
                                  type="button"
                                  onClick={() => setActivitySearchTerm(prev => ({
                                    ...prev,
                                    [scope]: ''
                                  }))}
                                  className="flex items-center space-x-1 text-xs px-3 py-2 bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
                                >
                                  <X className="w-3 h-3" />
                                  <span>Clear Search</span>
                                </button>
                              )}
                            </div>
                            
                            {activitiesPerScope[scope] && activitiesPerScope[scope].length > 0 ? (
                              <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                                {getFilteredActivities(scope).map(activity => {
                                  const isSelected = formData.allowedActivities.includes(activity);
                                  return (
                                    <label 
                                      key={activity} 
                                      className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-all hover:shadow-sm ${
                                        isSelected 
                                          ? 'bg-blue-100 dark:bg-blue-950/60 border-2 border-blue-300 dark:border-blue-600 shadow-sm' 
                                          : 'bg-white dark:bg-slate-800/80 border-2 border-gray-200 dark:border-slate-600 hover:border-blue-200 dark:hover:border-blue-600 hover:bg-blue-25 dark:hover:bg-slate-700/80'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={(e) => handleActivityChange(scope, activity, e.target.checked)}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                                      />
                                      <div className="flex-1">
                                        <div className="text-sm font-medium text-gray-900 dark:text-white">{activity}</div>
                                        <div className="text-xs text-gray-600 dark:text-gray-400">
                                          {emissionFactors?.[`scope${scope}`]?.[activity] ? 
                                            `${Object.keys(emissionFactors[`scope${scope}`][activity]).length} emission sources` :
                                            'Activity category for emission tracking'
                                          }
                                        </div>
                                      </div>
                                      {isSelected && (
                                        <div className="flex-shrink-0">
                                          <Check className="w-5 h-5 text-blue-600" />
                                        </div>
                                      )}
                                    </label>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                                <p className="text-sm">No activities available for Scope {scope}</p>
                              </div>
                            )}

                            {activitySearchTerm[scope] && (
                              <div className="mt-3 text-xs text-blue-600 dark:text-blue-300 bg-blue-100 dark:bg-blue-950/60 p-2 rounded">
                                Showing {getFilteredActivities(scope).length} of {activitiesPerScope[scope]?.length || 0} activities
                                {getFilteredActivities(scope).length === 0 && (
                                  <span className="text-orange-600"> - No matching activities found</span>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {scopeSelectionMode[scope] === 'none' && (
                          <div className="mt-4 p-3 bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-600 rounded-lg">
                            <div className="flex items-center space-x-2">
                              <XCircle className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                              <p className="text-sm text-gray-700 dark:text-gray-300">
                                <strong>No Access:</strong> User will not be able to access any activities in Scope {scope}.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-emerald-50 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-800/70 rounded-lg">
                <h4 className="font-medium text-emerald-900 dark:text-emerald-300 mb-2 flex items-center">
                  <Eye className="w-4 h-4 mr-2" />
                  Access Preview Summary
                </h4>
                <div className="text-sm text-emerald-800 dark:text-emerald-300 whitespace-pre-line bg-white dark:bg-slate-900 p-3 rounded border border-gray-200 dark:border-slate-600">
                  {accessPreview || 'No access configured'}
                </div>
                <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
                  This preview shows exactly what the user will be able to access in the Input page
                </div>
              </div>

              <div className="mt-6 p-4 bg-orange-50 dark:bg-orange-950/35 border border-orange-200 dark:border-orange-900/60 rounded-lg">
                <h4 className="font-medium text-orange-900 dark:text-orange-200 mb-3 flex items-center">
                  <Lock className="w-4 h-4 mr-2" />
                  Page Access Restrictions (Optional)
                </h4>
                <p className="text-xs text-orange-700 dark:text-orange-300/90 mb-3">
                  By default, contributors can access Dashboard, Input, Monitor, and Settings pages. 
                  Select pages below to RESTRICT access (remove from available pages).
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {rbacOptions?.pages?.filter(page => 
                    ['/dashboard', '/input', '/monitor', '/settings'].includes(page.value)
                  ).map(page => (
                    <label 
                      key={page.value}
                      className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-all border-2 ${
                        formData.restrictedPages?.includes(page.value)
                          ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800'
                          : 'bg-white dark:bg-slate-800/80 border-gray-200 dark:border-slate-600 hover:border-orange-300 dark:hover:border-orange-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.restrictedPages?.includes(page.value) || false}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData(prev => ({
                              ...prev,
                              restrictedPages: [...(prev.restrictedPages || []), page.value]
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              restrictedPages: (prev.restrictedPages || []).filter(p => p !== page.value)
                            }));
                          }
                        }}
                        className="rounded border-gray-300 text-red-600 focus:ring-red-500 h-4 w-4"
                      />
                      <div className="flex items-center space-x-2 flex-1">
                        <span className="text-lg">{page.icon}</span>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{page.label}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">{page.value}</div>
                        </div>
                      </div>
                      {formData.restrictedPages?.includes(page.value) && (
                        <XCircle className="w-4 h-4 text-red-600" />
                      )}
                    </label>
                  ))}
                </div>
                <div className="mt-3 text-xs text-orange-600 dark:text-orange-400">
                  {formData.restrictedPages?.length > 0 ? (
                    <span>⚠️ User will NOT be able to access: {formData.restrictedPages.map(p => 
                      rbacOptions?.pages?.find(page => page.value === p)?.label
                    ).join(', ')}</span>
                  ) : (
                    <span>✓ User can access all default contributor pages</span>
                  )}
                </div>
              </div>

              {errors.access && (
                <p className="text-red-500 text-sm mt-2 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.access}
                </p>
              )}
            </div>
          )}

          <div className="flex space-x-3 pt-4 sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-t border-gray-200 dark:border-slate-700 -mx-6 px-6 py-4">
            <button 
              type="submit" 
              disabled={loading}
              className="flex-1 bg-emerald-600 text-white py-3 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Creating User...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Create User with Access Control
                </>
              )}
            </button>
            <button 
              type="button" 
              onClick={onClose}
              disabled={loading}
              className="flex-1 border border-gray-300 dark:border-slate-600 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 dark:text-gray-200 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>

        <div className="p-6 pt-0">
          <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-100 dark:border-blue-900/50">
            <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-2 flex items-center">
              <Info className="w-4 h-4 mr-2" />
              Role-Based Access Control (RBAC) + Activity-Specific Restrictions:
            </p>
            <div className="grid grid-cols-2 gap-4 text-xs text-blue-700 dark:text-blue-200/90">
              <div>
                <strong>Admin:</strong> Full system access (restrictions ignored)<br/>
                <strong>Analyst:</strong> Analytics & Settings only<br/>
              </div>
              <div>
                <strong>Contributor:</strong> Input & Settings (with optional activity-specific restrictions)<br/>
                <strong>Viewer:</strong> Dashboard, Monitor, Analytics & Settings (read-only)<br/>
              </div>
            </div>
            <div className="mt-3 text-xs text-blue-600 dark:text-blue-400 border-t border-blue-200 dark:border-blue-900 pt-3">
              <strong>Note:</strong> Activity categories selected here match exactly what users will see in the Input page. 
              For example, selecting "Gaseous Fuels" gives access to all gaseous fuel types (Butane, CNG, LNG, LPG, Natural Gas, Propane).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;