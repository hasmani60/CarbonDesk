// backend/database/run-duplicate-fix-migration.js
// Script to run the duplicate prevention migration

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'carbon_accounting.db');

console.log('🚀 Starting Duplicate Prevention Migration...\n');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
    process.exit(1);
  }
  console.log('✅ Database connected\n');
});

// Helper function to run queries
function runQuery(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

// Helper function to get data
function allQuery(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function migrate() {
  try {
    console.log('📋 STEP 1: Checking for existing duplicates...\n');
    
    // Check for duplicates
    const duplicates = await allQuery(`
      SELECT 
        organisation_id, scope, activity, date, co2e, created_by,
        COUNT(*) as count,
        GROUP_CONCAT(id) as ids
      FROM emissions
      GROUP BY organisation_id, scope, activity, date, co2e, created_by
      HAVING count > 1
    `);
    
    if (duplicates.length > 0) {
      console.log(`⚠️  Found ${duplicates.length} duplicate groups:`);
      duplicates.forEach((dup, idx) => {
        console.log(`   ${idx + 1}. Activity: ${dup.activity}, Date: ${dup.date}, CO2e: ${dup.co2e}, Count: ${dup.count}`);
        console.log(`      IDs: ${dup.ids}`);
      });
      console.log();
      
      console.log('📋 STEP 2: Removing duplicate entries (keeping oldest)...\n');
      
      // Delete duplicates, keep the oldest (minimum id)
      const deleteResult = await runQuery(`
        DELETE FROM emissions
        WHERE id NOT IN (
          SELECT MIN(id)
          FROM emissions
          GROUP BY organisation_id, scope, activity, date, co2e, created_by
        )
      `);
      
      console.log(`✅ Removed ${deleteResult.changes} duplicate records\n`);
    } else {
      console.log('✅ No duplicates found in database\n');
    }
    
    console.log('📋 STEP 3: Creating unique composite index...\n');
    
    try {
      await runQuery(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_emissions_unique_entry ON emissions(
          organisation_id,
          scope,
          activity,
          date,
          co2e,
          created_by
        )
      `);
      console.log('✅ Unique index created: idx_emissions_unique_entry\n');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('✅ Unique index already exists\n');
      } else {
        throw err;
      }
    }
    
    console.log('📋 STEP 4: Creating performance indexes...\n');
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_emissions_org_scope ON emissions(organisation_id, scope)',
      'CREATE INDEX IF NOT EXISTS idx_emissions_org_activity ON emissions(organisation_id, activity)',
      'CREATE INDEX IF NOT EXISTS idx_emissions_org_date ON emissions(organisation_id, date)',
      'CREATE INDEX IF NOT EXISTS idx_emissions_created_by_date ON emissions(created_by, date)'
    ];
    
    for (const indexQuery of indexes) {
      try {
        await runQuery(indexQuery);
        const indexName = indexQuery.match(/idx_[a-z_]+/)[0];
        console.log(`✅ Created index: ${indexName}`);
      } catch (err) {
        if (!err.message.includes('already exists')) {
          console.error(`❌ Error creating index: ${err.message}`);
        }
      }
    }
    console.log();
    
    console.log('📋 STEP 5: Verification...\n');
    
    // Verify no duplicates remain
    const remainingDuplicates = await allQuery(`
      SELECT 
        organisation_id, scope, activity, date, co2e, created_by,
        COUNT(*) as count
      FROM emissions
      GROUP BY organisation_id, scope, activity, date, co2e, created_by
      HAVING count > 1
    `);
    
    if (remainingDuplicates.length > 0) {
      console.log('❌ WARNING: Some duplicates still exist!');
      console.log('   This may indicate an issue with the migration.');
    } else {
      console.log('✅ No duplicates found - database is clean');
    }
    
    // Verify indexes
    const allIndexes = await allQuery(`
      SELECT name FROM sqlite_master 
      WHERE type='index' AND tbl_name='emissions'
      ORDER BY name
    `);
    
    console.log(`✅ Total indexes on emissions table: ${allIndexes.length}`);
    allIndexes.forEach(idx => {
      console.log(`   - ${idx.name}`);
    });
    console.log();
    
    // Get emissions count
    const countResult = await allQuery('SELECT COUNT(*) as count FROM emissions');
    console.log(`📊 Total emissions in database: ${countResult[0].count}\n`);
    
    console.log('=' .repeat(60));
    console.log('✅ MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('\n📝 Next Steps:\n');
    console.log('  1. The controller code has duplicate prevention logic');
    console.log('  2. The database now has a unique constraint');
    console.log('  3. Test by submitting the same emission twice');
    console.log('  4. Expected: Second submission returns existing record\n');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('\nError details:', error.message);
    process.exit(1);
  } finally {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      }
      process.exit(0);
    });
  }
}

// Run migration
migrate();