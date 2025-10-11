// frontend/src/utils/localStorage.js
// Enhanced localStorage.js with DUPLICATE DETECTION + Organisation Filtering

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

/**
 * ===== NEW: DUPLICATE DETECTION HELPER =====
 * Checks if an identical emission already exists
 * Match criteria: organisation_id + scope + startDate + endDate + amount + category + subcategory
 */
const isDuplicateEmission = (newEmission, existingEmissions) => {
  const duplicate = existingEmissions.find(existing => {
    // Must match organisation
    if (existing.organisation_id !== newEmission.organisation_id) return false;
    
    // Must match scope
    if (existing.scope !== newEmission.scope) return false;
    
    // Must match dates (accounting period)
    const existingStart = existing.startDate || existing.accountingPeriod?.start;
    const existingEnd = existing.endDate || existing.accountingPeriod?.end;
    const newStart = newEmission.startDate || newEmission.accountingPeriod?.start;
    const newEnd = newEmission.endDate || newEmission.accountingPeriod?.end;
    
    if (existingStart !== newStart || existingEnd !== newEnd) return false;
    
    // Must match amount (with small floating-point tolerance)
    const amountDiff = Math.abs(parseFloat(existing.amount) - parseFloat(newEmission.amount));
    if (amountDiff > 0.0001) return false;
    
    // Must match category/activity type
    const existingCategory = existing.category || existing.activityType;
    const newCategory = newEmission.category || newEmission.activityType;
    if (existingCategory !== newCategory) return false;
    
    // Must match subcategory/source
    const existingSubcategory = existing.subcategory || existing.source || existing.type;
    const newSubcategory = newEmission.subcategory || newEmission.source || newEmission.type;
    if (existingSubcategory !== newSubcategory) return false;
    
    // All criteria matched - this is a duplicate
    return true;
  });
  
  if (duplicate) {
    console.warn('🔍 Duplicate found:', {
      existing_id: duplicate.id,
      existing_created: duplicate.createdAt,
      match_criteria: {
        organisation: duplicate.organisation_id,
        scope: duplicate.scope,
        dates: `${duplicate.startDate} to ${duplicate.endDate}`,
        amount: duplicate.amount,
        category: duplicate.category || duplicate.activityType,
        subcategory: duplicate.subcategory || duplicate.source
      }
    });
  }
  
  return !!duplicate;
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

// ===== UPDATED: Save emission with DUPLICATE DETECTION =====
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
      organisation_id: organisationId,
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

    // ===== DUPLICATE CHECK =====
    if (isDuplicateEmission(newEmission, allEmissions)) {
      console.warn('⚠️ DUPLICATE DETECTED - Emission not saved');
      console.warn('Duplicate criteria matched:', {
        organisation: newEmission.organisation_id,
        scope: newEmission.scope,
        category: newEmission.category || newEmission.activityType,
        subcategory: newEmission.subcategory || newEmission.source,
        amount: newEmission.amount,
        startDate: newEmission.startDate,
        endDate: newEmission.endDate
      });
      
      throw new Error('DUPLICATE_EMISSION: An identical emission entry already exists for this organisation, scope, date range, and amount.');
    }

    allEmissions.push(newEmission);
    localStorage.setItem(EMISSIONS_KEY, JSON.stringify(allEmissions));
    
    console.log('✅ Emission saved successfully:', organisationId);
    
    // Update cached stats
    updateCachedStats();
    
    // Emit real-time update events
    emitDataChange('emission-saved', { emission: newEmission, total: allEmissions.length });
    emitDataChange('emission-added', { emission: newEmission });
    emitDataChange('emissions-updated', { emissions: getEmissions(), count: getEmissions().length });
    
    return newEmission;
  } catch (error) {
    console.error('❌ Error saving emission:', error);
    throw error;
  }
};

// Update cached statistics
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

