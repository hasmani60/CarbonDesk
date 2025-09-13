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
  Lock
} from 'lucide-react';
import { analyticsAPI } from '../../services/api';
import PageHeader from '../../components/PageHeader/PageHeader';
import toast from 'react-hot-toast';

const Analytics = () => {
  const [analyticsData, setAnalyticsData] = useState({
    trends: [],
    scopeComparison: [],
    monthlyData: [],
    topEmitters: []
  });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    dateRange: '12months',
    scope: 'all'
  });
  const [activeChart, setActiveChart] = useState('trends');

  // Sample data for demonstration
  const sampleData = {
    customerTrends: [
      { month: 'Jan', loyal: 250, new: 300, unique: 200 },
      { month: 'Feb', loyal: 280, new: 250, unique: 320 },
      { month: 'Mar', loyal: 200, new: 180, unique: 280 },
      { month: 'Apr', loyal: 150, new: 400, unique: 300 },
      { month: 'May', loyal: 180, new: 100, unique: 200 },
      { month: 'Jun', loyal: 320, new: 300, unique: 350 },
      { month: 'Jul', loyal: 200, new: 250, unique: 180 },
      { month: 'Aug', loyal: 100, new: 200, unique: 300 },
      { month: 'Sep', loyal: 350, new: 150, unique: 250 },
      { month: 'Oct', loyal: 100, new: 200, unique: 180 },
      { month: 'Nov', loyal: 250, new: 150, unique: 200 },
      { month: 'Dec', loyal: 200, new: 100, unique: 150 }
    ],
    monthlyComparison: [
      { month: 'Jan', scope1: 300, scope2: 400 },
      { month: 'Feb', scope1: 250, scope2: 350 },
      { month: 'Mar', scope1: 200, scope2: 250 },
      { month: 'Apr', scope1: 300, scope2: 400 },
      { month: 'May', scope1: 250, scope2: 350 },
      { month: 'Jun', scope1: 300, scope2: 320 },
      { month: 'Jul', scope1: 450, scope2: 380 }
    ],
    performanceData: [
      { month: 'January', blue: 1000, orange: -300, green: -600, red: -400, yellow: -200 },
      { month: 'February', blue: 950, orange: -600, green: -500, red: -200, yellow: -300 },
      { month: 'March', blue: 400, orange: -400, green: -300, red: -500, yellow: -200 },
      { month: 'April', blue: 100, orange: -500, green: -200, red: -600, yellow: -100 },
      { month: 'May', blue: -200, orange: -300, green: -100, red: -400, yellow: 200 },
      { month: 'June', blue: -300, orange: -100, green: 100, red: -200, yellow: 400 },
      { month: 'July', blue: 500, orange: 200, green: 300, red: 100, yellow: 200 }
    ],
    streamData: [
      { name: 'Para-1', 'Open Rate': 82, 'Reply Rate': 12, 'Link Open Rate': 55, 'Spam Rate': 8, 'Block Rate': 3 },
      { name: 'Para-2', 'Open Rate': 75, 'Reply Rate': 15, 'Link Open Rate': 48, 'Spam Rate': 12, 'Block Rate': 5 },
      { name: 'Para-3', 'Open Rate': 68, 'Reply Rate': 18, 'Link Open Rate': 52, 'Spam Rate': 15, 'Block Rate': 7 },
      { name: 'Para-4', 'Open Rate': 72, 'Reply Rate': 20, 'Link Open Rate': 45, 'Spam Rate': 18, 'Block Rate': 8 },
      { name: 'Para-5', 'Open Rate': 85, 'Reply Rate': 14, 'Link Open Rate': 58, 'Spam Rate': 6, 'Block Rate': 2 },
      { name: 'Para-6', 'Open Rate': 78, 'Reply Rate': 16, 'Link Open Rate': 50, 'Spam Rate': 10, 'Block Rate': 4 },
      { name: 'Para-7', 'Open Rate': 80, 'Reply Rate': 13, 'Link Open Rate': 53, 'Spam Rate': 9, 'Block Rate': 3 },
      { name: 'Para-8', 'Open Rate': 77, 'Reply Rate': 17, 'Link Open Rate': 47, 'Spam Rate': 13, 'Block Rate': 6 },
      { name: 'Para-9', 'Open Rate': 83, 'Reply Rate': 11, 'Link Open Rate': 56, 'Spam Rate': 7, 'Block Rate': 2 }
    ]
  };

  useEffect(() => {
    loadAnalyticsData();
  }, [filters]);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      // In real app, fetch from API
      // const trends = await analyticsAPI.getTrends(filters);
      // const comparison = await analyticsAPI.getScopeComparison(filters);
      
      // Using sample data for demonstration
      setAnalyticsData({
        trends: sampleData.customerTrends,
        scopeComparison: sampleData.monthlyComparison,
        monthlyData: sampleData.performanceData,
        topEmitters: sampleData.streamData
      });
    } catch (error) {
      console.error('Error loading analytics data:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const colors = ['#065f46', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg text-gray-600">Loading analytics...</div>
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
            <button className="flex items-center space-x-2 text-emerald-600 border border-emerald-200 px-3 py-1 rounded-lg hover:bg-emerald-50">
              <span className="text-sm">Hidden Graph</span>
            </button>
            <button className="flex items-center space-x-2 text-gray-600 border border-gray-300 px-3 py-1 rounded-lg hover:bg-gray-50">
              <Calendar className="w-4 h-4" />
              <span className="text-sm">Filter Date</span>
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
          </div>

          <div className="flex items-center space-x-2">
            <button className="p-2 text-gray-500 hover:text-gray-700 rounded-lg">
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Trends Chart */}
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
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="loyal" 
                  stroke="#F59E0B" 
                  strokeWidth={2}
                  name="Loyal Customers"
                />
                <Line 
                  type="monotone" 
                  dataKey="new" 
                  stroke="#10B981" 
                  strokeWidth={2}
                  name="New Customers"
                />
                <Line 
                  type="monotone" 
                  dataKey="unique" 
                  stroke="#EF4444" 
                  strokeWidth={2}
                  name="Unique Customers"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Comparison Chart */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Monthly Comparison</h3>
            <div className="flex items-center space-x-2">
              <Eye className="w-4 h-4 text-gray-400" />
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsData.scopeComparison}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="scope1" fill="#1E40AF" name="Scope 1" />
                <Bar dataKey="scope2" fill="#7C3AED" name="Scope 2" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Performance Data Chart */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Performance Analysis</h3>
            <div className="flex items-center space-x-2">
              <Eye className="w-4 h-4 text-gray-400" />
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analyticsData.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="blue" stroke="#3B82F6" strokeWidth={2} />
                <Line type="monotone" dataKey="orange" stroke="#F97316" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Stream Chart */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Detailed Metrics</h3>
            <div className="flex items-center space-x-2">
              <Lock className="w-4 h-4 text-gray-400" />
              <Eye className="w-4 h-4 text-gray-400" />
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analyticsData.topEmitters}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="Open Rate" 
                  stackId="1" 
                  stroke="#3B82F6" 
                  fill="#3B82F6" 
                  fillOpacity={0.6}
                />
                <Area 
                  type="monotone" 
                  dataKey="Reply Rate" 
                  stackId="1" 
                  stroke="#EF4444" 
                  fill="#EF4444" 
                  fillOpacity={0.6}
                />
                <Area 
                  type="monotone" 
                  dataKey="Link Open Rate" 
                  stackId="1" 
                  stroke="#F59E0B" 
                  fill="#F59E0B" 
                  fillOpacity={0.6}
                />
                <Area 
                  type="monotone" 
                  dataKey="Spam Rate" 
                  stackId="1" 
                  stroke="#10B981" 
                  fill="#10B981" 
                  fillOpacity={0.6}
                />
                <Area 
                  type="monotone" 
                  dataKey="Block Rate" 
                  stackId="1" 
                  stroke="#8B5CF6" 
                  fill="#8B5CF6" 
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Key Metrics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Emissions</p>
              <p className="text-2xl font-bold text-gray-900">2,847 tons</p>
            </div>
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-sm text-green-600">+12.5% from last month</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Scope 1 Emissions</p>
              <p className="text-2xl font-bold text-gray-900">1,247 tons</p>
            </div>
            <div className="p-2 bg-blue-100 rounded-lg">
              <TrendingDown className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-sm text-blue-600">-3.2% from last month</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Scope 2 Emissions</p>
              <p className="text-2xl font-bold text-gray-900">892 tons</p>
            </div>
            <div className="p-2 bg-yellow-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-sm text-yellow-600">+5.7% from last month</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Scope 3 Emissions</p>
              <p className="text-2xl font-bold text-gray-900">708 tons</p>
            </div>
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-sm text-purple-600">+8.1% from last month</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;