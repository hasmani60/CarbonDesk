import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Activity, AlertTriangle } from 'lucide-react';
import ChartFrame from '../../../components/charts/ChartFrame';
import ChartTooltip from './ChartTooltip';
import ExpandableAnalyticsPanel from './ExpandableAnalyticsPanel';
import { chartAxisProps, getScopeLineColors } from '../../../utils/chartTheme';

export default function ScopeMigrationSection({
  scopeMigrationData,
  migrationInsights,
  rt,
  isDark,
  highlightScope = null
}) {
  if (!scopeMigrationData?.length) return null;

  const scopeLineColors = getScopeLineColors(isDark);
  const burdenShift = migrationInsights?.burdenShifting;
  const title = highlightScope ? `Scope ${highlightScope} trend` : 'Emissions by scope over time';

  const chart = (height) => (
    <ChartFrame height={height}>
      {(width, h) => (
        <LineChart width={width} height={h} data={scopeMigrationData}>
          <CartesianGrid strokeDasharray="3 3" stroke={rt.grid} />
          <XAxis
            {...chartAxisProps(rt, {
              dataKey: 'period',
              angle: -35,
              textAnchor: 'end',
              height: 72,
              tick: { fontSize: 10 }
            })}
          />
          <YAxis {...chartAxisProps(rt)} />
          <Tooltip content={<ChartTooltip isDark={isDark} />} />
          <Legend wrapperStyle={{ color: rt.legendColor }} />
          {(!highlightScope || highlightScope === 1) && (
            <Line type="monotone" dataKey="scope1" stroke={scopeLineColors.scope1} strokeWidth={2} name="Scope 1" dot={false} isAnimationActive={false} />
          )}
          {(!highlightScope || highlightScope === 2) && (
            <Line type="monotone" dataKey="scope2" stroke={scopeLineColors.scope2} strokeWidth={2} name="Scope 2" dot={false} isAnimationActive={false} />
          )}
          {(!highlightScope || highlightScope === 3) && (
            <Line type="monotone" dataKey="scope3" stroke={scopeLineColors.scope3} strokeWidth={2} name="Scope 3" dot={false} isAnimationActive={false} />
          )}
          {!highlightScope && (
            <Line type="monotone" dataKey="total" stroke={isDark ? '#94a3b8' : '#64748b'} strokeWidth={2} name="Total" dot={false} isAnimationActive={false} />
          )}
        </LineChart>
      )}
    </ChartFrame>
  );

  return (
    <section className="analytics-tab-section">
      <h2 className="analytics-section-title">
        <Activity className="w-6 h-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
        {title}
      </h2>

      {burdenShift?.detected && !highlightScope && (
        <div className="bg-yellow-50 dark:bg-yellow-950/35 border border-yellow-200 dark:border-yellow-900/80 rounded-xl p-5 mb-6">
          <div className="flex gap-3">
            <AlertTriangle className="w-6 h-6 text-yellow-600 shrink-0" />
            <div>
              <p className="font-semibold text-yellow-900 dark:text-yellow-100">Burden shifting detected</p>
              <p className="text-yellow-800 dark:text-yellow-200 text-sm mt-1">{burdenShift.message}</p>
            </div>
          </div>
        </div>
      )}

      <ExpandableAnalyticsPanel
        title={title}
        className="app-card p-6 min-w-0"
        content={({ expanded }) => chart(expanded ? 520 : 400)}
      />
    </section>
  );
}
