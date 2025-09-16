// frontend/src/pages/Input/Input.jsx
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { emissionsAPI } from '../../services/api';
import { emissionFactors } from '../../data/emissionFactors';
import PageHeader from '../../components/PageHeader/PageHeader';
import EmissionForm from '../../components/EmissionForm/EmissionForm';
import InfoTooltip from '../../components/InfoTooltip/InfoTooltip';
import { saveEmission } from '../../utils/localStorage';
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
      },
      {
        name: 'Purchase of paper',
        description: 'GHG emissions embedded in the production and transportation of office paper products',
        subcategories: ['A4', 'Kraft', 'Prints'],
        icon: '📄'
      },
      {
        name: 'Purchase of packing material (plastic)',
        description: 'Emissions from procuring plastic packaging materials',
        subcategories: ['HDPE', 'LDPE', 'Shrink wrap'],
        icon: '📦'
      },
      {
        name: 'LPG Cylinders Purchase',
        description: 'Direct emissions from using LPG cylinders for cooking or maintenance work',
        subcategories: ['LPG'],
        icon: '🔥'
      },
      {
        name: 'Fuel for Forklift',
        description: 'Fuel used by forklifts in factory operations',
        subcategories: ['Diesel', 'Battery'],
        icon: '🏗️'
      },
      {
        name: 'Oil used for lubrication',
        description: 'Lubricants like engine or gear oil used during equipment operation',
        subcategories: ['Hydraulic', 'Engine Oil', 'Gear oil'],
        icon: '🛢️'
      },
      {
        name: 'Gas purchased for Maintenance',
        description: 'Industrial gases like nitrogen or acetylene used for maintenance',
        subcategories: ['Nitrogen', 'Oxygen', 'Acetylene'],
        icon: '⚙️'
      },
      {
        name: 'Cotton Waste for boiler starters',
        description: 'Cotton waste used for igniting boilers',
        subcategories: ['Cotton Waste'],
        icon: '🧸'
      },
      {
        name: 'Transport: Factory to warehouse',
        description: 'Emissions from in-house transportation of finished goods between company facilities',
        subcategories: ['Company Vehicle'],
        icon: '🚛'
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
      },
      {
        name: 'Transport of EPT sludge',
        description: 'Emissions from moving effluent treatment plant sludge to external treatment centers',
        subcategories: ['Truck'],
        icon: '🏭'
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

  const handleCategorySelect = (category, selectedType) => {
    setSelectedCategory({
      ...category,
      selectedType,
      scope: activeScope
    });
    setShowEmissionForm(true);
  };

  const handleEmissionSubmit = async (emissionData) => {
    try {
      // Save to local storage instead of API
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
        calculatedEmissions: emissionData.calculatedEmissions
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