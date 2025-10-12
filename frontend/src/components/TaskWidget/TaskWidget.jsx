// frontend/src/components/TaskWidget/TaskWidget.jsx
// Widget component to show assigned tasks on Dashboard and Input pages - FIXED v2

import { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  User,
  ChevronRight,
  RefreshCw,
  CheckSquare,
  PlayCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const TaskWidget = ({ 
  maxTasks = 3, 
  showQuickActions = true,
  className = '',
  onTaskClick = null 
}) => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [updating, setUpdating] = useState({});

  const BACKEND_URL = 'http://localhost:5001';

  useEffect(() => {
    if (user && ['contributor', 'analyst'].includes(user.role)) {
      loadTasks();
      loadStats();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('No token found');
        setLoading(false);
        return;
      }
      
      // FIXED: Don't send status parameter - let backend return all statuses for current user
      const url = `${BACKEND_URL}/api/tasks?limit=${maxTasks}`;
      console.log('📋 Loading tasks from:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📡 Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error response:', errorText.substring(0, 300));
        toast.error(`Failed to load tasks: ${response.statusText}`);
        setTasks([]);
        setLoading(false);
        return;
      }
      
      const result = await response.json();
      console.log('✅ Tasks loaded:', result.data?.length || 0, result.data);
      
      let tasksData = result.data || [];
      
      // Filter out completed tasks and sort by deadline
      tasksData = tasksData
        .filter(task => task.status !== 'completed' && task.status !== 'cancelled')
        .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
      
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

      const url = `${BACKEND_URL}/api/tasks/stats`;
      console.log('📊 Loading stats from:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.warn('⚠️ Failed to load stats:', response.statusText);
        return;
      }
      
      const result = await response.json();
      if (result.success && result.data) {
        setStats(result.data);
        console.log('✅ Stats loaded:', result.data);
      }
    } catch (error) {
      console.warn('⚠️ Error loading task stats:', error.message);
    }
  };

  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      setUpdating(prev => ({ ...prev, [taskId]: true }));
      
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('No authentication token found');
        setUpdating(prev => ({ ...prev, [taskId]: false }));
        return;
      }
      
      const url = `${BACKEND_URL}/api/tasks/${taskId}`;
      console.log('⚙️ Updating task:', taskId, 'with status:', newStatus);
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      
      console.log('📡 Update response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error updating task:', errorText.substring(0, 300));
        toast.error(`Failed to update task: ${response.statusText}`);
        setUpdating(prev => ({ ...prev, [taskId]: false }));
        return;
      }
      
      const result = await response.json();
      
      if (result.success) {
        // Update local state
        setTasks(prev => prev.map(task => 
          task.id === taskId ? result.data : task
        ).filter(task => task.status !== 'completed' && task.status !== 'cancelled'));
        
        toast.success(`Task marked as ${newStatus.replace('_', ' ')}`);
        console.log('✅ Task updated successfully');
        
        // Reload stats
        await loadStats();
      } else {
        toast.error(result.message || 'Failed to update task');
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
        return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default: // pending
        if (deadline < now) {
          return 'bg-red-100 text-red-800 border-red-200';
        }
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const getStatusLabel = (task) => {
    const deadline = new Date(task.deadline);
    const now = new Date();
    
    if (task.status === 'completed') return 'Completed';
    if (task.status === 'in_progress') return 'In Progress';
    if (deadline < now) return 'Overdue';
    return 'Pending';
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

  const getScopeColor = (scope) => {
    switch (scope) {
      case 1: return 'bg-emerald-100 text-emerald-800';
      case 2: return 'bg-blue-100 text-blue-800';
      case 3: return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleTaskClick = (task) => {
    if (onTaskClick) {
      onTaskClick(task);
    } else {
      window.location.href = '/monitor?tab=tasks';
    }
  };

  // Don't show widget for admin users or viewers
  if (!user || !['contributor', 'analyst'].includes(user.role)) {
    return null;
  }

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border p-4 ${className}`}>
        <div className="flex items-center justify-center py-4">
          <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
          <span className="ml-2 text-sm text-gray-600">Loading tasks...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">My Assigned Tasks</h3>
              <p className="text-sm text-gray-600">
                {tasks.length} task{tasks.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          
          <button
            onClick={() => window.location.href = '/monitor?tab=tasks'}
            className="text-emerald-600 hover:text-emerald-700 text-sm font-medium flex items-center"
          >
            View All
            <ChevronRight className="w-4 h-4 ml-1" />
          </button>
        </div>
        
        {/* Quick Stats */}
        {stats && (
          <div className="mt-3 grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-lg font-bold text-yellow-600">{stats.pending_tasks || 0}</div>
              <div className="text-xs text-gray-600">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">{stats.in_progress_tasks || 0}</div>
              <div className="text-xs text-gray-600">In Progress</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-red-600">{stats.overdue_tasks || 0}</div>
              <div className="text-xs text-gray-600">Overdue</div>
            </div>
          </div>
        )}
      </div>

      {/* Tasks List */}
      <div className="p-4">
        {tasks.length === 0 ? (
          <div className="text-center py-6">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <h4 className="font-medium text-gray-900 mb-2">All caught up!</h4>
            <p className="text-sm text-gray-600">No pending tasks at the moment.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="border rounded-lg p-3 hover:shadow-sm transition-shadow cursor-pointer"
                onClick={() => handleTaskClick(task)}
              >
                {/* Task Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${getScopeColor(task.scope)}`}>
                        Scope {task.scope}
                      </span>
                      <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border ${getStatusColor(task)}`}>
                        {getStatusLabel(task)}
                      </span>
                      {task.priority && (
                        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                          task.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                          task.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                          task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {task.priority.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-medium text-gray-900 mb-1">
                      {task.activity}
                    </h4>
                    {task.source && (
                      <p className="text-xs text-gray-600">
                        Source: {task.source}
                      </p>
                    )}
                  </div>
                </div>

                {/* Task Details */}
                <div className="text-xs text-gray-600 mb-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <User className="w-3 h-3 mr-1" />
                      <span>Assigned by {task.assigned_by_name}</span>
                    </div>
                    <div className="flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      <span className={
                        getDaysUntilDeadline(task.deadline).includes('overdue') 
                          ? 'text-red-600 font-medium' 
                          : ''
                      }>
                        {getDaysUntilDeadline(task.deadline)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center text-gray-500">
                    <Calendar className="w-3 h-3 mr-1" />
                    <span>Deadline: {new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>

                {/* Comments/Instructions */}
                {task.comments && (
                  <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                    <div className="flex items-start">
                      <AlertTriangle className="w-3 h-3 text-blue-600 mr-1 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium text-blue-900">Instructions: </span>
                        <span className="text-blue-800">{task.comments}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Date Range */}
                {task.start_date && task.end_date && (
                  <div className="mb-3 text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-200">
                    <Calendar className="w-3 h-3 inline mr-1" />
                    <span className="font-medium">Data Period:</span> {task.start_date} to {task.end_date}
                  </div>
                )}

                {/* Quick Actions */}
                {showQuickActions && task.status !== 'completed' && (
                  <div className="flex space-x-2">
                    {task.status === 'pending' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateTaskStatus(task.id, 'in_progress');
                        }}
                        disabled={updating[task.id]}
                        className="flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors disabled:opacity-50"
                      >
                        <PlayCircle className="w-3 h-3 mr-1" />
                        Start
                      </button>
                    )}
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateTaskStatus(task.id, 'completed');
                      }}
                      disabled={updating[task.id]}
                      className="flex items-center px-2 py-1 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200 transition-colors disabled:opacity-50"
                    >
                      {updating[task.id] ? (
                        <div className="animate-spin rounded-full h-2 w-2 border-b-2 border-green-600 mr-1" />
                      ) : (
                        <CheckSquare className="w-3 h-3 mr-1" />
                      )}
                      Complete
                    </button>
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

export default TaskWidget;