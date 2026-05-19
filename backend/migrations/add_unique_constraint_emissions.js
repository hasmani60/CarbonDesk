// backend/migrations/add_unique_constraint_emissions.js
// Migration to add composite unique constraint to prevent duplicate emissions

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database/carbon_accounting.db');

/**
 * Migration: Add composite unique constraint to emissions table
 * 
 * Constraint prevents duplicate entries with identical:
 * - organisation_id
 * - scope
 * - activity
 * - quantity
 * - date
 * 
 * This enforces data integrity at the database level
 */

async function up() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ Database connection error:', err);
        reject(err);
        return;
      }
      
      console.log('✅ Connected to database for migration');
      
      db.serialize(() => {
        console.log('🔧 Starting migration: Add unique constraint to emissions...');
        
        // Step 1: Create new table with unique constraint
        const createNewTable = `
          CREATE TABLE IF NOT EXISTS emissions_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scope INTEGER NOT NULL,
            category TEXT,
            activity TEXT NOT NULL,
            quantity REAL DEFAULT 0,
            unit TEXT DEFAULT 'kg',
            co2e REAL DEFAULT 0,
            date TEXT NOT NULL,
            status TEXT DEFAULT 'draft',
            notes TEXT,
            verified_by INTEGER,
            verified_at TEXT,
            organisation_id TEXT NOT NULL,
            organisation_name TEXT,
            created_by INTEGER NOT NULL,
            created_by_name TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT,
            FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE,
            FOREIGN KEY (created_by) REFERENCES users(id),
            
            -- ===== UNIQUE CONSTRAINT FOR DUPLICATE PREVENTION =====
            -- Prevents exact duplicates: same org, scope, activity, quantity, date
            UNIQUE(organisation_id, scope, activity, quantity, date)
          )
        `;
        
        db.run(createNewTable, (err) => {
          if (err) {
            console.error('❌ Error creating new table:', err);
            reject(err);
            return;
          }
          
          console.log('✅ Created new emissions table with unique constraint');
          
          // Step 2: Copy data from old table, removing duplicates
          const copyData = `
            INSERT INTO emissions_new 
            SELECT 
              id, scope, category, activity, quantity, unit, co2e,
              date, status, notes, verified_by, verified_at,
              organisation_id, organisation_name, 
              created_by, created_by_name, created_at, updated_at
            FROM emissions
            WHERE id IN (
              SELECT MIN(id)
              FROM emissions
              GROUP BY organisation_id, scope, activity, quantity, date
            )
          `;
          
          db.run(copyData, function(err) {
            if (err) {
              console.error('❌ Error copying data:', err);
              reject(err);
              return;
            }
            
            console.log(`✅ Copied ${this.changes} unique emissions (duplicates removed)`);
            
            // Step 3: Check if any duplicates were found
            db.get('SELECT COUNT(*) as total FROM emissions', (err, oldCount) => {
              if (err) {
                console.error('❌ Error counting old records:', err);
                reject(err);
                return;
              }
              
              const duplicatesRemoved = oldCount.total - this.changes;
              if (duplicatesRemoved > 0) {
                console.warn(`⚠️  Removed ${duplicatesRemoved} duplicate emissions during migration`);
              }
              
              // Step 4: Drop old table
              db.run('DROP TABLE emissions', (err) => {
                if (err) {
                  console.error('❌ Error dropping old table:', err);
                  reject(err);
                  return;
                }
                
                console.log('✅ Dropped old emissions table');
                
                // Step 5: Rename new table
                db.run('ALTER TABLE emissions_new RENAME TO emissions', (err) => {
                  if (err) {
                    console.error('❌ Error renaming table:', err);
                    reject(err);
                    return;
                  }
                  
                  console.log('✅ Renamed new table to emissions');
                  
                  // Step 6: Recreate indexes
                  const indexes = [
                    'CREATE INDEX IF NOT EXISTS idx_emissions_organisation ON emissions(organisation_id)',
                    'CREATE INDEX IF NOT EXISTS idx_emissions_created_by ON emissions(created_by)',
                    'CREATE INDEX IF NOT EXISTS idx_emissions_date ON emissions(date)',
                    'CREATE INDEX IF NOT EXISTS idx_emissions_scope ON emissions(scope)',
                    'CREATE INDEX IF NOT EXISTS idx_emissions_status ON emissions(status)'
                  ];
                  
                  let indexCount = 0;
                  indexes.forEach((indexQuery, i) => {
                    db.run(indexQuery, (err) => {
                      if (err) {
                        console.error(`❌ Error creating index ${i}:`, err);
                      } else {
                        indexCount++;
                        if (indexCount === indexes.length) {
                          console.log(`✅ Created ${indexCount} indexes`);
                          console.log('🎉 Migration completed successfully!');
                          console.log('');
                          console.log('Summary:');
                          console.log(`- Original records: ${oldCount.total}`);
                          console.log(`- Unique records: ${this.changes}`);
                          console.log(`- Duplicates removed: ${duplicatesRemoved}`);
                          console.log('- Unique constraint: ACTIVE');
                          
                          db.close((err) => {
                            if (err) {
                              console.error('Error closing database:', err);
                              reject(err);
                            } else {
                              resolve({
                                success: true,
                                original: oldCount.total,
                                unique: this.changes,
                                duplicatesRemoved: duplicatesRemoved
                              });
                            }
                          });
                        }
                      }
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}

/**
 * Rollback migration (remove unique constraint)
 */
async function down() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ Database connection error:', err);
        reject(err);
        return;
      }
      
      console.log('🔧 Rolling back migration: Remove unique constraint...');
      
      db.serialize(() => {
        // Create table without unique constraint
        const createOldTable = `
          CREATE TABLE IF NOT EXISTS emissions_rollback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scope INTEGER NOT NULL,
            category TEXT,
            activity TEXT NOT NULL,
            quantity REAL DEFAULT 0,
            unit TEXT DEFAULT 'kg',
            co2e REAL DEFAULT 0,
            date TEXT NOT NULL,
            status TEXT DEFAULT 'draft',
            notes TEXT,
            verified_by INTEGER,
            verified_at TEXT,
            organisation_id TEXT NOT NULL,
            organisation_name TEXT,
            created_by INTEGER NOT NULL,
            created_by_name TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT,
            FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE,
            FOREIGN KEY (created_by) REFERENCES users(id)
          )
        `;
        
        db.run(createOldTable, (err) => {
          if (err) {
            console.error('❌ Error creating rollback table:', err);
            reject(err);
            return;
          }
          
          // Copy all data
          const copyData = `
            INSERT INTO emissions_rollback 
            SELECT * FROM emissions
          `;
          
          db.run(copyData, function(err) {
            if (err) {
              console.error('❌ Error copying data:', err);
              reject(err);
              return;
            }
            
            console.log(`✅ Copied ${this.changes} records`);
            
            db.run('DROP TABLE emissions', (err) => {
              if (err) {
                console.error('❌ Error dropping table:', err);
                reject(err);
                return;
              }
              
              db.run('ALTER TABLE emissions_rollback RENAME TO emissions', (err) => {
                if (err) {
                  console.error('❌ Error renaming table:', err);
                  reject(err);
                  return;
                }
                
                console.log('✅ Rollback completed - unique constraint removed');
                
                db.close((err) => {
                  if (err) reject(err);
                  else resolve({ success: true });
                });
              });
            });
          });
        });
      });
    });
  });
}

// Run migration if executed directly
if (require.main === module) {
  console.log('🚀 Running emissions table migration...');
  console.log('');
  
  up()
    .then((result) => {
      console.log('');
      console.log('✅ Migration completed successfully');
      if (result.duplicatesRemoved > 0) {
        console.log('');
        console.log('⚠️  WARNING: Duplicates were found and removed');
        console.log('   Review your application logs to identify the source of duplicates');
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error('');
      console.error('❌ Migration failed:', error.message);
      console.error('');
      console.error('To rollback: node add_unique_constraint_emissions.js --rollback');
      process.exit(1);
    });
}

module.exports = { up, down };