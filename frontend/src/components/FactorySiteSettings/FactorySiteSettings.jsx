import { useState, useEffect, useRef, useCallback } from 'react';
import { Factory, MapPin, Loader2, Save, Trash2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { roadAPI } from '../../services/api';
import { formatPlaceLabel } from '../../utils/roadActivity';
import {
  PLACE_SEARCH_DEBOUNCE_MS,
  PLACE_SEARCH_MIN_CHARS,
  placeSearchRateLimitMessage
} from '../../utils/geocodingSearch';
import toast from 'react-hot-toast';

export default function FactorySiteSettings({ organisation, onUpdated }) {
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const debounceRef = useRef(null);
  const wrapRef = useRef(null);

  const loadSite = useCallback(async () => {
    setLoading(true);
    try {
      const data = await roadAPI.getFactorySite();
      setSite(data || null);
    } catch (err) {
      setSite(null);
      toast.error(err.message || 'Could not load factory site');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSite();
  }, [loadSite, organisation?.site_coordinates?.updated_at]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const runSearch = async (term) => {
    if (!term || term.length < PLACE_SEARCH_MIN_CHARS) {
      setSearchResults([]);
      setSearchError('');
      return;
    }
    setSearchLoading(true);
    setSearchError('');
    try {
      const list = await roadAPI.searchPlaces(term);
      setSearchResults(Array.isArray(list) ? list : []);
    } catch (err) {
      setSearchResults([]);
      setSearchError(placeSearchRateLimitMessage(err));
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchInput = (e) => {
    const term = e.target.value;
    setSearchQuery(term);
    setSearchOpen(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(term), PLACE_SEARCH_DEBOUNCE_MS);
  };

  const saveFromPlace = async (place) => {
    setSaving(true);
    try {
      const data = await roadAPI.saveFactorySite({
        place_id: place.place_id,
        label: `${organisation?.display_name || organisation?.name || 'Factory'} (factory)`,
        address: place.label
      });
      setSite(data);
      setSearchQuery(formatPlaceLabel(data));
      setSearchOpen(false);
      toast.success('Factory location saved');
      onUpdated?.(data);
    } catch (err) {
      toast.error(err.message || 'Failed to save factory location');
    } finally {
      setSaving(false);
    }
  };

  const geocodeFromAddress = async () => {
    setSaving(true);
    try {
      const data = await roadAPI.saveFactorySite({ geocodeFromAddress: true });
      setSite(data);
      setSearchQuery(formatPlaceLabel(data));
      toast.success('Factory location saved from organisation address');
      onUpdated?.(data);
    } catch (err) {
      toast.error(err.message || 'Could not geocode organisation address');
    } finally {
      setSaving(false);
    }
  };

  const clearSaved = async () => {
    if (!window.confirm('Clear saved factory coordinates? Road routes will geocode from address each time.')) {
      return;
    }
    setSaving(true);
    try {
      await roadAPI.clearFactorySite();
      await loadSite();
      setSearchQuery('');
      toast.success('Saved coordinates cleared');
      onUpdated?.(null);
    } catch (err) {
      toast.error(err.message || 'Failed to clear factory site');
    } finally {
      setSaving(false);
    }
  };

  const addressLine = [organisation?.address, organisation?.location, organisation?.registered_address]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="app-card border-l-4 border-amber-500 dark:border-amber-500 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 bg-amber-50/50 dark:bg-amber-950/20">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Factory className="w-5 h-5 text-amber-600" />
          Factory site (road routes)
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Save exact coordinates once for inbound/outbound material transport and road distance
          calculations.
        </p>
      </div>

      <div className="p-6 space-y-4">
        {loading ? (
          <p className="text-sm text-gray-500 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading factory site…
          </p>
        ) : (
          <>
            {site?.is_saved ? (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/30 px-3 py-2 text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-emerald-900 dark:text-emerald-200">Saved coordinates</p>
                  <p className="text-gray-700 dark:text-gray-300 mt-0.5">{site.label || site.address}</p>
                  <p className="text-xs text-gray-500 mt-1 font-mono">
                    {site.lat}, {site.lon}
                    {site.saved_at ? ` · updated ${new Date(site.saved_at).toLocaleString()}` : ''}
                  </p>
                </div>
              </div>
            ) : site ? (
              <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 rounded-lg px-3 py-2">
                Using temporary geocode from organisation address (not saved). Save below to fix
                the pin for all users.
              </p>
            ) : (
              <p className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">
                No factory location found. Add an address under Contact Information, then geocode
                or search below.
              </p>
            )}

            {addressLine && (
              <p className="text-xs text-gray-500">
                <span className="font-medium">Organisation address:</span> {addressLine}
              </p>
            )}

            <div className="relative" ref={wrapRef}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                Set factory location
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchInput}
                onFocus={() => searchQuery && setSearchOpen(true)}
                disabled={saving}
                placeholder={`Search address (min ${PLACE_SEARCH_MIN_CHARS} characters)`}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500"
              />
              {searchError && (
                <p className="text-amber-700 dark:text-amber-400 text-xs mt-1">{searchError}</p>
              )}
              {searchOpen && (searchLoading || searchResults.length > 0) && (
                <ul className="absolute z-20 mt-1 w-full max-h-48 overflow-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg">
                  {searchLoading && (
                    <li className="px-3 py-2 text-sm text-gray-500">Searching…</li>
                  )}
                  {!searchLoading &&
                    searchResults.map((p) => (
                      <li key={p.place_id}>
                        <button
                          type="button"
                          disabled={saving}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50 dark:hover:bg-amber-900/30"
                          onClick={() => saveFromPlace(p)}
                        >
                          {p.label}
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={geocodeFromAddress}
                disabled={saving || !addressLine}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save from organisation address
              </button>
              <button
                type="button"
                onClick={loadSite}
                disabled={saving || loading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              {site?.is_saved && (
                <button
                  type="button"
                  onClick={clearSaved}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear saved pin
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
