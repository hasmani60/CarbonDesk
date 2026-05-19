/**
 * AI reports: organisation admins only (role admin = super admin + org admins).
 * n8n automation (X-Report-Secret) is allowed for prepare-data / callback.
 */
function authorizeReportOrgAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.id === 'n8n-report-automation') {
    return next();
  }

  const role = String(req.user.role || '').trim().toLowerCase();
  if (role === 'admin') {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Only organisation administrators can manage AI carbon reports'
  });
}

module.exports = { authorizeReportOrgAdmin };
