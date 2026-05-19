import { useState, useEffect, useCallback, useMemo } from 'react';
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

export default function useAnalyticsData() {
  const { user } = useAuth();
  const { logPageView, logActivity } = useActivity();

  const [loading, setLoading] = useState(true);
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

  const loadOverviewStats = useCallback(async () => {
    try {
      const response = await analyticsAPI.getOverview();
      const data = response?.data != null ? response.data : response;

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

      setOverviewStats({
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
      });
    } catch (err) {
      console.error('Error loading overview stats:', err);
      setOverviewStats({
        totalEmissions: 0,
        totalEntries: 0,
        scope1: 0,
        scope2: 0,
        scope3: 0,
        scope1Count: 0,
        scope2Count: 0,
        scope3Count: 0
      });
    }
  }, []);

  const loadScopeMigrationData = useCallback(async () => {
    try {
      const result = await analyticsAPI.getScopeMigration();
      const periodData =
        result?.periodData ?? result?.data?.periodData ?? (Array.isArray(result) ? result : []) ?? [];

      if (periodData.length === 0) {
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
    } catch (err) {
      console.error('Error loading scope migration data:', err);
      setScopeMigrationData([]);
      setMigrationInsights(null);
    }
  }, []);

  const applyParetoGrouped = useCallback((grouped) => {
    setParetoGrouped(grouped);
    const paretoResults = calculatePareto(grouped);
    if (paretoResults.length > 0 && paretoResults[0].percentage !== undefined) {
      setParetoInsights(generateParetoInsights(paretoResults, 80));
    } else {
      setParetoInsights(null);
    }
    setParetoData(paretoResults);
    setSelectedParent(null);
  }, []);

  const loadParetoData = useCallback(async () => {
    try {
      const result = await analyticsAPI.getPareto();
      let paretoRawData = Array.isArray(result)
        ? result
        : result?.paretoData ?? result?.data?.paretoData ?? (Array.isArray(result?.data) ? result.data : []);

      if (!Array.isArray(paretoRawData)) paretoRawData = [];

      if (paretoRawData.length === 0) {
        setParetoGrouped([]);
        setParetoData([]);
        setParetoInsights(null);
        return;
      }

      const grouped = paretoRawData.map((item) => ({
        name: item.name ?? item._id ?? 'Unknown',
        value: Number(item.value ?? item.total_co2e ?? item.emissions ?? 0) || 0,
        count: item.count ?? 0,
        scope: Number(item.scope) || item.scope,
        canDrill: item.canDrill !== false
      }));

      applyParetoGrouped(grouped);
    } catch (err) {
      console.error('Error loading Pareto data:', err);
      setParetoGrouped([]);
      setParetoData([]);
      setParetoInsights(null);
    }
  }, [applyParetoGrouped]);

  const loadVelocityData = useCallback(async () => {
    try {
      const result = await analyticsAPI.getVelocity();
      setVelocityData(result.data || result || null);
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

  const loadAllData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await Promise.all([
        loadOverviewStats(),
        loadScopeMigrationData(),
        loadParetoData(),
        loadVelocityData(),
        loadMACCData()
      ]);
      setLastUpdate(new Date());
      logActivity('viewed_analytics', 'analytics', null, 'Viewed analytics dashboard');
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError('Failed to load analytics data. Please try refreshing.');
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, [
    loadOverviewStats,
    loadScopeMigrationData,
    loadParetoData,
    loadVelocityData,
    loadMACCData,
    logActivity
  ]);

  useEffect(() => {
    logPageView('Analytics');
    loadAllData();

    const handleEmissionAdded = () => {
      setTimeout(loadAllData, 500);
      toast.success('Analytics updated with new data!');
    };

    window.addEventListener('emission-added', handleEmissionAdded);
    const refreshInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      loadAllData();
    }, 5 * 60 * 1000);

    return () => {
      window.removeEventListener('emission-added', handleEmissionAdded);
      clearInterval(refreshInterval);
    };
  }, [loadAllData, logPageView]);

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

  const handleDrillDown = useCallback(
    async (item) => {
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
    },
    []
  );

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
        results.length && results[0].percentage !== undefined
          ? generateParetoInsights(results, 80)
          : null
      );
    },
    [getParetoForScope]
  );

  const handleDrillDownScoped = useCallback(
    async (item, scopeNum) => {
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
    },
    []
  );

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
        macc: { opportunities: maccOpportunities, analysis: maccData }
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
    loading,
    error,
    lastUpdate,
    overviewStats,
    scopeMigrationData,
    scopeTrendData,
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
