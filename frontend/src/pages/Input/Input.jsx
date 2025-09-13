import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { emissionsAPI } from '../../services/api';
import PageHeader from '../../components/PageHeader/PageHeader';
import EmissionCategoryCard from '../../components/EmissionCategoryCard/EmissionCategoryCard';
import EmissionForm from '../../components/EmissionForm/EmissionForm';
import toast from 'react-hot-toast';

const Input = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeScope, setActiveScope] = useState(searchParams.get('scope') || '1');
  const [categories, setCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState({});
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showEmissionForm, setShowEmissionForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const scopes = [
    { id: '1', label: 'Scope 1', description: 'Direct emissions from owned sources' },
    { id: '2', label: 'Scope 2', description: 'Indirect emissions from purchased energy' },
    { id: '3', label: 'Scope 3', description: 'Indirect emissions from value chain' }
  ];

  // Sample emission categories based on screenshots
  const emissionCategories = {
    '1': [
      {
        name: 'Fuel Combustion',
        description: 'Direct emissions from fuel combustion in stationary sources',
        subcategories: ['Natural Gas', 'Diesel', 'Gasoline', 'Coal', 'Fuel Oil'],
        icon: '🔥'
      },
      {
        name: 'Mobile Combustion',
        description: 'Direct emissions from fuel combustion in mobile sources',
        subcategories: ['Company Vehicles', 'Fleet Operations', 'Off-road Equipment'],
        icon: '🚗'
      },
      {
        name: 'Process Emissions',
        description: 'Direct emissions from industrial processes',
        subcategories: ['Blast Furnace Operation', 'Chemical Processes', 'Manufacturing'],
        icon: '🏭'
      },
      {
        name: 'Fugitive Emissions',
        description: 'Unintentional releases of greenhouse gases',
        subcategories: ['Refrigerants', 'Natural Gas Leaks', 'Equipment Leaks'],
        icon: '💨'
      }
    ],
    '2': [
      {
        name: 'Purchased Electricity',
        description: 'Emissions from purchased electricity consumption',
        subcategories: ['Grid Electricity', 'Renewable Energy', 'Peak Load'],
        icon: '⚡'
      },
      {
        name: 'Purchased Heat/Steam',
        description: 'Emissions from purchased heating and cooling',
        subcategories: ['District Heating', 'Steam', 'Hot Water'],
        icon: '🔥'
      }
    ],
    '3': [
      {
        name: 'Business Travel',
        description: 'Emissions from employee business travel',
        subcategories: ['Air Travel', 'Hotel Stays', 'Rental Cars', 'Public Transport'],
        icon: '✈️'
      },
      {
        name: 'Employee Commuting',
        description: 'Emissions from employee commuting to work',
        subcategories: ['Personal Vehicles', 'Public Transport', 'Remote Work'],
        icon: '🚇'
      },
      {
        name: 'Waste Generated',
        description: 'Emissions from waste disposal and treatment',
        subcategories: ['Solid Waste', 'Wastewater', 'Recycling'],
        icon: '🗑️'
      },
      {
        name: 'Purchased Goods',
        description: 'Emissions from purchased goods and services',
        subcategories: ['Raw Materials', 'Office Supplies', 'IT Equipment'],
        icon: '📦'
      },
      {
        name: 'Upstream Transportation',
        description: 'Emissions from transportation and distribution',
        subcategories: ['Freight', 'Logistics', 'Warehousing'],
        icon: '🚛'
      }
    ]
  };

  useEffect(() => {
    const scope = searchParams.get('scope');
    if (scope && ['1', '2', '3'].includes(scope)) {
      setActiveScope(scope);
    }
    loadCategories();
  }, [searchParams]);

  const loadCategories = () => {
    setCategories(emissionCategories[activeScope] || []);
    setLoading(false);
  };

  const handleScopeChange = (scope) => {
    setActiveScope(scope);
    setSearchParams({ scope });
    setCategories(emissionCategories[scope] || []);
    setExpandedCategories({});
    setSelectedCategory(null);
  };

  const toggleCategoryExpansion = (categoryName) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }));
  };

  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    setShowEmissionForm(true);
  };

  const handleEmissionSubmit = async (emissionData) => {
    try {
      const payload = {
        ...emissionData,
        scope: activeScope,
        category: selectedCategory.name
      };
      
      await emissionsAPI.create(payload);
      toast.success('Emission data saved successfully!');
      setShowEmissionForm(false);
      setSelectedCategory(null);
    } catch (error) {
      toast.error('Failed to save emission data');
      console.error('Emission submission error:', error);
    }
  };

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    category.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg text-gray-600">Loading...</div>
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

      {/* Scope Tabs */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex space-x-1">
            {scopes.map((scope) => (
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

          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search Emission..."
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
              {filteredCategories.map((category, index) => (
                <div key={index} className="border rounded-lg">
                  <button
                    onClick={() => toggleCategoryExpansion(category.name)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{category.icon}</span>
                      <div>
                        <h3 className="font-medium text-gray-900">{category.name}</h3>
                        <p className="text-sm text-gray-500">{category.description}</p>
                      </div>
                    </div>
                    {expandedCategories[category.name] ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </button>

                  {expandedCategories[category.name] && (
                    <div className="border-t bg-gray-50 p-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                        {category.subcategories.map((subcategory, subIndex) => (
                          <button
                            key={subIndex}
                            onClick={() => handleCategorySelect({
                              ...category,
                              selectedSubcategory: subcategory
                            })}
                            className="p-3 bg-emerald-100 hover:bg-emerald-200 rounded-lg text-center transition-colors group"
                          >
                            <div className="flex items-center justify-center mb-2">
                              <Info className="w-4 h-4 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <span className="text-sm font-medium text-emerald-800">
                              {subcategory}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-2">No categories found</div>
              <p className="text-sm text-gray-500">
                Try adjusting your search terms or select a different scope.
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