// pages/Input/Input.jsx - Fine-Grained RBAC Implementation
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
import { saveEmission } from '../../utils/localStorage';
import toast from 'react-hot-toast';

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
      'distance': `Select vehicle type and enter distance travelled`,
      'passenger-distance': `Enter number of passengers and distance travelled`,
      'freight': `Enter cargo weight and distance transported`,
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
      const hasFullScopeAccess = allowedScopes && allowedScopes.includes(parseInt(activeScope));
      
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
      if (allowedScopes && allowedScopes.includes(parseInt(activeScope))) {
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

  const handleEmissionSubmit = async (emissionData) => {
    try {
      if (!canAccessScope(activeScope) || !canAccessActivity(selectedActivity.name)) {
        toast.error('Access denied. Insufficient permissions to create this emission record.');
        return;
      }

      const emissionRecord = {
        id: `emission_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        scope: parseInt(activeScope),
        category: selectedActivity.name,
        type: emissionData.source || emissionData.selectedType,
        amount: parseFloat(emissionData.amount),
        unit: emissionData.unit,
        startDate: emissionData.startDate,
        endDate: emissionData.endDate,
        location: emissionData.location,
        description: emissionData.description,
        factor: emissionData.emissionFactor,
        calculatedEmissions: emissionData.calculatedEmissions,
        user: user.id,
        userName: user.name,
        createdAt: new Date().toISOString(),
        status: 'submitted',
        activityType: selectedActivity.activityType,
        activityData: emissionData.activityData
      };
      
      await saveEmission(emissionRecord);
      
      logEmissionAction('created', emissionRecord.id, 
        `Created emission record: ${selectedActivity.name}`, {
          scope: activeScope,
          activity: selectedActivity.name,
          activityType: selectedActivity.activityType,
          amount: emissionData.amount,
          unit: emissionData.unit,
          calculatedEmissions: emissionData.calculatedEmissions
        });

      toast.success('Emission data saved successfully!');
      setShowEmissionForm(false);
      setSelectedActivity(null);
      
      window.dispatchEvent(new CustomEvent('emissionSaved', { detail: emissionRecord }));
    } catch (error) {
      toast.error('Failed to save emission data');
      console.error('Emission submission error:', error);
      
      logEmissionAction('creation_failed', null, 
        `Failed to create emission record: ${error.message}`, {
          scope: activeScope,
          activity: selectedActivity?.name,
          error: error.message
        });
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        <span className="ml-3 text-lg text-gray-600">Loading...</span>
      </div>
    );
  }

  if (!user || !['admin', 'contributor'].includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Shield className="w-8 h-8 text-red-600" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Restricted</h1>
          
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

          <div className="text-sm text-gray-600 mb-6">
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8 text-red-600" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Scope Access Restricted</h1>
          
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

          <div className="text-sm text-gray-600 mb-6">
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
    <div className="space-y-6">
      <PageHeader 
        title="Add Emission"
        breadcrumb={[
          { label: 'App', href: '/' },
          { label: 'Add Emission' }
        ]}
      />

      {user?.role === 'contributor' && user?.restrictions && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <h3 className="font-medium text-blue-900">Your Access Permissions</h3>
          </div>
          <div className="text-sm text-blue-800 space-y-1">
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
          <div className="mt-2 text-xs text-blue-600">
            ℹ️ You can only see and add emissions for activities you have permission to access
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex space-x-1">
            {availableScopes.map((scope) => (
              <button
                key={scope.id}
                onClick={() => handleScopeChange(scope.id)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeScope === scope.id
                    ? 'bg-emerald-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
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
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="p-4 bg-emerald-50 border-b">
          <div className="flex items-center space-x-2">
            <Info className="w-4 h-4 text-emerald-600" />
            <span className="text-sm text-emerald-800">
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
                  <div key={index} className="border rounded-lg hover:shadow-md transition-shadow">
                    <button
                      onClick={() => hasActivityAccess ? toggleActivityExpansion(activity.name) : null}
                      disabled={!hasActivityAccess}
                      className="w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-gray-50"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{activity.icon}</span>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h3 className="font-medium text-gray-900">{activity.name}</h3>
                            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                              {activity.sources.length} sources
                            </span>
                          </div>
                          <p className="text-sm text-gray-500">{activity.description}</p>
                        </div>
                      </div>
                      {expandedActivities[activity.name] ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </button>

                    {expandedActivities[activity.name] && hasActivityAccess && (
                      <div className="border-t bg-gray-50 p-4">
                        <button
                          onClick={() => handleActivitySelect(activity)}
                          className="w-full p-4 bg-emerald-50 border-2 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400 rounded-lg text-left transition-all group"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-base font-medium text-emerald-900">
                                Add {activity.name} Data
                              </span>
                              <p className="text-sm text-emerald-700 mt-1">
                                Click to open the emission form
                              </p>
                            </div>
                            <div className="text-emerald-600 group-hover:translate-x-1 transition-transform">
                              →
                            </div>
                          </div>
                        </button>
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
              <p className="text-sm text-gray-500">
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

      {showEmissionForm && selectedActivity && (
        <EmissionForm
          activity={selectedActivity}
          scope={activeScope}
          onSubmit={handleEmissionSubmit}
          onClose={() => {
            setShowEmissionForm(false);
            setSelectedActivity(null);
          }}
        />
      )}
    </div>
  );
};

export default Input;