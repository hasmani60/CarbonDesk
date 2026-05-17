// pages/Input/Input.jsx - Fine-Grained RBAC Implementation with TaskWidget Integration
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, ChevronDown, ChevronUp, Info, Lock, Shield, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useActivity } from '../../context/ActivityContext';
import { emissionsAPI } from '../../services/api';
import { emissionFactors } from '../../data/complete_emission_factors_db';
import PageHeader from '../../components/PageHeader/PageHeader';
import EmissionForm from '../../components/EmissionForm/EmissionForm';
import InfoTooltip from '../../components/InfoTooltip/InfoTooltip';
import TaskWidget from '../../components/TaskWidget/TaskWidget';
import EmployeeCommuting from '../../components/EmployeeCommuting/EmployeeCommuting';
import toast from 'react-hot-toast';

/** DB/JWT may store scope ids as strings — avoid .includes(1) failing on ["1"] */
function scopeAllowListIncludes(list, scopeVal) {
  if (!Array.isArray(list) || list.length === 0) return false;
  const t = parseInt(String(scopeVal), 10);
  if (!Number.isFinite(t)) return false;
  return list.some((s) => parseInt(String(s), 10) === t);
}

const Input = () => {
  const { user, canAccessScope, canAccessActivity, getAllowedScopes, getAllowedActivities } = useAuth();
  const { logPageView, logEmissionAction } = useActivity();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeScope, setActiveScope] = useState('1');
  const [activities, setActivities] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedActivities, setExpandedActivities] = useState({});
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [showEmissionForm, setShowEmissionForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  // Scope definitions
  const scopes = [
    { id: '1', label: 'Scope 1', description: 'Direct emissions from owned or controlled sources' },
    { id: '2', label: 'Scope 2', description: 'Indirect emissions from purchased energy' },
    { id: '3', label: 'Scope 3', description: 'All other indirect emissions from value chain activities' }
  ];

  // Get activity structure from emission factors database
  const getActivityStructure = () => {
    const activityStructure = {};
    
    ['1', '2', '3'].forEach(scope => {
      const scopeKey = `scope${scope}`;
      const scopeData = emissionFactors[scopeKey];
      
      if (scopeData) {
        activityStructure[scope] = Object.keys(scopeData).map(categoryName => {
          const sources = scopeData[categoryName];
          
          // Determine activity type based on category and sources
          const activityType = determineActivityType(categoryName, sources);
          
          return {
            name: categoryName,
            activityType: activityType,
            sources: Object.keys(sources),
            icon: getCategoryIcon(categoryName),
            description: getActivityDescription(categoryName, activityType)
          };
        });
      }
    });
    
    return activityStructure;
  };

  // Determine what type of input is needed for this activity
  const determineActivityType = (categoryName, sources) => {
    const firstSourceKey = Object.keys(sources)[0];
    const firstSource = sources[firstSourceKey];
    
    // Check unit to determine activity type
    if (firstSource.unit.includes('passenger.km')) {
      return 'passenger-distance';
    } else if (firstSource.unit.includes('tonne.km')) {
      return 'freight';
    } else if (firstSource.unit.includes('km')) {
      return 'distance';
    } else if (firstSource.unit === 'kg' && categoryName === 'Refrigerants') {
      return 'refrigerant';
    } else if (['tonnes', 'litres', 'kWh', 'm3', 'cubic metres'].some(u => firstSource.unit.includes(u))) {
      return 'fuel-based';
    } else if (firstSource.unit === 'room.night') {
      return 'accommodation';
    } else if (firstSource.unit === 'employee.hour') {
      return 'homeworking';
    } else {
      return 'quantity';
    }
  };

  // Get user-friendly description based on activity type
  const getActivityDescription = (categoryName, activityType) => {
    const descriptions = {
      'fuel-based': `Select fuel type and enter quantity consumed`,
      'distance': categoryName.includes('Business Travel - Cars') ||
        categoryName.includes('Business Travel - Taxis') ||
        categoryName.includes('Business Travel - Motorbikes') ||
        /^Passenger Vehicles|^Delivery Vehicles/i.test(categoryName)
        ? `Select origin & destination locations, or enter distance manually`
        : `Select vehicle type and enter distance travelled`,
      'passenger-distance': categoryName.includes('Business Travel - Air')
        ? `Select origin & destination airports, or enter distance manually`
        : categoryName.includes('Business Travel - Sea')
          ? `Select origin & destination ports, or enter distance manually`
          : `Enter number of passengers and distance travelled`,
      'freight': categoryName.includes('Freighting Goods - Air')
        ? `Select airports for route distance, or enter distance manually`
        : categoryName.includes('Freighting Goods - Sea')
          ? `Select ports for route distance, or enter distance manually`
          : categoryName.includes('Freighting Goods - Road')
            ? `Select supplier/customer location; factory site auto-filled from Organisation address`
            : `Enter cargo weight and distance transported`,
      'refrigerant': `Select refrigerant type and enter amount leaked/used`,
      'accommodation': `Enter number of room nights`,
      'homeworking': `Enter number of employee working hours`,
      'quantity': `Enter quantity consumed or used`
    };
    
    return descriptions[activityType] || `Track emissions from ${categoryName}`;
  };

  // Helper function to get appropriate icon for category
  const getCategoryIcon = (categoryName) => {
    const iconMap = {
      // Scope 1
      'Gaseous Fuels': '⛽',
      'Liquid Fuels': '🛢️',
      'Solid Fuels': '⚫',
      'Bioenergy - Bioethanol': '🌱',
      'Bioenergy - Biodiesel': '🌾',
      'Bioenergy - Biomass': '🪵',
      'Refrigerants': '❄️',
      'Passenger Vehicles - Cars by Size': '🚗',
      'Passenger Vehicles - Cars by Market Segment': '🚙',
      'Passenger Vehicles - Motorbikes': '🏍️',
      'Delivery Vehicles - Vans': '🚐',
      'Delivery Vehicles - HGV': '🚛',
      
      // Scope 2
      'UK Electricity': '⚡',
      'UK Electricity for Electric Vehicles': '🔌',
      'Transmission & Distribution Losses': '📊',
      
      // Scope 3
      'Business Travel - Air - Domestic': '✈️',
      'Business Travel - Air - Short Haul': '🛫',
      'Business Travel - Air - Long Haul': '🛬',
      'Business Travel - Air - International': '🌍',
      'Business Travel - Cars': '🚗',
      'Business Travel - Taxis': '🚕',
      'Business Travel - Motorbikes': '🏍️',
      'Business Travel - Bus': '🚌',
      'Business Travel - Rail': '🚆',
      'Business Travel - Sea': '🚢',
      'Freighting Goods - Road': '🚚',
      'Freighting Goods - Air': '✈️',
      'Freighting Goods - Sea': '⚓',
      'Freighting Goods - Rail': '🚂',
      'Material Use - Aggregates & Minerals': '⛰️',
      'Material Use - Metals': '⚙️',
      'Material Use - Plastics & Polymers': '♻️',
      'Material Use - Organics': '📄',
      'Material Use - Textiles': '👕',
      'Material Use - Electronics': '💻',
      'Material Use - Other': '📦',
      'Waste Disposal - Refuse': '🗑️',
      'Waste Disposal - Organic': '🍂',
      'Waste Disposal - Paper & Cardboard': '📦',
      'Waste Disposal - Plastics': '♻️',
      'Waste Disposal - Metal': '⚙️',
      'Waste Disposal - Glass': '🥤',
      'Waste Disposal - Clothing & Textiles': '👔',
      'Waste Disposal - WEEE': '💾',
      'Waste Disposal - Construction': '🏗️',
      'Waste Disposal - Other': '🗑️',
      'Water Supply': '💧',
      'Water Treatment': '🚰',
      'Hotel Stay': '🏨',
      'Homeworking': '🏠'
    };
    
    return iconMap[categoryName] || '📊';
  };

  const activityStructure = getActivityStructure();

  // RBAC check - ensure user can access Input page
  useEffect(() => {
    if (!user) return;
    
    // Check page-level access first
    if (!['admin', 'contributor'].includes(user.role)) {
      navigate('/dashboard');
      toast.error(`Access denied. Your role (${user.role}) cannot access the Input page.`);
      return;
    }

    // Check if contributor has page restricted
    if (user.role === 'contributor' && user.restrictions?.restrictedPages?.includes('/input')) {
      navigate('/dashboard');
      toast.error('Access denied. You do not have permission to access the Input page.');
      return;
    }

    logPageView('Input', { userRole: user.role, allowedScopes: getAllowedScopes() });
  }, [user, navigate, logPageView, getAllowedScopes]);

  // Initialize scope and load activities
  useEffect(() => {
    initializeScope();
  }, [user]);

  // Handle URL scope parameter changes
  useEffect(() => {
    const scopeParam = searchParams.get('scope');
    if (scopeParam && ['1', '2', '3'].includes(scopeParam) && scopeParam !== activeScope) {
      handleScopeChange(scopeParam, false);
    }
  }, [searchParams]);

  // Load activities when active scope changes
  useEffect(() => {
    if (activeScope) {
      loadActivities();
    }
  }, [activeScope, user]);

  const initializeScope = () => {
    if (!user) return;
    
    const scopeParam = searchParams.get('scope');
    const allowedScopes = getAllowedScopes();
    
    if (allowedScopes.length === 0) {
      setAccessDenied(true);
      setLoading(false);
      return;
    }

    if (scopeParam && ['1', '2', '3'].includes(scopeParam)) {
      if (canAccessScope(scopeParam)) {
        setActiveScope(scopeParam);
        setAccessDenied(false);
      } else {
        const firstAllowed = allowedScopes[0].toString();
        setActiveScope(firstAllowed);
        setSearchParams({ scope: firstAllowed });
        toast.warning(`Access denied to Scope ${scopeParam}. Redirected to Scope ${firstAllowed}.`);
      }
    } else {
      const firstAllowed = allowedScopes[0].toString();
      setActiveScope(firstAllowed);
      setSearchParams({ scope: firstAllowed });
    }
  };

  const loadActivities = () => {
    if (!user || !canAccessScope(activeScope)) {
      setActivities([]);
      setLoading(false);
      return;
    }
  
    let allActivities = activityStructure[activeScope] || [];
    
    console.log(`[RBAC Debug] Loading activities for Scope ${activeScope}`);
    console.log(`[RBAC Debug] Total activities in scope: ${allActivities.length}`);
    console.log(`[RBAC Debug] User role: ${user.role}`);
    console.log(`[RBAC Debug] User restrictions:`, user.restrictions);
    
    // Fine-grained RBAC filtering for contributors
    if (user.role === 'contributor' && user.restrictions) {
      const { allowedScopes, allowedActivities } = user.restrictions;
      
      console.log(`[RBAC Debug] Allowed scopes:`, allowedScopes);
      console.log(`[RBAC Debug] Allowed activities:`, allowedActivities);
      
      // Check if user has full scope access
      const hasFullScopeAccess = allowedScopes && scopeAllowListIncludes(allowedScopes, activeScope);
      
      if (hasFullScopeAccess) {
        console.log(`[RBAC Debug] User has FULL access to Scope ${activeScope}`);
        // User has full scope access, show all activities
      } else if (allowedActivities && allowedActivities.length > 0) {
        // User has activity-specific access, filter activities
        console.log(`[RBAC Debug] Filtering to specific activities`);
        allActivities = allActivities.filter(activity => {
          const hasAccess = allowedActivities.includes(activity.name);
          console.log(`[RBAC Debug] Activity "${activity.name}": ${hasAccess ? 'ALLOWED' : 'DENIED'}`);
          return hasAccess;
        });
      } else {
        console.log(`[RBAC Debug] No access configured - showing NO activities`);
        // No access configured for this scope
        allActivities = [];
      }
    }
    
    console.log(`[RBAC Debug] Final filtered activities: ${allActivities.length}`);
    console.log(`[RBAC Debug] Activities:`, allActivities.map(a => a.name));
    
    setActivities(allActivities);
    setLoading(false);
  };
  
  const isActivityAccessible = (activityName) => {
    if (!user) return false;
    
    // Admin and analyst have full access
    if (['admin', 'analyst'].includes(user.role)) return true;
    
    // Contributors with restrictions
    if (user.role === 'contributor') {
      // If no restrictions, full access (legacy users)
      if (!user.restrictions) return true;
      
      const { allowedScopes, allowedActivities } = user.restrictions;
      
      // Check if has specific activity access
      if (allowedActivities && allowedActivities.length > 0) {
        return allowedActivities.includes(activityName);
      }
      
      // Check if has full scope access
      if (allowedScopes && scopeAllowListIncludes(allowedScopes, activeScope)) {
        return true;
      }
      
      return false;
    }
    
    // Viewers cannot add emissions
    return false;
  };

  const handleScopeChange = (scope, updateUrl = true) => {
    if (!canAccessScope(scope)) {
      toast.error(`Access denied. You don't have permission to access Scope ${scope}`);
      return;
    }

    setActiveScope(scope);
    if (updateUrl) {
      setSearchParams({ scope });
    }
    setExpandedActivities({});
    setSelectedActivity(null);

    logPageView(`Input - Scope ${scope}`, { 
      previousScope: activeScope,
      userRole: user?.role,
      scopeChanged: true
    });
  };

  const toggleActivityExpansion = (activityName) => {
    if (!isActivityAccessible(activityName)) {
      toast.error(`Access denied. You don't have permission to access ${activityName}`);
      return;
    }
  
    setExpandedActivities(prev => ({
      ...prev,
      [activityName]: !prev[activityName]
    }));
  };

  const handleActivitySelect = (activity) => {
    // Enhanced permission checks
    if (!canAccessScope(activeScope)) {
      toast.error(`Access denied. You don't have permission to access Scope ${activeScope}`);
      return;
    }
  
    if (!isActivityAccessible(activity.name)) {
      toast.error(`Access denied. You don't have permission to access ${activity.name}`);
      return;
    }
  
    if (user.role === 'viewer') {
      toast.error(`Access denied. Viewers cannot add emission data`);
      return;
    }
  
    setSelectedActivity({
      ...activity,
      scope: activeScope
    });
    setShowEmissionForm(true);
  
    logEmissionAction('activity_selected', null, 
      `Selected ${activity.name} in Scope ${activeScope}`, {
        scope: activeScope,
        activity: activity.name,
        activityType: activity.activityType
      });
  };

  // Task Widget Integration - Handle task clicks to navigate to relevant scope/activity
  const handleTaskClick = (task) => {
    if (!task) return;
    
    // Check if user can access the task's scope
    if (task.scope && canAccessScope(task.scope.toString())) {
      // Switch to the task's scope
      handleScopeChange(task.scope.toString());
      
      // If the task has a specific activity, expand it
      if (task.activity && isActivityAccessible(task.activity)) {
        // Wait for activities to load, then expand
        setTimeout(() => {
          setExpandedActivities(prev => ({
            ...prev,
            [task.activity]: true
          }));
          
          // Scroll to the activity
          const activityElement = document.getElementById(`activity-${task.activity}`);
          if (activityElement) {
            activityElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);
        
        toast.success(`Switched to Scope ${task.scope} for task: ${task.activity}`);
      } else {
        toast.info(`Viewing Scope ${task.scope} tasks`);
      }
    } else {
      toast.error(`You don't have access to Scope ${task.scope} for this task`);
    }
  };

  // Filter activities based on search query
  const filteredActivities = activities.filter(activity =>
    activity.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    activity.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const availableScopes = scopes.filter(scope => canAccessScope(scope.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-gray-200 dark:border-slate-600 border-t-emerald-600"></div>
        <span className="ml-3 text-lg text-gray-600 dark:text-gray-400">Loading...</span>
      </div>
    );
  }

  if (!user || !['admin', 'contributor'].includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900/50">
        <div className="max-w-md w-full bg-white/90 dark:bg-slate-900/70 backdrop-blur-xl transition-all duration-300 shadow-glass dark:shadow-glass-dark rounded-2xl border border-white/20 dark:border-slate-700/50 p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Shield className="w-8 h-8 text-red-600" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Access Restricted</h1>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mr-3" />
              <div className="text-left">
                <p className="text-sm font-medium text-yellow-800">
                  Input Page Access Denied
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  Your role ({user?.role || 'unknown'}) doesn't have permission to access the Input page.
                </p>
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            <p><strong>Input page is available to:</strong></p>
            <ul className="mt-2 space-y-1">
              <li>• Admin (full access)</li>
              <li>• Contributor (restricted based on permissions)</li>
            </ul>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (accessDenied || availableScopes.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900/50">
        <div className="max-w-md w-full bg-white/90 dark:bg-slate-900/70 backdrop-blur-xl transition-all duration-300 shadow-glass dark:shadow-glass-dark rounded-2xl border border-white/20 dark:border-slate-700/50 p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8 text-red-600" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Scope Access Restricted</h1>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <Shield className="w-5 h-5 text-yellow-600 mr-3" />
              <div className="text-left">
                <p className="text-sm font-medium text-yellow-800">
                  No Accessible Scopes
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  Your account doesn't have access to any emission scopes.
                </p>
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            <p>Contact your administrator to request access to emission scopes.</p>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={() => navigate('/settings')}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Settings
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader 
        title="Add Emission"
        breadcrumb={[
          { label: 'App', href: '/' },
          { label: 'Add Emission' }
        ]}
      />

      {/* Task Widget for Contributors - Show tasks to help them complete assigned work */}
      {user?.role === 'contributor' && (
        <TaskWidget 
          maxTasks={3}
          showQuickActions={true}
          onTaskClick={handleTaskClick}
          className="mb-6"
        />
      )}

      {activeScope === '3' && canAccessScope('3') && (
        <EmployeeCommuting />
      )}

      {user?.role === 'contributor' && user?.restrictions && (
        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <h3 className="font-medium text-blue-900 dark:text-blue-100">Your Access Permissions</h3>
          </div>
          <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            {user.restrictions.allowedScopes && user.restrictions.allowedScopes.length > 0 && (
              <p>• <strong>Full Scope Access:</strong> Scopes {user.restrictions.allowedScopes.join(', ')}</p>
            )}
            {user.restrictions.allowedActivities && user.restrictions.allowedActivities.length > 0 && (
              <p>• <strong>Specific Activities:</strong> {user.restrictions.allowedActivities.length} activities across scopes</p>
            )}
            {(!user.restrictions.allowedScopes || user.restrictions.allowedScopes.length === 0) && 
             (!user.restrictions.allowedActivities || user.restrictions.allowedActivities.length === 0) && (
              <p>• <strong>No restrictions</strong> - Full access to all activities</p>
            )}
          </div>
          <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
            ℹ️ You can only see and add emissions for activities you have permission to access
          </div>
        </div>
      )}

      <div className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-xl transition-all duration-300 shadow-glass dark:shadow-glass-dark rounded-2xl border border-white/20 dark:border-slate-700/50">
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <div className="flex space-x-1">
            {availableScopes.map((scope) => (
              <button
                key={scope.id}
                onClick={() => handleScopeChange(scope.id)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeScope === scope.id
                    ? 'bg-emerald-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100'
                }`}
              >
                {scope.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search Activities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800/80 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 border-b dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <Info className="w-4 h-4 text-emerald-600" />
            <span className="text-sm text-emerald-800 dark:text-emerald-300">
              {scopes.find(s => s.id === activeScope)?.description}
            </span>
          </div>
        </div>

        <div className="p-6">
          {filteredActivities.length > 0 ? (
            <div className="space-y-4">
              {filteredActivities.map((activity, index) => {
                const hasActivityAccess = isActivityAccessible(activity.name);
                
                return (
                  <div 
                    key={index} 
                    id={`activity-${activity.name}`}
                    className="border rounded-lg hover:shadow-md transition-shadow"
                  >
                    <button
                      onClick={() => hasActivityAccess ? toggleActivityExpansion(activity.name) : null}
                      disabled={!hasActivityAccess}
                      className="w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-gray-50 dark:bg-gray-900/50"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{activity.icon}</span>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h3 className="font-medium text-gray-900 dark:text-white">{activity.name}</h3>
                            <span className="text-xs bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded-full">
                              {activity.sources.length} sources
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{activity.description}</p>
                        </div>
                      </div>
                      {expandedActivities[activity.name] ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </button>

                    {expandedActivities[activity.name] && hasActivityAccess && (
                      <div className="border-t bg-gray-50 dark:bg-gray-900/50 p-4">
                        <EmissionForm
                          activity={activity}
                          scope={activeScope}
                          onClose={() => toggleActivityExpansion(activity.name)}
                          isInline={true}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-2">
                {activities.length === 0 ? 'No activities available for your access level' : 'No activities found'}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {activities.length === 0 ? 
                  'Contact your administrator to request access to additional activities.' :
                  'Try adjusting your search terms or select a different scope.'
                }
              </p>
              {user?.restrictions && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg inline-block">
                  <p className="text-sm text-blue-800 font-medium">Your Access Level:</p>
                  {user.restrictions.allowedScopes && user.restrictions.allowedScopes.length > 0 && (
                    <p className="text-xs text-blue-700">Full Scope Access: {user.restrictions.allowedScopes.join(', ')}</p>
                  )}
                  {user.restrictions.allowedActivities && user.restrictions.allowedActivities.length > 0 && (
                    <p className="text-xs text-blue-700">Specific Activities: {user.restrictions.allowedActivities.length} activities</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>


    </div>
  );
};

export default Input;