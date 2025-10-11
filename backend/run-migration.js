// backend/run-migration.js
// Script to run the duplicate prevention migration

const path = require('path');
const fs = require('fs');

console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('  CARBON ACCOUNTING - DATABASE MIGRATION TOOL');
console.log('  Migration: Add Unique Constraint for Duplicate Prevention');
console.log('═══════════════════════════════════════════════════════════');
console.log('');

// Check if migration file exists
const migrationPath = path.join(__dirname, 'migrations', 'add_unique_constraint_emissions.js');

if (!fs.existsSync(migrationPath)) {
  console.error('❌ Migration file not found at:', migrationPath);
  console.error('');
  console.error('Please ensure the migration file exists:');
  console.error('  backend/migrations/add_unique_constraint_emissions.js');
  process.exit(1);
}

// Check command line arguments
const args = process.argv.slice(2);
const isRollback = args.includes('--rollback') || args.includes('-r');
const isForce = args.includes('--force') || args.includes('-f');

if (isRollback) {
  console.log('🔄 ROLLBACK MODE');
  console.log('   This will remove the unique constraint from the emissions table');
  console.log('');
  
  if (!isForce) {
    console.log('⚠️  WARNING: This will allow duplicate emissions again!');
    console.log('');
    console.log('To proceed with rollback, run:');
    console.log('  node run-migration.js --rollback --force');
    console.log('');
    process.exit(0);
  }
  
  // Run rollback
  const migration = require(migrationPath);
  
  migration.down()
    .then(() => {
      console.log('');
      console.log('✅ Rollback completed successfully');
      console.log('');
      console.log('⚠️  Duplicate detection is now DISABLED at database level');
      console.log('   (Frontend and backend validation still active)');
      process.exit(0);
    })
    .catch((error) => {
      console.error('');
      console.error('❌ Rollback failed:', error.message);
      process.exit(1);
    });
  
} else {
  // Normal migration
  console.log('📋 Migration Details:');
  console.log('   • Adds composite unique constraint to emissions table');
  console.log('   • Prevents duplicate emissions with identical:');
  console.log('     - Organisation ID');
  console.log('     - Scope');
  console.log('     - Activity');
  console.log('     - Quantity');
  console.log('     - Date');
  console.log('   • Removes existing duplicates during migration');
  console.log('');
  
  console.log('📊 Pre-migration Check:');
  
  // Check for existing duplicates
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = path.join(__dirname, 'database', 'carbon_accounting.db');
  
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('❌ Cannot connect to database:', err.message);
      process.exit(1);
    }
    
    // Check for duplicates
    const checkDuplicates = `
      SELECT 
        organisation_id,
        scope,
        activity,
        quantity,
        date,
        COUNT(*) as count
      FROM emissions
      GROUP BY organisation_id, scope, activity, quantity, date
      HAVING count > 1
    `;
    
    db.all(checkDuplicates, [], (err, duplicates) => {
      if (err) {
        console.error('❌ Error checking duplicates:', err.message);
        db.close();
        process.exit(1);
      }
      
      if (duplicates && duplicates.length > 0) {
        console.log(`   ⚠️  Found ${duplicates.length} sets of duplicate emissions`);
        console.log('');
        console.log('   Sample duplicates:');
        duplicates.slice(0, 3).forEach((dup, i) => {
          console.log(`   ${i + 1}. Org: ${dup.organisation_id}, Scope: ${dup.scope}, Activity: ${dup.activity}`);
          console.log(`      Quantity: ${dup.quantity}, Date: ${dup.date}, Duplicates: ${dup.count}`);
        });
        console.log('');
      } else {
        console.log('   ✅ No duplicate emissions found');
        console.log('');
      }
      
      // Count total emissions
      db.get('SELECT COUNT(*) as total FROM emissions', [], (err, result) => {
        db.close();
        
        if (err) {
          console.error('❌ Error counting emissions:', err.message);
          process.exit(1);
        }
        
        console.log(`   📊 Total emissions in database: ${result.total}`);
        console.log('');
        
        if (!isForce && duplicates && duplicates.length > 0) {
          console.log('⚠️  IMPORTANT:');
          console.log('   This migration will remove duplicate entries.');
          console.log('   Only the oldest record of each duplicate set will be kept.');
          console.log('');
          console.log('To proceed, run:');
          console.log('  node run-migration.js --force');
          console.log('');
          console.log('To backup your database first:');
          console.log('  cp backend/database/carbon_accounting.db backend/database/carbon_accounting.db.backup');
          console.log('');
          process.exit(0);
        }
        
        // Run migration
        console.log('🚀 Starting migration...');
        console.log('');
        
        const migration = require(migrationPath);
        
        migration.up()
          .then((result) => {
            console.log('');
            console.log('═══════════════════════════════════════════════════════════');
            console.log('  ✅ MIGRATION COMPLETED SUCCESSFULLY');
            console.log('═══════════════════════════════════════════════════════════');
            console.log('');
            console.log('Summary:');
            console.log(`  • Original emissions: ${result.original}`);
            console.log(`  • Unique emissions: ${result.unique}`);
            console.log(`  • Duplicates removed: ${result.duplicatesRemoved}`);
            console.log(`  • Unique constraint: ACTIVE`);
            console.log('');
            console.log('Next Steps:');
            console.log('  1. Restart your backend server');
            console.log('  2. Test emission creation to verify duplicate prevention');
            console.log('  3. Monitor logs for any duplicate detection messages');
            console.log('');
            
            if (result.duplicatesRemoved > 0) {
              console.log('⚠️  ACTION REQUIRED:');
              console.log('   Duplicates were found and removed during migration.');
              console.log('   Review your application to identify why duplicates occurred:');
              console.log('   • Check frontend form submission logic');
              console.log('   • Review event handlers for double-firing');
              console.log('   • Verify API endpoint de-duplication');
              console.log('');
            }
            
            console.log('To rollback this migration:');
            console.log('  node run-migration.js --rollback --force');
            console.log('');
            
            process.exit(0);
          })
          .catch((error) => {
            console.error('');
            console.error('═══════════════════════════════════════════════════════════');
            console.error('  ❌ MIGRATION FAILED');
            console.error('═══════════════════════════════════════════════════════════');
            console.error('');
            console.error('Error:', error.message);
            console.error('');
            console.error('Troubleshooting:');
            console.error('  1. Check database file permissions');
            console.error('  2. Ensure database is not locked by another process');
            console.error('  3. Verify database file exists at:');
            console.error('     backend/database/carbon_accounting.db');
            console.error('');
            console.error('If database is corrupted, restore from backup:');
            console.error('  cp backend/database/carbon_accounting.db.backup backend/database/carbon_accounting.db');
            console.error('');
            
            process.exit(1);
          });
      });
    });
  });
}