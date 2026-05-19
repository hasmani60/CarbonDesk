// backend/migrateUsers.js - Add organisation_id to existing users
require('dotenv').config();
const mongoose = require('mongoose');

const User = require('./models/User');
const Organisation = require('./models/Organisation');

const migrateUsers = async () => {
  try {
    console.log('🔄 Starting user migration...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find users without organisation_id
    const usersWithoutOrg = await User.find({
      $or: [
        { organisation_id: { $exists: false } },
        { organisation_id: null },
        { organisation_id: '' }
      ]
    });

    console.log(`📊 Found ${usersWithoutOrg.length} users without organisation_id`);

    if (usersWithoutOrg.length === 0) {
      console.log('✅ All users already have organisation_id');
      process.exit(0);
    }

    // Get or create default organization
    let defaultOrg = await Organisation.findOne({});
    
    if (!defaultOrg) {
      console.log('📦 Creating default organization...');
      const orgId = 'org_default_001';
      defaultOrg = await Organisation.create({
        id: orgId,
        name: 'default',
        display_name: 'Default Organization',
        industry_type: 'General',
        location: 'Not specified',
        contact_email: 'admin@example.com',
        registered_address: 'Not specified',
        is_active: true,
        subscription_tier: 'standard',
        max_users: 50,
        max_storage_gb: 10,
        created_at: new Date(),
        created_by: 'migration_script'
      });
      console.log('✅ Default organization created:', defaultOrg.id);
    } else {
      console.log('✅ Using existing organization:', defaultOrg.id);
    }

    // Update all users without organisation_id
    console.log(`🔄 Updating ${usersWithoutOrg.length} users...`);
    
    const result = await User.updateMany(
      {
        $or: [
          { organisation_id: { $exists: false } },
          { organisation_id: null },
          { organisation_id: '' }
        ]
      },
      {
        $set: { organisation_id: defaultOrg.id }
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} users`);
    console.log(`   All users now assigned to: ${defaultOrg.id}`);

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

migrateUsers();
