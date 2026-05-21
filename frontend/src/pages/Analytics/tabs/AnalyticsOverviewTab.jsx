import { lazy, Suspense, useMemo } from 'react';
import DeferredMount from '../../../components/charts/DeferredMount';
import { useTheme } from '../../../context/ThemeContext';
import { useAnalytics } from '../AnalyticsContext';
import { getRechartsTheme } from '../../../utils/chartTheme';

const AnalyticsCompactDashboard = lazy(() => import('../components/AnalyticsCompactDashboard'));
const MACCModal = lazy(() => import('../components/MACCModal'));

function SectionFallback() {
  return (
    <div
      className="analytics-report w-full rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden"
      aria-hidden
    >
      <div className="analytics-report-band opacity-60">Emissions overview</div>
      <div className="analytics-report-body min-h-[480px] bg-zinc-50 dark:bg-zinc-900 animate-pulse" />
    </div>
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
    handleSaveMaccOpportunity,
    extendedCharts
  } = useAnalytics();

  return (
    <div className="analytics-tab-panel analytics-tab-panel--compact">
      <DeferredMount minHeight={520}>
        <Suspense fallback={<SectionFallback />}>
          <AnalyticsCompactDashboard
            stats={stats}
            scopeMigrationData={scopeMigrationData}
            migrationInsights={migrationInsights}
            paretoData={paretoData}
            paretoInsights={paretoInsights}
            selectedParent={selectedParent}
            onDrillDown={handleDrillDown}
            onResetDrillDown={resetDrillDown}
            extended={extendedCharts}
            velocityData={velocityData}
            maccData={maccData}
            maccOpportunities={maccOpportunities}
            onAddMacc={() => setShowMaccModal(true)}
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