// Calculate emissions statistics
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
    
    if (!stats[scopeKey]) {
      console.warn(`Invalid scope: ${emission.scope}`);
      return;
    }
    
    stats[scopeKey].total += calculatedEmissions;
    stats[scopeKey].count += 1;
    stats[scopeKey].entries += 1;
    
    let activityKey;
    if (emission.category && emission.activityType) {
      activityKey = `${emission.category} - ${emission.activityType}`;
    } else if (emission.category && emission.subcategory) {
      activityKey = `${emission.category} - ${emission.subcategory}`;
    } else if (emission.activityType) {
      activityKey = emission.activityType;
    } else if (emission.category) {
      activityKey = emission.category;
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

// Get emissions statistics
export const getEmissionsStats = () => {
  try {
    const organisationId = getOrganisationIdFromToken();
    if (!organisationId) {
      return {
        scope1: { total: 0, count: 0, activities: {}, entries: 0 },
        scope2: { total: 0, count: 0, activities: {}, entries: 0 },
        scope3: { total: 0, count: 0, activities: {}, entries: 0 },
        overall: { totalEmissions: 0, totalEntries: 0, averageEmission: 0, lastUpdated: new Date().toISOString() }
      };
    }
    
    const cacheKey = `${STATS_KEY}_${organisationId}`;
    const cachedData = localStorage.getItem(cacheKey);
    
    if (cachedData) {
      const { stats, lastUpdated } = JSON.parse(cachedData);
      const cacheAge = new Date() - new Date(lastUpdated);
      if (cacheAge < 60000) {
        return stats;
      }
    }
    
    const stats = calculateEmissionsStats();
    updateCachedStats();
    return stats;
  } catch (error) {
    console.error('Error getting stats:', error);
    return {
      scope1: { total: 0, count: 0, activities: {}, entries: 0 },
      scope2: { total: 0, count: 0, activities: {}, entries: 0 },
      scope3: { total: 0, count: 0, activities: {}, entries: 0 },
      overall: { totalEmissions: 0, totalEntries: 0, averageEmission: 0, lastUpdated: new Date().toISOString() }
    };
  }
};

// Update emission
export const updateEmission = (id, updatedEmission) => {
  try {
    const organisationId = getOrganisationIdFromToken();
    if (!organisationId) {
      throw new Error('No organisation_id found');
    }
    
    const allEmissions = JSON.parse(localStorage.getItem(EMISSIONS_KEY) || '[]');
    const index = allEmissions.findIndex(e => 
      e.id === id && e.organisation_id === organisationId
    );
    
    if (index === -1) {
      throw new Error('Emission not found');
    }
    
    const timestamp = new Date().toISOString();
    allEmissions[index] = {
      ...allEmissions[index],
      ...updatedEmission,
      organisation_id: organisationId,
      amount: updatedEmission.amount ? parseFloat(updatedEmission.amount) : allEmissions[index].amount,
      scope: updatedEmission.scope ? parseInt(updatedEmission.scope) : allEmissions[index].scope,
      calculatedEmissions: updatedEmission.calculatedEmissions || 
        (parseFloat(updatedEmission.amount || allEmissions[index].amount) * (updatedEmission.factor || allEmissions[index].factor || 1)),
      updatedAt: timestamp
    };
    
    allEmissions[index].totalEmissions = allEmissions[index].calculatedEmissions;
    
    localStorage.setItem(EMISSIONS_KEY, JSON.stringify(allEmissions));
    updateCachedStats();
    
    emitDataChange('emission-updated', { emission: allEmissions[index] });
    
    return allEmissions[index];
  } catch (error) {
    console.error('Error updating emission:', error);
    throw error;
  }
};

// Delete emission
export const deleteEmission = (id) => {
  try {
    const organisationId = getOrganisationIdFromToken();
    if (!organisationId) {
      throw new Error('No organisation_id found');
    }
    
    const allEmissions = JSON.parse(localStorage.getItem(EMISSIONS_KEY) || '[]');
    const filteredEmissions = allEmissions.filter(e => 
      !(e.id === id && e.organisation_id === organisationId)
    );
    
    if (filteredEmissions.length === allEmissions.length) {
      throw new Error('Emission not found');
    }
    
    localStorage.setItem(EMISSIONS_KEY, JSON.stringify(filteredEmissions));
    updateCachedStats();
    
    emitDataChange('emission-deleted', { deletedId: id });
    
    return true;
  } catch (error) {
    console.error('Error deleting emission:', error);
    throw error;
  }
};

// Get emissions by scope
export const getEmissionsByScope = (scope) => {
  const emissions = getEmissions();
  return emissions.filter(e => e.scope === parseInt(scope));
};

// Get total emissions
export const getTotalEmissions = () => {
  const stats = getEmissionsStats();
  return stats.scope1.total + stats.scope2.total + stats.scope3.total;
};

// Get total entries count
export const getTotalEntries = () => {
  const emissions = getEmissions();
  return emissions.length;
};

// Clear all emissions for current organisation
export const clearAllEmissions = (createBackup = true) => {
  try {
    const organisationId = getOrganisationIdFromToken();
    if (!organisationId) {
      throw new Error('No organisation_id found');
    }
    
    const allEmissions = JSON.parse(localStorage.getItem(EMISSIONS_KEY) || '[]');
    const otherOrgEmissions = allEmissions.filter(e => e.organisation_id !== organisationId);
    
    localStorage.setItem(EMISSIONS_KEY, JSON.stringify(otherOrgEmissions));
    
    const cacheKey = `${STATS_KEY}_${organisationId}`;
    localStorage.removeItem(cacheKey);
    
    console.log(`🗑️ Cleared emissions for organisation: ${organisationId}`);
    
    emitDataChange('emissions-cleared', { organisation_id: organisationId });
    
    return true;
  } catch (error) {
    console.error('Error clearing emissions:', error);
    throw error;
  }
};

export default {
  getEmissions,
  saveEmission,
  updateEmission,
  deleteEmission,
  getEmissionsByScope,
  getEmissionsStats,
  getTotalEmissions,
  getTotalEntries,
  clearAllEmissions
};