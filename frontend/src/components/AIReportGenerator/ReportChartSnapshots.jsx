import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer
} from 'recharts';
import { analyticsAPI } from '../../services/api';
import { formatLargeNumber } from '../../utils/analysisHelpers';
import {
  getScopePieData,
  getRechartsTheme,
  getScopeLineColors,
  chartAxisProps
} from '../../utils/chartTheme';
import { captureChartSnapshot, wait, waitForPaint } from '../../utils/chartCapture';
import { reportFiltersToAnalyticsParams } from '../../utils/reportAnalyticsParams';
import { scopesForReportFilters } from '../../utils/reportChartSections';
import { formatPeriodRange } from '../../utils/formatters';
import { SCOPE_META } from '../../pages/Analytics/scopeMeta';

const CHART_W = 720;
const CHART_H = 320;

const SECTION_BY_SCOPE = {
  1: 'scope1',
  2: 'scope2',
  3: 'scope3'
};

function normalizeOverview(raw) {
  const data = raw?.data ?? raw ?? {};
  let scope1 = data.scope1 ?? 0;
  let scope2 = data.scope2 ?? 0;
  let scope3 = data.scope3 ?? 0;
  const byScope = data.by_scope;
  if (Array.isArray(byScope) && byScope.length) {
    const pick = (n) =>
      byScope.find((s) => s._id === n || s.scope === n || Number(s._id) === n) || {};
    scope1 = pick(1).total ?? pick(1).total_co2e ?? scope1;
    scope2 = pick(2).total ?? pick(2).total_co2e ?? scope2;
    scope3 = pick(3).total ?? pick(3).total_co2e ?? scope3;
  }
  return { scope1, scope2, scope3 };
}

/** Fallback pie totals when overview API shape differs but migration has scope columns. */
function overviewFromPeriodData(periodData) {
  return (periodData || []).reduce(
    (acc, row) => ({
      scope1: acc.scope1 + (Number(row.scope1) || 0),
      scope2: acc.scope2 + (Number(row.scope2) || 0),
      scope3: acc.scope3 + (Number(row.scope3) || 0)
    }),
    { scope1: 0, scope2: 0, scope3: 0 }
  );
}

function mergeOverviewStats(apiOverview, periodRows) {
  const fromApi = normalizeOverview(apiOverview);
  const apiTotal = fromApi.scope1 + fromApi.scope2 + fromApi.scope3;
  if (apiTotal > 0) return fromApi;
  const fromPeriod = overviewFromPeriodData(periodRows);
  const periodTotal = fromPeriod.scope1 + fromPeriod.scope2 + fromPeriod.scope3;
  return periodTotal > 0 ? fromPeriod : fromApi;
}

function normalizePeriodData(raw) {
  const periodData =
    raw?.periodData ?? raw?.data?.periodData ?? (Array.isArray(raw) ? raw : []);
  return Array.isArray(periodData) ? periodData : [];
}

