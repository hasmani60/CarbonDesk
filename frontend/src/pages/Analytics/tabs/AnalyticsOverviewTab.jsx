import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
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
  ResponsiveContainer
} from 'recharts';
import { TrendingUp, Database, ArrowRight } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { useAnalytics } from '../AnalyticsContext';
import { formatLargeNumber } from '../../../utils/analysisHelpers';
import {
  getRechartsTheme,
  getScopePieData,
  getChartTooltipProps,
  chartAxisProps
} from '../../../utils/chartTheme';
import ChartTooltip from '../components/ChartTooltip';
import ScopeMigrationSection from '../components/ScopeMigrationSection';
import VelocitySection from '../components/VelocitySection';
import MACCSection from '../components/MACCSection';
import MACCModal from '../components/MACCModal';
import ParetoSection from '../components/ParetoSection';

export default function AnalyticsOverviewTab() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const rt = useMemo(() => getRechartsTheme(isDark), [isDark]);

  const {
    overviewStats: stats,
    scopeMigrationData,
    migrationInsights,
    paretoData,
    paretoInsights,
    selectedParent,
    velocityData,
    maccData,
    maccOpportunities,
    showMaccModal,
    setShowMaccModal,
    handleDrillDown,
    resetDrillDown,
    handleSaveMaccOpportunity
  } = useAnalytics();

  const pieData = useMemo(() => getScopePieData(isDark, stats), [isDark, stats]);

  return (
    <div className="analytics-tab-panel">
      <section className="analytics-tab-section">
        <h2 className="analytics-section-title">
          <TrendingUp className="w-6 h-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
          Summary
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="app-card app-card-interactive p-5">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total emissions</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
              {formatLargeNumber(stats.totalEmissions)}
            </p>
            <p className="text-xs text-gray-500 mt-2">{stats.totalEntries} entries</p>
          </div>
          {[
            { n: 1, val: stats.scope1, count: stats.scope1Count, to: '/analytics/scope-1' },
            { n: 2, val: stats.scope2, count: stats.scope2Count, to: '/analytics/scope-2' },
            { n: 3, val: stats.scope3, count: stats.scope3Count, to: '/analytics/scope-3' }
          ].map(({ n, val, count, to }) => (
            <Link key={n} to={to} className="app-card app-card-interactive p-5 group block">
              <p className="text-sm text-gray-500 dark:text-gray-400">Scope {n}</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{formatLargeNumber(val)}</p>
              <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                {count} entries
                <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="analytics-tab-section">
        <h2 className="analytics-section-title">
          <Database className="w-6 h-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
          Distribution &amp; trend
        </h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="app-card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">By scope</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine
                    label={(e) => `${e.name}: ${formatLargeNumber(e.value)}`}
                    outerRadius={100}
                    dataKey="value"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip {...getChartTooltipProps(rt)} />
                  <Legend wrapperStyle={{ color: rt.legendColor }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="app-card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Monthly total</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={scopeMigrationData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={rt.grid} />
                  <XAxis {...chartAxisProps(rt, { dataKey: 'period', tick: { fontSize: 10 } })} />
                  <YAxis {...chartAxisProps(rt)} />
                  <Tooltip content={<ChartTooltip isDark={isDark} />} />
                  <Line type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2} name="Total" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      <ScopeMigrationSection
        scopeMigrationData={scopeMigrationData}
        migrationInsights={migrationInsights}
        rt={rt}
        isDark={isDark}
      />

      <ParetoSection
        title="Organisation hotspots (top categories)"
        paretoData={paretoData.slice(0, 12)}
        paretoInsights={paretoInsights}
        selectedParent={selectedParent}
        onDrillDown={handleDrillDown}
        onResetDrillDown={resetDrillDown}
        rt={rt}
        isDark={isDark}
      />

      <VelocitySection velocityData={velocityData} rt={rt} isDark={isDark} />

      <MACCSection
        maccData={maccData}
        maccOpportunities={maccOpportunities}
        onAddClick={() => setShowMaccModal(true)}
        rt={rt}
        isDark={isDark}
      />

      {showMaccModal && (
        <MACCModal onSave={handleSaveMaccOpportunity} onClose={() => setShowMaccModal(false)} />
      )}
    </div>
  );
}
