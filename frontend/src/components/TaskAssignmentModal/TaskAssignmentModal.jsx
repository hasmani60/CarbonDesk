// frontend/src/components/TaskAssignmentModal/TaskAssignmentModal.jsx
// ENHANCED VERSION - MongoDB Compatible - Shows activity names and auto-locks unavailable activities

import { useState, useEffect } from 'react';
import { X, Calendar, Users, Target, Activity, Clock, AlertCircle, CheckCircle, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { monitorAPI } from '../../services/api';
import toast from 'react-hot-toast';

const TaskAssignmentModal = ({ onSubmit, onClose, loading = false }) => {
  const { user } = useAuth();
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [diagnostics, setDiagnostics] = useState(null);
  const [formData, setFormData] = useState({
    assignedToUserId: '',
    scope: '1',
    activity: '',
    source: '',
    startDate: '',
    endDate: '',
    deadline: '',
    comments: '',
    priority: 'medium'
  });
  const [errors, setErrors] = useState({});

  const scopeActivities = {
    1: [
      'Gaseous Fuels', 'Liquid Fuels', 'Solid Fuels',
      'Bioenergy - Bioethanol', 'Bioenergy - Biodiesel', 'Bioenergy - Biomass',
      'Refrigerants', 'Fuel from Generator', 'Natural Gas Consumption', 'Fleet Vehicle Usage'
    ],
    2: [
      'UK Electricity', 'Electricity Purchased', 'UK Electricity for Electric Vehicles',
      'Transmission & Distribution Losses', 'Steam Purchased', 'Heating & Cooling Purchased'
    ],
    3: [
      'Business Travel - Air - Domestic', 'Business Travel - Air - Short Haul', 'Business Travel - Air - Long Haul',
      'Business Travel - Cars', 'Business Travel - Rail', 'Freighting Goods - Road', 'Freighting Goods - Air',
      'Material Use - Metals', 'Material Use - Plastics & Polymers', 'Waste Disposal - Refuse',
      'Water Supply', 'Hotel Stay', 'Homeworking'
    ]
  };

  useEffect(() => {
    loadAssignableUsers();
  }, []);

  useEffect(() => {
    // Update available activities based on scope and selected user
    updateAvailableActivities();
  }, [formData.scope, formData.assignedToUserId]);

  // Real-time validation effect
  useEffect(() => {
    const selectedUserInfo = getUserAccessInfo(formData.assignedToUserId);
    if (selectedUserInfo && !selectedUserInfo.hasFullAccess) {
      const currentScope = parseInt(formData.scope);
      const hasScopeAccess = selectedUserInfo.allowedScopes?.includes(currentScope);
      const hasActivityAccess = formData.activity && selectedUserInfo.allowedActivities?.includes(formData.activity);
      
      // Only show error if user has NEITHER scope NOR activity access
      if (!hasScopeAccess && !hasActivityAccess) {
        if (formData.activity) {
          // Activity is selected, but user doesn't have access to it
          setErrors(prev => ({
            ...prev,
            scope: `Selected user doesn't have access to Scope ${currentScope} or "${formData.activity}"`
          }));
        } else {
          // No activity selected yet, just warn about scope
          setErrors(prev => ({
            ...prev,
            scope: `Selected user doesn't have Scope ${currentScope} access (may have specific activity access)`
          }));
        }
      } else {
        // User has scope OR activity access - clear error
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.scope;
          return newErrors;
        });
      }
    } else {
      // Clear scope error if user has full access or no restrictions
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.scope;
        return newErrors;
      });
    }
  }, [formData.scope, formData.assignedToUserId, formData.activity]);

  const updateAvailableActivities = () => {
    const allActivitiesInScope = scopeActivities[parseInt(formData.scope)] || [];
    
    if (!formData.assignedToUserId) {
      setActivities(allActivitiesInScope.map(name => ({ name, accessible: true })));
      return;
    }

    const selectedUserInfo = getUserAccessInfo(formData.assignedToUserId);
    
    if (!selectedUserInfo || selectedUserInfo.hasFullAccess) {
      // User has full access - all activities available
      setActivities(allActivitiesInScope.map(name => ({ name, accessible: true })));
    } else {
      // User has restrictions - mark activities as accessible or not
      const currentScope = parseInt(formData.scope);
      const hasScopeAccess = selectedUserInfo.allowedScopes?.includes(currentScope);
      
      const activitiesWithAccess = allActivitiesInScope.map(name => {
        let accessible = false;
        
        // If user has full scope access, all activities in that scope are accessible
        if (hasScopeAccess) {
          accessible = true;
        } 
        // Otherwise, check if user has specific activity access
        else if (selectedUserInfo.allowedActivities?.includes(name)) {
          accessible = true;
        }
        
        return { name, accessible };
      });
      
      setActivities(activitiesWithAccess);
      
      // If current selection is not accessible, clear it
      if (formData.activity && !activitiesWithAccess.find(a => a.name === formData.activity && a.accessible)) {
        setFormData(prev => ({ ...prev, activity: '' }));
      }
    }
  };

  const loadAssignableUsers = async () => {
    try {
      setLoadingUsers(true);
      
      const token = localStorage.getItem('token');
      
      if (!token) {
        toast.error('No authentication token found. Please log in again.');
        setLoadingUsers(false);
        return;
      }

      console.log('📋 Attempting to load assignable users...');
      const result = await monitorAPI.getAssignableUsers();
      const usersData = Array.isArray(result) ? result : (result?.data || []);
      
      if (usersData) {
        console.log('📥 RAW USER DATA FROM BACKEND:', JSON.stringify(usersData, null, 2));
        
        // MONGODB CHANGE: Use _id (ObjectId) instead of numeric id
        const filteredUsers = usersData.map(u => {
            // Handle different possible field names from backend
            const allowedScopes = u.allowedScopes || u.allowed_scopes || u.restrictions?.allowedScopes || null;
            const allowedActivities = u.allowedActivities || u.allowed_activities || u.restrictions?.allowedActivities || null;
            const restrictions = u.restrictions || null;
            
            const mappedUser = {
              id: u._id || u.id, // MONGODB: Use _id as primary identifier
              _id: u._id || u.id, // Keep both for compatibility
              name: u.name,
              email: u.email,
              role: u.role,
              restrictions: restrictions,
              allowedScopes: allowedScopes,
              allowedActivities: allowedActivities
            };
            
            console.log(`👤 Mapped user: ${u.name}`, {
              id: mappedUser.id,
              role: mappedUser.role,
              restrictions: mappedUser.restrictions,
              allowedScopes: mappedUser.allowedScopes,
              allowedActivities: mappedUser.allowedActivities
            });
            
            return mappedUser;
          });
          
        console.log(`✅ Loaded ${filteredUsers.length} assignable users (using ObjectId)`);
        setAssignableUsers(filteredUsers);
      } else {
        console.warn('⚠️ Unexpected response structure:', result);
        toast.warning('No assignable users found');
        setAssignableUsers([]);
      }
      
    } catch (error) {
      console.error('❌ Exception loading assignable users:', error);
      toast.error('Error loading users. Check console for details.');
      setAssignableUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const getUserAccessInfo = (userId) => {
    if (!userId) return null;
    return assignableUsers.find(u => u.id === userId);
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.assignedToUserId) newErrors.assignedToUserId = 'Please select a user';
    if (!formData.scope) newErrors.scope = 'Please select a scope';
    if (!formData.activity) newErrors.activity = 'Please select an activity';
    if (!formData.startDate) newErrors.startDate = 'Start date is required';
    if (!formData.endDate) newErrors.endDate = 'End date is required';
    if (!formData.deadline) newErrors.deadline = 'Deadline is required';
    
    // Validate date logic
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      if (end < start) {
        newErrors.endDate = 'End date must be after start date';
      }
    }
    
    if (formData.deadline && formData.startDate) {
      const deadline = new Date(formData.deadline);
      const start = new Date(formData.startDate);
      if (deadline < start) {
        newErrors.deadline = 'Deadline should be after start date';
      }
    }
    
    // Check user permissions
    const selectedUserInfo = getUserAccessInfo(formData.assignedToUserId);
    if (selectedUserInfo && !selectedUserInfo.hasFullAccess && formData.activity) {
      const currentScope = parseInt(formData.scope);
      const hasScopeAccess = selectedUserInfo.allowedScopes?.includes(currentScope);
      const hasActivityAccess = selectedUserInfo.allowedActivities?.includes(formData.activity);
      
      if (!hasScopeAccess && !hasActivityAccess) {
        newErrors.activity = `Selected user doesn't have access to this activity`;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fix the form errors');
      return;
    }
    
    // MONGODB CHANGE: Submit with ObjectId (already a string from select value)
    const taskData = {
      assignedToUserId: formData.assignedToUserId, // ObjectId string
      scope: parseInt(formData.scope),
      activity: formData.activity,
      source: formData.source || null,
      startDate: formData.startDate,
      endDate: formData.endDate,
      deadline: formData.deadline,
      comments: formData.comments || null,
      priority: formData.priority
    };
    
    console.log('📤 Submitting task (MongoDB compatible):', taskData);
    
    try {
      await onSubmit(taskData);
    } catch (error) {
      console.error('Task submission error:', error);
      toast.error(error.message || 'Failed to assign task');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const getMinDate = () => {
    const today = new Date();
    today.setDate(today.getDate() - 365); // Allow dates from last year
    return today.toISOString().split('T')[0];
  };

  const accessibleActivities = activities.filter(a => a.accessible);
  const lockedActivities = activities.filter(a => !a.accessible);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Assign New Task</h2>
            <p className="text-sm text-gray-600 mt-1">Create and assign a task to a team member</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={loading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Diagnostics - Only show if there was a loading error */}
        {diagnostics && diagnostics.isHTML && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h4 className="text-sm font-medium text-red-800 mb-2">⚠️ Backend Connection Issue</h4>
            <div className="text-xs text-red-700 space-y-1">
              <p>URL: {diagnostics.url}</p>
              <p>Status: {diagnostics.status}</p>
              <p>Content-Type: {diagnostics.contentType}</p>
              <p className="mt-2">Make sure your backend is running on port 5001</p>
            </div>
          </div>
        )}

        {/* Loading State for Users */}
        {loadingUsers && (
          <div className="px-6 py-8">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
              <span className="ml-3 text-gray-600">Loading assignable users...</span>
            </div>
          </div>
        )}

        {/* No Users Available */}
        {!loadingUsers && assignableUsers.length === 0 && (
          <div className="px-6 py-8">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Users Available</h3>
              <p className="text-gray-600">
                No assignable users found. Please check backend connectivity or user permissions.
              </p>
            </div>
          </div>
        )}

        {/* Form */}
        {!loadingUsers && assignableUsers.length > 0 && (
          <form onSubmit={handleSubmit} className="px-6 py-4">
            <div className="space-y-5">
              {/* User Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Users className="w-4 h-4 inline mr-2" />
                  Assign To*
                </label>
                <select
                  name="assignedToUserId"
                  value={formData.assignedToUserId}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                    errors.assignedToUserId ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                  disabled={loading}
                >
                  <option value="">Select a user...</option>
                  {assignableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} - {u.email} ({u.role})
                    </option>
                  ))}
                </select>
                {errors.assignedToUserId && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.assignedToUserId}
                  </p>
                )}
                
                {/* Show user restrictions if applicable */}
                {formData.assignedToUserId && (() => {
                  const userInfo = getUserAccessInfo(formData.assignedToUserId);
                  if (userInfo && userInfo.restrictions) {
                    return (
                      <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm font-medium text-blue-900 mb-1">User Access Restrictions:</p>
                        <div className="text-xs text-blue-700 space-y-1">
                          {userInfo.allowedScopes && userInfo.allowedScopes.length > 0 && (
                            <p>• Scopes: {userInfo.allowedScopes.join(', ')}</p>
                          )}
                          {userInfo.allowedActivities && userInfo.allowedActivities.length > 0 && (
                            <p>• Activities: {userInfo.allowedActivities.length} specific activities</p>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Scope Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Target className="w-4 h-4 inline mr-2" />
                  Emission Scope*
                </label>
                <div className="flex space-x-4">
                  {[1, 2, 3].map((scopeNum) => (
                    <label key={scopeNum} className="flex items-center flex-1">
                      <input
                        type="radio"
                        name="scope"
                        value={scopeNum.toString()}
                        checked={formData.scope === scopeNum.toString()}
                        onChange={handleChange}
                        className="text-emerald-600 focus:ring-emerald-500"
                        disabled={loading}
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700">Scope {scopeNum}</span>
                    </label>
                  ))}
                </div>
                {errors.scope && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.scope}
                  </p>
                )}
              </div>

              {/* Activity Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Activity className="w-4 h-4 inline mr-2" />
                  Activity Type*
                </label>
                <select
                  name="activity"
                  value={formData.activity}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                    errors.activity ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                  disabled={loading}
                >
                  <option value="">Select Activity</option>
                  
                  {/* Accessible activities */}
                  {accessibleActivities.length > 0 && (
                    <optgroup label="✓ Available Activities">
                      {accessibleActivities.map((activity) => (
                        <option key={activity.name} value={activity.name}>
                          {activity.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  
                  {/* Locked activities */}
                  {lockedActivities.length > 0 && formData.assignedToUserId && (
                    <optgroup label="🔒 Restricted Activities">
                      {lockedActivities.map((activity) => (
                        <option key={activity.name} value={activity.name} disabled>
                          🔒 {activity.name} (No Access)
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                {errors.activity && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.activity}
                  </p>
                )}
                
                {/* Show activity access summary */}
                {formData.assignedToUserId && (
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-green-600">✓ {accessibleActivities.length} accessible</span>
                    {lockedActivities.length > 0 && (
                      <span className="text-gray-500">🔒 {lockedActivities.length} restricted</span>
                    )}
                  </div>
                )}
              </div>

              {/* Source */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Source/Subcategory <span className="text-gray-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  name="source"
                  value={formData.source}
                  onChange={handleChange}
                  placeholder="e.g., Diesel, Natural Gas, Business Travel"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  disabled={loading}
                />
              </div>

              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-2" />
                  Accounting Period*
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                    <input
                      type="date"
                      name="startDate"
                      value={formData.startDate}
                      onChange={handleChange}
                      min={getMinDate()}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                        errors.startDate ? 'border-red-300 bg-red-50' : 'border-gray-300'
                      }`}
                      disabled={loading}
                    />
                    {errors.startDate && <p className="mt-1 text-xs text-red-600">{errors.startDate}</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">End Date</label>
                    <input
                      type="date"
                      name="endDate"
                      value={formData.endDate}
                      onChange={handleChange}
                      min={formData.startDate || getMinDate()}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                        errors.endDate ? 'border-red-300 bg-red-50' : 'border-gray-300'
                      }`}
                      disabled={loading}
                    />
                    {errors.endDate && <p className="mt-1 text-xs text-red-600">{errors.endDate}</p>}
                  </div>
                </div>
              </div>

              {/* Deadline */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Clock className="w-4 h-4 inline mr-2" />
                  Deadline*
                </label>
                <input
                  type="date"
                  name="deadline"
                  value={formData.deadline}
                  onChange={handleChange}
                  min={getMinDate()}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                    errors.deadline ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                  disabled={loading}
                />
                {errors.deadline && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.deadline}
                  </p>
                )}
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  disabled={loading}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              {/* Comments */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Instructions/Comments</label>
                <textarea
                  name="comments"
                  value={formData.comments}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Provide specific instructions or additional context for this task..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                  disabled={loading}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4 border-t">
                <button
                  type="submit"
                  disabled={loading || !formData.assignedToUserId || !formData.activity || assignableUsers.length === 0}
                  className="flex-1 bg-emerald-600 text-white py-3 px-4 rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Assigning...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Assign Task
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 border border-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default TaskAssignmentModal;