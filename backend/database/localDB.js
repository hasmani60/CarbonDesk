// backend/database/localDB.js — Legacy SQLite helpers for local tooling / old scripts only.
// Production APIs use MongoDB via Mongoose; do not wire this module into Express routes.
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

// Database file path
const dbPath = path.join(__dirname, 'carbon_accounting.db');

class LocalDatabase {
  constructor() {
    this.db = null;
    this.init();
  }

  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          reject(err);
        } else {
          console.log('✅ Local SQLite database connected');
          this.createTables()
            .then(() => this.createMultiTenantTables())
            .then(() => this.createEmissionsTable())  // ADD THIS LINE
            .then(resolve)
            .catch(reject);
        }
      });
    });
  }

  async createTables() {
    return new Promise((resolve, reject) => {
      // Users table with RBAC support
      const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'contributor',
          status TEXT NOT NULL DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_login DATETIME,
          restrictions TEXT,
          organisation_id TEXT
        )
      `;

      // User sessions table
      const createSessionsTable = `
        CREATE TABLE IF NOT EXISTS user_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          token TEXT NOT NULL,
          expires_at DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )
      `;

      // Activity logs table
      const createActivityLogsTable = `
        CREATE TABLE IF NOT EXISTS activity_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          action TEXT NOT NULL,
          resource_type TEXT,
          resource_id TEXT,
          details TEXT,
          ip_address TEXT,
          user_agent TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )
      `;

      this.db.serialize(() => {
        this.db.run(createUsersTable, (err) => {
          if (err) {
            console.error('Error creating users table:', err);
            reject(err);
            return;
          }
        });

        this.db.run(createSessionsTable, (err) => {
          if (err) {
            console.error('Error creating sessions table:', err);
            reject(err);
            return;
          }
        });

        this.db.run(createActivityLogsTable, (err) => {
          if (err) {
            console.error('Error creating activity_logs table:', err);
            reject(err);
            return;
          }
          console.log('✅ Database tables created successfully');
          this.seedDefaultUsers().then(resolve).catch(reject);
        });
      });
    });
  }

  async createMultiTenantTables() {
    return new Promise((resolve, reject) => {
      console.log('🏢 Creating multi-tenant tables...');

      // Organisations table
      const createOrganisationsTable = `
  CREATE TABLE IF NOT EXISTS organisations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    industry_type TEXT NOT NULL,
    location TEXT,
    contact_email TEXT NOT NULL,
    contact_phone TEXT,
    address TEXT,
    website TEXT,
    config TEXT,
    is_active INTEGER DEFAULT 1,
    subscription_tier TEXT DEFAULT 'standard',
    max_users INTEGER DEFAULT 50,
    max_storage_gb INTEGER DEFAULT 10,
    
    -- NEW FIELDS: Organisation Details
    registered_name TEXT,
    cin_number TEXT,
    registered_address TEXT NOT NULL,
    gst_number TEXT,
    current_employees INTEGER,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    activated_at DATETIME,
    created_by TEXT,
    notes TEXT
  )
