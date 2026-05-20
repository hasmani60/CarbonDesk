import { lazy, Suspense, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Database, ArrowRight } from 'lucide-react';
import DeferredMount from '../../../components/charts/DeferredMount';
import { useTheme } from '../../../context/ThemeContext';
import { useAnalytics } from '../AnalyticsContext';
import { formatLargeNumber } from '../../../utils/analysisHelpers';
import { getRechartsTheme, getScopePieData } from '../../../utils/chartTheme';

const DistributionCharts = lazy(() => import('../components/DistributionCharts'));
const ScopeMigrationSection = lazy(() => import('../components/ScopeMigrationSection'));
const ParetoSection = lazy(() => import('../components/ParetoSection'));
const VelocitySection = lazy(() => import('../components/VelocitySection'));
const MACCSection = lazy(() => import('../components/MACCSection'));
const MACCModal = lazy(() => import('../components/MACCModal'));

function SectionFallback({ height = 280 }) {
  return (
    <div
      className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800"
      style={{ minHeight: height }}
      aria-hidden
    />
  );
}

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="app-card app-card-interactive p-6 md:p-7">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total emissions</p>
            <p className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mt-1">
              {formatLargeNumber(stats.totalEmissions)}
            </p>
            <p className="text-xs text-gray-500 mt-2">{stats.totalEntries} entries</p>
          </div>
          {[
            { n: 1, val: stats.scope1, count: stats.scope1Count, to: '/analytics/scope-1' },
            { n: 2, val: stats.scope2, count: stats.scope2Count, to: '/analytics/scope-2' },
            { n: 3, val: stats.scope3, count: stats.scope3Count, to: '/analytics/scope-3' }
          ].map(({ n, val, count, to }) => (
            <Link key={n} to={to} className="app-card app-card-interactive p-6 md:p-7 group block">
              <p className="text-sm text-gray-500 dark:text-gray-400">Scope {n}</p>
              <p className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mt-1">
                {formatLargeNumber(val)}
              </p>
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
        <DeferredMount minHeight={320}>
          <Suspense fallback={<SectionFallback height={320} />}>
            <DistributionCharts
              pieData={pieData}
              scopeMigrationData={scopeMigrationData}
              rt={rt}
              isDark={isDark}
            />
          </Suspense>
        </DeferredMount>
      </section>

      <DeferredMount minHeight={420}>
        <Suspense fallback={<SectionFallback height={420} />}>
          <ScopeMigrationSection
            scopeMigrationData={scopeMigrationData}
            migrationInsights={migrationInsights}
            rt={rt}
            isDark={isDark}
          />
        </Suspense>
      </DeferredMount>

      <DeferredMount minHeight={480}>
        <Suspense fallback={<SectionFallback height={480} />}>
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
        </Suspense>
      </DeferredMount>

      <DeferredMount minHeight={200}>
        <Suspense fallback={<SectionFallback height={200} />}>
          <VelocitySection velocityData={velocityData} rt={rt} isDark={isDark} />
        </Suspense>
      </DeferredMount>

      <DeferredMount minHeight={200}>
        <Suspense fallback={<SectionFallback height={200} />}>
          <MACCSection
            maccData={maccData}
            maccOpportunities={maccOpportunities}
            onAddClick={() => setShowMaccModal(true)}
            rt={rt}
            isDark={isDark}
          />
        </Suspense>
      </DeferredMount>

      {showMaccModal && (
        <Suspense fallback={null}>
          <MACCModal onSave={handleSaveMaccOpportunity} onClose={() => setShowMaccModal(false)} />
        </Suspense>
      )}
    </div>
  );
}
