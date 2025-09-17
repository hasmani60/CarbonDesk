// pages/Permissions/Permissions.jsx - Enhanced with user management
import { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  UserPlus,
  Edit3,
  Trash2,
  MoreVertical,
  Settings as SettingsIcon,
  Car,
  Building,
  Zap,
  Crown,
  Shield,
  Eye,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { adminAPI, isAdmin, canManageUsers } from '../../services/api';
import PageHeader from '../../components/PageHeader/PageHeader';
import toast from 'react-hot-toast';

const Permissions = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [generators, setGenerators] = useState([]);
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userStats, setUserStats] = useState(null);

  const tabs = [
    { id: 'users', label: 'User Management', icon: Users, count: 0, adminOnly: false },
    { id: 'vehicles', label: 'Vehicles', icon: Car, count: 8, adminOnly: false },
    { id: 'organization', label: 'Organization Boundary', icon: Building, count: 3, adminOnly: true },
    { id: 'generators', label: 'Generators', icon: Zap, count: 6, adminOnly: false }
  ];

  // Filter tabs based on user role
  const visibleTabs = tabs.filter(tab => 
    !tab.adminOnly || isAdmin(user?.role)
  );

  useEffect(() => {
    loadData();
  }, [activeTab]);

  useEffect(() => {
    if (isAdmin(user?.role)) {
      loadUserStats();
    }
  }, []);

  const loadUserStats = async () => {
    try {
      const stats = await adminAPI.getUserStats();
      setUserStats(stats);
    } catch (error) {
      console.error('Error loading user stats:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      switch (activeTab) {
        case 'users':
          if (isAdmin(user?.role)) {
            await loadUsers();
          }
          break;
        case 'vehicles':
          setVehicles(getSampleVehicles());
          break;
        case 'generators':
          setGenerators(getSampleGenerators());
          break;
        case 'organization':
          setOrganization(getSampleOrganization());
          break;
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await adminAPI.getAllUsers({
        search: searchQuery
      });
      setUsers(response.data || []);
      // Update tab count
      const userTab = visibleTabs.find(tab => tab.id === 'users');
      if (userTab) {
        userTab.count = response.data?.length || 0;
      }
    } catch (error) {
      console.error('Error loading users:', error);
      // Fallback to sample data
      setUsers(getSampleUsers());
    }
  };

  const handleCreateUser = async (userData) => {
    try {
      await adminAPI.createUser(userData);
      toast.success('User created successfully');
      loadUsers();
      setShowUserModal(false);
    } catch (error) {
      toast.error(error.message || 'Failed to create user');
    }
  };

  const handleUpdateUserRole = async (userId, newRole) => {
    try {
      await adminAPI.updateUserRole(userId, newRole);
      toast.success('User role updated successfully');
      loadUsers();
    } catch (error) {
      toast.error(error.message || 'Failed to update user role');
    }
  };

  const handleUpdateUserStatus = async (userId, newStatus) => {
    try {
      await adminAPI.updateUserStatus(userId, newStatus);
      toast.success('User status updated successfully');
      loadUsers();
    } catch (error) {
      toast.error(error.message || 'Failed to update user status');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      await adminAPI.deleteUser(userId);
      toast.success('User deleted successfully');
      loadUsers();
    } catch (error) {
      toast.error(error.message || 'Failed to delete user');
    }
  };

  // Sample data functions (as fallbacks)
  const getSampleUsers = () => Array(7).fill(null).map((_, index) => ({
    _id: `user_${index + 1}`,
    name: 'Example User',
    email: `user${index + 1}@example.com`,
    role: ['admin', 'analyst', 'contributor', 'viewer'][index % 4],
    status: ['active', 'inactive'][index % 2],
    lastLogin: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
    statistics: {
      emissionCount: Math.floor(Math.random() * 50),
      recentActivityCount: Math.floor(Math.random() * 10),
      joinedDaysAgo: Math.floor(Math.random() * 90)
    }
  }));

  const getSampleVehicles = () => Array(8).fill(null).map((_, index) => ({
    _id: `vehicle_${index + 1}`,
    registrationNumber: 'GJ 05 1234',
    model: 'Classic 350',
    mileage: '55 km/L',
    type: ['motorcycle', 'truck', 'car'][index % 3],
    category: index % 2 === 0 ? 'company' : 'personal',
    owner: 'Jhon Doe',
    driver: 'Jhon Doe',
    status: 'active'
  }));

  const getSampleGenerators = () => Array(6).fill(null).map((_, index) => ({
    _id: `generator_${index + 1}`,
    name: `Generator ${index + 1}`,
    type: 'Diesel Generator',
    capacity: { value: 500, unit: 'kW' },
    location: { building: `Building ${String.fromCharCode(65 + index)}` },
    status: 'active'
  }));

  const getSampleOrganization = () => ({
    name: 'Green Tech Solutions Inc.',
    location: 'San Francisco (Headquarters)',
    facilities: [
      { name: 'San Francisco', type: 'headquarters', isMainOffice: true, isWarehouse: false },
      { name: 'Oakland', type: 'warehouse', isMainOffice: false, isWarehouse: true }
    ],
    boundary: { scopeDefinition: 'All owned and controlled facilities within the controlled United States' }
  });

  const renderUserManagement = () => {
    if (!canManageUsers(user?.role)) {
      return (
        <div className="text-center py-12">
          <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Restricted</h3>
          <p className="text-gray-600">You need admin or analyst privileges to manage users.</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
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

        {/* User Management Controls */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">User Access Control</h3>
          <div className="flex items-center space-x-3">
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
            {isAdmin(user?.role) && (
              <button
                onClick={() => setShowUserModal(true)}
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors flex items-center space-x-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add User</span>
              </button>
            )}
            <button className="border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center space-x-2">
              <Filter className="w-4 h-4" />
              <span>Filter</span>
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-emerald-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase">Activity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase">Last Login</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((userItem) => (
                  <tr key={userItem._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-medium">
                            {userItem.name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{userItem.name}</div>
                          <div className="text-sm text-gray-500">{userItem.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {isAdmin(user?.role) ? (
                          <select
                            value={userItem.role}
                            onChange={(e) => handleUpdateUserRole(userItem._id, e.target.value)}
                            className="text-xs px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="admin">Admin</option>
                            <option value="analyst">Analyst</option>
                            <option value="contributor">Contributor</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        ) : (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            getRoleBadgeColor(userItem.role)
                          }`}>
                            {getRoleIcon(userItem.role)}
                            {userItem.role.charAt(0).toUpperCase() + userItem.role.slice(1)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {isAdmin(user?.role) ? (
                        <select
                          value={userItem.status}
                          onChange={(e) => handleUpdateUserStatus(userItem._id, e.target.value)}
                          className={`text-xs px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                            getStatusBadgeColor(userItem.status)
                          }`}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="suspended">Suspended</option>
                        </select>
                      ) : (
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          getStatusBadgeColor(userItem.status)
                        }`}>
                          {userItem.status.charAt(0).toUpperCase() + userItem.status.slice(1)}
                        </span>
                      )}
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
                      {userItem.lastLogin || 'Never'}
                    </td>
                    <td className="px-6 py-4">
                      {isAdmin(user?.role) && (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setSelectedUser(userItem)}
                            className="text-emerald-600 hover:text-emerald-900"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(userItem._id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
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

  const renderTabContent = () => {
    switch (activeTab) {
      case 'users':
        return renderUserManagement();
      case 'vehicles':
        return <VehicleGridComponent vehicles={vehicles} loading={loading} />;
      case 'generators':
        return <GeneratorGridComponent generators={generators} loading={loading} />;
      case 'organization':
        return <OrganizationBoundaryComponent organization={organization} loading={loading} />;
      default:
        return <div>Content not available</div>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="System Management"
        breadcrumb={[
          { label: 'App', href: '/' },
          { label: 'System Management' }
        ]}
      />

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="border-b">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {visibleTabs.map((tab) => (
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
                {tab.count > 0 && (
                  <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                    {tab.count}
                  </span>
                )}
                {tab.adminOnly && (
                  <Crown className="w-3 h-3 text-yellow-500" />
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading...</p>
            </div>
          ) : (
            renderTabContent()
          )}
        </div>
      </div>

      {/* Create User Modal */}
      {showUserModal && (
        <CreateUserModal
          onSubmit={handleCreateUser}
          onClose={() => setShowUserModal(false)}
        />
      )}
    </div>
  );
};

// Sample components for other tabs (simplified for space)
const VehicleGridComponent = ({ vehicles, loading }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    {vehicles.map((vehicle) => (
      <div key={vehicle._id} className="bg-green-50 rounded-lg border p-4">
        <div className="flex items-center justify-between mb-3">
          <Car className="w-6 h-6 text-green-600" />
          <div className="flex space-x-2">
            <Edit3 className="w-4 h-4 text-gray-400 cursor-pointer" />
            <Trash2 className="w-4 h-4 text-gray-400 cursor-pointer" />
          </div>
        </div>
        <h4 className="font-medium text-gray-900">{vehicle.registrationNumber}</h4>
        <p className="text-sm text-gray-600">{vehicle.model}</p>
      </div>
    ))}
  </div>
);

const GeneratorGridComponent = ({ generators, loading }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    {generators.map((generator) => (
      <div key={generator._id} className="bg-green-50 rounded-lg border p-4">
        <div className="flex items-center justify-between mb-3">
          <Zap className="w-6 h-6 text-green-600" />
          <div className="flex space-x-2">
            <Edit3 className="w-4 h-4 text-gray-400 cursor-pointer" />
            <Trash2 className="w-4 h-4 text-gray-400 cursor-pointer" />
          </div>
        </div>
        <h4 className="font-medium text-gray-900">{generator.name}</h4>
        <p className="text-sm text-gray-600">{generator.type}</p>
      </div>
    ))}
  </div>
);

const OrganizationBoundaryComponent = ({ organization, loading }) => (
  <div className="bg-green-50 rounded-lg border p-6">
    <div className="flex items-center mb-4">
      <Building className="w-6 h-6 text-green-600 mr-3" />
      <h4 className="font-semibold text-gray-900">{organization?.name}</h4>
    </div>
    <p className="text-sm text-gray-600">{organization?.boundary?.scopeDefinition}</p>
  </div>
);

// Create User Modal Component
const CreateUserModal = ({ onSubmit, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'contributor'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Create New User</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Full Name"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            className="w-full p-2 border rounded-lg"
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            className="w-full p-2 border rounded-lg"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            className="w-full p-2 border rounded-lg"
            required
          />
          <select
            value={formData.role}
            onChange={(e) => setFormData({...formData, role: e.target.value})}
            className="w-full p-2 border rounded-lg"
          >
            <option value="contributor">Contributor</option>
            <option value="analyst">Analyst</option>
            <option value="viewer">Viewer</option>
            <option value="admin">Admin</option>
          </select>
          <div className="flex space-x-3 pt-4">
            <button type="submit" className="flex-1 bg-emerald-600 text-white py-2 rounded-lg">
              Create User
            </button>
            <button type="button" onClick={onClose} className="flex-1 border py-2 rounded-lg">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Permissions;