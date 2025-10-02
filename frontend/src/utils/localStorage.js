// Enhanced localStorage.js with Organisation Filtering + All Features
const EMISSIONS_KEY = 'carbon_accounting_emissions';
const STATS_KEY = 'carbon_accounting_stats';

// Helper function to decode JWT and extract organisation_id
const getOrganisationIdFromToken = () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('⚠️ No authentication token found');
      return null;
    }
    
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    
    const orgId = decoded.organisation_id || decoded.organizationId;
    console.log('🏢 Extracted organisation_id from token:', orgId);
    
    return orgId;
  } catch (error) {
    console.error('❌ Error decoding token:', error);
    return null;
  }
};

// Helper function to get current user info
const getCurrentUser = () => {
  try {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    return JSON.parse(userStr);
  } catch (error) {
    console.error('Error parsing user data:', error);
    return null;
  }
};

// Clean up legacy emissions without organisation_id
const cleanupLegacyEmissions = () => {
  try {
    const allEmissions = JSON.parse(localStorage.getItem(EMISSIONS_KEY) || '[]');
    const validEmissions = allEmissions.filter(e => e.organisation_id);
    
    if (validEmissions.length !== allEmissions.length) {
      console.log(`🧹 Cleaned up ${allEmissions.length - validEmissions.length} legacy emissions without organisation_id`);
      localStorage.setItem(EMISSIONS_KEY, JSON.stringify(validEmissions));
    }
  } catch (error) {
    console.error('Error cleaning up legacy emissions:', error);
  }
};

// Initialize on load
cleanupLegacyEmissions();

// Emit custom events for real-time updates
const emitDataChange = (eventType, data) => {
  window.dispatchEvent(new CustomEvent(eventType, { detail: data }));
};

// Get all emissions from localStorage with organisation filtering
export const getEmissions = () => {
  try {
    const organisationId = getOrganisationIdFromToken();
    
    if (!organisationId) {
      console.warn('⚠️ No organisation_id available - returning empty array');
      return [];
    }
    
    const allEmissions = localStorage.getItem(EMISSIONS_KEY);
    const parsedEmissions = allEmissions ? JSON.parse(allEmissions) : [];
    
    // CRITICAL: Filter by organisation_id
    const orgEmissions = parsedEmissions.filter(e => e.organisation_id === organisationId);
    
    console.log(`🔍 Filtered emissions: ${orgEmissions.length} of ${parsedEmissions.length} total`);
    console.log(`🏢 Current organisation: ${organisationId}`);
    
    // Ensure all emissions have required fields
    return orgEmissions.map(emission => ({
      ...emission,
      calculatedEmissions: emission.calculatedEmissions || (emission.amount * (emission.factor || 1)),
      totalEmissions: emission.totalEmissions || emission.calculatedEmissions || (emission.amount * (emission.factor || 1)),
      status: emission.status || 'active',
      createdAt: emission.createdAt || new Date().toISOString(),
      updatedAt: emission.updatedAt || emission.createdAt || new Date().toISOString()
    }));
  } catch (error) {
    console.error('❌ Error reading emissions from localStorage:', error);
    return [];
  }
};

// Save emission to localStorage with organisation_id
export const saveEmission = (emission) => {
  try {
    const organisationId = getOrganisationIdFromToken();
    const user = getCurrentUser();
    
    if (!organisationId) {
      throw new Error('No organisation_id found. Please log in again.');
    }
    
    // Validate required fields
    if (!emission.scope || !emission.amount) {
      throw new Error('Emission must have scope and amount');
    }

    // Get ALL emissions (not filtered)
    const allEmissions = JSON.parse(localStorage.getItem(EMISSIONS_KEY) || '[]');
    const timestamp = new Date().toISOString();
    
    const newEmission = {
      id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
      ...emission,
      organisation_id: organisationId, // CRITICAL: Add organisation_id
      organisation_name: user?.organisation?.name || 'Unknown Organisation',
      user: user?.id || 'unknown',
      userName: user?.name || 'Unknown User',
      amount: parseFloat(emission.amount),
      scope: parseInt(emission.scope),
      calculatedEmissions: emission.calculatedEmissions || (parseFloat(emission.amount) * (emission.factor || 1)),
      totalEmissions: emission.totalEmissions || emission.calculatedEmissions || (parseFloat(emission.amount) * (emission.factor || 1)),
      createdAt: timestamp,
      updatedAt: timestamp,
      status: emission.status || 'active'
    };

    allEmissions.push(newEmission);
    localStorage.setItem(EMISSIONS_KEY, JSON.stringify(allEmissions));
    
    console.log('✅ Emission saved with organisation_id:', organisationId);
    console.log('📊 Emission data:', newEmission);
    
    // Update cached stats
    updateCachedStats();
    
    // Emit real-time update events
    emitDataChange('emission-saved', { emission: newEmission, total: allEmissions.length });
    emitDataChange('emission-added', { emission: newEmission });
    emitDataChange('emissions-updated', { emissions: getEmissions(), count: getEmissions().length });
    
    return newEmission;
  } catch (error) {
    console.error('❌ Error saving emission to localStorage:', error);
    throw error;
  }
};

