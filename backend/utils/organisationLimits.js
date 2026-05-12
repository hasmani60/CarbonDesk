/**
 * Subscription tier caps for organisations (used at org creation and user seat checks).
 * Override with env: TIER_BASIC_MAX_USERS, TIER_STANDARD_MAX_USERS, TIER_PREMIUM_MAX_USERS
 */

function intEnv(name, fallback) {
  const v = parseInt(String(process.env[name] || ''), 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

const tierDefaults = () => ({
  basic: {
    maxUsers: intEnv('TIER_BASIC_MAX_USERS', 10),
    maxStorageGb: intEnv('TIER_BASIC_MAX_STORAGE_GB', 5)
  },
  standard: {
    maxUsers: intEnv('TIER_STANDARD_MAX_USERS', 50),
    maxStorageGb: intEnv('TIER_STANDARD_MAX_STORAGE_GB', 10)
  },
  premium: {
    maxUsers: intEnv('TIER_PREMIUM_MAX_USERS', 200),
    maxStorageGb: intEnv('TIER_PREMIUM_MAX_STORAGE_GB', 50)
  }
});

function resolveMaxUsersForTier(subscriptionTier, requestedMaxUsers) {
  const tier = ['basic', 'standard', 'premium'].includes(subscriptionTier)
    ? subscriptionTier
    : 'standard';
  const cap = tierDefaults()[tier].maxUsers;
  if (requestedMaxUsers == null || requestedMaxUsers === '') {
    return cap;
  }
  const r = parseInt(String(requestedMaxUsers), 10);
  if (!Number.isFinite(r) || r < 1) {
    return cap;
  }
  return Math.min(r, cap);
}

function resolveMaxStorageGbForTier(subscriptionTier, requestedGb) {
  const tier = ['basic', 'standard', 'premium'].includes(subscriptionTier)
    ? subscriptionTier
    : 'standard';
  const cap = tierDefaults()[tier].maxStorageGb;
  if (requestedGb == null || requestedGb === '') {
    return cap;
  }
  const r = parseFloat(String(requestedGb));
  if (!Number.isFinite(r) || r < 1) {
    return cap;
  }
  return Math.min(r, cap);
}

/** End date for a new subscription (full term from activation). */
function defaultSubscriptionExpiresAt() {
  const days = parseInt(
    String(process.env.SUBSCRIPTION_DEFAULT_TERM_DAYS || '365'),
    10
  );
  const d = Number.isFinite(days) && days > 0 ? days : 365;
  return new Date(Date.now() + d * 24 * 60 * 60 * 1000);
}

module.exports = {
  resolveMaxUsersForTier,
  resolveMaxStorageGbForTier,
  defaultSubscriptionExpiresAt,
  tierDefaults
};
