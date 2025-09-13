import { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  Plus, 
  ChevronLeft, 
  ChevronRight,
  MoreVertical,
  Calendar
} from 'lucide-react';
import { monitorAPI, exportAPI } from '../../services/api';
import PageHeader from '../../components/PageHeader/PageHeader';
import AddTaskModal from '../../components/AddTaskModal/AddTaskModal';
import ActivityTable from '../../components/ActivityTable/ActivityTable';
import Pagination from '../../components/Pagination/Pagination';
import toast from 'react-hot-toast';

const Monitor = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    scope: 'all',
    dateRange: 'all',
    status: 'all'
  });
  const [showAddTask, setShowAddTask] = useState(false);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 100,
    itemsPerPage: 9
  });

  // Sample activity data based on the screenshots
  const sampleActivities = [
    {
      _id: '1',
      user: { name: 'Jhon Doe', avatar: 'JD' },
      scope: 'Scope 1',
      activityType: 'Fuel from Generator',
      source: 'Diesel, HSD, Biofuel',
      accountingPeriod: '28/05/2025',
      emissions: 375200,
      status: 'active',
      createdAt: '2025-05-28'
    },
    {
      _id: '2',
      user: { name: 'Example One', avatar: 'EO' },
      scope: 'Scope 1',
      activityType: 'Wood Burnt for Boilers',
      source: 'Firewood, Coconut Husk',
      accountingPeriod: '29/05/2025',
      emissions: 40,
      status: 'active',
      createdAt: '2025-05-29'
    },
    {
      _id: '3',
      user: { name: 'Example One', avatar: 'EO' },
      scope: 'Scope 1',
      activityType: 'Fuel Used by Company vehicles',
      source: 'Diesel, Petrol, Electric',
      accountingPeriod: '27/05/2025',
      emissions: 25,
      status: 'active',
      createdAt: '2025-05-27'
    },
    {
      _id: '4',
      user: { name: 'Example One', avatar: 'EO' },
      scope: 'Scope 2',
      activityType: 'Electricity Purchased',
      source: 'fossil-fuel-based',
      accountingPeriod: '28/05/2025',
      emissions: 30,
      status: 'active',
      createdAt: '2025-05-28'
    },
    {
      _id: '5',
      user: { name: 'Example One', avatar: 'EO' },
      scope: 'Scope 3',
      activityType: 'Export of Material',
      source: 'Logistics-related emissions',
      accountingPeriod: '30/05/2025',
      emissions: 50,
      status: 'active',
      createdAt: '2025-05-30'
    },
    {
      _id: '6',
      user: { name: 'Example One', avatar: 'EO' },
      scope: 'Scope 3',
      activityType: 'Business travel',
      source: 'flights, trains, or taxis',
      accountingPeriod: '29/05/2025',
      emissions: 60,
      status: 'active',
      createdAt: '2025-05-29'
    },
    {
      _id: '7',
      user: { name: 'Example One', avatar: 'EO' },
      scope: 'Scope 3',
      activityType: 'Export of Material',
      source: 'ship, air, or road',
      accountingPeriod: '27/05/2025',
      emissions: 15,
      status: 'active',
      createdAt: '2025-05-27'
    },
    {
      _id: '8',
      user: { name: 'Example One', avatar: 'EO' },
      scope: 'Scope 1',
      activityType: 'Water Used',
      source: 'Borewell, Municipality, Tanker',
      accountingPeriod: '28/05/2025',
      emissions: 50,
      status: 'active',
      createdAt: '2025-05-28'
    },
    {
      _id: '9',
      user: { name: 'Example One', avatar: 'EO' },
      scope: 'Scope 1',
      activityType: 'Fuel used in mess',
      source: 'LPG, firewood, or kerosene',
      accountingPeriod: '29/05/2025',
      emissions: 50,
      status: 'active',
      createdAt: '2025-05-29'
    }
  ];

  useEffect(() => {
    loadActivities();
  }, [pagination.currentPage, filters, searchQuery]);

  const loadActivities = async () => {
    try {
      setLoading(true);
      // In real app, this would fetch from API
      // const response = await monitorAPI.getActivities({
      //   page: pagination.currentPage,
      //   limit: pagination.itemsPerPage,
      //   search: searchQuery,
      //   ...filters
      // });
      
      // For now, using sample data
      const filteredActivities = sampleActivities.filter(activity => {
        const matchesSearch = searchQuery === '' || 
          activity.activityType.toLowerCase().includes(searchQuery.toLowerCase()) ||
          activity.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
          activity.user.name.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesScope = filters.scope === 'all' || activity.scope === filters.scope;
        
        return matchesSearch && matchesScope;
      });
      
      setActivities(filteredActivities);
    } catch (error) {
      console.error('Error loading activities:', error);
      toast.error('Failed to load activities');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format = 'csv') => {
    try {
      const blob = await exportAPI.exportActivities(format, {
        search: searchQuery,
        ...filters
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `activities_export.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success(`Activities exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export failed');
    }
  };

  const handleAddTask = async (taskData) => {
    try {
      await monitorAPI.createTask(taskData);
      toast.success('Task added successfully!');
      setShowAddTask(false);
      loadActivities(); // Refresh the list
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader 
        title="Monitor"
        breadcrumb={[
          { label: 'App', href: '/' },
          { label: 'Monitor' }
        ]}
      />

      {/* Controls Section */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center justify-between">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search Data..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 w-80"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowAddTask(true)}
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Task</span>
            </button>

            <button
              onClick={() => handleFilterChange('scope', filters.scope)}
              className="border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2"
            >
              <Filter className="w-4 h-4" />
              <span>Filter</span>
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
        <ActivityTable 
          activities={activities}
          loading={loading}
          onRefresh={loadActivities}
        />

        {/* Pagination */}
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