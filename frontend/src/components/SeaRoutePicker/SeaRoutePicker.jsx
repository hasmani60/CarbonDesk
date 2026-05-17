import { useState, useEffect, useRef, useCallback } from 'react';
import { Ship, ArrowRight, Loader2, Anchor, RotateCcw } from 'lucide-react';
import { seaAPI } from '../../services/api';
import { formatPortLabel } from '../../utils/seaActivity';

function PortAutocomplete({ label, value, onChange, disabled, error }) {
  const [query, setQuery] = useState(value ? formatPortLabel(value) : '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (value) setQuery(formatPortLabel(value));
  }, [value]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const runSearch = useCallback(async (term) => {
    if (!term || term.length < 1) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const list = await seaAPI.searchPorts(term);
      setResults(Array.isArray(list) ? list : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (e) => {
    const term = e.target.value;
    setQuery(term);
    onChange(null);
    setOpen(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(term), 280);
  };

  const pick = (port) => {
    setQuery(formatPortLabel(port));
    onChange(port);
    setOpen(false);
    setResults([]);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
        <Anchor className="w-3.5 h-3.5" />
        {label}
      </label>
      <input
        type="text"
        value={query}
        onChange={handleInput}
        onFocus={() => query && setOpen(true)}
        disabled={disabled}
        placeholder="Search by UN/LOCODE, port or city name"
        autoComplete="off"
        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 ${
          error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
        } bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100`}
      />
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      {open && (loading || results.length > 0) && (
        <ul className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg">
          {loading && (
            <li className="px-3 py-2 text-sm text-gray-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Searching…
            </li>
          )}
          {!loading &&
            results.map((p) => (
              <li key={p.code}>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-teal-50 dark:hover:bg-teal-900/30"
                  onClick={() => pick(p)}
                >
                  <span className="font-semibold text-teal-700 dark:text-teal-400">{p.code}</span>
                  <span className="text-gray-600 dark:text-gray-400"> — {p.name}</span>
                  {p.country && (
                    <span className="block text-xs text-gray-500">
                      {p.city ? `${p.city}, ` : ''}
                      {p.country}
                    </span>
                  )}
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

export default function SeaRoutePicker({
  origin,
  destination,
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

  useEffect(() => {
    if (!origin?.code || !destination?.code) {
      setRouteInfo(null);
      setRouteError('');
      return;
    }

    let cancelled = false;

    const calc = async () => {
      setCalculating(true);
      setRouteError('');
      try {
        const data = await seaAPI.getDistance({
          origin: origin.code,
          destination: destination.code,
          roundTrip
        });
        if (cancelled) return;
        setRouteInfo(data);
        onDistanceCalculated?.(data.distance_km, data);
      } catch (err) {
        if (cancelled) return;
        setRouteInfo(null);
        setRouteError(err.message || 'Could not calculate sea distance');
        onDistanceCalculated?.(null, null);
      } finally {
        if (!cancelled) setCalculating(false);
      }
    };

    calc();
    return () => {
      cancelled = true;
    };
  }, [origin?.code, destination?.code, roundTrip]);

  const swapPorts = () => {
    const o = origin;
    onOriginChange(destination);
    onDestinationChange(o);
  };

  return (
    <div className="rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-950/30 p-4 space-y-4">
      <div className="flex items-center gap-2 text-teal-800 dark:text-teal-300">
        <Ship className="w-5 h-5" />
        <h4 className="font-semibold text-sm">Sea route</h4>
        <span className="text-xs text-teal-600 dark:text-teal-400">(distance between ports)</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-end">
        <PortAutocomplete
          label="Origin port"
          value={origin}
          onChange={onOriginChange}
          disabled={disabled}
          error={errors.originPort}
        />
        <button
          type="button"
          onClick={swapPorts}
          disabled={disabled || !origin || !destination}
          className="mb-1 p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-700 disabled:opacity-40"
          title="Swap origin and destination"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <PortAutocomplete
          label="Destination port"
          value={destination}
          onChange={onDestinationChange}
          disabled={disabled}
          error={errors.destinationPort}
        />
      </div>

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

      {calculating && (
        <p className="text-sm text-gray-500 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Calculating sea distance…
        </p>
      )}

      {routeError && <p className="text-sm text-red-600">{routeError}</p>}

      {routeInfo && !calculating && (
        <div className="flex flex-wrap items-center gap-2 text-sm bg-white dark:bg-gray-800 rounded-lg px-3 py-2 border border-teal-100 dark:border-teal-900">
          <span className="font-medium">{routeInfo.origin.code}</span>
          <ArrowRight className="w-4 h-4 text-gray-400" />
          <span className="font-medium">{routeInfo.destination.code}</span>
          <span className="text-gray-500">·</span>
          <span>
            Great circle: <strong>{routeInfo.great_circle_km} km</strong>
          </span>
          <span className="text-gray-500">→</span>
          <span>
            Sea distance:{' '}
            <strong className="text-emerald-700 dark:text-emerald-400">
              {routeInfo.distance_km} km
            </strong>
            {routeInfo.round_trip ? ' (round trip)' : ''}
          </span>
          <span className="text-xs text-gray-400 w-full">
            Includes {(routeInfo.routing_factor * 100 - 100).toFixed(0)}% routing uplift (shipping
            lanes vs. straight line; estimate only)
          </span>
        </div>
      )}
    </div>
  );
}
