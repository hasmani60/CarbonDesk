// frontend/src/pages/Monitor/Monitor_ENHANCED.jsx
// Enhanced Monitor with user-separated task views and admin view-only restrictions

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
  TrendingUp,
  Database,
  AlertCircle,
  Users,
  CheckSquare,
  Activity,
  CheckCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useActivity } from '../../context/ActivityContext';
import { getEmissions, getEmissionsStats } from '../../utils/localStorage';
import PageHeader from '../../components/PageHeader/PageHeader';
import Pagination from '../../components/Pagination/Pagination';
import TaskAssignmentModal from '../../components/TaskAssignmentModal/TaskAssignmentModal';
import toast from 'react-hot-toast';

const Monitor = () => {
  const { user, isAdmin } = useAuth();
  const { logPageView, logActivity } = useActivity();
  
  // Activity monitoring state
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    scope: 'all',
    dateRange: 'all',
    status: 'all',
    user: 'all'
  });
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

  // Task assignment state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskAssignmentLoading, setTaskAssignmentLoading] = useState(false);
  const [taskStats, setTaskStats] = useState(null);
  
  // Task viewing state
  const [tasksByUser, setTasksByUser] = useState({});
  const [expandedUsers, setExpandedUsers] = useState({});
  const [tasksLoading, setTasksLoading] = useState(false);

  // View state
  const [activeTab, setActiveTab] = useState('activities'); // activities, tasks

  // Backend URL
  const BACKEND_URL = 'http://localhost:5001';

  useEffect(() => {
    logPageView('Monitor Enhanced');
    loadActivities();
    if (isAdmin) {
      loadAllUserTasks();
    }
    loadTaskStats();
    
    window.addEventListener('emission-added', handleEmissionAdded);
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
    console.log('📄 New emission added, refreshing monitor');
    loadActivities();
    toast.success('Monitor updated with new emission!');
  };

  // NEW: Load all users' tasks grouped by user
  const loadAllUserTasks = async () => {
    if (!isAdmin) return;
    
    try {
      setTasksLoading(true);
      
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No auth token');
        return;
      }
      
      // First, get list of assignable users
      const usersResponse = await fetch(`${BACKEND_URL}/api/tasks/assignable-users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!usersResponse.ok) {
        console.error('Failed to load users');
        return;
      }
      
      const usersResult = await usersResponse.json();
      const users = usersResult.data || [];
      
      // For each user, load their tasks
      const tasksByUserMap = {};
      
      for (const targetUser of users) {
        const tasksResponse = await fetch(
          `${BACKEND_URL}/api/tasks?assigned_to=${targetUser.id}`, 
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (tasksResponse.ok) {
          const tasksResult = await tasksResponse.json();
          if (tasksResult.success && tasksResult.data) {
            tasksByUserMap[targetUser.id] = {
              user: targetUser,
              tasks: tasksResult.data,
              stats: {
                total: tasksResult.data.length,
                pending: tasksResult.data.filter(t => t.status === 'pending').length,
                in_progress: tasksResult.data.filter(t => t.status === 'in_progress').length,
                completed: tasksResult.data.filter(t => t.status === 'completed').length,
                overdue: tasksResult.data.filter(t => {
                  const deadline = new Date(t.deadline);
                  const now = new Date();
                  return deadline < now && t.status !== 'completed';
                }).length
              }
            };
          }
        }
      }
      
      setTasksByUser(tasksByUserMap);
      console.log('✅ Loaded tasks for', Object.keys(tasksByUserMap).length, 'users');
      
    } catch (error) {
      console.error('❌ Error loading user tasks:', error);
      toast.error('Failed to load user tasks');
    } finally {
      setTasksLoading(false);
    }
  };

  const loadActivities = async () => {
    try {
      setLoading(true);
      
      console.log('📊 Loading activities for organisation:', user?.organisation_id);
      
      const allEmissions = getEmissions();
      const stats = getEmissionsStats();
      
      console.log(`✅ Loaded ${allEmissions.length} emissions for current organisation`);
      
      setEmissionStats({
        total: stats.scope1.total + stats.scope2.total + stats.scope3.total,
        scope1: stats.scope1.total,
        scope2: stats.scope2.total,
        scope3: stats.scope3.total
      });
      
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
        emissionFactor: emission.factor || 1.0,
        organisation_id: emission.organisation_id
      }));

      processedActivities = applyFilters(processedActivities);
      
      if (searchQuery.trim()) {
        processedActivities = processedActivities.filter(activity => 
          activity.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          activity.activityType.toLowerCase().includes(searchQuery.toLowerCase()) ||
          activity.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
          activity.scope.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      
      processedActivities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      const totalItems = processedActivities.length;
      const totalPages = Math.ceil(totalItems / pagination.itemsPerPage);
      
      setPagination(prev => ({
        ...prev,
        totalItems,
        totalPages
      }));
      
      const startIndex = (pagination.currentPage - 1) * pagination.itemsPerPage;
      const endIndex = startIndex + pagination.itemsPerPage;
      const currentPageActivities = processedActivities.slice(startIndex, endIndex);
      
      setActivities(currentPageActivities);
      
      logActivity('viewed_monitor', 'monitor', null, `Viewed ${currentPageActivities.length} emission activities`);
      
    } catch (error) {
      console.error('❌ Error loading activities:', error);
      toast.error('Failed to load activities');
    } finally {
      setLoading(false);
    }
  };

  const loadTaskStats = async () => {
    if (!isAdmin) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${BACKEND_URL}/api/tasks/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        setTaskStats(result.data);
      }
    } catch (error) {
      console.error('Error loading task stats:', error);
    }
  };

  const handleTaskAssignment = async (taskData) => {
    try {
      setTaskAssignmentLoading(true);
      console.log('📋 Submitting task assignment:', taskData);
      
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Authentication required. Please log in again.');
        return;
      }
      
      const submissionData = {
        assignedToUserId: parseInt(taskData.assignedToUserId),
        scope: parseInt(taskData.scope),
        activity: taskData.activity.trim(),
        source: taskData.source ? taskData.source.trim() : '',
        startDate: taskData.startDate,
        endDate: taskData.endDate,
        deadline: taskData.deadline,
        comments: taskData.comments ? taskData.comments.trim() : '',
        priority: taskData.priority || 'medium'
      };
      
      const response = await fetch(`${BACKEND_URL}/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(submissionData)
      });
      
      const responseText = await response.text();
      
      if (!responseText || responseText.trim() === '') {
        console.error('❌ Empty response from server');
        toast.error('Server returned empty response. Check backend logs.');
        return;
      }
      
      if (responseText.startsWith('<!DOCTYPE') || responseText.startsWith('<html')) {
        console.error('❌ Received HTML instead of JSON');
        toast.error('Task endpoint not found. Check backend configuration.');
        return;
      }
      
      let result;
      try {
        result = JSON.parse(responseText);
        console.log('✅ Parsed response:', result);
      } catch (parseError) {
        console.error('❌ JSON parse error:', parseError);
        toast.error('Invalid response from server. Check backend logs.');
        return;
      }
      
      if (response.ok && result.success) {
        toast.success('Task assigned successfully! 🎉');
        setShowTaskModal(false);
        
        await loadActivities();
        await loadTaskStats();
        await loadAllUserTasks(); // Reload user tasks
        
        logActivity('task_assigned', 'task', result.data?.id, 
          `Assigned task: ${submissionData.activity} to user ID ${submissionData.assignedToUserId}`);
          
      } else {
        const errorMessage = result.message || `Error ${response.status}: ${response.statusText}`;
        console.error('❌ Task creation failed:', errorMessage);
        toast.error(errorMessage);
      }
      
    } catch (error) {
      console.error('❌ Error assigning task:', error);
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        toast.error('Cannot connect to backend. Is server running on port 5001?');
      } else if (error instanceof SyntaxError) {
        toast.error('Invalid server response. Check backend logs.');
      } else {
        toast.error(`Error: ${error.message}`);
      }
    } finally {
      setTaskAssignmentLoading(false);
    }
  };

  const toggleUserExpansion = (userId) => {
    setExpandedUsers(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
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
      if (filters.scope !== 'all') {
        const scopeNumber = activity.scope.replace('Scope ', '');
        if (scopeNumber !== filters.scope) return false;
      }
      
      if (filters.status !== 'all' && activity.status !== filters.status) {
        return false;
      }
      
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
        'Description': activity.description || '',
        'Organisation': user?.organisation?.name || 'N/A'
      }));
      
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
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDaysUntilDeadline = (deadline) => {
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const diffTime = deadlineDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return 'Due tomorrow';
    return `${diffDays}d left`;
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Show empty state if no data
  if (!loading && pagination.totalItems === 0 && activeTab === 'activities') {
    return (
      <div className="space-y-6">
        <PageHeader 
          title="Monitor - Real-time Activity Tracking"
          breadcrumb={[
            { label: 'App', href: '/' },
            { label: 'Monitor' }
          ]}
          action={isAdmin && (
            <button
              onClick={() => setShowTaskModal(true)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 inline-flex items-center space-x-2"
            >
              <Users className="w-4 h-4" />
              <span>Assign Task</span>
            </button>
          )}
        />
        
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">No Activities Found</h2>
          <p className="text-gray-600 mb-2">
            No emission activities available for your organisation.
          </p>
          {user?.organisation?.name && (
            <p className="text-sm text-gray-500 mb-6">
              Organisation: <strong>{user.organisation.name}</strong>
            </p>
          )}
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
      <PageHeader 
        title="Monitor - Real-time Activity Tracking"
        breadcrumb={[
          { label: 'App', href: '/' },
          { label: 'Monitor' }
        ]}
        action={
          <div className="flex items-center space-x-3">
            {user?.organisation?.name && (
              <span className="text-sm text-gray-600">
                {user.organisation.name}
              </span>
            )}
            {isAdmin && (
              <button
                onClick={() => setShowTaskModal(true)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 inline-flex items-center space-x-2"
              >
                <Users className="w-4 h-4" />
                <span>Assign Task</span>
              </button>
            )}
            <span className="text-sm text-gray-600">Auto-refresh: ON</span>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          </div>
        }
      />

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="border-b">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('activities')}
              className={`py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'activities'
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Activity className="w-4 h-4 inline mr-2" />
              Emission Activities
            </button>
            {isAdmin && (
              <button
                onClick={() => {
                  setActiveTab('tasks');
                  loadAllUserTasks();
                }}
                className={`py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'tasks'
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <CheckSquare className="w-4 h-4 inline mr-2" />
                Task Management (By User)
                {taskStats && taskStats.pending_tasks > 0 && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    {taskStats.pending_tasks}
                  </span>
                )}
              </button>
            )}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'activities' && (
        <>
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
        </>
      )}

      {/* NEW: Task Management Tab - Separated by User */}
      {activeTab === 'tasks' && isAdmin && (
        <div className="space-y-6">
          {/* Task Stats */}
          {taskStats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow-sm border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Tasks</p>
                    <p className="text-2xl font-bold text-gray-900">{taskStats.total_tasks || 0}</p>
                  </div>
                  <CheckSquare className="w-8 h-8 text-gray-600" />
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Pending</p>
                    <p className="text-2xl font-bold text-yellow-600">{taskStats.pending_tasks || 0}</p>
                  </div>
                  <Clock className="w-8 h-8 text-yellow-600" />
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">In Progress</p>
                    <p className="text-2xl font-bold text-blue-600">{taskStats.in_progress_tasks || 0}</p>
                  </div>
                  <Activity className="w-8 h-8 text-blue-600" />
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Completed</p>
                    <p className="text-2xl font-bold text-green-600">{taskStats.completed_tasks || 0}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
              </div>
            </div>
          )}

          {/* Tasks Grouped by User */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="px-6 py-4 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Tasks by User</h3>
                <button
                  onClick={loadAllUserTasks}
                  className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center space-x-1"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {tasksLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
              </div>
            ) : Object.keys(tasksByUser).length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No tasks assigned yet</p>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                {Object.values(tasksByUser).map((userTaskData) => {
                  const { user: targetUser, tasks, stats } = userTaskData;
                  const isExpanded = expandedUsers[targetUser.id];
                  
                  return (
                    <div key={targetUser.id} className="border rounded-lg overflow-hidden">
                      {/* User Header */}
                      <button
                        onClick={() => toggleUserExpansion(targetUser.id)}
                        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-medium">
                              {targetUser.name.split(' ').map(n => n[0]).join('')}
                            </span>
                          </div>
                          <div className="text-left">
                            <h4 className="font-semibold text-gray-900">{targetUser.name}</h4>
                            <p className="text-sm text-gray-600">{targetUser.email}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-3 text-sm">
                            <span className="text-gray-600">{stats.total} total</span>
                            <span className="text-yellow-600">{stats.pending} pending</span>
                            <span className="text-blue-600">{stats.in_progress} in progress</span>
                            {stats.overdue > 0 && (
                              <span className="text-red-600 font-medium">{stats.overdue} overdue</span>
                            )}
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </button>

                      {/* User's Tasks - Expanded View */}
                      {isExpanded && (
                        <div className="border-t bg-white">
                          {tasks.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                              No tasks assigned to this user
                            </div>
                          ) : (
                            <div className="p-4 space-y-3">
                              {tasks.map((task) => (
                                <div
                                  key={task.id}
                                  className="border rounded-lg p-4 hover:shadow-sm transition-shadow"
                                >
                                  {/* Task Header */}
                                  <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-3 mb-2">
                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                          task.scope === 1 ? 'bg-emerald-100 text-emerald-800' :
                                          task.scope === 2 ? 'bg-blue-100 text-blue-800' :
                                          'bg-red-100 text-red-800'
                                        }`}>
                                          Scope {task.scope}
                                        </span>
                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(task.status)}`}>
                                          {task.status.replace('_', ' ').toUpperCase()}
                                        </span>
                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(task.priority)}`}>
                                          {task.priority?.toUpperCase()}
                                        </span>
                                      </div>
                                      <h5 className="text-base font-semibold text-gray-900 mb-1">
                                        {task.activity}
                                      </h5>
                                      {task.source && (
                                        <p className="text-sm text-gray-600 mb-2">
                                          Source: {task.source}
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  {/* Task Details */}
                                  <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                                    <div className="flex items-center text-gray-600">
                                      <User className="w-4 h-4 mr-2" />
                                      <span>Assigned by: <strong>{task.assigned_by_name}</strong></span>
                                    </div>
                                    <div className="flex items-center text-gray-600">
                                      <Clock className="w-4 h-4 mr-2" />
                                      <span className={
                                        getDaysUntilDeadline(task.deadline).includes('overdue') 
                                          ? 'text-red-600 font-medium' 
                                          : ''
                                      }>
                                        {getDaysUntilDeadline(task.deadline)}
                                      </span>
                                    </div>
                                    <div className="flex items-center text-gray-600">
                                      <Calendar className="w-4 h-4 mr-2" />
                                      <span>Period: {task.start_date} to {task.end_date}</span>
                                    </div>
                                    <div className="flex items-center text-gray-600">
                                      <Calendar className="w-4 h-4 mr-2" />
                                      <span>Deadline: {new Date(task.deadline).toLocaleDateString()}</span>
                                    </div>
                                  </div>

                                  {/* Comments */}
                                  {task.comments && (
                                    <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                                      <p className="text-sm text-gray-700">{task.comments}</p>
                                    </div>
                                  )}

                                  {/* CRITICAL: Admin View-Only - No Action Buttons */}
                                  <div className="flex items-center justify-between pt-3 border-t">
                                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                                      <Eye className="w-4 h-4" />
                                      <span>View-only (Admin)</span>
                                    </div>
                                    {task.status === 'completed' && task.completed_at && (
                                      <div className="flex items-center text-green-600 text-sm">
                                        <CheckCircle className="w-4 h-4 mr-1" />
                                        <span>Completed {new Date(task.completed_at).toLocaleDateString()}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Task Assignment Modal */}
      {showTaskModal && (
        <TaskAssignmentModal
          onSubmit={handleTaskAssignment}
          onClose={() => setShowTaskModal(false)}
          loading={taskAssignmentLoading}
        />
      )}
    </div>
  );
};

export default Monitor;