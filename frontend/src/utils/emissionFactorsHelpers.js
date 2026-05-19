// frontend/src/utils/emissionFactorsHelpers.js
// Helper functions for working with the new emission factors database

import { emissionFactors } from '../data/complete_emission_factors_db';

/**
 * Get emission factor data for a specific source
 * @param {number} scope - Scope (1, 2, or 3)
 * @param {string} category - Category name (e.g., "Gaseous Fuels")
 * @param {string} source - Source name (e.g., "Natural Gas (kWh Net CV)")
 * @returns {Object|null} Emission factor data or null if not found
 */
export const getEmissionFactor = (scope, category, source) => {
  const scopeKey = `scope${scope}`;
  const scopeData = emissionFactors[scopeKey];
  
  if (!scopeData || !scopeData[category] || !scopeData[category][source]) {
    console.error('Emission factor not found:', { scope, category, source });
    return null;
  }
  
  return scopeData[category][source];
};

/**
 * Calculate total emissions (CO2e) from activity data
 * @param {number} amount - Quantity of activity
 * @param {number} scope - Scope (1, 2, or 3)
 * @param {string} category - Category name
 * @param {string} source - Source name
 * @returns {number} Total emissions in kg CO2e
 */
export const calculateEmissions = (amount, scope, category, source) => {
  const factorData = getEmissionFactor(scope, category, source);
  
  if (!factorData) {
    console.error('Cannot calculate emissions: factor not found');
    return 0;
  }
  
  // Total emissions = amount × emission factor
  return amount * factorData.factor;
};

/**
 * Get detailed breakdown of emissions by gas type
 * @param {number} amount - Quantity of activity
 * @param {number} scope - Scope (1, 2, or 3)
 * @param {string} category - Category name
 * @param {string} source - Source name
 * @returns {Object} Breakdown with co2, ch4, n2o, and total
 */
export const getEmissionsBreakdown = (amount, scope, category, source) => {
  const factorData = getEmissionFactor(scope, category, source);
  
  if (!factorData) {
    return { co2: 0, ch4: 0, n2o: 0, total: 0 };
  }
  
  return {
    co2: amount * (factorData.co2 || 0),
    ch4: amount * (factorData.ch4 || 0),
    n2o: amount * (factorData.n2o || 0),
    total: amount * factorData.factor,
    factor: factorData.factor,
    unit: factorData.unit,
    description: factorData.description
  };
};

/**
 * Get all categories for a specific scope
 * @param {number} scope - Scope (1, 2, or 3)
 * @returns {string[]} Array of category names
 */
export const getCategoriesForScope = (scope) => {
  const scopeKey = `scope${scope}`;
  const scopeData = emissionFactors[scopeKey];
  
  if (!scopeData) {
    return [];
  }
  
  return Object.keys(scopeData);
};

/**
 * Get all sources for a specific scope and category
 * @param {number} scope - Scope (1, 2, or 3)
 * @param {string} category - Category name
 * @returns {string[]} Array of source names
 */
export const getSourcesForCategory = (scope, category) => {
  const scopeKey = `scope${scope}`;
  const scopeData = emissionFactors[scopeKey];
  
  if (!scopeData || !scopeData[category]) {
    return [];
  }
  
  return Object.keys(scopeData[category]);
};

/**
 * Get the unit for a specific source
 * @param {number} scope - Scope (1, 2, or 3)
 * @param {string} category - Category name
 * @param {string} source - Source name
 * @returns {string} Unit (e.g., "kg", "kWh", "km")
 */
export const getUnitForSource = (scope, category, source) => {
  const factorData = getEmissionFactor(scope, category, source);
  return factorData ? factorData.unit : 'kg';
};

/**
 * Search for emission factors by keyword
 * @param {string} keyword - Search term
 * @param {number|null} scope - Optional scope filter
 * @returns {Array} Array of matching emission factors with metadata
 */
export const searchEmissionFactors = (keyword, scope = null) => {
  const results = [];
  const searchTerm = keyword.toLowerCase();
  
  const scopes = scope ? [scope] : [1, 2, 3];
  
  scopes.forEach(s => {
    const scopeKey = `scope${s}`;
    const scopeData = emissionFactors[scopeKey];
    
    if (!scopeData) return;
    
    Object.entries(scopeData).forEach(([category, sources]) => {
      Object.entries(sources).forEach(([source, data]) => {
        if (
          category.toLowerCase().includes(searchTerm) ||
          source.toLowerCase().includes(searchTerm) ||
          data.description.toLowerCase().includes(searchTerm)
        ) {
          results.push({
            scope: s,
            category,
            source,
            ...data
          });
        }
      });
    });
  });
  
  return results;
};

/**
 * Validate if an emission factor exists
 * @param {number} scope - Scope (1, 2, or 3)
 * @param {string} category - Category name
 * @param {string} source - Source name
 * @returns {boolean} True if the emission factor exists
 */
export const validateEmissionFactor = (scope, category, source) => {
  return getEmissionFactor(scope, category, source) !== null;
};

/**
 * Get emission factor statistics for a scope
 * @param {number} scope - Scope (1, 2, or 3)
 * @returns {Object} Statistics about emission factors in this scope
 */
export const getEmissionFactorStats = (scope) => {
  const scopeKey = `scope${scope}`;
  const scopeData = emissionFactors[scopeKey];
  
  if (!scopeData) {
    return {
      categoryCount: 0,
      sourceCount: 0,
      categories: []
    };
  }
  
  const categories = Object.keys(scopeData);
  const sourceCount = categories.reduce((sum, cat) => {
    return sum + Object.keys(scopeData[cat]).length;
  }, 0);
  
  return {
    categoryCount: categories.length,
    sourceCount,
    categories: categories.map(cat => ({
      name: cat,
      sourceCount: Object.keys(scopeData[cat]).length
    }))
  };
};

/**
 * Format emission value with appropriate precision
 * @param {number} value - Emission value
 * @param {string} type - Type of emission ('total', 'co2', 'ch4', 'n2o')
 * @returns {string} Formatted value
 */
export const formatEmissionValue = (value, type = 'total') => {
  if (type === 'ch4' || type === 'n2o') {
    // More precision for smaller values
    return value.toFixed(6);
  }
  return value.toFixed(4);
};

/**
 * Convert emissions to different units
 * @param {number} kgCO2e - Emissions in kg CO2e
 * @param {string} targetUnit - Target unit ('kg', 'tonnes', 'g')
 * @returns {number} Converted value
 */
export const convertEmissionUnits = (kgCO2e, targetUnit) => {
  switch (targetUnit.toLowerCase()) {
    case 'g':
    case 'grams':
      return kgCO2e * 1000;
    case 't':
    case 'tonnes':
    case 'tons':
      return kgCO2e / 1000;
    case 'kg':
    case 'kilograms':
    default:
      return kgCO2e;
  }
};

/**
 * Get emission factor comparison between sources
 * @param {Array} sources - Array of {scope, category, source} objects
 * @returns {Array} Sorted array with emission factors
 */
export const compareEmissionFactors = (sources) => {
  return sources
    .map(({ scope, category, source }) => {
      const data = getEmissionFactor(scope, category, source);
      return {
        scope,
        category,
        source,
        factor: data?.factor || 0,
        unit: data?.unit || 'unknown',
        description: data?.description || 'No description'
      };
    })
    .sort((a, b) => b.factor - a.factor);
};

// Export the emission factors database as well
export { emissionFactors };