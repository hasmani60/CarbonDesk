// frontend/src/pages/Organisation/OrganisationPage.jsx
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
  Edit,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { organizationAPI } from '../../services/api';

const OrganisationPage = () => {
  const [organisation, setOrganisation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchOrganisationDetails();
  }, []);

  const fetchOrganisationDetails = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🏢 Fetching organisation details from backend SQLite database...');
      
      // Use centralized API service - same pattern as AdminMonitor
      const responseData = await organizationAPI.getDetails();
      
      console.log('📦 Full response data:', responseData);
      
      // Handle response data - API interceptor already unwraps data
      const orgData = responseData.organisation;
      const statsData = responseData.stats || {};
      
      console.log('✅ Organisation Data loaded from SQLite:', orgData);
      console.log('✅ Stats Data loaded from SQLite:', statsData);
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
      setError(err.message || 'Failed to load organisation details');
    } finally {
      setLoading(false);
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading organisation details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={fetchOrganisationDetails}
            className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!organisation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">No Organisation</h2>
          <p className="text-gray-600">You are not assigned to any organisation yet.</p>
        </div>
      </div>
    );
  }

  // Safe getter function for stats with fallback
  const getStat = (statName) => {
    if (!stats) return 0;
    
    // Try multiple possible key formats (camelCase, snake_case, lowercase)
    const possibleKeys = [
      statName,
      statName.toLowerCase(),
      // Convert camelCase to snake_case
      statName.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
    ];
    
    for (const key of possibleKeys) {
      if (stats[key] !== undefined && stats[key] !== null) {
        console.log(`📊 Using stat ${statName}: ${stats[key]} (from key: ${key})`);
        return stats[key];
      }
    }
    
    console.warn(`⚠️ Stat ${statName} not found in stats object:`, stats);
    return 0;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-8 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">{organisation.display_name || organisation.name}</h1>
                <p className="text-emerald-100">{organisation.industry_type}</p>
              </div>
              <div className="w-20 h-20 bg-white rounded-lg flex items-center justify-center">
                <Building2 className="w-12 h-12 text-emerald-600" />
              </div>
            </div>
          </div>

          {/* Organisation ID Badge */}
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Organisation ID:</span>
              <span className="font-mono font-medium text-gray-900">{organisation.id}</span>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && Object.keys(stats).length > 0 && (
          <>
            {/* Data Source Indicator */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="text-sm text-green-800">
                  <strong>Data Source:</strong> Backend SQLite Database (Real-time data from local database)
                </p>
              </div>
              {process.env.NODE_ENV === 'development' && (
                <div className="mt-2 p-2 bg-white rounded border border-green-200">
                  <p className="text-xs text-gray-600 font-mono">
                    Debug: {JSON.stringify(stats, null, 2)}
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Total Users */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Users</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {getStat('totalUsers')}
                    </p>
                  </div>
                  <Users className="w-10 h-10 text-blue-500" />
                </div>
              </div>

              {/* Active Users */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Active Users</p>
                    <p className="text-3xl font-bold text-green-600">
                      {getStat('activeUsers')}
                    </p>
                  </div>
                  <Activity className="w-10 h-10 text-green-500" />
                </div>
              </div>

              {/* Admins */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Admins</p>
                    <p className="text-3xl font-bold text-purple-600">
                      {getStat('admins')}
                    </p>
                  </div>
                  <Shield className="w-10 h-10 text-purple-500" />
                </div>
              </div>

              {/* Subscription */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Subscription</p>
                    <p className="text-xl font-bold text-emerald-600 capitalize">
                      {organisation.subscription_tier || 'Standard'}
                    </p>
                  </div>
                  <Award className="w-10 h-10 text-emerald-500" />
                </div>
              </div>
            </div>

            {/* Role Breakdown */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">User Roles Breakdown</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <p className="text-2xl font-bold text-purple-600">{getStat('admins')}</p>
                  <p className="text-sm text-gray-600">Admins</p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{getStat('analysts')}</p>
                  <p className="text-sm text-gray-600">Analysts</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{getStat('contributors')}</p>
                  <p className="text-sm text-gray-600">Contributors</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-600">{getStat('viewers')}</p>
                  <p className="text-sm text-gray-600">Viewers</p>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 flex items-center">
                <Building2 className="w-5 h-5 mr-2 text-emerald-600" />
                Basic Information
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Organisation Name</label>
                <p className="mt-1 text-gray-900 font-medium">{organisation.name}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Display Name</label>
                <p className="mt-1 text-gray-900">{organisation.display_name || organisation.name}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Industry Type</label>
                <p className="mt-1 text-gray-900">{organisation.industry_type}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600 flex items-center">
                  <MapPin className="w-4 h-4 mr-1" />
                  Location
                </label>
                <p className="mt-1 text-gray-900">{organisation.location || 'Not specified'}</p>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 flex items-center">
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
                <p className="mt-1 text-gray-900">
                  <a href={`mailto:${organisation.contact_email}`} className="text-emerald-600 hover:text-emerald-700">
                    {organisation.contact_email}
                  </a>
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600 flex items-center">
                  <Phone className="w-4 h-4 mr-1" />
                  Phone
                </label>
                <p className="mt-1 text-gray-900">
                  {organisation.contact_phone ? (
                    <a href={`tel:${organisation.contact_phone}`} className="text-emerald-600 hover:text-emerald-700">
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
                <p className="mt-1 text-gray-900">
                  {organisation.website ? (
                    <a 
                      href={organisation.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-emerald-600 hover:text-emerald-700"
                    >
                      {organisation.website}
                    </a>
                  ) : (
                    'Not specified'
                  )}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Address</label>
                <p className="mt-1 text-gray-900">{organisation.address || 'Not specified'}</p>
              </div>
            </div>
          </div>

          {/* Organisation Details */}
          <div className="bg-white rounded-lg shadow border-l-4 border-emerald-500">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 flex items-center">
                <Shield className="w-5 h-5 mr-2 text-emerald-600" />
                Organisation Details
                <span className="ml-2 px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded">
                  Legal Info
                </span>
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Registered Name</label>
                <p className="mt-1 text-gray-900 font-medium">
                  {organisation.registered_name || organisation.name}
                </p>
                <p className="text-xs text-gray-500 mt-1">Legal name as per registration</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">CIN Number</label>
                <p className="mt-1 text-gray-900 font-mono">
                  {organisation.cin_number || (
                    <span className="text-gray-400 italic">Not provided</span>
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-1">Corporate Identity Number</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Registered Address</label>
                <p className="mt-1 text-gray-900 whitespace-pre-line">
                  {organisation.registered_address || (
                    <span className="text-gray-400 italic">Not provided</span>
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-1">Official registered address</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">GST Number</label>
                <p className="mt-1 text-gray-900 font-mono">
                  {organisation.gst_number || (
                    <span className="text-gray-400 italic">Not provided</span>
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-1">Goods and Services Tax ID</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600 flex items-center">
                  <Users className="w-4 h-4 mr-1" />
                  Current Employees
                </label>
                <p className="mt-1 text-2xl font-bold text-gray-900">
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
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-emerald-600" />
                System Information
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Subscription Tier</label>
                <p className="mt-1">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-800 capitalize">
                    {organisation.subscription_tier || 'Standard'}
                  </span>
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Max Users</label>
                <p className="mt-1 text-gray-900 font-medium">{organisation.max_users || 50}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">Status</label>
                <p className="mt-1">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    organisation.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {organisation.is_active ? 'Active' : 'Inactive'}
                  </span>
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600 flex items-center">
                  <Calendar className="w-4 h-4 mr-1" />
                  Created On
                </label>
                <p className="mt-1 text-gray-900">{formatDate(organisation.created_at)}</p>
              </div>

              {organisation.created_by && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Created By</label>
                  <p className="mt-1 text-gray-900">{organisation.created_by}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notes Section */}
        {organisation.notes && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-emerald-600" />
                Notes
              </h2>
            </div>
            <div className="p-6">
              <p className="text-gray-700 whitespace-pre-line">{organisation.notes}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrganisationPage;