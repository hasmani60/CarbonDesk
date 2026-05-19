const { Organisation, User } = require('../models');

async function assertOrganisationUserCapacity(organisationId) {
  if (!organisationId) {
    return;
  }
  const org = await Organisation.findOne({ id: organisationId }).select('max_users');
  if (!org) {
    const e = new Error('Organisation not found');
    e.statusCode = 404;
    throw e;
  }
  const n = await User.countDocuments({ organisation_id: organisationId });
  if (n >= org.max_users) {
    const e = new Error(
      `This organisation has reached its user limit (${org.max_users}) for the current subscription.`
    );
    e.statusCode = 400;
    e.code = 'ORG_USER_LIMIT';
    throw e;
  }
}

module.exports = { assertOrganisationUserCapacity };
