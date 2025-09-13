import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { RefreshCw, Plus, BarChart3, Filter } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dashboardAPI } from '../../services/api';
import PageHeader from '../../components/PageHeader/PageHeader';
import NotificationCard from '../../components/NotificationCard/NotificationCard';

const Dashboard = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState({
    scope1: { total: 0, percentage: 60 },
    scope2: { total: 0, percentage: 15 },
    scope3: { total: 0, percentage: 25 }
  });
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pie chart colors matching the green theme
  const COLORS = {
    scope1: '#065f46', // Dark green
    scope2: '#34d399', // Medium green  
    scope3: '#d1fae5'  // Light green
  };

  useEffect(() => {
    fetchDashboardData();
    fetchNotifications();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const data = await dashboardAPI.getSummary();
      setDashboardData(data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const data = await dashboardAPI.getNotifications();
      setNotifications(data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const getScopeData = (scope) => [
    { name: 'Used', value: dashboardData[scope].percentage },
    { name: 'Remaining', value: 100 - dashboardData[scope].percentage }
  ];

  const handleGenerateInsight = (scope) => {
    // Navigate to analytics or show insight modal
    console.log(`Generating insight for ${scope}`);
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
          <button className="p-2 text-gray-500 hover:text-gray-700 rounded-lg">
            <RefreshCw className="w-5 h-5" />
          </button>
        }
      />

      {/* Emission Scope Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {['scope1', 'scope2', 'scope3'].map((scope, index) => (
          <div key={scope} className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Scope {index + 1}
              </h3>
              <div className="flex space-x-2">
                <button className="text-emerald-600 text-sm font-medium hover:text-emerald-700">
                  Add
                </button>
                <button className="text-emerald-600 text-sm font-medium hover:text-emerald-700">
                  Monitor
                </button>
              </div>
            </div>

            {/* Pie Chart */}
            <div className="h-48 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={getScopeData(scope)}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    <Cell fill={COLORS[scope]} />
                    <Cell fill="#f3f4f6" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="text-center -mt-20">
                <div className="text-2xl font-bold text-gray-900">
                  {dashboardData[scope].percentage}%
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex justify-center space-x-4 mb-4">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-emerald-800 rounded-full mr-2"></div>
                <span className="text-sm text-gray-600">Part1</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-emerald-400 rounded-full mr-2"></div>
                <span className="text-sm text-gray-600">Part2</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-gray-300 rounded-full mr-2"></div>
                <span className="text-sm text-gray-600">Part3</span>
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-gray-600 mb-4 text-center">
              To go, dipper aged seasonal blue mountain sit qui cillamon blue mountain roast 
              cortado turkish. Aged spoon froth roast caramelization grounds id espresso crema 
              crema seasonal sugar.
            </p>

            {/* Generate Insight Button */}
            <button 
              onClick={() => handleGenerateInsight(scope)}
              className="w-full bg-emerald-600 text-white py-2 px-4 rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center space-x-2"
            >
              <BarChart3 className="w-4 h-4" />
              <span>Generate Insight</span>
            </button>
          </div>
        ))}
      </div>

      {/* Notifications Section */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-semibold text-gray-900">Notification</h2>
            <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded-full">
              {notifications.length}
            </span>
          </div>
          <button className="flex items-center space-x-2 text-gray-500 hover:text-gray-700">
            <Filter className="w-4 h-4" />
            <span>Filter</span>
          </button>
        </div>
        
        <div className="p-6">
          {notifications.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {notifications.map((notification, index) => (
                <NotificationCard key={index} notification={notification} />
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