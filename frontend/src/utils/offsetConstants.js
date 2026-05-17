export const OFFSET_TYPES = [
  { value: 'pat_certificate', label: 'PAT Certificate' },
  { value: 'carbon_credit', label: 'Carbon Credit' },
  { value: 'rec', label: 'REC' },
  { value: 'other', label: 'Other' }
];

export const OFFSET_UNITS = [
  { value: 'tco2e', label: 'tCO₂e' },
  { value: 'pat_units', label: 'PAT Units' },
  { value: 'mwh', label: 'MWh' },
  { value: 'other', label: 'Other' }
];

export const OFFSET_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'partially_used', label: 'Partially Used' },
  { value: 'utilized', label: 'Utilized' },
  { value: 'expired', label: 'Expired' }
];

export const APPLICABLE_SCOPES = [
  { value: 1, label: 'Scope 1' },
  { value: 2, label: 'Scope 2' },
  { value: 3, label: 'Scope 3' }
];

export const DOCUMENT_TYPES = [
  { value: 'certificate', label: 'Certificate PDF' },
  { value: 'verification', label: 'Verification report' },
  { value: 'supporting', label: 'Supporting document' },
  { value: 'other', label: 'Other' }
];

export function formatOffsetType(value) {
  return OFFSET_TYPES.find((t) => t.value === value)?.label || value;
}

export function formatOffsetUnit(value) {
  return OFFSET_UNITS.find((u) => u.value === value)?.label || value;
}

export function formatOffsetStatus(value) {
  return OFFSET_STATUSES.find((s) => s.value === value)?.label || value;
}

export function statusBadgeClass(status) {
  switch (status) {
    case 'active':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
    case 'partially_used':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
    case 'utilized':
      return 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
    case 'expired':
      return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-200';
  }
}

export function currentReportingYear() {
  return new Date().getFullYear();
}
