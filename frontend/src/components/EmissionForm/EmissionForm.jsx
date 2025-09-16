// Updated EmissionForm.jsx with notification creation
import { useState } from 'react';
import { X, Calendar, Upload } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { emissionsAPI } from '../../services/api';
import { saveEmission } from '../../utils/localStorage';
import { getEmissionFactor, calculateEmissions } from '../../data/emissionFactors';
import toast from 'react-hot-toast';

const EmissionForm = ({ category, scope, onSubmit, onClose }) => {
  const { user } = useAuth();
  const { addEmissionNotification } = useNotifications();
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
  const [loading, setLoading] = useState(false);

  const units = ['kg', 'tons', 'litres', 'kWh', 'km', 'hours'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      // Get emission factor for calculation
      const factorData = getEmissionFactor(scope, category.name, formData.source);
      const calculatedEmissions = calculateEmissions(parseFloat(formData.amount), scope, category.name, formData.source);
      
      const emissionData = {
        ...formData,
        scope: parseInt(scope),
        category: category.name,
        subcategory: category.selectedSubcategory,
        activityType: formData.activityType || category.selectedSubcategory,
        amount: parseFloat(formData.amount),
        factor: factorData.factor,
        calculatedEmissions: calculatedEmissions,
        accountingPeriod: {
          start: new Date(formData.startDate),
          end: new Date(formData.endDate)
        },
        status: 'submitted',
        user: user?.id,
        userName: user?.name || 'Unknown User'
      };
      
      // Save to localStorage (in a real app, this would also save to database)
      const savedEmission = saveEmission(emissionData);
      
      // Create notification
      if (user && savedEmission) {
        addEmissionNotification(user, {
          ...savedEmission,
          category: category.name,
          activityType: formData.activityType || category.selectedSubcategory
        });
      }
      
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
  };

  // Get suggested sources based on category
  const getSuggestedSources = () => {
    const suggestions = {
      'Fuel Combustion': ['Diesel', 'Natural Gas', 'Gasoline', 'Coal', 'Fuel Oil'],
      'Fuel from Generator': ['Diesel', 'HSD', 'Biofuel'],
      'Mobile Combustion': ['Diesel', 'Petrol', 'Electric'],
      'Purchased Electricity': ['Grid Electricity', 'Renewable Energy', 'Non-Renewable'],
      'Business Travel': ['Air Travel', 'Rail', 'Taxi', 'Hotel'],
      'Employee Commuting': ['Personal Vehicles', 'Public Transport', 'Carpool'],
      'Waste Generated': ['Organic', 'Packaging', 'Plastic', 'Sludge']
    };
    
    return suggestions[category?.name] || [];
  };

  const suggestedSources = getSuggestedSources();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Add Emission Data</h2>
            <p className="text-sm text-gray-600">
              {category.name} - {category.selectedSubcategory} (Scope {scope})
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Activity Type*
              </label>
              <input
                type="text"
                name="activityType"
                value={formData.activityType}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g., Fuel Combustion, Electricity Purchase"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source*
              </label>
              {suggestedSources.length > 0 ? (
                <select
                  name="source"
                  value={formData.source}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select source</option>
                  {suggestedSources.map(source => (
                    <option key={source} value={source}>{source}</option>
                  ))}
                  <option value="other">Other (specify in description)</option>
                </select>
              ) : (
                <input
                  type="text"
                  name="source"
                  value={formData.source}
                  onChange={handleChange}
                  required
                  placeholder="e.g., Diesel, Electricity, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
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
                {units.map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
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
          {formData.amount && formData.source && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-emerald-800">
                  Estimated Emissions:
                </span>
                <span className="text-lg font-bold text-emerald-900">
                  {calculateEmissions(parseFloat(formData.amount), scope, category.name, formData.source).toFixed(2)} CO₂e
                </span>
              </div>
              <p className="text-xs text-emerald-600 mt-1">
                Based on standard emission factors. Final calculation may vary.
              </p>
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