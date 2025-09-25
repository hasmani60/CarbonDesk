// pages/Admin/UserManagement.jsx - Enhanced with Real-time Activity Logging
import { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  UserPlus,
  Edit3,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
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
  Calendar,
  MousePointer,
  Database,
  AlertCircle,
  TrendingUp,
  ExternalLink,
  Filter as FilterIcon
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useActivity } from '../../context/ActivityContext';
import { adminAPI, usersAPI } from '../../services/api';
import { emissionFactors } from '../../data/emissionFactors';
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

  useEffect(() => {
    if (isAdmin()) {
      loadUsers();
      loadUserStats();
      loadRBACOptions();
      loadActivitySummary();
      loadRecentActivities();
    }
  }, [searchQuery, filters, pagination.currentPage]);

  // Real-time activity updates
  useEffect(() => {
    const handleActivityUpdate = (event) => {
      console.log('New activity logged:', event.detail);
      loadRecentActivities();
      loadActivitySummary();
    };

    window.addEventListener('user-activity-logged', handleActivityUpdate);
    return () => window.removeEventListener('user-activity-logged', handleActivityUpdate);
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getAllUsers({
        search: searchQuery,
        role: filters.role !== 'all' ? filters.role : undefined,
        status: filters.status !== 'all' ? filters.status : undefined,
        page: pagination.currentPage,
        limit: pagination.itemsPerPage
      });

      if (response.success !== false) {
        const usersData = response.data || response || [];
        
        // Enhance users with activity data
        const enhancedUsers = await Promise.all(usersData.map(async (userItem) => {
          const userActivities = getRecentActivities(5, { userId: userItem._id });
          return {
            ...userItem,
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
      toast.error('Failed to load users');
      
      // Fallback to demo data with activity
      setUsers(getDemoUsersWithActivity());
    } finally {
      setLoading(false);
    }
  };

  const loadUserStats = async () => {
    try {
      const stats = await adminAPI.getUserStats();
      setUserStats(stats.data || stats);
    } catch (error) {
      console.error('Error loading user stats:', error);
      setUserStats({
        overview: {
          totalUsers: 4,
          activeUsers: 4,
          inactiveUsers: 0,
          suspendedUsers: 0,
          adminUsers: 1,
          analystUsers: 1,
          contributorUsers: 1,
          viewerUsers: 1
        }
      });
    }
  };

  const loadRBACOptions = async () => {
    try {
      const options = await usersAPI.getRBACOptions();
      setRBACOptions(options.data || options);
    } catch (error) {
      console.error('Error loading RBAC options:', error);
      setRBACOptions({
        scopes: [
          { value: 1, label: 'Scope 1 - Direct Emissions' },
          { value: 2, label: 'Scope 2 - Indirect Emissions (Energy)' },
          { value: 3, label: 'Scope 3 - Indirect Emissions (Value Chain)' }
        ],
        activities: {
          1: Object.keys(emissionFactors.scope1 || {}),
          2: Object.keys(emissionFactors.scope2 || {}),
          3: Object.keys(emissionFactors.scope3 || {})
        },
        roles: [
          { value: 'admin', label: 'Administrator', description: 'Full system access' },
          { value: 'analyst', label: 'Analyst', description: 'Data analysis and reporting' },
          { value: 'contributor', label: 'Contributor', description: 'Data entry and management' },
          { value: 'viewer', label: 'Viewer', description: 'Read-only access' }
        ]
      });
    }
  };

  const loadActivitySummary = () => {
    try {
      const summary = getActivitySummaryForAdmin();
      setActivitySummary(summary);
    } catch (error) {
      console.error('Error loading activity summary:', error);
    }
  };

  const loadRecentActivities = () => {
    try {
      const activities = getRecentActivities(20, {}); // Get recent 20 activities
      setRecentActivities(activities);
    } catch (error) {
      console.error('Error loading recent activities:', error);
    }
  };

  const handleShowUserActivities = (userItem) => {
    const userActivities = getRecentActivities(50, { userId: userItem._id });
    setSelectedUserActivities(userActivities);
    setSelectedUser(userItem);
    setShowActivitiesModal(true);
  };

  const handleCreateUser = async (userData) => {
    try {
      setLoading(true);
      const response = await adminAPI.createUser(userData);
      
      if (response.success !== false) {
        toast.success(`User created successfully: ${userData.name}`);
        setShowUserModal(false);
        loadUsers();
        loadUserStats();
        loadActivitySummary();
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

  const getDemoUsersWithActivity = () => [
    {
      _id: 'demo_admin',
      name: 'Demo Admin',
      email: 'demo@example.com',
      role: 'admin',
      status: 'active',
      createdAt: new Date(),
      lastLogin: new Date(),
      restrictions: null,
      statistics: { 
        emissionCount: 15, 
        recentActivityCount: 5,
        totalActivities: 25,
        lastActivity: new Date(),
        recentActivities: [
          { action: 'admin_created_user', timestamp: new Date(), details: 'Created new user: John Doe' },
          { action: 'viewed_admin_dashboard', timestamp: new Date(Date.now() - 3600000), details: 'Accessed admin dashboard' }
        ]
      }
    },
    {
      _id: 'demo_analyst',
      name: 'Demo Analyst',
      email: 'analyst@example.com',
      role: 'analyst',
      status: 'active',
      createdAt: new Date(),
      lastLogin: new Date(),
      restrictions: null,
      statistics: { 
        emissionCount: 10, 
        recentActivityCount: 3,
        totalActivities: 18,
        lastActivity: new Date(Date.now() - 1800000),
        recentActivities: [
          { action: 'verified_emission', timestamp: new Date(Date.now() - 1800000), details: 'Verified emission record' },
          { action: 'viewed_analytics', timestamp: new Date(Date.now() - 3600000), details: 'Viewed analytics page' }
        ]
      }
    },
    {
      _id: 'demo_contributor',
      name: 'Demo Contributor',
      email: 'contributor@example.com',
      role: 'contributor',
      status: 'active',
      createdAt: new Date(),
      lastLogin: new Date(),
      restrictions: {
        allowedScopes: [1, 2],
        allowedActivities: ['Fuel from Generator'],
        restrictedPages: []
      },
      statistics: { 
        emissionCount: 5, 
        recentActivityCount: 2,
        totalActivities: 12,
        lastActivity: new Date(Date.now() - 7200000),
        recentActivities: [
          { action: 'created_emission', timestamp: new Date(Date.now() - 7200000), details: 'Created emission: Fuel from Generator' },
          { action: 'viewed_input', timestamp: new Date(Date.now() - 10800000), details: 'Accessed input page' }
        ]
      }
    },
    {
      _id: 'demo_viewer',
      name: 'Demo Viewer',
      email: 'viewer@example.com',
      role: 'viewer',
      status: 'active',
      createdAt: new Date(),
      lastLogin: new Date(),
      restrictions: null,
      statistics: { 
        emissionCount: 0, 
        recentActivityCount: 1,
        totalActivities: 8,
        lastActivity: new Date(Date.now() - 14400000),
        recentActivities: [
          { action: 'viewed_dashboard', timestamp: new Date(Date.now() - 14400000), details: 'Viewed dashboard' },
          { action: 'viewed_monitor', timestamp: new Date(Date.now() - 18000000), details: 'Accessed monitor page' }
        ]
      }
    }
  ];

  const getRoleBadgeColor = (role) => {
    const colors = {
      admin: 'bg-red-100 text-red-800',
      analyst: 'bg-blue-100 text-blue-800',
      contributor: 'bg-green-100 text-green-800',
      viewer: 'bg-gray-100 text-gray-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      suspended: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
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
    if (action.includes('delete') || action.includes('admin')) return 'text-red-600 bg-red-50';
    if (action.includes('create') || action.includes('update')) return 'text-orange-600 bg-orange-50';
    if (action.includes('viewed') || action.includes('login')) return 'text-blue-600 bg-blue-50';
    return 'text-gray-600 bg-gray-50';
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You need admin privileges to manage users.</p>
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
              className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
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

      {/* Activity Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">{userStats?.overview.totalUsers || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Activity className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Activities</p>
              <p className="text-2xl font-bold text-gray-900">{activitySummary?.totalActivities || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Recent (24h)</p>
              <p className="text-2xl font-bold text-gray-900">{activitySummary?.recentActivities || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Critical Activities</p>
              <p className="text-2xl font-bold text-gray-900">{activitySummary?.criticalActivities || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activities Panel */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Activity className="w-5 h-5 mr-2 text-emerald-600" />
              Recent User Activities
            </h3>
            <button 
              onClick={loadRecentActivities}
              className="flex items-center space-x-2 text-sm text-emerald-600 hover:text-emerald-700"
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
                <div key={index} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50">
                  <div className={`p-2 rounded-lg ${getSeverityColor(activity.action)}`}>
                    {getActivityIcon(activity.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">
                        {activity.user?.name || 'Unknown User'}
                      </p>
                      <span className="text-xs text-gray-500">
                        {formatTimestamp(activity.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 truncate">{activity.details}</p>
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
            <div className="text-center py-8 text-gray-500">
              <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No recent activities found</p>
            </div>
          )}
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 w-80"
              />
            </div>
            
            <select
              value={filters.role}
              onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <button
            onClick={loadUsers}
            className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">User Management</h3>
          <p className="text-sm text-gray-600 mt-1">Manage user accounts, roles, RBAC permissions, and monitor activities</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
            <span className="ml-2 text-gray-600">Loading users...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No users found</p>
            <p className="text-sm text-gray-500">Try adjusting your search criteria</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-emerald-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase tracking-wider">Activity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase tracking-wider">Restrictions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((userItem) => (
                  <tr key={userItem._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-medium">
                            {userItem.name ? userItem.name.split(' ').map(n => n[0]).join('') : 'U'}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{userItem.name}</div>
                          <div className="text-sm text-gray-500">{userItem.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={userItem.role}
                        onChange={(e) => handleUpdateUserRole(userItem._id, e.target.value)}
                        className="text-xs px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        disabled={userItem._id === user.id}
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
                        onChange={(e) => handleUpdateUserStatus(userItem._id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 ${getStatusBadgeColor(userItem.status)}`}
                        disabled={userItem._id === user.id}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="suspended">Suspended</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-900 font-medium">
                            {userItem.statistics?.totalActivities || 0} total
                          </span>
                          <button
                            onClick={() => handleShowUserActivities(userItem)}
                            className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center"
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            View
                          </button>
                        </div>
                        <div className="text-xs text-gray-500">
                          Last: {userItem.statistics?.lastActivity ? formatTimestamp(userItem.statistics.lastActivity) : 'Never'}
                        </div>
                        {userItem.statistics?.recentActivities && userItem.statistics.recentActivities.length > 0 && (
                          <div className="text-xs text-blue-600">
                            Latest: {userItem.statistics.recentActivities[0].action.replace(/_/g, ' ')}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {userItem.restrictions ? (
                        <div className="text-xs space-y-1">
                          {userItem.restrictions.allowedScopes && userItem.restrictions.allowedScopes.length < 3 && (
                            <div className="flex items-center space-x-1">
                              <Lock className="w-3 h-3 text-orange-500" />
                              <span className="text-orange-600">
                                Scopes: {userItem.restrictions.allowedScopes.join(', ')}
                              </span>
                            </div>
                          )}
                          {userItem.restrictions.allowedActivities && userItem.restrictions.allowedActivities.length > 0 && (
                            <div className="flex items-center space-x-1">
                              <Settings className="w-3 h-3 text-blue-500" />
                              <span className="text-blue-600">
                                {userItem.restrictions.allowedActivities.length} activities
                              </span>
                            </div>
                          )}
                          {(!userItem.restrictions.allowedScopes || userItem.restrictions.allowedScopes.length === 3) && 
                           (!userItem.restrictions.allowedActivities || userItem.restrictions.allowedActivities.length === 0) && (
                            <span className="text-gray-500">None</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500">None</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(userItem.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setSelectedUser(userItem)}
                          className="text-emerald-600 hover:text-emerald-900 transition-colors"
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
                        {userItem._id !== user.id && (
                          <button
                            onClick={() => handleDeleteUser(userItem._id, userItem.name)}
                            className="text-red-600 hover:text-red-900 transition-colors"
                            title="Delete User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {showUserModal && rbacOptions && (
        <CreateUserModal
          onSubmit={handleCreateUser}
          onClose={() => setShowUserModal(false)}
          loading={loading}
          rbacOptions={rbacOptions}
        />
      )}

      {/* User Activities Modal */}
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

// User Activities Modal Component
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
    if (action.includes('delete') || action.includes('admin')) return 'text-red-600 bg-red-50';
    if (action.includes('create') || action.includes('update')) return 'text-orange-600 bg-orange-50';
    if (action.includes('viewed') || action.includes('login')) return 'text-blue-600 bg-blue-50';
    return 'text-gray-600 bg-gray-50';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">User Activities</h2>
            <p className="text-sm text-gray-600 mt-1">
              Activity history for {user.name} ({user.email})
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 border-b">
          <div className="flex items-center space-x-4">
            <select
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Activities</option>
              <option value="login">Login Events</option>
              <option value="emission">Emission Activities</option>
              <option value="admin">Admin Actions</option>
              <option value="viewed">Page Views</option>
            </select>
            <div className="text-sm text-gray-600">
              Showing {filteredActivities.length} of {activities.length} activities
            </div>
          </div>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: '60vh' }}>
          {filteredActivities.length > 0 ? (
            <div className="p-6 space-y-4">
              {filteredActivities.map((activity, index) => (
                <div key={index} className="flex items-start space-x-4 p-4 rounded-lg border hover:bg-gray-50">
                  <div className={`p-2 rounded-lg ${getSeverityColor(activity.action)}`}>
                    {getActivityIcon(activity.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-medium text-gray-900">
                        {activity.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </h4>
                      <span className="text-sm text-gray-500">
                        {new Date(activity.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{activity.details}</p>
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
              <p className="text-gray-600">No activities found for the selected filter</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t bg-gray-50">
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

// Enhanced Create User Modal Component with RBAC
const CreateUserModal = ({ onSubmit, onClose, loading, rbacOptions }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'contributor',
    status: 'active',
    allowedScopes: [1, 2, 3], // Default: all scopes
    allowedActivities: [], // Default: all activities
    restrictedPages: []
  });
  const [errors, setErrors] = useState({});
  const [showRestrictions, setShowRestrictions] = useState(false);

  useEffect(() => {
    setShowRestrictions(formData.role === 'contributor');
    if (formData.role !== 'contributor') {
      setFormData(prev => ({
        ...prev,
        allowedScopes: [1, 2, 3],
        allowedActivities: [],
        restrictedPages: []
      }));
    }
  }, [formData.role]);

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
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const handleScopeChange = (scope, checked) => {
    if (checked) {
      setFormData(prev => ({
        ...prev,
        allowedScopes: [...prev.allowedScopes, scope]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        allowedScopes: prev.allowedScopes.filter(s => s !== scope)
      }));
    }
  };

  const handleActivityChange = (activity, checked) => {
    if (checked) {
      setFormData(prev => ({
        ...prev,
        allowedActivities: [...prev.allowedActivities, activity]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        allowedActivities: prev.allowedActivities.filter(a => a !== activity)
      }));
    }
  };

  const getActivitiesForScope = (scope) => {
    return rbacOptions.activities[scope] || [];
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Create New User</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter full name"
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  errors.email ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter email address"
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password *
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                errors.password ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter password"
            />
            {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role *
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({...formData, role: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {rbacOptions.roles.map(role => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {rbacOptions.roles.find(r => r.value === formData.role)?.description}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* RBAC Restrictions for Contributors */}
          {showRestrictions && (
            <div className="border-t pt-4">
              <div className="flex items-center space-x-2 mb-4">
                <Lock className="w-5 h-5 text-orange-500" />
                <h3 className="text-lg font-medium text-gray-900">Access Restrictions</h3>
                <span className="text-sm text-gray-500">(For Contributors)</span>
              </div>

              {/* Scope Restrictions */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Allowed Scopes (leave all checked for full access)
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {rbacOptions.scopes.map(scope => (
                    <label key={scope.value} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.allowedScopes.includes(scope.value)}
                        onChange={(e) => handleScopeChange(scope.value, e.target.checked)}
                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-sm text-gray-700">{scope.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Activity Restrictions */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Allowed Activities (leave empty for all activities in allowed scopes)
                </label>
                <div className="space-y-3">
                  {formData.allowedScopes.map(scope => (
                    <div key={scope} className="border rounded-lg p-3">
                      <h4 className="font-medium text-gray-900 mb-2">Scope {scope} Activities</h4>
                      <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                        {getActivitiesForScope(scope).map(activity => (
                          <label key={activity} className="flex items-center space-x-2 text-sm">
                            <input
                              type="checkbox"
                              checked={formData.allowedActivities.includes(activity)}
                              onChange={(e) => handleActivityChange(activity, e.target.checked)}
                              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="text-gray-700 truncate" title={activity}>{activity}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <button 
              type="submit" 
              disabled={loading}
              className="flex-1 bg-emerald-600 text-white py-3 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Create User
                </>
              )}
            </button>
            <button 
              type="button" 
              onClick={onClose}
              disabled={loading}
              className="flex-1 border border-gray-300 py-3 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>STRICT RBAC Permissions:</strong>
          </p>
          <ul className="text-xs text-blue-700 mt-1 space-y-1">
            <li><strong>Admin:</strong> Full system access</li>
            <li><strong>Analyst:</strong> Analytics & Settings only</li>
            <li><strong>Contributor:</strong> Input & Settings only (can be further restricted)</li>
            <li><strong>Viewer:</strong> Dashboard, Monitor, Analytics & Settings (read-only)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;