// frontend/src/components/AddTaskModal/AddTaskModal.jsx
// MongoDB Compatible Version - Loads users from backend API

import { useState, useEffect } from 'react';
import { X, Calendar } from 'lucide-react';
import { monitorAPI } from '../../services/api';

export const AddTaskModal = ({ onSubmit, onClose }) => {
  const [formData, setFormData] = useState({
    assignedToUserId: '',  // Changed from userName to assignedToUserId (MongoDB ObjectId)
    scope: 1,  // Changed to number
    source: '',
    activity: '',  // Changed from activityType to activity
    startDate: '',
    endDate: '',
    deadline: '',  // Added deadline field
    priority: 'medium',  // Added priority field
    comments: ''  // Added comments field
  });
  
  const [users, setUsers] = useState([]);  // Store users from API
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState('');

  // Load users from backend when modal opens
  useEffect(() => {
    fetchAssignableUsers();
  }, []);

  const fetchAssignableUsers = async () => {
    try {
      setLoadingUsers(true);
      
      const token = localStorage.getItem('token');
      if (!token) {
        setError('No authentication token found');
        setLoadingUsers(false);
        return;
      }

      const result = await monitorAPI.getAssignableUsers();
      const usersData = Array.isArray(result) ? result : (result?.data || []);
      
      if (usersData) {
        // MongoDB: Users now have _id (ObjectId string) instead of numeric id
        setUsers(usersData);
        console.log('✅ Loaded assignable users:', usersData.length);
      } else {
        setUsers([]);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to load users');
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validate dates
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      const deadlineDate = new Date(formData.deadline);

      if (end < start) {
        setError('End date must be after start date');
        setLoading(false);
        return;
      }

      if (deadlineDate < start) {
        setError('Deadline must be after start date');
        setLoading(false);
        return;
      }

      // Prepare task data for MongoDB backend
      const taskData = {
        assignedToUserId: formData.assignedToUserId,  // ObjectId string
        scope: parseInt(formData.scope),
        activity: formData.activity,
        source: formData.source || null,
        startDate: formData.startDate,
        endDate: formData.endDate,
        deadline: formData.deadline,
        priority: formData.priority,
        comments: formData.comments || null
      };

      console.log('📤 Submitting task (MongoDB format):', taskData);
      
      await onSubmit(taskData);
      onClose();
    } catch (err) {
      console.error('Error creating task:', err);
      setError(err.message || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user makes changes
    if (error) {
      setError('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Add Task</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={loading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-6">
          Assign a new task and keep your team aligned.
        </p>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Loading Users */}
        {loadingUsers && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            <span className="ml-3 text-gray-600">Loading users...</span>
          </div>
        )}

        {/* Form */}
        {!loadingUsers && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* User Selection - MongoDB Compatible */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assign To*
              </label>
              <select
                name="assignedToUserId"
                value={formData.assignedToUserId}
                onChange={handleChange}
                required
                disabled={loading || users.length === 0}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">Select User</option>
                {users.map((user) => (
                  <option key={user._id || user.id} value={user._id || user.id}>
                    {user.name} - {user.email} ({user.role})
                  </option>
                ))}
              </select>
              {users.length === 0 && !loadingUsers && (
                <p className="mt-1 text-xs text-red-600">No users available</p>
              )}
            </div>

            {/* Scope Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Scope*
              </label>
              <div className="flex space-x-4">
                {[1, 2, 3].map((scopeNum) => (
                  <label key={scopeNum} className="flex items-center">
                    <input
                      type="radio"
                      name="scope"
                      value={scopeNum}
                      checked={formData.scope === scopeNum}
                      onChange={handleChange}
                      disabled={loading}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      Scope {scopeNum}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Activity Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Activity Type*
              </label>
              <select
                name="activity"
                value={formData.activity}
                onChange={handleChange}
                required
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">Select Activity Type</option>
                <option value="Fuel Combustion">Fuel Combustion</option>
                <option value="Electricity Purchase">Electricity Purchase</option>
                <option value="Business Travel">Business Travel</option>
                <option value="Employee Commuting">Employee Commuting</option>
                <option value="Waste Disposal">Waste Disposal</option>
                <option value="Water Consumption">Water Consumption</option>
                <option value="Refrigerants">Refrigerants</option>
                <option value="Transportation">Transportation</option>
                <option value="Natural Gas Consumption">Natural Gas Consumption</option>
              </select>
            </div>

            {/* Source */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source
              </label>
              <select
                name="source"
                value={formData.source}
                onChange={handleChange}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">Select Source (Optional)</option>
                <option value="Diesel">Diesel</option>
                <option value="Petrol">Petrol</option>
                <option value="Natural Gas">Natural Gas</option>
                <option value="Electricity Grid">Electricity Grid</option>
                <option value="LPG">LPG</option>
                <option value="Coal">Coal</option>
              </select>
            </div>

            {/* Accounting Period */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Accounting Period*
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <Calendar className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleChange}
                    placeholder="Start Date"
                    disabled={loading}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    required
                  />
                </div>
                <div className="relative">
                  <Calendar className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="date"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleChange}
                    placeholder="End Date"
                    disabled={loading}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Deadline */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Deadline*
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  name="deadline"
                  value={formData.deadline}
                  onChange={handleChange}
                  placeholder="Task Deadline"
                  disabled={loading}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  required
                />
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority*
              </label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            {/* Comments */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Comments
              </label>
              <textarea
                name="comments"
                value={formData.comments}
                onChange={handleChange}
                placeholder="Add any additional notes or instructions..."
                rows={3}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-4">
              <button
                type="submit"
                disabled={loading || users.length === 0}
                className="flex-1 bg-emerald-600 text-white py-2 px-4 rounded-lg hover:bg-emerald-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Add Task'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 border border-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AddTaskModal;