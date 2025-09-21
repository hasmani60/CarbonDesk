// pages/Admin/UserManagement.jsx - Complete User Management with Add User
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
  Download
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { adminAPI } from '../../services/api';
import PageHeader from '../../components/PageHeader/PageHeader';
import toast from 'react-hot-toast';

const UserManagement = () => {
  const { user, isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [filters, setFilters] = useState({
    role: 'all',
    status: 'all'
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
    }
  }, [searchQuery, filters, pagination.currentPage]);

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
        setUsers(response.data || response || []);
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
      
      // Fallback to demo data
      setUsers(getDemoUsers());
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
      // Set demo stats
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

  const handleCreateUser = async (userData) => {
    try {
      setLoading(true);
      const response = await adminAPI.createUser(userData);
      
      if (response.success !== false) {
        toast.success(`User created successfully: ${userData.name}`);
        setShowUserModal(false);
        loadUsers();
        loadUserStats();
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
        'Emissions': userItem.statistics?.emissionCount || 0,
        'Activities': userItem.statistics?.recentActivityCount || 0
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

  const getDemoUsers = () => [
    {
      _id: 'demo_admin',
      name: 'Demo Admin',
      email: 'demo@example.com',
      role: 'admin',
      status: 'active',
      createdAt: new Date(),
      lastLogin: new Date(),
      statistics: { emissionCount: 15, recentActivityCount: 5 }
    },
    {
      _id: 'demo_analyst',
      name: 'Demo Analyst',
      email: 'analyst@example.com',
      role: 'analyst',
      status: 'active',
      createdAt: new Date(),
      lastLogin: new Date(),
      statistics: { emissionCount: 10, recentActivityCount: 3 }
    },
    {
      _id: 'demo_contributor',
      name: 'Demo Contributor',
      email: 'contributor@example.com',
      role: 'contributor',
      status: 'active',
      createdAt: new Date(),
      lastLogin: new Date(),
      statistics: { emissionCount: 5, recentActivityCount: 2 }
    },
    {
      _id: 'demo_viewer',
      name: 'Demo Viewer',
      email: 'viewer@example.com',
      role: 'viewer',
      status: 'active',
      createdAt: new Date(),
      lastLogin: new Date(),
      statistics: { emissionCount: 0, recentActivityCount: 1 }
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
        title="User Management"
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

      {/* User Statistics Cards */}
      {userStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{userStats.overview.totalUsers}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Users</p>
                <p className="text-2xl font-bold text-gray-900">{userStats.overview.activeUsers}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <Crown className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Admins</p>
                <p className="text-2xl font-bold text-gray-900">{userStats.overview.adminUsers}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Inactive</p>
                <p className="text-2xl font-bold text-gray-900">{userStats.overview.inactiveUsers}</p>
              </div>
            </div>
          </div>
        </div>
      )}

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
          <p className="text-sm text-gray-600 mt-1">Manage user accounts, roles, and permissions</p>
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
                        disabled={userItem._id === user.id} // Prevent self-modification
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
                        disabled={userItem._id === user.id} // Prevent self-modification
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="suspended">Suspended</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {userItem.statistics?.emissionCount || 0} emissions
                      </div>
                      <div className="text-xs text-gray-500">
                        {userItem.statistics?.recentActivityCount || 0} recent activities
                      </div>
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

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="border-t px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} to{' '}
                {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)}{' '}
                of {pagination.totalItems} users
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

      {/* Create User Modal */}
      {showUserModal && (
        <CreateUserModal
          onSubmit={handleCreateUser}
          onClose={() => setShowUserModal(false)}
          loading={loading}
        />
      )}
    </div>
  );
};

// Create User Modal Component
const CreateUserModal = ({ onSubmit, onClose, loading }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'contributor',
    status: 'active'
  });
  const [errors, setErrors] = useState({});

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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({...formData, role: e.target.value})}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="contributor">Contributor</option>
              <option value="analyst">Analyst</option>
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
            </select>
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
            <strong>Role Permissions:</strong>
          </p>
          <ul className="text-xs text-blue-700 mt-1 space-y-1">
            <li><strong>Admin:</strong> Full system access and user management</li>
            <li><strong>Analyst:</strong> Data analysis, reporting, and verification</li>
            <li><strong>Contributor:</strong> Data entry and own data management</li>
            <li><strong>Viewer:</strong> Read-only access to data</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;