// backend/controllers/emissionController.js
// MongoDB Version - Completely rewritten to use Mongoose
// Version 3.0 - Full MongoDB Integration with Activity Sync

const Emission = require('../models/Emission');
const Activity = require('../models/ActivityLog');
const EmissionFactor = require('../models/EmissionFactor');
const { addOrganisationToData } = require('../middleware/organisationScope');
const { contributorMaySubmitEmission } = require('../utils/contributorEmissionAccess');
const { notifyAdminsAnalystsNewEmission } = require('../services/notificationService');
const logger = require('../utils/logger');
const {
  isMaterialTransportEmission,
  normalizeTransportCategory
} = require('../utils/transportEmissionUtils');

// Import emission factors from database
const { emissionFactors } = require('../data/complete_emission_factors_db');

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get emission factor from database with static fallback
 */
const getEmissionFactor = async (scope, category, source) => {
  // Try database lookup first
  try {
    const factorDoc = await EmissionFactor.findOne({
      scope: parseInt(scope),
      category: category,
      subcategory: source,
      isActive: true
    });
    
    if (factorDoc) {
      return {
        factor: factorDoc.factor,
        unit: factorDoc.unit,
        co2: factorDoc.co2,
        ch4: factorDoc.ch4,
        n2o: factorDoc.n2o,
        description: factorDoc.description
      };
    }
  } catch (err) {
    logger.warn('Failed to lookup emission factor from DB', { scope, category, source, error: err.message });
  }

  // Fallback to static structure
  const scopeKey = `scope${scope}`;
  const scopeData = emissionFactors[scopeKey];

  if (!scopeData || !scopeData[category] || !scopeData[category][source]) {
    logger.error('Emission factor not found', { scope, category, source });
    return null;
  }

  return scopeData[category][source];
};

/**
 * Calculate emissions using emission factor database/structure
 */
const calculateEmissions = async (quantity, scope, category, source) => {
  const factorData = await getEmissionFactor(scope, category, source);

  if (!factorData) {
    logger.error('Cannot calculate emissions: factor not found');
    return {
      total: 0,
      co2: 0,
      ch4: 0,
      n2o: 0
    };
  }

  return {
    total: quantity * factorData.factor,
    co2: quantity * (factorData.co2 || 0),
    ch4: quantity * (factorData.ch4 || 0),
    n2o: quantity * (factorData.n2o || 0),
    factor: factorData.factor,
    unit: factorData.unit,
    description: factorData.description
  };
};

/**
 * Sync emission to Activity collection for monitoring
 */
const syncToActivity = async (emission, user, action = 'emission_created') => {
  try {
    const activityData = {
      user_id: user.id || user._id?.toString() || 'system',
      action: action,
      resource_type: 'emission',
      resource_id: emission._id.toString(),
      details: `Emission for ${emission.category} (${emission.quantity} ${emission.unit}) - Scope ${emission.scope}`,
      ip_address: user.ip_address || 'unknown',
      user_agent: user.user_agent || 'unknown'
    };
    
    await Activity.create(activityData);
    logger.info('Emission synced to ActivityLog', { emissionId: emission._id });
    return true;
  } catch (error) {
    logger.warn('Failed to sync to Activity', { 
      emissionId: emission._id, 
      error: error.message 
    });
    return false;
  }
};

/**
 * Validate organisation context exists
 */
const validateOrganisationContext = (req) => {
  if (!req.organisationId) {
    logger.error('No organisation context', {
      userId: req.user.id,
      userEmail: req.user.email,
      userOrgId: req.user.organisation_id,
      reqOrgId: req.organisationId
    });
    return false;
  }
  return true;
};

/**
 * Build MongoDB filter query
 */
const buildEmissionFilter = (req, baseFilter = {}) => {
  const filter = { ...baseFilter };
  
  // Optional filters
  if (req.query.scope) {
    filter.scope = parseInt(req.query.scope);
  }
  
  if (req.query.category) {
    filter.category = { $regex: req.query.category, $options: 'i' };
  }
  
  if (req.query.activity) {
    filter.activity = { $regex: req.query.activity, $options: 'i' };
  }
  
  if (req.query.status) {
    filter.status = req.query.status;
  }
  
  if (req.query.startDate || req.query.endDate) {
    filter.date = {};
    if (req.query.startDate) {
      filter.date.$gte = new Date(req.query.startDate);
    }
    if (req.query.endDate) {
      filter.date.$lte = new Date(req.query.endDate);
    }
  }
  
  // User-specific filter (contributors see only their own unless super_admin)
  if (req.user.role === 'contributor' && !req.user.restrictions?.is_super_admin) {
    filter.created_by = req.user.id;
  }
  
  return filter;
};