// Update emission in localStorage with organisation check
export const updateEmission = (id, updatedEmission) => {
  try {
    const organisationId = getOrganisationIdFromToken();
    if (!organisationId) {
      throw new Error('No organisation_id found');
    }
    
    const allEmissions = JSON.parse(localStorage.getItem(EMISSIONS_KEY) || '[]');
    const index = allEmissions.findIndex(e => 
      e.id === id && e.organisation_id === organisationId // Ensure same org
    );
    
    if (index === -1) {
      throw new Error('Emission not found or access denied');
    }
    
    const timestamp = new Date().toISOString();
    allEmissions[index] = {
      ...allEmissions[index],
      ...updatedEmission,
      organisation_id: organisationId, // Preserve organisation_id
      amount: updatedEmission.amount ? parseFloat(updatedEmission.amount) : allEmissions[index].amount,
      scope: updatedEmission.scope ? parseInt(updatedEmission.scope) : allEmissions[index].scope,
      calculatedEmissions: updatedEmission.calculatedEmissions || 
        (parseFloat(updatedEmission.amount || allEmissions[index].amount) * (updatedEmission.factor || allEmissions[index].factor || 1)),
      updatedAt: timestamp
    };
    
    // Recalculate totalEmissions
    allEmissions[index].totalEmissions = allEmissions[index].calculatedEmissions;
    
    localStorage.setItem(EMISSIONS_KEY, JSON.stringify(allEmissions));
    updateCachedStats();
    
    console.log('✅ Emission updated:', id);
    
    emitDataChange('emission-updated', { emission: allEmissions[index], total: getEmissions().length });
    emitDataChange('emissions-updated', { emissions: getEmissions(), count: getEmissions().length });
    
    return allEmissions[index];
  } catch (error) {
    console.error('❌ Error updating emission in localStorage:', error);
    throw error;
  }
};

// Delete emission from localStorage with organisation check
export const deleteEmission = (id) => {
  try {
    const organisationId = getOrganisationIdFromToken();
    if (!organisationId) {
      throw new Error('No organisation_id found');
    }
    
    const allEmissions = JSON.parse(localStorage.getItem(EMISSIONS_KEY) || '[]');
    
    // Only delete if it belongs to current organisation
    const filteredEmissions = allEmissions.filter(e => 
      !(e.id === id && e.organisation_id === organisationId)
    );
    
    if (filteredEmissions.length === allEmissions.length) {
      throw new Error('Emission not found or access denied');
    }
    
    localStorage.setItem(EMISSIONS_KEY, JSON.stringify(filteredEmissions));
    updateCachedStats();
    
    console.log('✅ Emission deleted:', id);
    
    emitDataChange('emission-deleted', { deletedId: id, total: getEmissions().length });
    emitDataChange('emissions-updated', { emissions: getEmissions(), count: getEmissions().length });
    
    return true;
  } catch (error) {
    console.error('❌ Error deleting emission from localStorage:', error);
    throw error;
  }
};

// Get emissions by scope (organisation-filtered)
export const getEmissionsByScope = (scope) => {
  const emissions = getEmissions(); // Already filtered by organisation
  return emissions.filter(e => e.scope === parseInt(scope));
};

