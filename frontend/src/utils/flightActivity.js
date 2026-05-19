/** Scope 3 (and freight) activities that support airport origin/destination distance. */
export function supportsFlightRoute(activity) {
  const name = activity?.name || '';
  return (
    name.includes('Business Travel - Air') || name.includes('Freighting Goods - Air')
  );
}

export function formatAirportLabel(airport) {
  if (!airport) return '';
  const city = airport.city ? `${airport.city}, ` : '';
  return `${airport.iata} — ${airport.name} (${city}${airport.country})`;
}
