// backend/checkUsers.js - Check existing users in database
require('dotenv').config();
const mongoose = require('mongoose');

const User = require('./models/User');
const Organisation = require('./models/Organisation');

const checkUsers = async () => {
  try {
    console.log('🔍 Checking database...\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Count users
    const userCount = await User.countDocuments();
    console.log(`📊 Total users: ${userCount}`);

    if (userCount === 0) {
      console.log('\n⚠️  No users found in database!');
      console.log('Run: node seedDatabase.js to create admin user\n');
      process.exit(0);
    }

    // Get all users
    const users = await User.find({}).select('-password').limit(10);
    
    console.log('\n👥 Users in database:');
    console.log('─'.repeat(80));
    
    users.forEach((user, index) => {
      console.log(`\n${index + 1}. ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Status: ${user.status}`);
      console.log(`   Organisation ID: ${user.organisation_id || 'NOT SET'}`);
      console.log(`   Created: ${user.created_at}`);
    });

    // Count organisations
    const orgCount = await Organisation.countDocuments();
    console.log('\n─'.repeat(80));
    console.log(`📦 Total organisations: ${orgCount}`);

    if (orgCount > 0) {
      const orgs = await Organisation.find({}).limit(5);
      console.log('\n🏢 Organisations:');
      orgs.forEach((org, index) => {
        console.log(`   ${index + 1}. ${org.display_name} (${org.id})`);
      });
    }

    console.log('\n✅ Database check complete!\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Check failed:', error);
    process.exit(1);
  }
};

checkUsers();
