const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { addOrganisationContext, requireOrganisation } = require('../middleware/organisationScope');
const { reportAutomationGate } = require('../middleware/reportAutomationGate');
const reportController = require('../controllers/reportController');

/** Same as report generation UI: automation user must be admin or analyst */
const reportAuthors = authorizeRoles('admin', 'analyst');

/** Browser / app: JWT only */
const orgUser = [
  authenticateToken,
  addOrganisationContext,
  requireOrganisation
];

router.get('/filter-options', ...orgUser, reportController.getFilterOptions);

router.post('/generate', ...orgUser, reportAuthors, reportController.generateReport);

router.post(
  '/prepare-data',
  reportAutomationGate,
  reportAuthors,
  reportController.prepareReportData
);

router.patch(
  '/:id/callback',
  reportAutomationGate,
  reportAuthors,
  reportController.reportCallback
);

router.get('/', ...orgUser, reportController.listReports);

router.get('/:id', ...orgUser, reportController.getReportById);

module.exports = router;
