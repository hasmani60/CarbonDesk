const express = require('express');
const router = express.Router();
const { authorizeRoles } = require('../middleware/auth');
const reportController = require('../controllers/reportController');

/** Same as report generation UI: automation user must be admin or analyst */
const reportAuthors = authorizeRoles('admin', 'analyst');

router.get('/filter-options', reportController.getFilterOptions);

router.post('/generate', reportAuthors, reportController.generateReport);

router.post('/prepare-data', reportAuthors, reportController.prepareReportData);

router.get('/', reportController.listReports);

router.patch('/:id/callback', reportAuthors, reportController.reportCallback);

router.get('/:id', reportController.getReportById);

module.exports = router;
