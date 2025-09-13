// pages/Permissions/Permissions.jsx
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
  Zap
} from 'lucide-react';
// Removed the problematic imports that were causing conflicts

const Permissions = () => {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [generators, setGenerators] = useState([]);
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Sample data based on screenshots
  const sampleUsers = [
    {
      _id: '1',
      name: 'Example One',
      email: 'example@gmail.com',
      role: 'Role 1',
      status: 'Active',
      lastLogin: '05-07-25 (7:30 PM)',
      avatar: 'EO'
    },
    {
      _id: '2',
      name: 'Example One',
      email: 'example@gmail.com',
      role: 'Role 1',
      status: 'Inactive',
      lastLogin: '05-07-25 (7:30 PM)',
      avatar: 'EO'
    },
    {
      _id: '3',
      name: 'Example One',
      email: 'example@gmail.com',
      role: 'Role 1',
      status: 'Inactive',
      lastLogin: '05-07-25 (7:30 PM)',
      avatar: 'EO'
    },
    {
      _id: '4',
      name: 'Example One',
      email: 'example@gmail.com',
      role: 'Role 1',
      status: 'Active',
      lastLogin: '05-07-25 (7:30 PM)',
      avatar: 'EO'
    },
    {
      _id: '5',
      name: 'Example One',
      email: 'example@gmail.com',
      role: 'Role 1',
      status: 'Active',
      lastLogin: '05-07-25 (7:30 PM)',
      avatar: 'EO'
    },
    {
      _id: '6',
      name: 'Example One',
      email: 'example@gmail.com',
      role: 'Role 1',
      status: 'Inactive',
      lastLogin: '05-07-25 (7:30 PM)',
      avatar: 'EO'
    },
    {
      _id: '7',
      name: 'Example One',
      email: 'example@gmail.com',
      role: 'Role 1',
      status: 'Active',
      lastLogin: '05-07-25 (7:30 PM)',
      avatar: 'EO'
    }
  ];

  const sampleVehicles = Array(12).fill(null).map((_, index) => ({
    _id: `vehicle_${index + 1}`,
    registrationNumber: 'GJ 05 1234',
    model: 'Classic 350',
    mileage: '55 km/L',
    type: index % 4 === 0 ? 'motorcycle' : index % 4 === 1 ? 'truck' : index % 4 === 2 ? 'motorcycle' : 'car',
    category: index % 2 === 0 ? 'company' : 'personal',
    owner: 'Jhon Doe',
    driver: 'Jhon Doe',
    status: 'active'
  }));

  const sampleGenerators = Array(8).fill(null).map((_, index) => ({
    _id: `generator_${index + 1}`,
    name: 'Main Generator 1',
    type: 'Diesel Generator',
    capacity: { value: 500, unit: 'kW' },
    location: { building: 'Building A' },
    status: 'active'
  }));

  const sampleOrganization = {
    name: 'Green Tech Solutions Inc.',
    location: 'San Francisco (Headquarters)',
    facilities: [
      {
        name: 'San Francisco',
        type: 'headquarters',
        isMainOffice: true,
        isWarehouse: false
      },
      {
        name: 'Oakland',
        type: 'warehouse',
        isMainOffice: false,
        isWarehouse: true
      },
      {
        name: 'Los Angeles',
        type: 'warehouse',
        isMainOffice: false,
        isWarehouse: true
      }
    ],
    boundary: {
      scopeDefinition: 'All owned and controlled facilities within the controlled United States'
    }
  };

  const tabs = [
    { id: 'users', label: 'User Access Control', icon: Users, count: 12 },
    { id: 'vehicles', label: 'Vehicles', icon: Car, count: 8 },
    { id: 'organization', label: 'Organization Boundary', icon: Building, count: 3 },
    { id: 'generators', label: 'Generators', icon: Zap, count: 6 }
  ];

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      switch (activeTab) {
        case 'users':
          setUsers(sampleUsers);
          break;
        case 'vehicles':
          setVehicles(sampleVehicles);
          break;
        case 'generators':
          setGenerators(sampleGenerators);
          break;
        case 'organization':
          setOrganization(sampleOrganization);
          break;
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = () => {
    console.log('Add user functionality would open here');
  };

  const handleAddVehicle = () => {
    console.log('Add vehicle functionality would open here');
  };

  const handleAddGenerator = () => {
    console.log('Add generator functionality would open here');
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'users':
        return <UserTableComponent users={users} onAddUser={handleAddUser} loading={loading} />;
      case 'vehicles':
        return <VehicleGridComponent vehicles={vehicles} onAddVehicle={handleAddVehicle} loading={loading} />;
      case 'generators':
        return <GeneratorGridComponent generators={generators} onAddGenerator={handleAddGenerator} loading={loading} />;
      case 'organization':
        return <OrganizationBoundaryComponent organization={organization} loading={loading} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
            <span>App</span>
            <span>/</span>
            <span className="text-gray-900 font-medium">Permissions</span>
          </nav>
          <h1 className="text-2xl font-bold text-gray-900">GHG Emissions (Admin)</h1>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="border-b">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
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
                {tab.count && (
                  <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

// UserTable Component (renamed to avoid conflicts)
const UserTableComponent = ({ users, onAddUser, loading }) => {
  const [searchQuery, setSearchQuery] = useState('');

  if (loading) {
    return <div className="text-center py-8">Loading users...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">User Access Control</h3>
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search Data..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 w-80"
            />
          </div>
          <button
            onClick={onAddUser}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors flex items-center space-x-2"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add User</span>
          </button>
          <button className="border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center space-x-2">
            <Filter className="w-4 h-4" />
            <span>Filter</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-emerald-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase tracking-wider">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase tracking-wider">Last Login</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user._id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">{user.avatar}</span>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{user.name}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    user.status === 'Active' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {user.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.lastLogin}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center space-x-2">
                    <button className="text-emerald-600 hover:text-emerald-900">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button className="text-red-600 hover:text-red-900">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// VehicleGrid Component
const VehicleGridComponent = ({ vehicles, onAddVehicle, loading }) => {
  if (loading) {
    return <div className="text-center py-8">Loading vehicles...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Vehicles Management</h3>
        <button
          onClick={onAddVehicle}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors flex items-center space-x-2"
        >
          <Car className="w-4 h-4" />
          <span>Add Vehicle</span>
        </button>
      </div>

      <div className="flex items-center space-x-4 mb-6">
        <span className="flex items-center">
          <span className="w-3 h-3 bg-orange-400 rounded-full mr-2"></span>
          <span className="text-sm text-gray-600">Company Vehicle</span>
        </span>
        <span className="flex items-center">
          <span className="w-3 h-3 bg-blue-400 rounded-full mr-2"></span>
          <span className="text-sm text-gray-600">Personal Vehicle</span>
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {vehicles.map((vehicle) => (
          <div key={vehicle._id} className="bg-green-50 rounded-lg border p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <span className={`w-3 h-3 rounded-full ${
                  vehicle.category === 'company' ? 'bg-orange-400' : 'bg-blue-400'
                }`}></span>
                <div className="p-2 bg-green-100 rounded-lg">
                  <Car className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <div className="flex items-center space-x-1">
                <Edit3 className="w-4 h-4 text-gray-400 cursor-pointer" />
                <Trash2 className="w-4 h-4 text-gray-400 cursor-pointer" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">{vehicle.registrationNumber}</h4>
              <p className="text-sm text-gray-600">({vehicle.model})</p>
              <p className="text-sm text-gray-600">Mileage: {vehicle.mileage}</p>
            </div>

            <div className="mt-4 space-y-1">
              <div className="flex items-center text-sm text-gray-600">
                <Users className="w-4 h-4 mr-2" />
                <span>Owner: {vehicle.owner}</span>
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <Users className="w-4 h-4 mr-2" />
                <span>Driver: {vehicle.driver}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// GeneratorGrid Component
const GeneratorGridComponent = ({ generators, onAddGenerator, loading }) => {
  if (loading) {
    return <div className="text-center py-8">Loading generators...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Generators</h3>
        <button
          onClick={onAddGenerator}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors flex items-center space-x-2"
        >
          <Zap className="w-4 h-4" />
          <span>Add Generators</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {generators.map((generator) => (
          <div key={generator._id} className="bg-green-50 rounded-lg border p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Zap className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex items-center space-x-1">
                <Edit3 className="w-4 h-4 text-gray-400 cursor-pointer" />
                <Trash2 className="w-4 h-4 text-gray-400 cursor-pointer" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">{generator.name}</h4>
              <p className="text-sm text-gray-600">{generator.type}</p>
            </div>

            <div className="mt-4 space-y-1">
              <div className="flex items-center text-sm text-gray-600">
                <SettingsIcon className="w-4 h-4 mr-2" />
                <span>Capacity: {generator.capacity.value}{generator.capacity.unit}</span>
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <Building className="w-4 h-4 mr-2" />
                <span>Location: {generator.location.building}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// OrganizationBoundary Component
const OrganizationBoundaryComponent = ({ organization, loading }) => {
  if (loading) {
    return <div className="text-center py-8">Loading organization data...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Organization Boundary</h3>
        <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors flex items-center space-x-2">
          <Edit3 className="w-4 h-4" />
          <span>Edit Boundary</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {organization?.facilities.map((facility, index) => (
          <div key={index} className="bg-green-50 rounded-lg border p-6">
            <div className="flex items-center mb-4">
              <div className="p-3 bg-green-100 rounded-lg mr-4">
                <Building className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">{organization.name}</h4>
                <p className="text-sm text-gray-600">{facility.name} ({facility.type})</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                  {facility.name}: {facility.isMainOffice ? 'Main Office' : 'Branch'}
                </span>
                <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                  Oakland: {facility.isWarehouse ? 'Warehouse' : 'Office'}
                </span>
                <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                  Los Angeles: Warehouse
                </span>
              </div>

              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Scope Definition:</p>
                <p className="text-sm text-gray-600">{organization.boundary.scopeDefinition}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Permissions;