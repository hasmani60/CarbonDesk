// test-mongo-connection.js
// Run this to test if MongoDB connection works
// Usage: node test-mongo-connection.js

const mongoose = require('mongoose');
require('dotenv').config();

console.log('🧪 Testing MongoDB Connection...\n');
console.log('📡 Connection String:', process.env.MONGODB_URI ? '✅ Found in .env' : '❌ NOT FOUND in .env');

if (!process.env.MONGODB_URI) {
  console.error('\n❌ MONGODB_URI not found in .env file!');
  console.error('Add this to your backend/.env file:');
  console.error('MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database');
  process.exit(1);
}

const testConnection = async () => {
  try {
    console.log('\n⏳ Connecting to MongoDB...');
    
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000 // 5 second timeout
    });
    
    console.log('✅ MongoDB connection SUCCESSFUL!\n');
    console.log('📊 Database:', mongoose.connection.db.databaseName);
    console.log('🌐 Host:', mongoose.connection.host);
    console.log('🔌 Connection State:', mongoose.connection.readyState === 1 ? 'Connected' : 'Not Connected');
    
    // List collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`\n📂 Collections (${collections.length}):`);
    collections.forEach(col => console.log(`   - ${col.name}`));
    
    // Test a simple query
    console.log('\n🧪 Testing query...');
    const Emission = require('./models/Emission');
    const count = await Emission.countDocuments();
    console.log(`✅ Found ${count} emission documents`);
    
    console.log('\n🎉 All tests passed! MongoDB is working correctly.\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ MongoDB connection FAILED!\n');
    console.error('Error:', error.message);
    
    if (error.message.includes('ENOTFOUND')) {
      console.error('\n💡 Possible causes:');
      console.error('   1. Wrong connection string');
      console.error('   2. MongoDB cluster is paused');
      console.error('   3. DNS issue');
    }
    
    if (error.message.includes('Authentication failed')) {
      console.error('\n💡 Possible causes:');
      console.error('   1. Wrong username or password');
      console.error('   2. Password contains special characters (needs URL encoding)');
      console.error('   3. Database user not created');
    }
    
    if (error.message.includes('timed out')) {
      console.error('\n💡 Possible causes:');
      console.error('   1. IP address not whitelisted in MongoDB Atlas');
      console.error('   2. Firewall blocking connection');
      console.error('   3. Network connectivity issue');
    }
    
    console.error('\n📚 See MONGODB_CONNECTION_FIX.md for detailed troubleshooting\n');
    
    process.exit(1);
  }
};

testConnection();
