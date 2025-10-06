// backend/controllers/analyticsController.js - COMPLETE REPLACEMENT
// Uses existing organization filtering pattern from your codebase

const advancedAnalyticsService = require('../services/advancedAnalyticsService');

// @desc    Get emissions trajectory analysis
// @route   GET /api/analysis/emissions-trajectory
// @access  Private (Admin, Analyst, Viewer)
const getEmissionsTrajectory = async (req, res) => {
  try {
    console.log('📈 Trajectory analysis requested by:', req.user?.email, 'Org:', req.organisationId);
    
    const { startDate, endDate, targetScenario = '1.5C' } = req.query;
    
    // Match existing validation pattern
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate are required'
      });
    }
    
    // Use organisationId from middleware (same as emissionController.js)
    const organisationId = req.organisationId;
    
    if (!organisationId) {
      return res.status(403).json({
        success: false,
        message: 'Organisation membership required'
      });
    }
    
    const result = await advancedAnalyticsService.calculateEmissionsTrajectory({
      startDate,
      endDate,
      organisationId,
      targetScenario
    });
    
    console.log(`✅ Trajectory calculated for org: ${req.organisation?.name}, periods: ${result.historical.length}`);
    
    res.json({
      success: true,
      data: result,
      organisation: req.organisation?.name || 'N/A'
    });
  } catch (error) {
    console.error('❌ Emissions trajectory error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get emissions velocity and acceleration
// @route   GET /api/analysis/emissions-velocity
// @access  Private (Admin, Analyst, Viewer)
const getEmissionsVelocity = async (req, res) => {
  try {
    console.log('⚡ Velocity analysis requested by:', req.user?.email, 'Org:', req.organisationId);
    
    const { startDate, endDate } = req.query;
    
    // Match existing validation pattern
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate are required'
      });
    }
    
    // Use organisationId from middleware (same as emissionController.js)
    const organisationId = req.organisationId;
    
    if (!organisationId) {
      return res.status(403).json({
        success: false,
        message: 'Organisation membership required'
      });
    }
    
    const result = await advancedAnalyticsService.calculateEmissionsVelocity({
      startDate,
      endDate,
      organisationId
    });
    
    console.log(`✅ Velocity calculated for org: ${req.organisation?.name}, periods: ${result.periods.length}`);
    
    res.json({
      success: true,
      data: result,
      organisation: req.organisation?.name || 'N/A'
    });
  } catch (error) {
    console.error('❌ Emissions velocity error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get MACC analysis
// @route   GET /api/analysis/macc
// @access  Private (Admin, Analyst, Viewer)
const getMACCAnalysis = async (req, res) => {
  try {
    console.log('💰 MACC analysis requested by:', req.user?.email, 'Org:', req.organisationId);
    
    const { scope, category } = req.query;
    
    // Use organisationId from middleware (same as emissionController.js)
    const organisationId = req.organisationId;
    
    if (!organisationId) {
      return res.status(403).json({
        success: false,
        message: 'Organisation membership required'
      });
    }
    
    const result = await advancedAnalyticsService.calculateMACCAnalysis({
      organisationId,
      scope: scope ? parseInt(scope) : null,
      category
    });
    
    console.log(`✅ MACC calculated for org: ${req.organisation?.name}, opportunities: ${result.opportunities.length}`);
    
    res.json({
      success: true,
      data: result,
      organisation: req.organisation?.name || 'N/A'
    });
  } catch (error) {
    console.error('❌ MACC analysis error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get MACC opportunities
// @route   GET /api/analysis/macc/opportunities
// @access  Private (Admin, Analyst)
const getMACCOpportunities = async (req, res) => {
  try {
    console.log('📋 MACC opportunities requested by:', req.user?.email, 'Org:', req.organisationId);
    
    const { scope, category } = req.query;
    
    // Use organisationId from middleware (same as emissionController.js)
    const organisationId = req.organisationId;
    
    if (!organisationId) {
      return res.status(403).json({
        success: false,
        message: 'Organisation membership required'
      });
    }
    
    const opportunities = await advancedAnalyticsService.getMACCOpportunities(
      organisationId,
      scope ? parseInt(scope) : null,
      category
    );
    
    console.log(`✅ Found ${opportunities.length} MACC opportunities for org: ${req.organisation?.name}`);
    
    res.json({
      success: true,
      data: opportunities,
      total: opportunities.length,
      organisation: req.organisation?.name || 'N/A'
    });
  } catch (error) {
    console.error('❌ Get MACC opportunities error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Save MACC opportunity
// @route   POST /api/analysis/macc/opportunities
// @access  Private (Admin, Analyst)
const saveMACCOpportunity = async (req, res) => {
  try {
    console.log('➕ Creating MACC opportunity by:', req.user?.email, 'Org:', req.organisationId);
    
    // Use organisationId from middleware (same as emissionController.js)
    const organisationId = req.organisationId;
    
    if (!organisationId) {
      return res.status(403).json({
        success: false,
        message: 'Organisation membership required'
      });
    }
    
    // Add organisation data (same pattern as emissionController.js createEmission)
    const data = {
      ...req.body,
      organisationId
    };
    
    const result = await advancedAnalyticsService.saveMACCOpportunity(data);
    
    console.log(`✅ MACC opportunity created: ${result.name} for org: ${req.organisation?.name}`);
    
    res.status(201).json({
      success: true,
      data: result,
      message: 'MACC opportunity saved successfully',
      organisation: req.organisation?.name || 'N/A'
    });
  } catch (error) {
    console.error('❌ Save MACC opportunity error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete MACC opportunity
// @route   DELETE /api/analysis/macc/opportunities/:id
// @access  Private (Admin, Analyst)
const deleteMACCOpportunity = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🗑️ Deleting MACC opportunity:', id, 'by:', req.user?.email, 'Org:', req.organisationId);
    
    // Use organisationId from middleware (same as emissionController.js)
    const organisationId = req.organisationId;
    
    if (!organisationId) {
      return res.status(403).json({
        success: false,
        message: 'Organisation membership required'
      });
    }
    
    const result = await advancedAnalyticsService.deleteMACCOpportunity(id, organisationId);
    
    if (!result.deleted) {
      return res.status(404).json({
        success: false,
        message: 'MACC opportunity not found or you do not have access to it'
      });
    }
    
    console.log(`✅ MACC opportunity deleted: ${id} from org: ${req.organisation?.name}`);
    
    res.json({
      success: true,
      message: 'MACC opportunity deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete MACC opportunity error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getEmissionsTrajectory,
  getEmissionsVelocity,
  getMACCAnalysis,
  getMACCOpportunities,
  saveMACCOpportunity,
  deleteMACCOpportunity
};