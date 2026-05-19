/**
 * First-time setup: copies .env.example → .env only if .env does not exist.
 * Run from backend folder: node scripts/init-env-if-missing.js
 */
const fs = require('fs');
const path = require('path');

const backendRoot = path.join(__dirname, '..');
const examplePath = path.join(backendRoot, '.env.example');
const envPath = path.join(backendRoot, '.env');

if (fs.existsSync(envPath)) {
  console.log('OK: backend/.env already exists — not overwriting.');
  console.log('To edit email settings, open backend/.env in a text editor.');
  process.exit(0);
}

if (!fs.existsSync(examplePath)) {
  console.error('Missing backend/.env.example — cannot create .env');
  process.exit(1);
}

fs.copyFileSync(examplePath, envPath);
console.log('Created backend/.env from .env.example');
console.log('Next: open backend/.env and fill in SMTP_USER, SMTP_PASS, and CLIENT_URL.');
console.log('Then run: npm run check-email');