// ============================================
// MAIN CONTROLLER FUNCTIONS
// ============================================

/**
 * @desc    Get all emissions (scoped to organisation)
 * @route   GET /api/emissions
 * @access  Private (Admin, Analyst, Contributor, Viewer)
 */
const getEmissions = async (req, res) => {
  try {
    logger.debug('Get emissions request', {
      user: req.user.email,
      role: req.user.role,
      userOrgId: req.user.organisation_id,
      requestOrgId: req.organisationId,
      organisation: req.organisation?.name
    });

    // Validate organisation context
    if (!validateOrganisationContext(req)) {
      return res.status(403).json({
        success: false,
        message: 'Organisation membership required. Please contact administrator to assign you to an organisation.',
        code: 'NO_ORGANISATION',
        debug: {
          userId: req.user.id,
          userOrgId: req.user.organisation_id,
          reqOrgId: req.organisationId
        }
      });
    }
    
    // Build base filter with organisation
    const baseFilter = { organisation_id: req.organisationId };
    
    // Add additional filters
    const filter = buildEmissionFilter(req, baseFilter);
    
    // Get limit
    const limit = parseInt(req.query.limit) || 100;
    
    // Execute query with MongoDB
    const emissions = await Emission.find(filter)
      .sort({ date: -1, created_at: -1 })
      .limit(limit)
      .lean();

    logger.info('Emissions retrieved', {
      count: emissions.length,
      organisation: req.organisation.name,
      organisationId: req.organisationId
    });
    
    res.json({
      success: true,
      data: emissions,
      total: emissions.length,
      organisation: {
        id: req.organisation.id,
        name: req.organisation.name
      },
      filters: {
        scope: req.query.scope,
        category: req.query.category,
        status: req.query.status,
        startDate: req.query.startDate,
        endDate: req.query.endDate
      }
    });
    
  } catch (error) {
    logger.error('Get emissions error', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch emissions'
    });
  }
};

/**
 * @desc    Get emission by ID
 * @route   GET /api/emissions/:id
 * @access  Private
 */
const getEmissionById = async (req, res) => {
  try {
    const { id } = req.params;
    
    logger.debug('Fetching emission', { id, organisationId: req.organisationId });
    
    // Validate organisation context
    if (!validateOrganisationContext(req)) {
      return res.status(403).json({
        success: false,
        message: 'Organisation membership required',
        code: 'NO_ORGANISATION'
      });
    }
    
    // Find emission by ID and organisation
    const emission = await Emission.findOne({
      _id: id,
      organisation_id: req.organisationId
    }).lean();
    
    if (!emission) {
      return res.status(404).json({
        success: false,
        message: 'Emission not found or you do not have access to it'
      });
    }
    
    res.json({
      success: true,
      data: emission
    });
    
  } catch (error) {
    logger.error('Get emission by ID error', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch emission'
    });
  }
};

/**
 * @desc    Create new emission
 * @route   POST /api/emissions
 * @access  Private (Admin, Contributor)
 */
