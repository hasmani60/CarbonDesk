import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useActivity } from '../../context/ActivityContext';
import { analyticsAPI } from '../../services/api';
import {
  calculatePareto,
  detectBurdenShifting,
  generateParetoInsights,
  generateMigrationInsights,
  calculateTrends
} from '../../utils/analysisHelpers';

function normalizeOverview(data = {}) {
  const totalEmissions = data.totalEmissions ?? data.total_emissions ?? 0;
  const totalEntries = data.totalEntries ?? data.total_count ?? 0;
  let scope1 = data.scope1 ?? 0;
  let scope2 = data.scope2 ?? 0;
  let scope3 = data.scope3 ?? 0;
  let scope1Count = data.scope1Count ?? data.scope_1_count ?? 0;
  let scope2Count = data.scope2Count ?? data.scope_2_count ?? 0;
  let scope3Count = data.scope3Count ?? data.scope_3_count ?? 0;

  const byScope = data.by_scope;
  if (Array.isArray(byScope) && byScope.length) {
    const pick = (n) =>
      byScope.find((s) => s._id === n || s.scope === n || Number(s._id) === n) || {};
    const s1 = pick(1);
    const s2 = pick(2);
    const s3 = pick(3);
    scope1 = s1.total ?? s1.total_co2e ?? scope1;
    scope2 = s2.total ?? s2.total_co2e ?? scope2;
    scope3 = s3.total ?? s3.total_co2e ?? scope3;
    scope1Count = s1.count ?? scope1Count;
    scope2Count = s2.count ?? scope2Count;
    scope3Count = s3.count ?? scope3Count;
  }

  return {
    totalEmissions,
    totalEntries,
    scope1,
    scope2,
    scope3,
    scope1Count,
    scope2Count,
    scope3Count,
    scope3_activity_co2e: data.scope3_activity_co2e ?? scope3 - (data.scope3_commute_co2e ?? 0),
    scope3_commute_co2e: data.scope3_commute_co2e ?? 0,
    scope3_commute_present_days: data.scope3_commute_present_days ?? 0
  };
}

const withTimeout = (promise, ms, label = 'Request') =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
    })
  ]);

