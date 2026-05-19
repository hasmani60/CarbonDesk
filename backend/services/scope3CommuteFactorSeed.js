const EmissionFactor = require('../models/EmissionFactor');

const COMMUTE_CATEGORY = 'scope3_commute';

const COMMUTE_DEFAULTS = [
  { subcategory: 'personal_car_petrol', factor: 2.31, unit: 'kg_co2_per_litre', description: 'Petrol car commute' },
  { subcategory: 'personal_car_diesel', factor: 2.68, unit: 'kg_co2_per_litre', description: 'Diesel car commute' },
  { subcategory: 'two_wheeler_petrol', factor: 2.31, unit: 'kg_co2_per_litre', description: 'Petrol two-wheeler commute' },
  { subcategory: 'two_wheeler_diesel', factor: 2.68, unit: 'kg_co2_per_litre', description: 'Diesel two-wheeler commute' },
  { subcategory: 'cng_vehicle', factor: 2.0, unit: 'kg_co2_per_litre', description: 'CNG vehicle commute' },
  { subcategory: 'electric_vehicle', factor: 0.053, unit: 'kg_co2_per_passenger_km', description: 'Electric vehicle commute' },
  { subcategory: 'bus', factor: 0.089, unit: 'kg_co2_per_passenger_km', description: 'Bus commute' },
  { subcategory: 'metro', factor: 0.035, unit: 'kg_co2_per_passenger_km', description: 'Metro commute' },
  { subcategory: 'train', factor: 0.041, unit: 'kg_co2_per_passenger_km', description: 'Train commute' },
  { subcategory: 'cab_shared', factor: 0.12, unit: 'kg_co2_per_passenger_km', description: 'Shared cab commute' },
  { subcategory: 'cab_solo', factor: 0.21, unit: 'kg_co2_per_passenger_km', description: 'Solo cab commute' },
  { subcategory: 'bicycle', factor: 0, unit: 'kg_co2_per_passenger_km', description: 'Bicycle commute' },
  { subcategory: 'walking', factor: 0, unit: 'kg_co2_per_passenger_km', description: 'Walking commute' }
];

const globalFactorFilter = (subcategory) => ({
  scope: 3,
  category: COMMUTE_CATEGORY,
  subcategory,
  $or: [{ organisation_id: null }, { organisation_id: { $exists: false } }]
});

/**
 * Upsert default global commute factors (idempotent). Returns number of modes ensured.
 */
async function ensureScope3CommuteFactors() {
  let ensured = 0;

  for (const row of COMMUTE_DEFAULTS) {
    await EmissionFactor.findOneAndUpdate(
      globalFactorFilter(row.subcategory),
      {
        scope: 3,
        category: COMMUTE_CATEGORY,
        subcategory: row.subcategory,
        factor: row.factor,
        unit: row.unit,
        description: row.description,
        source: 'UK Government GHG Conversion Factors (default seed)',
        year: 2024,
        isActive: true,
        organisation_id: null
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    ensured++;
  }

  return ensured;
}

module.exports = {
  COMMUTE_CATEGORY,
  COMMUTE_DEFAULTS,
  ensureScope3CommuteFactors
};
