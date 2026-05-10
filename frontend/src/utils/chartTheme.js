/** Recharts theme tokens for light / dark backgrounds */

export function getRechartsTheme(isDark) {
  return {
    grid: isDark ? '#334155' : '#e5e7eb',
    tickFill: isDark ? '#cbd5e1' : '#4b5563',
    axisLine: isDark ? '#475569' : '#9ca3af',
    tooltipBg: isDark ? 'rgba(15, 23, 42, 0.96)' : '#ffffff',
    tooltipBorder: isDark ? '#475569' : '#e5e7eb',
    tooltipColor: isDark ? '#f1f5f9' : '#111827',
    legendColor: isDark ? '#e2e8f0' : '#374151',
    refLine: isDark ? '#64748b' : '#9ca3af',
    donutStroke: isDark ? '#0f172a' : '#ffffff',
  };
}

/** Scope colours tuned for contrast on dark vs light chart backgrounds */
export function getScopeLineColors(isDark) {
  if (isDark) {
    return {
      scope1: '#34d399',
      scope2: '#60a5fa',
      scope3: '#fb923c',
    };
  }
  return {
    scope1: '#065f46',
    scope2: '#1e40af',
    scope3: '#7c2d12',
  };
}

/** Pie slices + labels read better with slightly brighter hues in dark mode */
export function getScopePieData(isDark, overviewStats) {
  if (!overviewStats) return [];
  if (isDark) {
    return [
      { name: 'Scope 1', value: overviewStats.scope1, color: '#10b981' },
      { name: 'Scope 2', value: overviewStats.scope2, color: '#3b82f6' },
      { name: 'Scope 3', value: overviewStats.scope3, color: '#ea580c' },
    ];
  }
  return [
    { name: 'Scope 1', value: overviewStats.scope1, color: '#065f46' },
    { name: 'Scope 2', value: overviewStats.scope2, color: '#1e40af' },
    { name: 'Scope 3', value: overviewStats.scope3, color: '#7c2d12' },
  ];
}

/** Common Tooltip props for default Recharts tooltips */
export function getChartTooltipProps(rt) {
  return {
    contentStyle: {
      backgroundColor: rt.tooltipBg,
      border: `1px solid ${rt.tooltipBorder}`,
      borderRadius: '8px',
      color: rt.tooltipColor,
      fontSize: '13px',
    },
    wrapperStyle: { outline: 'none' },
    labelStyle: { color: rt.tooltipColor },
    itemStyle: { color: rt.tooltipColor },
  };
}

export function chartAxisProps(rt, extra = {}) {
  return {
    stroke: rt.axisLine,
    tick: { fill: rt.tickFill, fontSize: 11, ...extra.tick },
    ...extra,
  };
}
