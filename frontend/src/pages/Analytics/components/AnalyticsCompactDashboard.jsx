import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { AlertTriangle, Plus } from 'lucide-react';
import ChartFrame from '../../../components/charts/ChartFrame';
import CompactKpiCell from './CompactKpiCell';
import CompactParetoTable from './CompactParetoTable';
import {
  StackedScopeTrendChart,
  EmissionsIntensityChart,
  TrajectoryChart,
  ActivityBreakdownChart,
  Scope3MiniPies,
  YoYComparisonChart,
  GrossNetOffsetsChart,
  LocationBreakdownChart,
  DataQualityChart,
  EmissionsWaterfallChart
} from './ExtendedAnalyticsCharts';
import { formatLargeNumber } from '../../../utils/analysisHelpers';
import { getChartTooltipProps, getScopePieData } from '../../../utils/chartTheme';

function ReportCell({ label, children, className = '', span = '' }) {
  return (
    <div className={`analytics-report-cell ${span} ${className}`}>
      {label && <p className="analytics-cell-label">{label}</p>}
      <div className="analytics-cell-body min-h-0 flex-1 flex flex-col">{children}</div>
    </div>
  );
}

function sparkFromPeriods(periods, key = 'total') {
  return (periods ?? []).map((p) => ({ v: p[key] ?? 0 }));
}

