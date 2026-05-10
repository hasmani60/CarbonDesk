/**
 * Create the first company operator (MongoDB) so you can use /company-portal.
 * Run on your machine or on Render Shell after deploy:
 *   cd backend && node scripts/create-company-operator.js
 *
 * Optional env (else uses defaults):
 *   COMPANY_OPERATOR_EMAIL
 *   COMPANY_OPERATOR_PASSWORD
 *   COMPANY_OPERATOR_NAME
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { CompanyOperator } = require('../models');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set.');
    process.exit(1);
  }

  const email = (
    process.env.COMPANY_OPERATOR_EMAIL || 'admin@carbontrack-company.com'
  ).toLowerCase().trim();
  const password = process.env.COMPANY_OPERATOR_PASSWORD || 'ChangeThisPassword!';
  const name = process.env.COMPANY_OPERATOR_NAME || 'Company Administrator';

  await mongoose.connect(uri);

  const existing = await CompanyOperator.findOne({ email });
  if (existing) {
    console.log(`Company operator already exists: ${email}`);
    console.log('To reset password, use: node scripts/reset-company-password.js');
    await mongoose.disconnect();
    process.exit(0);
  }

  const salt = await bcrypt.genSalt(12);
  const hashed = await bcrypt.hash(password, salt);

  await CompanyOperator.create({
    name,
    email,
    password: hashed,
    role: 'super_operator',
    can_create_orgs: true,
    can_manage_orgs: true,
    can_view_all_orgs: true,
    is_active: true,
    notes: 'Created by create-company-operator.js — change password after first login'
  });

  console.log('\n✅ Company operator created');
  console.log('   Email:', email);
  console.log('   Password: (what you set in COMPANY_OPERATOR_PASSWORD, or default above)');
  console.log('\n⚠️  Change the password after first login. Do NOT commit passwords to git.\n');

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
