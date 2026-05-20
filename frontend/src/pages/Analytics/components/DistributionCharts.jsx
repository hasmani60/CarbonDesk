import { memo, useMemo } from 'react';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import ChartFrame from '../../../components/charts/ChartFrame';
import ChartTooltip from './ChartTooltip';
import { formatLargeNumber } from '../../../utils/analysisHelpers';
import { getChartTooltipProps, chartAxisProps } from '../../../utils/chartTheme';

function DistributionCharts({ pieData, scopeMigrationData, rt, isDark }) {
  const lineData = useMemo(() => scopeMigrationData ?? [], [scopeMigrationData]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
      <div className="app-card p-6 md:p-8 min-w-0">
        <h3 className="text-lg font-heading font-semibold text-gray-900 dark:text-white mb-4">By scope</h3>
        <ChartFrame height={300}>
          {(width, height) => (
            <PieChart width={width} height={height}>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={Math.min(width, height) * 0.32}
                dataKey="value"
                isAnimationActive={false}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip {...getChartTooltipProps(rt)} />
              <Legend wrapperStyle={{ color: rt.legendColor }} />
            </PieChart>
          )}
        </ChartFrame>
      </div>
      <div className="app-card p-6 md:p-8 min-w-0">
        <h3 className="text-lg font-heading font-semibold text-gray-900 dark:text-white mb-4">Monthly total</h3>
        <ChartFrame height={300}>
          {(width, height) => (
            <LineChart width={width} height={height} data={lineData}>
              <CartesianGrid strokeDasharray="3 3" stroke={rt.grid} />
              <XAxis {...chartAxisProps(rt, { dataKey: 'period', tick: { fontSize: 10 } })} />
              <YAxis {...chartAxisProps(rt)} />
              <Tooltip content={<ChartTooltip isDark={isDark} />} />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#10b981"
                strokeWidth={2}
                name="Total"
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          )}
        </ChartFrame>
      </div>
    </div>
  );
}

export default memo(DistributionCharts);
