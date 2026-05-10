// frontend/src/components/AssignedTasks/AssignedTasks.jsx
// Component for Contributors to view their assigned tasks - FIXED

import { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  User, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw,
  MessageSquare,
  Filter,
  Eye,
  PlayCircle,
  CheckSquare
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { monitorAPI } from '../../services/api';
import toast from 'react-hot-toast';

const AssignedTasks = ({ 
  showHeader = true, 
  maxTasks = null, 
  className = '',
  onTaskUpdate = null 
}) => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState('all'); // all, pending, in_progress, overdue
  const [updating, setUpdating] = useState({});

  // FIXED: Use absolute backend URL
  const BACKEND_URL = 'http://localhost:5001';

  useEffect(() => {
    loadTasks();
    loadStats();
  }, [filter]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('No authentication token found');
        setLoading(false);
        return;
      }
      
      // FIXED: Use API client
      const paramsObj = {};
      if (filter && filter !== 'all') {
        if (filter === 'overdue') {
          paramsObj.status = 'pending';
        } else {
          paramsObj.status = filter;
        }
      }
      if (maxTasks) {
        paramsObj.limit = maxTasks;
      }
      
      const result = await monitorAPI.getTasks(paramsObj);
      let tasksData = Array.isArray(result) ? result : (result?.data || []);
      
      // Apply client-side overdue filtering if needed
      if (filter === 'overdue') {
        tasksData = tasksData.filter(task => {
          const deadline = new Date(task.deadline);
          const now = new Date();
          return deadline < now && task.status !== 'completed';
        });
      }
      
      setTasks(tasksData);
    } catch (error) {
      console.error('❌ Error loading tasks:', error);
      toast.error('Failed to load tasks');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return;
      }

      const result = await monitorAPI.getTaskStats();
      const statsData = result.data || result;
      if (statsData) {
        setStats(statsData);
        console.log('✅ Stats loaded:', statsData);
      }
    } catch (error) {
      console.warn('⚠️ Error loading task stats:', error.message);
    }
  };

  const updateTaskStatus = async (taskId, newStatus, comments = '') => {
    try {
      setUpdating(prev => ({ ...prev, [taskId]: true }));
      
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('No authentication token found');
        return;
      }
      
      const updateData = { status: newStatus };
      if (comments.trim()) {
        updateData.comments = comments.trim();
      }
      
      console.log('⚙️ Updating task:', taskId, 'with status:', newStatus);
      
      const result = await monitorAPI.updateTask(taskId, updateData);
      const updatedTask = result.data || result;
      
      if (updatedTask) {
        // Update local state
        setTasks(prev => prev.map(task => 
          (task._id === taskId || task.id === taskId) ? updatedTask : task
        ));
        
        toast.success(`Task marked as ${newStatus.replace('_', ' ')}`);
        console.log('✅ Task updated successfully');
        
        // Reload stats
        loadStats();
        
        // Notify parent component if callback provided
        if (onTaskUpdate) {
          onTaskUpdate(updatedTask);
        }
      }
    } catch (error) {
      console.error('❌ Error updating task:', error);
      toast.error('Failed to update task');
    } finally {
      setUpdating(prev => ({ ...prev, [taskId]: false }));
    }
  };

  const getStatusColor = (task) => {
    const deadline = new Date(task.deadline);
    const now = new Date();
    
    switch (task.status) {
      case 'completed':
        return 'bg-green-100 dark:bg-green-950/35 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default: // pending
        if (deadline < now) {
          return 'bg-red-100 text-red-800 border-red-200'; // overdue
        }
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const getStatusLabel = (task) => {
    const deadline = new Date(task.deadline);
    const now = new Date();
    
    if (task.status === 'completed') return 'Completed';
    if (task.status === 'in_progress') return 'In Progress';
    if (task.status === 'cancelled') return 'Cancelled';
    if (deadline < now) return 'Overdue';
    return 'Pending';
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getDaysUntilDeadline = (deadline) => {
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const diffTime = deadlineDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return 'Due tomorrow';
    return `${diffDays} days left`;
  };

  const getScopeColor = (scope) => {
    switch (scope) {
      case 1: return 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300';
      case 2: return 'bg-blue-100 text-blue-800';
      case 3: return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredTasks = tasks;

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
          <span className="ml-2 text-gray-600">Loading tasks...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      {showHeader && (
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Assigned Tasks</h3>
                <p className="text-sm text-gray-600">
                  {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
                  {filter !== 'all' && ` (${filter.replace('_', ' ')})`}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Filter Dropdown */}
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All Tasks</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="overdue">Overdue</option>
                <option value="completed">Completed</option>
              </select>
              
              <button
                onClick={loadTasks}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                title="Refresh tasks"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {/* Quick Stats */}
          {stats && (
            <div className="mt-4 grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{stats.pending || stats.pending_tasks || 0}</div>
                <div className="text-xs text-gray-600">Pending</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.in_progress || stats.in_progress_tasks || 0}</div>
                <div className="text-xs text-gray-600">In Progress</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.overdue || stats.overdue_tasks || 0}</div>
                <div className="text-xs text-gray-600">Overdue</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.completed || stats.completed_tasks || 0}</div>
                <div className="text-xs text-gray-600">Completed</div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="p-4">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              {filter === 'all' ? 'No tasks assigned' : `No ${filter.replace('_', ' ')} tasks`}
            </h4>
            <p className="text-gray-600">
              {filter === 'all' 
                ? 'You have no assigned tasks at the moment.'
                : 'All clear! No tasks match this filter.'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTasks.map((task) => (
              <div
                key={task._id || task.id}
                className="border rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                {/* Task Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getScopeColor(task.scope)}`}>
                        Scope {task.scope}
                      </span>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(task)}`}>
                        {getStatusLabel(task)}
                      </span>
                      <span className={`text-xs font-medium ${getPriorityColor(task.priority)}`}>
                        {task.priority?.toUpperCase()}
                      </span>
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-1">
                      {task.activity}
                    </h4>
                    {task.source && (
                      <p className="text-sm text-gray-600 mb-2">
                        Source: <span className="font-medium">{task.source}</span>
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
                    <div className="flex items-start">
                      <MessageSquare className="w-4 h-4 text-gray-400 mr-2 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-700">{task.comments}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                {task.status !== 'completed' && task.status !== 'cancelled' && (
                  <div className="flex space-x-2">
                    {task.status === 'pending' && (
                      <button
                        onClick={() => updateTaskStatus(task.id, 'in_progress')}
                        disabled={updating[task.id]}
                        className="flex items-center px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
                      >
                        <PlayCircle className="w-4 h-4 mr-1" />
                        Start Task
                      </button>
                    )}
                    
                    <button
                      onClick={() => updateTaskStatus(task.id, 'completed')}
                      disabled={updating[task.id]}
                      className="flex items-center px-3 py-1 text-sm bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors disabled:opacity-50"
                    >
                      {updating[task.id] ? (
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-600 mr-1" />
                      ) : (
                        <CheckSquare className="w-4 h-4 mr-1" />
                      )}
                      Mark Complete
                    </button>
                  </div>
                )}

                {/* Completion Indicator */}
                {task.status === 'completed' && (
                  <div className="flex items-center text-green-600 text-sm">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    <span>Completed on {new Date(task.completed_at || task.updated_at).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AssignedTasks;