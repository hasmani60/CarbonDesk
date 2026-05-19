export const TRANSPORT_MODES = [
  { value: 'personal_car_petrol', label: 'Car (Petrol)' },
  { value: 'personal_car_diesel', label: 'Car (Diesel)' },
  { value: 'two_wheeler_petrol', label: 'Two-wheeler (Petrol)' },
  { value: 'two_wheeler_diesel', label: 'Two-wheeler (Diesel)' },
  { value: 'cng_vehicle', label: 'CNG Vehicle' },
  { value: 'electric_vehicle', label: 'Electric Vehicle' },
  { value: 'bus', label: 'Bus' },
  { value: 'metro', label: 'Metro' },
  { value: 'train', label: 'Train' },
  { value: 'cab_shared', label: 'Cab (Shared)' },
  { value: 'cab_solo', label: 'Cab (Solo)' },
  { value: 'bicycle', label: 'Bicycle' },
  { value: 'walking', label: 'Walking' }
];

export const FUEL_BASED_MODES = new Set([
  'personal_car_petrol',
  'personal_car_diesel',
  'two_wheeler_petrol',
  'two_wheeler_diesel',
  'cng_vehicle'
]);

export const COMMUTE_CHART_COLORS = [
  '#059669',
  '#2563eb',
  '#dc2626',
  '#d97706',
  '#7c3aed',
  '#0891b2',
  '#be185d',
  '#4b5563'
];

export const formatCommuteMode = (mode) =>
  TRANSPORT_MODES.find((m) => m.value === mode)?.label || mode?.replace(/_/g, ' ');

export const currentMonthISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
