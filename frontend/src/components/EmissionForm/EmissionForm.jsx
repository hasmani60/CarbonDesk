// Updated EmissionForm.jsx with dynamic activity types and real-time monitor updates
import { useState, useEffect } from 'react';
import { X, Calendar, Upload } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useActivity } from '../../context/ActivityContext';
import { emissionsAPI } from '../../services/api';
import { saveEmission } from '../../utils/localStorage';
import { emissionFactors, getEmissionFactor, calculateEmissions } from '../../data/emissionFactors';
import toast from 'react-hot-toast';

const EmissionForm = ({ category, scope, onSubmit, onClose }) => {
  const { user } = useAuth();
  const { addEmissionNotification } = useNotifications();
  const { logEmissionAction, logActivity } = useActivity();
  const [formData, setFormData] = useState({
    activityType: category?.selectedSubcategory || '',
    source: '',
    amount: '',
    unit: 'kg',
    startDate: '',
    endDate: '',
    location: '',
    description: ''
  });
  const [availableActivityTypes, setAvailableActivityTypes] = useState([]);
  const [availableSources, setAvailableSources] = useState([]);
  const [loading, setLoading] = useState(false);

  const units = ['kg', 'tons', 'litres', 'kWh', 'km', 'hours'];

  // Load activity types based on scope when component mounts
  useEffect(() => {
    loadActivityTypes();
  }, [scope]);

  // Load sources when activity type changes
  useEffect(() => {
    if (formData.activityType) {
      loadSourcesForActivity();
    }
  }, [formData.activityType, scope]);

  const loadActivityTypes = () => {
    try {
      const scopeKey = `scope${scope}`;
      const scopeData = emissionFactors[scopeKey];
      
      if (scopeData) {
        const activityTypes = Object.keys(scopeData);
        setAvailableActivityTypes(activityTypes);
        
        // Set default activity type if category is provided
        if (category?.selectedSubcategory && activityTypes.includes(category.selectedSubcategory)) {
          setFormData(prev => ({ ...prev, activityType: category.selectedSubcategory }));
        } else if (activityTypes.length > 0) {
          setFormData(prev => ({ ...prev, activityType: activityTypes[0] }));
        }
      }
    } catch (error) {
      console.error('Error loading activity types:', error);
    }
  };

  const loadSourcesForActivity = () => {
    try {
      const scopeKey = `scope${scope}`;
      const activityData = emissionFactors[scopeKey]?.[formData.activityType];
      
      if (activityData) {
        const sources = Object.keys(activityData);
        setAvailableSources(sources);
        
        // Set first source as default if available
        if (sources.length > 0) {
          setFormData(prev => ({ 
            ...prev, 
            source: sources[0],
            unit: activityData[sources[0]].unit || 'kg'
          }));
        }
      }
    } catch (error) {
      console.error('Error loading sources:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.activityType || !formData.source || !formData.amount || !formData.startDate || !formData.endDate) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    try {
      setLoading(true);
      
      // Get emission factor for calculation
      const factorData = getEmissionFactor(scope, formData.activityType, formData.source);
      const calculatedEmissions = calculateEmissions(parseFloat(formData.amount), scope, formData.activityType, formData.source);
      
      const emissionData = {
        ...formData,
        scope: parseInt(scope),
        category: formData.activityType, // Use activityType as category
        subcategory: formData.source,
        amount: parseFloat(formData.amount),
        factor: factorData.factor,
        calculatedEmissions: calculatedEmissions,
        totalEmissions: calculatedEmissions, // Add totalEmissions field for consistency
        accountingPeriod: {
          start: new Date(formData.startDate),
          end: new Date(formData.endDate)
        },
        status: 'active', // Changed from 'submitted' to 'active'
        user: user?.id,
        userName: user?.name || 'Unknown User'
      };
      
      // Save to localStorage
      const savedEmission = saveEmission(emissionData);
      
      // Log activity for admin panel
      await logEmissionAction('created', savedEmission.id, `Created emission record: ${formData.activityType} - ${formData.amount} ${formData.unit}`);
      
      // Log detailed activity for monitor page
      await logActivity('emission_added', 'emission', savedEmission.id, `Added emission: ${formData.activityType} (${formData.source}) - ${calculatedEmissions.toFixed(2)} CO₂e`);
      
      // Create notification
      if (user && savedEmission) {
        addEmissionNotification(user, {
          ...savedEmission,
          category: formData.activityType,
          activityType: formData.activityType
        });
      }
      
      // Trigger monitor page update by dispatching custom event
      window.dispatchEvent(new CustomEvent('emission-added', { 
        detail: { 
          emission: savedEmission,
          user: user,
          timestamp: new Date().toISOString()
        }
      }));
      
      // Call parent onSubmit if provided
      if (onSubmit) {
        await onSubmit(emissionData);
      }
      
      toast.success('Emission data saved successfully!');
      onClose();
      
    } catch (error) {
      console.error('Emission submission error:', error);
      toast.error('Failed to save emission data');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Update unit when source changes
    if (name === 'source') {
      const scopeKey = `scope${scope}`;
      const sourceData = emissionFactors[scopeKey]?.[formData.activityType]?.[value];
      if (sourceData) {
        setFormData(prev => ({ ...prev, unit: sourceData.unit }));
      }
    }
  };

  const handleActivityTypeChange = (e) => {
    const newActivityType = e.target.value;
    setFormData(prev => ({ 
      ...prev, 
      activityType: newActivityType,
      source: '', // Reset source when activity type changes
      unit: 'kg' // Reset unit
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Add Emission Data</h2>
            <p className="text-sm text-gray-600">
              Scope {scope} - {formData.activityType || 'Select Activity Type'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Activity Type Dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Activity Type*
              </label>
              <select
                name="activityType"
                value={formData.activityType}
                onChange={handleActivityTypeChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Select Activity Type</option>
                {availableActivityTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* Source Dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source*
              </label>
              <select
                name="source"
                value={formData.source}
                onChange={handleChange}
                required
                disabled={!formData.activityType}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100"
              >
                <option value="">Select Source</option>
                {availableSources.map(source => (
                  <option key={source} value={source}>{source}</option>
                ))}
              </select>
              {formData.activityType && formData.source && (
                <p className="text-xs text-gray-500 mt-1">
                  {emissionFactors[`scope${scope}`]?.[formData.activityType]?.[formData.source]?.description}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount*
              </label>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                required
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Enter quantity"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unit*
              </label>
              <select
                name="unit"
                value={formData.unit}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value={formData.unit}>{formData.unit}</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Unit is automatically set based on source selection
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date*
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date*
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="e.g., Building A, Floor 2, Factory Site"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                placeholder="Additional details about this emission source..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Emission Preview */}
          {formData.amount && formData.source && formData.activityType && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-emerald-800">
                  Estimated Emissions:
                </span>
                <span className="text-lg font-bold text-emerald-900">
                  {calculateEmissions(parseFloat(formData.amount), scope, formData.activityType, formData.source).toFixed(2)} CO₂e
                </span>
              </div>
              <div className="text-xs text-emerald-600 mt-1">
                <p>Emission Factor: {getEmissionFactor(scope, formData.activityType, formData.source).factor}</p>
                <p>Based on: {getEmissionFactor(scope, formData.activityType, formData.source).description}</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-700"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Supporting Files</span>
            </button>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center space-x-2"
              >
                {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                <span>{loading ? 'Saving...' : 'Save Emission'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmissionForm;