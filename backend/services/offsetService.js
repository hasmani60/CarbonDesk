const Emission = require('../models/Emission');
const OffsetOpportunity = require('../models/OffsetOpportunity');
const OffsetUtilization = require('../models/OffsetUtilization');
const { resolveDateRange } = require('../utils/emissionQueryUtils');

function isExpired(expiryDate) {
  if (!expiryDate) return false;
  const d = new Date(expiryDate);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d < today;
}

async function getUtilizedQuantity(offsetId, organisationId) {
  const rows = await OffsetUtilization.aggregate([
    {
      $match: {
        offset_id: offsetId,
        organisation_id: organisationId,
        deleted_at: null
      }
    },
    { $group: { _id: null, total: { $sum: '$quantity_applied' } } }
  ]);
  return rows[0]?.total || 0;
}

function deriveStatus(offset, utilizedQty) {
  if (isExpired(offset.expiry_date)) return 'expired';
  const available = Math.max(0, offset.total_quantity - utilizedQty);
  if (available <= 0) return 'utilized';
  if (utilizedQty > 0) return 'partially_used';
  return 'active';
}

async function enrichOffset(offset, organisationId) {
  const utilized_quantity = await getUtilizedQuantity(offset.id, organisationId);
  const available_quantity = Math.max(0, offset.total_quantity - utilized_quantity);
  const status = deriveStatus(offset, utilized_quantity);
  return {
    ...offset,
    utilized_quantity,
    available_quantity,
    status,
    is_expired: status === 'expired'
  };
}

async function getGrossEmissions(organisationId, reportingYear) {
  const { startDate, endDate } = resolveDateRange({ reportingYear });
  const match = { organisation_id: organisationId };
  if (startDate || endDate) {
    match.date = {};
    if (startDate) match.date.$gte = startDate;
    if (endDate) match.date.$lte = endDate;
  }

  const rows = await Emission.aggregate([
    { $match: match },
    { $group: { _id: null, gross: { $sum: { $ifNull: ['$co2e', 0] } } } }
  ]);
  return rows[0]?.gross || 0;
}

async function getTotalOffsetsApplied(organisationId, reportingYear) {
  const rows = await OffsetUtilization.aggregate([
    {
      $match: {
        organisation_id: organisationId,
        reporting_year: reportingYear,
        deleted_at: null,
        counts_toward_net: true
      }
    },
    { $group: { _id: null, total: { $sum: '$quantity_applied' } } }
  ]);
  return rows[0]?.total || 0;
}

async function getNetEmissionsSummary(organisationId, reportingYear) {
  const gross_emissions = await getGrossEmissions(organisationId, reportingYear);
  const total_offsets_applied = await getTotalOffsetsApplied(organisationId, reportingYear);
  const net_emissions = Math.max(0, gross_emissions - total_offsets_applied);
  return {
    reporting_year: reportingYear,
    gross_emissions,
    total_offsets_applied,
    net_emissions
  };
}

function appendActivity(offset, action, details, user) {
  offset.activity_log = offset.activity_log || [];
  offset.activity_log.unshift({
    action,
    details,
    user_id: user?.id || '',
    user_email: user?.email || ''
  });
  if (offset.activity_log.length > 100) {
    offset.activity_log = offset.activity_log.slice(0, 100);
  }
}

module.exports = {
  isExpired,
  getUtilizedQuantity,
  deriveStatus,
  enrichOffset,
  getGrossEmissions,
  getTotalOffsetsApplied,
  getNetEmissionsSummary,
  appendActivity
};
