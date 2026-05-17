import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { Zap } from 'lucide-react';
import ChartTooltip from './ChartTooltip';
import { chartAxisProps } from '../../../utils/chartTheme';

export default function VelocitySection({ velocityData, rt, isDark }) {
  if (!velocityData) return null;

  return (
    <section className="analytics-tab-section">
      <h2 className="analytics-section-title">
        <Zap className="w-6 h-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
        Velocity &amp; acceleration
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="app-card p-5">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Avg velocity</p>
          <p
            className={`text-2xl font-bold ${velocityData.summary.avgVelocity < 0 ? 'text-green-600' : 'text-red-600'}`}
          >
            {velocityData.summary.avgVelocity > 0 ? '+' : ''}
            {velocityData.summary.avgVelocity.toFixed(1)}%
          </p>
        </div>
        <div className="app-card p-5">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Avg acceleration</p>
          <p
            className={`text-2xl font-bold ${velocityData.summary.avgAcceleration < 0 ? 'text-green-600' : 'text-red-600'}`}
          >
            {velocityData.summary.avgAcceleration > 0 ? '+' : ''}
            {velocityData.summary.avgAcceleration.toFixed(2)}
          </p>
        </div>
        <div className="app-card p-5">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Trend</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white capitalize">
            {velocityData.summary.trendDirection}
          </p>
        </div>
        <div className="app-card p-5">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Inflection points</p>
          <p className="text-2xl font-bold text-blue-600">{velocityData.summary.inflectionPoints}</p>
        </div>
      </div>

      <div className="app-card p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Rate of change</h3>
        <div className="h-80 sm:h-96">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={velocityData.periods}>
              <CartesianGrid strokeDasharray="3 3" stroke={rt.grid} />
              <XAxis
                {...chartAxisProps(rt, {
                  dataKey: 'period',
                  angle: -45,
                  textAnchor: 'end',
                  height: 72,
                  tick: { fontSize: 11 }
                })}
              />
              <YAxis yAxisId="left" {...chartAxisProps(rt)} />
              <YAxis yAxisId="right" orientation="right" {...chartAxisProps(rt)} />
              <Tooltip content={<ChartTooltip isDark={isDark} />} />
              <Legend wrapperStyle={{ color: rt.legendColor }} />
              <Bar yAxisId="left" dataKey="velocity" fill={isDark ? '#34d399' : '#10b981'} name="Velocity (%)" />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="acceleration"
                stroke="#ef4444"
                strokeWidth={2}
                name="Acceleration"
              />
              <ReferenceLine yAxisId="left" y={0} stroke={rt.refLine} strokeDasharray="3 3" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
