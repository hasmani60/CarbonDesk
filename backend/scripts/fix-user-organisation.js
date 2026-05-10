// backend/scripts/fix-user-organisation.js
// Quick script to assign users to an organisation

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');
const Organisation = require('../models/Organisation');

async function fixUserOrganisation() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // 1. Get all organisations
    const orgs = await Organisation.find({ is_active: true }).lean();
    
    if (orgs.length === 0) {
      console.log('❌ NO ORGANISATIONS FOUND!');
      console.log('\nYou need to create an organisation first.');
      console.log('Use the company operations interface or create one manually:\n');
      console.log('Sample organisation creation:');
      console.log('─'.repeat(60));
      console.log(`
const newOrg = await Organisation.create({
  id: "ORG_001",
  name: "My Company",
  display_name: "My Company Ltd",
  industry_type: "Technology",
  contact_email: "admin@mycompany.com",
  is_active: true,
  subscription_tier: "standard",
  max_users: 50
});
      `);
      await mongoose.disconnect();
      return;
    }

    console.log('📋 AVAILABLE ORGANISATIONS:');
    console.log('═'.repeat(60));
    orgs.forEach((org, idx) => {
      console.log(`${idx + 1}. ${org.name}`);
      console.log(`   ID (custom): ${org.id}`);
      console.log(`   _id (MongoDB): ${org._id}`);
      console.log(`   Active: ${org.is_active}`);
      console.log('');
    });

    // 2. Get users without organisation
    const usersWithoutOrg = await User.find({
      $or: [
        { organisation_id: null },
        { organisation_id: { $exists: false } },
        { organisation_id: '' }
      ]
    }).select('name email role').lean();

    console.log('\n👥 USERS WITHOUT ORGANISATION:');
    console.log('═'.repeat(60));
    
    if (usersWithoutOrg.length === 0) {
      console.log('✅ All users have organisations assigned!');
      
      // Check if organisations actually exist
      const allUsers = await User.find({}).select('email organisation_id').lean();
      console.log('\n🔍 VERIFYING USER ORGANISATIONS:');
      console.log('═'.repeat(60));
      
      for (const user of allUsers) {
        const orgExists = orgs.some(o => o.id === user.organisation_id || o._id.toString() === user.organisation_id);
        if (!orgExists) {
          console.log(`❌ ${user.email}: organisation_id "${user.organisation_id}" NOT FOUND!`);
        } else {
          console.log(`✅ ${user.email}: organisation assigned correctly`);
        }
      }
      
      await mongoose.disconnect();
      return;
    }

    console.log(`Found ${usersWithoutOrg.length} user(s) without organisation:\n`);
    usersWithoutOrg.forEach((user, idx) => {
      console.log(`${idx + 1}. ${user.email} (${user.role})`);
    });

    // 3. Assign first organisation to all users without one
    const firstOrg = orgs[0];
    console.log(`\n🔧 ASSIGNING ALL USERS TO: ${firstOrg.name}`);
    console.log('═'.repeat(60));

    const result = await User.updateMany(
      {
        $or: [
          { organisation_id: null },
          { organisation_id: { $exists: false } },
          { organisation_id: '' }
        ]
      },
      {
        $set: { organisation_id: firstOrg.id }
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} user(s)`);
    console.log(`   Organisation ID set to: ${firstOrg.id}`);

    // 4. Verify the fix
    console.log('\n✅ VERIFICATION:');
    console.log('═'.repeat(60));
    const updatedUsers = await User.find({
      organisation_id: firstOrg.id
    }).select('email organisation_id').lean();

    updatedUsers.forEach(user => {
      console.log(`✅ ${user.email} → organisation_id: ${user.organisation_id}`);
    });

    console.log('\n✅ ALL DONE! Users have been assigned to organisation.');
    console.log('   Restart your backend and frontend servers.');

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run if this script is executed directly
if (require.main === module) {
  fixUserOrganisation();
}

module.exports = fixUserOrganisation;
