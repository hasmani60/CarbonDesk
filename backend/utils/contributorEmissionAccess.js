// Aligns contributor RBAC with frontend AuthContext (allowedScopes OR allowedActivities → scopes).
const { emissionFactors } = require('../data/complete_emission_factors_db');

function normalizeScopeNum(scopeVal) {
  const n = parseInt(String(scopeVal), 10);
  return Number.isFinite(n) && n >= 1 && n <= 3 ? n : NaN;
}

function isLeafFactorRow(node) {
  return (
    node &&
    typeof node === 'object' &&
    typeof node.factor === 'number' &&
    !Array.isArray(node)
  );
}

/**
 * Locate a permission string in the UK factors DB — either a top-level category ("Liquid Fuels")
 * or a fuel line / subcategory key ("Diesel (Average Biofuel Blend) (tonnes)").
 */
function locateEmissionFactorKey(name) {
  if (!name || typeof name !== 'string') return null;
  const key = name.trim();
  if (!key) return null;

  for (let s = 1; s <= 3; s += 1) {
    const scopeData = emissionFactors[`scope${s}`];
    if (!scopeData) continue;

    for (const catKey of Object.keys(scopeData)) {
      const catVal = scopeData[catKey];
      if (catKey === key) {
        if (isLeafFactorRow(catVal)) {
          return { scope: s, categoryKey: catKey, subKey: catKey, kind: 'line' };
        }
        return { scope: s, categoryKey: catKey, kind: 'category' };
      }
      if (catVal && typeof catVal === 'object' && !isLeafFactorRow(catVal)) {
        const subKeys = Object.keys(catVal);
        for (let i = 0; i < subKeys.length; i += 1) {
          const subKey = subKeys[i];
          if (subKey === key && isLeafFactorRow(catVal[subKey])) {
            return { scope: s, categoryKey: catKey, subKey, kind: 'line' };
          }
        }
      }
    }
  }
  return null;
}

/** GHG scope (1–3) for a factor category or fuel-line key. */
function scopeForCategoryKey(categoryName) {
  const loc = locateEmissionFactorKey(categoryName);
  return loc ? loc.scope : null;
}

/** Can open / use this scope tab (routes, coarse checks) — mirrors canAccessScope without a specific category yet. */
function contributorAllowedToUseScope(restrictions, scopeVal) {
  if (!restrictions) return true;
  const scopeInt = normalizeScopeNum(scopeVal);
  if (!Number.isFinite(scopeInt)) return false;

  const allowedScopes = Array.isArray(restrictions.allowedScopes)
    ? restrictions.allowedScopes
    : [];
  const allowedActivities = Array.isArray(restrictions.allowedActivities)
    ? restrictions.allowedActivities
    : [];

  if (
    allowedScopes.length > 0 &&
    allowedScopes.some((raw) => normalizeScopeNum(raw) === scopeInt)
  ) {
    return true;
  }

  if (allowedActivities.length > 0) {
    return allowedActivities.some((name) => scopeForCategoryKey(name) === scopeInt);
  }

  if (allowedScopes.length === 0 && allowedActivities.length === 0) {
    return false;
  }

  return allowedScopes.some((raw) => normalizeScopeNum(raw) === scopeInt);
}

/**
 * Can submit an emission with this scope, category tab key, and fuel line (subcategory/source).
 * allowedActivities entries may store category keys or specific fuel-line keys from the factor DB.
 */
function contributorMaySubmitEmission(restrictions, scopeVal, categoryKey, lineItemKey) {
  if (!restrictions) return true;
  const scopeInt = normalizeScopeNum(scopeVal);
  if (!Number.isFinite(scopeInt)) return false;

  const allowedScopes = Array.isArray(restrictions.allowedScopes)
    ? restrictions.allowedScopes
    : [];
  const allowedActivities = Array.isArray(restrictions.allowedActivities)
    ? restrictions.allowedActivities
    : [];

  const inFullScopeList =
    allowedScopes.length > 0 &&
    allowedScopes.some((raw) => normalizeScopeNum(raw) === scopeInt);

  if (inFullScopeList) return true;

  const cat = categoryKey != null ? String(categoryKey).trim() : '';
  const line = lineItemKey != null ? String(lineItemKey).trim() : '';

  if (allowedActivities.length > 0) {
    const activityTouchesScope = allowedActivities.some((raw) => {
      const loc = locateEmissionFactorKey(String(raw).trim());
      return loc && loc.scope === scopeInt;
    });
    if (!activityTouchesScope) return false;
    if (!cat) return false;

    return allowedActivities.some((raw) => {
      const a = String(raw).trim();
      const loc = locateEmissionFactorKey(a);
      if (!loc || loc.scope !== scopeInt) return false;
      if (loc.kind === 'category') return cat === loc.categoryKey;
      return cat === loc.categoryKey && line === loc.subKey;
    });
  }

  if (allowedScopes.length === 0 && allowedActivities.length === 0) {
    return false;
  }

  return allowedScopes.some((raw) => normalizeScopeNum(raw) === scopeInt);
}

/** Scopes the user may use on Input (explicit + inferred from activity names); empty arrays => none. */
function effectiveAllowedScopesForContributor(restrictions) {
  if (!restrictions) return [1, 2, 3];
  const allowedScopes = Array.isArray(restrictions.allowedScopes)
    ? restrictions.allowedScopes
    : [];
  const allowedActivities = Array.isArray(restrictions.allowedActivities)
    ? restrictions.allowedActivities
    : [];

  const out = new Set();
  allowedScopes.forEach((raw) => {
    const n = normalizeScopeNum(raw);
    if (Number.isFinite(n)) out.add(n);
  });
  allowedActivities.forEach((name) => {
    const sc = scopeForCategoryKey(name);
    if (sc) out.add(sc);
  });

  if (allowedScopes.length === 0 && allowedActivities.length === 0) {
    return [];
  }
  if (out.size === 0) return [];
  return [...out].sort((a, b) => a - b);
}

module.exports = {
  normalizeScopeNum,
  scopeForCategoryKey,
  contributorAllowedToUseScope,
  contributorMaySubmitEmission,
  effectiveAllowedScopesForContributor
};
