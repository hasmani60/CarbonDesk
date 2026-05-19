// backend/scripts/migrate-emission-factors.js
// Migration script to add new emission factor columns to emissions table

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../database/carbontracker.db');

console.log('🔄 Starting emission factors migration...');
console.log('📁 Database:', DB_PATH);

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Error connecting to database:', err);
    process.exit(1);
  }
  console.log('✅ Connected to database');
});

// Migration steps
const migrations = [
  {
    name: 'Add emissions_co2 column',
    sql: `ALTER TABLE emissions ADD COLUMN emissions_co2 REAL DEFAULT 0`
  },
  {
    name: 'Add emissions_ch4 column',
    sql: `ALTER TABLE emissions ADD COLUMN emissions_ch4 REAL DEFAULT 0`
  },
  {
    name: 'Add emissions_n2o column',
    sql: `ALTER TABLE emissions ADD COLUMN emissions_n2o REAL DEFAULT 0`
  },
  {
    name: 'Add emission_factor column',
    sql: `ALTER TABLE emissions ADD COLUMN emission_factor REAL`
  },
  {
    name: 'Add emission_factor_unit column',
    sql: `ALTER TABLE emissions ADD COLUMN emission_factor_unit TEXT`
  },
  {
    name: 'Add emission_factor_description column',
    sql: `ALTER TABLE emissions ADD COLUMN emission_factor_description TEXT`
  },
  {
    name: 'Add location column',
    sql: `ALTER TABLE emissions ADD COLUMN location TEXT`
  },
  {
    name: 'Add description column',
    sql: `ALTER TABLE emissions ADD COLUMN description TEXT`
  }
];

// Check if column exists
const checkColumnExists = (tableName, columnName) => {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        const exists = rows.some(row => row.name === columnName);
        resolve(exists);
      }
    });
  });
};

// Run migration
const runMigration = (migration) => {
  return new Promise((resolve, reject) => {
    db.run(migration.sql, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

// Execute all migrations
const executeMigrations = async () => {
  console.log('\n📋 Running migrations...\n');
  
  for (const migration of migrations) {
    try {
      // Extract column name from SQL
      const columnMatch = migration.sql.match(/ADD COLUMN (\w+)/);
      const columnName = columnMatch ? columnMatch[1] : null;
      
      if (columnName) {
        // Check if column already exists
        const exists = await checkColumnExists('emissions', columnName);
        
        if (exists) {
          console.log(`⏭️  Skipping: ${migration.name} (already exists)`);
          continue;
        }
      }
      
      // Run migration
      await runMigration(migration);
      console.log(`✅ Success: ${migration.name}`);
      
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        console.log(`⏭️  Skipping: ${migration.name} (already exists)`);
      } else {
        console.error(`❌ Failed: ${migration.name}`);
        console.error('   Error:', error.message);
      }
    }
  }
};

// Verify table structure after migration
const verifyStructure = () => {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(emissions)`, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        console.log('\n📊 Current emissions table structure:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        rows.forEach(row => {
          console.log(`   ${row.name.padEnd(35)} ${row.type.padEnd(10)} ${row.notnull ? 'NOT NULL' : ''} ${row.dflt_value ? `DEFAULT ${row.dflt_value}` : ''}`);
        });
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        resolve(rows);
      }
    });
  });
};

// Run the migration
(async () => {
  try {
    await executeMigrations();
    await verifyStructure();
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Test emission creation with new fields');
    console.log('   2. Verify gas breakdown calculations');
    console.log('   3. Check that existing emissions still work');
    
    db.close((err) => {
      if (err) {
        console.error('❌ Error closing database:', err);
        process.exit(1);
      }
      console.log('\n👋 Database connection closed');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    db.close();
    process.exit(1);
  }
})();

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n⚠️  Migration interrupted');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    }
    process.exit(1);
  });
});