/**
 * Sends one test message via Resend API (if RESEND_API_KEY) or SMTP.
 * Does not print your password.
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
  console.log('\n=== Email test send ===\n');

  if (!emailService.isConfigured()) {
    console.error(
      'No email transport: set RESEND_API_KEY (+ RESEND_FROM / FROM_EMAIL) or SMTP_USER / SMTP_PASS in backend/.env\n'
    );
    process.exit(1);
  }

  const to =
    process.env.TEST_EMAIL_TO ||
    process.env.SMTP_USER ||
    process.env.FROM_EMAIL;
  if (!to) {
    console.error(
      'No recipient: set TEST_EMAIL_TO, SMTP_USER, or FROM_EMAIL in .env\n'
    );
    process.exit(1);
  }

  console.log('Sending test email to:', to);
  if (process.env.RESEND_API_KEY) {
    console.log('Using Resend API (HTTPS)');
  } else {
    console.log('Using SMTP host:', process.env.SMTP_HOST || 'smtp.gmail.com');
  }

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
    '\nCommon fixes: On Render free tier use RESEND_API_KEY (SMTP is blocked). Else: Gmail App Password,' +
      ' correct SMTP_HOST/port, verified From domain.\n'
  );
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