function normalizePareto(raw) {
  let items = Array.isArray(raw)
    ? raw
    : raw?.paretoData ??
      raw?.data?.paretoData ??
      (Array.isArray(raw?.data) ? raw.data : []);
  if (!Array.isArray(items)) items = [];
  return items
    .map((item) => ({
      name: (item.name ?? item._id ?? 'Unknown').toString().slice(0, 28),
      value: Number(item.value ?? item.total_co2e ?? item.emissions ?? 0) || 0
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
}

function monthlyForScope(periodData, scope) {
  return periodData.map((row) => ({
    period: row.period,
    total: Number(row[`scope${scope}`]) || 0
  }));
}

function periodChartTitle(filters) {
  const f = filters || {};
  const range = formatPeriodRange(f.startDate, f.endDate);
  if (range) return range;
  if (f.reportingYear && f.reportingMonth) {
    return `${String(f.reportingMonth).padStart(2, '0')}-${f.reportingYear}`;
  }
  if (f.reportingYear) return String(f.reportingYear);
  return null;
}

function hasMonthlyData(rows) {
  return rows.length > 0 && rows.some((r) => r.total > 0);
}

/** Combine per-scope Pareto rows when the all-scopes request returns nothing. */
function mergeScopeParetoForOverview(scopeParetoMap, scopes) {
  const byName = new Map();
  scopes.forEach((scopeNum) => {
    (scopeParetoMap[scopeNum] || []).forEach((row) => {
      const prev = byName.get(row.name) || { name: row.name, value: 0 };
      prev.value += row.value;
      byName.set(row.name, prev);
    });
  });
  return Array.from(byName.values())
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
}

const ReportChartSnapshots = forwardRef(function ReportChartSnapshots({ filters }, ref) {
  const [loading, setLoading] = useState(true);
  const [overviewStats, setOverviewStats] = useState(null);
  const [periodData, setPeriodData] = useState([]);
  const [paretoData, setParetoData] = useState([]);
  const [scopePareto, setScopePareto] = useState({ 1: [], 2: [], 3: [] });

  const scopeRef = useRef(null);
  const trendRef = useRef(null);
  const paretoRef = useRef(null);
  const scopeTrendRefs = useRef({ 1: null, 2: null, 3: null });
  const scopeParetoRefs = useRef({ 1: null, 2: null, 3: null });

  const analyticsParams = useMemo(
    () => reportFiltersToAnalyticsParams(filters),
    [filters]
  );
  const scopesToRender = useMemo(() => scopesForReportFilters(filters), [filters]);
  const filtersKey = useMemo(
    () => JSON.stringify({ analyticsParams, scopes: scopesToRender }),
    [analyticsParams, scopesToRender]
  );
  const periodLabel = useMemo(() => periodChartTitle(filters), [filters]);
  const periodSuffix = periodLabel ? ` (${periodLabel})` : '';

  const rt = useMemo(() => getRechartsTheme(false), []);
  const scopeLineColors = useMemo(() => getScopeLineColors(false), []);
  const scopePie = useMemo(() => getScopePieData(false, overviewStats), [overviewStats]);
  const hasScopeChart = scopePie.some((d) => d.value > 0);
  const hasTrend =
    periodData.length > 0 &&
    periodData.some(
      (row) => (Number(row.scope1) || 0) + (Number(row.scope2) || 0) + (Number(row.scope3) || 0) > 0
    );
  const hasPareto = paretoData.length > 0;

  const CHART_CAPTURE_OPTS = { width: CHART_W, height: CHART_H };
  const snapshotChartProps = { isAnimationActive: false };

  const scopeMonthly = useMemo(
    () => ({
      1: monthlyForScope(periodData, 1),
      2: monthlyForScope(periodData, 2),
      3: monthlyForScope(periodData, 3)
    }),
    [periodData]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setOverviewStats(null);
        setPeriodData([]);
        setParetoData([]);
        setScopePareto({ 1: [], 2: [], 3: [] });

        const bootstrap = await analyticsAPI.getBootstrap(analyticsParams);

        if (cancelled) return;

        const periods = normalizePeriodData(bootstrap?.scopeMigration?.periodData);
        const nextScopePareto = { 1: [], 2: [], 3: [] };

        const allPareto = normalizePareto(bootstrap?.pareto?.paretoData);
        scopesToRender.forEach((s) => {
          nextScopePareto[s] = allPareto.filter((row) => Number(row.scope) === s);
        });

        let overviewPareto = allPareto;
        if (!overviewPareto.length) {
          overviewPareto = mergeScopeParetoForOverview(nextScopePareto, scopesToRender);
        }

        const overviewRes = bootstrap?.overview ?? bootstrap;

        setPeriodData(periods);
        setOverviewStats(mergeOverviewStats(overviewRes, periods));
        setParetoData(overviewPareto);
        setScopePareto(nextScopePareto);
      } catch (err) {
        console.error('Report chart data load failed', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filtersKey, filters, analyticsParams, scopesToRender]);

  useImperativeHandle(ref, () => ({
    async captureAll() {
      if (loading) await wait(1500);
      await waitForPaint(5);
      window.dispatchEvent(new Event('resize'));

      const images = [];
      let order = 0;

      const snap = async (element) =>
        captureChartSnapshot(element, CHART_CAPTURE_OPTS);

      const push = (chart) => {
        images.push({ ...chart, order: order++ });
      };

      // Scope charts first (they paint reliably); overview last after extra layout time.
      for (const scopeNum of scopesToRender) {
        const section = SECTION_BY_SCOPE[scopeNum];
        const meta = SCOPE_META[scopeNum];
        const monthly = scopeMonthly[scopeNum];
        const pareto = scopePareto[scopeNum] || [];
        const trendEl = scopeTrendRefs.current[scopeNum];
        const paretoEl = scopeParetoRefs.current[scopeNum];

        if (hasMonthlyData(monthly) && trendEl) {
          push({
            id: `scope${scopeNum}-monthly-trend`,
            section,
            sectionTitle: meta.title,
            title: `${meta.title} — monthly trend${periodSuffix}`,
            dataUrl: await snap(trendEl)
          });
        }

        if (pareto.length > 0 && paretoEl) {
          push({
            id: `scope${scopeNum}-category-pareto`,
            section,
            sectionTitle: meta.title,
            title: `${meta.title} — top categories${periodSuffix}`,
            dataUrl: await snap(paretoEl)
          });
        }
      }

      await waitForPaint(4);
      window.dispatchEvent(new Event('resize'));

      if (hasScopeChart && scopeRef.current) {
        push({
          id: 'scope-distribution',
          section: 'overview',
          sectionTitle: 'Overview',
          title: `Emissions distribution by scope${periodSuffix}`,
          dataUrl: await snap(scopeRef.current)
        });
      }

      if (hasTrend && trendRef.current) {
        push({
          id: 'monthly-trend-all-scopes',
          section: 'overview',
          sectionTitle: 'Overview',
          title: `Monthly emissions by scope${periodSuffix}`,
          dataUrl: await snap(trendRef.current)
        });
      }

      if (hasPareto && paretoRef.current) {
        push({
          id: 'category-pareto-all',
          section: 'overview',
          sectionTitle: 'Overview',
          title: `Top emission categories — all scopes${periodSuffix}`,
          dataUrl: await snap(paretoRef.current)
        });
      }

      return images;
    },
    isReady: () => {
      if (loading) return false;
      const scopeHasData = scopesToRender.some(
        (s) => hasMonthlyData(scopeMonthly[s]) || (scopePareto[s]?.length ?? 0) > 0
      );
      return hasScopeChart || hasTrend || hasPareto || scopeHasData;
    }
  }));

  const showHost =
    loading || hasScopeChart || hasTrend || hasPareto || scopesToRender.length > 0;

  if (!showHost) {
    return <div className="report-chart-capture-host" data-loading="true" />;
  }

  return (
    <div
      className="report-chart-capture-host bg-white text-gray-900"
      style={{ width: CHART_W }}
      aria-hidden
    >
      {hasScopeChart && (
        <div ref={scopeRef} style={{ width: CHART_W, height: CHART_H }} className="mb-4">
          <p className="text-sm font-semibold mb-2 px-1">Distribution by scope</p>
          <ResponsiveContainer width="100%" height={CHART_H - 28}>
            <PieChart>
              <Pie
                data={scopePie}
                dataKey="value"
                cx="50%"
                cy="50%"
                outerRadius={100}
                isAnimationActive={snapshotChartProps.isAnimationActive}
                label={({ name, value }) => `${name}: ${formatLargeNumber(value)}`}
              >
                {scopePie.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {hasTrend && (
        <div ref={trendRef} style={{ width: CHART_W, height: CHART_H }} className="mb-4">
          <p className="text-sm font-semibold mb-2 px-1">Monthly emissions by scope</p>
          <ResponsiveContainer width="100%" height={CHART_H - 28}>
            <LineChart data={periodData}>
              <CartesianGrid strokeDasharray="3 3" stroke={rt.grid} />
              <XAxis {...chartAxisProps(rt, { dataKey: 'period', tick: { fontSize: 10 } })} />
              <YAxis {...chartAxisProps(rt, { tick: { fontSize: 10 } })} />
              <Line
                type="monotone"
                dataKey="scope1"
                stroke={scopeLineColors.scope1}
                strokeWidth={2}
                dot={false}
                isAnimationActive={snapshotChartProps.isAnimationActive}
                name="Scope 1"
              />
              <Line
                type="monotone"
                dataKey="scope2"
                stroke={scopeLineColors.scope2}
                strokeWidth={2}
                dot={false}
                isAnimationActive={snapshotChartProps.isAnimationActive}
                name="Scope 2"
              />
              <Line
                type="monotone"
                dataKey="scope3"
                stroke={scopeLineColors.scope3}
                strokeWidth={2}
                dot={false}
                isAnimationActive={snapshotChartProps.isAnimationActive}
                name="Scope 3"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {hasPareto && (
        <div ref={paretoRef} style={{ width: CHART_W, height: CHART_H }} className="mb-4">
          <p className="text-sm font-semibold mb-2 px-1">Top categories — all scopes</p>
          <ResponsiveContainer width="100%" height={CHART_H - 28}>
            <BarChart data={paretoData} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={rt.grid} />
              <XAxis type="number" {...chartAxisProps(rt, { tick: { fontSize: 10 } })} />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                {...chartAxisProps(rt, { tick: { fontSize: 9 } })}
              />
              <Bar
                dataKey="value"
                fill="#047857"
                radius={[0, 4, 4, 0]}
                isAnimationActive={snapshotChartProps.isAnimationActive}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {scopesToRender.map((scopeNum) => {
        const meta = SCOPE_META[scopeNum];
        const monthly = scopeMonthly[scopeNum];
        const pareto = scopePareto[scopeNum] || [];
        const showTrend = hasMonthlyData(monthly);
        const showPareto = pareto.length > 0;
        if (!showTrend && !showPareto) return null;

        return (
          <div key={scopeNum} className="scope-chart-group mb-2">
            {showTrend && (
              <div
                ref={(el) => {
                  scopeTrendRefs.current[scopeNum] = el;
                }}
                style={{ width: CHART_W, height: CHART_H }}
                className="mb-4"
              >
                <p className="text-sm font-semibold mb-2 px-1">{meta.title} — monthly</p>
                <ResponsiveContainer width="100%" height={CHART_H - 28}>
                  <LineChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke={rt.grid} />
                    <XAxis
                      {...chartAxisProps(rt, { dataKey: 'period', tick: { fontSize: 10 } })}
                    />
                    <YAxis {...chartAxisProps(rt, { tick: { fontSize: 10 } })} />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke={meta.chart}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={snapshotChartProps.isAnimationActive}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {showPareto && (
              <div
                ref={(el) => {
                  scopeParetoRefs.current[scopeNum] = el;
                }}
                style={{ width: CHART_W, height: CHART_H }}
                className="mb-4"
              >
                <p className="text-sm font-semibold mb-2 px-1">{meta.title} — top categories</p>
                <ResponsiveContainer width="100%" height={CHART_H - 28}>
                  <BarChart data={pareto} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={rt.grid} />
                    <XAxis type="number" {...chartAxisProps(rt, { tick: { fontSize: 10 } })} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                      {...chartAxisProps(rt, { tick: { fontSize: 9 } })}
                    />
                    <Bar
                      dataKey="value"
                      fill={meta.chart}
                      radius={[0, 4, 4, 0]}
                      isAnimationActive={snapshotChartProps.isAnimationActive}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

export default ReportChartSnapshots;
