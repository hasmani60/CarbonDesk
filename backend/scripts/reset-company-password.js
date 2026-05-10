// backend/scripts/reset-company-password.js
// Reset password for existing company operator

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { CompanyOperator } = require('../models');

const resetPassword = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');

    // Find the operator with the hash you mentioned
    const operators = await CompanyOperator.find({});
    
    console.log(`Found ${operators.length} company operator(s):\n`);
    
    operators.forEach((op, index) => {
      console.log(`${index + 1}. Email: ${op.email}`);
      console.log(`   Name: ${op.name}`);
      console.log(`   Role: ${op.role}`);
      console.log(`   Active: ${op.is_active}`);
      console.log('');
    });

    // Reset password for the operator
    // UPDATE THIS EMAIL to match your operator's email
    const operatorEmail = operators[0]?.email; // Will use first operator found
    
    if (!operatorEmail) {
      console.log('✗ No operators found in database');
      process.exit(1);
    }

    console.log(`Resetting password for: ${operatorEmail}`);
    
    // Set new password here
    const newPassword = 'NatureMark@2024';
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    const updated = await CompanyOperator.findOneAndUpdate(
      { email: operatorEmail },
      { 
        password: hashedPassword,
        failed_login_attempts: 0,
        locked_until: null
      },
      { new: true }
    );

    if (updated) {
      console.log('\n✓ Password reset successfully!\n');
      console.log('═══════════════════════════════════════');
      console.log('NEW LOGIN CREDENTIALS:');
      console.log('═══════════════════════════════════════');
      console.log(`Email:    ${updated.email}`);
      console.log(`Password: ${newPassword}`);
      console.log(`Role:     ${updated.role}`);
      console.log('═══════════════════════════════════════');
      console.log('\n⚠ Remember to change this password after login!\n');
    } else {
      console.log('✗ Failed to update password');
    }

    process.exit(0);
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
};

// If you want to reset for a specific email, uncomment and modify:
// const resetPasswordForEmail = async (email) => {
//   try {
//     await mongoose.connect(process.env.MONGODB_URI);
//     
//     const newPassword = 'YourNewPassword123';
//     const hashedPassword = await bcrypt.hash(newPassword, 12);
//     
//     const updated = await CompanyOperator.findOneAndUpdate(
//       { email: email },
//       { password: hashedPassword },
//       { new: true }
//     );
//     
//     console.log('Password reset for:', email);
//     console.log('New password:', newPassword);
//     process.exit(0);
//   } catch (error) {
//     console.error('Error:', error.message);
//     process.exit(1);
//   }
// };
// resetPasswordForEmail('your-email@example.com');

resetPassword();
