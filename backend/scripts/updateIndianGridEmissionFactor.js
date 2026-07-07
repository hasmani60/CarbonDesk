/**
 * Configure Scope 2 to a single Grid Electricity factor (CEA FY 2024-25).
 * Run: node backend/scripts/updateIndianGridEmissionFactor.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const {
  ensureGridElectricityFactor,
  migrateScope2EmissionCategories,
  FACTOR_KG_PER_KWH,
  GRID_ELECTRICITY_CATEGORY,
  GRID_ELECTRICITY_SUBCATEGORY
} = require('../services/gridElectricityEmissionFactorSeed');

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not defined');
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const { gridFactor, deactivatedCount } = await ensureGridElectricityFactor();
  const migratedEmissions = await migrateScope2EmissionCategories();

  console.log('\nGrid Electricity factor record:');
  console.log(JSON.stringify(gridFactor.toObject(), null, 2));
  console.log(`\nDeactivated ${deactivatedCount} legacy Scope 2 factor records.`);
  console.log(`Migrated ${migratedEmissions} Scope 2 emission records to "${GRID_ELECTRICITY_CATEGORY}".`);

  const verify = await mongoose.connection.db.collection('emissionfactors').findOne({
    scope: 2,
    category: GRID_ELECTRICITY_CATEGORY,
    subcategory: GRID_ELECTRICITY_SUBCATEGORY,
    isActive: true
  });

  if (!verify || verify.factor !== FACTOR_KG_PER_KWH) {
    throw new Error('Verification failed: Grid Electricity factor not set correctly in emissionfactors');
  }

  const activeLegacy = await mongoose.connection.db.collection('emissionfactors').countDocuments({
    scope: 2,
    category: { $in: ['Indian Grid Electricity', 'UK Electricity', 'UK Electricity for Electric Vehicles', 'Transmission & Distribution Losses'] },
    isActive: true
  });

  if (activeLegacy > 0) {
    throw new Error(`Verification failed: ${activeLegacy} legacy Scope 2 factors still active`);
  }

  console.log('\nVerification passed: only Grid Electricity is active for Scope 2.');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Update failed:', err);
  process.exit(1);
});
