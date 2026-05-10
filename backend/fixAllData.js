// backend/fixAllData.js - Comprehensive fix for all database issues
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const fixAllData = async () => {
  try {
    console.log('🔧 Comprehensive Database Fix\n');
    console.log('=' .repeat(80));
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;

    // Step 1: Fix/Drop ActivityLogs
    console.log('STEP 1: Fixing ActivityLogs');
    console.log('-'.repeat(80));
    try {
      await db.collection('activitylogs').drop();
      console.log('✅ ActivityLogs collection dropped (will be recreated)\n');
    } catch (e) {
      console.log('ℹ️  ActivityLogs collection does not exist yet\n');
    }

    // Step 2: Fix Organisations
    console.log('STEP 2: Fixing Organisations');
    console.log('-'.repeat(80));
    const orgsCollection = db.collection('organisations');
    const orgs = await orgsCollection.find({}).toArray();
    
    if (orgs.length > 0) {
      for (const org of orgs) {
        if (!org.id || org.id === 'undefined') {
          const newId = `org_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await orgsCollection.updateOne(
            { _id: org._id },
            { $set: { id: newId } }
          );
          console.log(`✅ Fixed organisation: ${org.display_name || org.name} → ${newId}`);
        }
      }
    }
    console.log('✅ Organisations fixed\n');

    // Step 3: Fix Users (the critical one)
    console.log('STEP 3: Fixing Users');
    console.log('-'.repeat(80));
    const usersCollection = db.collection('users');
    const oldUsers = await usersCollection.find({}).toArray();
    
    console.log(`Found ${oldUsers.length} users\n`);
    
    const hasNumericIds = oldUsers.some(u => typeof u._id === 'number');
    
    if (hasNumericIds) {
      console.log('⚠️  Users have numeric IDs - recreating with ObjectIds...\n');
      
      // Drop collection
      await usersCollection.drop();
      console.log('✅ Dropped users collection\n');
      
      // Recreate with Mongoose
      const User = require('./models/User');
      const hashedPassword = await bcrypt.hash('password123', 12);
      
      // Get first org ID
      const firstOrg = await orgsCollection.findOne({});
      const defaultOrgId = firstOrg ? firstOrg.id : 'org_default_001';
      
      console.log('Creating users with proper ObjectIds:\n');
      
      for (const oldUser of oldUsers) {
        const newUser = await User.create({
          name: oldUser.name,
          email: oldUser.email,
          password: hashedPassword,
          role: oldUser.role,
          status: oldUser.status || 'active',
          organisation_id: oldUser.organisation_id || defaultOrgId,
          restrictions: oldUser.restrictions || null
        });
        
        console.log(`✅ ${newUser.email}`);
        console.log(`   Old ID: ${oldUser._id} (${typeof oldUser._id})`);
        console.log(`   New ID: ${newUser._id} (ObjectId)`);
        console.log(`   Password: password123\n`);
      }
    } else {
      console.log('✅ Users already have valid ObjectIds\n');
      
      // Just reset passwords
      console.log('Resetting all passwords to: password123\n');
      const hashedPassword = await bcrypt.hash('password123', 12);
      
      for (const user of oldUsers) {
        await usersCollection.updateOne(
          { _id: user._id },
          { $set: { password: hashedPassword } }
        );
        console.log(`✅ ${user.email} - password reset`);
      }
      console.log();
    }

    // Step 4: Clean up other collections with numeric IDs
    console.log('\nSTEP 4: Checking other collections');
    console.log('-'.repeat(80));
    
    const collectionsToCheck = ['emissions', 'tasks', 'maccOpportunities'];
    
    for (const collName of collectionsToCheck) {
      try {
        const coll = db.collection(collName);
        const sample = await coll.findOne({});
        
        if (sample && typeof sample._id === 'number') {
          console.log(`⚠️  ${collName} has numeric IDs - dropping collection`);
          await coll.drop();
          console.log(`✅ ${collName} dropped (will be recreated)`);
        } else if (sample) {
          console.log(`✅ ${collName} has valid ObjectIds`);
        } else {
          console.log(`ℹ️  ${collName} is empty or doesn't exist`);
        }
      } catch (e) {
        console.log(`ℹ️  ${collName} doesn't exist`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ DATABASE FIXED SUCCESSFULLY!\n');
    console.log('📋 Login credentials:');
    console.log('   Email: demo@example.com');
    console.log('   Password: password123\n');
    console.log('⚠️  Restart your backend server now!\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Fix failed:', error);
    process.exit(1);
  }
};

fixAllData();
