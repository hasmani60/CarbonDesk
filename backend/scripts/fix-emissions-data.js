// backend/scripts/fix-emissions-data.js
// Run this to fix orphaned emissions and user assignments

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database/carbon_accounting.db');

console.log('🔧 EMISSIONS DATA FIX SCRIPT');
console.log('='.repeat(60));
console.log('Database:', dbPath);
console.log('='.repeat(60));
console.log();

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
    process.exit(1);
  }
  console.log('✅ Database connected\n');
});

async function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function fixData() {
  try {
    console.log('📋 Starting data fix process...\n');

    // 1. Check for legacy organisation
    console.log('STEP 1: Checking for Legacy Organisation');
    console.log('-'.repeat(60));
    
    let legacyOrg = await get('SELECT * FROM organisations WHERE id = ?', ['ORG-LEGACY-001']);
    
    if (!legacyOrg) {
      console.log('Creating Legacy Organisation...');
      await run(`
        INSERT INTO organisations (
          id, name, display_name, industry_type, 
          location, contact_email, is_active, 
          subscription_tier, max_users, created_by, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'ORG-LEGACY-001',
        'Legacy Data',
        'Legacy Data (Auto-Fixed)',
        'General',
        'N/A',
        'legacy@system.local',
        1,
        'standard',
        999,
        'auto_fix_script',
        'Created by fix script to hold orphaned data'
      ]);
      console.log('✅ Legacy Organisation created');
      
      // Create settings
      await run(`
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
      console.log('✅ Legacy Organisation settings created');
    } else {
      console.log('✅ Legacy Organisation already exists');
    }
    console.log();

    // 2. Fix emissions with NULL organisation_id
    console.log('STEP 2: Fixing emissions with NULL organisation_id');
    console.log('-'.repeat(60));
    
    const nullOrgCount = await get('SELECT COUNT(*) as count FROM emissions WHERE organisation_id IS NULL');
    
    if (nullOrgCount.count > 0) {
      console.log(`Found ${nullOrgCount.count} emissions with NULL organisation_id`);
      console.log('Assigning to Legacy Organisation...');
      
      const result = await run(
        'UPDATE emissions SET organisation_id = ?, organisation_name = ? WHERE organisation_id IS NULL',
        ['ORG-LEGACY-001', 'Legacy Data']
      );
      
      console.log(`✅ Fixed ${result.changes} emissions`);
    } else {
      console.log('✅ No NULL organisation_id emissions found');
    }
    console.log();

    // 3. Fix orphaned emissions (invalid organisation_id)
    console.log('STEP 3: Fixing orphaned emissions');
    console.log('-'.repeat(60));
    
    const orphaned = await query(`
      SELECT e.id, e.organisation_id
      FROM emissions e
      LEFT JOIN organisations o ON e.organisation_id = o.id
      WHERE o.id IS NULL AND e.organisation_id IS NOT NULL
    `);
    
    if (orphaned.length > 0) {
      console.log(`Found ${orphaned.length} orphaned emissions`);
      console.log('Reassigning to Legacy Organisation...');
      
      for (const emission of orphaned) {
        await run(
          'UPDATE emissions SET organisation_id = ?, organisation_name = ? WHERE id = ?',
          ['ORG-LEGACY-001', 'Legacy Data', emission.id]
        );
      }
      
      console.log(`✅ Fixed ${orphaned.length} orphaned emissions`);
    } else {
      console.log('✅ No orphaned emissions found');
    }
    console.log();

    // 4. Fix users without organisation
    console.log('STEP 4: Fixing users without organisation');
    console.log('-'.repeat(60));
    
    const usersWithoutOrg = await query('SELECT * FROM users WHERE organisation_id IS NULL');
    
    if (usersWithoutOrg.length > 0) {
      console.log(`Found ${usersWithoutOrg.length} users without organisation:`);
      
      for (const user of usersWithoutOrg) {
        console.log(`\n  ${user.email}:`);
        
        // Check if user has created emissions
        const userEmissions = await get(
          'SELECT COUNT(*) as count FROM emissions WHERE created_by = ?',
          [user.id]
        );
        
        if (userEmissions.count > 0) {
          console.log(`    Has ${userEmissions.count} emissions`);
          console.log(`    Assigning to Legacy Organisation...`);
          
          await run(
            'UPDATE users SET organisation_id = ? WHERE id = ?',
            ['ORG-LEGACY-001', user.id]
          );
          
          console.log(`    ✅ Assigned`);
        } else {
          console.log(`    Has no emissions - skipping (admin should assign manually)`);
        }
      }
    } else {
      console.log('✅ All users have organisation assignment');
    }
    console.log();

    // 5. Verify fixes
    console.log('STEP 5: Verifying Fixes');
    console.log('-'.repeat(60));
    
    const stillNullOrg = await get('SELECT COUNT(*) as count FROM emissions WHERE organisation_id IS NULL');
    const stillOrphaned = await query(`
      SELECT COUNT(*) as count
      FROM emissions e
      LEFT JOIN organisations o ON e.organisation_id = o.id
      WHERE o.id IS NULL AND e.organisation_id IS NOT NULL
    `);
    const stillUnassignedUsers = await get('SELECT COUNT(*) as count FROM users WHERE organisation_id IS NULL');
    
    console.log(`\nRemaining issues:`);
    console.log(`  Emissions with NULL org: ${stillNullOrg.count}`);
    console.log(`  Orphaned emissions: ${stillOrphaned[0]?.count || 0}`);
    console.log(`  Users without org: ${stillUnassignedUsers.count}`);
    
    if (stillNullOrg.count === 0 && stillOrphaned[0]?.count === 0) {
      console.log('\n✅ All emissions data fixed!');
    } else {
      console.log('\n⚠️  Some issues remain - manual intervention may be needed');
    }
    console.log();

    // 6. Summary
    console.log('STEP 6: Summary');
    console.log('='.repeat(60));
    
    const allEmissions = await get('SELECT COUNT(*) as count FROM emissions');
    const allUsers = await get('SELECT COUNT(*) as count FROM users');
    const allOrgs = await get('SELECT COUNT(*) as count FROM organisations');
    
    console.log(`\nDatabase Status:`);
    console.log(`  Total Emissions: ${allEmissions.count}`);
    console.log(`  Total Users: ${allUsers.count}`);
    console.log(`  Total Organisations: ${allOrgs.count}`);
    
    console.log('\n📝 Next Steps:');
    console.log('  1. Restart your backend server');
    console.log('  2. Test login and data visibility');
    console.log('  3. If issues persist, run diagnostics again:');
    console.log('     node backend/scripts/diagnose-data-loss.js');
    console.log('  4. Consider creating proper organisations for users');
    console.log('     via the Company Portal');
    console.log();
    
    console.log('='.repeat(60));
    console.log('✅ FIX SCRIPT COMPLETE');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Fix script error:', error);
  } finally {
    db.close((err) => {
      if (err) console.error('Error closing database:', err);
      process.exit(0);
    });
  }
}

fixData();