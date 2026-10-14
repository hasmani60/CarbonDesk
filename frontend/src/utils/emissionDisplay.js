/**
 * Mongo stores activity quantity as `quantity`; `amount` may default to 0 — never use `amount ?? quantity`
 * or a literal 0 blocks the real quantity.
 */
export function getDisplayedActivityQuantity(emission) {
  const q = emission?.quantity;
  const a = emission?.amount;
  if (q != null && q !== '' && Number.isFinite(Number(q))) return Number(q);
  if (a != null && a !== '' && Number.isFinite(Number(a))) return Number(a);
  return 0;
}

export function getDisplayedCo2e(emission) {
  const v =
    emission?.co2e ??
    emission?.calculatedEmissions ??
    emission?.totalEmissions ??
    0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** API emissions are stored in kg CO2e; show them as tonnes where the UI labels tCO2e. */
export function formatKgCo2eAsTonnes(value) {
  const kg = Number(value);
  if (!Number.isFinite(kg)) return '0.0';

  const tonnes = kg / 1000;
  if (tonnes >= 1_000_000) return `${(tonnes / 1_000_000).toFixed(1)}M`;
  if (tonnes >= 1000) return `${(tonnes / 1000).toFixed(1)}K`;
  return tonnes.toFixed(1);
}

/** Name shown for “entered by” — API stores Mongo `created_by_name`, legacy/local used `userName`. */
export function getContributorDisplayName(emission) {
  const raw =
    emission?.created_by_name ||
    emission?.userName ||
    (emission?.user && typeof emission.user === 'object' ? emission.user.name : '') ||
    '';
  const trimmed = String(raw || '').trim();
  return trimmed || 'Unknown User';
}

export function getContributorId(emission) {
  return emission?.created_by ?? emission?.user_id ?? emission?.user ?? null;
}
