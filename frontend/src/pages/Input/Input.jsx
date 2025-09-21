// pages/Input/Input.jsx - Enhanced with RBAC Support
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, ChevronDown, ChevronUp, Info, Lock, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { emissionsAPI } from '../../services/api';
import { emissionFactors } from '../../data/emissionFactors';
import PageHeader from '../../components/PageHeader/PageHeader';
import EmissionForm from '../../components/EmissionForm/EmissionForm';
import InfoTooltip from '../../components/InfoTooltip/InfoTooltip';
import { saveEmission } from '../../utils/localStorage';
import toast from 'react-hot-toast';

const Input = () => {
  const { user, canAccessScope, canAccessActivity, getAllowedScopes, getAllowedActivities } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeScope, setActiveScope] = useState(searchParams.get('scope') || '1');
  const [categories, setCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState({});
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showEmissionForm, setShowEmissionForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const scopes = [
    { id: '1', label: 'Scope 1', description: 'Direct emissions from owned or controlled sources' },
    { id: '2', label: 'Scope 2', description: 'Indirect emissions from purchased energy' },
    { id: '3', label: 'Scope 3', description: 'All other indirect emissions from value chain activities' }
  ];

  // Updated emission categories based on the PDF
  const emissionCategories = {
    '1': [
      {
        name: 'Fuel from Generator',
        description: 'Emissions from the combustion of diesel, HSD, or biofuels in company-operated generators',
        subcategories: ['Diesel', 'HSD', 'Biofuel'],
        icon: '⚡'
      },
      {
        name: 'Wood Burnt for Boilers',
        description: 'GHG emissions from burning biomass like firewood or coconut husk in industrial boilers',
        subcategories: ['Firewood', 'Coconut Husk'],
        icon: '🔥'
      },
      {
        name: 'Fuel Used by Company vehicles',
        description: 'Emissions from company-owned vehicles using petrol, diesel, or electricity',
        subcategories: ['Diesel', 'Petrol', 'Electric'],
        icon: '🚗'
      },
      {
        name: 'Refrigerant Purchased',
        description: 'Potential GHG emissions from refrigerant gases like R22 or R134a',
        subcategories: ['R22', 'R134a', 'R410A'],
        icon: '❄️'
      },
      {
        name: 'Water Used',
        description: 'Energy-associated emissions from water extraction, treatment, and use',
        subcategories: ['Borewell', 'Municipality', 'Tanker'],
        icon: '💧'
      },
      {
        name: 'Water Recycled',
        description: 'Efforts to reduce water-related emissions by reusing treated or collected water',
        subcategories: ['ETP', 'RO plant', 'Rainwater'],
        icon: '♻️'
      },
      {
        name: 'Waste Generation',
        description: 'Waste from operations like processing units or canteens',
        subcategories: ['Organic', 'Packaging', 'Plastic', 'Sludge'],
        icon: '🗑️'
      },
      {
        name: 'Fuel used in mess',
        description: 'Emissions from cooking fuel used in the employee mess/canteen',
        subcategories: ['LPG', 'Firewood', 'Kerosene'],
        icon: '🍽️'
      },
      {
        name: 'Steam Production',
        description: 'Steam generation typically uses fuel combustion in boilers',
        subcategories: ['Steam'],
        icon: '💨'
      },
      {
        name: 'AC service data',
        description: 'Emissions from recharging refrigerants in air conditioners',
        subcategories: ['R134a', 'R410a'],
        icon: '🌨️'
      }
    ],
    '2': [
      {
        name: 'Electricity Purchased',
        description: 'Indirect emissions from the consumption of grid electricity',
        subcategories: ['Grid Electricity', 'Renewable Energy', 'Non-Renewable'],
        icon: '⚡'
      }
    ],
    '3': [
      {
        name: 'Transport: Harbor to plant',
        description: 'Emissions from third-party transport of raw materials from ports to the factory',
        subcategories: ['Truck', 'Rail'],
        icon: '🚢'
      },
      {
        name: 'Export of Material',
        description: 'Logistics-related emissions from exporting products via ship, air, or road',
        subcategories: ['Ship', 'Air', 'Truck'],
        icon: '📤'
      },
      {
        name: 'Domestic Sales Transport',
        description: 'GHG emissions from transporting products to domestic buyers',
        subcategories: ['Truck', 'Train'],
        icon: '🚚'
      },
      {
        name: 'Employee transport',
        description: 'Emissions from commuting, based on vehicle type, distance, and employee attendance',
        subcategories: ['Bus', 'Carpool', 'Van'],
        icon: '🚌'
      },
      {
        name: 'Business travel',
        description: 'Travel-related emissions from flights, trains, or taxis used by employees for work purposes',
        subcategories: ['Air', 'Rail', 'Taxi'],
        icon: '✈️'
      }
    ]
  };

  useEffect(() => {
    const scope = searchParams.get('scope');
    if (scope && ['1', '2', '3'].includes(scope)) {
      // Check if user can access this scope
      if (canAccessScope(scope)) {
        setActiveScope(scope);
        setAccessDenied(false);
      } else {
        setAccessDenied(true);
        // Redirect to first allowed scope
        const allowedScopes = getAllowedScopes();
        if (allowedScopes.length > 0) {
          setActiveScope(allowedScopes[0].toString());
          setSearchParams({ scope: allowedScopes[0].toString() });
        }
      }
    }
    loadCategories();
  }, [searchParams, canAccessScope, getAllowedScopes]);

  const loadCategories = () => {
    if (!canAccessScope(activeScope)) {
      setCategories([]);
      setLoading(false);
      return;
    }

    let allCategories = emissionCategories[activeScope] || [];
    
    // Filter categories based on user's allowed activities (for contributors with restrictions)
    const allowedActivities = getAllowedActivities();
    if (user?.role === 'contributor' && allowedActivities.length > 0) {
      allCategories = allCategories.filter(category => 
        allowedActivities.includes(category.name)
      );
    }
    
    setCategories(allCategories);
    setLoading(false);
  };

  const handleScopeChange = (scope) => {
    // Check if user can access this scope
    if (!canAccessScope(scope)) {
      toast.error(`Access denied. You don't have permission to access Scope ${scope}`);
      return;
    }

    setActiveScope(scope);
    setSearchParams({ scope });
    setExpandedCategories({});
    setSelectedCategory(null);
    loadCategories();
  };

  const toggleCategoryExpansion = (categoryName) => {
    // Check if user can access this activity
    if (!canAccessActivity(categoryName)) {
      toast.error(`Access denied. You don't have permission to access ${categoryName}`);
      return;
    }

    setExpandedCategories(prev => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }));
  };

  const handleCategorySelect = (category, selectedType) => {
    // Double-check permissions
    if (!canAccessScope(activeScope)) {
      toast.error(`Access denied. You don't have permission to access Scope ${activeScope}`);
      return;
    }

    if (!canAccessActivity(category.name)) {
      toast.error(`Access denied. You don't have permission to access ${category.name}`);
      return;
    }

    setSelectedCategory({
      ...category,
      selectedType,
      scope: activeScope
    });
    setShowEmissionForm(true);
  };

  const handleEmissionSubmit = async (emissionData) => {
    try {
      // Final permission check before submission
      if (!canAccessScope(activeScope) || !canAccessActivity(selectedCategory.name)) {
        toast.error('Access denied. Insufficient permissions to create this emission record.');
        return;
      }

      // Save to local storage
      const emissionRecord = {
        scope: parseInt(activeScope),
        category: selectedCategory.name,
        type: selectedCategory.selectedType,
        amount: parseFloat(emissionData.amount),
        unit: emissionData.unit,
        startDate: emissionData.startDate,
        endDate: emissionData.endDate,
        location: emissionData.location,
        description: emissionData.description,
        factor: emissionData.emissionFactor,
        calculatedEmissions: emissionData.calculatedEmissions,
        user: user.id,
        userName: user.name
      };
      
      await saveEmission(emissionRecord);
      toast.success('Emission data saved successfully!');
      setShowEmissionForm(false);
      setSelectedCategory(null);
      
      // Trigger custom event for dashboard updates
      window.dispatchEvent(new CustomEvent('emissionSaved', { detail: emissionRecord }));
    } catch (error) {
      toast.error('Failed to save emission data');
      console.error('Emission submission error:', error);
    }
  };

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    category.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get available scopes for user
  const availableScopes = scopes.filter(scope => canAccessScope(scope.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  // Access denied for this scope
  if (accessDenied || !canAccessScope(activeScope)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8 text-red-600" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Restricted</h1>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <Shield className="w-5 h-5 text-yellow-600 mr-3" />
              <div className="text-left">
                <p className="text-sm font-medium text-yellow-800">
                  Scope {activeScope} Access Denied
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  Your role ({user?.role}) doesn't have permission to access this scope.
                </p>
              </div>
            </div>
          </div>

          {availableScopes.length > 0 && (
            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-3">Available scopes for your role:</p>
              <div className="space-y-2">
                {availableScopes.map(scope => (
                  <button
                    key={scope.id}
                    onClick={() => handleScopeChange(scope.id)}
                    className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="font-medium text-gray-900">{scope.label}</div>
                    <div className="text-sm text-gray-500">{scope.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex space-x-3">
            <button
              onClick={() => window.history.back()}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Go Back
            </button>
            <button
              onClick={() => window.location.href = '/dashboard'}
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
      {/* Page Header */}
      <PageHeader 
        title="Add Emission"
        breadcrumb={[
          { label: 'App', href: '/' },
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Add Emission' }
        ]}
      />

      {/* RBAC Info for Restricted Users */}
      {user?.role === 'contributor' && user?.restrictions && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <h3 className="font-medium text-blue-900">Access Restrictions Applied</h3>
          </div>
          <div className="text-sm text-blue-800 space-y-1">
            {user.restrictions.allowedScopes && user.restrictions.allowedScopes.length < 3 && (
              <p>• Limited to Scopes: {user.restrictions.allowedScopes.join(', ')}</p>
            )}
            {user.restrictions.allowedActivities && user.restrictions.allowedActivities.length > 0 && (
              <p>• Limited to {user.restrictions.allowedActivities.length} specific activities</p>
            )}
          </div>
        </div>
      )}

      {/* Scope Tabs */}
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
                {!canAccessScope(scope.id) && (
                  <Lock className="w-3 h-3 ml-1 inline" />
                )}
              </button>
            ))}
          </div>

          {/* Search */}
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

        {/* Scope Description */}
        <div className="p-4 bg-emerald-50 border-b">
          <div className="flex items-center space-x-2">
            <Info className="w-4 h-4 text-emerald-600" />
            <span className="text-sm text-emerald-800">
              {scopes.find(s => s.id === activeScope)?.description}
            </span>
          </div>
        </div>

        {/* Categories */}
        <div className="p-6">
          {filteredCategories.length > 0 ? (
            <div className="space-y-4">
              {filteredCategories.map((category, index) => {
                const hasActivityAccess = canAccessActivity(category.name);
                
                return (
                  <div key={index} className={`border rounded-lg ${!hasActivityAccess ? 'opacity-50' : ''}`}>
                    <button
                      onClick={() => hasActivityAccess ? toggleCategoryExpansion(category.name) : null}
                      disabled={!hasActivityAccess}
                      className={`w-full flex items-center justify-between p-4 text-left transition-colors ${
                        hasActivityAccess ? 'hover:bg-gray-50' : 'cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{category.icon}</span>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h3 className="font-medium text-gray-900">{category.name}</h3>
                            {!hasActivityAccess && (
                              <Lock className="w-4 h-4 text-red-500" title="Access Restricted" />
                            )}
                          </div>
                          <p className="text-sm text-gray-500">{category.description}</p>
                        </div>
                      </div>
                      {hasActivityAccess && (
                        expandedCategories[category.name] ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )
                      )}
                    </button>

                    {expandedCategories[category.name] && hasActivityAccess && (
                      <div className="border-t bg-gray-50 p-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                          {category.subcategories.map((subcategory, subIndex) => {
                            const factorData = emissionFactors[`scope${activeScope}`]?.[category.name]?.[subcategory];
                            
                            return (
                              <button
                                key={subIndex}
                                onClick={() => handleCategorySelect(category, subcategory)}
                                className="p-3 bg-emerald-100 hover:bg-emerald-200 rounded-lg text-center transition-colors group relative"
                              >
                                <div className="flex items-center justify-center mb-2">
                                  <InfoTooltip 
                                    content={factorData?.description || `${subcategory} emission source`}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  />
                                </div>
                                <span className="text-sm font-medium text-emerald-800">
                                  {subcategory}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-2">
                {categories.length === 0 ? 'No activities available for your access level' : 'No categories found'}
              </div>
              <p className="text-sm text-gray-500">
                {categories.length === 0 ? 
                  'Contact your administrator to request access to additional activities.' :
                  'Try adjusting your search terms or select a different scope.'
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Emission Form Modal */}
      {showEmissionForm && selectedCategory && (
        <EmissionForm
          category={selectedCategory}
          scope={activeScope}
          onSubmit={handleEmissionSubmit}
          onClose={() => {
            setShowEmissionForm(false);
            setSelectedCategory(null);
          }}
        />
      )}
    </div>
  );
};

export default Input;