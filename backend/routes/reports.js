const express = require('express');
const router = express.Router();
const { authorizeRoles } = require('../middleware/auth');
const { verifyReportApiSecret } = require('../middleware/reportAuth');
const reportController = require('../controllers/reportController');

const reportAuthors = authorizeRoles('admin', 'analyst');

/** n8n / automation: organisationId must be in body */
const attachOrganisationFromBody = (req, res, next) => {
  const organisationId = req.body?.organisationId;
  if (!organisationId) {
    return res.status(400).json({
      success: false,
      message: 'organisationId is required in request body'
    });
  }
  req.organisationId = organisationId;
  next();
};

router.get('/filter-options', reportController.getFilterOptions);

router.post('/generate', reportAuthors, reportController.generateReport);

router.get('/', reportController.listReports);
router.get('/:id', reportController.getReportById);

router.post(
  '/prepare-data',
  verifyReportApiSecret,
  attachOrganisationFromBody,
  reportController.prepareReportData
);

router.patch(
  '/:id/callback',
  verifyReportApiSecret,
  reportController.reportCallback
);

module.exports = router;
