require('dotenv').config();
const mongoose = require('mongoose');
const models = require('./models');

console.log('Testing MongoDB models...\n');

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    console.log('✅ Models loaded:', Object.keys(models).join(', '));
    mongoose.disconnect();
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });