// backend/routes/organisation.js
const express = require('express');
const router = express.Router();
const organisationController = require('../controllers/organisationController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { addOrganisationContext, requireOrganisation } = require('../middleware/organisationScope');

// All routes require authentication and organisation context
router.use(authenticateToken);
router.use(addOrganisationContext);
router.use(requireOrganisation);

// @route   GET /api/organisation/details
// @desc    Get organisation details
// @access  Admin only
router.get('/details', requireAdmin, organisationController.getOrganisationDetails);

// @route   PATCH /api/organisation/details
// @desc    Update organisation details
// @access  Admin only
router.patch('/details', requireAdmin, organisationController.updateOrganisationDetails);

module.exports = router;