`;

      // Company operators table
      const createCompanyOperatorsTable = `
        CREATE TABLE IF NOT EXISTS company_operators (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT DEFAULT 'operator',
          can_create_orgs INTEGER DEFAULT 1,
          can_manage_orgs INTEGER DEFAULT 1,
          can_view_all_orgs INTEGER DEFAULT 1,
          is_active INTEGER DEFAULT 1,
          last_login DATETIME,
          failed_login_attempts INTEGER DEFAULT 0,
          locked_until DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by INTEGER,
          notes TEXT
        )
      `;

      // Organisation settings table
      const createOrgSettingsTable = `
        CREATE TABLE IF NOT EXISTS organisation_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          organisation_id TEXT NOT NULL,
          logo_url TEXT,
          primary_color TEXT DEFAULT '#10b981',
          secondary_color TEXT DEFAULT '#059669',
          default_reporting_period TEXT DEFAULT 'monthly',
          fiscal_year_start TEXT DEFAULT '01-01',
          timezone TEXT DEFAULT 'UTC',
          currency TEXT DEFAULT 'USD',
          emission_factors_version TEXT DEFAULT 'latest',
          calculation_methodology TEXT DEFAULT 'GHG_Protocol',
          features_enabled TEXT,
          notification_settings TEXT,
          data_retention_days INTEGER DEFAULT 365,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE
        )
      `;

      // Organisation activity logs table
      const createOrgActivityLogsTable = `
        CREATE TABLE IF NOT EXISTS organisation_activity_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          organisation_id TEXT NOT NULL,
          action TEXT NOT NULL,
          actor_type TEXT NOT NULL,
          actor_id INTEGER NOT NULL,
          actor_name TEXT,
          details TEXT,
          ip_address TEXT,
          user_agent TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE
        )
      `;

      this.db.serialize(() => {
        this.db.run(createOrganisationsTable, (err) => {
          if (err && !err.message.includes('already exists')) {
            console.error('Error creating organisations table:', err);
          }
        });

        this.db.run(createCompanyOperatorsTable, (err) => {
          if (err && !err.message.includes('already exists')) {
            console.error('Error creating company_operators table:', err);
          }
        });

        this.db.run(createOrgSettingsTable, (err) => {
          if (err && !err.message.includes('already exists')) {
            console.error('Error creating organisation_settings table:', err);
          }
        });

        this.db.run(createOrgActivityLogsTable, (err) => {
          if (err && !err.message.includes('already exists')) {
            console.error('Error creating organisation_activity_logs table:', err);
          }
          
          // Seed default company operator
          this.seedDefaultCompanyOperator().then(() => {
            console.log('✅ Multi-tenant tables created successfully');
            resolve();
          }).catch(reject);
        });
      });
    });
  }

  async createEmissionsTable() {
    return new Promise((resolve, reject) => {
      console.log('📊 Creating emissions table...');
  
      const createEmissionsTable = `
        CREATE TABLE IF NOT EXISTS emissions (
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
  
      const createIndexes = [
        'CREATE INDEX IF NOT EXISTS idx_emissions_organisation ON emissions(organisation_id)',
        'CREATE INDEX IF NOT EXISTS idx_emissions_created_by ON emissions(created_by)',
        'CREATE INDEX IF NOT EXISTS idx_emissions_date ON emissions(date)',
        'CREATE INDEX IF NOT EXISTS idx_emissions_scope ON emissions(scope)',
        'CREATE INDEX IF NOT EXISTS idx_emissions_status ON emissions(status)'
      ];
  
      this.db.serialize(() => {
        this.db.run(createEmissionsTable, (err) => {
          if (err && !err.message.includes('already exists')) {
            console.error('Error creating emissions table:', err);
            reject(err);
            return;
          }
        });
  
        // Create indexes
        createIndexes.forEach((indexQuery, i) => {
          this.db.run(indexQuery, (err) => {
            if (err && !err.message.includes('already exists')) {
              console.error(`Error creating index ${i}:`, err);
            }
          });
        });
  
        console.log('✅ Emissions table created successfully');
        resolve();
      });
    });
  }

  async createMACCTable() {
    return new Promise((resolve, reject) => {
      console.log('📊 Creating MACC opportunities table...');
  
      const createMACCTable = `
        CREATE TABLE IF NOT EXISTS macc_opportunities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          organisation_id TEXT NOT NULL,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          scope INTEGER,
          cost_per_tCO2e REAL NOT NULL,
          reduction_potential REAL NOT NULL,
          payback_period REAL,
          implementation_status TEXT DEFAULT 'proposed',
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          
          FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE
        )
      `;
  
      const createIndexes = [
        'CREATE INDEX IF NOT EXISTS idx_macc_org ON macc_opportunities(organisation_id)',
        'CREATE INDEX IF NOT EXISTS idx_macc_cost ON macc_opportunities(cost_per_tCO2e)',
        'CREATE INDEX IF NOT EXISTS idx_macc_scope ON macc_opportunities(scope)'
      ];
  
      this.db.serialize(() => {
        this.db.run(createMACCTable, (err) => {
          if (err && !err.message.includes('already exists')) {
            console.error('Error creating MACC table:', err);
            reject(err);
            return;
          }
        });
  
        // Create indexes
        createIndexes.forEach((indexQuery) => {
          this.db.run(indexQuery, (err) => {
            if (err && !err.message.includes('already exists')) {
              console.error('Error creating MACC index:', err);
            }
          });
        });
  
        console.log('✅ MACC opportunities table created successfully');
        resolve();
      });
    });
  }
  
  // ALSO UPDATE THE init() METHOD - Add this line after createEmissionsTable():
  
  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          reject(err);
        } else {
          console.log('✅ Local SQLite database connected');
          this.createTables()
            .then(() => this.createMultiTenantTables())
            .then(() => this.createEmissionsTable())
            .then(() => this.createMACCTable())  // ← ADD THIS LINE
            .then(() => this.createTasksTable())
            .then(resolve)
            .catch(reject);
        }
      });
    });
  }

  
  async seedDefaultUsers() {
    return new Promise(async (resolve, reject) => {
      try {
        // Check if admin user exists
        const adminExists = await this.findUserByEmail('demo@example.com');
        
        if (!adminExists) {
          console.log('Seeding default users...');
          
          const defaultUsers = [
            {
              name: 'Demo Admin',
              email: 'demo@example.com',
              password: 'password123',
              role: 'admin',
              status: 'active'
            },
            {
              name: 'Demo Analyst',
              email: 'analyst@example.com',
              password: 'password123',
              role: 'analyst',
              status: 'active'
            },
            {
              name: 'Demo Contributor',
              email: 'contributor@example.com',
              password: 'password123',
              role: 'contributor',
              status: 'active',
              restrictions: JSON.stringify({
                allowedScopes: [1, 2],
                allowedActivities: ['Fuel from Generator', 'Electricity Purchased'],
                restrictedPages: []
              })
            },
            {
              name: 'Demo Viewer',
              email: 'viewer@example.com',
              password: 'password123',
              role: 'viewer',
              status: 'active'
            }
          ];

          for (const user of defaultUsers) {
            await this.createUser(user);
          }
          
          console.log('✅ Default users seeded successfully');
        }
        resolve();
      } catch (error) {
        console.error('Error seeding default users:', error);
        reject(error);
      }
    });
  }

  async seedDefaultCompanyOperator() {
    return new Promise(async (resolve, reject) => {
      try {
        // Check if default operator exists
        const existingOperator = await this.findCompanyOperatorByEmail('admin@carbontrack-company.com');
        
        if (!existingOperator) {
          console.log('🔐 Seeding default company operator...');
          
          await this.createCompanyOperator({
            name: 'System Administrator',
            email: 'admin@carbontrack-company.com',
            password: 'CompanyAdmin2025!',
            role: 'super_operator',
            can_create_orgs: true,
            can_manage_orgs: true,
            can_view_all_orgs: true,
            notes: 'Default company operator. CHANGE PASSWORD IMMEDIATELY!'
          });
          
          console.log('✅ Default company operator seeded');
        }
        resolve();
      } catch (error) {
        console.error('Error seeding company operator:', error);
        // Don't reject - allow app to continue even if seeding fails
        resolve();
      }
    });
  }

  // ============================================
  // USER OPERATIONS (EXISTING)
  // ============================================

  async createUser(userData) {
    return new Promise(async (resolve, reject) => {
      try {
        console.log('💾 DATABASE: createUser called with data:', JSON.stringify(userData, null, 2));
        
        const hashedPassword = await bcrypt.hash(userData.password, 12);
        
        // Handle restrictions properly
        let restrictionsString = null;
        if (userData.restrictions) {
          if (typeof userData.restrictions === 'string') {
            restrictionsString = userData.restrictions;
          } else {
            restrictionsString = JSON.stringify(userData.restrictions);
          }
        }
        
        const query = `
          INSERT INTO users (name, email, password, role, status, restrictions, organisation_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        const values = [
          userData.name,
          userData.email,
          hashedPassword,
          userData.role || 'contributor',
          userData.status || 'active',
          restrictionsString,
          userData.organisation_id || null
        ];
        
        this.db.run(query, values, function(err) {
          if (err) {
            console.error('💾 DATABASE ERROR:', err);
            reject(err);
          } else {
            const userId = this.lastID;
            console.log(`💾 DATABASE: User created with ID: ${userId}`);
            
            const createdUser = {
              id: userId,
              ...userData,
              restrictions: userData.restrictions || null
            };
            
            resolve(createdUser);
          }
        });
      } catch (error) {
        console.error('💾 DATABASE EXCEPTION:', error);
        reject(error);
      }
    });
  }

  async findUserByEmail(email) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM users WHERE email = ? AND status = "active"';
      this.db.get(query, [email], (err, row) => {
        if (err) {
          reject(err);
        } else {
          if (row && row.restrictions) {
            try {
              row.restrictions = JSON.parse(row.restrictions);
            } catch (e) {
              row.restrictions = null;
            }
          }
          resolve(row);
        }
      });
    });
  }

  async findUserById(id) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM users WHERE id = ? AND status != "deleted"';
      
      this.db.get(query, [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          if (row && row.restrictions) {
            try {
              if (typeof row.restrictions === 'string') {
                row.restrictions = JSON.parse(row.restrictions);
              }
            } catch (e) {
              row.restrictions = null;
            }
          }
          resolve(row);
        }
      });
    });
  }

  async getAllUsers(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT id, name, email, role, status, created_at, last_login, restrictions, organisation_id FROM users WHERE 1=1';
      const params = [];

      if (filters.role && filters.role !== 'all') {
        query += ' AND role = ?';
        params.push(filters.role);
      }

      if (filters.status && filters.status !== 'all') {
        query += ' AND status = ?';
        params.push(filters.status);
      }

      if (filters.search) {
        query += ' AND (name LIKE ? OR email LIKE ?)';
        params.push(`%${filters.search}%`, `%${filters.search}%`);
      }

      if (filters.organisation_id) {
        query += ' AND organisation_id = ?';
        params.push(filters.organisation_id);
      }

      query += ' ORDER BY created_at DESC';

      if (filters.limit) {
        query += ' LIMIT ?';
        params.push(filters.limit);
      }

      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const users = rows.map(user => {
            if (user.restrictions) {
              try {
                user.restrictions = JSON.parse(user.restrictions);
              } catch (e) {
                user.restrictions = null;
              }
            }
            return user;
          });
          resolve(users);
        }
      });
    });
  }

  async updateUser(id, updates) {
    return new Promise((resolve, reject) => {
      const fields = [];
      const values = [];

      Object.keys(updates).forEach(key => {
        if (key === 'restrictions' && typeof updates[key] === 'object') {
          fields.push(`${key} = ?`);
          values.push(JSON.stringify(updates[key]));
        } else if (key !== 'id') {
          fields.push(`${key} = ?`);
          values.push(updates[key]);
        }
      });

      if (fields.length === 0) {
        return resolve();
      }

      values.push(id);
      const query = `UPDATE users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

      this.db.run(query, values, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  async deleteUser(id) {
    return new Promise((resolve, reject) => {
      const query = 'UPDATE users SET status = "inactive", updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      this.db.run(query, [id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  async verifyPassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  async updateLastLogin(userId) {
    return new Promise((resolve, reject) => {
      const query = 'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?';
      this.db.run(query, [userId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async getUserStats() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(*) as totalUsers,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as activeUsers,
          SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactiveUsers,
          SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as adminUsers,
          SUM(CASE WHEN role = 'analyst' THEN 1 ELSE 0 END) as analystUsers,
          SUM(CASE WHEN role = 'contributor' THEN 1 ELSE 0 END) as contributorUsers,
          SUM(CASE WHEN role = 'viewer' THEN 1 ELSE 0 END) as viewerUsers
        FROM users
      `;
      
      this.db.get(query, [], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // ============================================
  // ACTIVITY LOGGING (EXISTING)
  // ============================================

  async logActivity(activityData) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO activity_logs (user_id, action, resource_type, resource_id, details, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      
      this.db.run(query, [
        activityData.userId,
        activityData.action,
        activityData.resourceType || null,
        activityData.resourceId || null,
        activityData.details || null,
        activityData.ipAddress || null,
        activityData.userAgent || null
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID });
        }
      });
    });
  }

  async getUserActivities(userId, limit = 50) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM activity_logs 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ?
      `;
      
      this.db.all(query, [userId, limit], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // ============================================
  // COMPANY OPERATORS METHODS (NEW)
  // ============================================

  async createCompanyOperator(operatorData) {
    return new Promise(async (resolve, reject) => {
      try {
        const hashedPassword = await bcrypt.hash(operatorData.password, 12);
        
        const query = `
          INSERT INTO company_operators (
            name, email, password, role, 
            can_create_orgs, can_manage_orgs, can_view_all_orgs,
            is_active, notes, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        this.db.run(query, [
          operatorData.name,
          operatorData.email.toLowerCase(),
          hashedPassword,
          operatorData.role || 'operator',
          operatorData.can_create_orgs !== false ? 1 : 0,
          operatorData.can_manage_orgs !== false ? 1 : 0,
          operatorData.can_view_all_orgs !== false ? 1 : 0,
          1,
          operatorData.notes || null,
          operatorData.created_by || null
        ], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({
              id: this.lastID,
              ...operatorData,
              password: undefined
            });
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async findCompanyOperatorByEmail(email) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM company_operators WHERE email = ? AND is_active = 1';
      this.db.get(query, [email.toLowerCase()], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async findCompanyOperatorById(id) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM company_operators WHERE id = ? AND is_active = 1';
      this.db.get(query, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async updateCompanyOperatorLogin(operatorId) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE company_operators 
        SET last_login = CURRENT_TIMESTAMP, failed_login_attempts = 0 
        WHERE id = ?
      `;
      this.db.run(query, [operatorId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  // ============================================
  // ORGANISATIONS METHODS (NEW)
  // ============================================

  generateOrgId(orgName) {
    const year = new Date().getFullYear();
    const prefix = orgName.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '') || 'ORG';
    const timestamp = Date.now().toString().slice(-6);
    return `ORG-${prefix}-${year}-${timestamp}`;
  }

  async createOrganisation(orgData) {
    return new Promise((resolve, reject) => {
      try {
        const orgId = this.generateOrgId(orgData.name);
        
        const configString = orgData.config ? 
          (typeof orgData.config === 'string' ? orgData.config : JSON.stringify(orgData.config)) 
          : null;
        
        const query = `
          INSERT INTO organisations (
            id, name, display_name, industry_type, 
            location, contact_email, contact_phone, address, website,
            config, is_active, subscription_tier, 
            max_users, max_storage_gb, 
            registered_name, cin_number, registered_address, gst_number, current_employees,
            created_by, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        this.db.run(query, [
          orgId,
          orgData.name,
          orgData.display_name || orgData.name,
          orgData.industry_type,
          orgData.location || null,
          orgData.contact_email,
          orgData.contact_phone || null,
          orgData.address || null,
          orgData.website || null,
          configString,
          1,
          orgData.subscription_tier || 'standard',
          orgData.max_users || 50,
          orgData.max_storage_gb || 10,
          orgData.registered_name || orgData.name,
          orgData.cin_number || null,
          orgData.registered_address,
          orgData.gst_number || null,
          orgData.current_employees || null,
          orgData.created_by,
          orgData.notes || null
        ], function(err) {
          if (err) {
            reject(err);
          } else {
            console.log(`✅ Organisation created: ${orgId}`);
            resolve({
              id: orgId,
              ...orgData,
              config: orgData.config || null
            });
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }
  

  async findOrganisationById(orgId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM organisations WHERE id = ?';
      this.db.get(query, [orgId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          if (row && row.config) {
            try {
              row.config = JSON.parse(row.config);
            } catch (e) {
              row.config = null;
            }
          }
          resolve(row);
        }
      });
    });
  }

  async getAllOrganisations(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM organisations WHERE 1=1';
      const params = [];

      if (filters.is_active !== undefined) {
        query += ' AND is_active = ?';
        params.push(filters.is_active ? 1 : 0);
      }

      if (filters.industry_type) {
        query += ' AND industry_type = ?';
        params.push(filters.industry_type);
      }

      if (filters.search) {
        query += ' AND (name LIKE ? OR display_name LIKE ? OR contact_email LIKE ?)';
        params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
      }

      query += ' ORDER BY created_at DESC';

      if (filters.limit) {
        query += ' LIMIT ?';
        params.push(filters.limit);
      }

      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const orgs = rows.map(org => {
            if (org.config) {
              try {
                org.config = JSON.parse(org.config);
              } catch (e) {
                org.config = null;
              }
            }
            return org;
          });
          resolve(orgs);
        }
      });
    });
  }

  async updateOrganisation(orgId, updates) {
    return new Promise((resolve, reject) => {
      const fields = [];
      const values = [];

      Object.keys(updates).forEach(key => {
        if (key === 'config' && typeof updates[key] === 'object') {
          fields.push(`${key} = ?`);
          values.push(JSON.stringify(updates[key]));
        } else if (key !== 'id') {
          fields.push(`${key} = ?`);
          values.push(updates[key]);
        }
      });

      if (fields.length === 0) {
        return resolve();
      }

      values.push(orgId);
      const query = `UPDATE organisations SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

      this.db.run(query, values, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  async deactivateOrganisation(orgId) {
    return new Promise((resolve, reject) => {
      const query = 'UPDATE organisations SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      this.db.run(query, [orgId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  async getOrganisationStats(orgId) {
    return new Promise((resolve, reject) => {
      console.log('📊 getOrganisationStats called for organisation:', orgId);
      
      const query = `
        SELECT 
          COUNT(*) as totalUsers,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as activeUsers,
          SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactiveUsers,
          SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins,
          SUM(CASE WHEN role = 'analyst' THEN 1 ELSE 0 END) as analysts,
          SUM(CASE WHEN role = 'contributor' THEN 1 ELSE 0 END) as contributors,
          SUM(CASE WHEN role = 'viewer' THEN 1 ELSE 0 END) as viewers
        FROM users
        WHERE organisation_id = ?
      `;
      
      this.db.get(query, [orgId], (err, row) => {
        if (err) {
          console.error('❌ Error fetching organisation stats:', err);
          reject(err);
        } else {
          console.log('✅ Raw stats from database:', row);
          
          // SQLite returns lowercase column names, so we normalize to both formats
          // This ensures compatibility with both camelCase and snake_case
          const normalizedStats = {
            // Total users
            totalUsers: row.totalUsers || 0,
            total_users: row.totalUsers || 0,
            
            // Active users
            activeUsers: row.activeUsers || 0,
            active_users: row.activeUsers || 0,
            
            // Inactive users
            inactiveUsers: row.inactiveUsers || 0,
            inactive_users: row.inactiveUsers || 0,
            
            // Admin users
            admins: row.admins || 0,
            adminUsers: row.admins || 0,
            admin_users: row.admins || 0,
            
            // Analyst users
            analysts: row.analysts || 0,
            analystUsers: row.analysts || 0,
            analyst_users: row.analysts || 0,
            
            // Contributor users
            contributors: row.contributors || 0,
            contributorUsers: row.contributors || 0,
            contributor_users: row.contributors || 0,
            
            // Viewer users
            viewers: row.viewers || 0,
            viewerUsers: row.viewers || 0,
            viewer_users: row.viewers || 0
          };
          
          console.log('✅ Normalized stats being returned:', normalizedStats);
          resolve(normalizedStats);
        }
      });
    });
  }
  

  // ============================================
  // ORGANISATION SETTINGS METHODS (NEW)
  // ============================================

  async createOrganisationSettings(orgId, settings = {}) {
    return new Promise((resolve, reject) => {
      const featuresString = settings.features_enabled ? 
        JSON.stringify(settings.features_enabled) : 
        JSON.stringify(['analytics', 'reporting']);
      
      const notificationsString = settings.notification_settings ? 
        JSON.stringify(settings.notification_settings) : null;

      const query = `
        INSERT INTO organisation_settings (
          organisation_id, logo_url, primary_color, secondary_color,
          default_reporting_period, fiscal_year_start, timezone, currency,
          emission_factors_version, calculation_methodology,
          features_enabled, notification_settings, data_retention_days
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.db.run(query, [
        orgId,
        settings.logo_url || null,
        settings.primary_color || '#10b981',
        settings.secondary_color || '#059669',
        settings.default_reporting_period || 'monthly',
        settings.fiscal_year_start || '01-01',
        settings.timezone || 'UTC',
        settings.currency || 'USD',
        settings.emission_factors_version || 'latest',
        settings.calculation_methodology || 'GHG_Protocol',
        featuresString,
        notificationsString,
        settings.data_retention_days || 365
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID });
        }
      });
    });
  }

  async getOrganisationSettings(orgId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM organisation_settings WHERE organisation_id = ?';
      this.db.get(query, [orgId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          if (row) {
            try {
              if (row.features_enabled) row.features_enabled = JSON.parse(row.features_enabled);
              if (row.notification_settings) row.notification_settings = JSON.parse(row.notification_settings);
            } catch (e) {
              console.error('Error parsing settings JSON:', e);
            }
          }
          resolve(row);
        }
      });
    });
  }

  async updateOrganisationSettings(orgId, updates) {
    return new Promise((resolve, reject) => {
      const fields = [];
      const values = [];

      Object.keys(updates).forEach(key => {
        if (['features_enabled', 'notification_settings'].includes(key) && typeof updates[key] === 'object') {
          fields.push(`${key} = ?`);
          values.push(JSON.stringify(updates[key]));
        } else if (key !== 'organisation_id' && key !== 'id') {
          fields.push(`${key} = ?`);
          values.push(updates[key]);
        }
      });

      if (fields.length === 0) {
        return resolve();
      }

      values.push(orgId);
      const query = `UPDATE organisation_settings SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE organisation_id = ?`;

      this.db.run(query, values, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  // ============================================
  // ORGANISATION ACTIVITY LOGGING (NEW)
  // ============================================

  async logOrganisationActivity(activityData) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO organisation_activity_logs (
          organisation_id, action, actor_type, actor_id, actor_name,
          details, ip_address, user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const detailsString = activityData.details ? 
        (typeof activityData.details === 'string' ? activityData.details : JSON.stringify(activityData.details))
        : null;

      this.db.run(query, [
        activityData.organisation_id,
        activityData.action,
        activityData.actor_type,
        activityData.actor_id,
        activityData.actor_name || null,
        detailsString,
        activityData.ip_address || null,
        activityData.user_agent || null
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID });
        }
      });
    });
  }

  async getOrganisationActivities(orgId, limit = 100) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM organisation_activity_logs 
        WHERE organisation_id = ? 
        ORDER BY created_at DESC 
        LIMIT ?
      `;
      
      this.db.all(query, [orgId, limit], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const activities = rows.map(row => {
            if (row.details) {
              try {
                row.details = JSON.parse(row.details);
              } catch (e) {
                // Keep as string if not valid JSON
              }
            }
            return row;
          });
          resolve(activities);
        }
      });
    });
  }

  // ============================================
  // SUPER ADMIN USER CREATION (NEW)
  // ============================================

  async createSuperAdmin(superAdminData, organisationId) {
    return new Promise(async (resolve, reject) => {
      try {
        console.log('Creating Super Admin for organisation:', organisationId);
        
        const hashedPassword = await bcrypt.hash(superAdminData.password, 12);
        
        const query = `
          INSERT INTO users (
            name, email, password, role, status, 
            organisation_id, restrictions
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        this.db.run(query, [
          superAdminData.name,
          superAdminData.email.toLowerCase(),
          hashedPassword,
          'admin',
          'active',
          organisationId,
          JSON.stringify({ is_super_admin: true })
        ], function(err) {
          if (err) {
            reject(err);
          } else {
            const userId = this.lastID;
            console.log(`✅ Super Admin created with ID: ${userId}`);
            resolve({
              id: userId,
              name: superAdminData.name,
              email: superAdminData.email,
              role: 'admin',
              organisation_id: organisationId,
              is_super_admin: true
            });
          }
        });
      } catch (error) {
        console.error('Error creating Super Admin:', error);
        reject(error);
      }
    });
  }

  /**
 * ===============================================
 * TASK MANAGEMENT DATABASE METHODS
 * ===============================================
 */

async createTasksTable() {
  return new Promise((resolve, reject) => {
    console.log('📋 Creating tasks table...');

    const createTasksTable = `
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assigned_to INTEGER NOT NULL,
        assigned_by INTEGER NOT NULL,
        assigned_to_name TEXT,
        assigned_by_name TEXT,
        scope INTEGER NOT NULL,
        activity TEXT NOT NULL,
        source TEXT,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        deadline TEXT NOT NULL,
        comments TEXT,
        status TEXT DEFAULT 'pending',
        priority TEXT DEFAULT 'medium',
        organisation_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        
        FOREIGN KEY (assigned_to) REFERENCES users(id),
        FOREIGN KEY (assigned_by) REFERENCES users(id),
        FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE
      )
    `;

    const createIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by ON tasks(assigned_by)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_organisation ON tasks(organisation_id)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_scope ON tasks(scope)'
    ];

    this.db.serialize(() => {
      this.db.run(createTasksTable, (err) => {
        if (err && !err.message.includes('already exists')) {
          console.error('Error creating tasks table:', err);
          reject(err);
          return;
        }
      });

      // Create indexes
      createIndexes.forEach((indexQuery, i) => {
        this.db.run(indexQuery, (err) => {
          if (err && !err.message.includes('already exists')) {
            console.error(`Error creating task index ${i}:`, err);
          }
        });
      });

      console.log('✅ Tasks table created successfully');
      resolve();
    });
  });
}

/**
 * Create a new task
 */
async createTask(taskData) {
  return new Promise((resolve, reject) => {
    try {
      console.log('📋 Creating task:', JSON.stringify(taskData, null, 2));
      
      const query = `
        INSERT INTO tasks (
          assigned_to, assigned_by, assigned_to_name, assigned_by_name,
          scope, activity, source, start_date, end_date, deadline,
          comments, status, priority, organisation_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const values = [
        taskData.assigned_to,
        taskData.assigned_by,
        taskData.assigned_to_name,
        taskData.assigned_by_name,
        taskData.scope,
        taskData.activity,
        taskData.source || null,
        taskData.start_date,
        taskData.end_date,
        taskData.deadline,
        taskData.comments || null,
        taskData.status || 'pending',
        taskData.priority || 'medium',
        taskData.organisation_id
      ];
      
      this.db.run(query, values, function(err) {
        if (err) {
          console.error('📋 Task creation error:', err);
          reject(err);
        } else {
          const taskId = this.lastID;
          console.log(`✅ Task created with ID: ${taskId}`);
          
          const createdTask = {
            id: taskId,
            ...taskData
          };
          
          resolve(createdTask);
        }
      });
    } catch (error) {
      console.error('📋 Task creation exception:', error);
      reject(error);
    }
  });
}

/**
 * Get tasks for a specific user (contributor view)
 */
// backend/database/localDB.js
// EXTRACT: Replace the getUserTasks function with this fixed version

/**
 * Get tasks for a specific user (contributor view)
 */
async getUserTasks(userId, filters = {}) {
  return new Promise((resolve, reject) => {
    // FIXED: Simplified query without nested subqueries that cause column reference issues
    let query = `
      SELECT t.id,
             t.assigned_to,
             t.assigned_by,
             t.assigned_to_name,
             t.assigned_by_name,
             t.scope,
             t.activity,
             t.source,
             t.start_date,
             t.end_date,
             t.deadline,
             t.comments,
             t.status,
             t.priority,
             t.organisation_id,
             t.created_at,
             t.updated_at,
             t.completed_at,
             assigner.name as assigned_by_name_fresh,
             assignee.name as assigned_to_name_fresh
      FROM tasks t
      LEFT JOIN users assigner ON t.assigned_by = assigner.id
      LEFT JOIN users assignee ON t.assigned_to = assignee.id
      WHERE t.assigned_to = ?
    `;
    const params = [userId];

    // Add filters
    if (filters.status && filters.status !== 'all') {
      query += ' AND t.status = ?';
      params.push(filters.status);
    }

    if (filters.organisation_id) {
      query += ' AND t.organisation_id = ?';
      params.push(filters.organisation_id);
    }

    if (filters.scope && filters.scope !== 'all') {
      query += ' AND t.scope = ?';
      params.push(parseInt(filters.scope));
    }

    query += ' ORDER BY t.deadline ASC, t.created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    console.log('📋 Getting user tasks for user:', userId);
    console.log('📋 Query:', query);
    console.log('📋 Params:', params);

    this.db.all(query, params, (err, rows) => {
      if (err) {
        console.error('❌ Error fetching user tasks:', err);
        reject(err);
      } else {
        console.log(`📋 Found ${rows?.length || 0} tasks for user ${userId}`);
        
        if (!rows) {
          resolve([]);
          return;
        }

        // Add computed fields and standardize column names
        const tasksWithStatus = rows.map(row => ({
          id: row.id,
          assigned_to: row.assigned_to,
          assigned_by: row.assigned_by,
          assigned_to_name: row.assigned_to_name_fresh || row.assigned_to_name,
          assigned_by_name: row.assigned_by_name_fresh || row.assigned_by_name,
          scope: row.scope,
          activity: row.activity,
          source: row.source,
          start_date: row.start_date,
          end_date: row.end_date,
          deadline: row.deadline,
          comments: row.comments,
          status: row.status,
          priority: row.priority,
          organisation_id: row.organisation_id,
          created_at: row.created_at,
          updated_at: row.updated_at,
          completed_at: row.completed_at,
          // Add computed fields
          display_status: this.computeTaskStatus(row),
          days_until_deadline: this.getDaysUntilDeadline(row.deadline)
        }));
        
        resolve(tasksWithStatus);
      }
    });
  });
}

/**
 * Get all tasks (admin view)
 */
async getAllTasks(filters = {}) {
  return new Promise((resolve, reject) => {
    // FIXED: Simplified query without nested subqueries
    let query = `
      SELECT t.id,
             t.assigned_to,
             t.assigned_by,
             t.assigned_to_name,
             t.assigned_by_name,
             t.scope,
             t.activity,
             t.source,
             t.start_date,
             t.end_date,
             t.deadline,
             t.comments,
             t.status,
             t.priority,
             t.organisation_id,
             t.created_at,
             t.updated_at,
             t.completed_at,
             assigner.name as assigned_by_name_fresh,
             assignee.name as assigned_to_name_fresh,
             assignee.email as assigned_to_email
      FROM tasks t
      LEFT JOIN users assigner ON t.assigned_by = assigner.id
      LEFT JOIN users assignee ON t.assigned_to = assignee.id
      WHERE 1=1
    `;
    const params = [];

    // Organisation filter (critical for multi-tenant)
    if (filters.organisation_id) {
      query += ' AND t.organisation_id = ?';
      params.push(filters.organisation_id);
    }

    // Status filter
    if (filters.status && filters.status !== 'all') {
      query += ' AND t.status = ?';
      params.push(filters.status);
    }

    // Scope filter
    if (filters.scope && filters.scope !== 'all') {
      query += ' AND t.scope = ?';
      params.push(parseInt(filters.scope));
    }

    // Date range filter
    if (filters.start_date) {
      query += ' AND DATE(t.deadline) >= DATE(?)';
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ' AND DATE(t.deadline) <= DATE(?)';
      params.push(filters.end_date);
    }

    // Search filter
    if (filters.search) {
      query += ` AND (
        t.activity LIKE ? OR 
        t.comments LIKE ? OR 
        assignee.name LIKE ? OR
        t.source LIKE ?
      )`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY t.deadline ASC, t.created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    console.log('📋 Getting all tasks');
    console.log('📋 Filters:', JSON.stringify(filters));
    console.log('📋 Query:', query);
    console.log('📋 Params:', params);

    this.db.all(query, params, (err, rows) => {
      if (err) {
        console.error('❌ Error fetching all tasks:', err);
        reject(err);
      } else {
        console.log(`📋 Found ${rows?.length || 0} tasks`);
        
        if (!rows) {
          resolve([]);
          return;
        }

        // Add computed fields and standardize column names
        const tasksWithStatus = rows.map(row => ({
          id: row.id,
          assigned_to: row.assigned_to,
          assigned_by: row.assigned_by,
          assigned_to_name: row.assigned_to_name_fresh || row.assigned_to_name,
          assigned_by_name: row.assigned_by_name_fresh || row.assigned_by_name,
          assigned_to_email: row.assigned_to_email,
          scope: row.scope,
          activity: row.activity,
          source: row.source,
          start_date: row.start_date,
          end_date: row.end_date,
          deadline: row.deadline,
          comments: row.comments,
          status: row.status,
          priority: row.priority,
          organisation_id: row.organisation_id,
          created_at: row.created_at,
          updated_at: row.updated_at,
          completed_at: row.completed_at,
          // Add computed fields
          display_status: this.computeTaskStatus(row),
          days_until_deadline: this.getDaysUntilDeadline(row.deadline)
        }));
        
        resolve(tasksWithStatus);
      }
    });
  });
}

/**
 * Get task by ID
 */
async getTaskById(taskId) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT t.*, 
             assigner.name as assigned_by_name,
             assignee.name as assigned_to_name,
             assignee.email as assigned_to_email
      FROM tasks t
      LEFT JOIN users assigner ON t.assigned_by = assigner.id
      LEFT JOIN users assignee ON t.assigned_to = assignee.id
      WHERE t.id = ?
    `;
    
    this.db.get(query, [taskId], (err, row) => {
      if (err) {
        console.error('Error fetching task by ID:', err);
        reject(err);
      } else {
        if (row) {
          row.display_status = this.computeTaskStatus(row);
          row.days_until_deadline = this.getDaysUntilDeadline(row.deadline);
        }
        resolve(row);
      }
    });
  });
}

/**
 * Update task
 */
async updateTask(taskId, updates) {
  return new Promise((resolve, reject) => {
    const fields = [];
    const values = [];

    // Build dynamic update query
    Object.keys(updates).forEach(key => {
      if (key !== 'id') {
        fields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    });

    // Add completion timestamp if status is being changed to completed
    if (updates.status === 'completed' && !updates.completed_at) {
      fields.push('completed_at = CURRENT_TIMESTAMP');
    }

    if (fields.length === 0) {
      return resolve();
    }

    values.push(taskId);
    const query = `
      UPDATE tasks 
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `;

    this.db.run(query, values, function(err) {
      if (err) {
        console.error('Error updating task:', err);
        reject(err);
      } else {
        console.log(`✅ Task ${taskId} updated successfully`);
        resolve({ changes: this.changes });
      }
    });
  });
}

/**
 * Delete task
 */
async deleteTask(taskId) {
  return new Promise((resolve, reject) => {
    const query = 'DELETE FROM tasks WHERE id = ?';
    
    this.db.run(query, [taskId], function(err) {
      if (err) {
        console.error('Error deleting task:', err);
        reject(err);
      } else {
        console.log(`✅ Task ${taskId} deleted successfully`);
        resolve({ changes: this.changes });
      }
    });
  });
}

/**
 * Get task statistics
 */
async getTaskStats(organisationId, userId = null) {
  return new Promise((resolve, reject) => {
    let query = `
      SELECT 
        COUNT(*) as total_tasks,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_tasks,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tasks,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
        SUM(CASE WHEN DATE(deadline) < DATE('now') AND status != 'completed' THEN 1 ELSE 0 END) as overdue_tasks,
        SUM(CASE WHEN scope = 1 THEN 1 ELSE 0 END) as scope1_tasks,
        SUM(CASE WHEN scope = 2 THEN 1 ELSE 0 END) as scope2_tasks,
        SUM(CASE WHEN scope = 3 THEN 1 ELSE 0 END) as scope3_tasks
      FROM tasks
      WHERE organisation_id = ?
    `;
    const params = [organisationId];

    if (userId) {
      query += ' AND assigned_to = ?';
      params.push(userId);
    }
    
    this.db.get(query, params, (err, row) => {
      if (err) {
        console.error('Error fetching task stats:', err);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

/**
 * Get tasks due soon (for notifications)
 */
async getTasksDueSoon(days = 3, organisationId = null) {
  return new Promise((resolve, reject) => {
    let query = `
      SELECT t.*, 
             assignee.name as assigned_to_name,
             assignee.email as assigned_to_email
      FROM tasks t
      LEFT JOIN users assignee ON t.assigned_to = assignee.id
      WHERE t.status IN ('pending', 'in_progress')
        AND DATE(t.deadline) BETWEEN DATE('now') AND DATE('now', '+' || ? || ' days')
    `;
    const params = [days];

    if (organisationId) {
      query += ' AND t.organisation_id = ?';
      params.push(organisationId);
    }

    query += ' ORDER BY t.deadline ASC';
    
    this.db.all(query, params, (err, rows) => {
      if (err) {
        console.error('Error fetching tasks due soon:', err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

/**
 * Utility: Compute task display status
 */
computeTaskStatus(task) {
  if (task.status === 'completed') return 'completed';
  if (task.status === 'cancelled') return 'cancelled';
  
  const deadline = new Date(task.deadline);
  const now = new Date();
  
  if (deadline < now) return 'overdue';
  return task.status;
}

/**
 * Utility: Get days until deadline
 */
getDaysUntilDeadline(deadline) {
  const deadlineDate = new Date(deadline);
  const now = new Date();
  const diffTime = deadlineDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

  // ============================================
  // DATABASE CONNECTION MANAGEMENT
  // ============================================

  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('Database connection closed');
        }
      });
    }
  }
}



// Create singleton instance
const localDB = new LocalDatabase();

module.exports = localDB;