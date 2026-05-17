const TRANSPORT_CATEGORIES = ['raw_material', 'finished_product'];

/**
 * Scope 3 material / freight transport entries (Cat. 4 & 9).
 * Excludes employee commute (separate Employee collection).
 */
function isMaterialTransportEmission(doc = {}) {
  const scope = parseInt(doc.scope, 10);
  if (scope !== 3) return false;

  const category = String(doc.category || doc.activityType || doc.activity || '').trim();
  if (/^Freighting Goods/i.test(category)) return true;
  if (/^Transport[:\s]/i.test(category) || /^Transport$/i.test(category)) return true;

  const unit = String(doc.unit || doc.emissionFactor?.unit || '').toLowerCase();
  if (unit.includes('tonne.km')) return true;

  const ad = doc.activityData || {};
  if (ad.weight != null && ad.distance != null) return true;

  return false;
}

function normalizeTransportCategory(value) {
  if (value === 'finished_product') return 'finished_product';
  return 'raw_material';
}

function materialTransportMatchFilter() {
  return {
    scope: 3,
    $or: [
      { category: { $regex: /^Freighting Goods/i } },
      { activityType: { $regex: /^Freighting Goods/i } },
      { category: { $regex: /^Transport/i } },
      { activityType: { $regex: /^Transport/i } },
      { unit: { $regex: /tonne\.km/i } },
      {
        'activityData.weight': { $exists: true, $ne: null },
        'activityData.distance': { $exists: true, $ne: null }
      }
    ]
  };
}

module.exports = {
  TRANSPORT_CATEGORIES,
  isMaterialTransportEmission,
  normalizeTransportCategory,
  materialTransportMatchFilter
};
