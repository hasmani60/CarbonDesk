const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  async sendWelcomeEmail(user) {
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: user.email,
      subject: 'Welcome to Carbon Accounting',
      html: `<h1>Welcome ${user.name}!</h1><p>Your account has been created.</p>`
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('Welcome email sent to:', user.email);
    } catch (error) {
      console.error('Email sending failed:', error);
    }
  }
}

module.exports = new EmailService();