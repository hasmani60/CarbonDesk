/**
 * Backfill transport_category = 'raw_material' on existing Scope 3 material transport emissions.
 * Run: node backend/scripts/migrateTransportCategory.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Emission = require('../models/Emission');
const { materialTransportMatchFilter } = require('../utils/transportEmissionUtils');

async function migrate() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not defined');
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const filter = {
    $and: [
      materialTransportMatchFilter(),
      {
        $or: [
          { transport_category: { $exists: false } },
          { transport_category: null },
          { transport_category: '' }
        ]
      }
    ]
  };

  const result = await Emission.updateMany(filter, {
    $set: { transport_category: 'raw_material' }
  });

  console.log(
    `Updated ${result.modifiedCount} emission(s) with transport_category = 'raw_material' (${result.matchedCount} matched).`
  );

  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
