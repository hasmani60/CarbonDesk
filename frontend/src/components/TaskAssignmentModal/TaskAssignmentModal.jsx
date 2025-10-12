// frontend/src/components/TaskAssignmentModal/TaskAssignmentModal.jsx
// ENHANCED VERSION - Shows activity names and auto-locks unavailable activities

import { useState, useEffect } from 'react';
import { X, Calendar, Users, Target, Activity, Clock, AlertCircle, CheckCircle, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
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

      const BACKEND_URL = 'http://localhost:5001';
      const url = `${BACKEND_URL}/api/tasks/assignable-users`;
      
      console.log('📋 Attempting to load assignable users...');
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const contentType = response.headers.get('content-type');
      const responseText = await response.text();
      
      setDiagnostics({
        url,
        status: response.status,
        contentType,
        isHTML: responseText.startsWith('<!DOCTYPE') || responseText.startsWith('<html'),
        responsePreview: responseText.substring(0, 200)
      });
      
      if (responseText.startsWith('<!DOCTYPE') || responseText.startsWith('<html')) {
        console.error('❌ PROBLEM: Received HTML instead of JSON');
        toast.error('API endpoint not found. Backend may not be running on port 5001.');
        setLoadingUsers(false);
        return;
      }
      
      if (response.ok) {
        const result = JSON.parse(responseText);
        
        if (result.success && result.data) {
          console.log('📥 RAW USER DATA FROM BACKEND:', JSON.stringify(result.data, null, 2));
          
          const filteredUsers = result.data.map(u => {
            // Handle different possible field names from backend
            const allowedScopes = u.allowedScopes || u.allowed_scopes || null;
            const allowedActivities = u.allowedActivities || u.allowed_activities || null;
            const restrictions = u.restrictions || null;
            
            const mappedUser = {
              id: parseInt(u.id),
              name: u.name,
              email: u.email,
              role: u.role,
              restrictions: restrictions,
              allowedScopes: allowedScopes,
              allowedActivities: allowedActivities
            };
            
            console.log(`📋 Mapped User "${u.name}":`, {
              id: mappedUser.id,
              hasRestrictions: !!restrictions,
              allowedScopes: allowedScopes,
              allowedActivities: allowedActivities ? `${allowedActivities.length} activities` : 'none'
            });
            
            return mappedUser;
          });
          
          setAssignableUsers(filteredUsers);
          console.log(`✅ Loaded ${filteredUsers.length} assignable users`);
          
          if (filteredUsers.length === 0) {
            toast.error('No contributors or analysts available for assignment.');
          } else {
            toast.success(`Found ${filteredUsers.length} user(s) available for assignment`);
          }
        } else {
          throw new Error(result.message || 'Invalid response format');
        }
      } else {
        const errorData = JSON.parse(responseText);
        console.error('❌ Error response:', errorData);
        toast.error(`Error ${response.status}: ${errorData.message || 'Failed to load users'}`);
      }
    } catch (error) {
      console.error('❌ Error loading users:', error);
      
      if (error instanceof SyntaxError) {
        toast.error('Backend returned invalid response. Check console for details.');
      } else {
        toast.error(`Error: ${error.message}`);
      }
    } finally {
      setLoadingUsers(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.assignedToUserId) newErrors.assignedToUserId = 'Please select a user';
    if (!formData.activity) newErrors.activity = 'Please select an activity';
    if (!formData.startDate) newErrors.startDate = 'Start date is required';
    if (!formData.endDate) newErrors.endDate = 'End date is required';
    if (!formData.deadline) newErrors.deadline = 'Deadline is required';
    
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      if (start >= end) newErrors.endDate = 'End date must be after start date';
    }
    
    if (formData.deadline) {
      const deadline = new Date(formData.deadline);
      const now = new Date();
      if (deadline < now) newErrors.deadline = 'Deadline cannot be in the past';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error('Please fix the errors below');
      return;
    }

    const selectedUserId = parseInt(formData.assignedToUserId);
    const selectedUser = assignableUsers.find(u => u.id === selectedUserId);
    
    console.log('🔍 VALIDATION DEBUG:');
    console.log('Selected User:', selectedUser);
    
    if (selectedUser) {
      const userInfo = getUserAccessInfo(selectedUserId);
      console.log('User Info:', userInfo);
      console.log('Has Full Access:', userInfo?.hasFullAccess);
      console.log('Allowed Scopes:', userInfo?.allowedScopes);
      console.log('Allowed Activities:', userInfo?.allowedActivities);
      
      // Only check restrictions if user has them
      if (userInfo && !userInfo.hasFullAccess) {
        const currentScope = parseInt(formData.scope);
        console.log('Current Scope:', currentScope);
        console.log('Current Activity:', formData.activity);
        console.log('Checking access...');
        
        // Check if user has scope-level access
        const hasScopeAccess = userInfo.allowedScopes?.includes(currentScope);
        console.log('Has Scope Access:', hasScopeAccess);
        
        // Check if user has activity-level access
        const hasActivityAccess = userInfo.allowedActivities?.includes(formData.activity);
        console.log('Has Activity Access:', hasActivityAccess);
        
        // User needs EITHER scope access OR activity access
        if (!hasScopeAccess && !hasActivityAccess) {
          console.error('❌ FRONTEND VALIDATION FAILED: User has neither scope nor activity access');
          toast.error(`${selectedUser.name} does not have access to Scope ${currentScope} or activity "${formData.activity}"`);
          return;
        }
        
        if (hasScopeAccess) {
          console.log('✅ Access granted via SCOPE access');
        } else if (hasActivityAccess) {
          console.log('✅ Access granted via ACTIVITY access');
        }
        
      } else {
        console.log('✅ User has full access - skipping validation');
      }
    }

    const submissionData = {
      assignedToUserId: selectedUserId,
      scope: parseInt(formData.scope),
      activity: formData.activity,
      source: formData.source || '',
      startDate: formData.startDate,
      endDate: formData.endDate,
      deadline: formData.deadline,
      comments: formData.comments || '',
      priority: formData.priority
    };

    console.log('📤 Submitting task data:', submissionData);
    console.log('📤 Frontend validation passed - sending to backend...');
    onSubmit(submissionData);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const getMinDate = () => new Date().toISOString().split('T')[0];

  const getUserAccessInfo = (userId) => {
    if (!userId) return null;
    
    const parsedId = parseInt(userId);
    const user = assignableUsers.find(u => u.id === parsedId);
    if (!user) return null;
    
    // User has full access if:
    // 1. No restrictions object at all, OR
    // 2. restrictions is null/undefined, OR  
    // 3. Both allowedScopes and allowedActivities are null/empty
    const hasFullAccess = !user.restrictions || 
                         (!user.allowedScopes && !user.allowedActivities);
    
    return {
      allowedScopes: user.allowedScopes || null,
      allowedActivities: user.allowedActivities || null,
      hasFullAccess: hasFullAccess
    };
  };

  const selectedUserInfo = formData.assignedToUserId ? getUserAccessInfo(formData.assignedToUserId) : null;
  const accessibleActivities = activities.filter(a => a.accessible);
  const lockedActivities = activities.filter(a => !a.accessible);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Assign Task</h2>
              <p className="text-sm text-gray-600">Assign an emissions-related task to a team member</p>
            </div>
          </div>
          <button onClick={onClose} disabled={loading} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Diagnostics Panel (Remove in production) */}
        {diagnostics && diagnostics.isHTML && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h4 className="text-sm font-bold text-red-900 mb-2">Connection Problem Detected</h4>
            <div className="text-xs text-red-800 space-y-1 font-mono">
              <p><strong>URL:</strong> {diagnostics.url}</p>
              <p><strong>Status:</strong> {diagnostics.status}</p>
              <p><strong>Problem:</strong> Received HTML instead of JSON</p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* User Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Users className="w-4 h-4 inline mr-2" />
              Assign To*
            </label>
            {loadingUsers ? (
              <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600"></div>
                  <span className="text-gray-500">Loading users from backend...</span>
                </div>
              </div>
            ) : assignableUsers.length === 0 ? (
              <div className="space-y-2">
                <div className="w-full px-3 py-2 border border-yellow-300 rounded-lg bg-yellow-50">
                  <span className="text-yellow-700">No contributors or analysts available</span>
                </div>
                <button
                  type="button"
                  onClick={loadAssignableUsers}
                  className="text-sm text-emerald-600 hover:text-emerald-700 underline"
                >
                  Retry loading users
                </button>
              </div>
            ) : (
              <select
                name="assignedToUserId"
                value={formData.assignedToUserId}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                  errors.assignedToUserId ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                disabled={loading}
              >
                <option value="">Select User</option>
                {assignableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.role}) {user.restrictions ? '- Restricted' : ''}
                  </option>
                ))}
              </select>
            )}
            {errors.assignedToUserId && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                {errors.assignedToUserId}
              </p>
            )}
            
            {/* ENHANCED: Show activity names and access details */}
            {selectedUserInfo && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-sm font-medium text-blue-900 mb-2">User Access Level:</h4>
                <div className="text-xs text-blue-800 space-y-1">
                  {selectedUserInfo.hasFullAccess ? (
                    <p className="flex items-center">
                      <CheckCircle className="w-3 h-3 mr-1 text-green-600" />
                      Full access to all scopes and activities
                    </p>
                  ) : (
                    <>
                      {selectedUserInfo.allowedScopes && (
                        <p>• <strong>Allowed Scopes:</strong> {selectedUserInfo.allowedScopes.join(', ')}</p>
                      )}
                      {selectedUserInfo.allowedActivities && selectedUserInfo.allowedActivities.length > 0 && (
                        <div className="mt-2">
                          <p className="font-semibold mb-1">• <strong>Accessible Activities ({selectedUserInfo.allowedActivities.length}):</strong></p>
                          <div className="ml-4 max-h-32 overflow-y-auto bg-white rounded p-2 space-y-0.5">
                            {selectedUserInfo.allowedActivities.map((activity, idx) => (
                              <p key={idx} className="text-xs text-blue-700">✓ {activity}</p>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Scope Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Target className="w-4 h-4 inline mr-2" />
              Emission Scope*
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((scope) => {
                const isDisabled = selectedUserInfo && !selectedUserInfo.hasFullAccess && 
                                   selectedUserInfo.allowedScopes && 
                                   !selectedUserInfo.allowedScopes.includes(scope);
                
                // Check if user has ANY activities in this scope
                const hasActivitiesInScope = selectedUserInfo && 
                                            !selectedUserInfo.hasFullAccess && 
                                            selectedUserInfo.allowedActivities &&
                                            scopeActivities[scope]?.some(activity => 
                                              selectedUserInfo.allowedActivities.includes(activity)
                                            );
                
                return (
                  <label key={scope} className={`flex items-center p-3 border rounded-lg cursor-pointer ${
                    isDisabled && !hasActivitiesInScope ? 'bg-gray-100 opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
                  }`}>
                    <input
                      type="radio"
                      name="scope"
                      value={scope.toString()}
                      checked={formData.scope === scope.toString()}
                      onChange={handleChange}
                      disabled={loading || (isDisabled && !hasActivitiesInScope)}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="ml-2 text-sm font-medium text-gray-700 flex items-center">
                      Scope {scope}
                      {isDisabled && !hasActivitiesInScope && <Lock className="w-3 h-3 ml-1 text-gray-400" />}
                      {hasActivitiesInScope && <span className="ml-1 text-xs text-blue-600">(limited)</span>}
                    </span>
                  </label>
                );
              })}
            </div>
            
            {errors.scope && (
              <p className="mt-2 text-sm text-yellow-600 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                {errors.scope}
              </p>
            )}
          </div>

          {/* Activity Selection - ENHANCED with locking */}
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
        </form>
      </div>
    </div>
  );
};

export default TaskAssignmentModal;