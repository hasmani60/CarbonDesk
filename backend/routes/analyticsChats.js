const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { addOrganisationContext, requireOrganisation } = require('../middleware/organisationScope');
const { authorizeReportOrgAdmin } = require('../middleware/reportGenerationAuth');
const analyticsChatController = require('../controllers/analyticsChatController');

const orgAdmin = [
  authenticateToken,
  addOrganisationContext,
  requireOrganisation,
  authorizeReportOrgAdmin
];

router.get('/quota', ...orgAdmin, analyticsChatController.getQuota);
router.get('/filter-options', ...orgAdmin, analyticsChatController.getFilterOptions);
router.get('/', ...orgAdmin, analyticsChatController.listChats);
router.post('/', ...orgAdmin, analyticsChatController.createChat);
router.get('/:id', ...orgAdmin, analyticsChatController.getChat);
router.post('/:id/messages', ...orgAdmin, analyticsChatController.sendMessage);
router.delete('/:id', ...orgAdmin, analyticsChatController.deleteChat);

module.exports = router;
