import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Target, ChevronDown, ChevronUp } from 'lucide-react';
import { formatLargeNumber } from '../../../utils/analysisHelpers';
import { getChartTooltipProps, chartAxisProps } from '../../../utils/chartTheme';

const paretoThreshold = 80;

export default function ParetoSection({
  title = 'Hotspot Analysis (Pareto 80/20)',
  paretoData,
  paretoInsights,
  selectedParent,
  onDrillDown,
  onResetDrillDown,
  rt,
  isDark
}) {
  if (!paretoData?.length) {
    return (
      <section className="analytics-tab-section">
        <h2 className="analytics-section-title">
          <Target className="w-6 h-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
          {title}
        </h2>
        <div className="app-card p-8 text-center text-gray-500 dark:text-gray-400">
          No category data for this view yet. Add emissions entries to see hotspots.
        </div>
      </section>
    );
  }

  return (
    <section className="analytics-tab-section">
      <h2 className="analytics-section-title">
        <Target className="w-6 h-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
        {title}
      </h2>

      {selectedParent && (
        <div className="flex items-center space-x-2 text-sm mb-4">
          <button
            type="button"
            onClick={onResetDrillDown}
            className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-medium"
          >
            All Sources
          </button>
          <span className="text-gray-400">›</span>
          <span className="text-gray-900 dark:text-white font-medium">{selectedParent}</span>
        </div>
      )}

      {paretoInsights && (
        <div className="bg-emerald-50 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-800/70 rounded-xl p-5 mb-6">
          <p className="font-semibold text-emerald-900 dark:text-emerald-300">80/20 insight</p>
          <p className="text-emerald-800 dark:text-emerald-300 mt-1 text-sm">{paretoInsights.summary}</p>
          <p className="text-emerald-700 dark:text-emerald-400 mt-2 text-sm">
            <strong>Risk:</strong> {paretoInsights.risk}
          </p>
        </div>
      )}

      <div className="app-card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {selectedParent ? `${selectedParent} breakdown` : 'Emission hotspots'}
          </h3>
          {selectedParent && (
            <button
              type="button"
              onClick={onResetDrillDown}
              className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium"
            >
              <ChevronUp className="w-4 h-4" />
              Back
            </button>
          )}
        </div>
        <div className="h-80 sm:h-96">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={paretoData}>
              <CartesianGrid strokeDasharray="3 3" stroke={rt.grid} />
              <XAxis
                {...chartAxisProps(rt, {
                  dataKey: 'name',
                  angle: -40,
                  textAnchor: 'end',
                  height: 100,
                  interval: 0,
                  tick: { fontSize: 11 }
                })}
              />
              <YAxis yAxisId="left" orientation="left" {...chartAxisProps(rt)} />
              <YAxis yAxisId="right" orientation="right" {...chartAxisProps(rt)} />
              <Tooltip {...getChartTooltipProps(rt)} />
              <Legend wrapperStyle={{ color: rt.legendColor }} />
              <Bar
                yAxisId="left"
                dataKey="value"
                fill="#10b981"
                name="Emissions"
                onClick={(data) => onDrillDown(data)}
                cursor={!selectedParent ? 'pointer' : 'default'}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cumulative"
                stroke="#ef4444"
                strokeWidth={2}
                name="Cumulative %"
                dot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {!selectedParent && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 text-center">
            Click a bar to drill into sub-categories
          </p>
        )}
      </div>

      <div className="app-card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/80">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Category breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-800/90 border-b border-gray-200 dark:border-slate-700">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Source</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Emissions</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">%</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Cumulative</th>
                {!selectedParent && (
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Action</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
              {paretoData.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{item.name}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {formatLargeNumber(item.value)} CO₂e
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {item.percentage?.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3">
                    {item.cumulative?.toFixed(1)}%
                    {item.cumulative <= paretoThreshold && (
                      <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300 rounded">
                        Top {paretoThreshold}%
                      </span>
                    )}
                  </td>
                  {!selectedParent && (
                    <td className="px-4 py-3">
                      {item.canDrill ? (
                        <button
                          type="button"
                          onClick={() => onDrillDown(item)}
                          className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium"
                        >
                          Drill down
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
