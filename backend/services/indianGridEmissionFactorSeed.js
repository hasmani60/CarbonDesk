const EmissionFactor = require('../models/EmissionFactor');

const INDIAN_GRID_CATEGORY = 'Indian Grid Electricity';
const CEA_SOURCE = 'Central Electricity Authority (CEA)';
const CEA_DATASET =
  'Weighted Average Emission Factor (Considering Renewable Energy Generation) of Indian Grid';
const FINANCIAL_YEAR = '2024-25';
const FACTOR_KG_PER_KWH = 0.71;

const INDIAN_GRID_DESCRIPTION =
  'CEA FY 2024-25 weighted average Indian grid (0.710 tCO2/MWh = 0.710 kgCO2/kWh)';

const globalFactorFilter = (scope, category, subcategory) => ({
  scope,
  category,
  subcategory,
  $or: [{ organisation_id: null }, { organisation_id: { $exists: false } }]
});

const buildIndianGridFactorDoc = (scope, category, subcategory, description) => ({
  scope,
  category,
  subcategory,
  factor: FACTOR_KG_PER_KWH,
  unit: 'kWh',
  co2: FACTOR_KG_PER_KWH,
  ch4: 0,
  n2o: 0,
  description: description || INDIAN_GRID_DESCRIPTION,
  source: CEA_SOURCE,
  dataset: CEA_DATASET,
  financialYear: FINANCIAL_YEAR,
  year: 2025,
  isActive: true,
  organisation_id: null
});

/** Primary Indian grid factor (canonical record). */
const INDIAN_GRID_PRIMARY = {
  scope: 2,
  category: INDIAN_GRID_CATEGORY,
  subcategory: 'Grid Electricity (kWh)',
  description: INDIAN_GRID_DESCRIPTION
};

/**
 * Scope 2 electricity categories currently used in production emissions data.
 * These retain legacy DEFRA category names but use the CEA Indian grid factor.
 */
const LEGACY_GRID_ELECTRICITY_UPDATES = [
  {
    scope: 2,
    category: 'UK Electricity',
    subcategory: 'Grid Electricity (kWh)',
    description: INDIAN_GRID_DESCRIPTION
  },
  {
    scope: 2,
    category: 'UK Electricity',
    subcategory: 'Grid Electricity - Location Based (kWh)',
    description: `${INDIAN_GRID_DESCRIPTION} (location-based)`
  },
  {
    scope: 2,
    category: 'UK Electricity for Electric Vehicles',
    subcategory: 'Grid Electricity for EVs (kWh)',
    description: `${INDIAN_GRID_DESCRIPTION} for EV charging`
  },
  {
    scope: 2,
    category: 'UK Electricity for Electric Vehicles',
    subcategory: 'Grid Electricity for EVs - Location Based (kWh)',
    description: `${INDIAN_GRID_DESCRIPTION} for EV charging (location-based)`
  }
];

/**
 * Upsert CEA FY 2024-25 Indian grid electricity factors (idempotent).
 * Returns { indianGrid, legacyUpdates } with saved documents.
 */
async function ensureIndianGridElectricityFactors() {
  const indianGrid = await EmissionFactor.findOneAndUpdate(
    globalFactorFilter(
      INDIAN_GRID_PRIMARY.scope,
      INDIAN_GRID_PRIMARY.category,
      INDIAN_GRID_PRIMARY.subcategory
    ),
    buildIndianGridFactorDoc(
      INDIAN_GRID_PRIMARY.scope,
      INDIAN_GRID_PRIMARY.category,
      INDIAN_GRID_PRIMARY.subcategory,
      INDIAN_GRID_PRIMARY.description
    ),
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const legacyUpdates = [];
  for (const row of LEGACY_GRID_ELECTRICITY_UPDATES) {
    const doc = await EmissionFactor.findOneAndUpdate(
      globalFactorFilter(row.scope, row.category, row.subcategory),
      buildIndianGridFactorDoc(row.scope, row.category, row.subcategory, row.description),
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    legacyUpdates.push(doc);
  }

  return { indianGrid, legacyUpdates };
}

module.exports = {
  INDIAN_GRID_CATEGORY,
  CEA_SOURCE,
  CEA_DATASET,
  FINANCIAL_YEAR,
  FACTOR_KG_PER_KWH,
  INDIAN_GRID_PRIMARY,
  LEGACY_GRID_ELECTRICITY_UPDATES,
  ensureIndianGridElectricityFactors
};
