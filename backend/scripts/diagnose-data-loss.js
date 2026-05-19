// backend/scripts/diagnose-data-loss.js
// Run this to diagnose emissions data visibility issues

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database/carbon_accounting.db');

console.log('🔍 EMISSIONS DATA DIAGNOSTICS');
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

async function runDiagnostics() {
  try {
    // 1. Check total emissions
    console.log('📊 STEP 1: Total Emissions Count');
    console.log('-'.repeat(60));
    const totalEmissions = await get('SELECT COUNT(*) as count FROM emissions');
    console.log(`Total emissions in database: ${totalEmissions.count}`);
    console.log();

    // 2. Check emissions by organisation
    console.log('🏢 STEP 2: Emissions by Organisation');
    console.log('-'.repeat(60));
    const emissionsByOrg = await query(`
      SELECT 
        organisation_id,
        organisation_name,
        COUNT(*) as count,
        SUM(co2e) as total_co2e,
        MIN(created_at) as earliest,
        MAX(created_at) as latest
      FROM emissions
      GROUP BY organisation_id, organisation_name
      ORDER BY count DESC
    `);
    
    if (emissionsByOrg.length === 0) {
      console.log('⚠️  No emissions found in database!');
    } else {
      emissionsByOrg.forEach(org => {
        console.log(`\nOrganisation: ${org.organisation_name || 'N/A'} (${org.organisation_id || 'NULL'})`);
        console.log(`  Emissions: ${org.count}`);
        console.log(`  Total CO2e: ${org.total_co2e?.toFixed(2) || 0} kg`);
        console.log(`  Date Range: ${org.earliest} to ${org.latest}`);
      });
    }
    console.log();

    // 3. Check users and their organisations
    console.log('👥 STEP 3: Users and Organisation Assignment');
    console.log('-'.repeat(60));
    const users = await query(`
      SELECT 
        id, name, email, role, 
        organisation_id, status
      FROM users
      ORDER BY created_at DESC
    `);
    
    console.log(`Total users: ${users.length}`);
    users.forEach(user => {
      console.log(`\n${user.name} (${user.email})`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Status: ${user.status}`);
      console.log(`  Organisation ID: ${user.organisation_id || '❌ NULL - NO ORGANISATION!'}`);
    });
    console.log();

    // 4. Check for orphaned emissions (no matching organisation)
    console.log('🔍 STEP 4: Orphaned Emissions Check');
    console.log('-'.repeat(60));
    const orphanedEmissions = await query(`
      SELECT 
        e.id,
        e.organisation_id,
        e.organisation_name,
        e.created_by,
        e.created_by_name,
        e.created_at
      FROM emissions e
      LEFT JOIN organisations o ON e.organisation_id = o.id
      WHERE o.id IS NULL AND e.organisation_id IS NOT NULL
      ORDER BY e.created_at DESC
      LIMIT 10
    `);
    
    if (orphanedEmissions.length > 0) {
      console.log(`⚠️  Found ${orphanedEmissions.length} emissions with invalid organisation_id:`);
      orphanedEmissions.forEach(emission => {
        console.log(`  ID ${emission.id}: org_id=${emission.organisation_id}, created by ${emission.created_by_name}`);
      });
    } else {
      console.log('✅ No orphaned emissions found');
    }
    console.log();

    // 5. Check for NULL organisation_id emissions
    console.log('🔍 STEP 5: Emissions with NULL organisation_id');
    console.log('-'.repeat(60));
    const nullOrgEmissions = await get(`
      SELECT COUNT(*) as count
      FROM emissions
      WHERE organisation_id IS NULL
    `);
    
    if (nullOrgEmissions.count > 0) {
      console.log(`⚠️  Found ${nullOrgEmissions.count} emissions with NULL organisation_id`);
      console.log('   These emissions will be INVISIBLE to all users!');
    } else {
      console.log('✅ All emissions have organisation_id');
    }
    console.log();

    // 6. Cross-check: Users vs their emissions
    console.log('🔗 STEP 6: User Emissions Visibility Check');
    console.log('-'.repeat(60));
    
    for (const user of users) {
      const createdByUser = await get(
        'SELECT COUNT(*) as count FROM emissions WHERE created_by = ?',
        [user.id]
      );
      
      const visibleToUser = await get(
        user.organisation_id
          ? 'SELECT COUNT(*) as count FROM emissions WHERE organisation_id = ?'
          : 'SELECT 0 as count',
        user.organisation_id ? [user.organisation_id] : []
      );
      
      const mismatch = createdByUser.count > 0 && visibleToUser.count === 0;
      
      console.log(`\n${user.email}:`);
      console.log(`  Created: ${createdByUser.count} emissions`);
      console.log(`  Can see: ${visibleToUser.count} emissions`);
      if (mismatch) {
        console.log(`  ⚠️  DATA LOSS DETECTED: User created emissions but cannot see them!`);
        console.log(`      Reason: ${!user.organisation_id ? 'No organisation assigned' : 'Organisation mismatch'}`);
      }
    }
    console.log();

    // 7. Check organisations table
    console.log('🏢 STEP 7: Organisations Table');
    console.log('-'.repeat(60));
    const organisations = await query('SELECT * FROM organisations ORDER BY created_at DESC');
    
    console.log(`Total organisations: ${organisations.length}`);
    organisations.forEach(org => {
      console.log(`\n${org.display_name} (${org.id})`);
      console.log(`  Active: ${org.is_active ? '✅ Yes' : '❌ No'}`);
      console.log(`  Industry: ${org.industry_type}`);
      console.log(`  Created: ${org.created_at}`);
    });
    console.log();

    // 8. Summary and Recommendations
    console.log('📋 STEP 8: Summary & Recommendations');
    console.log('='.repeat(60));
    
    const usersWithoutOrg = users.filter(u => !u.organisation_id).length;
    const hasOrphanedData = orphanedEmissions.length > 0 || nullOrgEmissions.count > 0;
    const hasDataLoss = users.some(u => {
      return emissionsByOrg.some(org => 
        org.organisation_id && u.organisation_id && org.organisation_id !== u.organisation_id
      );
    });
    
    console.log('\n🔍 Issues Found:');
    if (usersWithoutOrg > 0) {
      console.log(`  ❌ ${usersWithoutOrg} users without organisation assignment`);
      console.log('     → These users cannot create or see emissions');
    }
    if (hasOrphanedData) {
      console.log(`  ❌ Orphaned emissions detected`);
      console.log('     → These emissions are invisible to users');
    }
    if (totalEmissions.count === 0) {
      console.log(`  ⚠️  No emissions in database`);
    }
    
    console.log('\n✅ Recommendations:');
    console.log('  1. Assign all users to organisations');
    console.log('  2. Run migration script to fix orphaned data');
    console.log('  3. Add validation to prevent NULL organisation_id');
    console.log('  4. Implement data integrity checks on login');
    console.log();
    
    console.log('='.repeat(60));
    console.log('✅ DIAGNOSTICS COMPLETE');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Diagnostic error:', error);
  } finally {
    db.close((err) => {
      if (err) console.error('Error closing database:', err);
      process.exit(0);
    });
  }
}

runDiagnostics();