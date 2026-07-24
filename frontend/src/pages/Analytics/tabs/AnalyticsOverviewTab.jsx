import { lazy, Suspense, useMemo } from 'react';
import DeferredMount from '../../../components/charts/DeferredMount';
import { useTheme } from '../../../context/ThemeContext';
import { useAnalytics } from '../AnalyticsContext';
import { getRechartsTheme } from '../../../utils/chartTheme';
import { SkeletonAnalyticsOverview } from '../../../components/ui/Skeleton';

const AnalyticsCompactDashboard = lazy(() => import('../components/AnalyticsCompactDashboard'));
const MACCModal = lazy(() => import('../components/MACCModal'));

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
    extendedCharts,
    chartsLoading,
    initialLoading
  } = useAnalytics();

  const waitingForData =
    initialLoading || (chartsLoading && extendedCharts == null && !(paretoData?.length));

  if (waitingForData) {
    return <SkeletonAnalyticsOverview />;
  }

  return (
    <div className="analytics-tab-panel analytics-tab-panel--compact">
      <DeferredMount minHeight={520}>
        <Suspense fallback={<SkeletonAnalyticsOverview />}>
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
