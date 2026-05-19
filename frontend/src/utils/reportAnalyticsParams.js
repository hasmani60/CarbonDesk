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
