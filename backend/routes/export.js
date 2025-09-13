// routes/export.js
const express = require('express');
const { exportActivities, exportEmissions } = require('../controllers/exportController');

const router = express.Router();

router.get('/activities', exportActivities);
router.get('/emissions', exportEmissions);

module.exports = router;