// Updated localStorage.js with improved data handling and proper return values
const EMISSIONS_KEY = 'carbon_accounting_emissions';

// Get all emissions from localStorage
export const getEmissions = () => {
  try {
    const emissions = localStorage.getItem(EMISSIONS_KEY);
    return emissions ? JSON.parse(emissions) : [];
  } catch (error) {
    console.error('Error reading emissions from localStorage:', error);
    return [];
  }
};

// Save emission to localStorage
export const saveEmission = (emission) => {
  try {
    const emissions = getEmissions();
    const newEmission = {
      id: Date.now().toString(),
      ...emission,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    emissions.push(newEmission);
    localStorage.setItem(EMISSIONS_KEY, JSON.stringify(emissions));
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
      emissions[index] = {
        ...emissions[index],
        ...updatedEmission,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(EMISSIONS_KEY, JSON.stringify(emissions));
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
    return true;
  } catch (error) {
    console.error('Error deleting emission from localStorage:', error);
    throw error;
  }
};

// Get emissions by scope
export const getEmissionsByScope = (scope) => {
  const emissions = getEmissions();
  return emissions.filter(e => e.scope === parseInt(scope));
};

// Get emissions statistics for dashboard
export const getEmissionsStats = () => {
  const emissions = getEmissions();
  
  const stats = {
    scope1: { total: 0, count: 0, activities: {} },
    scope2: { total: 0, count: 0, activities: {} },
    scope3: { total: 0, count: 0, activities: {} }
  };

  emissions.forEach(emission => {
    const scopeKey = `scope${emission.scope}`;
    const calculatedEmissions = emission.calculatedEmissions || emission.totalEmissions || (emission.amount * (emission.factor || 1));
    
    // Update totals
    stats[scopeKey].total += calculatedEmissions;
    stats[scopeKey].count += 1;
    
    // Create activity key - prioritize category + activityType, fallback to category + type
    const activityKey = emission.category && emission.activityType 
      ? `${emission.category} - ${emission.activityType}`
      : emission.category && emission.type
      ? `${emission.category} - ${emission.type}`
      : emission.category || 'Unknown Activity';
    
    // Update activity breakdown
    if (!stats[scopeKey].activities[activityKey]) {
      stats[scopeKey].activities[activityKey] = {
        total: 0,
        count: 0,
        category: emission.category || 'Unknown',
        type: emission.activityType || emission.type || 'Unknown'
      };
    }
    stats[scopeKey].activities[activityKey].total += calculatedEmissions;
    stats[scopeKey].activities[activityKey].count += 1;
  });

  return stats;
};

// Get top emission types by scope (for dashboard)
export const getTopEmissionsByScope = (scope, limit = 3) => {
  const stats = getEmissionsStats();
  const scopeKey = `scope${scope}`;
  
  const activities = Object.entries(stats[scopeKey].activities)
    .map(([key, data]) => ({
      name: key,
      ...data
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
  
  return activities;
};

// Get emissions by date range
export const getEmissionsByDateRange = (startDate, endDate) => {
  const emissions = getEmissions();
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  return emissions.filter(emission => {
    const emissionDate = new Date(emission.startDate || emission.createdAt);
    return emissionDate >= start && emissionDate <= end;
  });
};

// Get monthly emissions summary
export const getMonthlyEmissions = (year) => {
  const emissions = getEmissions();
  const monthlyData = {};
  
  emissions.forEach(emission => {
    const date = new Date(emission.startDate || emission.createdAt);
    if (date.getFullYear() === year) {
      const monthKey = date.getMonth(); // 0-11
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: date.toLocaleDateString('en-US', { month: 'short' }),
          scope1: 0,
          scope2: 0,
          scope3: 0,
          total: 0
        };
      }
      
      const scopeKey = `scope${emission.scope}`;
      const emissionValue = emission.calculatedEmissions || (emission.amount * (emission.factor || 1));
      
      monthlyData[monthKey][scopeKey] += emissionValue;
      monthlyData[monthKey].total += emissionValue;
    }
  });
  
  return Object.values(monthlyData);
};

// Get total emissions across all scopes
export const getTotalEmissions = () => {
  const stats = getEmissionsStats();
  return stats.scope1.total + stats.scope2.total + stats.scope3.total;
};

// Clear all emissions (for testing/reset)
export const clearAllEmissions = () => {
  try {
    localStorage.removeItem(EMISSIONS_KEY);
    return true;
  } catch (error) {
    console.error('Error clearing emissions from localStorage:', error);
    throw error;
  }
};

// Get emissions count by status
export const getEmissionsByStatus = (status) => {
  const emissions = getEmissions();
  return emissions.filter(e => e.status === status);
};

// Search emissions by query
export const searchEmissions = (query) => {
  if (!query || query.trim() === '') return getEmissions();
  
  const emissions = getEmissions();
  const searchTerm = query.toLowerCase();
  
  return emissions.filter(emission => 
    (emission.category && emission.category.toLowerCase().includes(searchTerm)) ||
    (emission.activityType && emission.activityType.toLowerCase().includes(searchTerm)) ||
    (emission.source && emission.source.toLowerCase().includes(searchTerm)) ||
    (emission.location && emission.location.toLowerCase().includes(searchTerm)) ||
    (emission.description && emission.description.toLowerCase().includes(searchTerm))
  );
};