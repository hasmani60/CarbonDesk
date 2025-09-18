// Enhanced localStorage.js with improved data handling, accurate counting, and real-time updates
const EMISSIONS_KEY = 'carbon_accounting_emissions';
const STATS_KEY = 'carbon_accounting_stats';

// Emit custom events for real-time updates
const emitDataChange = (eventType, data) => {
  window.dispatchEvent(new CustomEvent(eventType, { detail: data }));
};

// Get all emissions from localStorage with error handling
export const getEmissions = () => {
  try {
    const emissions = localStorage.getItem(EMISSIONS_KEY);
    const parsedEmissions = emissions ? JSON.parse(emissions) : [];
    
    // Ensure all emissions have required fields
    return parsedEmissions.map(emission => ({
      ...emission,
      calculatedEmissions: emission.calculatedEmissions || (emission.amount * (emission.factor || 1)),
      totalEmissions: emission.totalEmissions || emission.calculatedEmissions || (emission.amount * (emission.factor || 1)),
      status: emission.status || 'active',
      createdAt: emission.createdAt || new Date().toISOString(),
      updatedAt: emission.updatedAt || emission.createdAt || new Date().toISOString()
    }));
  } catch (error) {
    console.error('Error reading emissions from localStorage:', error);
    return [];
  }
};

// Save emission to localStorage with enhanced validation and real-time updates
export const saveEmission = (emission) => {
  try {
    // Validate required fields
    if (!emission.scope || !emission.amount) {
      throw new Error('Emission must have scope and amount');
    }

    const emissions = getEmissions();
    const timestamp = new Date().toISOString();
    
    const newEmission = {
      id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
      ...emission,
      amount: parseFloat(emission.amount),
      scope: parseInt(emission.scope),
      calculatedEmissions: emission.calculatedEmissions || (parseFloat(emission.amount) * (emission.factor || 1)),
      totalEmissions: emission.totalEmissions || emission.calculatedEmissions || (parseFloat(emission.amount) * (emission.factor || 1)),
      createdAt: timestamp,
      updatedAt: timestamp,
      status: emission.status || 'active'
    };

    emissions.push(newEmission);
    localStorage.setItem(EMISSIONS_KEY, JSON.stringify(emissions));
    
    // Update cached stats
    updateCachedStats();
    
    // Emit real-time update events
    emitDataChange('emission-saved', { emission: newEmission, total: emissions.length });
    emitDataChange('emissions-updated', { emissions, count: emissions.length });
    
    return newEmission;
  } catch (error) {
    console.error('Error saving emission to localStorage:', error);
    throw error;
  }
};

// Update emission in localStorage
export const updateEmission = (id, updatedEmission) => {
  try {
    const emissions = getEmissions();
    const index = emissions.findIndex(e => e.id === id);
    
    if (index !== -1) {
      const timestamp = new Date().toISOString();
      emissions[index] = {
        ...emissions[index],
        ...updatedEmission,
        amount: updatedEmission.amount ? parseFloat(updatedEmission.amount) : emissions[index].amount,
        scope: updatedEmission.scope ? parseInt(updatedEmission.scope) : emissions[index].scope,
        calculatedEmissions: updatedEmission.calculatedEmissions || 
          (parseFloat(updatedEmission.amount || emissions[index].amount) * (updatedEmission.factor || emissions[index].factor || 1)),
        updatedAt: timestamp
      };
      
      // Recalculate totalEmissions
      emissions[index].totalEmissions = emissions[index].calculatedEmissions;
      
      localStorage.setItem(EMISSIONS_KEY, JSON.stringify(emissions));
      updateCachedStats();
      
      emitDataChange('emission-updated', { emission: emissions[index], total: emissions.length });
      emitDataChange('emissions-updated', { emissions, count: emissions.length });
      
      return emissions[index];
    }
    throw new Error('Emission not found');
  } catch (error) {
    console.error('Error updating emission in localStorage:', error);
    throw error;
  }
};

// Delete emission from localStorage
export const deleteEmission = (id) => {
  try {
    const emissions = getEmissions();
    const filteredEmissions = emissions.filter(e => e.id !== id);
    
    localStorage.setItem(EMISSIONS_KEY, JSON.stringify(filteredEmissions));
    updateCachedStats();
    
    emitDataChange('emission-deleted', { deletedId: id, total: filteredEmissions.length });
    emitDataChange('emissions-updated', { emissions: filteredEmissions, count: filteredEmissions.length });
    
    return true;
  } catch (error) {
    console.error('Error deleting emission from localStorage:', error);
    throw error;
  }
};

// Get emissions by scope with accurate counting
export const getEmissionsByScope = (scope) => {
  const emissions = getEmissions();
  return emissions.filter(e => e.scope === parseInt(scope));
};

// Update cached statistics for better performance
const updateCachedStats = () => {
  try {
    const stats = calculateEmissionsStats();
    localStorage.setItem(STATS_KEY, JSON.stringify({
      stats,
      lastUpdated: new Date().toISOString()
    }));
  } catch (error) {
    console.error('Error updating cached stats:', error);
  }
};

