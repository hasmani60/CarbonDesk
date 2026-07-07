/**
 * Update Indian Grid electricity emission factor to CEA FY 2024-25 (0.710 kgCO2/kWh).
 * Run: node backend/scripts/updateIndianGridEmissionFactor.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const {
  ensureIndianGridElectricityFactors,
  FACTOR_KG_PER_KWH,
  INDIAN_GRID_CATEGORY
} = require('../services/indianGridEmissionFactorSeed');

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not defined');
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const { indianGrid, legacyUpdates } = await ensureIndianGridElectricityFactors();

  console.log('\nIndian Grid primary record:');
  console.log(JSON.stringify(indianGrid.toObject(), null, 2));

  console.log(`\nUpdated ${legacyUpdates.length} legacy grid electricity records to ${FACTOR_KG_PER_KWH} kgCO2/kWh.`);

  const verify = await mongoose.connection.db
    .collection('emissionfactors')
    .findOne({ category: INDIAN_GRID_CATEGORY, isActive: true });

  if (!verify || verify.factor !== FACTOR_KG_PER_KWH) {
    throw new Error('Verification failed: Indian Grid factor not set correctly in emissionfactors');
  }

  console.log('\nVerification passed: emissionfactors collection contains CEA FY 2024-25 factor.');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Update failed:', err);
  process.exit(1);
});
