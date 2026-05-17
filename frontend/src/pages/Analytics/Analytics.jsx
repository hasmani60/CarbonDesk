// pages/Analytics/Analytics.jsx - SINGLE PAGE VERSION (No Tabs)
import { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, Line, BarChart, Bar, ComposedChart, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { 
  TrendingUp, Download, RefreshCw, Database, AlertCircle, 
  Activity, ArrowRight, Target, AlertTriangle,
  ChevronDown, ChevronUp, Zap, DollarSign, Plus
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useActivity } from '../../context/ActivityContext';
import { analyticsAPI } from '../../services/api';
import { 
  calculatePareto, 
  detectBurdenShifting,
  generateParetoInsights,
  generateMigrationInsights,
  calculateEmissionFlows,
  calculateTrends,
  formatLargeNumber,
  calculateVelocityMetrics,
  generateMACCData
} from '../../utils/analysisHelpers';
import PageHeader from '../../components/PageHeader/PageHeader';
import Scope3TransportSummary from '../../components/Scope3TransportSummary/Scope3TransportSummary';
import toast from 'react-hot-toast';
import { formatDateTime } from '../../utils/formatters';
import { useTheme } from '../../context/ThemeContext';
import {
  getRechartsTheme,
  getScopeLineColors,
  getScopePieData,
  getChartTooltipProps,
  chartAxisProps,
} from '../../utils/chartTheme';

const Analytics = () => {
  const { user } = useAuth();
  const { logPageView, logActivity } = useActivity();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const rt = useMemo(() => getRechartsTheme(isDark), [isDark]);
  const scopeLineColors = useMemo(() => getScopeLineColors(isDark), [isDark]);
  
  // State management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  
  // Data state
  const [scopeMigrationData, setScopeMigrationData] = useState([]);
  const [migrationInsights, setMigrationInsights] = useState(null);
  const [paretoData, setParetoData] = useState([]);
  const [paretoInsights, setParetoInsights] = useState(null);
  const [drillDownLevel, setDrillDownLevel] = useState('scope');
  const [selectedParent, setSelectedParent] = useState(null);
  const [overviewStats, setOverviewStats] = useState(null);
  const [velocityData, setVelocityData] = useState(null);
  const [maccData, setMaccData] = useState(null);
  const [maccOpportunities, setMaccOpportunities] = useState([]);
  const [showMaccModal, setShowMaccModal] = useState(false);

  const scopeDistribution = useMemo(
    () => getScopePieData(isDark, overviewStats),
    [isDark, overviewStats]
  );

  // Load data on mount
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
  }, []);

  /**
   * Load all analytics data
   */
  const loadAllData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('📊 Loading all analytics...');
      
      await Promise.all([
        loadOverviewStats(),
        loadScopeMigrationData(),
        loadParetoData(),
        loadVelocityData(),
        loadMACCData()
      ]);
      
      setLastUpdate(new Date());
      logActivity('viewed_analytics', 'analytics', null, 'Viewed complete analytics dashboard');
      
    } catch (error) {
      console.error('❌ Error loading analytics:', error);
      setError('Failed to load analytics data. Please try refreshing.');
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load overview statistics
   */
  const loadOverviewStats = async () => {
    try {
      const response = await analyticsAPI.getOverview();
      const data = response?.data != null ? response.data : response;

      // Backend /api/analytics/overview returns camelCase totals + scope1/2/3 + scopeNCount
      const totalEmissions =
        data.totalEmissions ?? data.total_emissions ?? 0;
      const totalEntries =
        data.totalEntries ?? data.total_count ?? 0;

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
        scope3Count
      });
    } catch (error) {
      console.error('Error loading overview stats:', error);
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
  };

  /**
   * Load Scope Migration Analysis data - MONTHLY
   */
  const loadScopeMigrationData = async () => {
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
      
      setMigrationInsights({
        ...insights,
        burdenShifting: burdenShift,
        trends
      });
    } else {
      setMigrationInsights(null);
    }
  } catch (error) {
    console.error('❌ Error loading scope migration data:', error);
    setScopeMigrationData([]);
    setMigrationInsights(null);
  }
};

  /**
   * Load Pareto Analysis data
   */
  const loadParetoData = async () => {
    try {
      const result = await analyticsAPI.getPareto();
      let paretoRawData = Array.isArray(result)
        ? result
        : (result?.paretoData ?? result?.data?.paretoData ?? (Array.isArray(result?.data) ? result.data : []));

      // If it's still not an array, make it one
      if (!Array.isArray(paretoRawData)) {
      paretoRawData = [];
      }
      
      if (paretoRawData.length === 0) {
        setParetoData([]);
        setParetoInsights(null);
        return;
      }
  
      const grouped = paretoRawData.map((item) => ({
        name: item.name ?? item._id ?? 'Unknown',
        value: Number(item.value ?? item.total_co2e ?? item.emissions ?? 0) || 0,
        count: item.count ?? 0,
        scope: item.scope,
        canDrill: item.canDrill !== false
      }));
      
      const paretoResults = calculatePareto(grouped);
      
      if (paretoResults.length > 0 && paretoResults[0].percentage !== undefined) {
        const insights = generateParetoInsights(paretoResults, 80);
        setParetoInsights(insights);
      } else {
        setParetoInsights(null);
      }
      
      setParetoData(paretoResults);
      setDrillDownLevel('category');
      setSelectedParent(null);
    } catch (error) {
      console.error('❌ Error loading Pareto data:', error);
      setParetoData([]);
      setParetoInsights(null);
    }
  };

  /**
   * Load Velocity & Acceleration Analysis - MONTHLY
   */
  const loadVelocityData = async () => {
    try {
      const result = await analyticsAPI.getVelocity();
      const data = result.data || result;
      
      setVelocityData(data || null);
    } catch (error) {
      console.error('❌ Error loading velocity data:', error);
      setVelocityData(null);
    }
  };

  /**
   * Load MACC Analysis
   */
  const loadMACCData = async () => {
    try {
      const result = await analyticsAPI.getMACCAnalysis();
      const data = result.data || result;
      
      setMaccOpportunities(data.opportunities || []);
      setMaccData(data.analysis || null);
    } catch (error) {
      console.error('❌ Error loading MACC data:', error);
      setMaccOpportunities([]);
      setMaccData(null);
    }
  };

  /**
   * Handle Pareto drill-down
   */
  const handleDrillDown = async (item) => {
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
        canDrill: false
      }));
      
      const drillDownResults = calculatePareto(grouped);
      
      setParetoData(drillDownResults);
      setSelectedParent(item.name);
      setDrillDownLevel('subcategory');
      
      toast.success(`Showing breakdown for ${item.name}`);
    } catch (error) {
      console.error('Drill-down error:', error);
      toast.error('Failed to drill down');
    }
  };

  /**
   * Reset Pareto to top level
   */
  const resetDrillDown = () => {
    setSelectedParent(null);
    setDrillDownLevel('category');
    loadParetoData();
  };

  /**
   * Group emissions by time period
   */
  const groupEmissionsByPeriod = (emissions, granularity = 'month') => {
    const periods = {};
    
    emissions.forEach(emission => {
      const date = new Date(emission.date || emission.startDate || emission.createdAt);
      let periodKey;
      
      if (granularity === 'month') {
        periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else if (granularity === 'quarter') {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        periodKey = `${date.getFullYear()}-Q${quarter}`;
      } else {
        periodKey = `${date.getFullYear()}`;
      }
      
      if (!periods[periodKey]) {
        periods[periodKey] = {
          period: periodKey,
          scope1: 0,
          scope2: 0,
          scope3: 0,
          count1: 0,
          count2: 0,
          count3: 0,
          total: 0
        };
      }
      
      const scopeKey = `scope${emission.scope}`;
      const countKey = `count${emission.scope}`;
      const emissionValue = emission.co2e || emission.calculatedEmissions || emission.totalEmissions || 0;
      
      periods[periodKey][scopeKey] += emissionValue;
      periods[periodKey][countKey] += 1;
      periods[periodKey].total += emissionValue;
    });
    
    return Object.values(periods).sort((a, b) => a.period.localeCompare(b.period));
  };

  /**
   * Group emissions by any field
   */
  const groupEmissionsByField = (emissions, field) => {
    const grouped = {};
    
    emissions.forEach(emission => {
      const key = emission[field] || 'Unknown';
      
      if (!grouped[key]) {
        grouped[key] = {
          name: key,
          value: 0,
          count: 0,
          scope: emission.scope,
          canDrill: field === 'category',
          items: []
        };
      }
      
      const emissionValue = emission.co2e || emission.calculatedEmissions || emission.totalEmissions || 0;
      grouped[key].value += emissionValue;
      grouped[key].count += 1;
      grouped[key].items.push(emission);
    });
    
    return Object.values(grouped);
  };

  /**
   * Handle MACC opportunity save
   */
  const handleSaveMaccOpportunity = async (opportunity) => {
    try {
      await analyticsAPI.saveMACCOpportunity(opportunity);
      
      await loadMACCData();
      setShowMaccModal(false);
      toast.success('MACC opportunity added successfully');
      logActivity('created_macc_opportunity', 'analytics', null, `Created MACC opportunity: ${opportunity.name}`);
    } catch (error) {
      console.error('Error saving MACC opportunity:', error);
      toast.error('Failed to save MACC opportunity');
    }
  };

  /**
   * Handle data export
   */
  const handleExport = async () => {
    try {
      const exportData = {
        organisation: user?.organisation?.name || 'Unknown',
        organisation_id: user?.organisation_id,
        exportedAt: new Date().toISOString(),
        overview: overviewStats,
        scopeMigration: {
          periods: scopeMigrationData,
          insights: migrationInsights
        },
        paretoAnalysis: {
          data: paretoData,
          insights: paretoInsights
        },
        velocity: velocityData,
        macc: {
          opportunities: maccOpportunities,
          analysis: maccData
        }
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
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    }
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div
          className={
            isDark
              ? 'bg-slate-800/98 p-3 border border-slate-600 rounded-lg shadow-xl text-slate-100'
              : 'bg-white p-3 border border-gray-200 rounded-lg shadow-lg text-gray-900'
          }
        >
          <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {formatLargeNumber(entry.value)} {entry.unit || 'CO₂e'}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Loading state
  if (loading && !overviewStats) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 motion-safe:animate-spin text-emerald-600 dark:text-emerald-400 mx-auto mb-4" />
          <div className="text-xl text-gray-600 dark:text-gray-400">Loading comprehensive analytics...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6 p-6">
        <PageHeader 
          title="Analytics"
          breadcrumb={[{ label: 'App', href: '/' }, { label: 'Analytics' }]}
        />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Error Loading Analytics</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
            <button
              onClick={loadAllData}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No data state
  if (!overviewStats) {
    return (
      <div className="space-y-6 p-6">
        <PageHeader 
          title="Analytics"
          breadcrumb={[{ label: 'App', href: '/' }, { label: 'Analytics' }]}
        />
        <div className="text-center py-12">
          <Database className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">No Data Available</h2>
          <p className="text-gray-600 dark:text-gray-400">Add emissions data to see comprehensive analytics</p>
        </div>
      </div>
    );
  }

  // Prepare data for visualizations
  const timeSeriesData = scopeMigrationData;

  const burdenShift = migrationInsights?.burdenShifting;
  const paretoThreshold = 80;

  return (
    <div className="space-y-8 pb-10 max-w-7xl mx-auto">
      <div className="space-y-1">
        <PageHeader
          title="Analytics"
          breadcrumb={[
            { label: 'App', href: '/' },
            { label: 'Analytics' },
          ]}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={loadAllData}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white/80 dark:bg-slate-800/80 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium"
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 shrink-0 ${loading ? 'motion-safe:animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 dark:hover:bg-emerald-500 transition-colors text-sm font-medium"
              >
                <Download className="w-4 h-4 shrink-0" />
                Export
              </button>
            </div>
          }
        />
        <p className="text-sm text-gray-600 dark:text-gray-400 pl-0.5">
          {user?.organisation?.name && (
            <span className="font-medium text-gray-800 dark:text-gray-200">{user.organisation.name}</span>
          )}
          {user?.organisation?.name && <span aria-hidden className="mx-1 text-gray-400">•</span>}
          <span className="text-gray-500 dark:text-gray-500">Updated {formatDateTime(lastUpdate)}</span>
        </p>
      </div>

      <div className="space-y-10">

        {/* SECTION 1: KEY METRICS */}
        <section>
          <h2 className="analytics-section-title">
            <TrendingUp className="w-6 h-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
            Key Metrics Overview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="app-card app-card-interactive p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Total Emissions</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {formatLargeNumber(overviewStats.totalEmissions)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{overviewStats.totalEntries} entries • CO₂e</p>
                </div>
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </div>

            <div className="app-card app-card-interactive p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Scope 1</p>
                  <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-300">
                    {formatLargeNumber(overviewStats.scope1)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{overviewStats.scope1Count} entries</p>
                </div>
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-emerald-600">1</span>
                </div>
              </div>
            </div>

            <div className="app-card app-card-interactive p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Scope 2</p>
                  <p className="text-3xl font-bold text-blue-900">
                    {formatLargeNumber(overviewStats.scope2)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{overviewStats.scope2Count} entries</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-blue-600">2</span>
                </div>
              </div>
            </div>

            <div className="app-card app-card-interactive p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Scope 3</p>
                  <p className="text-3xl font-bold text-red-900">
                    {formatLargeNumber(overviewStats.scope3)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{overviewStats.scope3Count} entries</p>
                </div>
                <div className="w-12 h-12 bg-red-100 dark:bg-red-950/40 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-red-600">3</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Scope3TransportSummary />

        {/* SECTION 2: HIGH-LEVEL OVERVIEW CHARTS */}
        <section>
          <h2 className="analytics-section-title">
            <Database className="w-6 h-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
            Emissions Overview
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart */}
            <div className="app-card p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Distribution by Scope</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={scopeDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={(entry) => `${entry.name}: ${formatLargeNumber(entry.value)}`}
                      outerRadius={110}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {scopeDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip {...getChartTooltipProps(rt)} />
                    <Legend wrapperStyle={{ color: rt.legendColor }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Time Series */}
            <div className="app-card p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Monthly Emissions Trend</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={rt.grid} />
                    <XAxis
                      {...chartAxisProps(rt, {
                        dataKey: 'period',
                        angle: -45,
                        textAnchor: 'end',
                        height: 80,
                        tick: { fontSize: 11 },
                      })}
                    />
                    <YAxis {...chartAxisProps(rt)} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ color: rt.legendColor }} />
                    <Line 
                      type="monotone" 
                      dataKey="total" 
                      stroke={isDark ? '#34d399' : '#10b981'} 
                      strokeWidth={3}
                      name="Total Emissions"
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: SCOPE MIGRATION ANALYSIS */}
        {scopeMigrationData.length > 0 && (
          <section>
            <h2 className="analytics-section-title">
              <Activity className="w-6 h-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
              Scope Migration Analysis
            </h2>

            {burdenShift?.detected && (
              <div className="bg-yellow-50 dark:bg-yellow-950/35 border border-yellow-200 dark:border-yellow-900/80 rounded-xl p-6 mb-6">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 text-lg">Burden Shifting Detected</h4>
                    <p className="text-yellow-800 dark:text-yellow-200 mt-2">{burdenShift.message}</p>
                    <p className="text-yellow-700 dark:text-yellow-300 mt-3">
                      <strong>Recommendation:</strong> {burdenShift.recommendation}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="app-card p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Monthly Emission Flows Between Scopes
              </h3>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={scopeMigrationData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={rt.grid} />
                    <XAxis
                      {...chartAxisProps(rt, {
                        dataKey: 'period',
                        angle: -45,
                        textAnchor: 'end',
                        height: 80,
                        tick: { fontSize: 11 },
                      })}
                    />
                    <YAxis {...chartAxisProps(rt)} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ color: rt.legendColor }} />
                    <Line 
                      type="monotone" 
                      dataKey="scope1" 
                      stroke={scopeLineColors.scope1} 
                      strokeWidth={3}
                      name="Scope 1"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="scope2" 
                      stroke={scopeLineColors.scope2} 
                      strokeWidth={3}
                      name="Scope 2"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="scope3" 
                      stroke={scopeLineColors.scope3} 
                      strokeWidth={3}
                      name="Scope 3"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {burdenShift && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="app-card p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-600">Scope 1 Change</span>
                    <ArrowRight className="w-5 h-5 text-orange-500" />
                  </div>
                  <p className={`text-3xl font-bold ${burdenShift.scope1Change < 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {burdenShift.scope1Change > 0 ? '+' : ''}{burdenShift.scope1Change.toFixed(1)}%
                  </p>
                </div>

                <div className="app-card p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-600">Scope 3 Change</span>
                    <TrendingUp className="w-5 h-5 text-orange-500" />
                  </div>
                  <p className={`text-3xl font-bold ${burdenShift.scope3Change < 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {burdenShift.scope3Change > 0 ? '+' : ''}{burdenShift.scope3Change.toFixed(1)}%
                  </p>
                </div>

                <div className="app-card p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-600">Net Change</span>
                    <TrendingUp className={`w-5 h-5 ${burdenShift.netChange < 0 ? 'text-green-500' : 'text-red-500'}`} />
                  </div>
                  <p className={`text-3xl font-bold ${burdenShift.netChange < 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {burdenShift.netChange > 0 ? '+' : ''}{burdenShift.netChange.toFixed(1)}%
                  </p>
                </div>
              </div>
            )}
          </section>
        )}

        {/* SECTION 4: HOTSPOT PARETO ANALYSIS */}
        {paretoData.length > 0 && (
          <section>
            <h2 className="analytics-section-title">
              <Target className="w-6 h-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
              Hotspot Analysis (Pareto 80/20)
            </h2>

            {selectedParent && (
              <div className="flex items-center space-x-2 text-sm mb-4">
                <button 
                  onClick={resetDrillDown}
                  className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium"
                >
                  All Sources
                </button>
                <span className="text-gray-400">›</span>
                <span className="text-gray-900 font-medium">{selectedParent}</span>
              </div>
            )}

            {paretoInsights && (
              <div className="bg-emerald-50 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-800/70 rounded-xl p-6 mb-6">
                <div className="flex items-start space-x-3">
                  <Target className="w-6 h-6 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-emerald-900 dark:text-emerald-300 text-lg">80/20 Rule Applied</h4>
                    <p className="text-emerald-800 dark:text-emerald-300 mt-2">{paretoInsights.summary}</p>
                    <p className="text-emerald-700 dark:text-emerald-400 mt-3">
                      <strong>Risk Level:</strong> {paretoInsights.risk}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="app-card p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {selectedParent ? `${selectedParent} Breakdown` : 'Emission Hotspots'}
                </h3>
                {selectedParent && (
                  <button
                    onClick={resetDrillDown}
                    className="text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 flex items-center space-x-1 font-medium"
                  >
                    <ChevronUp className="w-4 h-4" />
                    <span>Back to Overview</span>
                  </button>
                )}
              </div>
              
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={paretoData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={rt.grid} />
                    <XAxis
                      {...chartAxisProps(rt, {
                        dataKey: 'name',
                        angle: -45,
                        textAnchor: 'end',
                        height: 120,
                        interval: 0,
                        tick: { fontSize: 12 },
                      })}
                    />
                    <YAxis
                      yAxisId="left"
                      orientation="left"
                      {...chartAxisProps(rt, {
                        label: {
                          value: 'Emissions (CO₂e)',
                          angle: -90,
                          position: 'insideLeft',
                          fill: rt.tickFill,
                        },
                      })}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      {...chartAxisProps(rt, {
                        label: {
                          value: 'Cumulative %',
                          angle: 90,
                          position: 'insideRight',
                          fill: rt.tickFill,
                        },
                      })}
                    />
                    <Tooltip {...getChartTooltipProps(rt)} />
                    <Legend wrapperStyle={{ color: rt.legendColor }} />
                    <Bar 
                      yAxisId="left" 
                      dataKey="value" 
                      fill="#10b981" 
                      name="Emissions"
                      onClick={(data) => handleDrillDown(data)}
                      cursor={!selectedParent ? 'pointer' : 'default'}
                    />
                    <Line 
                      yAxisId="right" 
                      type="monotone" 
                      dataKey="cumulative" 
                      stroke="#ef4444" 
                      strokeWidth={3}
                      name="Cumulative %"
                      dot={{ r: 6 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {!selectedParent && (
                <p className="text-sm text-gray-500 mt-4 text-center">
                  💡 Click on any bar to drill down into sub-categories
                </p>
              )}
            </div>

            <div className="app-card overflow-hidden">
              <div className="px-6 py-4 border-b bg-gray-50 dark:bg-slate-800/80 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Detailed Breakdown</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-slate-800/90 border-b border-gray-200 dark:border-slate-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Source</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Emissions</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Entries</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">% of Total</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Cumulative %</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Priority</th>
                      {!selectedParent && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Action</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-900/30 divide-y divide-gray-200 dark:divide-slate-700">
                    {paretoData.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{item.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{formatLargeNumber(item.value)} CO₂e</td>
                        <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{item.count}</td>
                        <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{item.percentage.toFixed(1)}%</td>
                        <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                          <div className="flex items-center space-x-2">
                            <span>{item.cumulative.toFixed(1)}%</span>
                            {item.cumulative <= paretoThreshold && (
                              <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">
                                Top {paretoThreshold}%
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {item.cumulative <= paretoThreshold ? (
                            <span className="px-3 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                              High
                            </span>
                          ) : (
                            <span className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                              Low
                            </span>
                          )}
                        </td>
                        {!selectedParent && (
                          <td className="px-6 py-4 text-sm">
                            {item.canDrill ? (
                              <button
                                onClick={() => handleDrillDown(item)}
                                className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 flex items-center space-x-1 font-medium"
                              >
                                <span>Drill Down</span>
                                <ChevronDown className="w-4 h-4" />
                              </button>
                            ) : (
                              <span className="text-gray-400">N/A</span>
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
        )}

        {/* SECTION 5: VELOCITY & ACCELERATION */}
        {velocityData && (
          <section>
            <h2 className="analytics-section-title">
              <Zap className="w-6 h-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
              Velocity & Acceleration Analysis
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="app-card p-6">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Avg Velocity</p>
                <p className={`text-3xl font-bold ${velocityData.summary.avgVelocity < 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {velocityData.summary.avgVelocity > 0 ? '+' : ''}{velocityData.summary.avgVelocity.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Period-over-period change</p>
              </div>

              <div className="app-card p-6">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Avg Acceleration</p>
                <p className={`text-3xl font-bold ${velocityData.summary.avgAcceleration < 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {velocityData.summary.avgAcceleration > 0 ? '+' : ''}{velocityData.summary.avgAcceleration.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Change in velocity</p>
              </div>

              <div className="app-card p-6">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Trend Direction</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white capitalize">
                  {velocityData.summary.trendDirection}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Overall momentum</p>
              </div>

              <div className="app-card p-6">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Inflection Points</p>
                <p className="text-3xl font-bold text-blue-600">
                  {velocityData.summary.inflectionPoints}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Trend reversals detected</p>
              </div>
            </div>

            <div className="app-card p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Emissions Velocity (Rate of Change)
              </h3>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={velocityData.periods}>
                    <CartesianGrid strokeDasharray="3 3" stroke={rt.grid} />
                    <XAxis
                      {...chartAxisProps(rt, {
                        dataKey: 'period',
                        angle: -45,
                        textAnchor: 'end',
                        height: 80,
                        tick: { fontSize: 11 },
                      })}
                    />
                    <YAxis
                      yAxisId="left"
                      {...chartAxisProps(rt, {
                        label: {
                          value: 'Velocity (%)',
                          angle: -90,
                          position: 'insideLeft',
                          fill: rt.tickFill,
                        },
                      })}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      {...chartAxisProps(rt, {
                        label: {
                          value: 'Acceleration',
                          angle: 90,
                          position: 'insideRight',
                          fill: rt.tickFill,
                        },
                      })}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ color: rt.legendColor }} />
                    <Bar 
                      yAxisId="left" 
                      dataKey="velocity" 
                      fill={isDark ? '#34d399' : '#10b981'}
                      name="Velocity (%)"
                    />
                    <Line 
                      yAxisId="right" 
                      type="monotone" 
                      dataKey="acceleration" 
                      stroke="#ef4444"
                      strokeWidth={3}
                      name="Acceleration"
                      dot={(props) => {
                        const { cx, cy, payload, index } = props;
                        if (payload.isInflectionPoint) {
                          return (
                            <circle
                              key={`inflection-${index}`}
                              cx={cx}
                              cy={cy}
                              r={8}
                              fill="#f59e0b"
                              stroke={isDark ? '#0f172a' : '#fff'}
                              strokeWidth={2}
                            />
                          );
                        }
                        return <circle key={`dot-${index}`} cx={cx} cy={cy} r={4} fill="#ef4444" />;
                      }}
                    />
                    <ReferenceLine yAxisId="left" y={0} stroke={rt.refLine} strokeDasharray="3 3" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 text-center">
                ⚠️ Orange dots indicate inflection points (trend reversals)
              </p>
            </div>
          </section>
        )}

        {/* SECTION 6: MACC ANALYSIS */}
        <section>
          <h2 className="analytics-section-title">
            <DollarSign className="w-6 h-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
            Marginal Abatement Cost Curve (MACC)
          </h2>

          {!maccData || maccOpportunities.length === 0 ? (
            <div className="app-card p-12 text-center">
              <DollarSign className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No MACC Opportunities Defined</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Add reduction opportunities to see cost-effectiveness analysis
              </p>
              <button
                onClick={() => setShowMaccModal(true)}
                className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center space-x-2 mx-auto transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span>Add Opportunity</span>
              </button>
            </div>
          ) : (
            <>
              <div className="flex justify-end mb-6">
                <button
                  onClick={() => setShowMaccModal(true)}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center space-x-2 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  <span>Add Opportunity</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <div className="app-card p-6">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Total Potential</p>
                  <p className="text-3xl font-bold text-emerald-600">
                    {formatLargeNumber(maccData.summary.totalAbatementPotential)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">tCO₂e reduction</p>
                </div>

                <div className="app-card p-6">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Total Investment</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    ${formatLargeNumber(Math.abs(maccData.summary.totalCost))}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {maccData.summary.totalCost < 0 ? 'Net savings' : 'Required investment'}
                  </p>
                </div>

                <div className="app-card p-6">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Avg Cost/Ton</p>
                  <p className={`text-3xl font-bold ${maccData.summary.avgCostPerTon < 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                    ${Math.abs(maccData.summary.avgCostPerTon).toFixed(0)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Per tCO₂e</p>
                </div>

                <div className="app-card p-6">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Cost-Effective</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {maccData.summary.costEffectiveOpportunities}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Of {maccData.opportunities.length} total
                  </p>
                </div>
              </div>

              <div className="app-card p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Marginal Abatement Cost Curve
                </h3>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={maccData.opportunities} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke={rt.grid} />
                      <XAxis
                        type="number"
                        {...chartAxisProps(rt, {
                          label: {
                            value: 'Cost per tCO₂e ($)',
                            position: 'bottom',
                            fill: rt.tickFill,
                          },
                        })}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={180}
                        {...chartAxisProps(rt, { tick: { fontSize: 11 } })}
                      />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div
                                className={
                                  isDark
                                    ? 'bg-slate-800/98 p-4 border border-slate-600 rounded-lg shadow-xl text-slate-100'
                                    : 'bg-white p-4 border border-gray-200 rounded-lg shadow-lg text-gray-900'
                                }
                              >
                                <p className={`font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{data.name}</p>
                                <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>Cost: ${data.costPerTon.toFixed(2)}/tCO₂e</p>
                                <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>Potential: {formatLargeNumber(data.abatementPotential)} tCO₂e</p>
                                <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>Total: ${formatLargeNumber(Math.abs(data.totalCost))}</p>
                                {data.paybackPeriod && (
                                  <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>Payback: {data.paybackPeriod} years</p>
                                )}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar 
                        dataKey="costPerTon" 
                        fill="#10b981"
                        name="Cost per tCO₂e"
                        shape={(props) => {
                          const { x, y, width, height, payload } = props;
                          const fill = payload.costPerTon < 0 ? '#10b981' : '#ef4444';
                          return <rect x={x} y={y} width={width} height={height} fill={fill} />;
                        }}
                      />
                      <ReferenceLine x={0} stroke={rt.refLine} strokeWidth={2} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 text-center">
                  🟢 Green bars = cost-saving opportunities | 🔴 Red bars = investment required
                </p>
              </div>

              <div className="app-card overflow-hidden">
                <div className="px-6 py-4 border-b bg-gray-50 dark:bg-slate-800/80 dark:border-slate-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Reduction Opportunities</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-slate-800/90 border-b border-gray-200 dark:border-slate-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Opportunity</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Category</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Abatement Potential</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Cost/tCO₂e</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Total Cost</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Payback</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Priority</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-900/30 divide-y divide-gray-200 dark:divide-slate-700">
                      {maccData.opportunities.map((opp, index) => (
                        <tr key={index} className="hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{opp.name}</td>
                          <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{opp.category}</td>
                          <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                            {formatLargeNumber(opp.abatementPotential)} tCO₂e
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <span className={opp.costPerTon < 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                              ${Math.abs(opp.costPerTon).toFixed(2)}
                              {opp.costPerTon < 0 && ' (saving)'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                            ${formatLargeNumber(Math.abs(opp.totalCost))}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                            {opp.paybackPeriod ? `${opp.paybackPeriod} years` : 'N/A'}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                              opp.priority === 'high' 
                                ? 'bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-300'
                                : opp.priority === 'medium'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {opp.priority}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </section>

        {/* Footer Note */}
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
          <p>© {new Date().getFullYear()} Carbon Accounting Platform • Advanced Analytics Dashboard</p>
        </div>
      </div>

      {/* MACC Modal */}
      {showMaccModal && (
        <MACCModal
          onSave={handleSaveMaccOpportunity}
          onClose={() => setShowMaccModal(false)}
        />
      )}
    </div>
  );
};

// MACC Modal Component
const MACCModal = ({ onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    category: 'Energy Efficiency',
    abatementPotential: '',
    costPerTon: '',
    paybackPeriod: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const abatement = parseFloat(formData.abatementPotential);
    const cost = parseFloat(formData.costPerTon);
    const totalCost = abatement * cost;
    
    let priority = 'low';
    if (cost < 0) priority = 'high';
    else if (cost < 50) priority = 'medium';
    
    onSave({
      ...formData,
      abatementPotential: abatement,
      costPerTon: cost,
      totalCost,
      paybackPeriod: formData.paybackPeriod ? parseFloat(formData.paybackPeriod) : null,
      priority
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl dark:shadow-black/40 border border-gray-200 dark:border-slate-600 max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Add MACC Opportunity</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Define a new reduction opportunity</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 form-stack">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Opportunity Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
              placeholder="e.g., LED Lighting Upgrade"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white dark:bg-slate-800 transition-colors"
            >
              <option>Energy Efficiency</option>
              <option>Renewable Energy</option>
              <option>Process Optimization</option>
              <option>Fuel Switching</option>
              <option>Waste Reduction</option>
              <option>Supply Chain</option>
              <option>Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Abatement Potential (tCO₂e/year)
            </label>
            <input
              type="number"
              required
              step="0.01"
              value={formData.abatementPotential}
              onChange={(e) => setFormData({ ...formData, abatementPotential: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
              placeholder="500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Cost per tCO₂e ($)
            </label>
            <input
              type="number"
              required
              step="0.01"
              value={formData.costPerTon}
              onChange={(e) => setFormData({ ...formData, costPerTon: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
              placeholder="-25 for savings, +50 for cost"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">💡 Negative values indicate cost savings</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Payback Period (years, optional)
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.paybackPeriod}
              onChange={(e) => setFormData({ ...formData, paybackPeriod: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
              placeholder="2.5"
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 dark:hover:bg-emerald-500 transition-colors font-medium"
            >
              Add Opportunity
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Analytics;