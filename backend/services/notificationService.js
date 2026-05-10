const mongoose = require('mongoose');
const User = require('../models/User');
const Notification = require('../models/Notification');
const logger = require('../utils/logger');

function initials(name) {
  if (!name || typeof name !== 'string') return '??';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 3);
}

/**
 * Serialize DB doc for API / UI (NotificationCard expects user.name, etc.)
 */
function toClient(notificationDoc) {
  const n =
    notificationDoc && notificationDoc.toObject
      ? notificationDoc.toObject()
      : notificationDoc || {};
  const idRaw = n._id;
  const idStr =
    idRaw !== undefined && idRaw !== null
      ? typeof idRaw.toString === 'function'
        ? idRaw.toString()
        : String(idRaw)
      : '';
  const actor = n.actor_name || 'System';
  const createdRaw = n.created_at || n.createdAt;
  const createdISO =
    createdRaw instanceof Date
      ? createdRaw.toISOString()
      : createdRaw
        ? new Date(createdRaw).toISOString()
        : new Date().toISOString();
  return {
    _id: idStr,
    type: n.type,
    title: n.title,
    message: n.message,
    read: !!n.read,
    readAt: n.read_at,
    priority: n.priority || 'medium',
    deadline: n.deadline || null,
    createdAt: createdISO,
    user: {
      name: actor,
      avatar: initials(actor)
    },
    data: n.data || {}
  };
}

/**
 * Inform admins (+ analysts) in the organisation when any user adds an emission (excludes submitter).
 * Uses multiple organisation id strings — custom org ids vs Mongo _id mismatches broke lookups before.
 */
async function notifyAdminsAnalystsNewEmission({
  organisationIds,
  organisationId,
  actorUserId,
  actorName,
  emission
}) {
  const orgSet = [
    ...new Set(
      [...(Array.isArray(organisationIds) ? organisationIds : []), organisationId]
        .filter(Boolean)
        .map((x) => String(x).trim())
        .filter(Boolean)
    )
  ];
  if (!orgSet.length || !emission) return;

  const recipientFilter = {
    organisation_id: { $in: orgSet },
    role: { $in: ['admin', 'analyst'] },
    status: 'active'
  };
  if (mongoose.isValidObjectId(actorUserId)) {
    recipientFilter._id = {
      $ne: new mongoose.Types.ObjectId(actorUserId)
    };
  }

  const recipients = await User.find(recipientFilter).select('_id').lean();

  if (!recipients.length) {
    logger.warn('No admin/analyst recipients for emission notification', {
      organisationIds: orgSet,
      actorUserId: actorUserId ? String(actorUserId) : null
    });
    return;
  }

  const cat = emission.category || 'Emission';
  const line = emission.subcategory || emission.source || emission.activity || '';
  const amountRaw =
    emission.quantity != null && emission.quantity !== ''
      ? emission.quantity
      : emission.amount != null && emission.amount !== ''
        ? emission.amount
        : '';
  const amount = amountRaw !== '' && amountRaw != null ? String(amountRaw) : '';
  const unit = emission.unit || '';

  const title = 'Emission data added';
  const messageParts = [`${actorName || 'User'} submitted ${cat}`];
  if (line) messageParts.push(`— ${line}`);
  if (amount) messageParts.push(`(${amount} ${unit})`.trim());
  const message = messageParts.filter(Boolean).join(' ');

  const persistedOrgId = String(
    emission.organisation_id || organisationId || orgSet[0] || ''
  );

  const docs = recipients.map((u) => ({
    recipient_id: u._id.toString(),
    organisation_id: persistedOrgId,
    type: 'emission_submitted',
    title,
    message,
    read: false,
    actor_user_id: actorUserId ? String(actorUserId) : null,
    actor_name: actorName || null,
    priority: 'medium',
    deadline: null,
    data: {
      emissionId: emission._id ? emission._id.toString() : emission.id,
      scope: emission.scope,
      category: emission.category,
      amount: emission.quantity ?? emission.amount,
      unit: emission.unit,
      co2e: emission.co2e
    }
  }));

  await Notification.insertMany(docs);
  logger.info('Emission submission notifications sent to admins/analysts', {
    recipientCount: docs.length,
    emissionId: emission._id ? emission._id.toString() : emission.id,
    organisation_id: persistedOrgId
  });
}

module.exports = {
  toClient,
  notifyAdminsAnalystsNewEmission,
  initials
};