const createEmission = async (req, res) => {
  try {
    logger.debug('Create emission request', {
      user: req.user.email,
      role: req.user.role,
      organisationId: req.organisationId,
      body: req.body
    });
    
    console.log('📝 Received emission data:', JSON.stringify(req.body, null, 2));
    
    // Validate organisation context FIRST
    if (!validateOrganisationContext(req)) {
      logger.error('User has no organisation');
      return res.status(403).json({
        success: false,
        message: 'Cannot create emissions without organisation membership. Please contact administrator.',
        code: 'NO_ORGANISATION'
      });
    }
    
    // Get emission data from request
    let emissionData = req.body;
    
    // Validate required fields
    if (!emissionData.scope || (!emissionData.activity && !emissionData.source)) {
      console.log('❌ Validation failed - missing required fields:', {
        scope: emissionData.scope,
        activity: emissionData.activity,
        source: emissionData.source
      });
      return res.status(400).json({
        success: false,
        message: 'Scope and activity/source are required',
        received: {
          scope: emissionData.scope,
          activity: emissionData.activity,
          source: emissionData.source
        }
      });
    }
    
    // Validate scope value
    if (![1, 2, 3].includes(parseInt(emissionData.scope))) {
      return res.status(400).json({
        success: false,
        message: 'Scope must be 1, 2, or 3'
      });
    }
    
    // Use source as activity if activity not provided
    const activity = emissionData.activity || emissionData.source;
    const category = emissionData.category || emissionData.activityType;
    const source = emissionData.source || emissionData.subcategory;
    
    // Calculate emissions using emission factor database
    const quantity = parseFloat(emissionData.quantity || emissionData.amount || 0);
    const emissionsCalc = await calculateEmissions(
      quantity,
      parseInt(emissionData.scope),
      category,
      source
    );
    
    if (!emissionsCalc.factor) {
      return res.status(400).json({
        success: false,
        message: `No emission factor found for: ${category} - ${source} in Scope ${emissionData.scope}`
      });
    }
    
    // Add organisation data automatically
    emissionData = addOrganisationToData(req, emissionData);
    
    // CRITICAL: Double-check organisation_id was added
    if (!emissionData.organisation_id) {
      logger.error('organisation_id missing after addOrganisationToData');
      return res.status(500).json({
        success: false,
        message: 'Failed to assign organisation to emission. System error.',
        code: 'ORG_ASSIGNMENT_FAILED'
      });
    }

    if (req.user.role === 'viewer') {
      return res.status(403).json({
        success: false,
        message: 'Viewers cannot create emissions'
      });
    }

    const allowedStatuses = ['draft', 'submitted', 'verified', 'rejected'];
    let resolvedStatus = emissionData.status;
    if (!resolvedStatus || !allowedStatuses.includes(resolvedStatus)) {
      if (req.user.role === 'contributor') {
        resolvedStatus = 'submitted';
      } else if (req.user.role === 'admin' || req.user.role === 'analyst') {
        resolvedStatus = 'verified';
      } else {
        resolvedStatus = 'submitted';
      }
    }
    if (req.user.role === 'contributor' && resolvedStatus === 'verified') {
      resolvedStatus = 'submitted';
    }
    
    // Contributor RBAC: match frontend — full scope via allowedScopes, or granular via allowedActivities (category keys)
    if (req.user.role === 'contributor' && req.user.restrictions) {
      const scopeNum = parseInt(emissionData.scope, 10);
      if (
        !contributorMaySubmitEmission(
          req.user.restrictions,
          scopeNum,
          category,
          source
        )
      ) {
        const hasActs =
          Array.isArray(req.user.restrictions.allowedActivities) &&
          req.user.restrictions.allowedActivities.length > 0;
        return res.status(403).json({
          success: false,
          message: hasActs
            ? `You don't have permission to submit this emission for Scope ${scopeNum}${
                category ? ` (${category})` : ''
              }. Check your assigned activities.`
            : `You don't have access to Scope ${scopeNum}`,
          code: 'SCOPE_RESTRICTED'
        });
      }
    }
    
    const transportCheckDoc = {
      scope: parseInt(emissionData.scope),
      category,
      activityType: category,
      unit: emissionsCalc.unit,
      activityData: emissionData.activityData
    };

    let transportCategory;
    if (isMaterialTransportEmission(transportCheckDoc)) {
      if (
        emissionData.transport_category &&
        !['raw_material', 'finished_product'].includes(emissionData.transport_category)
      ) {
        return res.status(400).json({
          success: false,
          message: 'transport_category must be raw_material or finished_product'
        });
      }
      transportCategory = normalizeTransportCategory(emissionData.transport_category);
    }

    // Create new emission document (persist source/subcategory explicitly — UI Monitor/Analytics use these)
    const newEmission = new Emission({
      scope: parseInt(emissionData.scope),
      category: category,
      subcategory: source,
      source: source,
      activityType: category,
      activity: activity,
      quantity: quantity,
      amount: quantity,
      unit: emissionsCalc.unit,
      co2e: emissionsCalc.total,
      date: emissionData.date || emissionData.startDate || new Date(),
      status: resolvedStatus,
      notes: emissionData.notes || emissionData.description || null,
      organisation_id: emissionData.organisation_id,
      organisation_name: emissionData.organisation_name || req.organisation?.name,
      created_by: req.user.id, // This might be a string, MongoDB will convert it
      created_by_name: req.user.name || 'Unknown User',
      activityData: emissionData.activityData || {},
      location: emissionData.location,
      description: emissionData.description,
      startDate: emissionData.startDate,
      endDate: emissionData.endDate,
      accountingPeriod: emissionData.accountingPeriod,
      ...(transportCategory ? { transport_category: transportCategory } : {})
    });
    
    console.log('💾 About to save emission:', {
      scope: newEmission.scope,
      category: newEmission.category,
      organisation_id: newEmission.organisation_id,
      created_by: newEmission.created_by,
      created_by_type: typeof newEmission.created_by
    });
    
    // Save to MongoDB
    let savedEmission;
    try {
      savedEmission = await newEmission.save();
      console.log('✅ Emission saved successfully:', savedEmission._id);
    } catch (saveError) {
      console.error('❌ MongoDB Save Error:', {
        name: saveError.name,
        message: saveError.message,
        errors: saveError.errors,
        code: saveError.code
      });
      throw saveError; // Re-throw to be caught by outer catch
    }
    
    logger.info('Emission created successfully', {
      id: savedEmission._id,
      organisationId: savedEmission.organisation_id,
      co2e: emissionsCalc.total.toFixed(4)
    });
    
    // Sync to Activity collection for monitoring (non-blocking)
    syncToActivity(savedEmission, req.user).catch(err => {
      logger.warn('Activity sync failed but emission created', { 
        emissionId: savedEmission._id,
        error: err.message 
      });
    });

    const emissionOrgIds = [
      savedEmission.organisation_id,
      req.organisationId,
      req.organisation?.id,
      typeof req.organisation?._id?.toString === 'function'
        ? req.organisation._id.toString()
        : req.organisation?._id,
      req.user?.organisation_id
    ].filter(Boolean);

    notifyAdminsAnalystsNewEmission({
      organisationIds: emissionOrgIds,
      organisationId: savedEmission.organisation_id,
      actorUserId: req.user.id,
      actorName: req.user.name || 'User',
      emission: typeof savedEmission.toObject === 'function'
        ? savedEmission.toObject()
        : savedEmission
    }).catch((err) => {
      logger.warn('Notification enqueue failed but emission created', {
        emissionId: savedEmission._id,
        error: err.message
      });
    });
    
    res.status(201).json({
      success: true,
      data: savedEmission,
      message: 'Emission created successfully',
      calculations: {
        quantity: quantity,
        unit: emissionsCalc.unit,
        factor: emissionsCalc.factor,
        total_co2e: emissionsCalc.total.toFixed(4),
        breakdown: {
          co2: emissionsCalc.co2.toFixed(4),
          ch4: emissionsCalc.ch4.toFixed(4),
          n2o: emissionsCalc.n2o.toFixed(4)
        }
      }
    });
    
  } catch (error) {
    logger.error('Create emission error', error);
    
    // Handle MongoDB duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate emission entry detected'
      });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create emission'
    });
  }
};

