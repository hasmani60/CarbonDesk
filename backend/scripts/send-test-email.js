/**
 * Sends one test message to verify SMTP. Does not print your password.
 *
 * Usage (from backend folder):
 *   npm run test-email
 *
 * Optional: send to a different inbox
 *   TEST_EMAIL_TO=friend@example.com npm run test-email
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const emailService = require('../utils/emailService');

async function main() {
  console.log('\n=== SMTP test send ===\n');

  if (!emailService.isConfigured()) {
    console.error('SMTP_USER / SMTP_PASS are not set in backend/.env\n');
    process.exit(1);
  }

  const to = process.env.TEST_EMAIL_TO || process.env.SMTP_USER;
  if (!to) {
    console.error('No recipient: set SMTP_USER or TEST_EMAIL_TO in .env\n');
    process.exit(1);
  }

  console.log('Sending test email to:', to);
  console.log('Using SMTP host:', process.env.SMTP_HOST || 'smtp.gmail.com');

  const result = await emailService.sendMail({
    to,
    subject: 'Carbon Accounting — SMTP test',
    html: '<p>If you received this message, your email setup works.</p><p>You can delete this email.</p>',
    text: 'If you received this message, your email setup works.'
  });

  if (result.sent) {
    console.log('\nSuccess — check the inbox for', to, '(and Spam/Junk folder).\n');
    process.exit(0);
  }

  console.error('\nSend failed:', result.reason || 'unknown');
  console.error(
    '\nCommon fixes: Gmail needs an App Password (not your normal password),' +
      ' SMTP_HOST/port match your provider, and FROM_EMAIL is allowed.\n'
  );
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
