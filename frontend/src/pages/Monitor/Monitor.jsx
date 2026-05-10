// frontend/src/pages/Monitor/Monitor_ENHANCED.jsx
// Enhanced Monitor with user-separated task views and admin view-only restrictions

import { useState, useEffect, useRef } from 'react';
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
  ChevronUp,
  Edit2,
  X,
  Check,
  Save
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useActivity } from '../../context/ActivityContext';
import { monitorAPI, emissionsAPI } from '../../services/api';
import PageHeader from '../../components/PageHeader/PageHeader';
import {
  getDisplayedActivityQuantity,
  getDisplayedCo2e,
  getContributorDisplayName,
  getContributorId
} from '../../utils/emissionDisplay';
import Pagination from '../../components/Pagination/Pagination';
import TaskAssignmentModal from '../../components/TaskAssignmentModal/TaskAssignmentModal';
import SkeletonLoader from '../../components/SkeletonLoader/SkeletonLoader';
import toast from 'react-hot-toast';

const Monitor = () => {
  const { user, isAdmin, canVerifyEmissions } = useAuth();
  const canReviewEmissions = typeof canVerifyEmissions === 'function' ? canVerifyEmissions() : false;
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

  // Inline edit state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ amount: '', status: '' });
  const [isSaving, setIsSaving] = useState(false);

  // Backend URL
  const BACKEND_URL = 'http://localhost:5001';

  /** Always points to latest fetch — avoids stale closures on background intervals. */
  const loadActivitiesRef = useRef(async () => {});

  useEffect(() => {
    logPageView('Monitor Enhanced');
    if (isAdmin) {
      loadAllUserTasks();
    }
    loadTaskStats();

    const onEmissionAdded = () => {
      loadActivitiesRef.current({ silent: true });
      toast.success('Monitor updated with new emission!');
    };

    window.addEventListener('emission-added', onEmissionAdded);
    const REFRESH_MS = 5 * 60 * 1000;
    const refreshInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      loadActivitiesRef.current({ silent: true });
    }, REFRESH_MS);

    return () => {
      window.removeEventListener('emission-added', onEmissionAdded);
      clearInterval(refreshInterval);
    };
  }, []);

  useEffect(() => {
    loadActivitiesRef.current({ silent: false });
  }, [pagination.currentPage, filters, searchQuery]);

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
      const usersResult = await monitorAPI.getAssignableUsers();
      const users = Array.isArray(usersResult) ? usersResult : (usersResult.data || []);
      
      // For each user, load their tasks
      const tasksByUserMap = {};
      
      for (const targetUser of users) {
        // MONGODB: Use _id (ObjectId) instead of numeric id
        const userId = targetUser._id || targetUser.id;
        try {
          const tasksResult = await monitorAPI.getTasks({ assigned_to: userId });
          const tasksList = Array.isArray(tasksResult) ? tasksResult : (tasksResult.data || []);
          
          tasksByUserMap[userId] = {
            user: targetUser,
            tasks: tasksList,
            stats: {
              total: tasksList.length,
              pending: tasksList.filter(t => t.status === 'pending').length,
              in_progress: tasksList.filter(t => t.status === 'in_progress').length,
              completed: tasksList.filter(t => t.status === 'completed').length,
              overdue: tasksList.filter(t => {
                const deadline = new Date(t.deadline);
                const now = new Date();
                return deadline < now && t.status !== 'completed';
              }).length
            }
          };
        } catch (err) {
          console.error(`Failed to load tasks for user ${userId}`, err);
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

  const loadActivities = async (options = {}) => {
    const silent = options.silent === true;
    try {
      if (!silent) setLoading(true);

      console.log('📊 Loading activities from MongoDB for organisation:', user?.organisation_id);
      
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No auth token');
        setLoading(false);
        return;
      }

      // MONGODB: Fetch emissions from API instead of localStorage
      const result = await emissionsAPI.getAll();
      const allEmissions = Array.isArray(result) ? result : (result.data || []);
      
      console.log(`✅ Loaded ${allEmissions.length} emissions from MongoDB`);
      
      // Calculate emission stats
      const stats = {
        scope1: { total: 0 },
        scope2: { total: 0 },
        scope3: { total: 0 }
      };
      
      allEmissions.forEach((emission) => {
        const emissionValue = getDisplayedCo2e(emission);
        if (emission.scope === 1) stats.scope1.total += emissionValue;
        else if (emission.scope === 2) stats.scope2.total += emissionValue;
        else if (emission.scope === 3) stats.scope3.total += emissionValue;
      });
      
      setEmissionStats({
        total: stats.scope1.total + stats.scope2.total + stats.scope3.total,
        scope1: stats.scope1.total,
        scope2: stats.scope2.total,
        scope3: stats.scope3.total
      });
      
      // Process activities for display
      let processedActivities = allEmissions.map((emission) => {
        const contributorName = getContributorDisplayName(emission);
        const cid = getContributorId(emission);
        return {
        _id: emission._id || emission.id,
        createdById: cid != null ? String(cid) : '',
        user: {
          name: contributorName,
          avatar: contributorName.split(/\s+/).filter(Boolean).map((n) => n[0]).join('').toUpperCase() || 'UU',
          id: cid != null ? String(cid) : ''
        },
        scope: `Scope ${emission.scope}`,
        activityType: emission.category || emission.activityType || 'Unknown Activity',
        source:
          emission.subcategory ||
          emission.source ||
          emission.activity ||
          'Unknown Source',
        accountingPeriod: formatAccountingPeriod(emission.accountingPeriod || {
          start: emission.startDate,
          end: emission.endDate
        }),
        emissions: getDisplayedCo2e(emission),
        status: emission.status || 'draft',
        createdAt: emission.createdAt || emission.created_at,
        amount: getDisplayedActivityQuantity(emission),
        unit: emission.unit,
        location: emission.location,
        description: emission.description,
        startDate: emission.startDate || emission.start_date,
        endDate: emission.endDate || emission.end_date,
        emissionFactor: emission.factor || emission.emissionFactor || 1.0,
        organisation_id: emission.organisation_id
      };
      });

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

      setPagination((prev) => {
        if (prev.totalItems === totalItems && prev.totalPages === totalPages) return prev;
        return { ...prev, totalItems, totalPages };
      });
      
      const startIndex = (pagination.currentPage - 1) * pagination.itemsPerPage;
      const endIndex = startIndex + pagination.itemsPerPage;
      const currentPageActivities = processedActivities.slice(startIndex, endIndex);
      
      setActivities(currentPageActivities);

      if (!silent) {
        logActivity(
          'viewed_monitor',
          'monitor',
          null,
          `Viewed ${currentPageActivities.length} emission activities`
        );
      }
    } catch (error) {
      console.error('❌ Error loading activities:', error);
      if (!silent) toast.error('Failed to load activities');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  loadActivitiesRef.current = loadActivities;

  const loadTaskStats = async () => {
    if (!isAdmin) return;
    
    try {
      const result = await monitorAPI.getTaskStats();
      // MONGODB FIX: Map backend field names to frontend expected names
      const stats = result.data || result || {};
        setTaskStats({
          total_tasks: stats.total || 0,
          pending_tasks: stats.pending || 0,
          in_progress_tasks: stats.in_progress || 0,
          completed_tasks: stats.completed || 0,
          overdue_tasks: stats.overdue || 0
        });
        console.log('✅ Task stats loaded:', stats);
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
        assignedToUserId: taskData.assignedToUserId, // MONGODB: Keep as ObjectId string (don't parseInt)
        scope: parseInt(taskData.scope),
        activity: taskData.activity.trim(),
        source: taskData.source ? taskData.source.trim() : '',
        startDate: taskData.startDate,
        endDate: taskData.endDate,
        deadline: taskData.deadline,
        comments: taskData.comments ? taskData.comments.trim() : '',
        priority: taskData.priority || 'medium'
      };
      
      const result = await monitorAPI.createTask(submissionData);
      
      toast.success('Task assigned successfully! 🎉');
      setShowTaskModal(false);
      
      await loadActivities({ silent: true });
      await loadTaskStats();
      await loadAllUserTasks(); // Reload user tasks
      
      logActivity('task_assigned', 'task', result.id, 
        `Assigned task: ${submissionData.activity} to user ID ${submissionData.assignedToUserId}`);
      
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

  const canEditRow = (activity) => {
    if (!user?.id) return false;
    if (canReviewEmissions) return true;
    if (user.role === 'contributor' && activity.createdById && activity.createdById === String(user.id)) {
      return activity.status !== 'verified';
    }
    return false;
  };

  const canShowReviewActions = (activity) => {
    if (!canReviewEmissions) return false;
    return ['draft', 'submitted', 'rejected'].includes(activity.status);
  };

  const handleEditClick = (activity) => {
    setEditingId(activity._id);
    setEditForm({
      amount: activity.amount,
      status: activity.status || 'draft'
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({ amount: '', status: '' });
  };

  const handleSaveEdit = async (activityId) => {
    try {
      setIsSaving(true);
      
      const payload = {
        amount: parseFloat(editForm.amount),
        quantity: parseFloat(editForm.amount),
        status: editForm.status
      };

      await emissionsAPI.update(activityId, payload);
      
      toast.success('Emission updated successfully');
      setEditingId(null);
      loadActivities({ silent: true });
    } catch (error) {
      console.error('Error updating emission:', error);
      toast.error(error?.message || 'Failed to update emission');
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerifyEmission = async (activityId, verified) => {
    try {
      await emissionsAPI.verify(activityId, { verified });
      toast.success(verified ? 'Emission verified' : 'Emission rejected');
      await loadActivities({ silent: true });
    } catch (error) {
      console.error('Verify emission error:', error);
      toast.error(error?.message || 'Could not update verification');
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
      case 'Scope 1': return 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300';
      case 'Scope 2': return 'bg-blue-100 text-blue-800';
      case 'Scope 3': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'verified':
        return 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300';
      case 'submitted':
        return 'bg-amber-100 dark:bg-amber-950/45 text-amber-800 dark:text-amber-300';
      case 'draft':
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300';
      case 'rejected':
        return 'bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300';
      case 'active':
        return 'bg-status-green-bg text-status-green';
      case 'pending':
        return 'bg-status-amber-bg text-status-amber';
      case 'completed':
        return 'bg-status-green-bg text-status-green';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300';
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
      case 'low': return 'text-green-600 bg-green-100 dark:text-green-300 dark:bg-green-950/35';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-100';
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
        
        <div className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-xl transition-all duration-300 shadow-glass dark:shadow-glass-dark rounded-2xl border border-white/20 dark:border-slate-700/50 p-12 text-center">
          <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">No Activities Found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            No emission activities available for your organisation.
          </p>
          {user?.organisation?.name && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
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
              <span className="text-sm text-gray-600 dark:text-gray-400">
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
          </div>
        }
      />

      {/* Tab Navigation */}
      <div className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-xl transition-all duration-300 shadow-glass dark:shadow-glass-dark rounded-2xl border border-white/20 dark:border-slate-700/50">
        <div className="border-b dark:border-gray-700">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('activities')}
              className={`py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'activities'
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
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
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
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
            <div className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-xl transition-all duration-300 shadow-glass dark:shadow-glass-dark rounded-2xl border border-white/20 dark:border-slate-700/50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Emissions</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatNumber(emissionStats.total)} CO₂e
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-emerald-600" />
              </div>
            </div>
            
            <div className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-xl transition-all duration-300 shadow-glass dark:shadow-glass-dark rounded-2xl border border-white/20 dark:border-slate-700/50 p-4">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Scope 1</p>
                <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-300">
                  {formatNumber(emissionStats.scope1)}
                </p>
              </div>
            </div>

            <div className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-xl transition-all duration-300 shadow-glass dark:shadow-glass-dark rounded-2xl border border-white/20 dark:border-slate-700/50 p-4">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Scope 2</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-300">
                  {formatNumber(emissionStats.scope2)}
                </p>
              </div>
            </div>

            <div className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-xl transition-all duration-300 shadow-glass dark:shadow-glass-dark rounded-2xl border border-white/20 dark:border-slate-700/50 p-4">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Scope 3</p>
                <p className="text-2xl font-bold text-red-900 dark:text-red-300">
                  {formatNumber(emissionStats.scope3)}
                </p>
              </div>
            </div>
          </div>

          {/* Controls Section */}
          <div className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-xl transition-all duration-300 shadow-glass dark:shadow-glass-dark rounded-2xl border border-white/20 dark:border-slate-700/50 p-4">
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
                  className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">All status</option>
                  <option value="draft">Draft</option>
                  <option value="submitted">Submitted (pending review)</option>
                  <option value="verified">Verified</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => loadActivities({ silent: false })}
                  className="border border-gray-300 dark:border-slate-600 px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 dark:text-gray-200 transition-colors flex items-center space-x-2"
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
          <div className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-xl transition-all duration-300 shadow-glass dark:shadow-glass-dark rounded-2xl border border-white/20 dark:border-slate-700/50 overflow-hidden">
            <div className="px-6 py-4 border-b dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activities</h3>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {pagination.totalItems} total activities
                </span>
              </div>
            </div>

            {loading ? (
              <div className="p-6 space-y-4">
                <SkeletonLoader type="text" lines={1} className="h-10" />
                <SkeletonLoader type="text" lines={5} className="h-16" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-emerald-50 dark:bg-emerald-900/30">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">Scope</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 dark:text-emerald-300 uppercase tracking-wider w-48">Activity Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 dark:text-emerald-300 uppercase tracking-wider w-48">Source</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-emerald-800 dark:text-emerald-300 uppercase tracking-wider w-24">Amount</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-emerald-800 dark:text-emerald-300 uppercase tracking-wider w-32">Emissions</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 dark:text-emerald-300 uppercase tracking-wider w-32">Period</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-emerald-800 dark:text-emerald-300 uppercase tracking-wider w-32">Status</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-emerald-800 dark:text-emerald-300 uppercase tracking-wider w-32">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {activities.map((activity) => {
                      const isEditing = editingId === activity._id;
                      return (
                      <tr key={activity._id} className="hover:bg-gray-50 dark:bg-gray-900/50">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center">
                              <span className="text-white text-sm font-medium">
                                {activity.user.avatar}
                              </span>
                            </div>
                            <div className="ml-3">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">{activity.user.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getScopeColor(activity.scope)}`}>
                            {activity.scope}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                          <div className="max-w-xs truncate" title={activity.activityType}>
                            {activity.activityType}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                          <div className="max-w-xs truncate" title={activity.source}>
                            {activity.source}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white text-right tabular-nums">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editForm.amount}
                              onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                              className="w-20 px-2 py-1 border rounded text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              min="0"
                              step="0.01"
                            />
                          ) : (
                            `${activity.amount} ${activity.unit}`
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium text-right tabular-nums">
                          {formatNumber(activity.emissions)} CO₂e
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {activity.accountingPeriod}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isEditing ? (
                            <select
                              value={editForm.status}
                              onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                              className="min-w-[10rem] px-2 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                            >
                              {canReviewEmissions ? (
                                <>
                                  <option value="draft">Draft</option>
                                  <option value="submitted">Submitted</option>
                                  <option value="verified">Verified</option>
                                  <option value="rejected">Rejected</option>
                                </>
                              ) : (
                                <>
                                  <option value="draft">Draft</option>
                                  <option value="submitted">Submitted</option>
                                </>
                              )}
                            </select>
                          ) : (
                            <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(activity.status)}`}>
                              {activity.status === 'verified' ? <CheckCircle className="w-3 h-3 mr-1 shrink-0" /> : null}
                              {activity.status === 'submitted' || activity.status === 'draft' ? (
                                <AlertCircle className="w-3 h-3 mr-1 shrink-0" />
                              ) : null}
                              {activity.status === 'rejected' ? <X className="w-3 h-3 mr-1 shrink-0" /> : null}
                              <span className="capitalize">{activity.status}</span>
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-medium">
                          {isEditing ? (
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => handleSaveEdit(activity._id)}
                                disabled={isSaving}
                                className="text-emerald-600 hover:text-emerald-900 dark:hover:text-emerald-300 p-1 rounded-full hover:bg-emerald-50 dark:bg-emerald-900/30"
                                title="Save"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                disabled={isSaving}
                                className="text-gray-400 hover:text-gray-600 dark:text-gray-400 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-end gap-1 sm:flex-row sm:justify-end sm:items-center sm:gap-2">
                              {canShowReviewActions(activity) && (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleVerifyEmission(activity._id, true)}
                                    className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                                    title="Approve and verify"
                                  >
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleVerifyEmission(activity._id, false)}
                                    className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30"
                                    title="Reject"
                                  >
                                    Reject
                                  </button>
                                </div>
                              )}
                              {canEditRow(activity) && (
                                <button
                                  type="button"
                                  onClick={() => handleEditClick(activity)}
                                  className="text-gray-400 hover:text-emerald-600 p-1 rounded-full hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
                                  title="Edit amount and status"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="border-t dark:border-gray-700 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
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
              <div className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-xl transition-all duration-300 shadow-glass dark:shadow-glass-dark rounded-2xl border border-white/20 dark:border-slate-700/50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Tasks</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{taskStats.total_tasks || 0}</p>
                  </div>
                  <CheckSquare className="w-8 h-8 text-gray-600 dark:text-gray-400" />
                </div>
              </div>
              <div className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-xl transition-all duration-300 shadow-glass dark:shadow-glass-dark rounded-2xl border border-white/20 dark:border-slate-700/50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending</p>
                    <p className="text-2xl font-bold text-yellow-600">{taskStats.pending_tasks || 0}</p>
                  </div>
                  <Clock className="w-8 h-8 text-yellow-600" />
                </div>
              </div>
              <div className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-xl transition-all duration-300 shadow-glass dark:shadow-glass-dark rounded-2xl border border-white/20 dark:border-slate-700/50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">In Progress</p>
                    <p className="text-2xl font-bold text-blue-600">{taskStats.in_progress_tasks || 0}</p>
                  </div>
                  <Activity className="w-8 h-8 text-blue-600" />
                </div>
              </div>
              <div className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-xl transition-all duration-300 shadow-glass dark:shadow-glass-dark rounded-2xl border border-white/20 dark:border-slate-700/50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Completed</p>
                    <p className="text-2xl font-bold text-green-600">{taskStats.completed_tasks || 0}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
              </div>
            </div>
          )}

          {/* Tasks Grouped by User */}
          <div className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-xl transition-all duration-300 shadow-glass dark:shadow-glass-dark rounded-2xl border border-white/20 dark:border-slate-700/50">
            <div className="px-6 py-4 border-b dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tasks by User</h3>
                <button
                  onClick={loadAllUserTasks}
                  className="text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 flex items-center space-x-1"
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
                <p className="text-gray-600 dark:text-gray-400">No tasks assigned yet</p>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                {Object.values(tasksByUser).map((userTaskData) => {
                  const { user: targetUser, tasks, stats } = userTaskData;
                  // MONGODB: Use _id or fallback to id
                  const userId = targetUser._id || targetUser.id;
                  const isExpanded = expandedUsers[userId];
                  
                  return (
                    <div key={userId} className="border rounded-lg overflow-hidden">
                      {/* User Header */}
                      <button
                        onClick={() => toggleUserExpansion(userId)}
                        className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-medium">
                              {targetUser.name.split(' ').map(n => n[0]).join('')}
                            </span>
                          </div>
                          <div className="text-left">
                            <h4 className="font-semibold text-gray-900 dark:text-white">{targetUser.name}</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{targetUser.email}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-3 text-sm">
                            <span className="text-gray-600 dark:text-gray-400">{stats.total} total</span>
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
                        <div className="border-t border-gray-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50">
                          {tasks.length === 0 ? (
                            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                              No tasks assigned to this user
                            </div>
                          ) : (
                            <div className="p-4 space-y-3">
                              {tasks.map((task) => (
                                <div
                                  key={task._id || task.id}
                                  className="border rounded-lg p-4 hover:shadow-sm transition-shadow"
                                >
                                  {/* Task Header */}
                                  <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-3 mb-2">
                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                          task.scope === 1 ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300' :
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
                                      <span>Assigned by: <strong>{task.assigned_by?.name || task.assigned_by_name || 'Unknown'}</strong></span>
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
                                      <span>Period: {new Date(task.start_date).toLocaleDateString()} to {new Date(task.end_date).toLocaleDateString()}</span>
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