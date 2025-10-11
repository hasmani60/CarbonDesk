// frontend/src/components/EmissionForm/EmissionForm.jsx - Activity-Based Version
// UPDATED: Removed emission factor displays from UI while keeping calculations
import { useState, useEffect, useRef } from 'react';
import { X, Calendar, Lock, AlertCircle, Users, Truck, Gauge } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useActivity } from '../../context/ActivityContext';
import { saveEmission } from '../../utils/localStorage';
import { emissionFactors } from '../../data/complete_emission_factors_db';
import toast from 'react-hot-toast';

const EmissionForm = ({ activity, scope, onClose }) => {
  const { user } = useAuth();
  const { addEmissionNotification } = useNotifications();
  const { logEmissionAction, logActivity } = useActivity();
  
  const isSubmittingRef = useRef(false);
  const hasSubmittedRef = useRef(false);
  
  const [formData, setFormData] = useState({
    // Common fields
    source: '',
    startDate: '',
    endDate: '',
    location: '',
    description: '',
    
    // Activity-specific fields
    fuelQuantity: '',
    distance: '',
    passengers: '',
    weight: '',
    nights: '',
    hours: '',
    refrigerantAmount: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [emissionsPreview, setEmissionsPreview] = useState(null);
  const [availableSources, setAvailableSources] = useState([]);

  // Get available sources for the activity
  useEffect(() => {
    if (activity && scope) {
      const scopeKey = `scope${scope}`;
      const sources = Object.keys(emissionFactors[scopeKey][activity.name] || {});
      setAvailableSources(sources);
      
      if (sources.length > 0) {
        setFormData(prev => ({ ...prev, source: sources[0] }));
      }
    }
  }, [activity, scope]);

  // Update emissions preview when inputs change
  useEffect(() => {
    if (formData.source) {
      calculatePreview();
    }
  }, [formData]);

  useEffect(() => {
    return () => {
      isSubmittingRef.current = false;
      hasSubmittedRef.current = false;
    };
  }, []);

  const getEmissionFactor = (source) => {
    const scopeKey = `scope${scope}`;
    return emissionFactors[scopeKey]?.[activity.name]?.[source];
  };

  const calculatePreview = () => {
    const factorData = getEmissionFactor(formData.source);
    if (!factorData) return;

    let totalAmount = 0;

    switch (activity.activityType) {
      case 'fuel-based':
        totalAmount = parseFloat(formData.fuelQuantity) || 0;
        break;
        
      case 'distance':
        totalAmount = parseFloat(formData.distance) || 0;
        break;
        
      case 'passenger-distance':
        const passengers = parseFloat(formData.passengers) || 0;
        const distance = parseFloat(formData.distance) || 0;
        totalAmount = passengers * distance;
        break;
        
      case 'freight':
        const weight = parseFloat(formData.weight) || 0;
        const freightDistance = parseFloat(formData.distance) || 0;
        totalAmount = weight * freightDistance;
        break;
        
      case 'refrigerant':
        totalAmount = parseFloat(formData.refrigerantAmount) || 0;
        break;
        
      case 'accommodation':
        totalAmount = parseFloat(formData.nights) || 0;
        break;
        
      case 'homeworking':
        totalAmount = parseFloat(formData.hours) || 0;
        break;
        
      case 'quantity':
        totalAmount = parseFloat(formData.fuelQuantity) || 0;
        break;
    }

    if (totalAmount > 0) {
      const totalEmissions = totalAmount * factorData.factor;
      const co2 = totalAmount * (factorData.co2 || 0);
      const ch4 = totalAmount * (factorData.ch4 || 0);
      const n2o = totalAmount * (factorData.n2o || 0);

      setEmissionsPreview({
        total: totalEmissions,
        co2: co2,
        ch4: ch4,
        n2o: n2o,
        amount: totalAmount,
        unit: factorData.unit,
        factor: factorData.factor
      });
    } else {
      setEmissionsPreview(null);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.source) {
      newErrors.source = 'Please select a source type';
    }

    // Validate based on activity type
    switch (activity.activityType) {
      case 'fuel-based':
      case 'quantity':
        if (!formData.fuelQuantity || parseFloat(formData.fuelQuantity) <= 0) {
          newErrors.fuelQuantity = 'Please enter a valid quantity greater than 0';
        }
        break;
        
      case 'distance':
        if (!formData.distance || parseFloat(formData.distance) <= 0) {
          newErrors.distance = 'Please enter a valid distance greater than 0';
        }
        break;
        
      case 'passenger-distance':
        if (!formData.passengers || parseFloat(formData.passengers) <= 0) {
          newErrors.passengers = 'Please enter number of passengers';
        }
        if (!formData.distance || parseFloat(formData.distance) <= 0) {
          newErrors.distance = 'Please enter a valid distance';
        }
        break;
        
      case 'freight':
        if (!formData.weight || parseFloat(formData.weight) <= 0) {
          newErrors.weight = 'Please enter cargo weight';
        }
        if (!formData.distance || parseFloat(formData.distance) <= 0) {
          newErrors.distance = 'Please enter transport distance';
        }
        break;
        
      case 'refrigerant':
        if (!formData.refrigerantAmount || parseFloat(formData.refrigerantAmount) <= 0) {
          newErrors.refrigerantAmount = 'Please enter refrigerant amount';
        }
        break;
        
      case 'accommodation':
        if (!formData.nights || parseFloat(formData.nights) <= 0) {
          newErrors.nights = 'Please enter number of nights';
        }
        break;
        
      case 'homeworking':
        if (!formData.hours || parseFloat(formData.hours) <= 0) {
          newErrors.hours = 'Please enter number of hours';
        }
        break;
    }

    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required';
    }

    if (!formData.endDate) {
      newErrors.endDate = 'End date is required';
    }

    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      if (start > end) {
        newErrors.endDate = 'End date must be after start date';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isSubmittingRef.current || hasSubmittedRef.current) {
      console.warn('⚠️ BLOCKED: Form already submitting or submitted');
      return;
    }
    
    if (!validateForm()) {
      toast.error('Please fix the form errors before submitting');
      return;
    }
    
    try {
      isSubmittingRef.current = true;
      hasSubmittedRef.current = true;
      setLoading(true);
      
      const factorData = getEmissionFactor(formData.source);
      if (!factorData) {
        throw new Error('Emission factor not found for this source');
      }

      // Build activity data based on type
      const activityData = {};
      let calculatedAmount = 0;

      switch (activity.activityType) {
        case 'fuel-based':
        case 'quantity':
          activityData.quantity = parseFloat(formData.fuelQuantity);
          calculatedAmount = activityData.quantity;
          break;
          
        case 'distance':
          activityData.distance = parseFloat(formData.distance);
          calculatedAmount = activityData.distance;
          break;
          
        case 'passenger-distance':
          activityData.passengers = parseFloat(formData.passengers);
          activityData.distance = parseFloat(formData.distance);
          calculatedAmount = activityData.passengers * activityData.distance;
          break;
          
        case 'freight':
          activityData.weight = parseFloat(formData.weight);
          activityData.distance = parseFloat(formData.distance);
          calculatedAmount = activityData.weight * activityData.distance;
          break;
          
        case 'refrigerant':
          activityData.amount = parseFloat(formData.refrigerantAmount);
          calculatedAmount = activityData.amount;
          break;
          
        case 'accommodation':
          activityData.nights = parseFloat(formData.nights);
          calculatedAmount = activityData.nights;
          break;
          
        case 'homeworking':
          activityData.hours = parseFloat(formData.hours);
          calculatedAmount = activityData.hours;
          break;
      }

      const totalEmissions = calculatedAmount * factorData.factor;
      const co2 = calculatedAmount * (factorData.co2 || 0);
      const ch4 = calculatedAmount * (factorData.ch4 || 0);
      const n2o = calculatedAmount * (factorData.n2o || 0);
      
      const emissionData = {
        scope: parseInt(scope),
        category: activity.name,
        subcategory: formData.source,
        activity: formData.source,
        activityType: activity.name,
        source: formData.source,
        quantity: calculatedAmount,
        amount: calculatedAmount,
        unit: factorData.unit,
        startDate: formData.startDate,
        endDate: formData.endDate,
        date: formData.startDate,
        location: formData.location,
        description: formData.description,
        notes: formData.description,
        
        // Activity-specific data
        activityData: activityData,
        
        // Emission factor details (stored but not displayed)
        factor: factorData.factor,
        emissionFactor: {
          value: factorData.factor,
          unit: factorData.unit,
          description: factorData.description,
          co2: factorData.co2,
          ch4: factorData.ch4,
          n2o: factorData.n2o
        },
        
        // Calculated emissions
        co2e: totalEmissions,
        totalEmissions: totalEmissions,
        calculatedEmissions: totalEmissions,
        emissions_co2: co2,
        emissions_ch4: ch4,
        emissions_n2o: n2o,
        
        accountingPeriod: {
          start: new Date(formData.startDate),
          end: new Date(formData.endDate)
        },
        status: 'draft',
        user: user?.id,
        userName: user?.name || 'Unknown User',
        created_by: user?.id,
        created_by_name: user?.name || 'Unknown User'
      };
      
      const savedEmission = saveEmission(emissionData);
      
      try {
        await logEmissionAction('created', savedEmission.id, 
          `Created emission record: ${activity.name} - ${calculatedAmount} ${factorData.unit}`
        );
        
        await logActivity('emission_added', 'emission', savedEmission.id, 
          `Added emission: ${activity.name} (${formData.source}) - ${totalEmissions.toFixed(2)} CO₂e`
        );
      } catch (activityError) {
        console.warn('⚠️ Activity logging failed (non-critical):', activityError.message);
      }
      
      try {
        if (user && savedEmission) {
          addEmissionNotification(user, {
            ...savedEmission,
            category: activity.name,
            activityType: activity.name
          });
        }
      } catch (notificationError) {
        console.warn('⚠️ Notification creation failed (non-critical):', notificationError.message);
      }
      
      window.dispatchEvent(new CustomEvent('emission-added', { 
        detail: { 
          emission: savedEmission,
          user: user,
          timestamp: new Date().toISOString()
        }
      }));
      
      toast.success('Emission data saved successfully!', {
        duration: 3000,
        icon: '✅'
      });
      
      setTimeout(() => {
        onClose();
      }, 500);
      
    } catch (error) {
      console.error('❌ Emission submission error:', error);
      
      isSubmittingRef.current = false;
      hasSubmittedRef.current = false;
      
      if (error.message?.includes('DUPLICATE_EMISSION')) {
        toast.error(
          'This emission entry already exists. Please check your existing records or modify the data.',
          { duration: 5000 }
        );
      } else if (error.message?.includes('organisation_id')) {
        toast.error('Authentication error. Please log in again.');
      } else {
        toast.error(`Failed to save emission: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleClose = () => {
    if (isSubmittingRef.current) {
      toast.error('Please wait for the submission to complete');
      return;
    }
    onClose();
  };

  const factorData = getEmissionFactor(formData.source);

  // Render input fields based on activity type
  const renderActivityInputs = () => {
    switch (activity.activityType) {
      case 'fuel-based':
      case 'quantity':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantity*
            </label>
            <div className="flex space-x-2">
              <input
                type="number"
                name="fuelQuantity"
                value={formData.fuelQuantity}
                onChange={handleChange}
                required
                min="0.01"
                step="0.01"
                disabled={loading}
                className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 ${
                  errors.fuelQuantity ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter quantity"
              />
              <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg min-w-[80px] flex items-center justify-center">
                <span className="text-sm font-medium text-gray-700">
                  {factorData?.unit || 'unit'}
                </span>
              </div>
            </div>
            {errors.fuelQuantity && (
              <p className="text-red-500 text-xs mt-1 flex items-center">
                <AlertCircle className="w-3 h-3 mr-1" />
                {errors.fuelQuantity}
              </p>
            )}
          </div>
        );
        
      case 'distance':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Distance Travelled*
            </label>
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <Gauge className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="number"
                  name="distance"
                  value={formData.distance}
                  onChange={handleChange}
                  required
                  min="0.01"
                  step="0.01"
                  disabled={loading}
                  className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 ${
                    errors.distance ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter distance"
                />
              </div>
              <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg min-w-[60px] flex items-center justify-center">
                <span className="text-sm font-medium text-gray-700">km</span>
              </div>
            </div>
            {errors.distance && (
              <p className="text-red-500 text-xs mt-1 flex items-center">
                <AlertCircle className="w-3 h-3 mr-1" />
                {errors.distance}
              </p>
            )}
          </div>
        );
        
      case 'passenger-distance':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number of Passengers*
              </label>
              <div className="relative">
                <Users className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="number"
                  name="passengers"
                  value={formData.passengers}
                  onChange={handleChange}
                  required
                  min="1"
                  step="1"
                  disabled={loading}
                  className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 ${
                    errors.passengers ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="e.g., 2"
                />
              </div>
              {errors.passengers && (
                <p className="text-red-500 text-xs mt-1 flex items-center">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {errors.passengers}
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Distance Travelled*
              </label>
              <div className="flex space-x-2">
                <div className="relative flex-1">
                  <Gauge className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="number"
                    name="distance"
                    value={formData.distance}
                    onChange={handleChange}
                    required
                    min="0.01"
                    step="0.01"
                    disabled={loading}
                    className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 ${
                      errors.distance ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter distance"
                  />
                </div>
                <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg min-w-[60px] flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-700">km</span>
                </div>
              </div>
              {errors.distance && (
                <p className="text-red-500 text-xs mt-1 flex items-center">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {errors.distance}
                </p>
              )}
            </div>
            
            {formData.passengers && formData.distance && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Total:</strong> {parseFloat(formData.passengers) * parseFloat(formData.distance)} passenger.km
                </p>
              </div>
            )}
          </div>
        );
        
      case 'freight':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cargo Weight*
              </label>
              <div className="flex space-x-2">
                <div className="relative flex-1">
                  <Truck className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="number"
                    name="weight"
                    value={formData.weight}
                    onChange={handleChange}
                    required
                    min="0.01"
                    step="0.01"
                    disabled={loading}
                    className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 ${
                      errors.weight ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter weight"
                  />
                </div>
                <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg min-w-[80px] flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-700">tonnes</span>
                </div>
              </div>
              {errors.weight && (
                <p className="text-red-500 text-xs mt-1 flex items-center">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {errors.weight}
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Transport Distance*
              </label>
              <div className="flex space-x-2">
                <div className="relative flex-1">
                  <Gauge className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="number"
                    name="distance"
                    value={formData.distance}
                    onChange={handleChange}
                    required
                    min="0.01"
                    step="0.01"
                    disabled={loading}
                    className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 ${
                      errors.distance ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter distance"
                  />
                </div>
                <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg min-w-[60px] flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-700">km</span>
                </div>
              </div>
              {errors.distance && (
                <p className="text-red-500 text-xs mt-1 flex items-center">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {errors.distance}
                </p>
              )}
            </div>
            
            {formData.weight && formData.distance && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Total:</strong> {parseFloat(formData.weight) * parseFloat(formData.distance)} tonne.km
                </p>
              </div>
            )}
          </div>
        );
        
      case 'refrigerant':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Refrigerant Amount*
            </label>
            <div className="flex space-x-2">
              <input
                type="number"
                name="refrigerantAmount"
                value={formData.refrigerantAmount}
                onChange={handleChange}
                required
                min="0.01"
                step="0.01"
                disabled={loading}
                className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 ${
                  errors.refrigerantAmount ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter amount leaked/used"
              />
              <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg min-w-[60px] flex items-center justify-center">
                <span className="text-sm font-medium text-gray-700">kg</span>
              </div>
            </div>
            {errors.refrigerantAmount && (
              <p className="text-red-500 text-xs mt-1 flex items-center">
                <AlertCircle className="w-3 h-3 mr-1" />
                {errors.refrigerantAmount}
              </p>
            )}
          </div>
        );
        
      case 'accommodation':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Number of Nights*
            </label>
            <input
              type="number"
              name="nights"
              value={formData.nights}
              onChange={handleChange}
              required
              min="1"
              step="1"
              disabled={loading}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 ${
                errors.nights ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter number of nights"
            />
            {errors.nights && (
              <p className="text-red-500 text-xs mt-1 flex items-center">
                <AlertCircle className="w-3 h-3 mr-1" />
                {errors.nights}
              </p>
            )}
          </div>
        );
        
      case 'homeworking':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Working Hours*
            </label>
            <input
              type="number"
              name="hours"
              value={formData.hours}
              onChange={handleChange}
              required
              min="0.5"
              step="0.5"
              disabled={loading}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 ${
                errors.hours ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter number of hours"
            />
            {errors.hours && (
              <p className="text-red-500 text-xs mt-1 flex items-center">
                <AlertCircle className="w-3 h-3 mr-1" />
                {errors.hours}
              </p>
            )}
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Add Emission Data</h2>
            <p className="text-sm text-gray-600">
              Scope {scope} - {activity.name}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {activity.description}
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {/* Source Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source Type*
              </label>
              <select
                name="source"
                value={formData.source}
                onChange={handleChange}
                required
                disabled={loading}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 ${
                  errors.source ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Select source...</option>
                {availableSources.map((source, idx) => (
                  <option key={idx} value={source}>
                    {source}
                  </option>
                ))}
              </select>
              {errors.source && (
                <p className="text-red-500 text-xs mt-1">{errors.source}</p>
              )}
              {factorData && (
                <p className="text-xs text-gray-500 mt-1">
                  {factorData.description}
                </p>
              )}
            </div>

            {/* Activity-specific inputs */}
            {formData.source && renderActivityInputs()}

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
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
                    disabled={loading}
                    className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 ${
                      errors.startDate ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                </div>
                {errors.startDate && (
                  <p className="text-red-500 text-xs mt-1">{errors.startDate}</p>
                )}
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
                    disabled={loading}
                    className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 ${
                      errors.endDate ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                </div>
                {errors.endDate && (
                  <p className="text-red-500 text-xs mt-1">{errors.endDate}</p>
                )}
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                disabled={loading}
                placeholder="e.g., Building A, Floor 2, Factory Site"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                disabled={loading}
                placeholder="Additional details about this emission source..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Emission Preview - Simplified without showing calculation details */}
          {emissionsPreview && factorData && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-emerald-800">
                  Estimated Total Emissions:
                </span>
                <span className="text-lg font-bold text-emerald-900">
                  {emissionsPreview.total.toFixed(2)} kg CO₂e
                </span>
              </div>
              
              <div className="text-xs text-emerald-600 text-center">
                Based on your input: {emissionsPreview.amount} {emissionsPreview.unit}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.source}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {loading && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              )}
              <span>{loading ? 'Saving...' : 'Save Emission'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmissionForm;