/**
 * Map AI report filter payload → analytics API query params (JSON `filters` blob).
 */
export function reportFiltersToAnalyticsParams(reportFilters) {
  if (!reportFilters || typeof reportFilters !== 'object') {
    return {};
  }

  const payload = {
    startDate: reportFilters.startDate,
    endDate: reportFilters.endDate,
    reportingMonth: reportFilters.reportingMonth,
    reportingYear: reportFilters.reportingYear,
    selectedScopes: reportFilters.selectedScopes,
    selectedFacilities: reportFilters.selectedFacilities,
    selectedDepartments: reportFilters.selectedDepartments,
    selectedSites: reportFilters.selectedSites,
    selectedCategories: reportFilters.selectedCategories
  };

  const cleaned = Object.fromEntries(
    Object.entries(payload).filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length))
  );

  if (!Object.keys(cleaned).length) return {};

  return { filters: JSON.stringify(cleaned) };
}

/** Analytics API params scoped to a single GHG scope (1, 2, or 3). */
export function reportFiltersToScopeParams(reportFilters, scope) {
  const base = reportFiltersToAnalyticsParams(reportFilters);
  if (!base.filters) {
    return { filters: JSON.stringify({ selectedScopes: [scope] }) };
  }
  try {
    const parsed = JSON.parse(base.filters);
    return {
      filters: JSON.stringify({
        ...parsed,
        selectedScopes: [scope]
      })
    };
  } catch {
    return { filters: JSON.stringify({ selectedScopes: [scope] }) };
  }
}
