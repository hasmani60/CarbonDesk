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
import { getScopePieData, getRechartsTheme, chartAxisProps } from '../../utils/chartTheme';
import { captureElementAsPng, wait } from '../../utils/chartCapture';
import { reportFiltersToAnalyticsParams } from '../../utils/reportAnalyticsParams';
import { formatPeriodRange } from '../../utils/formatters';

const CHART_W = 720;
const CHART_H = 320;

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

function normalizePeriodData(raw) {
  const periodData =
    raw?.periodData ?? raw?.data?.periodData ?? (Array.isArray(raw) ? raw : []);
  return Array.isArray(periodData) ? periodData : [];
}

function normalizePareto(raw) {
  let items = Array.isArray(raw)
    ? raw
    : raw?.paretoData ?? raw?.data?.paretoData ?? (Array.isArray(raw?.data) ? raw.data : []);
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

const ReportChartSnapshots = forwardRef(function ReportChartSnapshots({ filters }, ref) {
  const [loading, setLoading] = useState(true);
  const [overviewStats, setOverviewStats] = useState(null);
  const [periodData, setPeriodData] = useState([]);
  const [paretoData, setParetoData] = useState([]);

  const scopeRef = useRef(null);
  const trendRef = useRef(null);
  const paretoRef = useRef(null);

  const analyticsParams = useMemo(
    () => reportFiltersToAnalyticsParams(filters),
    [filters]
  );
  const filtersKey = useMemo(() => JSON.stringify(analyticsParams), [analyticsParams]);
  const periodLabel = useMemo(() => periodChartTitle(filters), [filters]);
  const periodSuffix = periodLabel ? ` (${periodLabel})` : '';

  const rt = useMemo(() => getRechartsTheme(false), []);
  const scopePie = useMemo(() => getScopePieData(false, overviewStats), [overviewStats]);
  const hasScopeChart = scopePie.some((d) => d.value > 0);
  const hasTrend = periodData.length > 0;
  const hasPareto = paretoData.length > 0;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setOverviewStats(null);
        setPeriodData([]);
        setParetoData([]);
        const [overviewRes, migrationRes, paretoRes] = await Promise.all([
          analyticsAPI.getOverview(analyticsParams),
          analyticsAPI.getScopeMigration(analyticsParams),
          analyticsAPI.getPareto(analyticsParams)
        ]);
        if (cancelled) return;
        setOverviewStats(normalizeOverview(overviewRes));
        setPeriodData(normalizePeriodData(migrationRes));
        setParetoData(normalizePareto(paretoRes));
      } catch (err) {
        console.error('Report chart data load failed', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filtersKey]);

  useImperativeHandle(ref, () => ({
    async captureAll() {
      if (loading) await wait(1500);
      await wait(400);

      const images = [];

      if (hasScopeChart && scopeRef.current) {
        images.push({
          id: 'scope-distribution',
          title: `Emissions distribution by scope${periodSuffix}`,
          dataUrl: await captureElementAsPng(scopeRef.current, {
            width: CHART_W,
            height: CHART_H
          })
        });
      }

      if (hasTrend && trendRef.current) {
        images.push({
          id: 'monthly-trend',
          title: `Monthly emissions trend${periodSuffix}`,
          dataUrl: await captureElementAsPng(trendRef.current, {
            width: CHART_W,
            height: CHART_H
          })
        });
      }

      if (hasPareto && paretoRef.current) {
        images.push({
          id: 'category-pareto',
          title: `Top emission categories (Pareto)${periodSuffix}`,
          dataUrl: await captureElementAsPng(paretoRef.current, {
            width: CHART_W,
            height: CHART_H
          })
        });
      }

      return images;
    },
    isReady: () => !loading && (hasScopeChart || hasTrend || hasPareto)
  }));

  if (loading && !hasScopeChart && !hasTrend && !hasPareto) {
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
          <p className="text-sm font-semibold mb-2 px-1">Monthly emissions trend</p>
          <ResponsiveContainer width="100%" height={CHART_H - 28}>
            <LineChart data={periodData}>
              <CartesianGrid strokeDasharray="3 3" stroke={rt.grid} />
              <XAxis {...chartAxisProps(rt, { dataKey: 'period', tick: { fontSize: 10 } })} />
              <YAxis {...chartAxisProps(rt, { tick: { fontSize: 10 } })} />
              <Line type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {hasPareto && (
        <div ref={paretoRef} style={{ width: CHART_W, height: CHART_H }}>
          <p className="text-sm font-semibold mb-2 px-1">Top categories by emissions</p>
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
              <Bar dataKey="value" fill="#047857" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
});

export default ReportChartSnapshots;