/**
 * @desc    Update emission
 * @route   PATCH /api/emissions/:id
 * @access  Private (Admin, Contributor - own data)
 */
const updateEmission = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Validate organisation context
    if (!validateOrganisationContext(req)) {
      return res.status(403).json({
        success: false,
        message: 'Organisation membership required',
        code: 'NO_ORGANISATION'
      });
    }
    
    // Get the emission to check ownership and organisation
    const emission = await Emission.findOne({
      _id: id,
      organisation_id: req.organisationId
    });
    
    if (!emission) {
      return res.status(404).json({
        success: false,
        message: 'Emission not found or you do not have access to it'
      });
    }

    if (req.user.role === 'viewer') {
      return res.status(403).json({
        success: false,
        message: 'Viewers cannot update emissions'
      });
    }
    
    // Check ownership for contributors
    if (req.user.role === 'contributor' && emission.created_by.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own emissions',
        code: 'OWNERSHIP_REQUIRED'
      });
    }

    if (
      req.user.role === 'contributor' &&
      emission.status === 'verified'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Verified emissions cannot be edited. Ask an admin or analyst to make changes.',
        code: 'VERIFIED_LOCKED'
      });
    }
    
    // Check if we need to recalculate emissions
    let needsRecalculation = false;
    if (
      updates.quantity !== undefined ||
      updates.scope !== undefined ||
      updates.category !== undefined ||
      updates.activity !== undefined ||
      updates.subcategory !== undefined ||
      updates.source !== undefined
    ) {
      needsRecalculation = true;
    }
    
    // If recalculation needed, calculate new emissions
    if (needsRecalculation) {
      const newQuantity = parseFloat(updates.quantity || emission.quantity);
      const newScope = parseInt(updates.scope || emission.scope);
      const newCategory = updates.category || emission.category;
      const factorSource =
        updates.subcategory ??
        updates.source ??
        emission.subcategory ??
        emission.source ??
        updates.activity ??
        emission.activity;

      const emissionsCalc = await calculateEmissions(newQuantity, newScope, newCategory, factorSource);
      
      if (emissionsCalc.factor) {
        updates.co2e = emissionsCalc.total;
        updates.unit = emissionsCalc.unit;
      }
    }
    
    // Update only allowed fields
    const allowedFields = [
      'scope', 'category', 'subcategory', 'source', 'activityType', 'activity',
      'quantity', 'amount', 'unit', 'co2e',
      'date', 'status', 'notes', 'location', 'description',
      'transport_category', 'activityData'
    ];
    
    const updateData = {};
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    });

    if (updateData.quantity !== undefined) {
      updateData.amount = updateData.quantity;
    } else if (updateData.amount !== undefined && updateData.quantity === undefined) {
      updateData.quantity = updateData.amount;
    }

    if (updates.transport_category !== undefined) {
      const merged = {
        scope: emission.scope,
        category: updates.category || emission.category,
        activityType: updates.activityType || emission.activityType,
        unit: updates.unit || emission.unit,
        activityData: updates.activityData || emission.activityData
      };
      if (!isMaterialTransportEmission(merged)) {
        return res.status(400).json({
          success: false,
          message: 'transport_category applies only to Scope 3 material transport entries'
        });
      }
      if (!['raw_material', 'finished_product'].includes(updates.transport_category)) {
        return res.status(400).json({
          success: false,
          message: 'transport_category must be raw_material or finished_product'
        });
      }
      updateData.transport_category = normalizeTransportCategory(updates.transport_category);
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }
    
    // Perform update
    const updatedEmission = await Emission.findOneAndUpdate(
      { _id: id, organisation_id: req.organisationId },
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    if (!updatedEmission) {
      return res.status(404).json({
        success: false,
        message: 'Emission not found'
      });
    }
    
    logger.info('Emission updated successfully', {
      id: updatedEmission._id,
      recalculated: needsRecalculation
    });
    
    // Sync update to Activity collection (non-blocking)
    syncToActivity(updatedEmission, req.user, 'emission_updated').catch(err => {
      logger.warn('Activity sync failed but emission updated', { 
        emissionId: updatedEmission._id,
        error: err.message 
      });
    });

    
    res.json({
      success: true,
      data: updatedEmission,
      message: 'Emission updated successfully',
      recalculated: needsRecalculation
    });
    
  } catch (error) {
    logger.error('Update emission error', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update emission'
    });
  }
};

