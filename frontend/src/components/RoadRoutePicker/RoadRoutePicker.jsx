import { useState, useEffect, useRef, useCallback } from 'react';
import { Truck, ArrowRight, Loader2, MapPin, RotateCcw, Factory, AlertCircle } from 'lucide-react';
import { roadAPI } from '../../services/api';
import { formatPlaceLabel } from '../../utils/roadActivity';

function PlaceAutocomplete({
  label,
  value,
  onChange,
  disabled,
  locked,
  error,
  placeholder
}) {
  const [query, setQuery] = useState(value ? formatPlaceLabel(value) : '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (value) setQuery(formatPlaceLabel(value));
  }, [value]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const runSearch = useCallback(async (term) => {
    if (!term || term.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const list = await roadAPI.searchPlaces(term);
      setResults(Array.isArray(list) ? list : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (e) => {
    if (locked) return;
    const term = e.target.value;
    setQuery(term);
    onChange(null);
    setOpen(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(term), 320);
  };

  const pick = (place) => {
    setQuery(formatPlaceLabel(place));
    onChange(place);
    setOpen(false);
    setResults([]);
  };

  if (locked && value) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
          <Factory className="w-3.5 h-3.5 text-amber-600" />
          {label}
        </label>
        <div className="px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/40 text-sm text-gray-800 dark:text-gray-200">
          {formatPlaceLabel(value)}
          <span className="block text-xs text-amber-700 dark:text-amber-400 mt-1">
            {value.source === 'organisation_config' ? 'Saved factory pin' : 'Factory site (from organisation address)'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" ref={wrapRef}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
        <MapPin className="w-3.5 h-3.5" />
        {label}
      </label>
      <input
        type="text"
        value={query}
        onChange={handleInput}
        onFocus={() => !locked && query && setOpen(true)}
        disabled={disabled || locked}
        placeholder={placeholder || 'Search address, city, or place'}
        autoComplete="off"
        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 ${
          error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
        } bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100`}
      />
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      {open && !locked && (loading || results.length > 0) && (
        <ul className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg">
          {loading && (
            <li className="px-3 py-2 text-sm text-gray-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Searching…
            </li>
          )}
          {!loading &&
            results.map((p) => (
              <li key={p.place_id}>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                  onClick={() => pick(p)}
                >
                  <span className="text-gray-900 dark:text-gray-100">{p.label}</span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

export default function RoadRoutePicker({
  origin,
  destination,
  factoryRole,
  materialFreight,
  roundTrip,
  onOriginChange,
  onDestinationChange,
  onRoundTripChange,
  onDistanceCalculated,
  disabled = false,
  errors = {}
}) {
  const [calculating, setCalculating] = useState(false);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeError, setRouteError] = useState('');
  const [factoryLoading, setFactoryLoading] = useState(true);
  const [factoryWarning, setFactoryWarning] = useState('');
  const [factorySite, setFactorySite] = useState(null);

  const lockOrigin = materialFreight && factoryRole === 'origin';
  const lockDestination = materialFreight && factoryRole === 'destination';

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setFactoryLoading(true);
      setFactoryWarning('');
      try {
        const site = await roadAPI.getFactorySite();
        if (cancelled) return;
        if (!site) {
          setFactoryWarning(
            'Set your factory address in Organisation settings to auto-fill inbound/outbound routes.'
          );
          return;
        }
        setFactorySite(site);
        if (materialFreight && factoryRole === 'origin') {
          onOriginChange(site);
        } else if (materialFreight && factoryRole === 'destination') {
          onDestinationChange(site);
        }
      } catch {
        if (!cancelled) {
          setFactoryWarning('Could not load factory location.');
        }
      } finally {
        if (!cancelled) setFactoryLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [materialFreight, factoryRole]);

  useEffect(() => {
    if (!origin?.lat || !destination?.lat) {
      setRouteInfo(null);
      setRouteError('');
      return;
    }

    let cancelled = false;

    const calc = async () => {
      setCalculating(true);
      setRouteError('');
      try {
        const data = await roadAPI.getDistance({
          origin,
          destination,
          roundTrip
        });
        if (cancelled) return;
        setRouteInfo(data);
        onDistanceCalculated?.(data.distance_km, data);
      } catch (err) {
        if (cancelled) return;
        setRouteInfo(null);
        setRouteError(err.message || 'Could not calculate road distance');
        onDistanceCalculated?.(null, null);
      } finally {
        if (!cancelled) setCalculating(false);
      }
    };

    calc();
    return () => {
      cancelled = true;
    };
  }, [origin?.lat, origin?.lon, destination?.lat, destination?.lon, roundTrip]);

  const swapEnds = () => {
    if (lockOrigin || lockDestination) return;
    const o = origin;
    onOriginChange(destination);
    onDestinationChange(o);
  };

  const applyFactoryToOrigin = () => {
    if (factorySite) onOriginChange(factorySite);
  };

  const applyFactoryToDestination = () => {
    if (factorySite) onDestinationChange(factorySite);
  };

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/25 p-4 space-y-4">
      <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
        <Truck className="w-5 h-5" />
        <h4 className="font-semibold text-sm">Road route</h4>
        <span className="text-xs text-amber-700 dark:text-amber-400">
          {materialFreight
            ? factoryRole === 'destination'
              ? '(material → factory)'
              : '(factory → customer)'
            : '(driving distance)'}
        </span>
      </div>

      {factoryLoading && (
        <p className="text-sm text-gray-500 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading factory location…
        </p>
      )}

      {factoryWarning && (
        <p className="text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {factoryWarning}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-end">
        <PlaceAutocomplete
          label={materialFreight && factoryRole === 'origin' ? 'Origin (factory)' : 'Origin'}
          value={origin}
          onChange={onOriginChange}
          disabled={disabled}
          locked={lockOrigin}
          error={errors.originPlace}
          placeholder={
            materialFreight && factoryRole === 'destination'
              ? 'Supplier / pickup location'
              : 'Starting location'
          }
        />
        <button
          type="button"
          onClick={swapEnds}
          disabled={disabled || lockOrigin || lockDestination || !origin || !destination}
          className="mb-1 p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-700 disabled:opacity-40"
          title="Swap origin and destination"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <PlaceAutocomplete
          label={
            materialFreight && factoryRole === 'destination' ? 'Destination (factory)' : 'Destination'
          }
          value={destination}
          onChange={onDestinationChange}
          disabled={disabled}
          locked={lockDestination}
          error={errors.destinationPlace}
          placeholder={
            materialFreight && factoryRole === 'origin'
              ? 'Customer / delivery location'
              : 'End location'
          }
        />
      </div>

      {!materialFreight && factorySite && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={applyFactoryToOrigin}
            className="text-xs px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40"
          >
            Use factory as origin
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={applyFactoryToDestination}
            className="text-xs px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40"
          >
            Use factory as destination
          </button>
        </div>
      )}

      {!materialFreight && (
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={roundTrip}
            onChange={(e) => onRoundTripChange?.(e.target.checked)}
            disabled={disabled}
            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
          />
          Round trip (double one-way distance)
        </label>
      )}

      {calculating && (
        <p className="text-sm text-gray-500 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Calculating driving distance…
        </p>
      )}

      {routeError && <p className="text-sm text-red-600">{routeError}</p>}

      {routeInfo && !calculating && (
        <div className="flex flex-wrap items-center gap-2 text-sm bg-white dark:bg-gray-800 rounded-lg px-3 py-2 border border-amber-100 dark:border-amber-900">
          <span className="font-medium truncate max-w-[140px]" title={routeInfo.origin.label}>
            {routeInfo.origin.label?.split(',')[0]}
          </span>
          <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" />
          <span className="font-medium truncate max-w-[140px]" title={routeInfo.destination.label}>
            {routeInfo.destination.label?.split(',')[0]}
          </span>
          <span className="text-gray-500">·</span>
          <span>
            Driving:{' '}
            <strong className="text-emerald-700 dark:text-emerald-400">
              {routeInfo.distance_km} km
            </strong>
            {routeInfo.round_trip ? ' (round trip)' : ''}
          </span>
          {routeInfo.duration_minutes > 0 && (
            <span className="text-xs text-gray-500">~{routeInfo.duration_minutes} min</span>
          )}
        </div>
      )}
    </div>
  );
}
