export const PRODUCTION_UNITS = [
  { value: 'units', label: 'Units (pieces)' },
  { value: 'kg', label: 'Kilograms (kg)' },
  { value: 'tonnes', label: 'Tonnes' },
  { value: 'litres', label: 'Litres' },
  { value: 'm3', label: 'Cubic metres (m³)' },
  { value: 'kWh', label: 'kWh' },
  { value: 'other', label: 'Other' }
];

export function formatProductionUnit(unit) {
  return PRODUCTION_UNITS.find((u) => u.value === unit)?.label || unit;
}

export function currentPeriodMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** HTML month input value from YYYY-MM */
export function toMonthInputValue(periodMonth) {
  if (!periodMonth || !/^\d{4}-\d{2}$/.test(periodMonth)) return '';
  return periodMonth;
}

/** YYYY-MM from HTML month input */
export function fromMonthInputValue(value) {
  return value || currentPeriodMonth();
}