/**
 * @desc    Delete emission
 * @route   DELETE /api/emissions/:id
 * @access  Private (Admin, Contributor - own data)
 */
const deleteEmission = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate organisation context
    if (!validateOrganisationContext(req)) {
      return res.status(403).json({
        success: false,
        message: 'Organisation membership required',
        code: 'NO_ORGANISATION'
      });
    }
    
    // Get the emission to check ownership
    const emission = await Emission.findOne({
      _id: id,
      organisation_id: req.organisationId
    });
    
    if (!emission) {
      return res.status(404).json({
        success: false,
        message: 'Emission not found or you do not have access to it'
      });
    }

    if (req.user.role === 'viewer') {
      return res.status(403).json({
        success: false,
        message: 'Viewers cannot delete emissions'
      });
    }
    
    // Check ownership for contributors
    if (req.user.role === 'contributor' && emission.created_by.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own emissions',
        code: 'OWNERSHIP_REQUIRED'
      });
    }
    
    // Delete emission
    await Emission.deleteOne({ _id: id, organisation_id: req.organisationId });
    
    logger.info('Emission deleted successfully', {
      id: id,
      activity: emission.activity,
      co2e: emission.co2e
    });
    
    res.json({
      success: true,
      message: 'Emission deleted successfully'
    });
    
  } catch (error) {
    logger.error('Delete emission error', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete emission'
    });
  }
};

