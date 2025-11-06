// backend/scripts/migrate-to-mongodb.js - SQLite to MongoDB Migration Script
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

  async migrateOrganisations() {
    try {
      logger.info('Migrating organisations...');
      const orgs = await this.queryAll('SELECT * FROM organisations');

      for (const org of orgs) {
        try {
          await Organisation.create({
            id: org.id,
            name: org.name,
            display_name: org.display_name,
            industry_type: org.industry_type,
            location: org.location,
            contact_email: org.contact_email,
            contact_phone: org.contact_phone,
            address: org.address,
            website: org.website,
            config: org.config ? JSON.parse(org.config) : null,
            is_active: org.is_active === 1,
            subscription_tier: org.subscription_tier || 'standard',
            max_users: org.max_users || 50,
            max_storage_gb: org.max_storage_gb || 10,
            registered_name: org.registered_name,
            cin_number: org.cin_number,
            registered_address: org.registered_address,
            gst_number: org.gst_number,
            current_employees: org.current_employees,
            created_by: org.created_by,
            notes: org.notes,
            activated_at: org.activated_at,
            created_at: org.created_at,
            updated_at: org.updated_at
          });
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
          // Parse restrictions if they exist
          let restrictions = null;
          if (user.restrictions) {
            try {
              restrictions = JSON.parse(user.restrictions);
            } catch (e) {
              logger.warn(`Failed to parse restrictions for user ${user.email}`);
            }
          }

          await User.create({
            name: user.name,
            email: user.email,
            password: user.password, // Already hashed in SQLite
            role: user.role,
            status: user.status,
            organisation_id: user.organisation_id,
            restrictions: restrictions,
            last_login: user.last_login,
            created_at: user.created_at,
            updated_at: user.updated_at
          });
          this.stats.users++;
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
          await Emission.create({
            scope: emission.scope,
            category: emission.category,
            activity: emission.activity,
            quantity: emission.quantity,
            unit: emission.unit,
            co2e: emission.co2e,
            date: emission.date,
            status: emission.status,
            notes: emission.notes,
            verified_by: emission.verified_by,
            verified_at: emission.verified_at,
            organisation_id: emission.organisation_id,
            organisation_name: emission.organisation_name,
            created_by: emission.created_by,
            created_by_name: emission.created_by_name,
            created_at: emission.created_at,
            updated_at: emission.updated_at
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
          await Task.create({
            assigned_to: task.assigned_to,
            assigned_by: task.assigned_by,
            assigned_to_name: task.assigned_to_name,
            assigned_by_name: task.assigned_by_name,
            scope: task.scope,
            activity: task.activity,
            source: task.source,
            start_date: task.start_date,
            end_date: task.end_date,
            deadline: task.deadline,
            comments: task.comments,
            status: task.status,
            priority: task.priority,
            organisation_id: task.organisation_id,
            completed_at: task.completed_at,
            created_at: task.created_at,
            updated_at: task.updated_at
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
          await ActivityLog.create({
            user_id: log.user_id,
            action: log.action,
            resource_type: log.resource_type,
            resource_id: log.resource_id,
            details: log.details,
            ip_address: log.ip_address,
            user_agent: log.user_agent,
            created_at: log.created_at
          });
          this.stats.activityLogs++;
        } catch (error) {
          // Skip activity log errors to avoid cluttering output
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
          await OrganisationSettings.create({
            organisation_id: setting.organisation_id,
            logo_url: setting.logo_url,
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
            created_at: setting.created_at,
            updated_at: setting.updated_at
          });
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
