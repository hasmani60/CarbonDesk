// pages/Analytics/Analytics.jsx - Extended with Trajectory, Velocity, MACC
import { useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, ComposedChart, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { 
  TrendingUp, Download, RefreshCw, Database, AlertCircle, 
  Activity, ArrowRight, ChevronDown, ChevronUp, Target, AlertTriangle,
  ChevronRight, TrendingDown, Zap, DollarSign, Plus
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useActivity } from '../../context/ActivityContext';
import { analyticsAPI } from '../../services/api';
import { getEmissions, getEmissionsStats } from '../../utils/localStorage';
import { 
  calculatePareto, 
  detectBurdenShifting,
  generateParetoInsights,
  generateMigrationInsights,
  calculateEmissionFlows,
  calculateTrends,
  formatLargeNumber,
  // New helpers
  calculateTrajectoryAlignment,
  calculateVelocityMetrics,
  generateMACCData,
  calculateBaselineYear
} from '../../utils/analysisHelpers';
import PageHeader from '../../components/PageHeader/PageHeader';
import toast from 'react-hot-toast';

const Analytics = () => {
  const { user } = useAuth();
  const { logPageView, logActivity } = useActivity();
  
  // State management
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  
  // Existing data state
  const [scopeMigrationData, setScopeMigrationData] = useState([]);
  const [migrationInsights, setMigrationInsights] = useState(null);
  const [paretoData, setParetoData] = useState([]);
  const [paretoInsights, setParetoInsights] = useState(null);
  const [drillDownLevel, setDrillDownLevel] = useState('scope');
  const [selectedParent, setSelectedParent] = useState(null);
  const [overviewStats, setOverviewStats] = useState(null);

  // NEW: State for new features
  const [trajectoryData, setTrajectoryData] = useState(null);
  const [velocityData, setVelocityData] = useState(null);
  const [maccData, setMaccData] = useState(null);
  const [selectedScenario, setSelectedScenario] = useState('1.5C');
  const [maccOpportunities, setMaccOpportunities] = useState([]);
  const [showMaccModal, setShowMaccModal] = useState(false);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'migration', label: 'Scope Migration', icon: Activity },
    { id: 'pareto', label: 'Hotspot Analysis', icon: Target },
    { id: 'trajectory', label: 'Emissions Trajectory', icon: TrendingDown },
    { id: 'velocity', label: 'Velocity & Acceleration', icon: Zap },
    { id: 'macc', label: 'Abatement Cost Curve', icon: DollarSign }
  ];

  const scopeColors = {
    scope1: '#065f46',
    scope2: '#1e40af',
    scope3: '#7c2d12'
  };

  // Load data on mount and tab change
  useEffect(() => {
    logPageView('Analytics');
    loadAllData();

    const handleEmissionAdded = () => {
      setTimeout(loadAllData, 500);
      toast.success('Analytics updated with new data!');
    };
    
    window.addEventListener('emission-added', handleEmissionAdded);
    const refreshInterval = setInterval(loadAllData, 5 * 60 * 1000);
    
    return () => {
      window.removeEventListener('emission-added', handleEmissionAdded);
      clearInterval(refreshInterval);
    };
  }, []);

  useEffect(() => {
    if (activeTab !== 'overview') {
      loadTabData(activeTab);
    }
  }, [activeTab, selectedScenario]);

  /**
   * Load all analytics data from database
   */
  const loadAllData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('📊 Loading analytics for organisation:', user?.organisation_id);
      
      await loadOverviewStats();
      
      if (activeTab !== 'overview') {
        await loadTabData(activeTab);
      }
      
      setLastUpdate(new Date());
      logActivity('viewed_analytics', 'analytics', null, `Viewed ${activeTab} analytics`);
      
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
      const emissions = getEmissions();
      const stats = getEmissionsStats();
      
      setOverviewStats({
        totalEmissions: stats.scope1.total + stats.scope2.total + stats.scope3.total,
        totalEntries: emissions.length,
        scope1: stats.scope1.total,
        scope2: stats.scope2.total,
        scope3: stats.scope3.total,
        scope1Count: stats.scope1.count,
        scope2Count: stats.scope2.count,
        scope3Count: stats.scope3.count
      });
    } catch (error) {
      console.error('Error loading overview stats:', error);
    }
  };

  /**
   * Load data for specific tab
   */
  const loadTabData = async (tab) => {
    if (tab === 'migration') {
      await loadScopeMigrationData();
    } else if (tab === 'pareto') {
      await loadParetoData();
    } else if (tab === 'trajectory') {
      await loadTrajectoryData();
    } else if (tab === 'velocity') {
      await loadVelocityData();
    } else if (tab === 'macc') {
      await loadMACCData();
    }
  };

  /**
   * Load Scope Migration Analysis data
   */
  const loadScopeMigrationData = async () => {
    try {
      console.log('📈 Loading scope migration data...');
      
      const emissions = getEmissions();
      
      if (emissions.length === 0) {
        setScopeMigrationData([]);
        setMigrationInsights(null);
        return;
      }

      const periodData = groupEmissionsByPeriod(emissions, 'quarter');
      const trends = calculateTrends(periodData);
      const burdenShift = detectBurdenShifting(periodData);
      const insights = generateMigrationInsights(periodData);
      
      setScopeMigrationData(periodData);
      setMigrationInsights({
        ...insights,
        burdenShifting: burdenShift,
        trends
      });
      
      console.log('✅ Scope migration data loaded:', periodData.length, 'periods');
    } catch (error) {
      console.error('❌ Error loading scope migration data:', error);
      toast.error('Failed to load scope migration analysis');
    }
  };

  /**
   * Load Pareto Analysis data
   */
  const loadParetoData = async () => {
    try {
      console.log('🎯 Loading Pareto data...');
      
      const emissions = getEmissions();
      
      if (emissions.length === 0) {
        setParetoData([]);
        setParetoInsights(null);
        return;
      }

      const grouped = groupEmissionsByField(emissions, 'category');
      const paretoResults = calculatePareto(grouped);
      const insights = generateParetoInsights(paretoResults, 80);
      
      setParetoData(paretoResults);
      setParetoInsights(insights);
      setDrillDownLevel('category');
      setSelectedParent(null);
      
      console.log('✅ Pareto data loaded:', paretoResults.length, 'categories');
    } catch (error) {
      console.error('❌ Error loading Pareto data:', error);
      toast.error('Failed to load hotspot analysis');
    }
  };

  /**
   * NEW: Load Trajectory Analysis
   */
  const loadTrajectoryData = async () => {
    try {
      console.log('📉 Loading trajectory data...');
      
      const emissions = getEmissions();
      
      if (emissions.length === 0) {
        setTrajectoryData(null);
        return;
      }

      // Group by year
      const yearlyData = groupEmissionsByPeriod(emissions, 'year');
      
      // Calculate baseline
      const baseline = calculateBaselineYear(yearlyData);
      
      // Generate target pathway
      const targetPathway = generateTargetPathway(baseline, selectedScenario);
      
      // Calculate alignment
      const alignment = calculateTrajectoryAlignment(yearlyData, targetPathway, baseline);
      
      setTrajectoryData({
        historical: yearlyData,
        targetPathway,
        baseline,
        alignment,
        scenario: selectedScenario
      });
      
      console.log('✅ Trajectory data loaded');
    } catch (error) {
      console.error('❌ Error loading trajectory data:', error);
      toast.error('Failed to load trajectory analysis');
    }
  };

  /**
   * NEW: Load Velocity & Acceleration Analysis
   */
  const loadVelocityData = async () => {
    try {
      console.log('⚡ Loading velocity data...');
      
      const emissions = getEmissions();
      
      if (emissions.length === 0) {
        setVelocityData(null);
        return;
      }

      const periodData = groupEmissionsByPeriod(emissions, 'quarter');
      const velocityMetrics = calculateVelocityMetrics(periodData);
      
      setVelocityData(velocityMetrics);
      
      console.log('✅ Velocity data loaded');
    } catch (error) {
      console.error('❌ Error loading velocity data:', error);
      toast.error('Failed to load velocity analysis');
    }
  };

  /**
   * NEW: Load MACC Analysis
   */
  const loadMACCData = async () => {
    try {
      console.log('💰 Loading MACC data...');
      
      // Load MACC opportunities from localStorage
      const storedOpportunities = localStorage.getItem(`macc_opportunities_${user?.organisation_id}`);
      const opportunities = storedOpportunities ? JSON.parse(storedOpportunities) : [];
      
      setMaccOpportunities(opportunities);
      
      if (opportunities.length === 0) {
        setMaccData(null);
        return;
      }

      const maccAnalysis = generateMACCData(opportunities);
      setMaccData(maccAnalysis);
      
      console.log('✅ MACC data loaded');
    } catch (error) {
      console.error('❌ Error loading MACC data:', error);
      toast.error('Failed to load MACC analysis');
    }
  };

  /**
   * Generate target pathway based on scenario
   */
  const generateTargetPathway = (baseline, scenario) => {
    const targetYear = 2050;
    const startYear = baseline.year;
    const years = targetYear - startYear;
    
    // Reduction rates per year based on SBTi methodology
    const reductionRates = {
      '1.5C': 0.042,    // 4.2% per year (ambitious)
      '2C': 0.029,      // 2.9% per year (moderate)
      '2C_low': 0.020   // 2.0% per year (minimum)
    };
    
    const rate = reductionRates[scenario] || reductionRates['2C'];
    const pathway = [];
    
    for (let i = 0; i <= years; i++) {
      const year = startYear + i;
      const target = baseline.emissions * Math.pow(1 - rate, i);
      pathway.push({
        period: year.toString(),
        target: parseFloat(target.toFixed(2)),
        scenario
      });
    }
    
    return pathway;
  };

  /**
   * Handle Pareto drill-down
   */
  const handleDrillDown = async (item) => {
    if (!item.canDrill) return;
    
    try {
      console.log('🔍 Drilling down into:', item.name);
      
      const emissions = getEmissions();
      const categoryEmissions = emissions.filter(e => 
        e.category === item.name || e.activityType === item.name
      );
      
      const grouped = groupEmissionsByField(categoryEmissions, 'subcategory');
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
  const groupEmissionsByPeriod = (emissions, granularity = 'quarter') => {
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
  const handleSaveMaccOpportunity = (opportunity) => {
    const updated = [...maccOpportunities, { ...opportunity, id: Date.now() }];
    setMaccOpportunities(updated);
    localStorage.setItem(`macc_opportunities_${user?.organisation_id}`, JSON.stringify(updated));
    loadMACCData();
    setShowMaccModal(false);
    toast.success('MACC opportunity added successfully');
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
        trajectory: trajectoryData,
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
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900">{label}</p>
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

  /**
   * Render Overview Tab
   */
  const renderOverview = () => {
    if (!overviewStats) {
      return (
        <div className="text-center py-12">
          <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No data available</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Emissions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatLargeNumber(overviewStats.totalEmissions)} CO₂e
                </p>
                <p className="text-xs text-gray-500 mt-1">{overviewStats.totalEntries} entries</p>
              </div>
              <TrendingUp className="w-8 h-8 text-emerald-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Scope 1</p>
                <p className="text-2xl font-bold text-emerald-900">
                  {formatLargeNumber(overviewStats.scope1)}
                </p>
                <p className="text-xs text-gray-500 mt-1">{overviewStats.scope1Count} entries</p>
              </div>
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                <span className="text-emerald-600 font-bold">1</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Scope 2</p>
                <p className="text-2xl font-bold text-blue-900">
                  {formatLargeNumber(overviewStats.scope2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">{overviewStats.scope2Count} entries</p>
              </div>
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-blue-600 font-bold">2</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Scope 3</p>
                <p className="text-2xl font-bold text-red-900">
                  {formatLargeNumber(overviewStats.scope3)}
                </p>
                <p className="text-xs text-gray-500 mt-1">{overviewStats.scope3Count} entries</p>
              </div>
              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                <span className="text-red-600 font-bold">3</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Access Cards */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Advanced Analytics</h3>
          <p className="text-gray-600 mb-4">
            Explore detailed emission analysis using the tabs above:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div 
              className="border rounded-lg p-4 hover:border-emerald-500 cursor-pointer transition-colors"
              onClick={() => setActiveTab('trajectory')}
            >
              <TrendingDown className="w-8 h-8 text-emerald-600 mb-2" />
              <h4 className="font-medium text-gray-900">Emissions Trajectory</h4>
              <p className="text-sm text-gray-500 mt-1">
                Track progress toward 1.5°C and 2°C pathways
              </p>
            </div>
            <div 
              className="border rounded-lg p-4 hover:border-emerald-500 cursor-pointer transition-colors"
              onClick={() => setActiveTab('velocity')}
            >
              <Zap className="w-8 h-8 text-emerald-600 mb-2" />
              <h4 className="font-medium text-gray-900">Velocity & Acceleration</h4>
              <p className="text-sm text-gray-500 mt-1">
                Analyze rate of emissions change and inflection points
              </p>
            </div>
            <div 
              className="border rounded-lg p-4 hover:border-emerald-500 cursor-pointer transition-colors"
              onClick={() => setActiveTab('macc')}
            >
              <DollarSign className="w-8 h-8 text-emerald-600 mb-2" />
              <h4 className="font-medium text-gray-900">Abatement Cost Curve</h4>
              <p className="text-sm text-gray-500 mt-1">
                Prioritize reduction actions by cost-effectiveness
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /**
   * Render Scope Migration Analysis Tab
   */
  const renderMigrationAnalysis = () => {
    if (scopeMigrationData.length === 0) {
      return (
        <div className="text-center py-12">
          <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">No migration data available</p>
          <p className="text-sm text-gray-500">Add emissions from multiple time periods to see scope migration analysis</p>
        </div>
      );
    }

    const burdenShift = migrationInsights?.burdenShifting;

    return (
      <div className="space-y-6">
        {burdenShift?.detected && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-900">Burden Shifting Detected</h4>
                <p className="text-sm text-yellow-800 mt-1">{burdenShift.message}</p>
                <p className="text-sm text-yellow-700 mt-2">
                  <strong>Recommendation:</strong> {burdenShift.recommendation}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Emission Flows Between Scopes Over Time
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={scopeMigrationData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="scope1" 
                  stroke={scopeColors.scope1} 
                  strokeWidth={3}
                  name="Scope 1"
                />
                <Line 
                  type="monotone" 
                  dataKey="scope2" 
                  stroke={scopeColors.scope2} 
                  strokeWidth={3}
                  name="Scope 2"
                />
                <Line 
                  type="monotone" 
                  dataKey="scope3" 
                  stroke={scopeColors.scope3} 
                  strokeWidth={3}
                  name="Scope 3"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {burdenShift && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">Scope 1 Change</span>
                <ArrowRight className="w-4 h-4 text-orange-500" />
              </div>
              <p className={`text-2xl font-bold ${burdenShift.scope1Change < 0 ? 'text-green-600' : 'text-red-600'}`}>
                {burdenShift.scope1Change > 0 ? '+' : ''}{burdenShift.scope1Change.toFixed(1)}%
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">Scope 3 Change</span>
                <TrendingUp className="w-4 h-4 text-orange-500" />
              </div>
              <p className={`text-2xl font-bold ${burdenShift.scope3Change < 0 ? 'text-green-600' : 'text-red-600'}`}>
                {burdenShift.scope3Change > 0 ? '+' : ''}{burdenShift.scope3Change.toFixed(1)}%
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">Net Change</span>
                <TrendingUp className={`w-4 h-4 ${burdenShift.netChange < 0 ? 'text-green-500' : 'text-red-500'}`} />
              </div>
              <p className={`text-2xl font-bold ${burdenShift.netChange < 0 ? 'text-green-600' : 'text-red-600'}`}>
                {burdenShift.netChange > 0 ? '+' : ''}{burdenShift.netChange.toFixed(1)}%
              </p>
            </div>
          </div>
        )}

        {migrationInsights && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Insights</h3>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2"></div>
                <p className="text-sm text-gray-700">
                  <strong>Overall Trend:</strong> {migrationInsights.overallTrend}
                </p>
              </div>
              {migrationInsights.scopeTrends.map((trend, idx) => (
                <div key={idx} className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <p className="text-sm text-gray-700">{trend}</p>
                </div>
              ))}
              {migrationInsights.recommendations.map((rec, idx) => (
                <div key={idx} className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                  <p className="text-sm text-gray-700">
                    <strong>Recommendation:</strong> {rec}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  /**
   * Render Pareto Analysis Tab
   */
  const renderParetoAnalysis = () => {
    if (paretoData.length === 0) {
      return (
        <div className="text-center py-12">
          <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">No Pareto data available</p>
          <p className="text-sm text-gray-500">Add emissions to see hotspot analysis</p>
        </div>
      );
    }

    const paretoThreshold = 80;

    return (
      <div className="space-y-6">
        {selectedParent && (
          <div className="flex items-center space-x-2 text-sm">
            <button 
              onClick={resetDrillDown}
              className="text-emerald-600 hover:text-emerald-700"
            >
              All Sources
            </button>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <span className="text-gray-900 font-medium">{selectedParent}</span>
          </div>
        )}

        {paretoInsights && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Target className="w-5 h-5 text-emerald-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-emerald-900">80/20 Rule Applied</h4>
                <p className="text-sm text-emerald-800 mt-1">{paretoInsights.summary}</p>
                <p className="text-sm text-emerald-700 mt-2">
                  <strong>Risk Level:</strong> {paretoInsights.risk}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {selectedParent ? `${selectedParent} Breakdown` : 'Emission Hotspots'}
            </h3>
            {selectedParent && (
              <button
                onClick={resetDrillDown}
                className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center space-x-1"
              >
                <ChevronUp className="w-4 h-4" />
                <span>Back to Overview</span>
              </button>
            )}
          </div>
          
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={paretoData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45} 
                  textAnchor="end" 
                  height={120}
                  interval={0}
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  yAxisId="left" 
                  orientation="left" 
                  label={{ value: 'Emissions (CO₂e)', angle: -90, position: 'insideLeft' }} 
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right" 
                  label={{ value: 'Cumulative %', angle: 90, position: 'insideRight' }} 
                />
                <Tooltip />
                <Legend />
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

        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Detailed Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Source</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Emissions (CO₂e)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Entries</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">% of Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Cumulative %</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Priority</th>
                  {!selectedParent && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Action</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paretoData.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{formatLargeNumber(item.value)}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{item.count}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{item.percentage.toFixed(1)}%</td>
                    <td className="px-6 py-4 text-sm text-gray-700">
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
                        <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                          High
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                          Low
                        </span>
                      )}
                    </td>
                    {!selectedParent && (
                      <td className="px-6 py-4 text-sm">
                        {item.canDrill ? (
                          <button
                            onClick={() => handleDrillDown(item)}
                            className="text-emerald-600 hover:text-emerald-700 flex items-center space-x-1"
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

        {paretoInsights && paretoInsights.recommendations && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommendations</h3>
            <div className="space-y-3">
              {paretoInsights.recommendations.map((rec, idx) => (
                <div key={idx} className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2"></div>
                  <p className="text-sm text-gray-700">{rec}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  /**
   * NEW: Render Trajectory Analysis Tab
   */
  const renderTrajectoryAnalysis = () => {
    if (!trajectoryData) {
      return (
        <div className="text-center py-12">
          <TrendingDown className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">No trajectory data available</p>
          <p className="text-sm text-gray-500">Add emissions data to see trajectory analysis</p>
        </div>
      );
    }

    const { historical, targetPathway, baseline, alignment } = trajectoryData;

    // Merge historical and target data for chart
    const chartData = historical.map(h => {
      const target = targetPathway.find(t => t.period === h.period);
      return {
        period: h.period,
        actual: h.total,
        target: target?.target || null
      };
    });

    // Add future target points
    targetPathway.forEach(t => {
      if (!chartData.find(d => d.period === t.period)) {
        chartData.push({
          period: t.period,
          actual: null,
          target: t.target
        });
      }
    });

    chartData.sort((a, b) => a.period.localeCompare(b.period));

    return (
      <div className="space-y-6">
        {/* Scenario Selector */}
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-700">Target Scenario</h3>
              <p className="text-xs text-gray-500 mt-1">Select climate target pathway</p>
            </div>
            <select
              value={selectedScenario}
              onChange={(e) => setSelectedScenario(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="1.5C">1.5°C Pathway (4.2% annual reduction)</option>
              <option value="2C">2°C Pathway (2.9% annual reduction)</option>
              <option value="2C_low">2°C Low Ambition (2.0% annual reduction)</option>
            </select>
          </div>
        </div>

        {/* Alignment Status */}
        <div className={`${alignment.onTrack ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border rounded-lg p-4`}>
          <div className="flex items-start space-x-3">
            {alignment.onTrack ? (
              <TrendingDown className="w-5 h-5 text-green-600 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
            )}
            <div>
              <h4 className={`font-medium ${alignment.onTrack ? 'text-green-900' : 'text-red-900'}`}>
                {alignment.onTrack ? 'On Track' : 'Off Track'}
              </h4>
              <p className={`text-sm mt-1 ${alignment.onTrack ? 'text-green-800' : 'text-red-800'}`}>
                {alignment.message}
              </p>
              {!alignment.onTrack && (
                <p className="text-sm text-red-700 mt-2">
                  <strong>Action Required:</strong> Increase reduction efforts to meet {selectedScenario} targets
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Trajectory Chart */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Emissions Trajectory vs {selectedScenario} Target
          </h3>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis label={{ value: 'Emissions (tCO₂e)', angle: -90, position: 'insideLeft' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="actual"
                  stroke="#10b981"
                  fill="#10b98133"
                  strokeWidth={3}
                  name="Actual Emissions"
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="target"
                  stroke="#ef4444"
                  strokeWidth={3}
                  strokeDasharray="5 5"
                  name={`${selectedScenario} Target`}
                  dot={false}
                />
                <ReferenceLine
                  x={baseline.year.toString()}
                  stroke="#9ca3af"
                  strokeDasharray="3 3"
                  label={{ value: 'Baseline', position: 'top' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <p className="text-sm font-medium text-gray-600">Baseline Year</p>
            <p className="text-2xl font-bold text-gray-900">{baseline.year}</p>
            <p className="text-xs text-gray-500 mt-1">{formatLargeNumber(baseline.emissions)} tCO₂e</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-4">
            <p className="text-sm font-medium text-gray-600">Required Rate</p>
            <p className="text-2xl font-bold text-orange-600">
              {alignment.requiredReductionRate.toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500 mt-1">Annual reduction needed</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-4">
            <p className="text-sm font-medium text-gray-600">Current Rate</p>
            <p className={`text-2xl font-bold ${alignment.currentReductionRate >= alignment.requiredReductionRate ? 'text-green-600' : 'text-red-600'}`}>
              {alignment.currentReductionRate.toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500 mt-1">Actual annual reduction</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-4">
            <p className="text-sm font-medium text-gray-600">Deviation</p>
            <p className={`text-2xl font-bold ${Math.abs(alignment.deviationPercent) <= 5 ? 'text-green-600' : 'text-red-600'}`}>
              {alignment.deviationPercent > 0 ? '+' : ''}{alignment.deviationPercent.toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500 mt-1">From target pathway</p>
          </div>
        </div>

        {/* Recommendations */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommendations</h3>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2"></div>
              <p className="text-sm text-gray-700">
                Set annual reduction targets of at least {alignment.requiredReductionRate.toFixed(1)}% to meet {selectedScenario} goals
              </p>
            </div>
            {!alignment.onTrack && (
              <>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                  <p className="text-sm text-gray-700">
                    Accelerate reduction initiatives - current pace is insufficient
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                  <p className="text-sm text-gray-700">
                    Focus on high-impact opportunities identified in Hotspot Analysis
                  </p>
                </div>
              </>
            )}
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <p className="text-sm text-gray-700">
                Engage suppliers and partners to address Scope 3 emissions
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /**
   * NEW: Render Velocity & Acceleration Analysis Tab
   */
  const renderVelocityAnalysis = () => {
    if (!velocityData) {
      return (
        <div className="text-center py-12">
          <Zap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">No velocity data available</p>
          <p className="text-sm text-gray-500">Add emissions from multiple periods to see velocity analysis</p>
        </div>
      );
    }

    const { periods, summary } = velocityData;

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <p className="text-sm font-medium text-gray-600">Avg Velocity</p>
            <p className={`text-2xl font-bold ${summary.avgVelocity < 0 ? 'text-green-600' : 'text-red-600'}`}>
              {summary.avgVelocity > 0 ? '+' : ''}{summary.avgVelocity.toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500 mt-1">Period-over-period change</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-4">
            <p className="text-sm font-medium text-gray-600">Avg Acceleration</p>
            <p className={`text-2xl font-bold ${summary.avgAcceleration < 0 ? 'text-green-600' : 'text-red-600'}`}>
              {summary.avgAcceleration > 0 ? '+' : ''}{summary.avgAcceleration.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Change in velocity</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-4">
            <p className="text-sm font-medium text-gray-600">Trend Direction</p>
            <p className="text-2xl font-bold text-gray-900 capitalize">
              {summary.trendDirection}
            </p>
            <p className="text-xs text-gray-500 mt-1">Overall momentum</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-4">
            <p className="text-sm font-medium text-gray-600">Inflection Points</p>
            <p className="text-2xl font-bold text-blue-600">
              {summary.inflectionPoints}
            </p>
            <p className="text-xs text-gray-500 mt-1">Trend reversals detected</p>
          </div>
        </div>

        {/* Velocity Chart */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Emissions Velocity (Rate of Change)
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={periods}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis yAxisId="left" label={{ value: 'Velocity (%)', angle: -90, position: 'insideLeft' }} />
                <YAxis yAxisId="right" orientation="right" label={{ value: 'Acceleration', angle: 90, position: 'insideRight' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar 
                  yAxisId="left" 
                  dataKey="velocity" 
                  fill="#10b981"
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
                      return <circle key={`inflection-${index}`} cx={cx} cy={cy} r={8} fill="#f59e0b" stroke="#fff" strokeWidth={2} />;
                    }
                    return <circle key={`dot-${index}`} cx={cx} cy={cy} r={4} fill="#ef4444" />;
                  }}
                />
                <ReferenceLine yAxisId="left" y={0} stroke="#9ca3af" strokeDasharray="3 3" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="text-sm text-gray-500 mt-4 text-center">
            ⚠️ Orange dots indicate inflection points (trend reversals)
          </p>
        </div>

        {/* Detailed Table */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Period-by-Period Analysis</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Period</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Emissions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Velocity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Acceleration</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {periods.map((period, index) => (
                  <tr key={index} className={period.isInflectionPoint ? 'bg-yellow-50' : 'hover:bg-gray-50'}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{period.period}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{formatLargeNumber(period.emissions)} tCO₂e</td>
                    <td className="px-6 py-4 text-sm">
                      {period.velocity !== null ? (
                        <span className={period.velocity < 0 ? 'text-green-600' : 'text-red-600'}>
                          {period.velocity > 0 ? '+' : ''}{period.velocity.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {period.acceleration !== null ? (
                        <span className={period.acceleration < 0 ? 'text-green-600' : 'text-red-600'}>
                          {period.acceleration > 0 ? '+' : ''}{period.acceleration.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {period.isInflectionPoint ? (
                        <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                          Inflection Point
                        </span>
                      ) : period.velocity !== null && period.velocity < 0 ? (
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                          Decreasing
                        </span>
                      ) : period.velocity !== null && period.velocity > 0 ? (
                        <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                          Increasing
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                          Baseline
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Insights */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Insights</h3>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2"></div>
              <p className="text-sm text-gray-700">
                <strong>Overall Momentum:</strong> Emissions are {summary.trendDirection}
              </p>
            </div>
            {summary.avgVelocity < 0 ? (
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <p className="text-sm text-gray-700">
                  Positive progress - emissions declining at {Math.abs(summary.avgVelocity).toFixed(1)}% per period on average
                </p>
              </div>
            ) : (
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                <p className="text-sm text-gray-700">
                  Emissions increasing at {summary.avgVelocity.toFixed(1)}% per period - immediate action required
                </p>
              </div>
            )}
            {summary.inflectionPoints > 0 && (
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                <p className="text-sm text-gray-700">
                  {summary.inflectionPoints} trend reversal(s) detected - investigate what changed during these periods
                </p>
              </div>
            )}
            {summary.avgAcceleration < 0 ? (
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <p className="text-sm text-gray-700">
                  <strong>Good news:</strong> Rate of reduction is accelerating - current initiatives are working
                </p>
              </div>
            ) : (
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                <p className="text-sm text-gray-700">
                  <strong>Warning:</strong> Reduction efforts are slowing down - scale up interventions
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  /**
   * NEW: Render MACC Analysis Tab
   */
  const renderMACCAnalysis = () => {
    if (!maccData || maccOpportunities.length === 0) {
      return (
        <div className="text-center py-12">
          <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">No MACC opportunities defined</p>
          <p className="text-sm text-gray-500 mb-6">
            Add reduction opportunities to see cost-effectiveness analysis
          </p>
          <button
            onClick={() => setShowMaccModal(true)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center space-x-2 mx-auto"
          >
            <Plus className="w-5 h-5" />
            <span>Add Opportunity</span>
          </button>
        </div>
      );
    }

    const { opportunities, summary } = maccData;

    return (
      <div className="space-y-6">
        {/* Add Opportunity Button */}
        <div className="flex justify-end">
          <button
            onClick={() => setShowMaccModal(true)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Add Opportunity</span>
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <p className="text-sm font-medium text-gray-600">Total Potential</p>
            <p className="text-2xl font-bold text-emerald-600">
              {formatLargeNumber(summary.totalAbatementPotential)}
            </p>
            <p className="text-xs text-gray-500 mt-1">tCO₂e reduction</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-4">
            <p className="text-sm font-medium text-gray-600">Total Investment</p>
            <p className="text-2xl font-bold text-gray-900">
              ${formatLargeNumber(Math.abs(summary.totalCost))}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {summary.totalCost < 0 ? 'Net savings' : 'Required investment'}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-4">
            <p className="text-sm font-medium text-gray-600">Avg Cost/Ton</p>
            <p className={`text-2xl font-bold ${summary.avgCostPerTon < 0 ? 'text-green-600' : 'text-gray-900'}`}>
              ${Math.abs(summary.avgCostPerTon).toFixed(0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Per tCO₂e</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-4">
            <p className="text-sm font-medium text-gray-600">Cost-Effective</p>
            <p className="text-2xl font-bold text-blue-600">
              {summary.costEffectiveOpportunities}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Of {opportunities.length} total
            </p>
          </div>
        </div>

        {/* MACC Curve */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Marginal Abatement Cost Curve
          </h3>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={opportunities} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" label={{ value: 'Cost per tCO₂e ($)', position: 'bottom' }} />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  width={150}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                          <p className="font-semibold text-gray-900">{data.name}</p>
                          <p className="text-sm text-gray-700">Cost: ${data.costPerTon.toFixed(2)}/tCO₂e</p>
                          <p className="text-sm text-gray-700">Potential: {formatLargeNumber(data.abatementPotential)} tCO₂e</p>
                          <p className="text-sm text-gray-700">Total: ${formatLargeNumber(Math.abs(data.totalCost))}</p>
                          {data.paybackPeriod && (
                            <p className="text-sm text-gray-700">Payback: {data.paybackPeriod} years</p>
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
                <ReferenceLine x={0} stroke="#9ca3af" strokeWidth={2} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-sm text-gray-500 mt-4 text-center">
            Green bars = cost-saving opportunities | Red bars = investment required
          </p>
        </div>

        {/* Opportunities Table */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Reduction Opportunities</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Opportunity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Abatement Potential</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Cost/tCO₂e</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Total Cost</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Payback</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Priority</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {opportunities.map((opp, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{opp.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{opp.category}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {formatLargeNumber(opp.abatementPotential)} tCO₂e
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={opp.costPerTon < 0 ? 'text-green-600' : 'text-red-600'}>
                        ${Math.abs(opp.costPerTon).toFixed(2)}
                        {opp.costPerTon < 0 && ' (saving)'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      ${formatLargeNumber(Math.abs(opp.totalCost))}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {opp.paybackPeriod ? `${opp.paybackPeriod} years` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        opp.priority === 'high' 
                          ? 'bg-green-100 text-green-800'
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

        {/* Recommendations */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommendations</h3>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
              <p className="text-sm text-gray-700">
                Prioritize {summary.costEffectiveOpportunities} cost-saving opportunities (negative cost/ton) for immediate implementation
              </p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <p className="text-sm text-gray-700">
                Implementing all opportunities could reduce emissions by {formatLargeNumber(summary.totalAbatementPotential)} tCO₂e
              </p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
              <p className="text-sm text-gray-700">
                Focus on opportunities with payback periods under 3 years for quick wins
              </p>
            </div>
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

  // Loading state
  if (loading && !overviewStats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-4" />
          <div className="text-lg text-gray-600">Loading analytics...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader 
          title="Analytics"
          breadcrumb={[{ label: 'App', href: '/' }, { label: 'Analytics' }]}
        />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Analytics</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={loadAllData}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Advanced Analytics"
        breadcrumb={[{ label: 'App', href: '/' }, { label: 'Analytics' }]}
        action={
          <div className="flex items-center space-x-2">
            {user?.organisation?.name && (
              <span className="text-sm text-gray-600">{user.organisation.name}</span>
            )}
            <span className="text-sm text-gray-600">
              Updated: {lastUpdate.toLocaleTimeString()}
            </span>
            <button 
              onClick={loadAllData}
              className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button 
              onClick={handleExport}
              className="flex items-center space-x-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="border-b">
          <nav className="flex space-x-8 px-6 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {loading && activeTab !== 'overview' ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
          ) : (
            <>
              {activeTab === 'overview' && renderOverview()}
              {activeTab === 'migration' && renderMigrationAnalysis()}
              {activeTab === 'pareto' && renderParetoAnalysis()}
              {activeTab === 'trajectory' && renderTrajectoryAnalysis()}
              {activeTab === 'velocity' && renderVelocityAnalysis()}
              {activeTab === 'macc' && renderMACCAnalysis()}
            </>
          )}
        </div>
      </div>
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Add MACC Opportunity</h3>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Opportunity Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g., LED Lighting Upgrade"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Abatement Potential (tCO₂e/year)
            </label>
            <input
              type="number"
              required
              step="0.01"
              value={formData.abatementPotential}
              onChange={(e) => setFormData({ ...formData, abatementPotential: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              placeholder="500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cost per tCO₂e ($)
            </label>
            <input
              type="number"
              required
              step="0.01"
              value={formData.costPerTon}
              onChange={(e) => setFormData({ ...formData, costPerTon: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              placeholder="-25 for savings, +50 for cost"
            />
            <p className="text-xs text-gray-500 mt-1">Negative values indicate cost savings</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payback Period (years, optional)
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.paybackPeriod}
              onChange={(e) => setFormData({ ...formData, paybackPeriod: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              placeholder="2.5"
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
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