function periodDelta(periods) {
  if (!periods || periods.length < 2) return null;
  const cur = periods[periods.length - 1].total || 0;
  const prev = periods[periods.length - 2].total || 0;
  if (!prev) return null;
  const pct = ((cur - prev) / prev) * 100;
  return {
    text: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`,
    up: pct < 0
  };
}

function ScopeMixPie({ pieData, rt, height = 130 }) {
  if (!pieData?.length) return <p className="analytics-empty">No scope data</p>;
  return (
    <ChartFrame height={height}>
      {(width, h) => (
        <PieChart width={width} height={h}>
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={28}
            outerRadius={48}
            isAnimationActive={false}
          >
            {pieData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip {...getChartTooltipProps(rt)} />
          <Legend wrapperStyle={{ fontSize: 10 }} />
        </PieChart>
      )}
    </ChartFrame>
  );
}

export default function AnalyticsCompactDashboard({
  stats,
  scopeMigrationData,
  migrationInsights,
  paretoData,
  paretoInsights,
  selectedParent,
  onDrillDown,
  onResetDrillDown,
  extended,
  velocityData,
  maccData,
  maccOpportunities,
  onAddMacc,
  rt,
  isDark
}) {
  const pieData = useMemo(() => getScopePieData(isDark, stats), [isDark, stats]);
  const totalSpark = useMemo(() => sparkFromPeriods(scopeMigrationData), [scopeMigrationData]);
  const mom = useMemo(() => periodDelta(scopeMigrationData), [scopeMigrationData]);
  const burden = migrationInsights?.burdenShifting;

  const paretoTop = useMemo(() => {
    const rows = paretoData ?? [];
    return rows.slice(0, 6).map((r) => ({
      name: r.name,
      value: r.value
    }));
  }, [paretoData]);

  return (
    <div className="analytics-report">
      <div className="analytics-report-band">Emissions overview</div>
      <div className="analytics-report-body">
        {burden?.detected && (
          <div className="analytics-report-alert">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{burden.message}</span>
          </div>
        )}

        {/* Row 1: Total KPI + stacked trend */}
        <div className="analytics-report-grid">
          <div className="col-span-12 lg:col-span-3">
            <CompactKpiCell
              label="Total emissions"
              value={stats.totalEmissions}
              foot={`${stats.totalEntries} entries`}
              sparkData={totalSpark}
              sparkColor="#059669"
              compare={mom ? [{ label: 'vs prior month', text: mom.text, up: mom.up }] : []}
            />
          </div>
          <ReportCell label="Emissions trend by scope" span="col-span-12 lg:col-span-9">
            <StackedScopeTrendChart
              periods={scopeMigrationData}
              rt={rt}
              isDark={isDark}
              height={188}
            />
          </ReportCell>
        </div>

        {/* Row 2: Scope KPIs + scope mix */}
        <div className="analytics-report-grid">
          <div className="col-span-6 sm:col-span-3 lg:col-span-3">
            <CompactKpiCell
              label="Scope 1"
              value={stats.scope1}
              foot={`${stats.scope1Count} entries`}
              sparkData={sparkFromPeriods(scopeMigrationData, 'scope1')}
              sparkColor={isDark ? '#34d399' : '#065f46'}
              to="/analytics/scope-1"
            />
          </div>
          <div className="col-span-6 sm:col-span-3 lg:col-span-3">
            <CompactKpiCell
              label="Scope 2"
              value={stats.scope2}
              foot={`${stats.scope2Count} entries`}
              sparkData={sparkFromPeriods(scopeMigrationData, 'scope2')}
              sparkColor={isDark ? '#60a5fa' : '#1e40af'}
              to="/analytics/scope-2"
            />
          </div>
          <div className="col-span-6 sm:col-span-3 lg:col-span-3">
            <CompactKpiCell
              label="Scope 3"
              value={stats.scope3}
              foot={`${stats.scope3Count} entries`}
              sparkData={sparkFromPeriods(scopeMigrationData, 'scope3')}
              sparkColor={isDark ? '#fb923c' : '#c2410c'}
              to="/analytics/scope-3"
            />
          </div>
          <ReportCell label="Scope mix" span="col-span-6 sm:col-span-3 lg:col-span-3">
            <ScopeMixPie pieData={pieData} rt={rt} />
          </ReportCell>
        </div>

        {/* Row 3: Top categories chart + table */}
        <div className="analytics-report-grid">
          <ReportCell label="Top emission categories" span="col-span-12 lg:col-span-5">
            <ActivityBreakdownChart
              chartData={paretoTop}
              rt={rt}
              isDark={isDark}
              height={200}
              maxItems={6}
            />
            {paretoInsights?.summary && (
              <p className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-1 line-clamp-2">
                {paretoInsights.summary}
              </p>
            )}
          </ReportCell>
          <ReportCell label="Category breakdown" span="col-span-12 lg:col-span-7">
            <CompactParetoTable
              data={paretoData}
              onDrillDown={onDrillDown}
              selectedParent={selectedParent}
              onResetDrillDown={onResetDrillDown}
            />
          </ReportCell>
        </div>

        {/* Row 4: Intensity + trajectory */}
        <div className="analytics-report-grid">
          <ReportCell label="Emissions intensity" span="col-span-12 lg:col-span-6">
            <EmissionsIntensityChart
              intensity={extended?.intensity}
              rt={rt}
              isDark={isDark}
              height={188}
              showNote
            />
          </ReportCell>
          <ReportCell label="Decarbonisation trajectory" span="col-span-12 lg:col-span-6">
            <TrajectoryChart
              trajectory={extended?.trajectory}
              rt={rt}
              isDark={isDark}
              height={188}
              compact
            />
          </ReportCell>
        </div>

        {/* Row 5: YoY + gross/net */}
        <div className="analytics-report-grid">
          <ReportCell label="Year-over-year" span="col-span-12 lg:col-span-6">
            <YoYComparisonChart yoy={extended?.yoy} rt={rt} isDark={isDark} height={188} compact />
          </ReportCell>
          <ReportCell label="Gross vs net (offsets)" span="col-span-12 lg:col-span-6">
            <GrossNetOffsetsChart grossNet={extended?.grossNet} rt={rt} isDark={isDark} height={188} compact />
          </ReportCell>
        </div>

        {/* Row 6: Activities + Scope 3 */}
        <div className="analytics-report-grid">
          <ReportCell label="Top activities" span="col-span-12 lg:col-span-6">
            <ActivityBreakdownChart
              chartData={extended?.activityBreakdown?.chartData}
              rt={rt}
              isDark={isDark}
              height={200}
              maxItems={8}
            />
          </ReportCell>
          <ReportCell label="Scope 3 — commute &amp; transport" span="col-span-12 lg:col-span-6">
            <Scope3MiniPies
              scope3Split={extended?.scope3Split}
              scope3Transport={extended?.scope3Transport}
              rt={rt}
              pieHeight={120}
            />
          </ReportCell>
        </div>

        {/* Row 7: Location + data quality */}
        <div className="analytics-report-grid">
          <ReportCell label="Emissions by location" span="col-span-12 lg:col-span-6">
            <LocationBreakdownChart
              byLocation={extended?.byLocation}
              rt={rt}
              isDark={isDark}
              height={200}
            />
          </ReportCell>
          <ReportCell label="Data quality by status" span="col-span-12 lg:col-span-6">
            <DataQualityChart byStatus={extended?.byStatus} rt={rt} isDark={isDark} height={188} />
          </ReportCell>
        </div>

        {/* Row 8: Waterfall + velocity */}
        <div className="analytics-report-grid">
          <ReportCell label="Period bridge" span="col-span-12 lg:col-span-6">
            <EmissionsWaterfallChart
              waterfall={extended?.waterfall}
              rt={rt}
              isDark={isDark}
              height={188}
              compact
            />
          </ReportCell>
          <ReportCell label="Velocity &amp; acceleration" span="col-span-12 lg:col-span-6">
            {velocityData?.periods?.length ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                <div>
                  <p className="text-[10px] text-zinc-500">Avg velocity</p>
                  <p
                    className={`text-sm font-bold tabular-nums ${
                      velocityData.summary.avgVelocity < 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    {velocityData.summary.avgVelocity > 0 ? '+' : ''}
                    {velocityData.summary.avgVelocity.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500">Trend</p>
                  <p className="text-sm font-semibold capitalize">{velocityData.summary.trendDirection}</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500">Projected</p>
                  <p className="text-sm font-bold tabular-nums">
                    {formatLargeNumber(velocityData.summary.projectedNextMonth)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500">Inflections</p>
                  <p className="text-sm font-bold">{velocityData.summary.inflectionPoints ?? 0}</p>
                </div>
              </div>
            ) : (
              <p className="analytics-empty">Need multiple months for velocity.</p>
            )}
          </ReportCell>
        </div>

        {/* Row 9: MACC */}
        <div className="analytics-report-grid">
          <ReportCell label="Marginal abatement (MACC)" span="col-span-12">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              {maccData && maccOpportunities?.length > 0 ? (
                <div className="flex flex-wrap gap-4 text-xs">
                  <span>
                    <strong className="text-zinc-900 dark:text-zinc-100">
                      {formatLargeNumber(maccData.totalAbatementPotential)}
                    </strong>{' '}
                    t abatement
                  </span>
                  <span>
                    <strong>{maccOpportunities.length}</strong> opportunities
                  </span>
                  <span>
                    High priority: <strong>{maccData.highPriorityCount ?? 0}</strong>
                  </span>
                </div>
              ) : (
                <p className="text-xs text-zinc-500">Add reduction opportunities to build your MACC.</p>
              )}
              <button type="button" onClick={onAddMacc} className="btn-primary text-xs py-1.5 px-3">
                <Plus className="w-3.5 h-3.5" />
                Add opportunity
              </button>
            </div>
            {maccOpportunities?.length > 0 && (
              <div className="analytics-compact-table-wrap max-h-32 overflow-auto">
                <table className="analytics-compact-table w-full">
                  <thead>
                    <tr>
                      <th>Opportunity</th>
                      <th className="text-right">$/tCO₂e</th>
                      <th className="text-right">Potential</th>
                    </tr>
                  </thead>
                  <tbody>
                    {maccOpportunities.slice(0, 5).map((o) => (
                      <tr key={o._id || o.id || o.name}>
                        <td className="truncate max-w-[200px]">{o.name}</td>
                        <td className="text-right tabular-nums">${Number(o.costPerTon).toFixed(0)}</td>
                        <td className="text-right tabular-nums">{formatLargeNumber(o.abatementPotential)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ReportCell>
        </div>
      </div>

      <p className="text-[10px] text-zinc-400 mt-2 text-right">
        Drill into{' '}
        <Link to="/analytics/scope-1" className="text-emerald-600 hover:underline">
          Scope 1
        </Link>
        ,{' '}
        <Link to="/analytics/scope-2" className="text-emerald-600 hover:underline">
          Scope 2
        </Link>
        , or{' '}
        <Link to="/analytics/scope-3" className="text-emerald-600 hover:underline">
          Scope 3
        </Link>{' '}
        for detailed views.
      </p>
    </div>
  );
}
