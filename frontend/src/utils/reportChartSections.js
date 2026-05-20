/** Shared structure for AI report chart appendix (overview + per scope). */

export const REPORT_CHART_SECTIONS = [
  {
    key: 'overview',
    title: 'Overview',
    description: 'Organisation-wide emissions distribution, monthly trend, and top categories.'
  },
  {
    key: 'scope1',
    title: 'Scope 1 — Direct emissions',
    description: 'Direct GHG sources: fuels, fleet, refrigerants, and on-site combustion.'
  },
  {
    key: 'scope2',
    title: 'Scope 2 — Energy indirect',
    description: 'Purchased electricity, heat, steam, and cooling.'
  },
  {
    key: 'scope3',
    title: 'Scope 3 — Value chain',
    description: 'Upstream and downstream impacts including travel, freight, and commuting.'
  }
];

export function scopesForReportFilters(reportFilters) {
  const selected = reportFilters?.selectedScopes;
  if (Array.isArray(selected) && selected.length > 0) {
    return [1, 2, 3].filter((s) =>
      selected.some((x) => Number(x) === s || String(x) === String(s))
    );
  }
  return [1, 2, 3];
}

export function groupChartsBySection(chartImages = []) {
  const byKey = {};
  chartImages.forEach((chart) => {
    const key = chart.section || 'overview';
    if (!byKey[key]) byKey[key] = [];
    byKey[key].push(chart);
  });

  return REPORT_CHART_SECTIONS.map((meta) => ({
    ...meta,
    charts: (byKey[meta.key] || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  })).filter((s) => s.charts.length > 0);
}
