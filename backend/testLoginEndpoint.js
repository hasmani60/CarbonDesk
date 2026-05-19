// backend/testLoginEndpoint.js - Direct test of login endpoint
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('./models/User');
const ActivityLog = require('./models/ActivityLog');

const testLogin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const email = 'demo@example.com';
    const password = 'password123';

    console.log('🔐 Testing login flow...\n');
    console.log(`1. Looking up user: ${email}`);

    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      console.log('❌ User not found');
      process.exit(1);
    }

    console.log('✅ User found');
    console.log(`   _id: ${user._id} (${typeof user._id})`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Status: ${user.status}`);
    console.log(`   Org ID: ${user.organisation_id}\n`);

    if (user.status !== 'active') {
      console.log('❌ User is not active');
      process.exit(1);
    }

    console.log('2. Verifying password...');
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    
    if (!isPasswordCorrect) {
      console.log('❌ Password incorrect');
      process.exit(1);
    }

    console.log('✅ Password correct\n');

    console.log('3. Updating last_login...');
    try {
      user.last_login = new Date();
      await user.save();
      console.log('✅ User saved successfully\n');
    } catch (saveError) {
      console.log('❌ Error saving user:');
      console.error(saveError);
      console.log('\n⚠️  This is the problem! User has invalid _id\n');
      process.exit(1);
    }

    console.log('4. Creating activity log...');
    try {
      await ActivityLog.create({
        user_id: user._id.toString(),
        action: 'login',
        resource_type: 'user',
        resource_id: user._id.toString(),
        details: 'User logged in successfully',
        ip_address: '127.0.0.1',
        user_agent: 'Test'
      });
      console.log('✅ Activity log created\n');
    } catch (logError) {
      console.log('⚠️  Activity log failed (non-critical):', logError.message);
    }

    console.log('5. Generating JWT token...');
    const token = jwt.sign(
      { 
        id: user._id.toString(),
        role: user.role,
        organisation_id: user.organisation_id,
        restrictions: user.restrictions
      }, 
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '30d' }
    );
    console.log('✅ Token generated\n');

    console.log('✅ Login flow completed successfully!\n');
    console.log('Response would be:');
    console.log(JSON.stringify({
      success: true,
      data: {
        token,
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          restrictions: user.restrictions,
          organisation_id: user.organisation_id,
          lastLogin: new Date()
        }
      }
    }, null, 2));

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Login test failed:', error);
    process.exit(1);
  }
};

testLogin();
