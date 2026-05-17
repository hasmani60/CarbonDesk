export const TRANSPORT_CATEGORY_OPTIONS = [
  {
    value: 'raw_material',
    label: 'Raw Material (Inbound)',
    shortLabel: 'Raw Material',
    badgeClass:
      'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
  },
  {
    value: 'finished_product',
    label: 'Finished Product / Ready Product (Outbound)',
    shortLabel: 'Finished Product',
    badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
  }
];

export function isFreightActivity(activity) {
  return activity?.activityType === 'freight';
}

export function getTransportCategoryMeta(value) {
  return (
    TRANSPORT_CATEGORY_OPTIONS.find((o) => o.value === value) ||
    TRANSPORT_CATEGORY_OPTIONS[0]
  );
}

export function isMaterialTransportRow(emission) {
  if (parseInt(emission?.scope, 10) !== 3) return false;
  const cat = String(
    emission?.category || emission?.activityType || emission?.activity || ''
  );
  if (/^Freighting Goods/i.test(cat)) return true;
  if (/^Transport/i.test(cat)) return true;
  if (emission?.transport_category) return true;
  return false;
}
