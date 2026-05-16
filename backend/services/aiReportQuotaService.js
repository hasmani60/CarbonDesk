const { Organisation, AIReport, AnalyticsChat } = require('../models');
const { resolveMaxAiReportsForTier } = require('../utils/organisationLimits');

/**
 * Count AI report jobs + analytics chat assistant replies (shared org quota).
 */
async function countReportsUsed(organisationId) {
  const [reportCount, chatAssistantAgg] = await Promise.all([
    AIReport.countDocuments({ organisation_id: organisationId }),
    AnalyticsChat.aggregate([
      { $match: { organisation_id: organisationId } },
      { $unwind: '$messages' },
      { $match: { 'messages.role': 'assistant' } },
      { $count: 'total' }
    ])
  ]);
  const chatReplies = chatAssistantAgg[0]?.total || 0;
  return reportCount + chatReplies;
}

async function getOrganisationQuota(organisationId) {
  const org = await Organisation.findOne({ id: organisationId }).select(
    'max_ai_reports subscription_tier name display_name'
  );
  if (!org) {
    return null;
  }

  const used = await countReportsUsed(organisationId);
  const limit = org.max_ai_reports ?? resolveMaxAiReportsForTier(org.subscription_tier, null);
  const remaining = Math.max(0, limit - used);

  return {
    organisationId,
    organisationName: org.display_name || org.name,
    used,
    limit,
    remaining,
    canGenerate: used < limit
  };
}

async function assertCanGenerateReport(organisationId) {
  const quota = await getOrganisationQuota(organisationId);
  if (!quota) {
    const err = new Error('Organisation not found');
    err.statusCode = 404;
    throw err;
  }
  if (!quota.canGenerate) {
    const err = new Error(
      `AI usage limit reached (${quota.used} of ${quota.limit} reports + chat replies). Contact your platform administrator to increase your allowance.`
    );
    err.statusCode = 403;
    err.code = 'AI_REPORT_QUOTA_EXCEEDED';
    err.quota = quota;
    throw err;
  }
  return quota;
}

module.exports = {
  countReportsUsed,
  getOrganisationQuota,
  assertCanGenerateReport
};
