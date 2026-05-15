/**
 * Server-to-server auth for n8n report callbacks (prepare-data, status updates).
 */
const verifyReportApiSecret = (req, res, next) => {
  const secret = process.env.N8N_REPORT_API_SECRET;
  if (!secret) {
    return res.status(503).json({
      success: false,
      message: 'Report automation is not configured on the server'
    });
  }

  const headerSecret =
    req.headers['x-report-secret'] ||
    req.headers['x-n8n-report-secret'] ||
    req.body?.reportSecret;

  if (!headerSecret || headerSecret !== secret) {
    return res.status(401).json({
      success: false,
      message: 'Invalid report API credentials'
    });
  }

  next();
};

module.exports = { verifyReportApiSecret };
