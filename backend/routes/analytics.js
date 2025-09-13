// routes/analytics.js
const express = require('express');
const { getEmissionTrends, getScopeComparison } = require('../controllers/analyticsController');

const router = express.Router();

router.get('/trends', getEmissionTrends);
router.get('/scope-comparison', getScopeComparison);

module.exports = router;