// Update cached statistics for better performance (organisation-specific)
const updateCachedStats = () => {
  try {
    const organisationId = getOrganisationIdFromToken();
    if (!organisationId) return;
    
    const stats = calculateEmissionsStats();
    const cacheKey = `${STATS_KEY}_${organisationId}`;
    
    localStorage.setItem(cacheKey, JSON.stringify({
      stats,
      organisation_id: organisationId,
      lastUpdated: new Date().toISOString()
    }));
  } catch (error) {
    console.error('Error updating cached stats:', error);
  }
};

// Calculate emissions statistics (uses organisation-filtered data)
const calculateEmissionsStats = () => {
  const emissions = getEmissions(); // Already filtered by organisation
  
  const stats = {
    scope1: { total: 0, count: 0, activities: {}, entries: 0 },
    scope2: { total: 0, count: 0, activities: {}, entries: 0 },
    scope3: { total: 0, count: 0, activities: {}, entries: 0 },
    overall: {
      totalEmissions: 0,
      totalEntries: emissions.length,
      averageEmission: 0,
      lastUpdated: new Date().toISOString()
    }
  };

  emissions.forEach(emission => {
    const scopeKey = `scope${emission.scope}`;
    const calculatedEmissions = emission.calculatedEmissions || emission.totalEmissions || (emission.amount * (emission.factor || 1));
    
    if (!stats[scopeKey]) {
      console.warn(`Invalid scope: ${emission.scope} for emission ${emission.id}`);
      return;
    }
    
    stats[scopeKey].total += calculatedEmissions;
    stats[scopeKey].count += 1;
    stats[scopeKey].entries += 1;
    
    // Create activity key
    let activityKey;
    if (emission.category && emission.activityType) {
      activityKey = `${emission.category} - ${emission.activityType}`;
    } else if (emission.category && emission.subcategory) {
      activityKey = `${emission.category} - ${emission.subcategory}`;
    } else if (emission.activityType) {
      activityKey = emission.activityType;
    } else if (emission.category) {
      activityKey = emission.category;
    } else if (emission.source) {
      activityKey = `Unknown Activity - ${emission.source}`;
    } else {
      activityKey = 'Unknown Activity';
    }
    
    if (!stats[scopeKey].activities[activityKey]) {
      stats[scopeKey].activities[activityKey] = {
        total: 0,
        count: 0,
        category: emission.category || 'Unknown',
        type: emission.activityType || emission.subcategory || 'Unknown',
        scope: emission.scope,
        averageEmission: 0,
        lastUpdated: new Date().toISOString()
      };
    }
    
    stats[scopeKey].activities[activityKey].total += calculatedEmissions;
    stats[scopeKey].activities[activityKey].count += 1;
    stats[scopeKey].activities[activityKey].averageEmission = 
      stats[scopeKey].activities[activityKey].total / stats[scopeKey].activities[activityKey].count;
    
    stats.overall.totalEmissions += calculatedEmissions;
  });

  stats.overall.averageEmission = emissions.length > 0 
    ? stats.overall.totalEmissions / emissions.length 
    : 0;

  return stats;
};

// Get emissions statistics (organisation-specific with caching)
export const getEmissionsStats = () => {
  try {
    const organisationId = getOrganisationIdFromToken();
    if (!organisationId) {
      console.warn('⚠️ No organisation_id - returning empty stats');
      return {
        scope1: { total: 0, count: 0, activities: {}, entries: 0 },
        scope2: { total: 0, count: 0, activities: {}, entries: 0 },
        scope3: { total: 0, count: 0, activities: {}, entries: 0 },
        overall: {
          totalEmissions: 0,
          totalEntries: 0,
          averageEmission: 0,
          lastUpdated: new Date().toISOString()
        }
      };
    }
    
    const cacheKey = `${STATS_KEY}_${organisationId}`;
    const cachedData = localStorage.getItem(cacheKey);
    
    if (cachedData) {
      const { stats, lastUpdated } = JSON.parse(cachedData);
      const cacheAge = new Date() - new Date(lastUpdated);
      if (cacheAge < 60000) { // 1 minute cache
        return stats;
      }
    }
    
    const stats = calculateEmissionsStats();
    updateCachedStats();
    
    console.log('📈 Stats calculated:', {
      scope1: stats.scope1.count,
      scope2: stats.scope2.count,
      scope3: stats.scope3.count,
      total: stats.overall.totalEntries
    });
    
    return stats;
  } catch (error) {
    console.error('❌ Error getting emissions stats:', error);
    return {
      scope1: { total: 0, count: 0, activities: {}, entries: 0 },
      scope2: { total: 0, count: 0, activities: {}, entries: 0 },
      scope3: { total: 0, count: 0, activities: {}, entries: 0 },
      overall: {
        totalEmissions: 0,
        totalEntries: 0,
        averageEmission: 0,
        lastUpdated: new Date().toISOString()
      }
    };
  }
};

