import { memo, useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart
} from 'recharts';
import ChartFrame from '../../../components/charts/ChartFrame';
import ChartTooltip from './ChartTooltip';
import { formatLargeNumber } from '../../../utils/analysisHelpers';
import { chartAxisProps, getChartTooltipProps, getScopeLineColors } from '../../../utils/chartTheme';
import { toWaterfallBars } from './extendedChartUtils';

function EmptyChart({ message = 'No data for the selected period.' }) {
  return (
    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-12">{message}</p>
  );
}

const PIE_COLORS = ['#059669', '#2563eb', '#dc2626', '#7c3aed', '#d97706'];

function ChartCard({ title, subtitle, children, className = '' }) {
  return (
    <div className={`app-card p-6 md:p-8 min-w-0 ${className}`}>
      <h3 className="text-lg font-heading font-semibold text-gray-900 dark:text-white">{title}</h3>
      {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-4">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </div>
  );
}

/** Phase 1 — #2 Stacked monthly emissions by scope */
export const StackedScopeTrendChart = memo(function StackedScopeTrendChart({
  periods,
  rt,
  isDark
}) {
  const scopeColors = getScopeLineColors(isDark);
  if (!periods?.length) return <EmptyChart message="Add emissions with dates to see scope trends." />;

  return (
    <ChartFrame height={320}>
      {(width, height) => (
        <BarChart width={width} height={height} data={periods}>
          <CartesianGrid strokeDasharray="3 3" stroke={rt.grid} />
          <XAxis {...chartAxisProps(rt, { dataKey: 'period', tick: { fontSize: 10 } })} />
          <YAxis {...chartAxisProps(rt)} />
          <Tooltip content={<ChartTooltip isDark={isDark} />} />
          <Legend wrapperStyle={{ color: rt.legendColor }} />
          <Bar dataKey="scope1" stackId="s" fill={scopeColors.scope1} name="Scope 1" isAnimationActive={false} />
          <Bar dataKey="scope2" stackId="s" fill={scopeColors.scope2} name="Scope 2" isAnimationActive={false} />
          <Bar dataKey="scope3" stackId="s" fill={scopeColors.scope3} name="Scope 3" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      )}
    </ChartFrame>
  );
});

/** Phase 2 — #1 Emissions intensity */
export const EmissionsIntensityChart = memo(function EmissionsIntensityChart({
  intensity,
  rt,
  isDark
}) {
  const series = intensity?.series?.filter((r) => r.intensity != null) ?? [];
  if (!intensity?.hasData || !series.length) {
    return (
      <EmptyChart message="Record production volumes under Input → Production to see emissions intensity." />
    );
  }

  return (
    <>
      <ChartFrame height={300}>
        {(width, height) => (
          <ComposedChart width={width} height={height} data={intensity.series}>
            <CartesianGrid strokeDasharray="3 3" stroke={rt.grid} />
            <XAxis {...chartAxisProps(rt, { dataKey: 'period', tick: { fontSize: 10 } })} />
            <YAxis yAxisId="left" {...chartAxisProps(rt)} />
            <YAxis yAxisId="right" orientation="right" {...chartAxisProps(rt)} />
            <Tooltip content={<ChartTooltip isDark={isDark} />} />
            <Legend wrapperStyle={{ color: rt.legendColor }} />
            <Bar yAxisId="left" dataKey="emissions" fill="#10b981" name="Emissions (kg CO₂e)" opacity={0.85} isAnimationActive={false} />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="intensity"
              stroke="#2563eb"
              strokeWidth={2}
              name="Intensity (CO₂e / unit)"
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        )}
      </ChartFrame>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">{intensity.unitNote}</p>
    </>
  );
});

/** Phase 2 — #8 Science-based trajectory */
export const TrajectoryChart = memo(function TrajectoryChart({ trajectory, rt, isDark }) {
  const chartData = useMemo(() => {
    const hist = trajectory?.historical ?? [];
    const t15 = trajectory?.targets?.['1.5C'] ?? [];
    const map = new Map();
    hist.forEach((h) => {
      map.set(h.date, { period: h.date, actual: h.emissions, target15: null, target2: null });
    });
    t15.forEach((t) => {
      const row = map.get(t.date) || { period: t.date, actual: null };
      row.target15 = t.emissions;
      map.set(t.date, row);
    });
    (trajectory?.targets?.['2C'] ?? []).forEach((t) => {
      const row = map.get(t.date) || { period: t.date, actual: null };
      row.target2 = t.emissions;
      map.set(t.date, row);
    });
    return [...map.values()].sort((a, b) => a.period.localeCompare(b.period));
  }, [trajectory]);

  if (!trajectory?.hasData || !chartData.length) {
    return <EmptyChart message="Need at least one month of emissions to plot decarbonisation pathways." />;
  }

  const metrics = trajectory.metrics;

  return (
    <>
      {metrics && (
        <div className="flex flex-wrap gap-3 mb-4">
          <span className="badge bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800">
            Pace: {String(metrics.pace || '—').replace(/_/g, ' ')}
          </span>
          <span
            className={`badge ${metrics.on_track ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}
          >
            {metrics.on_track ? 'On track (1.5°C)' : 'Behind 1.5°C pathway'}
          </span>
        </div>
      )}
      <ChartFrame height={320}>
        {(width, height) => (
          <LineChart width={width} height={height} data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={rt.grid} />
            <XAxis {...chartAxisProps(rt, { dataKey: 'period', tick: { fontSize: 10 } })} />
            <YAxis {...chartAxisProps(rt)} />
            <Tooltip content={<ChartTooltip isDark={isDark} />} />
            <Legend wrapperStyle={{ color: rt.legendColor }} />
            <Line type="monotone" dataKey="actual" stroke="#059669" strokeWidth={2} name="Actual" dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="target15" stroke="#93c5fd" strokeDasharray="6 4" strokeWidth={2} name="1.5°C path" dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="target2" stroke="#cbd5e1" strokeDasharray="4 4" strokeWidth={1.5} name="2°C path" dot={false} isAnimationActive={false} />
          </LineChart>
        )}
      </ChartFrame>
    </>
  );
});

/** Phase 3 — #3 Activity breakdown */
export const ActivityBreakdownChart = memo(function ActivityBreakdownChart({
  chartData,
  rt,
  isDark,
  horizontal = true
}) {
  const data = (chartData ?? []).slice(0, 12);
  if (!data.length) return <EmptyChart message="No activity-level emissions in this period." />;

  return (
    <ChartFrame height={Math.max(280, data.length * 36)}>
      {(width, height) => (
        <BarChart
          width={width}
          height={height}
          data={data}
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={horizontal ? { left: 8, right: 16 } : undefined}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={rt.grid} />
          {horizontal ? (
            <>
              <XAxis type="number" {...chartAxisProps(rt)} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10, fill: rt.tick }} />
            </>
          ) : (
            <>
              <XAxis dataKey="name" {...chartAxisProps(rt, { tick: { fontSize: 9 } })} />
              <YAxis {...chartAxisProps(rt)} />
            </>
          )}
          <Tooltip {...getChartTooltipProps(rt)} />
          <Bar dataKey="value" fill="#059669" name="CO₂e" radius={[0, 4, 4, 0]} isAnimationActive={false} />
        </BarChart>
      )}
    </ChartFrame>
  );
});

/** Phase 3 — #4 & #5 Scope 3 pies */
export const Scope3MiniPies = memo(function Scope3MiniPies({ scope3Split, scope3Transport, rt }) {
  const split = scope3Split?.chartData ?? [];
  const transport = scope3Transport?.chartData ?? [];

  if (!split.length && !transport.length) {
    return <EmptyChart message="No Scope 3 commute, activity, or transport data in this period." />;
  }

  const renderPie = (title, data) => (
    <div className="min-w-0">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{title}</p>
      <ChartFrame height={220}>
        {(width, height) => (
          <PieChart width={width} height={height}>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={72} isAnimationActive={false}>
              {data.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip {...getChartTooltipProps(rt)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        )}
      </ChartFrame>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {split.length > 0 && renderPie('Commute vs activity-based', split)}
      {transport.length > 0 && renderPie('Material transport (Cat. 4 vs 9)', transport)}
    </div>
  );
});

/** Phase 4 — #9 YoY */
export const YoYComparisonChart = memo(function YoYComparisonChart({ yoy, rt, isDark }) {
  if (!yoy?.hasData) {
    return <EmptyChart message="Need emissions across two calendar years for year-over-year comparison." />;
  }

  return (
    <>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        Comparing {yoy.previousYear} vs {yoy.currentYear}
      </p>
      <ChartFrame height={300}>
        {(width, height) => (
          <BarChart width={width} height={height} data={yoy.chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={rt.grid} />
            <XAxis {...chartAxisProps(rt, { dataKey: 'period' })} />
            <YAxis {...chartAxisProps(rt)} />
            <Tooltip content={<ChartTooltip isDark={isDark} />} />
            <Legend wrapperStyle={{ color: rt.legendColor }} />
            <Bar dataKey="previous" fill="#94a3b8" name={`${yoy.previousYear}`} isAnimationActive={false} />
            <Bar dataKey="current" fill="#059669" name={`${yoy.currentYear}`} isAnimationActive={false} />
          </BarChart>
        )}
      </ChartFrame>
    </>
  );
});

/** Phase 4 — #11 Gross vs net */
export const GrossNetOffsetsChart = memo(function GrossNetOffsetsChart({ grossNet, rt, isDark }) {
  if (!grossNet?.hasData) {
    return <EmptyChart message="No gross emissions or offset utilisation for this reporting year." />;
  }

  const rows = grossNet.chartData ?? [];

  return (
    <>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        Reporting year {grossNet.reporting_year} — net: {formatLargeNumber(grossNet.net_emissions)} kg CO₂e
      </p>
      <ChartFrame height={260}>
        {(width, height) => (
          <BarChart width={width} height={height} data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke={rt.grid} />
            <XAxis {...chartAxisProps(rt, { dataKey: 'name' })} />
            <YAxis {...chartAxisProps(rt)} />
            <Tooltip content={<ChartTooltip isDark={isDark} />} />
            <Bar dataKey="value" name="kg CO₂e" isAnimationActive={false}>
              {rows.map((entry, i) => (
                <Cell
                  key={entry.key}
                  fill={entry.key === 'offsets' ? '#2563eb' : entry.key === 'net' ? '#059669' : '#64748b'}
                />
              ))}
            </Bar>
          </BarChart>
        )}
      </ChartFrame>
    </>
  );
});

/** Phase 5 — #6 Location */
export const LocationBreakdownChart = memo(function LocationBreakdownChart({ byLocation, rt, isDark }) {
  const data = byLocation?.chartData ?? [];
  if (!byLocation?.hasData) {
    return <EmptyChart message="Add a location on emission entries to compare sites." />;
  }
  return <ActivityBreakdownChart chartData={data} rt={rt} isDark={isDark} horizontal />;
});

/** Phase 5 — #7 Data quality */
export const DataQualityChart = memo(function DataQualityChart({ byStatus, rt, isDark }) {
  const data = byStatus?.chartData ?? [];
  if (!byStatus?.hasData) {
    return <EmptyChart message="No emission records in this period." />;
  }

  return (
    <ChartFrame height={280}>
      {(width, height) => (
        <BarChart width={width} height={height} data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={rt.grid} />
          <XAxis {...chartAxisProps(rt, { dataKey: 'name' })} />
          <YAxis yAxisId="left" {...chartAxisProps(rt)} />
          <YAxis yAxisId="right" orientation="right" {...chartAxisProps(rt)} />
          <Tooltip content={<ChartTooltip isDark={isDark} />} />
          <Legend wrapperStyle={{ color: rt.legendColor }} />
          <Bar yAxisId="left" dataKey="count" fill="#64748b" name="Entry count" isAnimationActive={false} />
          <Bar yAxisId="right" dataKey="value" fill="#059669" name="CO₂e" isAnimationActive={false} />
        </BarChart>
      )}
    </ChartFrame>
  );
});

/** Phase 5 — #10 Waterfall */
export const EmissionsWaterfallChart = memo(function EmissionsWaterfallChart({ waterfall, rt, isDark }) {
  const bars = useMemo(() => toWaterfallBars(waterfall?.steps), [waterfall?.steps]);

  if (!waterfall?.hasData) {
    return <EmptyChart message="Need at least two months of data to show a period bridge." />;
  }

  return (
    <>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        Change from {waterfall.periodStart} to {waterfall.periodEnd}
      </p>
      <ChartFrame height={300}>
        {(width, height) => (
          <BarChart width={width} height={height} data={bars}>
            <CartesianGrid strokeDasharray="3 3" stroke={rt.grid} />
            <XAxis {...chartAxisProps(rt, { dataKey: 'name', tick: { fontSize: 9 } })} />
            <YAxis {...chartAxisProps(rt)} />
            <Tooltip content={<ChartTooltip isDark={isDark} />} />
            <Bar dataKey="base" stackId="wf" fill="transparent" isAnimationActive={false} />
            <Bar dataKey="bar" stackId="wf" name="CO₂e" isAnimationActive={false}>
              {bars.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        )}
      </ChartFrame>
    </>
  );
});

/** Full phased panel for Overview tab (phases 2–5; phase 1 stacked chart lives in Distribution) */
export default function ExtendedAnalyticsPanel({ extended, rt, isDark }) {
  return (
    <div className="space-y-10">
      <section className="analytics-tab-section">
        <h2 className="analytics-section-title">Performance &amp; targets</h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
          <ChartCard title="Emissions intensity" subtitle="CO₂e per unit of production (monthly)">
            <EmissionsIntensityChart intensity={extended?.intensity} rt={rt} isDark={isDark} />
          </ChartCard>
          <ChartCard title="Decarbonisation trajectory" subtitle="Actual emissions vs 1.5°C and 2°C pathways">
            <TrajectoryChart trajectory={extended?.trajectory} rt={rt} isDark={isDark} />
          </ChartCard>
        </div>
      </section>

      <section className="analytics-tab-section">
        <h2 className="analytics-section-title">Hotspots &amp; Scope 3</h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
          <ChartCard title="Top activities by emissions" subtitle="Across all scopes">
            <ActivityBreakdownChart chartData={extended?.activityBreakdown?.chartData} rt={rt} isDark={isDark} />
          </ChartCard>
          <ChartCard title="Scope 3 composition" subtitle="Commute vs activity; upstream vs downstream transport">
            <Scope3MiniPies
              scope3Split={extended?.scope3Split}
              scope3Transport={extended?.scope3Transport}
              rt={rt}
            />
          </ChartCard>
        </div>
      </section>

      <section className="analytics-tab-section">
        <h2 className="analytics-section-title">Reporting &amp; offsets</h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
          <ChartCard title="Year-over-year comparison" subtitle="Same calendar months across consecutive years">
            <YoYComparisonChart yoy={extended?.yoy} rt={rt} isDark={isDark} />
          </ChartCard>
          <ChartCard title="Gross vs net emissions" subtitle="After offset utilisation for the reporting year">
            <GrossNetOffsetsChart grossNet={extended?.grossNet} rt={rt} isDark={isDark} />
          </ChartCard>
        </div>
      </section>

      <section className="analytics-tab-section">
        <h2 className="analytics-section-title">Sites, data quality &amp; period bridge</h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
          <ChartCard title="Emissions by location" subtitle="Top sites or facilities">
            <LocationBreakdownChart byLocation={extended?.byLocation} rt={rt} isDark={isDark} />
          </ChartCard>
          <ChartCard title="Data quality by status" subtitle="Entry counts and associated CO₂e">
            <DataQualityChart byStatus={extended?.byStatus} rt={rt} isDark={isDark} />
          </ChartCard>
        </div>
        <ChartCard title="Period bridge (waterfall)" subtitle="How emissions changed between the first and last month" className="mt-6 lg:mt-8">
          <EmissionsWaterfallChart waterfall={extended?.waterfall} rt={rt} isDark={isDark} />
        </ChartCard>
      </section>
    </div>
  );
}
