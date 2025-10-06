// backend/routes/analytics.js - COMPLETE REPLACEMENT
const express = require('express');
const router = express.Router();
const { 
  getEmissionsTrajectory,
  getEmissionsVelocity,
  getMACCAnalysis,
  getMACCOpportunities,
  saveMACCOpportunity,
  deleteMACCOpportunity
} = require('../controllers/analyticsController');

// Trajectory analysis
router.get('/emissions-trajectory', getEmissionsTrajectory);

// Velocity & acceleration analysis
router.get('/emissions-velocity', getEmissionsVelocity);

// MACC analysis
router.get('/macc', getMACCAnalysis);
router.get('/macc/opportunities', getMACCOpportunities);
router.post('/macc/opportunities', saveMACCOpportunity);
router.delete('/macc/opportunities/:id', deleteMACCOpportunity);

module.exports = router;