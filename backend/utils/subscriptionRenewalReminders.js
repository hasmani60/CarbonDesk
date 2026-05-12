const { Organisation, User } = require('../models');
const emailService = require('./emailService');
const logger = require('./logger');

/**
 * Notify org super admins when subscription ends within SUBSCRIPTION_RENEWAL_REMINDER_DAYS (default 60).
 */
async function sendSubscriptionRenewalReminders() {
  const reminderDays = parseInt(
    String(process.env.SUBSCRIPTION_RENEWAL_REMINDER_DAYS || '60'),
    10
  );
  const days = Number.isFinite(reminderDays) && reminderDays > 0 ? reminderDays : 60;
  const now = new Date();
  const horizon = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const orgs = await Organisation.find({
    is_active: true,
    subscription_expires_at: { $gt: now, $lte: horizon },
    subscription_renewal_reminder_sent_at: null
  }).lean();

  for (const o of orgs) {
    try {
      let admin = null;
      if (o.bootstrap_admin_user_id) {
        admin = await User.findOne({
          _id: o.bootstrap_admin_user_id,
          organisation_id: o.id,
          role: 'admin',
          status: 'active'
        });
      }
      if (!admin) {
        admin = await User.findOne({
          organisation_id: o.id,
          role: 'admin',
          status: 'active'
        }).sort({ created_at: 1 });
      }
      if (!admin) {
        logger.warn('Subscription renewal: no admin for org', { orgId: o.id });
        continue;
      }

      const mail = await emailService.sendSubscriptionRenewalReminder(o, admin);
      if (mail.sent) {
        await Organisation.updateOne(
          { id: o.id },
          { $set: { subscription_renewal_reminder_sent_at: new Date() } }
        );
        logger.info('Subscription renewal reminder sent', {
          orgId: o.id,
          to: admin.email
        });
      } else {
        logger.warn('Subscription renewal reminder not sent', {
          orgId: o.id,
          reason: mail.reason
        });
      }
    } catch (e) {
      logger.error('Subscription renewal reminder failed', {
        orgId: o.id,
        err: e.message
      });
    }
  }
}

module.exports = { sendSubscriptionRenewalReminders };
