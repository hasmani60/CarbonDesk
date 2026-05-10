// backend/resetPassword.js - Reset user password
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('./models/User');

const resetPassword = async () => {
  try {
    const email = process.argv[2] || 'demo@example.com';
    const newPassword = process.argv[3] || 'password123';

    console.log('🔐 Resetting password...\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      console.log(`❌ User not found: ${email}`);
      console.log('\nAvailable users:');
      const allUsers = await User.find({}).select('email role');
      allUsers.forEach(u => console.log(`   - ${u.email} (${u.role})`));
      process.exit(1);
    }

    console.log(`👤 User: ${user.name} (${user.email})`);
    console.log(`🔑 New password: ${newPassword}\n`);

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;
    await user.save();

    console.log('✅ Password reset successfully!\n');
    console.log('📋 Login credentials:');
    console.log(`   Email: ${user.email}`);
    console.log(`   Password: ${newPassword}\n`);

    process.exit(0);

  } catch (error) {
    console.error('❌ Reset failed:', error);
    process.exit(1);
  }
};

console.log('\nUsage: node resetPassword.js [email] [newPassword]\n');
console.log('Example: node resetPassword.js demo@example.com myNewPass123\n');

resetPassword();
