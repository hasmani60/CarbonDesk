// backend/fixOrganisation.js - Fix organisation with undefined id
require('dotenv').config();
const mongoose = require('mongoose');

const fixOrganisation = async () => {
  try {
    console.log('🏢 Fixing organisation...\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const orgsCollection = db.collection('organisations');
    
    // Get organisation with undefined id
    const org = await orgsCollection.findOne({ id: null });
    
    if (!org && await orgsCollection.findOne({ id: { $exists: true, $ne: null } })) {
      console.log('✅ Organisation already has valid ID');
      const validOrg = await orgsCollection.findOne({});
      console.log(`   ID: ${validOrg.id}`);
      console.log(`   Name: ${validOrg.display_name || validOrg.name}\n`);
      process.exit(0);
    }

    const orgWithoutId = await orgsCollection.findOne({});
    
    if (!orgWithoutId) {
      console.log('❌ No organisation found');
      process.exit(1);
    }

    console.log('Current organisation:');
    console.log(`   Name: ${orgWithoutId.display_name || orgWithoutId.name}`);
    console.log(`   ID: ${orgWithoutId.id}\n`);

    // Generate new ID
    const newId = orgWithoutId.id || `org_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`Setting ID to: ${newId}\n`);

    // Update organisation
    await orgsCollection.updateOne(
      { _id: orgWithoutId._id },
      { $set: { id: newId } }
    );

    console.log('✅ Organisation fixed!\n');

    // Update all users to use this org ID
    const usersCollection = db.collection('users');
    const result = await usersCollection.updateMany(
      { organisation_id: { $in: [null, undefined, '', 'undefined'] } },
      { $set: { organisation_id: newId } }
    );

    console.log(`✅ Updated ${result.modifiedCount} users with organisation ID\n`);

    process.exit(0);

  } catch (error) {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  }
};

fixOrganisation();
