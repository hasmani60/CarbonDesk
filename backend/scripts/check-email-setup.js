/**
 * Checks that email / verification related env vars are set (does not print secrets).
 * Run from backend folder: npm run check-email
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const issues = [];
const ok = [];

function check(name, value, optional = false) {
  const set = value !== undefined && value !== null && String(value).trim() !== '';
  const placeholder =
    set &&
    /your-|change-in-production|example\.com|@localhost|your-email@gmail.com|noreply@your-domain/i.test(
      String(value)
    );

  if (!set && !optional) {
    issues.push(`  ✖ ${name} is missing or empty`);
  } else if (placeholder) {
    issues.push(`  ✖ ${name} still looks like a placeholder — replace with your real value`);
  } else if (set) {
    ok.push(`  ✔ ${name} is set`);
  }
}

console.log('\n=== Email & verification configuration check ===\n');

check('SMTP_HOST', process.env.SMTP_HOST);
check('SMTP_PORT', process.env.SMTP_PORT);
check('SMTP_USER', process.env.SMTP_USER);
check('SMTP_PASS', process.env.SMTP_PASS);
check('FROM_EMAIL', process.env.FROM_EMAIL);
check('CLIENT_URL', process.env.CLIENT_URL);

if (process.env.FROM_NAME && String(process.env.FROM_NAME).trim()) {
  ok.push('  ✔ FROM_NAME is set');
} else {
  console.log('\n(Optional) Add FROM_NAME in .env for a nicer sender name.');
}

// Feature flags — informational
const flags = [
  ['ENABLE_EMAIL_NOTIFICATIONS', process.env.ENABLE_EMAIL_NOTIFICATIONS],
  ['EMAIL_VERIFICATION_ON_REGISTER', process.env.EMAIL_VERIFICATION_ON_REGISTER],
  ['REQUIRE_EMAIL_VERIFICATION', process.env.REQUIRE_EMAIL_VERIFICATION]
];
console.log('\nFeature flags (true/false):');
flags.forEach(([k, v]) => {
  console.log(`  ${k}=${v === undefined || v === '' ? '(not set / off)' : v}`);
});

if (ok.length) {
  console.log('\nLooks good:');
  ok.forEach((l) => console.log(l));
}

if (issues.length) {
  console.log('\nFix these in backend/.env:');
  issues.forEach((l) => console.log(l));
}

const emailService = require('../utils/emailService');
const configured = emailService.isConfigured();

console.log('\nNodemailer will send mail:', configured ? 'YES (credentials present)' : 'NO (set SMTP_USER and SMTP_PASS)');

if (issues.length || !configured) {
  console.log('\n→ After editing backend/.env, restart the backend (stop and run npm start again).');
  console.log('→ Run this check again: npm run check-email\n');
  process.exit(issues.length ? 1 : 0);
}

console.log('\nAll required variables look set. Test by registering a user or using request-verification-email.\n');
process.exit(0);