/**
 * @desc    Verify emission
 * @route   PATCH /api/emissions/:id/verify
 * @access  Private (Admin, Analyst)
 */
const verifyEmission = async (req, res) => {
  try {
    const { id } = req.params;
    const { verified } = req.body;
    
    // Validate organisation context
    if (!validateOrganisationContext(req)) {
      return res.status(403).json({
        success: false,
        message: 'Organisation membership required',
        code: 'NO_ORGANISATION'
      });
    }
    
    // Get emission
    const emission = await Emission.findOne({
      _id: id,
      organisation_id: req.organisationId
    });
    
    if (!emission) {
      return res.status(404).json({
        success: false,
        message: 'Emission not found'
      });
    }
    
    const isVerified = verified === true || verified === 'true';
    const status = isVerified ? 'verified' : 'rejected';
    const verifiedBy = isVerified ? req.user.id : null;
    const verifiedAt = isVerified ? new Date() : null;
    
    const updatedEmission = await Emission.findOneAndUpdate(
      { _id: id, organisation_id: req.organisationId },
      {
        $set: {
          status,
          verified_by: verifiedBy,
          verified_at: verifiedAt
        }
      },
      { new: true }
    );
    
    if (!updatedEmission) {
      return res.status(404).json({
        success: false,
        message: 'Emission not found'
      });
    }
    
    logger.info('Emission verification status updated', {
      id: updatedEmission._id,
      status: status
    });
    
    res.json({
      success: true,
      data: updatedEmission,
      message: isVerified
        ? 'Emission verified successfully'
        : 'Emission rejected'
    });
    
  } catch (error) {
    logger.error('Verify emission error', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to verify emission'
    });
  }
};

/**
 * @desc    Get emission statistics
 * @route   GET /api/emissions/stats
 * @access  Private (Admin, Analyst, Viewer)
 */
