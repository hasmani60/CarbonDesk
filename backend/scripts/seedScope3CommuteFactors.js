/**
 * Seed default Scope 3 Category 7 (employee commute) emission factors.
 * Run: node backend/scripts/seedScope3CommuteFactors.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const EmissionFactor = require('../models/EmissionFactor');

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

async function seed() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not defined');
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  let count = 0;
  for (const row of COMMUTE_DEFAULTS) {
    await EmissionFactor.findOneAndUpdate(
      {
        scope: 3,
        category: 'scope3_commute',
        subcategory: row.subcategory,
        organisation_id: null
      },
      {
        scope: 3,
        category: 'scope3_commute',
        subcategory: row.subcategory,
        factor: row.factor,
        unit: row.unit,
        description: row.description,
        source: 'UK Government GHG Conversion Factors (default seed)',
        year: 2024,
        isActive: true,
        organisation_id: null
      },
      { upsert: true, new: true }
    );
    count++;
  }

  console.log(`Seeded ${count} scope3_commute emission factors.`);
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
