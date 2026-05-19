/**
 * Seed default Scope 3 Category 7 (employee commute) emission factors.
 * Run: node backend/scripts/seedScope3CommuteFactors.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { ensureScope3CommuteFactors } = require('../services/scope3CommuteFactorSeed');

async function seed() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not defined');
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const count = await ensureScope3CommuteFactors();
  console.log(`Seeded ${count} scope3_commute emission factors.`);

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
