// backend/database/localDB.js - SQLite Local Database Setup
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
          this.createTables().then(resolve).catch(reject);
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
          restrictions TEXT -- JSON string for role restrictions
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
                allowedScopes: [1, 2], // Can only access Scope 1 and 2
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

  // User operations
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
            console.log('💾 DATABASE: Restrictions already string:', restrictionsString);
          } else {
            restrictionsString = JSON.stringify(userData.restrictions);
            console.log('💾 DATABASE: Converted restrictions to string:', restrictionsString);
          }
        } else {
          console.log('💾 DATABASE: No restrictions provided');
        }
        
        const query = `
          INSERT INTO users (name, email, password, role, status, restrictions)
          VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        const values = [
          userData.name,
          userData.email,
          hashedPassword,
          userData.role || 'contributor',
          userData.status || 'active',
          restrictionsString
        ];
        
        console.log('💾 DATABASE: Executing query with values:', {
          name: values[0],
          email: values[1],
          password: '[HIDDEN]',
          role: values[3],
          status: values[4],
          restrictions: values[5]
        });
        
        this.db.run(query, values, function(err) {
          if (err) {
            console.error('💾 DATABASE ERROR:', err);
            reject(err);
          } else {
            const userId = this.lastID;
            console.log(`💾 DATABASE: User created with ID: ${userId}`);
            
            // Return the user object with parsed restrictions
            const createdUser = {
              id: userId,
              ...userData,
              restrictions: userData.restrictions || null
            };
            
            console.log('💾 DATABASE: Returning user object:', JSON.stringify(createdUser, null, 2));
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
      
      console.log('💾 DATABASE: Finding user by ID:', id);
      
      this.db.get(query, [id], (err, row) => {
        if (err) {
          console.error('💾 DATABASE ERROR in findUserById:', err);
          reject(err);
        } else {
          if (row) {
            console.log('💾 DATABASE: Raw user data from DB:', JSON.stringify(row, null, 2));
            
            // Parse restrictions if they exist
            if (row.restrictions) {
              try {
                if (typeof row.restrictions === 'string') {
                  row.restrictions = JSON.parse(row.restrictions);
                  console.log('💾 DATABASE: Parsed restrictions:', JSON.stringify(row.restrictions, null, 2));
                }
              } catch (e) {
                console.error('💾 DATABASE: Error parsing restrictions:', e);
                row.restrictions = null;
              }
            } else {
              console.log('💾 DATABASE: No restrictions found for user');
            }
            
            console.log('💾 DATABASE: Final user object:', JSON.stringify(row, null, 2));
          } else {
            console.log('💾 DATABASE: No user found with ID:', id);
          }
          
          resolve(row);
        }
      });
    });
  }

  async getAllUsers(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT id, name, email, role, status, created_at, last_login, restrictions FROM users WHERE 1=1';
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

      query += ' ORDER BY created_at DESC';

      if (filters.limit) {
        query += ' LIMIT ?';
        params.push(filters.limit);
      }

      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          // Parse restrictions for each user
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
      // Soft delete by setting status to inactive
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

  // Activity logging
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

  // Get user statistics
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

  // Close database connection
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