// Get top emission types by scope
export const getTopEmissionsByScope = (scope, limit = 3) => {
  const stats = getEmissionsStats();
  const scopeKey = `scope${scope}`;
  
  if (!stats[scopeKey]) return [];
  
  const activities = Object.entries(stats[scopeKey].activities)
    .map(([key, data]) => ({
      name: key,
      shortName: key.length > 30 ? key.substring(0, 30) + '...' : key,
      ...data,
      percentage: stats[scopeKey].total > 0 ? (data.total / stats[scopeKey].total) * 100 : 0
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
  
  return activities;
};

// Get emissions by date range
export const getEmissionsByDateRange = (startDate, endDate) => {
  const emissions = getEmissions(); // Already filtered by organisation
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  return emissions.filter(emission => {
    const emissionDate = new Date(emission.startDate || emission.accountingPeriod?.start || emission.createdAt);
    return emissionDate >= start && emissionDate <= end;
  });
};

// Get monthly emissions summary
export const getMonthlyEmissions = (year = new Date().getFullYear()) => {
  const emissions = getEmissions(); // Already filtered by organisation
  const monthlyData = {};
  
  for (let i = 0; i < 12; i++) {
    const monthName = new Date(year, i, 1).toLocaleDateString('en-US', { month: 'short' });
    monthlyData[i] = {
      month: monthName,
      monthNumber: i + 1,
      year: year,
      scope1: 0,
      scope2: 0,
      scope3: 0,
      total: 0,
      count1: 0,
      count2: 0,
      count3: 0,
      totalCount: 0,
      activities: {}
    };
  }
  
  emissions.forEach(emission => {
    const date = new Date(emission.startDate || emission.accountingPeriod?.start || emission.createdAt);
    if (date.getFullYear() === year) {
      const monthKey = date.getMonth();
      
      const scopeKey = `scope${emission.scope}`;
      const countKey = `count${emission.scope}`;
      const emissionValue = emission.calculatedEmissions || emission.totalEmissions || (emission.amount * (emission.factor || 1));
      
      monthlyData[monthKey][scopeKey] += emissionValue;
      monthlyData[monthKey][countKey] += 1;
      monthlyData[monthKey].total += emissionValue;
      monthlyData[monthKey].totalCount += 1;
      
      const activityName = emission.category || emission.activityType || 'Unknown';
      if (!monthlyData[monthKey].activities[activityName]) {
        monthlyData[monthKey].activities[activityName] = 0;
      }
      monthlyData[monthKey].activities[activityName] += emissionValue;
    }
  });
  
  return Object.values(monthlyData);
};

// Get total emissions across all scopes
export const getTotalEmissions = () => {
  const stats = getEmissionsStats();
  const total = stats.scope1.total + stats.scope2.total + stats.scope3.total;
  console.log(`💰 Total emissions: ${total.toFixed(2)} CO₂e from ${stats.overall.totalEntries} records`);
  return total;
};

// Get total entries count
export const getTotalEntries = () => {
  const emissions = getEmissions();
  return emissions.length;
};

// Get entry count by scope
export const getEntryCountByScope = (scope) => {
  const emissions = getEmissions();
  return emissions.filter(e => e.scope === parseInt(scope)).length;
};

// Get emissions count by status
export const getEmissionsByStatus = (status) => {
  const emissions = getEmissions();
  return emissions.filter(e => e.status === status);
};

// Search emissions by query
export const searchEmissions = (query, filters = {}) => {
  if (!query || query.trim() === '') {
    return applyFiltersToEmissions(getEmissions(), filters);
  }
  
  const emissions = getEmissions(); // Already filtered by organisation
  const searchTerm = query.toLowerCase();
  
  let filteredEmissions = emissions.filter(emission => 
    (emission.category && emission.category.toLowerCase().includes(searchTerm)) ||
    (emission.activityType && emission.activityType.toLowerCase().includes(searchTerm)) ||
    (emission.subcategory && emission.subcategory.toLowerCase().includes(searchTerm)) ||
    (emission.source && emission.source.toLowerCase().includes(searchTerm)) ||
    (emission.location && emission.location.toLowerCase().includes(searchTerm)) ||
    (emission.description && emission.description.toLowerCase().includes(searchTerm)) ||
    (emission.userName && emission.userName.toLowerCase().includes(searchTerm)) ||
    (emission.unit && emission.unit.toLowerCase().includes(searchTerm))
  );
  
  return applyFiltersToEmissions(filteredEmissions, filters);
};

// Apply filters to emissions
const applyFiltersToEmissions = (emissions, filters) => {
  let filteredEmissions = [...emissions];
  
  if (filters.scope) {
    filteredEmissions = filteredEmissions.filter(e => e.scope === parseInt(filters.scope));
  }
  
  if (filters.status) {
    filteredEmissions = filteredEmissions.filter(e => e.status === filters.status);
  }
  
  if (filters.dateRange) {
    const now = new Date();
    let startDate;
    
    switch (filters.dateRange) {
      case '7days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90days':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = null;
    }
    
    if (startDate) {
      filteredEmissions = filteredEmissions.filter(e => 
        new Date(e.startDate || e.createdAt) >= startDate
      );
    }
  }
  
  if (filters.minEmissions) {
    filteredEmissions = filteredEmissions.filter(e => 
      (e.calculatedEmissions || e.totalEmissions || 0) >= parseFloat(filters.minEmissions)
    );
  }
  
  if (filters.maxEmissions) {
    filteredEmissions = filteredEmissions.filter(e => 
      (e.calculatedEmissions || e.totalEmissions || 0) <= parseFloat(filters.maxEmissions)
    );
  }
  
  return filteredEmissions;
};

// Export all emissions data (organisation-specific)
export const exportEmissionsData = () => {
  const organisationId = getOrganisationIdFromToken();
  const user = getCurrentUser();
  const emissions = getEmissions();
  const stats = getEmissionsStats();
  
  return {
    organisation_id: organisationId,
    organisation_name: user?.organisation?.name || 'Unknown',
    emissions,
    statistics: stats,
    summary: {
      totalEntries: emissions.length,
      totalEmissions: getTotalEmissions(),
      scopeBreakdown: {
        scope1: { entries: getEntryCountByScope(1), emissions: stats.scope1.total },
        scope2: { entries: getEntryCountByScope(2), emissions: stats.scope2.total },
        scope3: { entries: getEntryCountByScope(3), emissions: stats.scope3.total }
      },
      exportedAt: new Date().toISOString()
    }
  };
};

// Import emissions data (organisation-aware)
export const importEmissionsData = (data) => {
  try {
    const organisationId = getOrganisationIdFromToken();
    if (!organisationId) {
      throw new Error('No organisation_id found');
    }
    
    if (data.emissions && Array.isArray(data.emissions)) {
      // Get existing emissions from all organisations
      const allEmissions = JSON.parse(localStorage.getItem(EMISSIONS_KEY) || '[]');
      
      // Add organisation_id to imported emissions if not present
      const importedEmissions = data.emissions.map(e => ({
        ...e,
        organisation_id: e.organisation_id || organisationId
      }));
      
      // Merge with existing
      const mergedEmissions = [...allEmissions, ...importedEmissions];
      
      localStorage.setItem(EMISSIONS_KEY, JSON.stringify(mergedEmissions));
      updateCachedStats();
      
      emitDataChange('emissions-imported', { 
        count: importedEmissions.length, 
        importedAt: new Date().toISOString() 
      });
      
      return { success: true, count: importedEmissions.length };
    } else {
      throw new Error('Invalid data format');
    }
  } catch (error) {
    console.error('Error importing emissions data:', error);
    throw error;
  }
};

// Clear all emissions for current organisation only
export const clearAllEmissions = (createBackup = true) => {
  try {
    const organisationId = getOrganisationIdFromToken();
    if (!organisationId) {
      throw new Error('No organisation_id found');
    }
    
    if (createBackup) {
      const backupData = exportEmissionsData();
      localStorage.setItem(`carbon_accounting_backup_${organisationId}`, JSON.stringify(backupData));
    }
    
    // Get all emissions
    const allEmissions = JSON.parse(localStorage.getItem(EMISSIONS_KEY) || '[]');
    
    // Keep only emissions from OTHER organisations
    const otherOrgEmissions = allEmissions.filter(e => e.organisation_id !== organisationId);
    
    localStorage.setItem(EMISSIONS_KEY, JSON.stringify(otherOrgEmissions));
    
    // Clear stats cache for this org
    const cacheKey = `${STATS_KEY}_${organisationId}`;
    localStorage.removeItem(cacheKey);
    
    console.log(`🗑️ Cleared emissions for organisation: ${organisationId}`);
    
    emitDataChange('emissions-cleared', { 
      organisation_id: organisationId,
      clearedAt: new Date().toISOString(),
      backup: createBackup 
    });
    
    return true;
  } catch (error) {
    console.error('Error clearing emissions from localStorage:', error);
    throw error;
  }
};

// Get data health check (organisation-specific)
export const getDataHealthCheck = () => {
  try {
    const emissions = getEmissions();
    const stats = getEmissionsStats();
    const organisationId = getOrganisationIdFromToken();
    
    const health = {
      status: 'healthy',
      organisation_id: organisationId,
      issues: [],
      summary: {
        totalEntries: emissions.length,
        totalEmissions: getTotalEmissions(),
        lastUpdated: stats.overall.lastUpdated
      }
    };
    
    emissions.forEach((emission, index) => {
      if (!emission.id) {
        health.issues.push(`Emission at index ${index} missing ID`);
        health.status = 'warning';
      }
      
      if (!emission.organisation_id) {
        health.issues.push(`Emission ${emission.id || index} missing organisation_id`);
        health.status = 'error';
      }
      
      if (!emission.scope || ![1, 2, 3].includes(emission.scope)) {
        health.issues.push(`Emission ${emission.id || index} has invalid scope: ${emission.scope}`);
        health.status = 'warning';
      }
      
      if (!emission.amount || emission.amount <= 0) {
        health.issues.push(`Emission ${emission.id || index} has invalid amount: ${emission.amount}`);
        health.status = 'warning';
      }
      
      if (!emission.calculatedEmissions && !emission.totalEmissions) {
        health.issues.push(`Emission ${emission.id || index} missing calculated emissions`);
        health.status = 'warning';
      }
    });
    
    if (health.issues.length > 5) {
      health.status = 'error';
    }
    
    return health;
  } catch (error) {
    console.error('Error performing health check:', error);
    return {
      status: 'error',
      issues: [`Health check failed: ${error.message}`],
      summary: null
    };
  }
};

// Debug function to check organisation filtering
export const debugOrganisationData = () => {
  const organisationId = getOrganisationIdFromToken();
  const allEmissions = JSON.parse(localStorage.getItem(EMISSIONS_KEY) || '[]');
  const orgEmissions = getEmissions();
  
  console.log('🔍 ORGANISATION DEBUG INFO:');
  console.log('Current organisation_id:', organisationId);
  console.log('Total emissions in storage:', allEmissions.length);
  console.log('Emissions for current org:', orgEmissions.length);
  console.log('Organisation breakdown:', 
    allEmissions.reduce((acc, e) => {
      acc[e.organisation_id || 'no-org'] = (acc[e.organisation_id || 'no-org'] || 0) + 1;
      return acc;
    }, {})
  );
  
  return {
    currentOrg: organisationId,
    totalEmissions: allEmissions.length,
    orgEmissions: orgEmissions.length,
    breakdown: allEmissions.reduce((acc, e) => {
      acc[e.organisation_id || 'no-org'] = (acc[e.organisation_id || 'no-org'] || 0) + 1;
      return acc;
    }, {})
  };
};

// Export debug function to window for console access
if (typeof window !== 'undefined') {
  window.debugOrganisationData = debugOrganisationData;
}