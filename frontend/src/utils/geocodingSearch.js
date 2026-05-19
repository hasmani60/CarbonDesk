/** Shared client settings for OpenStreetMap place search (Nominatim via backend). */
export const PLACE_SEARCH_MIN_CHARS = 3;
export const PLACE_SEARCH_DEBOUNCE_MS = 650;

export function placeSearchRateLimitMessage(err) {
  if (err?.status === 429 || /rate.?limit|429|temporarily busy/i.test(err?.message || '')) {
    return 'Location search is busy. Wait a few seconds, then type a more specific address (3+ characters).';
  }
  return err?.message || 'Could not search locations';
}
