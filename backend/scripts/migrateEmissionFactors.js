require('dotenv').config();
const mongoose = require('mongoose');
const EmissionFactor = require('../models/EmissionFactor');
const path = require('path');

async function migrate() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in the environment');
    }

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Read the complete_emission_factors_db.js
    const dataPath = path.join(__dirname, '../data/complete_emission_factors_db.js');
    const { emissionFactors } = require(dataPath);

    let count = 0;
    
    // Process the data
    for (const [scopeKey, categories] of Object.entries(emissionFactors)) {
      const scopeNumber = parseInt(scopeKey.replace('scope', ''));
      
      for (const [category, subcategories] of Object.entries(categories)) {
        for (const [subcategory, details] of Object.entries(subcategories)) {
          
          const doc = {
            scope: scopeNumber,
            category,
            subcategory,
            factor: details.factor,
            unit: details.unit,
            co2: details.co2 || null,
            ch4: details.ch4 || null,
            n2o: details.n2o || null,
            description: details.description || '',
            source: 'UK Government GHG Conversion Factors',
            year: 2023,
            isActive: true
          };

          await EmissionFactor.findOneAndUpdate(
            { scope: scopeNumber, category, subcategory },
            doc,
            { upsert: true, new: true }
          );
          count++;
        }
      }
    }

    console.log(`Successfully migrated ${count} emission factors to MongoDB.`);
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
