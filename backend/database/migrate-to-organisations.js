// backend/database/migrate-to-organisations.js
// Complete migration script to add organisation scoping to existing database

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'carbon_accounting.db');

console.log('🚀 Starting Organisation Migration...\n');

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
function getQuery(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// Helper function to get all data
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
    console.log('📋 STEP 1: Checking current database structure...\n');
    
    // Check if users table has organisation_id
    const usersSchema = await allQuery("PRAGMA table_info(users)");
    const hasUserOrgColumn = usersSchema.some(col => col.name === 'organisation_id');
    
    if (!hasUserOrgColumn) {
      console.log('  ➕ Adding organisation_id to users table...');
      await runQuery('ALTER TABLE users ADD COLUMN organisation_id TEXT');
      console.log('  ✅ Added organisation_id to users\n');
    } else {
      console.log('  ✅ users.organisation_id already exists\n');
    }
    
    // Check if emissions table exists and add organisation_id
    try {
      const emissionsSchema = await allQuery("PRAGMA table_info(emissions)");
      const hasEmissionOrgColumn = emissionsSchema.some(col => col.name === 'organisation_id');
      
      if (!hasEmissionOrgColumn) {
        console.log('  ➕ Adding organisation_id to emissions table...');
        await runQuery('ALTER TABLE emissions ADD COLUMN organisation_id TEXT');
        console.log('  ✅ Added organisation_id to emissions\n');
      } else {
        console.log('  ✅ emissions.organisation_id already exists\n');
      }
    } catch (error) {
      console.log('  ⚠️  emissions table does not exist yet (will be created later)\n');
    }
    
    // Add other tables that need organisation_id
    const tablesToMigrate = [
      'vehicles',
      'generators',
      'activity_logs'
    ];
    
    for (const table of tablesToMigrate) {
      try {
        const schema = await allQuery(`PRAGMA table_info(${table})`);
        const hasOrgColumn = schema.some(col => col.name === 'organisation_id');
        
        if (!hasOrgColumn && schema.length > 0) {
          console.log(`  ➕ Adding organisation_id to ${table} table...`);
          await runQuery(`ALTER TABLE ${table} ADD COLUMN organisation_id TEXT`);
          console.log(`  ✅ Added organisation_id to ${table}\n`);
        }
      } catch (error) {
        console.log(`  ⚠️  ${table} table does not exist\n`);
      }
    }
    
    console.log('📋 STEP 2: Checking for legacy data...\n');
    
    // Check for users without organisation_id
    const usersWithoutOrg = await getQuery(
      'SELECT COUNT(*) as count FROM users WHERE organisation_id IS NULL'
    );
    
    console.log(`  Found ${usersWithoutOrg.count} users without organisation\n`);
    
    if (usersWithoutOrg.count > 0) {
      console.log('📋 STEP 3: Creating Legacy Organisation...\n');
      
      // Check if legacy org already exists
      const legacyOrg = await getQuery(
        'SELECT * FROM organisations WHERE id = ?',
        ['ORG-LEGACY-001']
      );
      
      if (!legacyOrg) {
        console.log('  ➕ Creating Legacy Organisation...');
        await runQuery(`
          INSERT INTO organisations (
            id, name, display_name, industry_type, 
            location, contact_email, is_active, 
            subscription_tier, max_users, created_by, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          'ORG-LEGACY-001',
          'Legacy Data',
          'Legacy Data (Pre-Migration)',
          'General',
          'N/A',
          'legacy@system.local',
          1,
          'standard',
          999,
          'system_migration',
          'Automatically created during migration to hold pre-existing data'
        ]);
        console.log('  ✅ Legacy Organisation created (ORG-LEGACY-001)\n');
        
        // Create settings for legacy org
        console.log('  ➕ Creating settings for Legacy Organisation...');
        await runQuery(`
          INSERT INTO organisation_settings (
            organisation_id, primary_color, secondary_color,
            default_reporting_period, timezone, currency
          ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
          'ORG-LEGACY-001',
          '#10b981',
          '#059669',
          'monthly',
          'UTC',
          'USD'
        ]);
        console.log('  ✅ Settings created\n');
      } else {
        console.log('  ✅ Legacy Organisation already exists\n');
      }
      
      console.log('📋 STEP 4: Migrating legacy users...\n');
      
      // Migrate users to legacy org
      const migratedUsers = await runQuery(
        'UPDATE users SET organisation_id = ? WHERE organisation_id IS NULL',
        ['ORG-LEGACY-001']
      );
      console.log(`  ✅ Migrated ${migratedUsers.changes} users to Legacy Organisation\n`);
      
      // Migrate emissions if they exist
      try {
        console.log('📋 STEP 5: Migrating legacy emissions...\n');
        const migratedEmissions = await runQuery(
          'UPDATE emissions SET organisation_id = ? WHERE organisation_id IS NULL',
          ['ORG-LEGACY-001']
        );
        console.log(`  ✅ Migrated ${migratedEmissions.changes} emissions to Legacy Organisation\n`);
      } catch (error) {
        console.log('  ⚠️  No emissions to migrate\n');
      }
      
      // Migrate other tables
      for (const table of tablesToMigrate) {
        try {
          const migrated = await runQuery(
            `UPDATE ${table} SET organisation_id = ? WHERE organisation_id IS NULL`,
            ['ORG-LEGACY-001']
          );
          if (migrated.changes > 0) {
            console.log(`  ✅ Migrated ${migrated.changes} ${table} records\n`);
          }
        } catch (error) {
          // Table doesn't exist or is empty
        }
      }
    } else {
      console.log('  ✅ No legacy data to migrate\n');
    }
    
    console.log('📋 STEP 6: Creating indices for performance...\n');
    
    // Create indices
    const indices = [
      { table: 'users', column: 'organisation_id', name: 'idx_users_organisation' },
      { table: 'emissions', column: 'organisation_id', name: 'idx_emissions_organisation' },
      { table: 'vehicles', column: 'organisation_id', name: 'idx_vehicles_organisation' },
      { table: 'generators', column: 'organisation_id', name: 'idx_generators_organisation' },
      { table: 'activity_logs', column: 'organisation_id', name: 'idx_activity_logs_organisation' }
    ];
    
    for (const index of indices) {
      try {
        await runQuery(`CREATE INDEX IF NOT EXISTS ${index.name} ON ${index.table}(${index.column})`);
        console.log(`  ✅ Created index: ${index.name}`);
      } catch (error) {
        console.log(`  ⚠️  Could not create index ${index.name} (table may not exist)`);
      }
    }
    console.log();
    
    console.log('📋 STEP 7: Verification...\n');
    
    // Verify migration
    const orgCount = await getQuery('SELECT COUNT(*) as count FROM organisations');
    const usersWithOrg = await getQuery('SELECT COUNT(*) as count FROM users WHERE organisation_id IS NOT NULL');
    const totalUsers = await getQuery('SELECT COUNT(*) as count FROM users');
    
    console.log(`  📊 Total Organisations: ${orgCount.count}`);
    console.log(`  📊 Users with Organisation: ${usersWithOrg.count} / ${totalUsers.count}`);
    
    try {
      const emissionsWithOrg = await getQuery('SELECT COUNT(*) as count FROM emissions WHERE organisation_id IS NOT NULL');
      const totalEmissions = await getQuery('SELECT COUNT(*) as count FROM emissions');
      console.log(`  📊 Emissions with Organisation: ${emissionsWithOrg.count} / ${totalEmissions.count}`);
    } catch (error) {
      console.log(`  📊 Emissions: Table not created yet`);
    }
    
    console.log('\n📋 STEP 8: Summary of Organisations...\n');
    
    const organisations = await allQuery(`
      SELECT 
        o.id,
        o.name,
        o.display_name,
        o.industry_type,
        o.is_active,
        COUNT(u.id) as user_count
      FROM organisations o
      LEFT JOIN users u ON o.id = u.organisation_id
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `);
    
    console.log('  Organisations in system:');
    organisations.forEach(org => {
      const status = org.is_active ? '🟢' : '🔴';
      console.log(`    ${status} ${org.display_name} (${org.id})`);
      console.log(`       Industry: ${org.industry_type} | Users: ${org.user_count}`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('\n📝 Next Steps:\n');
    console.log('  1. Restart your backend server:');
    console.log('     cd backend && npm start\n');
    console.log('  2. Test with Super Admin from new organisation');
    console.log('     - Should see ONLY their organisation\'s data\n');
    console.log('  3. Test with legacy users (if any)');
    console.log('     - Will see data from Legacy Organisation\n');
    console.log('  4. Create new organisations via Company Portal');
    console.log('     - Each will start with fresh, empty data\n');
    
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