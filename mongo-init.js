// MongoDB Initialization Script
// This script runs when the MongoDB container first starts

print('========================================');
print('Initializing Carbon Accounting Database');
print('========================================');

// Switch to the carbon_accounting database
db = db.getSiblingDB('carbon_accounting');

// Create collections
db.createCollection('users');
db.createCollection('organisations');
db.createCollection('emissions');
db.createCollection('tasks');
db.createCollection('activitylogs');
db.createCollection('companyoperators');
db.createCollection('organisationsettings');
db.createCollection('maccopportunities');

print('Collections created successfully');

// Create indexes
print('Creating indexes...');

// Users indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ organisation_id: 1 });
db.users.createIndex({ status: 1 });
db.users.createIndex({ role: 1 });

// Organisations indexes
db.organisations.createIndex({ id: 1 }, { unique: true });
db.organisations.createIndex({ is_active: 1 });
db.organisations.createIndex({ subscription_tier: 1 });

// Emissions indexes
db.emissions.createIndex({ organisation_id: 1 });
db.emissions.createIndex({ created_by: 1 });
db.emissions.createIndex({ date: 1 });
db.emissions.createIndex({ scope: 1 });
db.emissions.createIndex({ status: 1 });
db.emissions.createIndex({ organisation_id: 1, date: -1 });

// Tasks indexes
db.tasks.createIndex({ assigned_to: 1 });
db.tasks.createIndex({ organisation_id: 1 });
db.tasks.createIndex({ deadline: 1 });
db.tasks.createIndex({ status: 1 });
db.tasks.createIndex({ assigned_to: 1, status: 1 });

// Activity logs indexes
db.activitylogs.createIndex({ user_id: 1, created_at: -1 });
db.activitylogs.createIndex({ action: 1 });
db.activitylogs.createIndex({ created_at: -1 });

// Company operators indexes
db.companyoperators.createIndex({ email: 1 }, { unique: true });
db.companyoperators.createIndex({ is_active: 1 });

// Organisation settings indexes
db.organisationsettings.createIndex({ organisation_id: 1 }, { unique: true });

// MACC opportunities indexes
db.maccopportunities.createIndex({ organisation_id: 1 });
db.maccopportunities.createIndex({ cost_per_tCO2e: 1 });
db.maccopportunities.createIndex({ scope: 1 });

print('Indexes created successfully');

// Create application user (if needed)
// Note: In production, use separate users with limited permissions
print('Database initialization complete');
print('========================================');
