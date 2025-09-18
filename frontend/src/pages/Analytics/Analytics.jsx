// Updated Analytics.jsx with automatic refresh and real-time data updates
import { useState, useEffect } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Filter,
  Download,
  Eye,
  Lock,
  RefreshCw,
  Database
} from 'lucide-react';
import { useActivity } from '../../context/ActivityContext';
import { analyticsAPI } from '../../services/api';
import { getEmissions, getEmissionsStats } from '../../utils/localStorage';
import PageHeader from '../../components/PageHeader/PageHeader';
import toast from 'react-hot-toast';

const Analytics = () => {
  const { logPageView, logActivity } = useActivity();
  const [analyticsData, setAnalyticsData] = useState({
    trends: [],
    scopeComparison: [],
    monthlyData: [],
    scopeDistributions: {
      scope1: [],
      scope2: [],
      scope3: []
    },
    totalEmissions: {
      scope1: 0,
      scope2: 0,
      scope3: 0
    },
    entryCounts: {
      scope1: 0,
      scope2: 0,
      scope3: 0,
      total: 0
    }
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [filters, setFilters] = useState({
    dateRange: '12months',
    scope: 'all'
  });
  const [autoRefresh, setAutoRefresh] = useState(true);

  const scopeColors = {
    scope1: ['#065f46', '#047857', '#059669'],
    scope2: ['#1e40af', '#1d4ed8', '#2563eb'], 
    scope3: ['#7c2d12', '#dc2626', '#ef4444']
  };

  useEffect(() => {
    logPageView('Analytics');
    loadAnalyticsData();
    
    // Listen for real-time updates when emissions are added
    const handleEmissionAdded = () => {
      if (autoRefresh) {
        setTimeout(loadAnalyticsData, 500); // Small delay to ensure localStorage is updated
        toast.success('Analytics updated with new data!');
      }
    };
    
    window.addEventListener('emission-added', handleEmissionAdded);
    
    // Set up periodic refresh every 2 minutes if auto-refresh is enabled
    let refreshInterval;
    if (autoRefresh) {
      refreshInterval = setInterval(loadAnalyticsData, 2 * 60 * 1000);
    }
    
    return () => {
      window.removeEventListener('emission-added', handleEmissionAdded);
      if (refreshInterval) clearInterval(refreshInterval);
    };
  }, [autoRefresh]);

  useEffect(() => {
    loadAnalyticsData();
  }, [filters]);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      
      // Get real emissions data from localStorage
      const allEmissions = getEmissions();
      const stats = getEmissionsStats();
      
      // Process emissions for analytics
      const processedData = processEmissionsForAnalytics(allEmissions, stats);
      setAnalyticsData(processedData);
      setLastUpdate(new Date());
      
      // Log analytics access
      logActivity('viewed_analytics', 'analytics', null, `Viewed analytics with ${allEmissions.length} total emissions`);
      
    } catch (error) {
      console.error('Error loading analytics data:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const processEmissionsForAnalytics = (emissions, stats) => {
    // Apply date range filter
    const filteredEmissions = applyDateRangeFilter(emissions);
    
    // Create trends data by month
    const monthlyTrends = createMonthlyTrends(filteredEmissions);
    
    // Create scope distributions (top 3 categories per scope)
    const scopeDistributions = createScopeDistributions(stats);
    
    // Calculate total emissions per scope
    const totalEmissions = {
      scope1: stats.scope1.total,
      scope2: stats.scope2.total,
      scope3: stats.scope3.total
    };
    
    // Calculate entry counts per scope
    const entryCounts = {
      scope1: emissions.filter(e => e.scope === 1).length,
      scope2: emissions.filter(e => e.scope === 2).length,
      scope3: emissions.filter(e => e.scope === 3).length,
      total: emissions.length
    };
    
    // Create scope comparison data
    const scopeComparison = createScopeComparison(filteredEmissions);

    return {
      trends: monthlyTrends,
      scopeComparison: scopeComparison,
      monthlyData: monthlyTrends,
      scopeDistributions,
      totalEmissions,
      entryCounts
    };
  };

  const applyDateRangeFilter = (emissions) => {
    if (filters.dateRange === 'all') return emissions;
    
    const now = new Date();
    let startDate;
    
    switch (filters.dateRange) {
      case '7days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '3months':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '6months':
        startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case '12months':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        return emissions;
    }
    
    return emissions.filter(emission => {
      const emissionDate = new Date(emission.startDate || emission.createdAt);
      return emissionDate >= startDate;
    });
  };

  const createMonthlyTrends = (emissions) => {
    const monthlyData = {};
    
    emissions.forEach(emission => {
      const date = new Date(emission.startDate || emission.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthName,
          scope1: 0,
          scope2: 0,
          scope3: 0,
          total: 0,
          count1: 0,
          count2: 0,
          count3: 0
        };
      }
      
      const scopeKey = `scope${emission.scope}`;
      const countKey = `count${emission.scope}`;
      const emissionValue = emission.calculatedEmissions || (emission.amount * (emission.factor || 1));
      
      monthlyData[monthKey][scopeKey] += emissionValue;
      monthlyData[monthKey][countKey] += 1;
      monthlyData[monthKey].total += emissionValue;
    });
    
    return Object.values(monthlyData)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12); // Last 12 months
  };

  const createScopeDistributions = (stats) => {
    const distributions = {};
    
    ['scope1', 'scope2', 'scope3'].forEach(scopeKey => {
      const activities = stats[scopeKey].activities;
      const total = stats[scopeKey].total;
      
      // Get top 5 activities for this scope (increased from 3)
      const sortedActivities = Object.entries(activities)
        .map(([name, data]) => ({
          name: name.length > 30 ? name.substring(0, 30) + '...' : name,
          fullName: name,
          value: data.total,
          percentage: total > 0 ? ((data.total / total) * 100) : 0,
          count: data.count
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
      
      distributions[scopeKey] = sortedActivities;
    });
    
    return distributions;
  };

  const createScopeComparison = (emissions) => {
    const monthlyComparison = {};
    
    emissions.forEach(emission => {
      const date = new Date(emission.startDate || emission.createdAt);
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });
      
      if (!monthlyComparison[monthName]) {
        monthlyComparison[monthName] = { 
          month: monthName, 
          scope1: 0, 
          scope2: 0, 
          scope3: 0,
          entries1: 0,
          entries2: 0,
          entries3: 0
        };
      }
      
      const scopeKey = `scope${emission.scope}`;
      const entriesKey = `entries${emission.scope}`;
      const emissionValue = emission.calculatedEmissions || (emission.amount * (emission.factor || 1));
      
      monthlyComparison[monthName][scopeKey] += emissionValue;
      monthlyComparison[monthName][entriesKey] += 1;
    });
    
    return Object.values(monthlyComparison);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleExportData = () => {
    try {
      const exportData = {
        summary: {
          totalEmissions: analyticsData.totalEmissions.scope1 + analyticsData.totalEmissions.scope2 + analyticsData.totalEmissions.scope3,
          totalEntries: analyticsData.entryCounts.total,
          generatedAt: new Date().toISOString(),
          filters: filters
        },
        emissionsByScope: analyticsData.totalEmissions,
        entriesByScope: analyticsData.entryCounts,
        monthlyTrends: analyticsData.trends,
        scopeDistributions: analyticsData.scopeDistributions
      };
      
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      const url = window.URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `carbon_analytics_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Analytics data exported successfully!');
      logActivity('exported_analytics', 'analytics', null, 'Exported analytics data as JSON');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    }
  };

  const formatNumber = (value) => {
    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
    if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
    return value.toFixed(1);
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {formatNumber(entry.value)} CO₂e
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const PieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg max-w-xs">
          <p className="font-semibold text-gray-900">{data.payload.fullName || data.payload.name}</p>
          <p style={{ color: data.color }}>
            Total: {formatNumber(data.value)} CO₂e
          </p>
          <p style={{ color: data.color }}>
            Percentage: {data.payload.percentage.toFixed(1)}%
          </p>
          <p className="text-gray-600 text-sm">
            Entries: {data.payload.count}
          </p>
        </div>
      );
    }
    return null;
  };

  const renderScopePieChart = (scopeKey, title) => {
    const scopeNumber = scopeKey.slice(-1);
    const data = analyticsData.scopeDistributions[scopeKey];
    const total = analyticsData.totalEmissions[scopeKey];
    const entryCount = analyticsData.entryCounts[scopeKey];
    const colors = scopeColors[scopeKey];

    if (!data || data.length === 0) {
      return (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
          <div className="h-64 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Database className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p>No data available for {title}</p>
              <p className="text-sm">Add some emissions to see analytics</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <div className="text-right">
            <div className="text-sm text-gray-600">{entryCount} entries</div>
            <div className="flex items-center space-x-2">
              <Eye className="w-4 h-4 text-gray-400" />
            </div>
          </div>
        </div>
        <div className="h-64 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Total in center */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="text-xl font-bold text-gray-900">
                {formatNumber(total)}
              </div>
              <div className="text-sm text-gray-600">CO₂e Total</div>
              <div className="text-xs text-gray-500">{entryCount} entries</div>
            </div>
          </div>
        </div>
        
        {/* Legend */}
        <div className="mt-4 space-y-2">
          {data.map((entry, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <div className="flex items-center">
                <div 
                  className="w-3 h-3 rounded-full mr-2" 
                  style={{ backgroundColor: colors[index % colors.length] }}
                ></div>
                <span className="text-gray-700 max-w-xs truncate" title={entry.fullName}>
                  {entry.name}
                </span>
              </div>
              <div className="flex items-center space-x-2 text-gray-600">
                <span>{entry.percentage.toFixed(1)}%</span>
                <span className="text-xs">({entry.count} entries)</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-4" />
          <div className="text-lg text-gray-600">Loading analytics...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader 
        title="Analytics"
        breadcrumb={[
          { label: 'App', href: '/' },
          { label: 'Analytics' }
        ]}
        action={
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
              <span className="text-sm text-gray-600">
                {autoRefresh ? 'Auto-refresh: ON' : 'Auto-refresh: OFF'}
              </span>
            </div>
            <button 
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center space-x-2 px-3 py-1 rounded-lg text-sm ${
                autoRefresh 
                  ? 'text-emerald-600 border border-emerald-200 bg-emerald-50' 
                  : 'text-gray-600 border border-gray-300'
              }`}
            >
              <span>Auto-refresh</span>
            </button>
            <button 
              onClick={loadAnalyticsData}
              className="flex items-center space-x-2 text-emerald-600 border border-emerald-200 px-3 py-1 rounded-lg hover:bg-emerald-50"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="text-sm">Refresh</span>
            </button>
          </div>
        }
      />

      {/* Filter Controls */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <select
              value={filters.dateRange}
              onChange={(e) => handleFilterChange('dateRange', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="3months">Last 3 Months</option>
              <option value="6months">Last 6 Months</option>
              <option value="12months">Last 12 Months</option>
              <option value="all">All Time</option>
            </select>

            <select
              value={filters.scope}
              onChange={(e) => handleFilterChange('scope', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Scopes</option>
              <option value="1">Scope 1</option>
              <option value="2">Scope 2</option>
              <option value="3">Scope 3</option>
            </select>

            <div className="text-sm text-gray-600">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </div>
          </div>

          <button 
            onClick={handleExportData}
            className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            <Download className="w-4 h-4" />
            <span>Export Data</span>
          </button>
        </div>
      </div>

      {/* Key Metrics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Entries</p>
              <p className="text-2xl font-bold text-gray-900">
                {analyticsData.entryCounts.total}
              </p>
              <p className="text-xs text-gray-500">Emission records</p>
            </div>
            <div className="p-2 bg-gray-100 rounded-lg">
              <Database className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Emissions</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatNumber(
                  analyticsData.totalEmissions.scope1 + 
                  analyticsData.totalEmissions.scope2 + 
                  analyticsData.totalEmissions.scope3
                )} CO₂e
              </p>
            </div>
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Scope 1</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatNumber(analyticsData.totalEmissions.scope1)} CO₂e
              </p>
              <p className="text-xs text-gray-500">{analyticsData.entryCounts.scope1} entries</p>
            </div>
            <div className="p-2 bg-emerald-100 rounded-lg">
              <div className="w-6 h-6 bg-emerald-600 rounded flex items-center justify-center">
                <span className="text-white text-sm font-bold">1</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Scope 2 & 3</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatNumber(analyticsData.totalEmissions.scope2 + analyticsData.totalEmissions.scope3)} CO₂e
              </p>
              <p className="text-xs text-gray-500">
                {analyticsData.entryCounts.scope2 + analyticsData.entryCounts.scope3} entries
              </p>
            </div>
            <div className="p-2 bg-blue-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Scope Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {renderScopePieChart('scope1', 'Scope 1 Distribution')}
        {renderScopePieChart('scope2', 'Scope 2 Distribution')}
        {renderScopePieChart('scope3', 'Scope 3 Distribution')}
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Emission Trends Chart */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Emission Trends</h3>
            <div className="flex items-center space-x-2">
              <Eye className="w-4 h-4 text-gray-400" />
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analyticsData.trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={formatNumber} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="scope1" 
                  stroke="#065f46" 
                  strokeWidth={2}
                  name="Scope 1"
                />
                <Line 
                  type="monotone" 
                  dataKey="scope2" 
                  stroke="#1e40af" 
                  strokeWidth={2}
                  name="Scope 2"
                />
                <Line 
                  type="monotone" 
                  dataKey="scope3" 
                  stroke="#7c2d12" 
                  strokeWidth={2}
                  name="Scope 3"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Scope Comparison Chart */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Monthly Scope Comparison</h3>
            <div className="flex items-center space-x-2">
              <Eye className="w-4 h-4 text-gray-400" />
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsData.scopeComparison}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={formatNumber} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="scope1" fill="#065f46" name="Scope 1" />
                <Bar dataKey="scope2" fill="#1e40af" name="Scope 2" />
                <Bar dataKey="scope3" fill="#7c2d12" name="Scope 3" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;