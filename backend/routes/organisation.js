// routes/organisation.js - MongoDB-compatible organisation routes
const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const { 
  getOrganisationDetails, 
  updateOrganisationDetails 
} = require('../controllers/organisationController');

// All routes protected by authenticateToken + addOrganisationContext + requireOrganisation in server.js

// Any authenticated user in an organisation can view (server stack adds organisation context)
router.get('/details', getOrganisationDetails);
router.patch('/details', requireAdmin, updateOrganisationDetails);

module.exports = router;