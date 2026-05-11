const nodemailer = require('nodemailer');
const logger = require('./logger');

function fromAddress() {
  return process.env.FROM_EMAIL || process.env.SMTP_USER || 'noreply@localhost';
}

function fromDisplay() {
  const name = process.env.FROM_NAME || 'Carbon Accounting';
  return `"${name}" <${fromAddress()}>`;
}

class EmailService {
  constructor() {
    this._transporter = null;
  }

  isConfigured() {
    return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
  }

  getTransporter() {
    if (!this.isConfigured()) {
      return null;
    }
    if (!this._transporter) {
      const port = parseInt(String(process.env.SMTP_PORT || '587'), 10);
      const envSecure = process.env.SMTP_SECURE === 'true';
      const secure = envSecure || port === 465;
      const connectionTimeout = parseInt(
        String(process.env.SMTP_CONNECTION_TIMEOUT_MS || '60000'),
        10
      );
      const greetingTimeout = parseInt(
        String(process.env.SMTP_GREETING_TIMEOUT_MS || '30000'),
        10
      );
      const socketTimeout = parseInt(
        String(process.env.SMTP_SOCKET_TIMEOUT_MS || '60000'),
        10
      );

      // Port 587: STARTTLS (secure: false, requireTLS: true). Port 465: implicit TLS (secure: true).
      this._transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port,
        secure,
        requireTLS: !secure && port === 587,
        connectionTimeout,
        greetingTimeout,
        socketTimeout,
        pool: process.env.SMTP_POOL !== 'false',
        maxConnections: parseInt(String(process.env.SMTP_POOL_MAX || '3'), 10),
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        tls: {
          minVersion: 'TLSv1.2'
        }
      });
    }
    return this._transporter;
  }

  async sendMail({ to, subject, html, text }) {
    const tx = this.getTransporter();
    if (!tx) {
      logger.warn('Email skipped: SMTP not configured (SMTP_USER / SMTP_PASS)');
      return { sent: false, reason: 'not_configured' };
    }
    try {
      await tx.sendMail({
        from: fromDisplay(),
        to,
        subject,
        html,
        text: text || undefined
      });
      return { sent: true };
    } catch (error) {
      const port = parseInt(String(process.env.SMTP_PORT || '587'), 10);
      logger.error('Email send failed', {
        err: error.message,
        to,
        smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
        smtpPort: port,
        hint:
          error.code === 'ETIMEDOUT' || String(error.message).includes('timeout')
            ? 'SMTP connection timed out. On Render/hosted VPS, try longer SMTP_*_TIMEOUT_MS, confirm SMTP_HOST/PORT match your provider (587+STARTTLS vs 465+SSL), use an app-specific password for Gmail, or switch to SendGrid/Resend SMTP.'
            : undefined
      });
      return { sent: false, reason: error.message };
    }
  }

  /**
   * @param {object} user - { name, email }
   * @param {string} rawToken - single-use token (only in email, not stored verbatim)
   */
  async sendVerificationEmail(user, rawToken) {
    const base =
      process.env.CLIENT_URL?.replace(/\/$/, '') || 'http://localhost:5173';
    const link = `${base}/verify-email?token=${encodeURIComponent(rawToken)}`;

    const subject = 'Verify your email address';
    const html = `
      <p>Hello ${escapeHtml(user.name || 'there')},</p>
      <p>Please confirm your email address for your Carbon Accounting account.</p>
      <p><a href="${link}">Verify email</a></p>
      <p style="color:#666;font-size:12px">This link expires in 24 hours. If you did not create an account, you can ignore this message.</p>
    `;
    const text = `Verify your email: ${link}`;

    return this.sendMail({ to: user.email, subject, html, text });
  }

  async sendPasswordResetEmail(user, rawToken) {
    const base =
      process.env.CLIENT_URL?.replace(/\/$/, '') || 'http://localhost:5173';
    const link = `${base}/reset-password?token=${encodeURIComponent(rawToken)}`;

    const subject = 'Reset your password';
    const html = `
      <p>Hello ${escapeHtml(user.name || 'there')},</p>
      <p>We received a request to reset your password for your Carbon Accounting account.</p>
      <p><a href="${link}">Choose a new password</a></p>
      <p style="color:#666;font-size:12px">This link expires in one hour. If you did not request this, ignore this email.</p>
    `;
    const text = `Reset your password: ${link}`;

    return this.sendMail({ to: user.email, subject, html, text });
  }

  /**
   * Sent after user changes password while logged in (Settings → Security).
   * Always sent when SMTP is configured (security alert; not gated by notification toggles).
   */
  async sendPasswordChangedConfirmation(user, meta = {}) {
    const base =
      process.env.CLIENT_URL?.replace(/\/$/, '') || 'http://localhost:5173';
    const loginUrl = `${base}/login`;
    const ip = meta.ip ? escapeHtml(String(meta.ip)) : 'unknown';
    const subject = 'Your password was changed';
    const html = `
      <p>Hello ${escapeHtml(user.name || 'there')},</p>
      <p>This confirms that the password for your Carbon Accounting account was just changed.</p>
      <p style="color:#666;font-size:13px">If you made this change, you can ignore this email.</p>
      <p style="color:#666;font-size:13px">If you did <strong>not</strong> change your password, contact your organisation administrator immediately.</p>
      <p style="color:#666;font-size:12px">Request IP: ${ip} · <a href="${loginUrl}">Sign in</a></p>
    `;
    const text = `Your Carbon Accounting password was changed. If this was not you, contact your administrator. Sign in: ${loginUrl}`;

    return this.sendMail({ to: user.email, subject, html, text });
  }

  async sendWelcomeEmail(user) {
    return this.sendMail({
      to: user.email,
      subject: 'Welcome to Carbon Accounting',
      html: `<p>Hello ${escapeHtml(user.name || 'there')},</p><p>Your account has been created.</p>`
    });
  }

  /**
   * Optional: high-level events (verify integration in production with queue/worker).
   */
  async sendNotificationEmail(to, { subject, html, text }) {
    if (process.env.ENABLE_EMAIL_NOTIFICATIONS !== 'true') {
      return { sent: false, reason: 'feature_disabled' };
    }
    return this.sendMail({ to, subject, html, text });
  }
}

function escapeHtml(s) {
  if (!s || typeof s !== 'string') return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = new EmailService();