const getEmissionStats = async (req, res) => {
  try {
    // Validate organisation context
    if (!validateOrganisationContext(req)) {
      return res.status(403).json({
        success: false,
        message: 'Organisation membership required',
        code: 'NO_ORGANISATION'
      });
    }
    
    // Get stats by scope using MongoDB aggregation
    const scopeStats = await Emission.aggregate([
      { $match: { organisation_id: req.organisationId } },
      {
        $group: {
          _id: '$scope',
          count: { $sum: 1 },
          total_co2e: { $sum: '$co2e' },
          avg_co2e: { $avg: '$co2e' },
          min_co2e: { $min: '$co2e' },
          max_co2e: { $max: '$co2e' }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    // Get total stats
    const totalStats = await Emission.aggregate([
      { $match: { organisation_id: req.organisationId } },
      {
        $group: {
          _id: null,
          total_emissions: { $sum: 1 },
          total_co2e: { $sum: '$co2e' },
          avg_co2e: { $avg: '$co2e' },
          earliest_date: { $min: '$date' },
          latest_date: { $max: '$date' }
        }
      }
    ]);
    
    // Get status breakdown
    const statusStats = await Emission.aggregate([
      { $match: { organisation_id: req.organisationId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          total_co2e: { $sum: '$co2e' }
        }
      }
    ]);
    
    // Get category breakdown (top 10)
    const categoryStats = await Emission.aggregate([
      { 
        $match: { 
          organisation_id: req.organisationId,
          category: { $ne: null }
        } 
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          total_co2e: { $sum: '$co2e' }
        }
      },
      { $sort: { total_co2e: -1 } },
      { $limit: 10 }
    ]);
    
    res.json({
      success: true,
      data: {
        by_scope: scopeStats.map(s => ({
          scope: s._id,
          count: s.count,
          total_co2e: parseFloat((s.total_co2e || 0).toFixed(2)),
          avg_co2e: parseFloat((s.avg_co2e || 0).toFixed(2)),
          min_co2e: parseFloat((s.min_co2e || 0).toFixed(2)),
          max_co2e: parseFloat((s.max_co2e || 0).toFixed(2))
        })),
        by_status: statusStats.map(s => ({
          status: s._id,
          count: s.count,
          total_co2e: parseFloat((s.total_co2e || 0).toFixed(2))
        })),
        by_category: categoryStats.map(c => ({
          category: c._id,
          count: c.count,
          total_co2e: parseFloat((c.total_co2e || 0).toFixed(2))
        })),
        totals: totalStats.length > 0 ? {
          total_emissions: totalStats[0].total_emissions || 0,
          total_co2e: parseFloat((totalStats[0].total_co2e || 0).toFixed(2)),
          avg_co2e: parseFloat((totalStats[0].avg_co2e || 0).toFixed(2)),
          earliest_date: totalStats[0].earliest_date,
          latest_date: totalStats[0].latest_date
        } : {
          total_emissions: 0,
          total_co2e: 0,
          avg_co2e: 0,
          earliest_date: null,
          latest_date: null
        },
        organisation: {
          id: req.organisation.id,
          name: req.organisation.name
        }
      }
    });
    
  } catch (error) {
    logger.error('Get stats error', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch emission statistics'
    });
  }
};

/**
 * @desc    Get emission categories
 * @route   GET /api/emissions/categories
 * @access  Private
 */
const getEmissionCategories = async (req, res) => {
  try {
    // Validate organisation context
    if (!validateOrganisationContext(req)) {
      return res.status(403).json({
        success: false,
        message: 'Organisation membership required',
        code: 'NO_ORGANISATION'
      });
    }
    
    // Get unique categories for this organisation
    const categories = await Emission.distinct('category', {
      organisation_id: req.organisationId,
      category: { $ne: null }
    });
    
    res.json({
      success: true,
      data: categories.sort()
    });
    
  } catch (error) {
    logger.error('Get categories error', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch categories'
    });
  }
};

/**
 * @desc    Get available emission factors
 * @route   GET /api/emissions/factors
 * @access  Private
 */
const getEmissionFactors = async (req, res) => {
  try {
    const { scope, category } = req.query;
    
    if (scope && category) {
      // Return factors for specific scope and category
      const scopeKey = `scope${scope}`;
      const factors = emissionFactors[scopeKey]?.[category];
      
      if (!factors) {
        return res.status(404).json({
          success: false,
          message: 'No emission factors found for this scope and category'
        });
      }
      
      res.json({
        success: true,
        data: factors
      });
    } else if (scope) {
      // Return all categories for this scope
      const scopeKey = `scope${scope}`;
      const categories = Object.keys(emissionFactors[scopeKey] || {});
      
      res.json({
        success: true,
        data: categories
      });
    } else {
      // Return structure overview
      res.json({
        success: true,
        data: {
          scope1: Object.keys(emissionFactors.scope1 || {}),
          scope2: Object.keys(emissionFactors.scope2 || {}),
          scope3: Object.keys(emissionFactors.scope3 || {})
        }
      });
    }
    
  } catch (error) {
    logger.error('Get emission factors error', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch emission factors'
    });
  }
};

/**
 * @desc    Get user's allowed activities (RBAC)
 * @route   GET /api/emissions/user/allowed-activities
 * @access  Private
 */
