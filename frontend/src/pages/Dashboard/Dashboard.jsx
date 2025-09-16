// Updated Dashboard.jsx with real emissions data and proper notifications
import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { RefreshCw, Plus, BarChart3, Filter } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { dashboardAPI } from '../../services/api';
import { getEmissions, getEmissionsStats } from '../../utils/localStorage';
import PageHeader from '../../components/PageHeader/PageHeader';
import NotificationCard from '../../components/NotificationCard/NotificationCard';

const Dashboard = () => {
  const { user } = useAuth();
  const { notifications } = useNotifications();
  const [dashboardData, setDashboardData] = useState({
    scope1: { total: 0, percentage: 0, topCategories: [] },
    scope2: { total: 0, percentage: 0, topCategories: [] },
    scope3: { total: 0, percentage: 0, topCategories: [] },
    totalEmissions: 0
  });
  const [loading, setLoading] = useState(true);

  // Colors for each scope's pie chart
  const COLORS = {
    scope1: ['#065f46', '#047857', '#059669'], // Different shades of emerald
    scope2: ['#1e40af', '#1d4ed8', '#2563eb'], // Different shades of blue
    scope3: ['#7c2d12', '#dc2626', '#ef4444']  // Different shades of red
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Get real emissions data from localStorage
      const allEmissions = getEmissions();
      const stats = getEmissionsStats();
      
      // Process the data for dashboard display
      const processedData = processDashboardData(stats, allEmissions);
      setDashboardData(processedData);
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const processDashboardData = (stats, emissions) => {
    const totalEmissions = stats.scope1.total + stats.scope2.total + stats.scope3.total;
    
    const processScope = (scopeData, scopeTotal) => {
      // Get top 3 categories for this scope
      const topCategories = Object.entries(scopeData.activities)
        .map(([name, data]) => ({
          name: name.length > 25 ? name.substring(0, 25) + '...' : name,
          fullName: name,
          value: data.total,
          percentage: scopeTotal > 0 ? (data.total / scopeTotal) * 100 : 0
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);

      // If there are fewer than 3 categories, fill with placeholder data
      while (topCategories.length < 3) {
        topCategories.push({
          name: 'No Data',
          fullName: 'No Data Available',
          value: 0,
          percentage: 0
        });
      }

      return {
        total: scopeTotal,
        percentage: totalEmissions > 0 ? (scopeTotal / totalEmissions) * 100 : 0,
        topCategories
      };
    };

    return {
      scope1: processScope(stats.scope1, stats.scope1.total),
      scope2: processScope(stats.scope2, stats.scope2.total),
      scope3: processScope(stats.scope3, stats.scope3.total),
      totalEmissions
    };
  };

  const formatNumber = (value) => {
    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
    if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
    return value.toFixed(1);
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900">{data.payload.fullName}</p>
          <p style={{ color: data.color }}>
            Value: {formatNumber(data.value)} CO₂e
          </p>
          <p style={{ color: data.color }}>
            Percentage: {data.payload.percentage.toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  const handleGenerateInsight = (scope) => {
    // Navigate to analytics with specific scope filter
    window.location.href = `/analytics?scope=${scope}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-green-100 to-emerald-50 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Good Morning, {user?.name || 'Jhon Doe'} 👋
            </h1>
            <p className="text-gray-600">
              Real-Time Carbon Emission Insights to Help You Make Smarter,
              More Sustainable Choices.
            </p>
          </div>
          <div className="hidden md:block">
            <div className="w-32 h-32 bg-green-200 rounded-full flex items-center justify-center">
              <svg className="w-20 h-20 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Page Header */}
      <PageHeader 
        title="Dashboard"
        breadcrumb={[{ label: 'App', href: '/' }, { label: 'Dashboard' }]}
        action={
          <button 
            onClick={fetchDashboardData}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-lg"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        }
      />

      {/* Emission Scope Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {['scope1', 'scope2', 'scope3'].map((scope, index) => {
          const scopeData = dashboardData[scope];
          const scopeNumber = index + 1;
          const colors = COLORS[scope];
          
          return (
            <div key={scope} className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Scope {scopeNumber}
                </h3>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => window.location.href = `/input?scope=${scopeNumber}`}
                    className="text-emerald-600 text-sm font-medium hover:text-emerald-700"
                  >
                    Add
                  </button>
                  <button 
                    onClick={() => window.location.href = '/monitor'}
                    className="text-emerald-600 text-sm font-medium hover:text-emerald-700"
                  >
                    Monitor
                  </button>
                </div>
              </div>

              {/* Pie Chart */}
              <div className="h-48 mb-4 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={scopeData.topCategories}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {scopeData.topCategories.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={colors[idx]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Total in center */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">
                      {formatNumber(scopeData.total)}
                    </div>
                    <div className="text-xs text-gray-600">CO₂e</div>
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="space-y-1 mb-4">
                {scopeData.topCategories.map((category, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-full mr-2" 
                        style={{ backgroundColor: colors[idx] }}
                      ></div>
                      <span className="text-gray-700 max-w-[120px] truncate" title={category.fullName}>
                        {category.name}
                      </span>
                    </div>
                    <span className="text-gray-600">
                      {category.percentage.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>

              {/* Description */}
              <p className="text-sm text-gray-600 mb-4 text-center">
                {scopeNumber === 1 && "Direct emissions from owned or controlled sources like fuel combustion and company vehicles."}
                {scopeNumber === 2 && "Indirect emissions from purchased electricity, steam, heating, and cooling."}
                {scopeNumber === 3 && "All other indirect emissions from business travel, employee commuting, and supply chain."}
              </p>

              {/* Generate Insight Button */}
              <button 
                onClick={() => handleGenerateInsight(scopeNumber)}
                className="w-full bg-emerald-600 text-white py-2 px-4 rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center space-x-2"
              >
                <BarChart3 className="w-4 h-4" />
                <span>Generate Insight</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Emissions</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatNumber(dashboardData.totalEmissions)} CO₂e
              </p>
            </div>
            <div className="p-2 bg-gray-100 rounded-lg">
              <BarChart3 className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Scope 1</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatNumber(dashboardData.scope1.total)} CO₂e
              </p>
            </div>
            <div className="p-2 bg-emerald-100 rounded-lg">
              <div className="w-6 h-6 bg-emerald-600 rounded"></div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Scope 2</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatNumber(dashboardData.scope2.total)} CO₂e
              </p>
            </div>
            <div className="p-2 bg-blue-100 rounded-lg">
              <div className="w-6 h-6 bg-blue-600 rounded"></div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Scope 3</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatNumber(dashboardData.scope3.total)} CO₂e
              </p>
            </div>
            <div className="p-2 bg-red-100 rounded-lg">
              <div className="w-6 h-6 bg-red-600 rounded"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications Section */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
            <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded-full">
              {notifications?.length || 0}
            </span>
          </div>
          <button className="flex items-center space-x-2 text-gray-500 hover:text-gray-700">
            <Filter className="w-4 h-4" />
            <span>Filter</span>
          </button>
        </div>
        
        <div className="p-6">
          {notifications && notifications.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {notifications.slice(0, 8).map((notification, index) => (
                <NotificationCard key={notification._id || index} notification={notification} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-2">No notifications</div>
              <p className="text-sm text-gray-500">You're all caught up!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;