const EmissionFactor = require('../models/EmissionFactor');
const Emission = require('../models/Emission');

const GRID_ELECTRICITY_CATEGORY = 'Grid Electricity';
const GRID_ELECTRICITY_SUBCATEGORY = 'Electricity (kWh)';
const CEA_SOURCE = 'Central Electricity Authority (CEA)';
const CEA_DATASET =
  'Weighted Average Emission Factor (Considering Renewable Energy Generation) of Indian Grid';
const FINANCIAL_YEAR = '2024-25';
const FACTOR_KG_PER_KWH = 0.71;

const LEGACY_SCOPE2_CATEGORIES = [
  'Indian Grid Electricity',
  'UK Electricity',
  'UK Electricity for Electric Vehicles',
  'Transmission & Distribution Losses'
];

const globalFactorFilter = (scope, category, subcategory) => ({
  scope,
  category,
  subcategory,
  $or: [{ organisation_id: null }, { organisation_id: { $exists: false } }]
});

const buildGridElectricityFactorDoc = () => ({
  scope: 2,
  category: GRID_ELECTRICITY_CATEGORY,
  subcategory: GRID_ELECTRICITY_SUBCATEGORY,
  factor: FACTOR_KG_PER_KWH,
  unit: 'kWh',
  co2: FACTOR_KG_PER_KWH,
  ch4: 0,
  n2o: 0,
  description: '',
  source: CEA_SOURCE,
  dataset: CEA_DATASET,
  financialYear: FINANCIAL_YEAR,
  year: 2025,
  isActive: true,
  organisation_id: null
});

/**
 * Upsert the single Scope 2 grid factor and deactivate legacy electricity categories.
 */
async function ensureGridElectricityFactor() {
  const gridFactor = await EmissionFactor.findOneAndUpdate(
    globalFactorFilter(2, GRID_ELECTRICITY_CATEGORY, GRID_ELECTRICITY_SUBCATEGORY),
    buildGridElectricityFactorDoc(),
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const deactivated = await EmissionFactor.updateMany(
    {
      scope: 2,
      category: { $in: LEGACY_SCOPE2_CATEGORIES },
      $or: [{ organisation_id: null }, { organisation_id: { $exists: false } }]
    },
    { $set: { isActive: false } }
  );

  return { gridFactor, deactivatedCount: deactivated.modifiedCount };
}

/**
 * Point existing Scope 2 emission records at the canonical Grid Electricity category.
 */
async function migrateScope2EmissionCategories() {
  const result = await Emission.updateMany(
    {
      scope: 2,
      category: { $in: LEGACY_SCOPE2_CATEGORIES }
    },
    {
      $set: {
        category: GRID_ELECTRICITY_CATEGORY,
        source: GRID_ELECTRICITY_SUBCATEGORY,
        subcategory: GRID_ELECTRICITY_SUBCATEGORY,
        activity: GRID_ELECTRICITY_SUBCATEGORY
      }
    }
  );

  return result.modifiedCount;
}

module.exports = {
  GRID_ELECTRICITY_CATEGORY,
  GRID_ELECTRICITY_SUBCATEGORY,
  CEA_SOURCE,
  CEA_DATASET,
  FINANCIAL_YEAR,
  FACTOR_KG_PER_KWH,
  LEGACY_SCOPE2_CATEGORIES,
  ensureGridElectricityFactor,
  migrateScope2EmissionCategories
};
