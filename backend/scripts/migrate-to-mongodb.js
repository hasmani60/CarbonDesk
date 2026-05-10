// backend/scripts/migrate-to-mongodb.js — One-time SQLite → MongoDB migration for production cutover.
// Prerequisites: MONGODB_URI set; backup Mongo + SQLite before running. Safe to re-run: upserts orgs/settings; users matched by email; emissions/tasks may duplicate if you run twice — use a fresh Mongo or delete collections first.
require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const mongoose = require('mongoose');
const path = require('path');

// Import MongoDB models
const {
  User,
  Organisation,
  Emission,
  ActivityLog,
  Task,
  CompanyOperator,
  OrganisationSettings,
  MACCOpportunity
} = require('../models');

const logger = {
  info: (msg, data) => console.log(`[INFO] ${msg}`, data || ''),
  error: (msg, data) => console.error(`[ERROR] ${msg}`, data || ''),
  warn: (msg, data) => console.warn(`[WARN] ${msg}`, data || ''),
  success: (msg, data) => console.log(`[SUCCESS] ✓ ${msg}`, data || '')
};

class MigrationManager {
  constructor() {
    this.sqliteDb = null;
    /** SQLite users.id → Mongo User._id */
    this.sqliteUserIdToMongo = new Map();
    this.stats = {
      users: 0,
      organisations: 0,
      emissions: 0,
      tasks: 0,
      activityLogs: 0,
      companyOperators: 0,
      organisationSettings: 0,
      maccOpportunities: 0,
      errors: []
    };
  }

