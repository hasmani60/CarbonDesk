/**
 * For POST /prepare-data and PATCH /:id/callback only:
 * - Either valid JWT (normal user, admin|analyst checked after)
 * - Or X-Report-Secret matching N8N_REPORT_API_SECRET + organisationId in JSON body (n8n automation)
 */
const { authenticateToken } = require('./auth');
const { addOrganisationContext, requireOrganisation } = require('./organisationScope');

function reportAutomationGate(req, res, next) {
  const authHeader = req.headers.authorization;
  const hasBearer =
    typeof authHeader === 'string' && authHeader.trim().toLowerCase().startsWith('bearer ');

  if (hasBearer) {
    return authenticateToken(req, res, (err) => {
      if (err) return next(err);
      return addOrganisationContext(req, res, (err2) => {
        if (err2) return next(err2);
        return requireOrganisation(req, res, next);
      });
    });
  }

  const secret = process.env.N8N_REPORT_API_SECRET;
  if (!secret) {
    return res.status(401).json({
      success: false,
      message:
        'Access token is required. For n8n without a user JWT, set N8N_REPORT_API_SECRET on the server and send header X-Report-Secret.'
    });
  }

  const headerSecret =
    req.headers['x-report-secret'] || req.headers['x-n8n-report-secret'] || req.body?.reportSecret;

  if (!headerSecret || String(headerSecret).trim() !== String(secret).trim()) {
    return res.status(401).json({
      success: false,
      message: 'Access token is required'
    });
  }

  const organisationId = req.body?.organisationId;
  if (!organisationId) {
    return res.status(400).json({
      success: false,
      message: 'organisationId is required in request body when using X-Report-Secret'
    });
  }

  req.user = {
    id: 'n8n-report-automation',
    name: 'n8n Report Automation',
    email: 'n8n@report-automation.internal',
    role: 'analyst',
    organisation_id: String(organisationId),
    restrictions: null,
    status: 'active'
  };

  return addOrganisationContext(req, res, (err) => {
    if (err) return next(err);
    return requireOrganisation(req, res, next);
  });
}

module.exports = { reportAutomationGate };
