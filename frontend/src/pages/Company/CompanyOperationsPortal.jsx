import React, { useState, useEffect } from 'react';
import { Building2, Users, Activity, Plus, Search, Filter, Eye, Edit, Trash2, CheckCircle, XCircle, BarChart3, Shield, Lock } from 'lucide-react';

// This component is HIDDEN from regular users
// Access only via: /company-portal (not linked anywhere in the app)

const CompanyOperationsPortal = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [operator, setOperator] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [organisations, setOrganisations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [selectedOrg, setSelectedOrg] = useState(null);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [newOrg, setNewOrg] = useState({
    name: '', display_name: '', industry_type: 'Manufacturing',
    location: '', contact_email: '', contact_phone: '',
    address: '', website: '', subscription_tier: 'standard',
    max_users: 50, super_admin_name: '',
    super_admin_email: '', super_admin_password: '', notes: ''
  });

  const API_BASE = 'http://localhost:5001/api/company';

  useEffect(() => {
    const token = localStorage.getItem('company_token');
    if (token) verifyToken(token);
  }, []);

  useEffect(() => {
    if (isAuthenticated && currentView === 'dashboard') loadDashboard();
  }, [isAuthenticated, currentView]);

  const verifyToken = async (token) => {
    try {
      const response = await fetch(`${API_BASE}/auth/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setOperator(data.data);
        setIsAuthenticated(true);
      } else {
        localStorage.removeItem('company_token');
      }
    } catch (error) {
      localStorage.removeItem('company_token');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem('company_token', data.data.token);
        setOperator(data.data.operator);
        setIsAuthenticated(true);
      } else {
        setLoginError(data.message || 'Login failed');
      }
    } catch (error) {
      setLoginError('Unable to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('company_token');
    setIsAuthenticated(false);
    setOperator(null);
    setCurrentView('dashboard');
  };

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('company_token');
      const response = await fetch(`${API_BASE}/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      if (data.success) {
        setStats(data.data.stats);
        setOrganisations(data.data.organisations);
      }
    } catch (error) {
      console.error('Dashboard load failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrganisation = async (e) => {
    e.preventDefault();
    setLoading(true);
  
    try {
      const token = localStorage.getItem('company_token');
      const response = await fetch(`${API_BASE}/organisations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newOrg)
      });
  
      const data = await response.json();
  
      if (data.success) {
        alert(`✅ Organisation created!\n\nOrg ID: ${data.data.organisation.id}\nSuper Admin: ${data.data.super_admin.email}`);
        setCurrentView('dashboard');
        
        // Force reload dashboard data
        await loadDashboard();
        
        // Reset form...
      } else {
        alert(`Error: ${data.message}`);
      }
    } catch (error) {
      alert('Failed to create organisation: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // LOGIN SCREEN
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="mb-6 bg-red-900 border border-red-700 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <Shield className="w-5 h-5 text-red-300" />
              <span className="text-red-100 font-bold">RESTRICTED ACCESS</span>
            </div>
            <p className="text-red-200 text-sm">Company Operations Portal - Internal Use Only</p>
          </div>

          <div className="bg-gray-800 shadow-2xl rounded-lg p-8 border border-gray-700">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Company Portal</h1>
              <p className="text-gray-400 text-sm">Carbon Track Operations</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="operator@company.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="••••••••"
                />
              </div>

              {loginError && (
                <div className="bg-red-900 border border-red-700 rounded-lg p-3 text-red-200 text-sm">
                  {loginError}
                </div>
              )}

              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'Authenticating...' : 'Access Portal'}
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-700">
              <p className="text-xs text-gray-500 text-center">
                Default: admin@carbontrack-company.com / CompanyAdmin2025!
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // MAIN PORTAL
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Company Operations Portal</h1>
              <p className="text-sm text-gray-400">Multi-Tenant Management</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm font-medium">{operator?.name}</p>
              <p className="text-xs text-gray-400">{operator?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-1">
            {['dashboard', 'create'].map((view) => (
              <button
                key={view}
                onClick={() => setCurrentView(view)}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  currentView === view
                    ? 'border-emerald-600 text-emerald-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {view === 'dashboard' ? '📊 Dashboard' : '➕ Create Organisation'}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {currentView === 'dashboard' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Organisations</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.total_organisations || 0}</p>
                  </div>
                  <Building2 className="w-10 h-10 text-blue-500" />
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Active Orgs</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.active_organisations || 0}</p>
                  </div>
                  <CheckCircle className="w-10 h-10 text-green-500" />
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Users</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.total_users || 0}</p>
                  </div>
                  <Users className="w-10 h-10 text-purple-500" />
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Active Users</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.active_users || 0}</p>
                  </div>
                  <Activity className="w-10 h-10 text-emerald-500" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Organisations</h2>
              <div className="space-y-3">
                {organisations?.slice(0, 5).map((org) => (
                  <div key={org.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{org.display_name}</p>
                        <p className="text-sm text-gray-500">{org.industry_type}</p>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      {org.stats?.totalUsers || 0} users • {org.subscription_tier}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentView === 'create' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-6">Organisation Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Organisation Name *</label>
                  <input
                    type="text"
                    value={newOrg.name}
                    onChange={(e) => setNewOrg({...newOrg, name: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Industry Type *</label>
                  <select
                    value={newOrg.industry_type}
                    onChange={(e) => setNewOrg({...newOrg, industry_type: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {['Manufacturing', 'Technology', 'Finance', 'Healthcare', 'Education', 'Retail', 'Other'].map(ind => (
                      <option key={ind} value={ind}>{ind}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Contact Email *</label>
                  <input
                    type="email"
                    value={newOrg.contact_email}
                    onChange={(e) => setNewOrg({...newOrg, contact_email: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                  <input
                    type="text"
                    value={newOrg.location}
                    onChange={(e) => setNewOrg({...newOrg, location: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-6">Super Admin Account</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Admin Name *</label>
                  <input
                    type="text"
                    value={newOrg.super_admin_name}
                    onChange={(e) => setNewOrg({...newOrg, super_admin_name: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Admin Email *</label>
                  <input
                    type="email"
                    value={newOrg.super_admin_email}
                    onChange={(e) => setNewOrg({...newOrg, super_admin_email: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Admin Password *</label>
                  <input
                    type="password"
                    value={newOrg.super_admin_password}
                    onChange={(e) => setNewOrg({...newOrg, super_admin_password: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subscription Tier</label>
                  <select
                    value={newOrg.subscription_tier}
                    onChange={(e) => setNewOrg({...newOrg, subscription_tier: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="basic">Basic</option>
                    <option value="standard">Standard</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setCurrentView('dashboard')}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateOrganisation}
                disabled={loading}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Organisation'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default CompanyOperationsPortal;