  async connectSQLite() {
    return new Promise((resolve, reject) => {
      const dbPath = path.join(__dirname, '../database/carbon_accounting.db');
      logger.info('Connecting to SQLite database...', dbPath);

      this.sqliteDb = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          logger.error('Failed to connect to SQLite:', err);
          reject(err);
        } else {
          logger.success('SQLite database connected');
          resolve();
        }
      });
    });
  }

  async connectMongoDB() {
    try {
      if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is not set in .env');
      }
      logger.info('Connecting to MongoDB...');
      await mongoose.connect(process.env.MONGODB_URI, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
      });
      logger.success('MongoDB connected');
    } catch (error) {
      logger.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async queryAll(query) {
    return new Promise((resolve, reject) => {
      this.sqliteDb.all(query, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  coerceDate(val) {
    if (val == null || val === '') return undefined;
    const d = val instanceof Date ? val : new Date(val);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }

  normalizeEmissionStatus(s) {
    const allowed = ['draft', 'submitted', 'verified', 'rejected'];
    if (s && allowed.includes(s)) return s;
    return 'draft';
  }

  async migrateOrganisations() {
    try {
      logger.info('Migrating organisations...');
      const orgs = await this.queryAll('SELECT * FROM organisations');

      for (const org of orgs) {
        try {
          const doc = {
            _id: org.id,
            id: org.id,
            name: org.name,
            display_name: org.display_name,
            industry_type: org.industry_type,
            location: org.location || undefined,
            contact_email: org.contact_email,
            contact_phone: org.contact_phone || undefined,
            address: org.address || undefined,
            website: org.website || undefined,
            config: org.config ? JSON.parse(org.config) : null,
            is_active: org.is_active === 1,
            subscription_tier: org.subscription_tier || 'standard',
            max_users: org.max_users || 50,
            max_storage_gb: org.max_storage_gb || 10,
            registered_name: org.registered_name || undefined,
            cin_number: org.cin_number || undefined,
            registered_address: org.registered_address || undefined,
            gst_number: org.gst_number || undefined,
            current_employees: org.current_employees ?? undefined,
            created_by: org.created_by ? String(org.created_by) : undefined,
            notes: org.notes || undefined,
            activated_at: this.coerceDate(org.activated_at),
            created_at: this.coerceDate(org.created_at),
            updated_at: this.coerceDate(org.updated_at)
          };

          await Organisation.replaceOne({ _id: org.id }, doc, { upsert: true });
          this.stats.organisations++;
        } catch (error) {
          logger.error(`Failed to migrate organisation ${org.id}:`, error.message);
          this.stats.errors.push({ type: 'organisation', id: org.id, error: error.message });
        }
      }

      logger.success(`Migrated ${this.stats.organisations} organisations`);
    } catch (error) {
      logger.error('Organisation migration failed:', error);
      throw error;
    }
  }

  async migrateUsers() {
    try {
      logger.info('Migrating users...');
      const users = await this.queryAll('SELECT * FROM users');

      for (const user of users) {
        try {
          let restrictions = null;
          if (user.restrictions) {
            try {
              restrictions = JSON.parse(user.restrictions);
            } catch (e) {
              logger.warn(`Failed to parse restrictions for user ${user.email}`);
            }
          }

          const email = String(user.email || '').toLowerCase().trim();
          let doc = await User.findOne({ email });

          if (!doc) {
            doc = await User.create({
              name: user.name,
              email,
              password: user.password,
              role: user.role || 'contributor',
              status: user.status || 'active',
              organisation_id: user.organisation_id ? String(user.organisation_id) : '',
              restrictions,
              last_login: this.coerceDate(user.last_login),
              created_at: this.coerceDate(user.created_at),
              updated_at: this.coerceDate(user.updated_at)
            });
            this.stats.users++;
          } else {
            logger.warn(`User ${email} already in MongoDB — linking SQLite id ${user.id} to existing _id`);
          }

          if (user.id != null && doc && doc._id) {
            this.sqliteUserIdToMongo.set(String(user.id), doc._id);
          }
        } catch (error) {
          logger.error(`Failed to migrate user ${user.email}:`, error.message);
          this.stats.errors.push({ type: 'user', id: user.email, error: error.message });
        }
      }

      logger.success(`Migrated ${this.stats.users} users`);
    } catch (error) {
      logger.error('User migration failed:', error);
      throw error;
    }
  }

  async migrateEmissions() {
    try {
      logger.info('Migrating emissions...');
      const emissions = await this.queryAll('SELECT * FROM emissions');

      for (const emission of emissions) {
        try {
          const scopeNum = parseInt(emission.scope, 10);
          const dateVal = this.coerceDate(emission.date) || new Date();
          const mappedCreator = emission.created_by != null
            ? this.sqliteUserIdToMongo.get(String(emission.created_by))
            : null;
          const created_by = mappedCreator
            ? mappedCreator.toString()
            : (emission.created_by != null ? String(emission.created_by) : undefined);

          await Emission.create({
            scope: Number.isFinite(scopeNum) ? scopeNum : 1,
            category: emission.category || undefined,
            activity: emission.activity || 'unknown',
            quantity: emission.quantity != null ? Number(emission.quantity) : 0,
            unit: emission.unit || 'kg',
            co2e: emission.co2e != null ? Number(emission.co2e) : 0,
            date: dateVal,
            status: this.normalizeEmissionStatus(emission.status),
            notes: emission.notes || undefined,
            verified_by: emission.verified_by != null ? String(emission.verified_by) : undefined,
            verified_at: emission.verified_at ? String(emission.verified_at) : undefined,
            organisation_id: String(emission.organisation_id),
            organisation_name: emission.organisation_name || undefined,
            created_by,
            created_by_name: emission.created_by_name || undefined,
            created_at: this.coerceDate(emission.created_at) || dateVal,
            updated_at: this.coerceDate(emission.updated_at) || this.coerceDate(emission.created_at) || dateVal
          });
          this.stats.emissions++;
        } catch (error) {
          logger.error(`Failed to migrate emission ${emission.id}:`, error.message);
          this.stats.errors.push({ type: 'emission', id: emission.id, error: error.message });
        }
      }

      logger.success(`Migrated ${this.stats.emissions} emissions`);
    } catch (error) {
      logger.error('Emission migration failed:', error);
      throw error;
    }
  }

  async migrateTasks() {
    try {
      logger.info('Migrating tasks...');
      const tasks = await this.queryAll('SELECT * FROM tasks');

      for (const task of tasks) {
        try {
          const assignedTo = task.assigned_to != null
            ? this.sqliteUserIdToMongo.get(String(task.assigned_to))
            : null;
          const assignedBy = task.assigned_by != null
            ? this.sqliteUserIdToMongo.get(String(task.assigned_by))
            : null;

          if (!assignedTo || !assignedBy) {
            logger.warn(
              `Skip task ${task.id}: could not map assigned_to/assigned_by (SQLite user → Mongo ObjectId)`
            );
            this.stats.errors.push({
              type: 'task',
              id: task.id,
              error: 'Missing user id mapping for assigned_to or assigned_by'
            });
            continue;
          }

          const scopeNum = parseInt(task.scope, 10);
          const start = this.coerceDate(task.start_date);
          const end = this.coerceDate(task.end_date);
          const deadline = this.coerceDate(task.deadline);
          if (!start || !end || !deadline) {
            throw new Error('Invalid start_date, end_date, or deadline');
          }

          let status = task.status || 'pending';
          if (!['pending', 'in_progress', 'completed', 'cancelled'].includes(status)) {
            status = 'pending';
          }
          let priority = task.priority || 'medium';
          if (!['low', 'medium', 'high', 'urgent'].includes(priority)) {
            priority = 'medium';
          }

          await Task.create({
            assigned_to: assignedTo,
            assigned_by: assignedBy,
            scope: Number.isFinite(scopeNum) ? scopeNum : 1,
            activity: task.activity || 'unknown',
            source: task.source || undefined,
            start_date: start,
            end_date: end,
            deadline,
            comments: task.comments || undefined,
            status,
            priority,
            organisation_id: String(task.organisation_id),
            completed_at: this.coerceDate(task.completed_at),
            created_at: this.coerceDate(task.created_at),
            updated_at: this.coerceDate(task.updated_at)
          });
          this.stats.tasks++;
        } catch (error) {
          logger.error(`Failed to migrate task ${task.id}:`, error.message);
          this.stats.errors.push({ type: 'task', id: task.id, error: error.message });
        }
      }

      logger.success(`Migrated ${this.stats.tasks} tasks`);
    } catch (error) {
      logger.error('Task migration failed:', error);
      throw error;
    }
  }

  async migrateActivityLogs() {
    try {
      logger.info('Migrating activity logs...');
      const logs = await this.queryAll('SELECT * FROM activity_logs');

      for (const log of logs) {
        try {
          const mapped = log.user_id != null ? this.sqliteUserIdToMongo.get(String(log.user_id)) : null;
          const user_id = mapped ? mapped.toString() : String(log.user_id != null ? log.user_id : 'unknown');

          await ActivityLog.create({
            user_id,
            action: log.action,
            resource_type: log.resource_type || undefined,
            resource_id: log.resource_id != null ? String(log.resource_id) : undefined,
            details: log.details || undefined,
            ip_address: log.ip_address || undefined,
            user_agent: log.user_agent || undefined,
            created_at: this.coerceDate(log.created_at) || new Date()
          });
          this.stats.activityLogs++;
        } catch (error) {
          this.stats.errors.push({ type: 'activity_log', id: log.id, error: error.message });
        }
      }

      logger.success(`Migrated ${this.stats.activityLogs} activity logs`);
    } catch (error) {
      logger.error('Activity log migration failed:', error);
      // Don't throw - activity logs are not critical
    }
  }

  async migrateCompanyOperators() {
    try {
      logger.info('Migrating company operators...');
      const operators = await this.queryAll('SELECT * FROM company_operators');

      for (const op of operators) {
        try {
          await CompanyOperator.create({
            name: op.name,
            email: op.email,
            password: op.password, // Already hashed
            role: op.role,
            can_create_orgs: op.can_create_orgs === 1,
            can_manage_orgs: op.can_manage_orgs === 1,
            can_view_all_orgs: op.can_view_all_orgs === 1,
            is_active: op.is_active === 1,
            last_login: op.last_login,
            failed_login_attempts: op.failed_login_attempts,
            locked_until: op.locked_until,
            created_by: op.created_by,
            notes: op.notes,
            created_at: op.created_at,
            updated_at: op.updated_at
          });
          this.stats.companyOperators++;
        } catch (error) {
          logger.error(`Failed to migrate company operator ${op.email}:`, error.message);
          this.stats.errors.push({ type: 'company_operator', id: op.email, error: error.message });
        }
      }

      logger.success(`Migrated ${this.stats.companyOperators} company operators`);
    } catch (error) {
      logger.error('Company operator migration failed:', error);
      throw error;
    }
  }

  async migrateOrganisationSettings() {
    try {
      logger.info('Migrating organisation settings...');
      const settings = await this.queryAll('SELECT * FROM organisation_settings');

      for (const setting of settings) {
        try {
          const doc = {
            organisation_id: setting.organisation_id,
            logo_url: setting.logo_url || undefined,
            primary_color: setting.primary_color,
            secondary_color: setting.secondary_color,
            default_reporting_period: setting.default_reporting_period,
            fiscal_year_start: setting.fiscal_year_start,
            timezone: setting.timezone,
            currency: setting.currency,
            emission_factors_version: setting.emission_factors_version,
            calculation_methodology: setting.calculation_methodology,
            features_enabled: setting.features_enabled ? JSON.parse(setting.features_enabled) : [],
            notification_settings: setting.notification_settings ? JSON.parse(setting.notification_settings) : null,
            data_retention_days: setting.data_retention_days,
            created_at: this.coerceDate(setting.created_at),
            updated_at: this.coerceDate(setting.updated_at)
          };
          await OrganisationSettings.replaceOne(
            { organisation_id: setting.organisation_id },
            doc,
            { upsert: true }
          );
          this.stats.organisationSettings++;
        } catch (error) {
          logger.error(`Failed to migrate settings for org ${setting.organisation_id}:`, error.message);
          this.stats.errors.push({ type: 'org_settings', id: setting.organisation_id, error: error.message });
        }
      }

      logger.success(`Migrated ${this.stats.organisationSettings} organisation settings`);
    } catch (error) {
      logger.error('Organisation settings migration failed:', error);
      // Don't throw - settings can be recreated
    }
  }

  async migrateMACCOpportunities() {
    try {
      logger.info('Migrating MACC opportunities...');
      const macc = await this.queryAll('SELECT * FROM macc_opportunities');

      for (const opportunity of macc) {
        try {
          await MACCOpportunity.create({
            organisation_id: opportunity.organisation_id,
            name: opportunity.name,
            category: opportunity.category,
            scope: opportunity.scope,
            cost_per_tCO2e: opportunity.cost_per_tCO2e,
            reduction_potential: opportunity.reduction_potential,
            payback_period: opportunity.payback_period,
            implementation_status: opportunity.implementation_status,
            notes: opportunity.notes,
            created_at: opportunity.created_at,
            updated_at: opportunity.updated_at
          });
          this.stats.maccOpportunities++;
        } catch (error) {
          logger.error(`Failed to migrate MACC opportunity ${opportunity.id}:`, error.message);
          this.stats.errors.push({ type: 'macc', id: opportunity.id, error: error.message });
        }
      }

      logger.success(`Migrated ${this.stats.maccOpportunities} MACC opportunities`);
    } catch (error) {
      logger.error('MACC opportunities migration failed:', error);
      // Don't throw - MACC data is not critical
    }
  }

  async run() {
    try {
      console.log('═══════════════════════════════════════════════════');
      console.log('  Carbon Accounting - SQLite to MongoDB Migration  ');
      console.log('═══════════════════════════════════════════════════\n');

      // Connect to both databases
      await this.connectSQLite();
      await this.connectMongoDB();

      console.log('\nStarting migration...\n');

      // Run migrations in order (respecting foreign keys)
      await this.migrateOrganisations();
      await this.migrateOrganisationSettings();
      await this.migrateUsers();
      await this.migrateCompanyOperators();
      await this.migrateEmissions();
      await this.migrateTasks();
      await this.migrateMACCOpportunities();
      await this.migrateActivityLogs();

      // Print summary
      console.log('\n═══════════════════════════════════════════════════');
      console.log('  Migration Summary');
      console.log('═══════════════════════════════════════════════════\n');
      console.log(`✓ Organisations:          ${this.stats.organisations}`);
      console.log(`✓ Organisation Settings:  ${this.stats.organisationSettings}`);
      console.log(`✓ Users:                  ${this.stats.users}`);
      console.log(`✓ Company Operators:      ${this.stats.companyOperators}`);
      console.log(`✓ Emissions:              ${this.stats.emissions}`);
      console.log(`✓ Tasks:                  ${this.stats.tasks}`);
      console.log(`✓ MACC Opportunities:     ${this.stats.maccOpportunities}`);
      console.log(`✓ Activity Logs:          ${this.stats.activityLogs}`);
      console.log(`\n✗ Errors:                 ${this.stats.errors.length}`);

      if (this.stats.errors.length > 0) {
        console.log('\nErrors encountered:');
        this.stats.errors.slice(0, 10).forEach(err => {
          console.log(`  - ${err.type} (${err.id}): ${err.error}`);
        });
        if (this.stats.errors.length > 10) {
          console.log(`  ... and ${this.stats.errors.length - 10} more errors`);
        }
      }

      console.log('\n═══════════════════════════════════════════════════');
      logger.success('Migration completed successfully!');
      console.log('═══════════════════════════════════════════════════\n');

    } catch (error) {
      logger.error('Migration failed:', error);
      throw error;
    } finally {
      // Close connections
      if (this.sqliteDb) {
        this.sqliteDb.close();
      }
      if (mongoose.connection) {
        await mongoose.disconnect();
      }
    }
  }
}

// Run migration if executed directly
if (require.main === module) {
  const migration = new MigrationManager();
  migration.run()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = MigrationManager;
