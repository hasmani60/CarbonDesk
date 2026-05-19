// Shared emission query filters — used by analysisService and reportDataService

function coerceDate(val) {
  if (val == null || val === '') return null;
  if (val instanceof Date) return val;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeStringArray(value) {
  if (value == null) return null;
  const arr = Array.isArray(value) ? value : [value];
  const cleaned = arr.map((v) => (typeof v === 'string' ? v.trim() : v)).filter((v) => v != null && v !== '');
  return cleaned.length ? cleaned : null;
}

function normalizeScopeArray(value) {
  const arr = normalizeStringArray(value);
  if (!arr) return null;
  const scopes = [...new Set(arr.map((s) => parseInt(s, 10)).filter((n) => n >= 1 && n <= 3))];
  return scopes.length ? scopes : null;
}

/**
 * Resolve reporting period from explicit dates and/or calendar month/year.
 */
function resolveDateRange({ startDate, endDate, reportingMonth, reportingYear } = {}) {
  const start = coerceDate(startDate);
  const end = coerceDate(endDate);
  if (start && end) {
    return { startDate: start, endDate: end };
  }

  const year = reportingYear != null && reportingYear !== '' ? parseInt(reportingYear, 10) : NaN;
  const month =
    reportingMonth != null && reportingMonth !== '' ? parseInt(reportingMonth, 10) : NaN;

  if (!Number.isNaN(year) && !Number.isNaN(month) && month >= 1 && month <= 12) {
    const startMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    return { startDate: startMonth, endDate: endMonth };
  }

  if (!Number.isNaN(year)) {
    return {
      startDate: new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)),
      endDate: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999))
    };
  }

  if (start) return { startDate: start, endDate: end || start };
  if (end) return { startDate: start || end, endDate: end };

  return { startDate: null, endDate: null };
}

/**
 * Build MongoDB $match for emissions — aligns with analysisService filters.
 * Supports multi-select scopes, facilities (location), departments, sites, categories, status.
 */
function buildEmissionMatch(filters = {}) {
  const match = {};

  if (filters.organisationId) {
    match.organisation_id = filters.organisationId;
  }

  const { startDate, endDate } = resolveDateRange(filters);
  if (startDate || endDate) {
    match.date = {};
    if (startDate) match.date.$gte = startDate;
    if (endDate) match.date.$lte = endDate;
  }

  const scopes = normalizeScopeArray(
    filters.selectedScopes || filters.scopes || (filters.scope != null ? [filters.scope] : null)
  );
  if (scopes) {
    match.scope = scopes.length === 1 ? scopes[0] : { $in: scopes };
  } else if (filters.scope != null) {
    const scopeNum = parseInt(filters.scope, 10);
    if (!Number.isNaN(scopeNum) && scopeNum >= 1 && scopeNum <= 3) {
      match.scope = scopeNum;
    }
  }

  const facilities = normalizeStringArray(
    filters.selectedFacilities || filters.locations || filters.facilities
  );
  if (facilities) {
    match.location = facilities.length === 1 ? facilities[0] : { $in: facilities };
  }

  const departments = normalizeStringArray(filters.selectedDepartments || filters.departments);
  if (departments) {
    match.department = departments.length === 1 ? departments[0] : { $in: departments };
  }

  const sites = normalizeStringArray(filters.selectedSites || filters.sites);
  if (sites) {
    match.site = sites.length === 1 ? sites[0] : { $in: sites };
  }

  if (filters.asset) {
    match.asset = filters.asset;
  }

  const categories = normalizeStringArray(filters.selectedCategories || filters.categories);
  if (categories) {
    match.category = categories.length === 1 ? categories[0] : { $in: categories };
  } else if (filters.category) {
    match.category = filters.category;
  }

  if (filters.status) {
    match.status = filters.status;
  } else if (filters.excludeRejected !== false) {
    match.status = { $ne: 'rejected' };
  }

  const additional = filters.additionalFilters;
  if (additional && typeof additional === 'object' && !Array.isArray(additional)) {
    for (const [key, value] of Object.entries(additional)) {
      if (value == null || value === '') continue;
      if (['_id', 'organisation_id', 'organisationId'].includes(key)) continue;
      const arr = normalizeStringArray(value);
      if (arr) {
        match[key] = arr.length === 1 ? arr[0] : { $in: arr };
      } else if (typeof value === 'object') {
        match[key] = value;
      } else {
        match[key] = value;
      }
    }
  }

  return match;
}

/**
 * Strip organisation + date keys for merging into services that set those separately.
 */
function additionalMatchFromBuilt(match) {
  const { organisation_id, date, ...rest } = match;
  return rest;
}

module.exports = {
  coerceDate,
  normalizeStringArray,
  resolveDateRange,
  buildEmissionMatch,
  additionalMatchFromBuilt
};
