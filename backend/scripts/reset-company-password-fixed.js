// backend/scripts/reset-company-password-fixed.js
// Reset password for existing company operator - FIXED for correct collection name

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const resetPassword = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');

    // Access the collection directly by name
    const db = mongoose.connection.db;
    const collection = db.collection('company_operators'); // Note the underscore!

    // Find all operators
    const operators = await collection.find({}).toArray();
    
    console.log(`Found ${operators.length} company operator(s):\n`);
    
    if (operators.length === 0) {
      console.log('✗ No operators found in database');
      console.log('Checking other possible collection names...\n');
      
      // Try alternative names
      const collections = await db.listCollections().toArray();
      console.log('Available collections:');
      collections.forEach(col => console.log('  -', col.name));
      
      process.exit(1);
    }

    operators.forEach((op, index) => {
      console.log(`${index + 1}. Email: ${op.email}`);
      console.log(`   Name: ${op.name}`);
      console.log(`   Role: ${op.role}`);
      console.log(`   Active: ${op.is_active}`);
      console.log('');
    });

    // Use the email from your screenshot
    const operatorEmail = 'admin@carbontrack-company.com';
    
    console.log(`Resetting password for: ${operatorEmail}`);
    
    // Set new password
    const newPassword = 'NatureMark@2024';
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    const result = await collection.updateOne(
      { email: operatorEmail },
      { 
        $set: {
          password: hashedPassword,
          failed_login_attempts: 0,
          locked_until: null,
          updated_at: new Date()
        }
      }
    );

    if (result.modifiedCount > 0) {
      console.log('\n✓ Password reset successfully!\n');
      console.log('═══════════════════════════════════════');
      console.log('NEW LOGIN CREDENTIALS:');
      console.log('═══════════════════════════════════════');
      console.log(`Email:    ${operatorEmail}`);
      console.log(`Password: ${newPassword}`);
      console.log(`Role:     super_operator`);
      console.log('═══════════════════════════════════════');
      console.log('\n⚠ Remember to change this password after login!\n');
    } else {
      console.log('\n✗ No operator found with that email');
      console.log('Available operators:');
      operators.forEach(op => console.log('  -', op.email));
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('✗ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
};

resetPassword();
