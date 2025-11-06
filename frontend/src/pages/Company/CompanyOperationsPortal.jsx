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
    // Basic Information
    name: '',
    display_name: '',
    industry_type: 'Manufacturing',
    location: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    website: '',
    subscription_tier: 'standard',
    max_users: 50,
    
    // Organisation Details (NEW)
    registered_name: '',
    cin_number: '',
    registered_address: '',
    gst_number: '',
    current_employees: '',
    
    // Super Admin Details
    super_admin_name: '',
    super_admin_email: '',
    super_admin_password: '',
    notes: ''
  });

  const [formErrors, setFormErrors] = useState({});

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

  const validateForm = () => {
    const errors = {};

    // Basic Information Validation
    if (!newOrg.name.trim()) {
      errors.name = 'Organisation name is required';
    }

    if (!newOrg.contact_email.trim()) {
      errors.contact_email = 'Contact email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newOrg.contact_email)) {
      errors.contact_email = 'Invalid email format';
    }

    // Organisation Details Validation (NEW)
    if (!newOrg.registered_address.trim()) {
      errors.registered_address = 'Registered address is required';
    } else if (newOrg.registered_address.trim().length < 10) {
      errors.registered_address = 'Address must be at least 10 characters';
    }

    if (!newOrg.current_employees || parseInt(newOrg.current_employees) < 1) {
      errors.current_employees = 'Number of employees must be at least 1';
    }

    // CIN Number validation (if provided)
    if (newOrg.cin_number && newOrg.cin_number.length > 21) {
      errors.cin_number = 'CIN number cannot exceed 21 characters';
    }

    // GST Number validation (if provided)
    if (newOrg.gst_number && newOrg.gst_number.length !== 15) {
      errors.gst_number = 'GST number must be exactly 15 characters';
    }

    // Super Admin Validation
    if (!newOrg.super_admin_name.trim()) {
      errors.super_admin_name = 'Super Admin name is required';
    }

    if (!newOrg.super_admin_email.trim()) {
      errors.super_admin_email = 'Super Admin email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newOrg.super_admin_email)) {
      errors.super_admin_email = 'Invalid email format';
    }

    if (!newOrg.super_admin_password.trim()) {
      errors.super_admin_password = 'Super Admin password is required';
    } else if (newOrg.super_admin_password.length < 8) {
      errors.super_admin_password = 'Password must be at least 8 characters';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateOrganisation = async (e) => {
    e.preventDefault();
    
    // Validate form
    if (!validateForm()) {
      alert('Please fix the errors in the form before submitting');
      return;
    }

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
        alert(`✅ Organisation created successfully!\n\nOrg ID: ${data.data.organisation.id}\nSuper Admin: ${data.data.super_admin.email}\n\nThe Super Admin can now log in using their credentials.`);
        
        // Reset form
        setNewOrg({
          name: '',
          display_name: '',
          industry_type: 'Manufacturing',
          location: '',
          contact_email: '',
          contact_phone: '',
          address: '',
          website: '',
          subscription_tier: 'standard',
          max_users: 50,
          registered_name: '',
          cin_number: '',
          registered_address: '',
          gst_number: '',
          current_employees: '',
          super_admin_name: '',
          super_admin_email: '',
          super_admin_password: '',
          notes: ''
        });
        
        setFormErrors({});
        setCurrentView('dashboard');
        
        // Reload dashboard
        await loadDashboard();
      } else {
        alert(`❌ Error: ${data.message}`);
      }
    } catch (error) {
      alert('Failed to create organisation: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setNewOrg(prev => ({ ...prev, [field]: value }));
    
    // Clear error for this field when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
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

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="operator@company.com"
                  required
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
                  required
                />
              </div>

              {loginError && (
                <div className="bg-red-900 border border-red-700 rounded-lg p-3 text-red-200 text-sm">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Authenticating...' : 'Access Portal'}
              </button>
            </form>

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
      {/* Header */}
      <header className="bg-gray-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Company Operations Portal</h1>
              <p className="text-sm text-gray-400">Multi-Tenant Management System</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm font-medium">{operator?.name}</p>
              <p className="text-xs text-gray-400 capitalize">{operator?.role}</p>
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

      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-1">
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                currentView === 'dashboard'
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="flex items-center space-x-2">
                <BarChart3 className="w-4 h-4" />
                <span>Dashboard</span>
              </span>
            </button>
            <button
              onClick={() => setCurrentView('create')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                currentView === 'create'
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="flex items-center space-x-2">
                <Plus className="w-4 h-4" />
                <span>Create Organisation</span>
              </span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* DASHBOARD VIEW */}
        {currentView === 'dashboard' && stats && (
          <div className="space-y-6">
            {/* Stats Cards */}
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
                    <p className="text-sm text-gray-600 mb-1">Active Organisations</p>
                    <p className="text-3xl font-bold text-green-600">{stats.active_organisations || 0}</p>
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
                    <p className="text-3xl font-bold text-emerald-600">{stats.active_users || 0}</p>
                  </div>
                  <Activity className="w-10 h-10 text-emerald-500" />
                </div>
              </div>
            </div>

            {/* Recent Organisations */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">Recent Organisations</h2>
              </div>
              <div className="p-6">
                {organisations && organisations.length > 0 ? (
                  <div className="space-y-3">
                    {organisations.slice(0, 10).map((org) => (
                      <div key={org.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                            <Building2 className="w-6 h-6 text-emerald-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{org.display_name}</p>
                            <p className="text-sm text-gray-500">{org.industry_type} • {org.contact_email}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">
                            {org.stats?.totalUsers || 0} users
                          </p>
                          <p className="text-xs text-gray-500 capitalize">{org.subscription_tier || 'standard'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No organisations yet</p>
                    <button
                      onClick={() => setCurrentView('create')}
                      className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      Create First Organisation
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* CREATE ORGANISATION VIEW */}
        {currentView === 'create' && (
          <form onSubmit={handleCreateOrganisation} className="space-y-6">
            {/* Section 1: Basic Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                <Building2 className="w-5 h-5 mr-2 text-emerald-600" />
                Basic Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Organisation Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Organisation Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newOrg.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      formErrors.name ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="e.g., Acme Corporation"
                  />
                  {formErrors.name && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                  )}
                </div>

                {/* Display Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={newOrg.display_name}
                    onChange={(e) => handleInputChange('display_name', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Optional - defaults to Organisation Name"
                  />
                  <p className="mt-1 text-xs text-gray-500">If empty, will use Organisation Name</p>
                </div>

                {/* Industry Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Industry Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newOrg.industry_type}
                    onChange={(e) => handleInputChange('industry_type', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Manufacturing">Manufacturing</option>
                    <option value="Technology">Technology</option>
                    <option value="Finance">Finance</option>
                    <option value="Healthcare">Healthcare</option>
                    <option value="Education">Education</option>
                    <option value="Retail">Retail</option>
                    <option value="Hospitality">Hospitality</option>
                    <option value="Construction">Construction</option>
                    <option value="Transportation">Transportation</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Contact Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={newOrg.contact_email}
                    onChange={(e) => handleInputChange('contact_email', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      formErrors.contact_email ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="contact@company.com"
                  />
                  {formErrors.contact_email && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.contact_email}</p>
                  )}
                </div>

                {/* Contact Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    value={newOrg.contact_phone}
                    onChange={(e) => handleInputChange('contact_phone', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="+91 1234567890"
                  />
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    value={newOrg.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="City, State, Country"
                  />
                </div>

                {/* Website */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Website
                  </label>
                  <input
                    type="url"
                    value={newOrg.website}
                    onChange={(e) => handleInputChange('website', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="https://company.com"
                  />
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    General Address
                  </label>
                  <input
                    type="text"
                    value={newOrg.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Street Address"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Organisation Details (NEW) */}
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-emerald-500">
              <div className="flex items-center mb-6">
                <Shield className="w-5 h-5 text-emerald-600 mr-2" />
                <h2 className="text-lg font-bold text-gray-900">Organisation Details</h2>
                <span className="ml-2 px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded">NEW</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Registered Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Registered Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newOrg.registered_name}
                    onChange={(e) => handleInputChange('registered_name', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Legal registered name"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Legal name as registered with authorities (defaults to Organisation Name if empty)
                  </p>
                </div>

                {/* CIN Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CIN Number
                  </label>
                  <input
                    type="text"
                    value={newOrg.cin_number}
                    onChange={(e) => handleInputChange('cin_number', e.target.value.toUpperCase())}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      formErrors.cin_number ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="U12345AB1234PTC123456"
                    maxLength={21}
                  />
                  {formErrors.cin_number && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.cin_number}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Corporate Identity Number (optional but recommended, 21 characters max)
                  </p>
                </div>

                {/* Registered Address */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Registered Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={newOrg.registered_address}
                    onChange={(e) => handleInputChange('registered_address', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      formErrors.registered_address ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Complete registered address as per incorporation documents&#10;Example: Plot No. 123, Sector 15, Industrial Area&#10;Mumbai, Maharashtra 400001, India"
                    rows={3}
                  />
                  {formErrors.registered_address && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.registered_address}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Full registered address including street, city, state, and PIN code
                  </p>
                </div>

                {/* GST Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    GST Number
                  </label>
                  <input
                    type="text"
                    value={newOrg.gst_number}
                    onChange={(e) => handleInputChange('gst_number', e.target.value.toUpperCase())}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      formErrors.gst_number ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="22AAAAA0000A1Z5"
                    maxLength={15}
                  />
                  {formErrors.gst_number && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.gst_number}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    15-digit GST identification number (optional)
                  </p>
                </div>

                {/* Current Number of Employees */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Number of Employees <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={newOrg.current_employees}
                    onChange={(e) => handleInputChange('current_employees', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      formErrors.current_employees ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="e.g., 250"
                    min="1"
                  />
                  {formErrors.current_employees && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.current_employees}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Total number of employees currently in the organisation
                  </p>
                </div>
              </div>
            </div>

            {/* Section 3: Super Admin Account */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                <Users className="w-5 h-5 mr-2 text-emerald-600" />
                Super Admin Account
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Admin Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Admin Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newOrg.super_admin_name}
                    onChange={(e) => handleInputChange('super_admin_name', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      formErrors.super_admin_name ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="John Doe"
                  />
                  {formErrors.super_admin_name && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.super_admin_name}</p>
                  )}
                </div>

                {/* Admin Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Admin Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={newOrg.super_admin_email}
                    onChange={(e) => handleInputChange('super_admin_email', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      formErrors.super_admin_email ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="admin@company.com"
                  />
                  {formErrors.super_admin_email && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.super_admin_email}</p>
                  )}
                </div>

                {/* Admin Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Admin Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={newOrg.super_admin_password}
                    onChange={(e) => handleInputChange('super_admin_password', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      formErrors.super_admin_password ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Strong password"
                  />
                  {formErrors.super_admin_password && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.super_admin_password}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Minimum 8 characters recommended
                  </p>
                </div>

                {/* Subscription Tier */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subscription Tier
                  </label>
                  <select
                    value={newOrg.subscription_tier}
                    onChange={(e) => handleInputChange('subscription_tier', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="basic">Basic</option>
                    <option value="standard">Standard</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>

                {/* Max Users */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Users
                  </label>
                  <input
                    type="number"
                    value={newOrg.max_users}
                    onChange={(e) => handleInputChange('max_users', parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    min="1"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Maximum number of users allowed in this organisation
                  </p>
                </div>

                {/* Notes */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={newOrg.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Additional notes about this organisation (optional)"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => {
                  setCurrentView('dashboard');
                  setFormErrors({});
                }}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5 mr-2" />
                    Create Organisation
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
};

export default CompanyOperationsPortal;