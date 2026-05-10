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
