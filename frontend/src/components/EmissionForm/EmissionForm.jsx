// frontend/src/components/EmissionForm/EmissionForm.jsx - MongoDB Compliant Version
// UPDATED: Uses API calls instead of localStorage
import { useState, useEffect, useRef } from 'react';
import { X, Calendar, Lock, AlertCircle, Users, Truck, Gauge } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useActivity } from '../../context/ActivityContext';
import { emissionsAPI } from '../../services/api';
import { emissionFactors } from '../../data/complete_emission_factors_db';
import toast from 'react-hot-toast';
import { isFreightActivity, TRANSPORT_CATEGORY_OPTIONS } from '../../utils/transportCategory';
import { supportsFlightRoute } from '../../utils/flightActivity';
import { supportsSeaRoute } from '../../utils/seaActivity';
import FlightRoutePicker from '../FlightRoutePicker/FlightRoutePicker';
import SeaRoutePicker from '../SeaRoutePicker/SeaRoutePicker';

const EmissionForm = ({ activity, scope, onClose, isInline = false }) => {
  const { user } = useAuth();
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
    refrigerantAmount: '',
    transport_category: 'raw_material'
  });

  const useFlightRoute = supportsFlightRoute(activity);
  const useSeaRoute = supportsSeaRoute(activity);
  const [originAirport, setOriginAirport] = useState(null);
  const [destinationAirport, setDestinationAirport] = useState(null);
  const [flightRoundTrip, setFlightRoundTrip] = useState(false);
  const [flightRouteMeta, setFlightRouteMeta] = useState(null);
  const [originPort, setOriginPort] = useState(null);
  const [destinationPort, setDestinationPort] = useState(null);
  const [seaRoundTrip, setSeaRoundTrip] = useState(false);
  const [seaRouteMeta, setSeaRouteMeta] = useState(null);
  
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

      if (useFlightRoute && flightRouteMeta) {
        activityData.flight_route = {
          origin_iata: flightRouteMeta.origin.iata,
          origin_name: flightRouteMeta.origin.name,
          destination_iata: flightRouteMeta.destination.iata,
          destination_name: flightRouteMeta.destination.name,
          great_circle_km: flightRouteMeta.great_circle_km,
          flight_distance_km: flightRouteMeta.flight_distance_km,
          distance_km: flightRouteMeta.distance_km,
          round_trip: flightRouteMeta.round_trip,
          routing_factor: flightRouteMeta.routing_factor,
          method: flightRouteMeta.method
        };
      }

      if (useSeaRoute && seaRouteMeta) {
        activityData.sea_route = {
          origin_code: seaRouteMeta.origin.code,
          origin_name: seaRouteMeta.origin.name,
          destination_code: seaRouteMeta.destination.code,
          destination_name: seaRouteMeta.destination.name,
          great_circle_km: seaRouteMeta.great_circle_km,
          sea_distance_km: seaRouteMeta.sea_distance_km,
          distance_km: seaRouteMeta.distance_km,
          round_trip: seaRouteMeta.round_trip,
          routing_factor: seaRouteMeta.routing_factor,
          method: seaRouteMeta.method
        };
      }

      const totalEmissions = calculatedAmount * factorData.factor;
      const co2 = calculatedAmount * (factorData.co2 || 0);
      const ch4 = calculatedAmount * (factorData.ch4 || 0);
      const n2o = calculatedAmount * (factorData.n2o || 0);
      
      // Prepare emission data for MongoDB API
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
        description: formData.description || (flightRouteMeta
          ? `${flightRouteMeta.origin.iata} → ${flightRouteMeta.destination.iata}${flightRouteMeta.round_trip ? ' (round trip)' : ''}`
          : seaRouteMeta
            ? `${seaRouteMeta.origin.code} → ${seaRouteMeta.destination.code}${seaRouteMeta.round_trip ? ' (round trip)' : ''}`
            : ''),
        notes: formData.description,
        
        // Activity-specific data
        activityData: activityData,
        
        // Emission factor details
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
        // Omit status — backend sets submitted (contributors) or verified (admin/analyst)
        created_by: user?.id,
        created_by_name: user?.name || 'Unknown User',
        ...(isFreightActivity(activity)
          ? { transport_category: formData.transport_category || 'raw_material' }
          : {})
      };
      
      // ============================================
      // MONGODB API CALL - Replace localStorage
      // ============================================
      console.log('📤 Submitting emission to MongoDB via API:', emissionData);
      const savedEmission = await emissionsAPI.create(emissionData);
      console.log('✅ Emission saved to MongoDB:', savedEmission);
      
      // Activity logging (non-blocking)
      try {
        await logEmissionAction('created', savedEmission._id || savedEmission.id, 
          `Created emission record: ${activity.name} - ${calculatedAmount} ${factorData.unit}`
        );
        
        await logActivity('emission_added', 'emission', savedEmission._id || savedEmission.id, 
          `Added emission: ${activity.name} (${formData.source}) - ${totalEmissions.toFixed(2)} CO₂e`
        );
      } catch (activityError) {
        console.warn('⚠️ Activity logging failed (non-critical):', activityError.message);
      }
      
      // Dispatch event for UI updates (header notifications poll / refresh listeners)
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

  const handleFlightDistanceCalculated = (distanceKm, meta) => {
    setFlightRouteMeta(meta);
    if (distanceKm != null && distanceKm > 0) {
      setFormData((prev) => ({
        ...prev,
        distance: String(distanceKm)
      }));
    }
  };

  const handleSeaDistanceCalculated = (distanceKm, meta) => {
    setSeaRouteMeta(meta);
    if (distanceKm != null && distanceKm > 0) {
      setFormData((prev) => ({
        ...prev,
        distance: String(distanceKm)
      }));
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  const factorData = getEmissionFactor(formData.source);

  const renderActivityInputs = () => {
    switch (activity.activityType) {
      case 'fuel-based':
      case 'quantity':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Quantity* ({factorData?.unit || 'units'})
            </label>
            <input
              type="number"
              name="fuelQuantity"
              value={formData.fuelQuantity}
              onChange={handleChange}
              required
              min="0"
              step="0.01"
              disabled={loading}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 ${
                errors.fuelQuantity ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder={`Enter quantity in ${factorData?.unit || 'units'}`}
            />
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center">
              <Gauge className="w-4 h-4 mr-1" />
              Distance* (km)
            </label>
            <input
              type="number"
              name="distance"
              value={formData.distance}
              onChange={handleChange}
              required
              min="0"
              step="0.1"
              disabled={loading}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 ${
                errors.distance ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="Enter distance travelled"
            />
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center">
                <Users className="w-4 h-4 mr-1" />
                Passengers*
              </label>
              <input
                type="number"
                name="passengers"
                value={formData.passengers}
                onChange={handleChange}
                required
                min="1"
                step="1"
                disabled={loading}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 ${
                  errors.passengers ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="Number of passengers"
              />
              {errors.passengers && (
                <p className="text-red-500 text-xs mt-1 flex items-center">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {errors.passengers}
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center">
                <Gauge className="w-4 h-4 mr-1" />
                Distance* (km)
              </label>
              <input
                type="number"
                name="distance"
                value={formData.distance}
                onChange={handleChange}
                required
                min="0"
                step="0.1"
                disabled={loading}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 ${
                  errors.distance ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="Distance travelled"
              />
              {(useFlightRoute && flightRouteMeta) || (useSeaRoute && seaRouteMeta) ? (
                <p
                  className={`text-xs mt-1 ${
                    useSeaRoute ? 'text-teal-600 dark:text-teal-400' : 'text-sky-600 dark:text-sky-400'
                  }`}
                >
                  {useFlightRoute && flightRouteMeta
                    ? `From airports: ${flightRouteMeta.origin.iata} → ${flightRouteMeta.destination.iata}`
                    : `From ports: ${seaRouteMeta.origin.code} → ${seaRouteMeta.destination.code}`}
                  {(flightRouteMeta?.round_trip || seaRouteMeta?.round_trip) ? ' (round trip)' : ''}. Editable if needed.
                </p>
              ) : null}
              {errors.distance && (
                <p className="text-red-500 text-xs mt-1 flex items-center">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {errors.distance}
                </p>
              )}
            </div>
          </div>
        );
        
      case 'freight':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center">
                <Truck className="w-4 h-4 mr-1" />
                Weight* (tonnes)
              </label>
              <input
                type="number"
                name="weight"
                value={formData.weight}
                onChange={handleChange}
                required
                min="0"
                step="0.01"
                disabled={loading}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 ${
                  errors.weight ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="Cargo weight"
              />
              {errors.weight && (
                <p className="text-red-500 text-xs mt-1 flex items-center">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {errors.weight}
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center">
                <Gauge className="w-4 h-4 mr-1" />
                Distance* (km)
              </label>
              <input
                type="number"
                name="distance"
                value={formData.distance}
                onChange={handleChange}
                required
                min="0"
                step="0.1"
                disabled={loading}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 ${
                  errors.distance ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="Transport distance"
              />
              {(useFlightRoute && flightRouteMeta) || (useSeaRoute && seaRouteMeta) ? (
                <p
                  className={`text-xs mt-1 ${
                    useSeaRoute ? 'text-teal-600 dark:text-teal-400' : 'text-sky-600 dark:text-sky-400'
                  }`}
                >
                  {useFlightRoute && flightRouteMeta
                    ? `From airports: ${flightRouteMeta.origin.iata} → ${flightRouteMeta.destination.iata}`
                    : `From ports: ${seaRouteMeta.origin.code} → ${seaRouteMeta.destination.code}`}
                  {(flightRouteMeta?.round_trip || seaRouteMeta?.round_trip) ? ' (round trip)' : ''}. Editable if needed.
                </p>
              ) : null}
              {errors.distance && (
                <p className="text-red-500 text-xs mt-1 flex items-center">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {errors.distance}
                </p>
              )}
            </div>
          </div>
        );
        
      case 'refrigerant':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Refrigerant Amount* (kg)
            </label>
            <input
              type="number"
              name="refrigerantAmount"
              value={formData.refrigerantAmount}
              onChange={handleChange}
              required
              min="0"
              step="0.001"
              disabled={loading}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 ${
                errors.refrigerantAmount ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="Enter amount leaked or used"
            />
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                errors.nights ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                errors.hours ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
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

  const FormContent = (
    <div className={`bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl transition-all duration-300 shadow-glass dark:shadow-glass-dark rounded-2xl border border-white/20 dark:border-slate-700/50 p-6 w-full ${!isInline ? 'max-w-2xl max-h-[90vh] overflow-y-auto' : ''}`}>
      <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Add Emission Data</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Scope {scope} - {activity.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {activity.description}
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isFreightActivity(activity) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Material transport category*
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                {TRANSPORT_CATEGORY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={loading}
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, transport_category: opt.value }))
                    }
                    className={`flex-1 px-4 py-3 text-sm font-medium rounded-lg border-2 transition-colors ${
                      formData.transport_category === opt.value
                        ? opt.value === 'raw_material'
                          ? 'border-green-600 bg-green-50 text-green-900 dark:bg-green-950/40 dark:text-green-200'
                          : 'border-blue-600 bg-blue-50 text-blue-900 dark:bg-blue-950/40 dark:text-blue-200'
                        : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Raw material = Scope 3 Category 4 (upstream). Finished product = Category 9 (downstream).
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            {/* Source Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Source Type*
              </label>
              <select
                name="source"
                value={formData.source}
                onChange={handleChange}
                required
                disabled={loading}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 ${
                  errors.source ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
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
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {factorData.description}
                </p>
              )}
            </div>

            {formData.source && useFlightRoute && (
              <FlightRoutePicker
                origin={originAirport}
                destination={destinationAirport}
                roundTrip={flightRoundTrip}
                onOriginChange={setOriginAirport}
                onDestinationChange={setDestinationAirport}
                onRoundTripChange={setFlightRoundTrip}
                onDistanceCalculated={handleFlightDistanceCalculated}
                disabled={loading}
                errors={{
                  originAirport: errors.originAirport,
                  destinationAirport: errors.destinationAirport
                }}
              />
            )}

            {formData.source && useSeaRoute && (
              <SeaRoutePicker
                origin={originPort}
                destination={destinationPort}
                roundTrip={seaRoundTrip}
                onOriginChange={setOriginPort}
                onDestinationChange={setDestinationPort}
                onRoundTripChange={setSeaRoundTrip}
                onDistanceCalculated={handleSeaDistanceCalculated}
                disabled={loading}
                errors={{
                  originPort: errors.originPort,
                  destinationPort: errors.destinationPort
                }}
              />
            )}

            {/* Activity-specific inputs */}
            {formData.source && renderActivityInputs()}

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                      errors.startDate ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                </div>
                {errors.startDate && (
                  <p className="text-red-500 text-xs mt-1">{errors.startDate}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                      errors.endDate ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Location
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                disabled={loading}
                placeholder="e.g., Building A, Floor 2, Factory Site"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                disabled={loading}
                placeholder="Additional details about this emission source..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Emission Preview - Simplified without showing calculation details */}
          {emissionsPreview && factorData && (
            <div className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                  Estimated Total Emissions:
                </span>
                <span className="text-lg font-bold text-emerald-900 dark:text-emerald-300">
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
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.source}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {loading && (
                <div className="w-4 h-4 border-2 border-white border-t dark:border-gray-700-transparent rounded-full animate-spin"></div>
              )}
              <span>{loading ? 'Saving...' : 'Save Emission'}</span>
            </button>
          </div>
        </form>
      </div>
  );

  if (isInline) {
    return FormContent;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      {FormContent}
    </div>
  );
};

export default EmissionForm;