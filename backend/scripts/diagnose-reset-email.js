/**
 * Run where your backend env is loaded (e.g. Render Shell or locally with .env).
 * Prints SMTP status, verifies connection, optionally looks up Mongo user & sends ONE reset template.
 *
 *   cd backend
 *   node scripts/diagnose-reset-email.js                    # SMTP + CLIENT_URL check only
 *   node scripts/diagnose-reset-email.js you@gmail.com       # also DB lookup + sends reset email test
 *
 * Secrets are not printed.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const emailService = require('../utils/emailService');
const { User } = require('../models');

async function verifySmtp() {
  console.log('\n--- SMTP ---');
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = process.env.SMTP_PORT || '587';
  console.log(`Host: ${host}  Port: ${port}`);
  console.log(`SMTP_USER set: ${!!process.env.SMTP_USER}`);
  console.log(`SMTP_PASS set: ${!!process.env.SMTP_PASS}`);
  console.log(`FROM_EMAIL: ${process.env.FROM_EMAIL || '(not set — falls back to SMTP_USER)'}`);
  console.log(`CLIENT_URL: ${process.env.CLIENT_URL || '(not set — links default to localhost)'}`);

  if (!emailService.isConfigured()) {
    console.log('\n✖ Email cannot send: set SMTP_USER and SMTP_PASS on this environment (e.g. Render).\n');
    return false;
  }

  try {
    const tx = emailService.getTransporter();
    await tx.verify();
    console.log('\n✔ SMTP handshake OK (credentials accepted by mail server).\n');
    return true;
  } catch (e) {
    console.error('\n✖ SMTP verify failed:', e.message);
    console.log(
      '\nTips: Gmail needs an App Password; special characters in passwords may need quoting in Render; FROM_EMAIL usually must match SMTP_USER unless you configured "Send mail as".\n'
    );
    return false;
  }
}

async function tryUser(email) {
  console.log('\n--- MongoDB user lookup ---');
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log('✖ MONGODB_URI not set — cannot check user.');
    return;
  }

  await mongoose.connect(uri);
  const user = await User.findOne({ email: email.toLowerCase().trim() });

  if (!user) {
    console.log(`✖ No User document found for "${email}".`);
    console.log(
      '  Forgot-password only sends to accounts in this database (not company-portal operators).'
    );
    await mongoose.disconnect();
    return;
  }

  console.log(`✔ User found: ${user.email}, status="${user.status}"`);

  if (user.status !== 'active') {
    console.log(
      '✖ status is not "active" — forgot-password intentionally does NOT send mail.'
    );
    await mongoose.disconnect();
    return;
  }

  const crypto = require('crypto');
  const fakeToken = crypto.randomBytes(16).toString('hex');
  console.log('\n--- Sending ONE test reset-style email ---');
  const r = await emailService.sendPasswordResetEmail(
    { name: user.name, email: user.email },
    fakeToken
  );

  if (r.sent) {
    console.log('✔ Accepted by SMTP. Check inbox + Spam for subject "Reset your password".');
    console.log(`  (Link uses token starting ${fakeToken.slice(0, 6)}… — it is a test, do not use.)\n`);
  } else {
    console.error('✖ Send failed:', r.reason);
  }

  await mongoose.disconnect();
}

async function main() {
  const email = process.argv[2];

  const smtpOk = await verifySmtp();
  if (!email) {
    if (!smtpOk) process.exit(1);
    process.exit(0);
  }

  if (!smtpOk) {
    process.exit(1);
  }

  await tryUser(email);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
