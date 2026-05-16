// frontend/src/pages/Company/CompanyOperationsPortal.jsx - MongoDB Compatible
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Eye, EyeOff } from 'lucide-react';

const CompanyOperationsPortal = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [operator, setOperator] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  // Login state
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Dashboard state
  const [dashboardStats, setDashboardStats] = useState(null);
  const [recentOrganisations, setRecentOrganisations] = useState([]);

  // Organisation list state
  const [organisations, setOrganisations] = useState([]);
  const [filteredOrgs, setFilteredOrgs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterIndustry, setFilterIndustry] = useState('all');

  // Create organisation state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    name: '',
    display_name: '',
    industry_type: '',
    location: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    website: '',
    subscription_tier: 'standard',
    max_users: 50,
    max_storage_gb: 10,
    max_ai_reports: 10,
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
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  // Organisation detail state
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [orgStats, setOrgStats] = useState(null);
  const [aiReportLimitEdit, setAiReportLimitEdit] = useState('');
  const [savingAiReportLimit, setSavingAiReportLimit] = useState(false);
  const [aiReportLimitMsg, setAiReportLimitMsg] = useState('');
  const [showOrgDetail, setShowOrgDetail] = useState(false);
  const [superAdminNewPassword, setSuperAdminNewPassword] = useState('');
  const [superAdminConfirmPassword, setSuperAdminConfirmPassword] = useState('');
  const [resettingSuperAdminPwd, setResettingSuperAdminPwd] = useState(false);
  const [superAdminPwdErr, setSuperAdminPwdErr] = useState('');
  const [superAdminPwdMsg, setSuperAdminPwdMsg] = useState('');

  const [orgUsers, setOrgUsers] = useState([]);
  const [orgUsersLoading, setOrgUsersLoading] = useState(false);
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [showCreateSuperPwd, setShowCreateSuperPwd] = useState(false);
  const [showSAMNew, setShowSAMNew] = useState(false);
  const [showSAMConf, setShowSAMConf] = useState(false);
  const [companyEditUser, setCompanyEditUser] = useState(null);
  const [companyEditForm, setCompanyEditForm] = useState({
    name: '',
    email: '',
    role: 'contributor',
    status: 'active'
  });
  const [companyEditSaving, setCompanyEditSaving] = useState(false);
  const [companyPwdUser, setCompanyPwdUser] = useState(null);
  const [companyPwdNew, setCompanyPwdNew] = useState('');
  const [companyPwdConfirm, setCompanyPwdConfirm] = useState('');
  const [companyPwdErr, setCompanyPwdErr] = useState('');
  const [companyPwdSaving, setCompanyPwdSaving] = useState(false);
  const [showCompanyPwdNew, setShowCompanyPwdNew] = useState(false);
  const [showCompanyPwdConf, setShowCompanyPwdConf] = useState(false);

  // Note: VITE_API_URL should be 'http://localhost:5001' NOT 'http://localhost:5001/api'
  // The /api prefix is added in the routes below
  const API_BASE_URL = import.meta.env.VITE_API_URL 
    ? import.meta.env.VITE_API_URL.replace(/\/api$/, '') // Remove trailing /api if present
    : 'http://localhost:5001';

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Filter organisations
  useEffect(() => {
    filterOrganisations();
  }, [organisations, searchTerm, filterStatus, filterIndustry]);

  const checkAuth = () => {
    const token = localStorage.getItem('company_token');
    const operatorData = localStorage.getItem('company_operator');

    if (token && operatorData) {
      try {
        const parsedOperator = JSON.parse(operatorData);
        setOperator(parsedOperator);
        setIsAuthenticated(true);
        loadDashboard();
      } catch (error) {
        console.error('Auth check failed:', error);
        handleLogout();
      }
    }
    setLoading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/company/auth/login`,
        loginForm,
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (response.data.success) {
        const { token, operator: operatorData } = response.data.data;
        
        // Store token and operator data
        localStorage.setItem('company_token', token);
        localStorage.setItem('company_operator', JSON.stringify(operatorData));
        
        setOperator(operatorData);
        setIsAuthenticated(true);
        setLoginForm({ email: '', password: '' });
        
        // Load dashboard
        await loadDashboard();
      }
    } catch (error) {
      console.error('Login error:', error);
      setLoginError(
        error.response?.data?.message || 'Login failed. Please check your credentials.'
      );
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('company_token');
    localStorage.removeItem('company_operator');
    setIsAuthenticated(false);
    setOperator(null);
    setActiveTab('dashboard');
  };

  const getAuthHeaders = () => {
    const token = localStorage.getItem('company_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  const loadDashboard = async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/company/dashboard`,
        { headers: getAuthHeaders() }
      );

      if (response.data.success) {
        setDashboardStats(response.data.data.stats);
        setRecentOrganisations(response.data.data.organisations || []);
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      if (error.response?.status === 401) {
        handleLogout();
      }
    }
  };

  const loadOrganisations = async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/company/organisations`,
        { headers: getAuthHeaders() }
      );

      if (response.data.success) {
        setOrganisations(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load organisations:', error);
      if (error.response?.status === 401) {
        handleLogout();
      }
    }
  };

  const filterOrganisations = () => {
    let filtered = [...organisations];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(org => 
        org.name?.toLowerCase().includes(term) ||
        org.display_name?.toLowerCase().includes(term) ||
        org.contact_email?.toLowerCase().includes(term)
      );
    }

    // Status filter
    if (filterStatus !== 'all') {
      const isActive = filterStatus === 'active';
      filtered = filtered.filter(org => org.is_active === isActive);
    }

    // Industry filter
    if (filterIndustry !== 'all') {
      filtered = filtered.filter(org => org.industry_type === filterIndustry);
    }

    setFilteredOrgs(filtered);
  };

  const handleCreateOrganisation = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreating(true);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/company/organisations`,
        createFormData,
        { headers: getAuthHeaders() }
      );

      if (response.data.success) {
        const welcome = response.data.data?.welcomeEmailSent;
        alert(
          welcome
            ? 'Organisation created successfully! A welcome email was sent to the super admin (check spam if needed).'
            : 'Organisation created successfully! If email is configured, the super admin will receive a welcome message.'
        );
        setShowCreateModal(false);
        resetCreateForm();
        
        // Reload organisations
        if (activeTab === 'organisations') {
          await loadOrganisations();
        } else {
          await loadDashboard();
        }
      }
    } catch (error) {
      console.error('Create organisation error:', error);
      setCreateError(
        error.response?.data?.message || 'Failed to create organisation'
      );
    } finally {
      setCreating(false);
    }
  };

  const resetCreateForm = () => {
    setCreateFormData({
      name: '',
      display_name: '',
      industry_type: '',
      location: '',
      contact_email: '',
      contact_phone: '',
      address: '',
      website: '',
      subscription_tier: 'standard',
      max_users: 50,
      max_storage_gb: 10,
      max_ai_reports: 10,
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
    setCreateError('');
  };

  const handleSaveAiReportLimit = async () => {
    if (!selectedOrg?.id) return;
    const parsed = parseInt(String(aiReportLimitEdit), 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setAiReportLimitMsg('Enter a valid non-negative number');
      return;
    }
    setSavingAiReportLimit(true);
    setAiReportLimitMsg('');
    try {
      const response = await axios.patch(
        `${API_BASE_URL}/api/company/organisations/${selectedOrg.id}`,
        { max_ai_reports: parsed },
        { headers: getAuthHeaders() }
      );
      if (response.data.success) {
        setSelectedOrg((prev) => ({
          ...prev,
          max_ai_reports: response.data.data.max_ai_reports
        }));
        setAiReportLimitEdit(String(response.data.data.max_ai_reports));
        const statsResponse = await axios.get(
          `${API_BASE_URL}/api/company/organisations/${selectedOrg.id}/stats`,
          { headers: getAuthHeaders() }
        );
        if (statsResponse.data.success) {
          setOrgStats(statsResponse.data.data.stats);
        }
        setAiReportLimitMsg('AI report limit updated');
      }
    } catch (error) {
      setAiReportLimitMsg(
        error.response?.data?.message || 'Failed to update AI report limit'
      );
    } finally {
      setSavingAiReportLimit(false);
    }
  };

  const loadOrganisationDetails = async (orgId) => {
    setOrgUsersLoading(true);
    setOrgUsers([]);
    try {
      const [detailsResponse, statsResponse] = await Promise.all([
        axios.get(
          `${API_BASE_URL}/api/company/organisations/${orgId}`,
          { headers: getAuthHeaders() }
        ),
        axios.get(
          `${API_BASE_URL}/api/company/organisations/${orgId}/stats`,
          { headers: getAuthHeaders() }
        )
      ]);

      if (detailsResponse.data.success) {
        const org = detailsResponse.data.data;
        setSelectedOrg(org);
        setAiReportLimitEdit(
          org.max_ai_reports != null ? String(org.max_ai_reports) : ''
        );
      }

      if (statsResponse.data.success) {
        setOrgStats(statsResponse.data.data.stats);
        const stats = statsResponse.data.data.stats;
        if (stats?.max_ai_reports != null && !detailsResponse.data.success) {
          setAiReportLimitEdit(String(stats.max_ai_reports));
        }
      }

      let canManage = false;
      try {
        const raw = localStorage.getItem('company_operator');
        if (raw) {
          const op = JSON.parse(raw);
          canManage = !!op?.permissions?.canManageOrgs;
        }
      } catch {
        canManage = false;
      }

      if (canManage) {
        try {
          const usersRes = await axios.get(
            `${API_BASE_URL}/api/company/organisations/${orgId}/users`,
            { headers: getAuthHeaders() }
          );
          if (usersRes.data.success) {
            setOrgUsers(usersRes.data.data || []);
          }
        } catch (usersErr) {
          console.error('Failed to load org users:', usersErr);
          setOrgUsers([]);
        }
      }

      setShowOrgDetail(true);
    } catch (error) {
      console.error('Failed to load organisation details:', error);
      alert('Failed to load organisation details');
    } finally {
      setOrgUsersLoading(false);
    }
  };

  const resetSuperAdminPwdForm = () => {
    setSuperAdminNewPassword('');
    setSuperAdminConfirmPassword('');
    setSuperAdminPwdErr('');
    setSuperAdminPwdMsg('');
  };

  const handleResetSuperAdminPassword = async (e) => {
    e.preventDefault();
    setSuperAdminPwdErr('');
    setSuperAdminPwdMsg('');

    if (superAdminNewPassword !== superAdminConfirmPassword) {
      setSuperAdminPwdErr('New password and confirmation do not match');
      return;
    }
    if (!superAdminNewPassword || superAdminNewPassword.length < 6) {
      setSuperAdminPwdErr('Password must be at least 6 characters');
      return;
    }

    setResettingSuperAdminPwd(true);
    try {
      const response = await axios.patch(
        `${API_BASE_URL}/api/company/organisations/${selectedOrg.id}/super-admin-password`,
        { newPassword: superAdminNewPassword },
        { headers: getAuthHeaders() }
      );

      if (response.data.success) {
        const sent = response.data.data?.emailConfirmationSent;
        setSuperAdminPwdMsg(
          sent
            ? 'Password updated. A confirmation email was sent to the super admin.'
            : 'Password updated.'
        );
        setSuperAdminNewPassword('');
        setSuperAdminConfirmPassword('');
        await loadOrganisationDetails(selectedOrg.id);
      }
    } catch (error) {
      console.error('Reset super admin password error:', error);
      setSuperAdminPwdErr(
        error.response?.data?.message || 'Failed to reset super admin password'
      );
    } finally {
      setResettingSuperAdminPwd(false);
    }
  };

  const openCompanyEditUser = (user) => {
    setCompanyEditUser(user);
    setCompanyEditForm({
      name: user.name || '',
      email: user.email || '',
      role: user.role || 'contributor',
      status: user.status || 'active'
    });
  };

  const handleSaveCompanyUserEdit = async (e) => {
    e.preventDefault();
    if (!selectedOrg || !companyEditUser) return;
    setCompanyEditSaving(true);
    try {
      const uid = companyEditUser.id || companyEditUser._id;
      await axios.patch(
        `${API_BASE_URL}/api/company/organisations/${selectedOrg.id}/users/${uid}`,
        {
          name: companyEditForm.name,
          email: companyEditForm.email,
          role: companyEditForm.role,
          status: companyEditForm.status
        },
        { headers: getAuthHeaders() }
      );
      setCompanyEditUser(null);
      await loadOrganisationDetails(selectedOrg.id);
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update user');
    } finally {
      setCompanyEditSaving(false);
    }
  };

  const handleDeleteCompanyUser = async (user) => {
    if (!selectedOrg) return;
    if (!window.confirm(`Delete user ${user.email}? This cannot be undone.`)) return;
    const uid = user.id || user._id;
    try {
      await axios.delete(
        `${API_BASE_URL}/api/company/organisations/${selectedOrg.id}/users/${uid}`,
        { headers: getAuthHeaders() }
      );
      await loadOrganisationDetails(selectedOrg.id);
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to delete user');
    }
  };

  const handleSaveCompanyUserPassword = async (e) => {
    e.preventDefault();
    setCompanyPwdErr('');
    if (!selectedOrg || !companyPwdUser) return;
    if (companyPwdNew !== companyPwdConfirm) {
      setCompanyPwdErr('Passwords do not match');
      return;
    }
    if (!companyPwdNew || companyPwdNew.length < 6) {
      setCompanyPwdErr('Password must be at least 6 characters');
      return;
    }
    setCompanyPwdSaving(true);
    try {
      const uid = companyPwdUser.id || companyPwdUser._id;
      await axios.patch(
        `${API_BASE_URL}/api/company/organisations/${selectedOrg.id}/users/${uid}/password`,
        { newPassword: companyPwdNew },
        { headers: getAuthHeaders() }
      );
      setCompanyPwdUser(null);
      setCompanyPwdNew('');
      setCompanyPwdConfirm('');
      await loadOrganisationDetails(selectedOrg.id);
      alert('Password updated.');
    } catch (error) {
      setCompanyPwdErr(error.response?.data?.message || 'Failed to update password');
    } finally {
      setCompanyPwdSaving(false);
    }
  };

  const handleDeactivateOrganisation = async (orgId) => {
    if (!confirm('Are you sure you want to deactivate this organisation?')) {
      return;
    }

    try {
      const response = await axios.delete(
        `${API_BASE_URL}/api/company/organisations/${orgId}`,
        { headers: getAuthHeaders() }
      );

      if (response.data.success) {
        alert('Organisation deactivated successfully');
        setShowOrgDetail(false);
        
        if (activeTab === 'organisations') {
          await loadOrganisations();
        } else {
          await loadDashboard();
        }
      }
    } catch (error) {
      console.error('Deactivation error:', error);
      alert('Failed to deactivate organisation');
    }
  };

  const handleTabChange = async (tab) => {
    setActiveTab(tab);
    
    if (tab === 'organisations' && organisations.length === 0) {
      await loadOrganisations();
    }
  };

  // Render login page
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Company Operations</h1>
            <p className="text-gray-600">Internal Management Portal</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {loginError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={loginForm.email}
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showLoginPwd ? 'text' : 'password'}
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  className="w-full px-4 py-3 pr-11 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPwd((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1"
                  aria-label={showLoginPwd ? 'Hide password' : 'Show password'}
                >
                  {showLoginPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              {loggingIn ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Main portal interface
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Company Operations Portal</h1>
              <p className="text-sm text-gray-600 mt-1">
                Logged in as: {operator?.name} ({operator?.role})
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            <button
              onClick={() => handleTabChange('dashboard')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'dashboard'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => handleTabChange('organisations')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'organisations'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Organisations
            </button>
            <button
              onClick={() => handleTabChange('profile')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'profile'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Profile
            </button>
          </nav>
        </div>
      </div>

      {/* Content Area */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Dashboard Overview</h2>
              {operator?.permissions?.canCreateOrgs && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  + Create Organisation
                </button>
              )}
            </div>

            {/* Stats Cards */}
            {dashboardStats && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-sm font-medium text-gray-500">Total Organisations</h3>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {dashboardStats.total_organisations || 0}
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-sm font-medium text-gray-500">Active Organisations</h3>
                  <p className="text-3xl font-bold text-green-600 mt-2">
                    {dashboardStats.active_organisations || 0}
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-sm font-medium text-gray-500">Total Users</h3>
                  <p className="text-3xl font-bold text-blue-600 mt-2">
                    {dashboardStats.total_users || 0}
                  </p>
                </div>
              </div>
            )}

            {/* Recent Organisations */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Recent Organisations</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Industry</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {recentOrganisations.map((org) => (
                      <tr key={org.id || org._id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{org.display_name || org.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {org.industry_type}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {org.contact_email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            org.is_active 
                              ? 'bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-300' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {org.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => loadOrganisationDetails(org.id)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Organisations Tab */}
        {activeTab === 'organisations' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">All Organisations</h2>
              {operator?.permissions?.canCreateOrgs && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  + Create Organisation
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-lg shadow space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input
                  type="text"
                  placeholder="Search organisations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <select
                  value={filterIndustry}
                  onChange={(e) => setFilterIndustry(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Industries</option>
                  <option value="manufacturing">Manufacturing</option>
                  <option value="technology">Technology</option>
                  <option value="retail">Retail</option>
                  <option value="healthcare">Healthcare</option>
                  <option value="finance">Finance</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {/* Organisations Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Industry</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tier</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredOrgs.map((org) => (
                      <tr key={org.id || org._id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{org.display_name || org.name}</div>
                          <div className="text-sm text-gray-500">{org.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {org.industry_type}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{org.contact_email}</div>
                          <div className="text-sm text-gray-500">{org.contact_phone}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            {org.subscription_tier}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            org.is_active 
                              ? 'bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-300' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {org.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(org.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => loadOrganisationDetails(org.id)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredOrgs.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No organisations found
                </div>
              )}
            </div>
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Operator Profile</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <p className="mt-1 text-sm text-gray-900">{operator?.name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="mt-1 text-sm text-gray-900">{operator?.email}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <p className="mt-1 text-sm text-gray-900">{operator?.role}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Permissions</label>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center">
                    <span className={`w-3 h-3 rounded-full mr-2 ${operator?.permissions?.canCreateOrgs ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                    <span className="text-sm text-gray-900">Create Organisations</span>
                  </div>
                  <div className="flex items-center">
                    <span className={`w-3 h-3 rounded-full mr-2 ${operator?.permissions?.canManageOrgs ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                    <span className="text-sm text-gray-900">Manage Organisations</span>
                  </div>
                  <div className="flex items-center">
                    <span className={`w-3 h-3 rounded-full mr-2 ${operator?.permissions?.canViewAllOrgs ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                    <span className="text-sm text-gray-900">View All Organisations</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Create Organisation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-xl font-semibold text-gray-900">Create New Organisation</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetCreateForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateOrganisation} className="p-6 space-y-6">
              {createError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {createError}
                </div>
              )}

              {/* Basic Information */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900">Basic Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Organisation Name *
                    </label>
                    <input
                      type="text"
                      value={createFormData.name}
                      onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={createFormData.display_name}
                      onChange={(e) => setCreateFormData({ ...createFormData, display_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Industry Type *
                    </label>
                    <select
                      value={createFormData.industry_type}
                      onChange={(e) => setCreateFormData({ ...createFormData, industry_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select Industry</option>
                      <option value="manufacturing">Manufacturing</option>
                      <option value="technology">Technology</option>
                      <option value="retail">Retail</option>
                      <option value="healthcare">Healthcare</option>
                      <option value="finance">Finance</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Location
                    </label>
                    <input
                      type="text"
                      value={createFormData.location}
                      onChange={(e) => setCreateFormData({ ...createFormData, location: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900">Contact Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contact Email *
                    </label>
                    <input
                      type="email"
                      value={createFormData.contact_email}
                      onChange={(e) => setCreateFormData({ ...createFormData, contact_email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contact Phone
                    </label>
                    <input
                      type="tel"
                      value={createFormData.contact_phone}
                      onChange={(e) => setCreateFormData({ ...createFormData, contact_phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address
                    </label>
                    <input
                      type="text"
                      value={createFormData.address}
                      onChange={(e) => setCreateFormData({ ...createFormData, address: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Website
                    </label>
                    <input
                      type="url"
                      value={createFormData.website}
                      onChange={(e) => setCreateFormData({ ...createFormData, website: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Legal Information */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900">Legal Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Registered Name
                    </label>
                    <input
                      type="text"
                      value={createFormData.registered_name}
                      onChange={(e) => setCreateFormData({ ...createFormData, registered_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CIN Number
                    </label>
                    <input
                      type="text"
                      value={createFormData.cin_number}
                      onChange={(e) => setCreateFormData({ ...createFormData, cin_number: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Registered Address *
                    </label>
                    <input
                      type="text"
                      value={createFormData.registered_address}
                      onChange={(e) => setCreateFormData({ ...createFormData, registered_address: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      GST Number
                    </label>
                    <input
                      type="text"
                      value={createFormData.gst_number}
                      onChange={(e) => setCreateFormData({ ...createFormData, gst_number: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Current Employees *
                    </label>
                    <input
                      type="number"
                      value={createFormData.current_employees}
                      onChange={(e) => setCreateFormData({ ...createFormData, current_employees: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Subscription Details */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900">Subscription Details</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Subscription Tier
                    </label>
                    <select
                      value={createFormData.subscription_tier}
                      onChange={(e) => setCreateFormData({ ...createFormData, subscription_tier: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="basic">Basic</option>
                      <option value="standard">Standard</option>
                      <option value="premium">Premium</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Users
                    </label>
                    <input
                      type="number"
                      value={createFormData.max_users}
                      onChange={(e) => setCreateFormData({ ...createFormData, max_users: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Storage (GB)
                    </label>
                    <input
                      type="number"
                      value={createFormData.max_storage_gb}
                      onChange={(e) => setCreateFormData({ ...createFormData, max_storage_gb: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max AI reports
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={createFormData.max_ai_reports}
                      onChange={(e) =>
                        setCreateFormData({
                          ...createFormData,
                          max_ai_reports: parseInt(e.target.value, 10) || 0
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Super Admin Details */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900">Super Admin Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Super Admin Name *
                    </label>
                    <input
                      type="text"
                      value={createFormData.super_admin_name}
                      onChange={(e) => setCreateFormData({ ...createFormData, super_admin_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Super Admin Email *
                    </label>
                    <input
                      type="email"
                      value={createFormData.super_admin_email}
                      onChange={(e) => setCreateFormData({ ...createFormData, super_admin_email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Super Admin Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showCreateSuperPwd ? 'text' : 'password'}
                        value={createFormData.super_admin_password}
                        onChange={(e) => setCreateFormData({ ...createFormData, super_admin_password: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowCreateSuperPwd((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1"
                        aria-label={showCreateSuperPwd ? 'Hide password' : 'Show password'}
                      >
                        {showCreateSuperPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={createFormData.notes}
                  onChange={(e) => setCreateFormData({ ...createFormData, notes: e.target.value })}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetCreateForm();
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {creating ? 'Creating...' : 'Create Organisation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Organisation Detail Modal */}
      {showOrgDetail && selectedOrg && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-xl font-semibold text-gray-900">Organisation Details</h3>
              <button
                onClick={() => {
                  setShowOrgDetail(false);
                  setSelectedOrg(null);
                  setOrgStats(null);
                  setOrgUsers([]);
                  setCompanyEditUser(null);
                  setCompanyPwdUser(null);
                  resetSuperAdminPwdForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Organisation Name</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedOrg.name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Display Name</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedOrg.display_name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Industry</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedOrg.industry_type}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <span className={`inline-block mt-1 px-2 py-1 text-xs font-semibold rounded-full ${
                    selectedOrg.is_active 
                      ? 'bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-300' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {selectedOrg.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Contact Email</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedOrg.contact_email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Contact Phone</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedOrg.contact_phone || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Subscription tier</label>
                  <p className="mt-1 text-sm text-gray-900 capitalize">{selectedOrg.subscription_tier || '—'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">User seats (max)</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedOrg.max_users ?? '—'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">AI report limit</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedOrg.max_ai_reports ?? '—'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Subscription ends</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {selectedOrg.subscription_expires_at
                      ? new Date(selectedOrg.subscription_expires_at).toLocaleDateString()
                      : '—'}
                  </p>
                </div>
              </div>

              {/* Stats */}
              {orgStats && (
                <div className="border-t border-gray-200 pt-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Statistics</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-500">Total Users</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {orgStats.totalUsers || 0}
                        {orgStats.max_users != null ? (
                          <span className="text-lg font-normal text-gray-500">
                            {' '}/ {orgStats.max_users}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-500">AI reports generated</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {orgStats.ai_reports_used ?? 0}
                        {orgStats.max_ai_reports != null ? (
                          <span className="text-lg font-normal text-gray-500">
                            {' '}/ {orgStats.max_ai_reports}
                          </span>
                        ) : null}
                      </p>
                      {orgStats.ai_reports_remaining != null && (
                        <p className="text-xs text-gray-500 mt-1">
                          {orgStats.ai_reports_remaining} remaining
                        </p>
                      )}
                    </div>
                  </div>

                  {operator?.permissions?.canManageOrgs && (
                    <div className="mt-4 flex flex-wrap items-end gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Adjust max AI reports
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={aiReportLimitEdit}
                          onChange={(e) => setAiReportLimitEdit(e.target.value)}
                          className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleSaveAiReportLimit}
                        disabled={savingAiReportLimit}
                        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60"
                      >
                        {savingAiReportLimit ? 'Saving…' : 'Save limit'}
                      </button>
                      {aiReportLimitMsg && (
                        <p className="text-sm text-gray-600">{aiReportLimitMsg}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Organisation users (company operators) */}
              {operator?.permissions?.canManageOrgs && (
                <div className="border-t border-gray-200 pt-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Organisation users</h4>
                  {orgUsersLoading ? (
                    <p className="text-sm text-gray-500">Loading users…</p>
                  ) : orgUsers.length === 0 ? (
                    <p className="text-sm text-gray-500">No users found.</p>
                  ) : (
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-left">
                          <tr>
                            <th className="px-3 py-2 font-medium text-gray-700">Name</th>
                            <th className="px-3 py-2 font-medium text-gray-700">Email</th>
                            <th className="px-3 py-2 font-medium text-gray-700">Role</th>
                            <th className="px-3 py-2 font-medium text-gray-700">Status</th>
                            <th className="px-3 py-2 font-medium text-gray-700 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orgUsers.map((u) => (
                            <tr key={u._id || u.id} className="border-t border-gray-100">
                              <td className="px-3 py-2">{u.name}</td>
                              <td className="px-3 py-2">{u.email}</td>
                              <td className="px-3 py-2 capitalize">{u.role}</td>
                              <td className="px-3 py-2 capitalize">{u.status}</td>
                              <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => openCompanyEditUser(u)}
                                  className="text-blue-600 hover:underline"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCompanyPwdUser(u);
                                    setCompanyPwdNew('');
                                    setCompanyPwdConfirm('');
                                    setCompanyPwdErr('');
                                  }}
                                  className="text-gray-800 hover:underline"
                                >
                                  Set password
                                </button>
                                {!u.is_bootstrap_admin && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCompanyUser(u)}
                                    className="text-red-600 hover:underline"
                                  >
                                    Delete
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Reset bootstrap super admin password (after org creation) */}
              {operator?.permissions?.canManageOrgs && selectedOrg.bootstrap_super_admin && (
                <div className="border-t border-gray-200 pt-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Super admin password</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    Set a new login password for{' '}
                    <span className="font-medium text-gray-900">
                      {selectedOrg.bootstrap_super_admin.email}
                    </span>
                    {' '}(organisation admin).
                  </p>
                  <form onSubmit={handleResetSuperAdminPassword} className="space-y-3 max-w-md">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        New password
                      </label>
                      <div className="relative">
                        <input
                          type={showSAMNew ? 'text' : 'password'}
                          autoComplete="new-password"
                          value={superAdminNewPassword}
                          onChange={(e) => setSuperAdminNewPassword(e.target.value)}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="At least 6 characters"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSAMNew((v) => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 p-1"
                          aria-label={showSAMNew ? 'Hide password' : 'Show password'}
                        >
                          {showSAMNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Confirm new password
                      </label>
                      <div className="relative">
                        <input
                          type={showSAMConf ? 'text' : 'password'}
                          autoComplete="new-password"
                          value={superAdminConfirmPassword}
                          onChange={(e) => setSuperAdminConfirmPassword(e.target.value)}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSAMConf((v) => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 p-1"
                          aria-label={showSAMConf ? 'Hide password' : 'Show password'}
                        >
                          {showSAMConf ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    {superAdminPwdErr && (
                      <p className="text-sm text-red-600">{superAdminPwdErr}</p>
                    )}
                    {superAdminPwdMsg && (
                      <p className="text-sm text-green-700">{superAdminPwdMsg}</p>
                    )}
                    <button
                      type="submit"
                      disabled={resettingSuperAdminPwd}
                      className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-400 text-sm"
                    >
                      {resettingSuperAdminPwd ? 'Updating…' : 'Update super admin password'}
                    </button>
                  </form>
                </div>
              )}

              {/* Actions */}
              {operator?.permissions?.canManageOrgs && (
                <div className="border-t border-gray-200 pt-4 flex justify-end space-x-3">
                  {selectedOrg.is_active && (
                    <button
                      onClick={() => handleDeactivateOrganisation(selectedOrg.id)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      Deactivate Organisation
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {companyEditUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Edit user</h4>
            <form onSubmit={handleSaveCompanyUserEdit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  value={companyEditForm.name}
                  onChange={(e) =>
                    setCompanyEditForm({ ...companyEditForm, name: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  value={companyEditForm.email}
                  onChange={(e) =>
                    setCompanyEditForm({ ...companyEditForm, email: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  value={companyEditForm.role}
                  onChange={(e) =>
                    setCompanyEditForm({ ...companyEditForm, role: e.target.value })
                  }
                >
                  <option value="admin">admin</option>
                  <option value="analyst">analyst</option>
                  <option value="contributor">contributor</option>
                  <option value="viewer">viewer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  value={companyEditForm.status}
                  onChange={(e) =>
                    setCompanyEditForm({ ...companyEditForm, status: e.target.value })
                  }
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCompanyEditUser(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={companyEditSaving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-400"
                >
                  {companyEditSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {companyPwdUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-1">Set password</h4>
            <p className="text-sm text-gray-600 mb-4">{companyPwdUser.email}</p>
            <form onSubmit={handleSaveCompanyUserPassword} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                <div className="relative">
                  <input
                    type={showCompanyPwdNew ? 'text' : 'password'}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg"
                    value={companyPwdNew}
                    onChange={(e) => setCompanyPwdNew(e.target.value)}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 p-1"
                    onClick={() => setShowCompanyPwdNew((v) => !v)}
                    aria-label="Toggle visibility"
                  >
                    {showCompanyPwdNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
                <div className="relative">
                  <input
                    type={showCompanyPwdConf ? 'text' : 'password'}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg"
                    value={companyPwdConfirm}
                    onChange={(e) => setCompanyPwdConfirm(e.target.value)}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 p-1"
                    onClick={() => setShowCompanyPwdConf((v) => !v)}
                    aria-label="Toggle visibility"
                  >
                    {showCompanyPwdConf ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {companyPwdErr && <p className="text-sm text-red-600">{companyPwdErr}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setCompanyPwdUser(null);
                    setCompanyPwdNew('');
                    setCompanyPwdConfirm('');
                    setCompanyPwdErr('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={companyPwdSaving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-400"
                >
                  {companyPwdSaving ? 'Saving…' : 'Update password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyOperationsPortal;