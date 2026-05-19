// backend/testLogin.js - Test login directly
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('./models/User');

const testLogin = async () => {
  try {
    console.log('🔐 Testing login...\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const email = 'demo@example.com';
    const password = 'demo123'; // Try common passwords

    console.log(`Attempting login with: ${email}`);
    console.log(`Password: ${password}\n`);

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      console.log('❌ User not found');
      console.log('\nTry these other emails:');
      const allUsers = await User.find({}).select('email');
      allUsers.forEach(u => console.log(`   - ${u.email}`));
      process.exit(1);
    }

    console.log('✅ User found:', user.email);
    console.log('   Name:', user.name);
    console.log('   Role:', user.role);
    console.log('   Status:', user.status);
    console.log('   Organisation ID:', user.organisation_id);

    // Check password
    console.log('\n🔑 Testing common passwords...');
    const testPasswords = ['demo123', 'Demo123', 'password', 'admin123', '123456'];
    
    for (const testPass of testPasswords) {
      try {
        const isMatch = await bcrypt.compare(testPass, user.password);
        if (isMatch) {
          console.log(`✅ PASSWORD FOUND: "${testPass}"`);
          console.log(`\n📋 Login with:`);
          console.log(`   Email: ${user.email}`);
          console.log(`   Password: ${testPass}\n`);
          process.exit(0);
        }
      } catch (e) {
        // Continue
      }
    }

    console.log('❌ None of the common passwords worked');
    console.log('\nYou need to reset the password. Run this in MongoDB:');
    console.log(`\ndb.users.updateOne(`);
    console.log(`  { email: "${email}" },`);
    console.log(`  { $set: { password: "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYzpLHJ.5pe" } }`);
    console.log(`);\n`);
    console.log('This sets password to: "password123"\n');

    process.exit(1);

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
};

testLogin();
