/** Activities that support address-to-address road distance. */
export function supportsRoadRoute(activity) {
  const name = activity?.name || '';
  if (name.includes('Freighting Goods - Road')) return true;
  if (name.includes('Business Travel - Cars')) return true;
  if (name.includes('Business Travel - Taxis')) return true;
  if (name.includes('Business Travel - Motorbikes')) return true;
  if (/^Passenger Vehicles/i.test(name)) return true;
  if (/^Delivery Vehicles/i.test(name)) return true;
  return false;
}

export function isMaterialRoadFreight(activity) {
  return (activity?.name || '').includes('Freighting Goods - Road');
}

export function formatPlaceLabel(place) {
  if (!place) return '';
  if (place.is_factory) {
    return `${place.label || place.name}${place.address ? ` — ${place.address}` : ''}`;
  }
  return place.label || place.name || `${place.lat}, ${place.lon}`;
}

/**
 * For Scope 3 road freight: which end is the factory site.
 * raw_material → factory is destination (inbound)
 * finished_product → factory is origin (outbound)
 */
export function getFactoryEndpointRole(transportCategory) {
  if (transportCategory === 'raw_material') return 'destination';
  if (transportCategory === 'finished_product') return 'origin';
  return null;
}
