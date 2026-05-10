// backend/scripts/debug-org-mismatch.js
// Check for ID mismatches between users and organisations

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const Organisation = require('../models/Organisation');

async function debugOrgMismatch() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all organisations
    const orgs = await Organisation.find({}).lean();
    console.log('📋 ORGANISATIONS IN DATABASE:');
    console.log('═'.repeat(70));
    orgs.forEach(org => {
      console.log(`Name: ${org.name}`);
      console.log(`  Custom id field: ${org.id}`);
      console.log(`  MongoDB _id:     ${org._id}`);
      console.log('');
    });

    // Get all users
    const users = await User.find({}).select('email organisation_id').lean();
    console.log('\n👥 USERS AND THEIR ORGANISATION_ID VALUES:');
    console.log('═'.repeat(70));
    
    for (const user of users) {
      console.log(`Email: ${user.email}`);
      console.log(`  organisation_id: ${user.organisation_id}`);
      
      // Try to find matching org by custom id
      const orgByCustomId = orgs.find(o => o.id === user.organisation_id);
      
      // Try to find matching org by MongoDB _id
      const orgByMongoId = orgs.find(o => o._id.toString() === user.organisation_id);
      
      if (orgByCustomId) {
        console.log(`  ✅ MATCH: Found by custom 'id' field → ${orgByCustomId.name}`);
      } else if (orgByMongoId) {
        console.log(`  ✅ MATCH: Found by MongoDB '_id' field → ${orgByMongoId.name}`);
      } else {
        console.log(`  ❌ NO MATCH: Organisation not found!`);
        console.log(`  🔧 FIX NEEDED: User's organisation_id doesn't match any org`);
        
        if (orgs.length > 0) {
          console.log(`  💡 Suggestion: Update to "${orgs[0].id}"`);
        }
      }
      console.log('');
    }

    // Show the fix command if mismatches exist
    console.log('\n🔧 FIX COMMANDS (if needed):');
    console.log('═'.repeat(70));
    
    const validOrgIds = [...new Set(orgs.flatMap(o => [o.id, o._id.toString()]))];
    console.log('Valid organisation IDs (custom id OR _id):');
    validOrgIds.forEach(id => console.log(`  - ${id}`));
    
    console.log('\nTo fix users with invalid organisation_id:');
    console.log('─'.repeat(70));
    console.log(`db.users.updateMany(`);
    console.log(`  { organisation_id: { $nin: ${JSON.stringify(validOrgIds)} } },`);
    console.log(`  { $set: { organisation_id: "${orgs[0]?.id || 'ORG_ID_HERE'}" } }`);
    console.log(`)`);

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  debugOrgMismatch();
}

module.exports = debugOrgMismatch;
