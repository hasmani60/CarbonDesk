// backend/controllers/analyticsController.js
// MongoDB-backed analytics controller with organization isolation

const advancedAnalyticsService = require('../services/advancedAnalyticsService');

/**
 * @desc    Get emissions trajectory analysis
 * @route   GET /api/analysis/emissions-trajectory
 * @access  Private (All authenticated users)
 */
const getEmissionsTrajectory = async (req, res) => {
  try {
    const organisationId = req.user.organisation_id;
    
    console.log('📈 Trajectory analysis requested by:', req.user?.email, 'Org:', organisationId);
    
    const { startDate, endDate, targetScenario = '1.5C' } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate are required'
      });
    }
    
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
    
    console.log(`✅ Trajectory calculated, periods: ${result.historical.length}`);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('❌ Emissions trajectory error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    Get emissions velocity and acceleration
 * @route   GET /api/analysis/emissions-velocity
 * @access  Private (All authenticated users)
 */
const getEmissionsVelocity = async (req, res) => {
  try {
    const organisationId = req.user.organisation_id;
    
    console.log('⚡ Velocity analysis requested by:', req.user?.email, 'Org:', organisationId);
    
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate are required'
      });
    }
    
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
    
    console.log(`✅ Velocity calculated, periods: ${result.periods.length}`);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('❌ Emissions velocity error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    Get MACC analysis
 * @route   GET /api/analysis/macc
 * @access  Private (All authenticated users)
 */
const getMACCAnalysis = async (req, res) => {
  try {
    const organisationId = req.user.organisation_id;
    
    console.log('💰 MACC analysis requested by:', req.user?.email, 'Org:', organisationId);
    
    const { scope, category } = req.query;
    
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
    
    console.log(`✅ MACC calculated, opportunities: ${result.opportunities.length}`);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('❌ MACC analysis error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    Get MACC opportunities
 * @route   GET /api/analysis/macc/opportunities
 * @access  Private (All authenticated users)
 */
const getMACCOpportunities = async (req, res) => {
  try {
    const organisationId = req.user.organisation_id;
    
    console.log('📋 MACC opportunities requested by:', req.user?.email, 'Org:', organisationId);
    
    const { scope, category } = req.query;
    
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
    
    console.log(`✅ Found ${opportunities.length} MACC opportunities`);
    
    res.json({
      success: true,
      data: opportunities,
      total: opportunities.length
    });
  } catch (error) {
    console.error('❌ Get MACC opportunities error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    Save MACC opportunity
 * @route   POST /api/analysis/macc/opportunities
 * @access  Private (Admin, Analyst)
 */
const saveMACCOpportunity = async (req, res) => {
  try {
    const organisationId = req.user.organisation_id;
    
    console.log('➕ Creating MACC opportunity by:', req.user?.email, 'Org:', organisationId);
    
    if (!organisationId) {
      return res.status(403).json({
        success: false,
        message: 'Organisation membership required'
      });
    }
    
    const data = {
      ...req.body,
      organisationId,
      createdBy: req.user?.id,
      userId: req.user?.id
    };
    
    const result = await advancedAnalyticsService.saveMACCOpportunity(data);
    
    console.log(`✅ MACC opportunity created: ${result.name || 'N/A'}`);
    
    res.status(201).json({
      success: true,
      data: result,
      message: 'MACC opportunity saved successfully'
    });
  } catch (error) {
    console.error('❌ Save MACC opportunity error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    Delete MACC opportunity
 * @route   DELETE /api/analysis/macc/opportunities/:id
 * @access  Private (Admin, Analyst)
 */
const deleteMACCOpportunity = async (req, res) => {
  try {
    const { id } = req.params;
    const organisationId = req.user.organisation_id;
    
    console.log('🗑️ Deleting MACC opportunity:', id, 'by:', req.user?.email, 'Org:', organisationId);
    
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
    
    console.log(`✅ MACC opportunity deleted: ${id}`);
    
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