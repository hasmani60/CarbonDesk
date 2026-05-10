// frontend/src/pages/Organisation/OrganisationPage.jsx - MongoDB Compatible
import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Users, 
  Mail, 
  Phone, 
  MapPin, 
  Globe, 
  Shield, 
  FileText,
  Calendar,
  Activity,
  Award,
  ClipboardList,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { organisationAPI } from '../../services/api';
import PageHeader from '../../components/PageHeader/PageHeader';
import { useAuth } from '../../context/AuthContext';

const OrganisationPage = () => {
  const { user } = useAuth();
  const [organisation, setOrganisation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshingStats, setRefreshingStats] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({});

  useEffect(() => {
    fetchOrganisationDetails(false);
  }, []);

  const fetchOrganisationDetails = async (silentRefresh = false) => {
    if (silentRefresh) setRefreshingStats(true);
    else {
      setLoading(true);
    }
    setError(null);
    
    try {
      console.log('🏢 Fetching organisation details from backend MongoDB database...');
      
      // Use centralized API service
      const responseData = await organisationAPI.getDetails();
      
      console.log('📦 Full response data:', responseData);
      
      // Handle response data - API interceptor already unwraps data
      const orgData = responseData.organisation;
      const statsData = responseData.stats || {};
      
      console.log('✅ Organisation Data loaded from MongoDB:', orgData);
      console.log('✅ Stats Data loaded from MongoDB:', statsData);
      console.log('📊 Stats breakdown:', {
        totalUsers: statsData.totalUsers,
        activeUsers: statsData.activeUsers,
        admins: statsData.admins,
        analysts: statsData.analysts,
        contributors: statsData.contributors,
        viewers: statsData.viewers
      });
      
      setOrganisation(orgData);
      setStats(statsData);
    } catch (err) {
      console.error('❌ Error fetching organisation:', err);
      if (!silentRefresh) {
        setError(err.message || 'Failed to load organisation details');
      }
    } finally {
      setLoading(false);
      setRefreshingStats(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="motion-safe:animate-spin rounded-full h-12 w-12 border-2 border-emerald-600 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading organisation details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-4 min-h-[50vh]">
        <div className="max-w-md w-full app-card p-6 text-center border border-transparent">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Error</h2>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
          <button
            onClick={() => fetchOrganisationDetails(false)}
            className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 dark:hover:bg-emerald-500 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!organisation) {
    return (
      <div className="flex items-center justify-center p-4 min-h-[50vh]">
        <div className="max-w-md w-full app-card p-6 text-center">
          <Building2 className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Organisation</h2>
          <p className="text-gray-600 dark:text-gray-400">You are not assigned to any organisation yet.</p>
        </div>
      </div>
    );
  }

  const getStat = (statName) => {
    if (!stats || typeof stats !== 'object') return 0;
    const snake = statName.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    const possibleKeys = [statName, statName.toLowerCase(), snake, snake.replace(/^_/, '')];
    for (const key of possibleKeys) {
      if (key && stats[key] !== undefined && stats[key] !== null) {
        return stats[key];
      }
    }
    return 0;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Organisation"
        breadcrumb={[
          { label: 'App', href: '/' },
          ...(user?.role === 'admin'
            ? [{ label: 'Admin', href: '/admin/monitor' }]
            : []),
          { label: 'Organisation' },
        ]}
      />

      <div className="space-y-6">
        {/* Header */}
        <div className="app-card overflow-hidden shadow-md dark:shadow-none">
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-8 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">{organisation.display_name || organisation.name}</h1>
                <p className="text-emerald-100">{organisation.industry_type}</p>
              </div>
              <div className="w-20 h-20 bg-white/95 dark:bg-slate-100 rounded-lg flex items-center justify-center shadow-sm">
                <Building2 className="w-12 h-12 text-emerald-600 dark:text-emerald-700" />
              </div>
            </div>
          </div>

          {/* Organisation ID Badge */}
          <div className="px-6 py-3 bg-gray-50 dark:bg-slate-800/80 border-b border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Organisation ID:</span>
              <span className="font-mono font-medium text-gray-900 dark:text-white">{organisation._id}</span>
            </div>
          </div>
        </div>

        {/* Stats Cards — always shown; values come from API or 0 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="app-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Users</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {getStat('totalUsers')}
                </p>
              </div>
              <Users className="w-10 h-10 text-blue-500 dark:text-blue-400" />
            </div>
          </div>

          <div className="app-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Active Users</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {getStat('activeUsers')}
                </p>
              </div>
              <Activity className="w-10 h-10 text-green-500 dark:text-green-400" />
            </div>
          </div>

          <div className="app-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Admins</p>
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {getStat('admins')}
                </p>
              </div>
              <Shield className="w-10 h-10 text-purple-500 dark:text-purple-400" />
            </div>
          </div>

          <div className="app-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Subscription</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 capitalize">
                  {organisation.subscription_tier || 'Standard'}
                </p>
              </div>
              <Award className="w-10 h-10 text-emerald-500 dark:text-emerald-400" />
            </div>
          </div>
        </div>

        <div className={`app-card p-6 transition-opacity ${refreshingStats ? 'opacity-90' : ''}`}>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">User roles breakdown</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Counts are loaded from your user directory
                {getStat('totalUsers') > 0 ? ` (${getStat('totalUsers')} user${getStat('totalUsers') === 1 ? '' : 's'} in this organisation).` : '.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => fetchOrganisationDetails(true)}
              disabled={refreshingStats || loading}
              className="inline-flex shrink-0 items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 bg-white/80 dark:bg-slate-800/80 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-busy={refreshingStats}
            >
              <RefreshCw className={`w-4 h-4 ${refreshingStats ? 'motion-safe:animate-spin' : ''}`} aria-hidden />
              Refresh counts
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/35 rounded-lg">
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{getStat('admins')}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Admins</p>
            </div>
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/35 rounded-lg">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{getStat('analysts')}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Analysts</p>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/35 rounded-lg">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{getStat('contributors')}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Contributors</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-slate-800/60 rounded-lg">
              <p className="text-2xl font-bold text-gray-600 dark:text-gray-300">{getStat('viewers')}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Viewers</p>
            </div>
          </div>
        </div>

        <div className="app-card p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Operational overview</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Activity, emissions, and tasks recorded for your organisation in this system.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-lg border border-gray-200 dark:border-slate-600 p-4 bg-white/50 dark:bg-slate-900/40">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Activity log entries</span>
                <Activity className="w-5 h-5 text-amber-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{getStat('totalActivities')}</p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-slate-600 p-4 bg-white/50 dark:bg-slate-900/40">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Emission records</span>
                <FileText className="w-5 h-5 text-teal-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{getStat('totalEmissions')}</p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Verified: {getStat('verifiedEmissions')} · Pending: {getStat('pendingEmissions')}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-slate-600 p-4 bg-white/50 dark:bg-slate-900/40">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Tasks</span>
                <ClipboardList className="w-5 h-5 text-indigo-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{getStat('totalTasks')}</p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Done: {getStat('completedTasks')} · Pending: {getStat('pendingTasks')}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-slate-600 p-4 bg-white/50 dark:bg-slate-900/40">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Inactive users</span>
                <Users className="w-5 h-5 text-slate-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{getStat('inactiveUsers')}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="app-card">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                <Building2 className="w-5 h-5 mr-2 text-emerald-600" />
                Basic Information
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Organisation Name</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100 font-medium">{organisation.name}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Display Name</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100">{organisation.display_name || organisation.name}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Industry Type</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100">{organisation.industry_type}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600 flex items-center">
                  <MapPin className="w-4 h-4 mr-1" />
                  Location
                </label>
                <p className="mt-1 text-gray-900 dark:text-gray-100">{organisation.location || 'Not specified'}</p>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="app-card">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                <Mail className="w-5 h-5 mr-2 text-emerald-600" />
                Contact Information
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600 flex items-center">
                  <Mail className="w-4 h-4 mr-1" />
                  Email
                </label>
                <p className="mt-1 text-gray-900 dark:text-gray-100">
                  <a href={`mailto:${organisation.contact_email}`} className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300">
                    {organisation.contact_email}
                  </a>
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600 flex items-center">
                  <Phone className="w-4 h-4 mr-1" />
                  Phone
                </label>
                <p className="mt-1 text-gray-900 dark:text-gray-100">
                  {organisation.contact_phone ? (
                    <a href={`tel:${organisation.contact_phone}`} className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300">
                      {organisation.contact_phone}
                    </a>
                  ) : (
                    'Not specified'
                  )}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600 flex items-center">
                  <Globe className="w-4 h-4 mr-1" />
                  Website
                </label>
                <p className="mt-1 text-gray-900 dark:text-gray-100">
                  {organisation.website ? (
                    <a 
                      href={organisation.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                    >
                      {organisation.website}
                    </a>
                  ) : (
                    'Not specified'
                  )}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Address</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100">{organisation.address || 'Not specified'}</p>
              </div>
            </div>
          </div>

          {/* Organisation Details */}
          <div className="app-card border-l-4 border-emerald-500 dark:border-emerald-500">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center flex-wrap gap-2">
                <Shield className="w-5 h-5 mr-2 text-emerald-600 dark:text-emerald-400 shrink-0" />
                Organisation Details
                <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-medium rounded">
                  Legal Info
                </span>
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Registered Name</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100 font-medium">
                  {organisation.registered_name || organisation.name}
                </p>
                <p className="text-xs text-gray-500 mt-1">Legal name as per registration</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">CIN Number</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100 font-mono">
                  {organisation.cin_number || (
                    <span className="text-gray-400 italic">Not provided</span>
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-1">Corporate Identity Number</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Registered Address</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100 whitespace-pre-line">
                  {organisation.registered_address || (
                    <span className="text-gray-400 italic">Not provided</span>
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-1">Official registered address</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">GST Number</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100 font-mono">
                  {organisation.gst_number || (
                    <span className="text-gray-400 italic">Not provided</span>
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-1">Goods and Services Tax ID</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center">
                  <Users className="w-4 h-4 mr-1" />
                  Current Employees
                </label>
                <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                  {organisation.current_employees ? (
                    organisation.current_employees.toLocaleString()
                  ) : (
                    <span className="text-gray-400 italic text-base font-normal">Not provided</span>
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-1">Total employee count</p>
              </div>
            </div>
          </div>

          {/* System Information */}
          <div className="app-card">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                <FileText className="w-5 h-5 mr-2 text-emerald-600" />
                System Information
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Subscription Tier</label>
                <p className="mt-1">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 capitalize">
                    {organisation.subscription_tier || 'Standard'}
                  </span>
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Max Users</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100 font-medium">{organisation.max_users || 50}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Status</label>
                <p className="mt-1">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    organisation.is_active !== false
                      ? 'bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-300' 
                      : 'bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300'
                  }`}>
                    {organisation.is_active === false ? 'Inactive' : 'Active'}
                  </span>
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600 flex items-center">
                  <Calendar className="w-4 h-4 mr-1" />
                  Created On
                </label>
                <p className="mt-1 text-gray-900 dark:text-gray-100">{formatDate(organisation.created_at)}</p>
              </div>

              {organisation.created_by && (
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Created By</label>
                  <p className="mt-1 text-gray-900 dark:text-gray-100">{organisation.created_by}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notes Section */}
        {organisation.notes && (
          <div className="app-card">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                <FileText className="w-5 h-5 mr-2 text-emerald-600" />
                Notes
              </h2>
            </div>
            <div className="p-6">
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">{organisation.notes}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrganisationPage;