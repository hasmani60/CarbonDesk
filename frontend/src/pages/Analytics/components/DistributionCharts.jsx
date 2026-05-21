import { memo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import ChartFrame from '../../../components/charts/ChartFrame';
import { getChartTooltipProps } from '../../../utils/chartTheme';
import { StackedScopeTrendChart } from './ExtendedAnalyticsCharts';

function DistributionCharts({ pieData, scopeMigrationData, rt, isDark }) {

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
        <h3 className="text-lg font-heading font-semibold text-gray-900 dark:text-white mb-1">
          Monthly emissions by scope
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Stacked Scope 1, 2, and 3</p>
        <StackedScopeTrendChart periods={scopeMigrationData} rt={rt} isDark={isDark} />
      </div>
    </div>
  );
}

export default memo(DistributionCharts);
