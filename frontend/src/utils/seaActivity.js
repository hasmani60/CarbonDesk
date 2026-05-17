/** Scope 3 activities that support port origin/destination distance. */
export function supportsSeaRoute(activity) {
  const name = activity?.name || '';
  return (
    name.includes('Business Travel - Sea') || name.includes('Freighting Goods - Sea')
  );
}

export function formatPortLabel(port) {
  if (!port) return '';
  const city = port.city ? `${port.city}, ` : '';
  return `${port.code} — ${port.name} (${city}${port.country})`;
}
