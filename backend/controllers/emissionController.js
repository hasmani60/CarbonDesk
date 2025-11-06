// backend/controllers/emissionController.js
// Updated to work with new emission factors database structure
// Version 2.1 - Enhanced with new emission factor fields

const localDB = require('../database/localDB');
const { scopeQuery, addOrganisationToData } = require('../middleware/organisationScope');
const logger = require('../utils/logger');

// Import emission factors from new database
const { emissionFactors } = require('../data/complete_emission_factors_db');

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get emission factor from new database structure
 */
const getEmissionFactor = (scope, category, source) => {
  const scopeKey = `scope${scope}`;
  const scopeData = emissionFactors[scopeKey];

  if (!scopeData || !scopeData[category] || !scopeData[category][source]) {
    logger.error('Emission factor not found', { scope, category, source });
    return null;
  }

  return scopeData[category][source];
};

/**
 * Calculate emissions using new emission factor structure
 */
const calculateEmissions = (quantity, scope, category, source) => {
  const factorData = getEmissionFactor(scope, category, source);

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
 * Build emission query with filters
 */
const buildEmissionQuery = (req, baseQuery, baseParams) => {
  let query = baseQuery;
  const params = [...baseParams];
  
  // Optional filters
  if (req.query.scope) {
    query += ' AND scope = ?';
    params.push(parseInt(req.query.scope));
  }
  
  if (req.query.category) {
    query += ' AND category LIKE ?';
    params.push(`%${req.query.category}%`);
  }
  
  if (req.query.activity) {
    query += ' AND activity LIKE ?';
    params.push(`%${req.query.activity}%`);
  }
  
  if (req.query.status) {
    query += ' AND status = ?';
    params.push(req.query.status);
  }
  
  if (req.query.startDate) {
    query += ' AND date >= ?';
    params.push(req.query.startDate);
  }
  
  if (req.query.endDate) {
    query += ' AND date <= ?';
    params.push(req.query.endDate);
  }
  
  // User-specific filter (contributors see only their own unless super_admin)
  if (req.user.role === 'contributor' && !req.user.restrictions?.is_super_admin) {
    query += ' AND created_by = ?';
    params.push(req.user.id);
  }
  
  return { query, params };
};

/**
 * Execute database query with promise
 */
const executeQuery = (query, params = []) => {
  return new Promise((resolve, reject) => {
    localDB.db.all(query, params, (err, rows) => {
      if (err) {
        logger.error('Database query error', err);
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
};

/**
 * Execute single row query
 */
const executeGetQuery = (query, params = []) => {
  return new Promise((resolve, reject) => {
    localDB.db.get(query, params, (err, row) => {
      if (err) {
        logger.error('Database query error', err);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

/**
 * Execute database insert/update/delete
 */
const executeRun = (query, params = []) => {
  return new Promise((resolve, reject) => {
    localDB.db.run(query, params, function(err) {
      if (err) {
        logger.error('Database run error', err);
        reject(err);
      } else {
        resolve(this);
      }
    });
  });
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
    
    // Build base query with organisation filter
    const baseQuery = 'SELECT * FROM emissions WHERE organisation_id = ?';
    const baseParams = [req.organisationId];
    
    // Add additional filters
    const { query: finalQuery, params: finalParams } = buildEmissionQuery(req, baseQuery, baseParams);
    
    // Add ordering
    let orderedQuery = finalQuery + ' ORDER BY date DESC, created_at DESC';

    // Add limit
    const limit = parseInt(req.query.limit) || 100;
    orderedQuery += ' LIMIT ?';
    finalParams.push(limit);

    // Execute query
    const emissions = await executeQuery(orderedQuery, finalParams);

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
    
    // Build query with organisation filter
    const query = 'SELECT * FROM emissions WHERE id = ? AND organisation_id = ?';
    const params = [id, req.organisationId];
    
    const emission = await executeGetQuery(query, params);
    
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
      organisationId: req.organisationId
    });
    
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
      return res.status(400).json({
        success: false,
        message: 'Scope and activity/source are required'
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
    
    // Calculate emissions using new emission factor database
    const quantity = parseFloat(emissionData.quantity || emissionData.amount || 0);
    const emissionsCalc = calculateEmissions(
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
    
    // Add user info
    emissionData.created_by = req.user.id;
    emissionData.created_by_name = req.user.name;
    emissionData.status = emissionData.status || 'draft';
    emissionData.date = emissionData.date || emissionData.startDate || new Date().toISOString().split('T')[0];
    emissionData.created_at = new Date().toISOString();
    
    // Check RBAC restrictions for contributors
    if (req.user.role === 'contributor' && req.user.restrictions) {
      const allowedScopes = req.user.restrictions.allowedScopes || [1, 2, 3];
      if (!allowedScopes.includes(parseInt(emissionData.scope))) {
        return res.status(403).json({
          success: false,
          message: `You don't have access to Scope ${emissionData.scope}`,
          code: 'SCOPE_RESTRICTED'
        });
      }
      
      // Check activity restrictions
      const allowedActivities = req.user.restrictions.allowedActivities || [];
      if (allowedActivities.length > 0 && !allowedActivities.includes(activity)) {
        return res.status(403).json({
          success: false,
          message: `You don't have access to activity: ${activity}`,
          code: 'ACTIVITY_RESTRICTED'
        });
      }
    }
    
    
    // Insert into database with new fields
    const query = `
      INSERT INTO emissions (
        scope, category, activity, quantity, unit, co2e,
        emissions_co2, emissions_ch4, emissions_n2o,
        emission_factor, emission_factor_unit, emission_factor_description,
        date, status, notes, verified_by, verified_at,
        organisation_id, organisation_name, 
        created_by, created_by_name, created_at,
        location, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const result = await executeRun(query, [
      emissionData.scope,
      category,
      activity,
      quantity,
      emissionsCalc.unit,
      emissionsCalc.total,
      emissionsCalc.co2,
      emissionsCalc.ch4,
      emissionsCalc.n2o,
      emissionsCalc.factor,
      emissionsCalc.unit,
      emissionsCalc.description,
      emissionData.date,
      emissionData.status,
      emissionData.notes || emissionData.description || null,
      null, // verified_by
      null, // verified_at
      emissionData.organisation_id,
      emissionData.organisation_name || req.organisation?.name,
      emissionData.created_by,
      emissionData.created_by_name,
      emissionData.created_at,
      emissionData.location || null,
      emissionData.description || null
    ]);
    
    const createdEmission = {
      id: result.lastID,
      ...emissionData,
      category,
      activity,
      quantity,
      unit: emissionsCalc.unit,
      co2e: emissionsCalc.total,
      emissions_co2: emissionsCalc.co2,
      emissions_ch4: emissionsCalc.ch4,
      emissions_n2o: emissionsCalc.n2o,
      emission_factor: emissionsCalc.factor,
      emission_factor_unit: emissionsCalc.unit,
      emission_factor_description: emissionsCalc.description
    };
    
    logger.info('Emission created successfully', {
      id: result.lastID,
      organisationId: emissionData.organisation_id,
      co2e: emissionsCalc.total.toFixed(4)
    });
    
    // Log activity
    await localDB.logActivity({
      userId: req.user.id,
      action: 'emission_created',
      resourceType: 'emission',
      resourceId: result.lastID,
      details: `Created emission: ${activity} (Scope ${emissionData.scope}) - ${emissionsCalc.total.toFixed(2)} kg CO2e`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    
    res.status(201).json({
      success: true,
      data: createdEmission,
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
    const query = 'SELECT * FROM emissions WHERE id = ? AND organisation_id = ?';
    const emission = await executeGetQuery(query, [id, req.organisationId]);
    
    if (!emission) {
      return res.status(404).json({
        success: false,
        message: 'Emission not found or you do not have access to it'
      });
    }
    
    // Check ownership for contributors
    if (req.user.role === 'contributor' && emission.created_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own emissions',
        code: 'OWNERSHIP_REQUIRED'
      });
    }
    
    // Build update query
    const fields = [];
    const updateParams = [];
    
    // Only update allowed fields
    const allowedFields = ['scope', 'category', 'activity', 'quantity', 'unit', 'date', 'status', 'notes', 'location', 'description'];
    
    // Check if we need to recalculate emissions
    let needsRecalculation = false;
    if (updates.quantity !== undefined || updates.scope !== undefined || updates.category !== undefined || updates.activity !== undefined) {
      needsRecalculation = true;
    }
    
    // If recalculation needed, calculate new emissions
    if (needsRecalculation) {
      const newQuantity = parseFloat(updates.quantity || emission.quantity);
      const newScope = parseInt(updates.scope || emission.scope);
      const newCategory = updates.category || emission.category;
      const newActivity = updates.activity || emission.activity;
      
      const emissionsCalc = calculateEmissions(newQuantity, newScope, newCategory, newActivity);
      
      if (emissionsCalc.factor) {
        updates.co2e = emissionsCalc.total;
        updates.emissions_co2 = emissionsCalc.co2;
        updates.emissions_ch4 = emissionsCalc.ch4;
        updates.emissions_n2o = emissionsCalc.n2o;
        updates.emission_factor = emissionsCalc.factor;
        updates.emission_factor_unit = emissionsCalc.unit;
        updates.emission_factor_description = emissionsCalc.description;
        
        allowedFields.push('co2e', 'emissions_co2', 'emissions_ch4', 'emissions_n2o', 'emission_factor', 'emission_factor_unit', 'emission_factor_description');
      }
    }
    
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        fields.push(`${field} = ?`);
        updateParams.push(updates[field]);
      }
    });
    
    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }
    
    // Add updated timestamp
    fields.push('updated_at = ?');
    updateParams.push(new Date().toISOString());
    
    // Add ID and organisation_id to params
    updateParams.push(id);
    updateParams.push(req.organisationId);
    
    // Update query
    const updateQuery = `UPDATE emissions SET ${fields.join(', ')} WHERE id = ? AND organisation_id = ?`;
    
    const result = await executeRun(updateQuery, updateParams);
    
    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'Emission not found or no changes made'
      });
    }
    
    // Get updated emission
    const updatedEmission = await executeGetQuery(
      'SELECT * FROM emissions WHERE id = ? AND organisation_id = ?', 
      [id, req.organisationId]
    );
    
    
    // Log activity
    await localDB.logActivity({
      userId: req.user.id,
      action: 'emission_updated',
      resourceType: 'emission',
      resourceId: id,
      details: `Updated emission: ${updatedEmission.activity}${needsRecalculation ? ' (recalculated)' : ''}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({
      success: true,
      data: updatedEmission,
      message: 'Emission updated successfully',
      recalculated: needsRecalculation
    });
    
  } catch (error) {
    logger.error('Update emission error', error);
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
    const query = 'SELECT * FROM emissions WHERE id = ? AND organisation_id = ?';
    const emission = await executeGetQuery(query, [id, req.organisationId]);
    
    if (!emission) {
      return res.status(404).json({
        success: false,
        message: 'Emission not found or you do not have access to it'
      });
    }
    
    // Check ownership for contributors
    if (req.user.role === 'contributor' && emission.created_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own emissions',
        code: 'OWNERSHIP_REQUIRED'
      });
    }
    
    // Delete emission
    const deleteResult = await executeRun(
      'DELETE FROM emissions WHERE id = ? AND organisation_id = ?',
      [id, req.organisationId]
    );
    
    if (deleteResult.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'Emission not found'
      });
    }
    
    
    // Log activity
    await localDB.logActivity({
      userId: req.user.id,
      action: 'emission_deleted',
      resourceType: 'emission',
      resourceId: id,
      details: `Deleted emission: ${emission.activity} (${emission.co2e} kg CO2e)`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
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
    const emission = await executeGetQuery(
      'SELECT * FROM emissions WHERE id = ? AND organisation_id = ?',
      [id, req.organisationId]
    );
    
    if (!emission) {
      return res.status(404).json({
        success: false,
        message: 'Emission not found'
      });
    }
    
    // Update verification status
    const status = verified ? 'verified' : 'draft';
    const verifiedBy = verified ? req.user.id : null;
    const verifiedAt = verified ? new Date().toISOString() : null;
    
    const result = await executeRun(
      'UPDATE emissions SET status = ?, verified_by = ?, verified_at = ?, updated_at = ? WHERE id = ? AND organisation_id = ?',
      [status, verifiedBy, verifiedAt, new Date().toISOString(), id, req.organisationId]
    );
    
    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'Emission not found'
      });
    }
    
    // Get updated emission
    const updatedEmission = await executeGetQuery(
      'SELECT * FROM emissions WHERE id = ?',
      [id]
    );
    
    
    // Log activity
    await localDB.logActivity({
      userId: req.user.id,
      action: verified ? 'emission_verified' : 'emission_unverified',
      resourceType: 'emission',
      resourceId: id,
      details: `${verified ? 'Verified' : 'Unverified'} emission: ${emission.activity}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({
      success: true,
      data: updatedEmission,
      message: `Emission ${verified ? 'verified' : 'unverified'} successfully`
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
    
    // Get stats by scope
    const scopeStats = await executeQuery(`
      SELECT 
        scope,
        COUNT(*) as count,
        SUM(co2e) as total_co2e,
        SUM(emissions_co2) as total_co2,
        SUM(emissions_ch4) as total_ch4,
        SUM(emissions_n2o) as total_n2o,
        AVG(co2e) as avg_co2e,
        MIN(co2e) as min_co2e,
        MAX(co2e) as max_co2e
      FROM emissions
      WHERE organisation_id = ?
      GROUP BY scope
      ORDER BY scope
    `, [req.organisationId]);
    
    // Get total stats
    const totalStats = await executeGetQuery(`
      SELECT 
        COUNT(*) as total_emissions,
        SUM(co2e) as total_co2e,
        SUM(emissions_co2) as total_co2,
        SUM(emissions_ch4) as total_ch4,
        SUM(emissions_n2o) as total_n2o,
        AVG(co2e) as avg_co2e,
        MIN(date) as earliest_date,
        MAX(date) as latest_date
      FROM emissions
      WHERE organisation_id = ?
    `, [req.organisationId]);
    
    // Get status breakdown
    const statusStats = await executeQuery(`
      SELECT 
        status,
        COUNT(*) as count,
        SUM(co2e) as total_co2e
      FROM emissions
      WHERE organisation_id = ?
      GROUP BY status
    `, [req.organisationId]);
    
    // Get category breakdown (top 10)
    const categoryStats = await executeQuery(`
      SELECT 
        category,
        COUNT(*) as count,
        SUM(co2e) as total_co2e
      FROM emissions
      WHERE organisation_id = ? AND category IS NOT NULL
      GROUP BY category
      ORDER BY total_co2e DESC
      LIMIT 10
    `, [req.organisationId]);
    
    res.json({
      success: true,
      data: {
        by_scope: scopeStats.map(s => ({
          scope: s.scope,
          count: s.count,
          total_co2e: parseFloat((s.total_co2e || 0).toFixed(2)),
          total_co2: parseFloat((s.total_co2 || 0).toFixed(2)),
          total_ch4: parseFloat((s.total_ch4 || 0).toFixed(4)),
          total_n2o: parseFloat((s.total_n2o || 0).toFixed(4)),
          avg_co2e: parseFloat((s.avg_co2e || 0).toFixed(2)),
          min_co2e: parseFloat((s.min_co2e || 0).toFixed(2)),
          max_co2e: parseFloat((s.max_co2e || 0).toFixed(2))
        })),
        by_status: statusStats.map(s => ({
          status: s.status,
          count: s.count,
          total_co2e: parseFloat((s.total_co2e || 0).toFixed(2))
        })),
        by_category: categoryStats.map(c => ({
          category: c.category,
          count: c.count,
          total_co2e: parseFloat((c.total_co2e || 0).toFixed(2))
        })),
        totals: {
          total_emissions: totalStats.total_emissions || 0,
          total_co2e: parseFloat((totalStats.total_co2e || 0).toFixed(2)),
          total_co2: parseFloat((totalStats.total_co2 || 0).toFixed(2)),
          total_ch4: parseFloat((totalStats.total_ch4 || 0).toFixed(4)),
          total_n2o: parseFloat((totalStats.total_n2o || 0).toFixed(4)),
          avg_co2e: parseFloat((totalStats.avg_co2e || 0).toFixed(2)),
          earliest_date: totalStats.earliest_date,
          latest_date: totalStats.latest_date
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
    const categories = await executeQuery(
      `SELECT DISTINCT category 
       FROM emissions 
       WHERE organisation_id = ? AND category IS NOT NULL
       ORDER BY category`,
      [req.organisationId]
    );
    
    res.json({
      success: true,
      data: categories.map(c => c.category)
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
      return res.json({
        success: true,
        data: {
          all: false,
          allowedScopes: req.user.restrictions.allowedScopes || [1, 2, 3],
          allowedActivities: req.user.restrictions.allowedActivities || []
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
    
    // Get user info
    const userInfo = await localDB.findUserById(req.user.id);
    
    // Count emissions by organisation
    const emissionsByOrg = await executeQuery(`
      SELECT 
        organisation_id, 
        organisation_name,
        COUNT(*) as count,
        SUM(co2e) as total_co2e
      FROM emissions
      GROUP BY organisation_id, organisation_name
      ORDER BY count DESC
    `);
    
    // Count emissions created by this user
    const userEmissions = await executeGetQuery(
      `SELECT 
        COUNT(*) as count,
        SUM(co2e) as total_co2e
      FROM emissions
      WHERE created_by = ?`,
      [req.user.id]
    );
    
    // Count emissions visible to this user (with org filter)
    const visibleEmissions = await executeGetQuery(
      req.organisationId
        ? 'SELECT COUNT(*) as count FROM emissions WHERE organisation_id = ?'
        : 'SELECT 0 as count',
      req.organisationId ? [req.organisationId] : []
    );
    
    // Check for orphaned emissions
    const orphanedEmissions = await executeQuery(`
      SELECT COUNT(*) as count
      FROM emissions e
      LEFT JOIN organisations o ON e.organisation_id = o.id
      WHERE o.id IS NULL AND e.organisation_id IS NOT NULL
    `);
    
    // Build issues list
    const issues = [];
    if (!userInfo.organisation_id) {
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
    if (userInfo.organisation_id !== req.organisationId) {
      issues.push({
        severity: 'critical',
        message: 'User org_id does not match request org_id',
        impact: 'Data visibility mismatch'
      });
    }
    if (visibleEmissions.count === 0 && userEmissions.count > 0) {
      issues.push({
        severity: 'critical',
        message: 'User created emissions but cannot see them',
        impact: 'Data appears lost (org mismatch)',
        action: 'Run fix script: node backend/scripts/fix-emissions-data.js'
      });
    }
    if (orphanedEmissions[0]?.count > 0) {
      issues.push({
        severity: 'warning',
        message: `${orphanedEmissions[0].count} emissions have invalid organisation_id`,
        impact: 'These emissions are invisible to all users',
        action: 'Run fix script to reassign to valid organisations'
      });
    }
    
    res.json({
      success: true,
      diagnostics: {
        user: {
          id: userInfo.id,
          email: userInfo.email,
          name: userInfo.name,
          role: userInfo.role,
          organisation_id: userInfo.organisation_id,
          has_organisation: !!userInfo.organisation_id
        },
        request_context: {
          organisationId: req.organisationId,
          organisation_name: req.organisation?.name || null,
          has_org_context: !!req.organisationId
        },
        emission_counts: {
          total_in_database: emissionsByOrg.reduce((sum, org) => sum + org.count, 0),
          created_by_user: userEmissions.count || 0,
          visible_to_user: visibleEmissions.count || 0,
          by_organisation: emissionsByOrg.map(org => ({
            organisation_id: org.organisation_id,
            organisation_name: org.organisation_name,
            count: org.count,
            total_co2e: parseFloat((org.total_co2e || 0).toFixed(2))
          }))
        },
        health: {
          status: issues.filter(i => i.severity === 'critical').length > 0 ? 'unhealthy' : 'healthy',
          issues: issues,
          recommendations: [
            'Ensure all users are assigned to organisations',
            'Run diagnostic script: node backend/scripts/diagnose-data-loss.js',
            'Run fix script if issues found: node backend/scripts/fix-emissions-data.js'
          ]
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
  getDiagnostics
};