// Calculate emissions statistics with enhanced accuracy
const calculateEmissionsStats = () => {
  const emissions = getEmissions();
  
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
    
    // Ensure we have a valid scope
    if (!stats[scopeKey]) {
      console.warn(`Invalid scope: ${emission.scope} for emission ${emission.id}`);
      return;
    }
    
    // Update scope totals
    stats[scopeKey].total += calculatedEmissions;
    stats[scopeKey].count += 1;
    stats[scopeKey].entries += 1;
    
    // Create activity key with fallback options
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
    
    // Update activity breakdown
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
    
    // Update overall stats
    stats.overall.totalEmissions += calculatedEmissions;
  });

  // Calculate overall average
  stats.overall.averageEmission = emissions.length > 0 
    ? stats.overall.totalEmissions / emissions.length 
    : 0;

  return stats;
};

// Get emissions statistics with caching for better performance
export const getEmissionsStats = () => {
  try {
    // Check if we have cached stats that are recent (less than 1 minute old)
    const cachedData = localStorage.getItem(STATS_KEY);
    if (cachedData) {
      const { stats, lastUpdated } = JSON.parse(cachedData);
      const cacheAge = new Date() - new Date(lastUpdated);
      if (cacheAge < 60000) { // 1 minute cache
        return stats;
      }
    }
    
    // Calculate fresh stats
    const stats = calculateEmissionsStats();
    updateCachedStats();
    return stats;
  } catch (error) {
    console.error('Error getting emissions stats:', error);
    // Return empty stats structure
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

// Get top emission types by scope with enhanced data
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

// Get emissions by date range with performance optimization
export const getEmissionsByDateRange = (startDate, endDate) => {
  const emissions = getEmissions();
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  return emissions.filter(emission => {
    const emissionDate = new Date(emission.startDate || emission.accountingPeriod?.start || emission.createdAt);
    return emissionDate >= start && emissionDate <= end;
  });
};

// Get monthly emissions summary with enhanced data structure
export const getMonthlyEmissions = (year = new Date().getFullYear()) => {
  const emissions = getEmissions();
  const monthlyData = {};
  
  // Initialize all months
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
      const monthKey = date.getMonth(); // 0-11
      
      const scopeKey = `scope${emission.scope}`;
      const countKey = `count${emission.scope}`;
      const emissionValue = emission.calculatedEmissions || emission.totalEmissions || (emission.amount * (emission.factor || 1));
      
      monthlyData[monthKey][scopeKey] += emissionValue;
      monthlyData[monthKey][countKey] += 1;
      monthlyData[monthKey].total += emissionValue;
      monthlyData[monthKey].totalCount += 1;
      
      // Track activities by month
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
  return stats.scope1.total + stats.scope2.total + stats.scope3.total;
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

// Get emissions count by status with real counts
export const getEmissionsByStatus = (status) => {
  const emissions = getEmissions();
  return emissions.filter(e => e.status === status);
};

// Search emissions by query with enhanced search capabilities
export const searchEmissions = (query, filters = {}) => {
  if (!query || query.trim() === '') {
    return applyFiltersToEmissions(getEmissions(), filters);
  }
  
  const emissions = getEmissions();
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

// Export all emissions data for backup/analysis
export const exportEmissionsData = () => {
  const emissions = getEmissions();
  const stats = getEmissionsStats();
  
  return {
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

// Import emissions data (for data migration or restore)
export const importEmissionsData = (data) => {
  try {
    if (data.emissions && Array.isArray(data.emissions)) {
      localStorage.setItem(EMISSIONS_KEY, JSON.stringify(data.emissions));
      updateCachedStats();
      
      emitDataChange('emissions-imported', { 
        count: data.emissions.length, 
        importedAt: new Date().toISOString() 
      });
      
      return { success: true, count: data.emissions.length };
    } else {
      throw new Error('Invalid data format');
    }
  } catch (error) {
    console.error('Error importing emissions data:', error);
    throw error;
  }
};

// Clear all emissions with backup option
export const clearAllEmissions = (createBackup = true) => {
  try {
    if (createBackup) {
      const backupData = exportEmissionsData();
      localStorage.setItem('carbon_accounting_backup', JSON.stringify(backupData));
    }
    
    localStorage.removeItem(EMISSIONS_KEY);
    localStorage.removeItem(STATS_KEY);
    
    emitDataChange('emissions-cleared', { 
      clearedAt: new Date().toISOString(),
      backup: createBackup 
    });
    
    return true;
  } catch (error) {
    console.error('Error clearing emissions from localStorage:', error);
    throw error;
  }
};

// Get data health check
export const getDataHealthCheck = () => {
  try {
    const emissions = getEmissions();
    const stats = getEmissionsStats();
    
    const health = {
      status: 'healthy',
      issues: [],
      summary: {
        totalEntries: emissions.length,
        totalEmissions: getTotalEmissions(),
        lastUpdated: stats.overall.lastUpdated
      }
    };
    
    // Check for common data issues
    emissions.forEach((emission, index) => {
      if (!emission.id) {
        health.issues.push(`Emission at index ${index} missing ID`);
        health.status = 'warning';
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