export default function useAnalyticsData() {
  const { user } = useAuth();
  const { logPageView, logActivity } = useActivity();
  const hasLoggedView = useRef(false);

  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chartsLoading, setChartsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const [scopeMigrationData, setScopeMigrationData] = useState([]);
  const [migrationInsights, setMigrationInsights] = useState(null);
  const [paretoGrouped, setParetoGrouped] = useState([]);
  const [paretoData, setParetoData] = useState([]);
  const [paretoInsights, setParetoInsights] = useState(null);
  const [selectedParent, setSelectedParent] = useState(null);
  const [overviewStats, setOverviewStats] = useState(null);
  const [velocityData, setVelocityData] = useState(null);
  const [maccData, setMaccData] = useState(null);
  const [maccOpportunities, setMaccOpportunities] = useState([]);
  const [showMaccModal, setShowMaccModal] = useState(false);
  const [extendedCharts, setExtendedCharts] = useState(null);

  const applyMigrationPeriods = useCallback((periodData) => {
    if (!periodData?.length) {
      setScopeMigrationData([]);
      setMigrationInsights(null);
      return;
    }
    setScopeMigrationData(periodData);
    if (periodData.length >= 2) {
      const trends = calculateTrends(periodData);
      const burdenShift = detectBurdenShifting(periodData);
      const insights = generateMigrationInsights(periodData);
      setMigrationInsights({ ...insights, burdenShifting: burdenShift, trends });
    } else {
      setMigrationInsights(null);
    }
  }, []);

  const applyParetoRows = useCallback((rows) => {
    if (!rows?.length) {
      setParetoGrouped([]);
      setParetoData([]);
      setParetoInsights(null);
      setSelectedParent(null);
      return;
    }
    const grouped = rows.map((item) => ({
      name: item.name ?? item._id ?? 'Unknown',
      value: Number(item.value ?? item.total_co2e ?? item.emissions ?? 0) || 0,
      count: item.count ?? 0,
      scope: Number(item.scope) || item.scope,
      canDrill: item.canDrill !== false,
      percentage: item.percentage,
      cumulative: item.cumulative ?? item.cumulativePercentage
    }));
    setParetoGrouped(grouped);
    setParetoData(rows);
    const hasCumulative = rows.some(
      (row) => row.cumulative != null || row.cumulativePercentage != null
    );
    setParetoInsights(
      generateParetoInsights(hasCumulative ? rows : calculatePareto(grouped), 80)
    );
    setSelectedParent(null);
  }, []);

  const loadBootstrap = useCallback(async () => {
    const result = await analyticsAPI.getBootstrap();
    return result?.data ?? result;
  }, []);

  const applyBootstrapPayload = useCallback(
    (data, { deferCharts = false } = {}) => {
      if (!data) return;
      if (data.overview) {
        setOverviewStats(normalizeOverview(data.overview));
      }

      const applyCharts = () => {
        applyMigrationPeriods(data.scopeMigration?.periodData ?? []);
        applyParetoRows(data.pareto?.paretoData ?? []);
        setExtendedCharts(data.extended ?? null);
      };

      if (deferCharts) {
        requestAnimationFrame(applyCharts);
      } else {
        applyCharts();
      }
    },
    [applyMigrationPeriods, applyParetoRows]
  );

  const loadOverviewStats = useCallback(async () => {
    const response = await analyticsAPI.getOverview();
    const data = response?.data != null ? response.data : response;
    setOverviewStats(normalizeOverview(data));
    return normalizeOverview(data);
  }, []);

  const loadScopeMigrationData = useCallback(async () => {
    try {
      const result = await analyticsAPI.getScopeMigration();
      const periodData =
        result?.periodData ?? result?.data?.periodData ?? (Array.isArray(result) ? result : []) ?? [];
      applyMigrationPeriods(periodData);
    } catch (err) {
      console.error('Error loading scope migration data:', err);
      applyMigrationPeriods([]);
    }
  }, [applyMigrationPeriods]);

  const loadParetoData = useCallback(async () => {
    try {
      const result = await analyticsAPI.getPareto();
      let paretoRawData = Array.isArray(result)
        ? result
        : result?.paretoData ?? result?.data?.paretoData ?? (Array.isArray(result?.data) ? result.data : []);

      if (!Array.isArray(paretoRawData)) paretoRawData = [];

      if (paretoRawData.length === 0) {
        applyParetoRows([]);
        return;
      }

      applyParetoRows(paretoRawData);
    } catch (err) {
      console.error('Error loading Pareto data:', err);
      applyParetoRows([]);
    }
  }, [applyParetoRows]);

  const loadVelocityData = useCallback(async () => {
    try {
      const result = await analyticsAPI.getVelocity();
      const raw = result?.data ?? result;
      if (!raw) {
        setVelocityData(null);
        return;
      }
      const chartData = raw.chartData ?? raw.periods ?? [];
      const summary = raw.summary ?? {};
      setVelocityData({
        periods: chartData,
        summary: {
          avgVelocity: summary.avgVelocity ?? 0,
          avgAcceleration: summary.avgAcceleration ?? 0,
          trendDirection: summary.trendDirection ?? summary.trend ?? 'stable',
          inflectionPoints: summary.inflectionPoints ?? 0,
          currentVelocity: summary.currentVelocity,
          projectedNextMonth: summary.projectedNextMonth
        }
      });
    } catch (err) {
      console.error('Error loading velocity data:', err);
      setVelocityData(null);
    }
  }, []);

  const loadMACCData = useCallback(async () => {
    try {
      const result = await analyticsAPI.getMACCAnalysis();
      const data = result.data || result;
      setMaccOpportunities(data.opportunities || []);
      setMaccData(data.analysis || null);
    } catch (err) {
      console.error('Error loading MACC data:', err);
      setMaccOpportunities([]);
      setMaccData(null);
    }
  }, []);

  const loadSecondaryData = useCallback(async () => {
    await Promise.all([loadVelocityData(), loadMACCData()]);
    setLastUpdate(new Date());
  }, [loadVelocityData, loadMACCData]);

  const loadChartData = useCallback(async () => {
    setChartsLoading(true);
    try {
      try {
        const payload = await withTimeout(loadBootstrap(), 120000, 'Analytics bootstrap');
        applyBootstrapPayload(payload, { deferCharts: true });
      } catch (bootstrapErr) {
        console.warn('Analytics bootstrap failed, using separate chart requests:', bootstrapErr);
        await Promise.all([loadScopeMigrationData(), loadParetoData()]);
      }
      setLastUpdate(new Date());
    } finally {
      setChartsLoading(false);
    }
  }, [
    loadBootstrap,
    applyBootstrapPayload,
    loadScopeMigrationData,
    loadParetoData
  ]);

  const loadAllData = useCallback(
    async ({ silent = false } = {}) => {
      const showShellSpinner = !silent && overviewStats == null;

      try {
        setError(null);
        if (showShellSpinner) {
          setInitialLoading(true);
        } else {
          setRefreshing(true);
        }

        try {
          await withTimeout(loadOverviewStats(), 90000, 'Analytics overview');
        } catch (overviewErr) {
          console.error('Error loading analytics overview:', overviewErr);
          setOverviewStats(normalizeOverview({}));
          const msg =
            overviewErr?.message?.includes('connect') || overviewErr?.status === 'NETWORK_ERROR'
              ? 'Unable to reach the API. Confirm VITE_API_URL in frontend/.env (e.g. https://carbondesk.onrender.com/api).'
              : 'Failed to load analytics overview. Try refreshing.';
          setError(msg);
          if (!silent) toast.error(msg);
        }

        if (!hasLoggedView.current) {
          hasLoggedView.current = true;
          logActivity('viewed_analytics', 'analytics', null, 'Viewed analytics dashboard');
        }

        // Keep the skeleton until chart/bootstrap data is ready so empty states
        // (e.g. "No category data") do not flash before the API responds.
        await loadChartData();
      } catch (err) {
        console.error('Error loading analytics:', err);
        if (!error) {
          setError('Failed to load analytics data. Please try refreshing.');
        }
        if (!silent) toast.error('Some analytics data could not be loaded');
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
      }

      void loadSecondaryData().catch((err) => {
        console.error('Error loading secondary analytics:', err);
      });
    },
    [loadOverviewStats, loadChartData, loadSecondaryData, logActivity, overviewStats, error]
  );

  useEffect(() => {
    logPageView('Analytics');
    loadAllData();

    const handleEmissionAdded = () => {
      setTimeout(() => loadAllData({ silent: true }), 500);
      toast.success('Analytics updated with new data!');
    };

    window.addEventListener('emission-added', handleEmissionAdded);
    const refreshInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      loadAllData({ silent: true });
    }, 5 * 60 * 1000);

    return () => {
      window.removeEventListener('emission-added', handleEmissionAdded);
      clearInterval(refreshInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getParetoForScope = useCallback(
    (scopeNum) => {
      const filtered = paretoGrouped.filter((p) => Number(p.scope) === scopeNum);
      return calculatePareto(filtered);
    },
    [paretoGrouped]
  );

  const getScopeShare = useCallback(
    (scopeNum) => {
      if (!overviewStats?.totalEmissions) return 0;
      const key = `scope${scopeNum}`;
      return ((overviewStats[key] || 0) / overviewStats.totalEmissions) * 100;
    },
    [overviewStats]
  );

  const handleDrillDown = useCallback(async (item) => {
    if (!item.canDrill) return;
    try {
      const result = await analyticsAPI.getParetoDrilldown(item.name);
      const payload = result?.data != null ? result.data : result;
      let drillDownRawData = payload?.paretoData ?? result?.paretoData ?? result ?? [];
      if (!Array.isArray(drillDownRawData)) drillDownRawData = [];

      const grouped = drillDownRawData.map((row) => ({
        name: row.name ?? row._id ?? 'Unknown',
        value: Number(row.value ?? row.total_co2e ?? row.emissions ?? 0) || 0,
        count: row.count ?? 0,
        scope: row.scope,
        canDrill: false
      }));

      setParetoData(calculatePareto(grouped));
      setSelectedParent(item.name);
      toast.success(`Showing breakdown for ${item.name}`);
    } catch (err) {
      console.error('Drill-down error:', err);
      toast.error('Failed to drill down');
    }
  }, []);

  const resetDrillDown = useCallback(() => {
    setSelectedParent(null);
    loadParetoData();
  }, [loadParetoData]);

  const resetDrillDownForScope = useCallback(
    (scopeNum) => {
      setSelectedParent(null);
      setParetoData(getParetoForScope(scopeNum));
      const results = getParetoForScope(scopeNum);
      setParetoInsights(
        results.length && results[0].percentage !== undefined ? generateParetoInsights(results, 80) : null
      );
    },
    [getParetoForScope]
  );

  const handleDrillDownScoped = useCallback(async (item, scopeNum) => {
    if (!item.canDrill) return;
    try {
      const result = await analyticsAPI.getParetoDrilldown(item.name);
      const payload = result?.data != null ? result.data : result;
      let drillDownRawData = payload?.paretoData ?? result?.paretoData ?? result ?? [];
      if (!Array.isArray(drillDownRawData)) drillDownRawData = [];

      const grouped = drillDownRawData
        .map((row) => ({
          name: row.name ?? row._id ?? 'Unknown',
          value: Number(row.value ?? row.total_co2e ?? row.emissions ?? 0) || 0,
          count: row.count ?? 0,
          canDrill: false
        }))
        .filter((row) => row.value > 0);

      setParetoData(calculatePareto(grouped));
      setSelectedParent(item.name);
      toast.success(`Showing breakdown for ${item.name}`);
    } catch (err) {
      console.error('Drill-down error:', err);
      toast.error('Failed to drill down');
    }
  }, []);

  const handleSaveMaccOpportunity = useCallback(
    async (opportunity) => {
      try {
        await analyticsAPI.saveMACCOpportunity(opportunity);
        await loadMACCData();
        setShowMaccModal(false);
        toast.success('MACC opportunity added successfully');
        logActivity('created_macc_opportunity', 'analytics', null, `Created MACC opportunity: ${opportunity.name}`);
      } catch (err) {
        console.error('Error saving MACC opportunity:', err);
        toast.error('Failed to save MACC opportunity');
      }
    },
    [loadMACCData, logActivity]
  );

  const handleExport = useCallback(async () => {
    try {
      const exportData = {
        organisation: user?.organisation?.name || 'Unknown',
        organisation_id: user?.organisation_id,
        exportedAt: new Date().toISOString(),
        overview: overviewStats,
        scopeMigration: { periods: scopeMigrationData, insights: migrationInsights },
        paretoAnalysis: { data: paretoData, insights: paretoInsights },
        velocity: velocityData,
        macc: { opportunities: maccOpportunities, analysis: maccData },
        extended: extendedCharts
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = window.URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `analytics_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Analytics data exported successfully!');
      logActivity('exported_analytics', 'analytics', null, 'Exported analytics data');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export data');
    }
  }, [
    user,
    overviewStats,
    scopeMigrationData,
    migrationInsights,
    paretoData,
    paretoInsights,
    velocityData,
    maccOpportunities,
    maccData,
    logActivity
  ]);

  const scopeTrendData = useMemo(() => {
    return scopeMigrationData.map((row) => ({
      ...row,
      scope1Share: row.total ? ((row.scope1 || 0) / row.total) * 100 : 0,
      scope2Share: row.total ? ((row.scope2 || 0) / row.total) * 100 : 0,
      scope3Share: row.total ? ((row.scope3 || 0) / row.total) * 100 : 0
    }));
  }, [scopeMigrationData]);

  return {
    user,
    loading: initialLoading,
    initialLoading,
    refreshing,
    chartsLoading,
    error,
    lastUpdate,
    overviewStats,
    scopeMigrationData,
    scopeTrendData,
    extendedCharts,
    migrationInsights,
    paretoGrouped,
    paretoData,
    setParetoData,
    paretoInsights,
    setParetoInsights,
    selectedParent,
    velocityData,
    maccData,
    maccOpportunities,
    showMaccModal,
    setShowMaccModal,
    loadAllData,
    getParetoForScope,
    getScopeShare,
    handleDrillDown,
    handleDrillDownScoped,
    resetDrillDown,
    resetDrillDownForScope,
    handleSaveMaccOpportunity,
    handleExport
  };
}
