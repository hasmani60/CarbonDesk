// backend/fixUserIds.js - Fix numeric IDs to MongoDB ObjectIds
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const connectDB = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');
};

const fixUsers = async () => {
  try {
    console.log('🔧 Fixing user IDs...\n');
    await connectDB();

    // Get the raw collection (bypass Mongoose validation)
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    
    // Get all users
    const oldUsers = await usersCollection.find({}).toArray();
    console.log(`📊 Found ${oldUsers.length} users with numeric IDs\n`);

    if (oldUsers.length === 0) {
      console.log('No users to fix');
      process.exit(0);
    }

    // Show current users
    console.log('Current users:');
    oldUsers.forEach(user => {
      console.log(`   - ${user.email} (ID: ${user._id}, Type: ${typeof user._id})`);
    });

    console.log('\n⚠️  This will:');
    console.log('   1. Delete all existing users');
    console.log('   2. Recreate them with proper MongoDB ObjectIds');
    console.log('   3. Set password to "password123" for all users\n');

    // Drop the entire users collection
    console.log('🗑️  Dropping users collection...');
    await usersCollection.drop();
    console.log('✅ Collection dropped\n');

    // Now use Mongoose to recreate users properly
    const User = require('./models/User');
    const hashedPassword = await bcrypt.hash('password123', 12);

    console.log('👥 Recreating users with proper IDs...\n');

    for (const oldUser of oldUsers) {
      const newUser = await User.create({
        name: oldUser.name,
        email: oldUser.email,
        password: hashedPassword, // Reset all passwords
        role: oldUser.role,
        status: oldUser.status || 'active',
        organisation_id: oldUser.organisation_id || '',
        restrictions: oldUser.restrictions || null,
        created_at: oldUser.created_at || new Date()
      });

      console.log(`✅ Created: ${newUser.email}`);
      console.log(`   Old ID: ${oldUser._id} (${typeof oldUser._id})`);
      console.log(`   New ID: ${newUser._id} (ObjectId)`);
      console.log(`   Password: password123\n`);
    }

    console.log('✅ All users fixed!\n');
    console.log('📋 You can now login with:');
    console.log('   Email: demo@example.com');
    console.log('   Password: password123\n');
    console.log('⚠️  Or any other user email with password: password123\n');

    process.exit(0);

  } catch (error) {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  }
};

fixUsers();
