const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { addOrganisationContext, requireOrganisation } = require('../middleware/organisationScope');
const { reportAutomationGate } = require('../middleware/reportAutomationGate');
const { authorizeReportOrgAdmin } = require('../middleware/reportGenerationAuth');
const reportController = require('../controllers/reportController');

/** Browser / app: JWT only */
const orgUser = [
  authenticateToken,
  addOrganisationContext,
  requireOrganisation
];

router.get('/quota', ...orgUser, authorizeReportOrgAdmin, reportController.getReportQuota);

router.get('/filter-options', ...orgUser, authorizeReportOrgAdmin, reportController.getFilterOptions);

router.post('/generate', ...orgUser, authorizeReportOrgAdmin, reportController.generateReport);

router.post(
  '/prepare-data',
  reportAutomationGate,
  authorizeReportOrgAdmin,
  reportController.prepareReportData
);

const callbackStack = [
  reportAutomationGate,
  authorizeReportOrgAdmin,
  reportController.reportCallback
];
router.patch('/:id/callback', ...callbackStack);
/** n8n HTTP Request often defaults to POST — same handler as PATCH */
router.post('/:id/callback', ...callbackStack);

router.get('/', ...orgUser, reportController.listReports);

router.patch('/:id/cancel', ...orgUser, authorizeReportOrgAdmin, reportController.cancelReport);

router.get('/:id', ...orgUser, reportController.getReportById);

module.exports = router;
