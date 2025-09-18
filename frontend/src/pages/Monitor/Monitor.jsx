// Updated Monitor.jsx with real-time data and proper emission tracking
import { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  Plus, 
  RefreshCw,
  Calendar,
  Eye,
  User,
  Clock,
  TrendingUp
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useActivity } from '../../context/ActivityContext';
import { monitorAPI, exportAPI } from '../../services/api';
import { getEmissions, getEmissionsStats } from '../../utils/localStorage';
import PageHeader from '../../components/PageHeader/PageHeader';
import AddTaskModal from '../../components/AddTaskModal/AddTaskModal';
import Pagination from '../../components/Pagination/Pagination';
import toast from 'react-hot-toast';

const Monitor = () => {
  const { user } = useAuth();
  const { logPageView, logActivity } = useActivity();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    scope: 'all',
    dateRange: 'all',
    status: 'all',
    user: 'all'
  });
  const [showAddTask, setShowAddTask] = useState(false);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 10
  });
  const [emissionStats, setEmissionStats] = useState({
    total: 0,
    scope1: 0,
    scope2: 0,
    scope3: 0
  });

  useEffect(() => {
    logPageView('Monitor');
    loadActivities();
    
    // Listen for real-time updates when emissions are added
    window.addEventListener('emission-added', handleEmissionAdded);
    
    // Set up periodic refresh every 30 seconds
    const refreshInterval = setInterval(loadActivities, 30000);
    
    return () => {
      window.removeEventListener('emission-added', handleEmissionAdded);
      clearInterval(refreshInterval);
    };
  }, []);

  useEffect(() => {
    loadActivities();
  }, [pagination.currentPage, filters, searchQuery]);

  const handleEmissionAdded = (event) => {
    console.log('New emission added:', event.detail);
    loadActivities(); // Refresh the activities list
    toast.success('Monitor updated with new emission!');
  };

  const loadActivities = async () => {
    try {
      setLoading(true);
      
      // Get real emissions data from localStorage
      const allEmissions = getEmissions();
      const stats = getEmissionsStats();
      
      // Update emission stats
      setEmissionStats({
        total: stats.scope1.total + stats.scope2.total + stats.scope3.total,
        scope1: stats.scope1.total,
        scope2: stats.scope2.total,
        scope3: stats.scope3.total
      });
      
      // Convert emissions to activity format for display
      let processedActivities = allEmissions.map(emission => ({
        _id: emission.id,
        user: {
          name: emission.userName || 'Unknown User',
          avatar: emission.userName ? emission.userName.split(' ').map(n => n[0]).join('') : 'UU',
          id: emission.user
        },
        scope: `Scope ${emission.scope}`,
        activityType: emission.category || emission.activityType || 'Unknown Activity',
        source: emission.subcategory || emission.source || 'Unknown Source',
        accountingPeriod: formatAccountingPeriod(emission.accountingPeriod),
        emissions: emission.calculatedEmissions || emission.totalEmissions || 0,
        status: emission.status || 'active',
        createdAt: emission.createdAt,
        amount: emission.amount,
        unit: emission.unit,
        location: emission.location,
        description: emission.description,
        startDate: emission.startDate,
        endDate: emission.endDate,
        emissionFactor: emission.factor || 1.0
      }));

      // Apply filters
      processedActivities = applyFilters(processedActivities);
      
      // Apply search
      if (searchQuery.trim()) {
        processedActivities = processedActivities.filter(activity => 
          activity.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          activity.activityType.toLowerCase().includes(searchQuery.toLowerCase()) ||
          activity.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
          activity.scope.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      
      // Sort by creation date (newest first)
      processedActivities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      // Update pagination
      const totalItems = processedActivities.length;
      const totalPages = Math.ceil(totalItems / pagination.itemsPerPage);
      
      setPagination(prev => ({
        ...prev,
        totalItems,
        totalPages
      }));
      
      // Get current page items
      const startIndex = (pagination.currentPage - 1) * pagination.itemsPerPage;
      const endIndex = startIndex + pagination.itemsPerPage;
      const currentPageActivities = processedActivities.slice(startIndex, endIndex);
      
      setActivities(currentPageActivities);
      
      // Log monitoring activity
      logActivity('viewed_monitor', 'monitor', null, `Viewed ${currentPageActivities.length} emission activities`);
      
    } catch (error) {
      console.error('Error loading activities:', error);
      toast.error('Failed to load activities');
    } finally {
      setLoading(false);
    }
  };

  const formatAccountingPeriod = (period) => {
    if (!period) return 'N/A';
    if (typeof period === 'string') return period;
    
    if (period.start) {
      const startDate = new Date(period.start);
      return startDate.toLocaleDateString('en-GB');
    }
    return 'N/A';
  };

  const applyFilters = (activities) => {
    return activities.filter(activity => {
      // Scope filter
      if (filters.scope !== 'all') {
        const scopeNumber = activity.scope.replace('Scope ', '');
        if (scopeNumber !== filters.scope) return false;
      }
      
      // Status filter
      if (filters.status !== 'all' && activity.status !== filters.status) {
        return false;
      }
      
      // Date range filter
      if (filters.dateRange !== 'all') {
        const activityDate = new Date(activity.createdAt);
        const now = new Date();
        let dateThreshold;
        
        switch (filters.dateRange) {
          case '7days':
            dateThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case '30days':
            dateThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case '90days':
            dateThreshold = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
          default:
            dateThreshold = new Date(0);
        }
        
        if (activityDate < dateThreshold) return false;
      }
      
      return true;
    });
  };

  const handleExport = async (format = 'csv') => {
    try {
      // Create export data
      const exportData = activities.map(activity => ({
        'User Name': activity.user.name,
        'Scope': activity.scope,
        'Activity Type': activity.activityType,
        'Source': activity.source,
        'Amount': activity.amount,
        'Unit': activity.unit,
        'Emissions (CO2e)': activity.emissions.toFixed(2),
        'Accounting Period': activity.accountingPeriod,
        'Location': activity.location || '',
        'Status': activity.status,
        'Created At': new Date(activity.createdAt).toLocaleString(),
        'Description': activity.description || ''
      }));
      
      // Convert to CSV
      const csvContent = convertToCSV(exportData);
      const blob = new Blob([csvContent], { type: 'text/csv' });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `emission_activities_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success(`Activities exported as ${format.toUpperCase()}`);
      logActivity('exported_data', 'monitor', null, `Exported ${activities.length} activities as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Export error:', error);
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

  const handleAddTask = async (taskData) => {
    try {
      toast.success('Task functionality coming soon!');
      setShowAddTask(false);
    } catch (error) {
      console.error('Task creation error:', error);
      toast.error('Failed to add task');
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  const handlePageChange = (page) => {
    setPagination(prev => ({ ...prev, currentPage: page }));
  };

  const formatNumber = (value) => {
    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
    if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
    return value.toFixed(1);
  };

  const getScopeColor = (scope) => {
    switch (scope) {
      case 'Scope 1': return 'bg-emerald-100 text-emerald-800';
      case 'Scope 2': return 'bg-blue-100 text-blue-800';
      case 'Scope 3': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'verified': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader 
        title="Monitor - Real-time Activity Tracking"
        breadcrumb={[
          { label: 'App', href: '/' },
          { label: 'Monitor' }
        ]}
        action={
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Auto-refresh: ON</span>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Emissions</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatNumber(emissionStats.total)} CO₂e
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-emerald-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Scope 1</p>
              <p className="text-2xl font-bold text-emerald-900">
                {formatNumber(emissionStats.scope1)}
              </p>
            </div>
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <span className="text-emerald-600 font-bold">1</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Scope 2</p>
              <p className="text-2xl font-bold text-blue-900">
                {formatNumber(emissionStats.scope2)}
              </p>
            </div>
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-blue-600 font-bold">2</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Scope 3</p>
              <p className="text-2xl font-bold text-red-900">
                {formatNumber(emissionStats.scope3)}
              </p>
            </div>
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
              <span className="text-red-600 font-bold">3</span>
            </div>
          </div>
        </div>
      </div>

      {/* Controls Section */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search activities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 w-80"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center space-x-3">
            <select
              value={filters.scope}
              onChange={(e) => handleFilterChange('scope', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Scopes</option>
              <option value="1">Scope 1</option>
              <option value="2">Scope 2</option>
              <option value="3">Scope 3</option>
            </select>

            <select
              value={filters.dateRange}
              onChange={(e) => handleFilterChange('dateRange', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Time</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="90days">Last 90 Days</option>
            </select>

            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
            <button
              onClick={loadActivities}
              className="border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>

            <button
              onClick={() => handleExport('csv')}
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* Activity Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activities</h3>
            <span className="text-sm text-gray-600">
              {pagination.totalItems} total activities
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-12">
            <Eye className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No activities found</p>
            <p className="text-sm text-gray-500">Try adjusting your filters or add some emissions data</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-emerald-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase">Scope</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase">Activity Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase">Source</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase">Emissions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase">Period</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 uppercase">Created</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {activities.map((activity) => (
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
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getScopeColor(activity.scope)}`}>
                        {activity.scope}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="max-w-xs truncate" title={activity.activityType}>
                        {activity.activityType}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="max-w-xs truncate" title={activity.source}>
                        {activity.source}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {activity.amount} {activity.unit}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                      {formatNumber(activity.emissions)} CO₂e
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {activity.accountingPeriod}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(activity.status)}`}>
                        {activity.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-4 h-4" />
                        <span>{new Date(activity.createdAt).toLocaleString()}</span>
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
                of {pagination.totalItems} results
              </div>
              
              <Pagination 
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          </div>
        )}
      </div>

      {/* Add Task Modal */}
      {showAddTask && (
        <AddTaskModal
          onSubmit={handleAddTask}
          onClose={() => setShowAddTask(false)}
        />
      )}
    </div>
  );
};

export default Monitor;