const getUserAllowedActivities = async (req, res) => {
  try {
    // Admin and Analyst can access all activities
    if (['admin', 'analyst'].includes(req.user.role)) {
      return res.json({
        success: true,
        data: {
          all: true,
          allowedScopes: [1, 2, 3],
          allowedActivities: []
        }
      });
    }
    
    // Contributor with restrictions
    if (req.user.role === 'contributor' && req.user.restrictions) {
      const r = req.user.restrictions;
      return res.json({
        success: true,
        data: {
          all: false,
          allowedScopes: Array.isArray(r.allowedScopes) ? r.allowedScopes : [],
          allowedActivities: Array.isArray(r.allowedActivities) ? r.allowedActivities : []
        }
      });
    }
    
    // Viewer or contributor without restrictions
    res.json({
      success: true,
      data: {
        all: true,
        allowedScopes: [1, 2, 3],
        allowedActivities: []
      }
    });
    
  } catch (error) {
    logger.error('Get allowed activities error', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    Get emission diagnostics (troubleshooting endpoint)
 * @route   GET /api/emissions/diagnostics
 * @access  Private
 */
const getDiagnostics = async (req, res) => {
  try {
    // Get emissions count by organisation
    const emissionsByOrg = await Emission.aggregate([
      {
        $group: {
          _id: {
            organisation_id: '$organisation_id',
            organisation_name: '$organisation_name'
          },
          count: { $sum: 1 },
          total_co2e: { $sum: '$co2e' }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    // Count emissions created by this user
    const userEmissions = await Emission.countDocuments({
      created_by: req.user.id
    });
    
    // Count emissions visible to this user (with org filter)
    const visibleEmissions = req.organisationId
      ? await Emission.countDocuments({ organisation_id: req.organisationId })
      : 0;
    
    // Build issues list
    const issues = [];
    if (!req.user.organisation_id) {
      issues.push({
        severity: 'critical',
        message: 'User has no organisation_id in database',
        impact: 'Cannot create or view emissions'
      });
    }
    if (!req.organisationId) {
      issues.push({
        severity: 'critical',
        message: 'No organisation context in request',
        impact: 'All data queries will fail'
      });
    }
    if (req.user.organisation_id !== req.organisationId) {
      issues.push({
        severity: 'critical',
        message: 'User org_id does not match request org_id',
        impact: 'Data visibility mismatch'
      });
    }
    if (visibleEmissions === 0 && userEmissions > 0) {
      issues.push({
        severity: 'critical',
        message: 'User created emissions but cannot see them',
        impact: 'Data appears lost (org mismatch)'
      });
    }
    
    res.json({
      success: true,
      diagnostics: {
        database: 'MongoDB',
        user: {
          id: req.user.id,
          email: req.user.email,
          name: req.user.name,
          role: req.user.role,
          organisation_id: req.user.organisation_id,
          has_organisation: !!req.user.organisation_id
        },
        request_context: {
          organisationId: req.organisationId,
          organisation_name: req.organisation?.name || null,
          has_org_context: !!req.organisationId
        },
        emission_counts: {
          total_in_database: emissionsByOrg.reduce((sum, org) => sum + org.count, 0),
          created_by_user: userEmissions,
          visible_to_user: visibleEmissions,
          by_organisation: emissionsByOrg.map(org => ({
            organisation_id: org._id.organisation_id,
            organisation_name: org._id.organisation_name,
            count: org.count,
            total_co2e: parseFloat((org.total_co2e || 0).toFixed(2))
          }))
        },
        health: {
          status: issues.filter(i => i.severity === 'critical').length > 0 ? 'unhealthy' : 'healthy',
          issues: issues
        }
      }
    });
    
  } catch (error) {
    logger.error('Diagnostics error', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    Sync existing emissions to Activity collection (one-time migration)
 * @route   POST /api/emissions/sync-to-activities
 * @access  Private (Admin only)
 */
const syncEmissionsToActivities = async (req, res) => {
  try {
    logger.info('Starting emission to activity sync', { 
      organisationId: req.organisationId 
    });
    
    // Get all emissions for this organisation
    const emissions = await Emission.find({ 
      organisation_id: req.organisationId 
    });
    
    console.log(`🔄 Found ${emissions.length} emissions to sync`);
    
    let syncedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const emission of emissions) {
      try {
        // Check if already synced
        const existingActivity = await Activity.findOne({
          'metadata.emissionId': emission._id.toString()
        });
        
        if (existingActivity) {
          skippedCount++;
          continue;
        }
        
        // Sync to Activity
        const synced = await syncToActivity(emission, {
          id: emission.created_by,
          name: emission.created_by_name || 'Unknown',
          email: '',
          role: 'contributor'
        });
        
        if (synced) {
          syncedCount++;
        } else {
          errorCount++;
        }
        
      } catch (error) {
        logger.error('Failed to sync emission', { 
          emissionId: emission._id, 
          error: error.message 
        });
        errorCount++;
      }
    }
    
    logger.info('Sync complete', { 
      total: emissions.length,
      synced: syncedCount,
      skipped: skippedCount,
      errors: errorCount
    });
    
    res.json({
      success: true,
      data: {
        total: emissions.length,
        synced: syncedCount,
        skipped: skippedCount,
        errors: errorCount
      },
      message: `Synced ${syncedCount} emissions to activities`
    });
    
  } catch (error) {
    logger.error('Sync error', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to sync emissions'
    });
  }
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  getEmissions,
  getEmissionById,
  createEmission,
  updateEmission,
  deleteEmission,
  verifyEmission,
  getEmissionStats,
  getEmissionCategories,
  getEmissionFactors,
  getUserAllowedActivities,
  getDiagnostics,
  syncEmissionsToActivities
};