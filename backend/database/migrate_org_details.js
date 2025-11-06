// backend/database/migrate_org_details.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'carbon_accounting.db');
const backupPath = path.join(__dirname, `carbon_accounting.db.backup_${Date.now()}`);

console.log('🔄 Starting database migration...');
console.log(`Database: ${dbPath}`);

// Step 1: Create backup
console.log('\n📦 Step 1: Creating backup...');
try {
  fs.copyFileSync(dbPath, backupPath);
  console.log(`✅ Backup created: ${backupPath}`);
} catch (error) {
  console.error('❌ Backup failed:', error.message);
  process.exit(1);
}

// Step 2: Connect to database
console.log('\n🔗 Step 2: Connecting to database...');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Connection failed:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to database');
});

// Step 3: Check if migration is needed
console.log('\n🔍 Step 3: Checking current schema...');
db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='organisations'", (err, row) => {
  if (err) {
    console.error('❌ Schema check failed:', err.message);
    db.close();
    process.exit(1);
  }

  const currentSchema = row.sql;
  
  // Check if columns already exist
  const hasRegisteredName = currentSchema.includes('registered_name');
  const hasCinNumber = currentSchema.includes('cin_number');
  const hasRegisteredAddress = currentSchema.includes('registered_address');
  const hasGstNumber = currentSchema.includes('gst_number');
  const hasCurrentEmployees = currentSchema.includes('current_employees');

  if (hasRegisteredName && hasCinNumber && hasRegisteredAddress && hasGstNumber && hasCurrentEmployees) {
    console.log('✅ All columns already exist. Migration not needed.');
    db.close();
    process.exit(0);
  }

  console.log('📝 Columns to add:');
  if (!hasRegisteredName) console.log('   - registered_name');
  if (!hasCinNumber) console.log('   - cin_number');
  if (!hasRegisteredAddress) console.log('   - registered_address');
  if (!hasGstNumber) console.log('   - gst_number');
  if (!hasCurrentEmployees) console.log('   - current_employees');

  // Step 4: Run migration
  console.log('\n🚀 Step 4: Running migration...');
  
  db.serialize(() => {
    const migrations = [];

    if (!hasRegisteredName) {
      migrations.push("ALTER TABLE organisations ADD COLUMN registered_name TEXT");
    }
    if (!hasCinNumber) {
      migrations.push("ALTER TABLE organisations ADD COLUMN cin_number TEXT");
    }
    if (!hasRegisteredAddress) {
      migrations.push("ALTER TABLE organisations ADD COLUMN registered_address TEXT");
    }
    if (!hasGstNumber) {
      migrations.push("ALTER TABLE organisations ADD COLUMN gst_number TEXT");
    }
    if (!hasCurrentEmployees) {
      migrations.push("ALTER TABLE organisations ADD COLUMN current_employees INTEGER");
    }

    // Execute each migration
    let completed = 0;
    migrations.forEach((sql, index) => {
      db.run(sql, (err) => {
        if (err) {
          console.error(`❌ Migration ${index + 1} failed:`, err.message);
          db.close();
          process.exit(1);
        }
        
        completed++;
        console.log(`✅ Migration ${completed}/${migrations.length} completed`);

        // After all migrations, update existing records
        if (completed === migrations.length) {
          console.log('\n🔄 Step 5: Updating existing records...');
          
          db.run(
            "UPDATE organisations SET registered_name = name WHERE registered_name IS NULL",
            (err) => {
              if (err) {
                console.error('❌ Update failed:', err.message);
              } else {
                console.log('✅ Existing records updated');
              }

              // Step 6: Verify
              console.log('\n✔️  Step 6: Verifying migration...');
              db.get(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name='organisations'",
                (err, row) => {
                  if (err) {
                    console.error('❌ Verification failed:', err.message);
                  } else {
                    console.log('✅ Schema updated successfully');
                    console.log('\n📊 New schema:');
                    console.log(row.sql);
                  }

                  // Close database
                  db.close((err) => {
                    if (err) {
                      console.error('❌ Close failed:', err.message);
                    } else {
                      console.log('\n✅ Migration completed successfully!');
                      console.log(`\n📦 Backup saved at: ${backupPath}`);
                      console.log('\n🚀 You can now start your backend server.');
                    }
                  });
                }
              );
            }
          );
        }
      });
    });
  });
});