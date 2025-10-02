// backend/controllers/emissionController.js
// Complete emissions controller with organisation scoping

const localDB = require('../database/localDB');
const { scopeQuery, addOrganisationToData } = require('../middleware/organisationScope');

// @desc    Get all emissions (scoped to organisation)
// @route   GET /api/emissions
// @access  Private (Admin, Analyst, Contributor, Viewer)
const getEmissions = async (req, res) => {
  try {
    console.log('📊 getEmissions called by user:', req.user.email, 'Org:', req.organisationId);
    
    // Get organisation filter
    const filters = scopeQuery(req);
    
    // Build SQL query
    let query = 'SELECT * FROM emissions WHERE 1=1';
    const params = [];
    
    // CRITICAL: Add organisation filter
    if (filters.organisation_id) {
      query += ' AND organisation_id = ?';
      params.push(filters.organisation_id);
      console.log('🔒 Filtering by organisation:', filters.organisation_id);
    } else {
      console.warn('⚠️  No organisation filter - user may see all data!');
    }
    
    // Add optional filters from query params
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
    
    // User-specific filter (contributors see only their own)
    if (req.user.role === 'contributor' && !req.user.restrictions?.is_super_admin) {
      query += ' AND created_by = ?';
      params.push(req.user.id);
    }
    
    // Order by date descending
    query += ' ORDER BY date DESC, created_at DESC';
    
    // Limit
    const limit = parseInt(req.query.limit) || 100;
    query += ' LIMIT ?';
    params.push(limit);
    
    console.log('🔍 SQL Query:', query);
    console.log('🔍 Params:', params);
    
    // Execute query
    const emissions = await new Promise((resolve, reject) => {
      localDB.db.all(query, params, (err, rows) => {
        if (err) {
          console.error('❌ Database error:', err);
          reject(err);
        } else {
          console.log(`✅ Found ${rows.length} emissions`);
          resolve(rows || []);
        }
      });
    });
    
    res.json({
      success: true,
      data: emissions,
      total: emissions.length,
      organisation: req.organisation?.name || 'N/A',
      filters: {
        scope: req.query.scope,
        category: req.query.category,
        status: req.query.status
      }
    });
    
  } catch (error) {
    console.error('❌ Get emissions error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch emissions'
    });
  }
};

// @desc    Get emission by ID
// @route   GET /api/emissions/:id
// @access  Private
const getEmissionById = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔍 Fetching emission:', id, 'for org:', req.organisationId);
    
    // Build query with organisation filter
    let query = 'SELECT * FROM emissions WHERE id = ?';
    const params = [id];
    
    // Add organisation filter
    if (req.organisationId) {
      query += ' AND organisation_id = ?';
      params.push(req.organisationId);
    }
    
    const emission = await new Promise((resolve, reject) => {
      localDB.db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
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
    console.error('❌ Get emission by ID error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch emission'
    });
  }
};

// @desc    Create new emission
// @route   POST /api/emissions
// @access  Private (Admin, Contributor)
const createEmission = async (req, res) => {
  try {
    console.log('➕ Creating emission for user:', req.user.email, 'Org:', req.organisationId);
    
    // Get emission data from request
    let emissionData = req.body;
    
    // Validate required fields
    if (!emissionData.scope || !emissionData.activity) {
      return res.status(400).json({
        success: false,
        message: 'Scope and activity are required'
      });
    }
    
    // Add organisation data automatically
    emissionData = addOrganisationToData(req, emissionData);
    
    // Add user info
    emissionData.created_by = req.user.id;
    emissionData.created_by_name = req.user.name;
    emissionData.status = emissionData.status || 'draft';
    emissionData.date = emissionData.date || new Date().toISOString().split('T')[0];
    emissionData.created_at = new Date().toISOString();
    
    // Check if user has access to this scope (for contributors with restrictions)
    if (req.user.role === 'contributor' && req.user.restrictions) {
      const allowedScopes = req.user.restrictions.allowedScopes || [1, 2, 3];
      if (!allowedScopes.includes(parseInt(emissionData.scope))) {
        return res.status(403).json({
          success: false,
          message: `You don't have access to Scope ${emissionData.scope}`
        });
      }
      
      // Check activity restrictions
      const allowedActivities = req.user.restrictions.allowedActivities || [];
      if (allowedActivities.length > 0 && !allowedActivities.includes(emissionData.activity)) {
        return res.status(403).json({
          success: false,
          message: `You don't have access to activity: ${emissionData.activity}`
        });
      }
    }
    
    console.log('📝 Emission data:', {
      ...emissionData,
      organisation_id: emissionData.organisation_id
    });
    
    // Insert into database
    const query = `
      INSERT INTO emissions (
        scope, category, activity, quantity, unit, co2e,
        date, status, notes, verified_by, verified_at,
        organisation_id, organisation_name, 
        created_by, created_by_name, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const result = await new Promise((resolve, reject) => {
      localDB.db.run(query, [
        emissionData.scope,
        emissionData.category || null,
        emissionData.activity,
        emissionData.quantity || 0,
        emissionData.unit || 'kg',
        emissionData.co2e || 0,
        emissionData.date,
        emissionData.status,
        emissionData.notes || null,
        null, // verified_by
        null, // verified_at
        emissionData.organisation_id,
        emissionData.organisation_name || req.organisation?.name,
        emissionData.created_by,
        emissionData.created_by_name,
        emissionData.created_at
      ], function(err) {
        if (err) {
          console.error('❌ Insert error:', err);
          reject(err);
        } else {
          console.log(`✅ Emission created with ID: ${this.lastID}`);
          resolve({ 
            id: this.lastID, 
            ...emissionData 
          });
        }
      });
    });
    
    // Log activity
    await localDB.logActivity({
      userId: req.user.id,
      action: 'emission_created',
      resourceType: 'emission',
      resourceId: result.id,
      details: `Created emission: ${emissionData.activity} (Scope ${emissionData.scope})`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.status(201).json({
      success: true,
      data: result,
      message: 'Emission created successfully'
    });
    
  } catch (error) {
    console.error('❌ Create emission error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create emission'
    });
  }
};

// @desc    Update emission
// @route   PATCH /api/emissions/:id
// @access  Private (Admin, Contributor - own data)
const updateEmission = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    console.log('✏️ Updating emission:', id, 'by user:', req.user.email);
    
    // First, get the emission to check ownership
    let query = 'SELECT * FROM emissions WHERE id = ?';
    const params = [id];
    
    // Add organisation filter
    if (req.organisationId) {
      query += ' AND organisation_id = ?';
      params.push(req.organisationId);
    }
    
    const emission = await new Promise((resolve, reject) => {
      localDB.db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
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
        message: 'You can only update your own emissions'
      });
    }
    
    // Build update query
    const fields = [];
    const updateParams = [];
    
    if (updates.scope !== undefined) {
      fields.push('scope = ?');
      updateParams.push(updates.scope);
    }
    if (updates.category !== undefined) {
      fields.push('category = ?');
      updateParams.push(updates.category);
    }
    if (updates.activity !== undefined) {
      fields.push('activity = ?');
      updateParams.push(updates.activity);
    }
    if (updates.quantity !== undefined) {
      fields.push('quantity = ?');
      updateParams.push(updates.quantity);
    }
    if (updates.unit !== undefined) {
      fields.push('unit = ?');
      updateParams.push(updates.unit);
    }
    if (updates.co2e !== undefined) {
      fields.push('co2e = ?');
      updateParams.push(updates.co2e);
    }
    if (updates.date !== undefined) {
      fields.push('date = ?');
      updateParams.push(updates.date);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      updateParams.push(updates.status);
    }
    if (updates.notes !== undefined) {
      fields.push('notes = ?');
      updateParams.push(updates.notes);
    }
    
    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }
    
    // Add updated timestamp
    fields.push('updated_at = ?');
    updateParams.push(new Date().toISOString());
    
    // Add ID to params
    updateParams.push(id);
    
    // Update query
    const updateQuery = `UPDATE emissions SET ${fields.join(', ')} WHERE id = ? AND organisation_id = ?`;
    updateParams.push(req.organisationId);
    
    await new Promise((resolve, reject) => {
      localDB.db.run(updateQuery, updateParams, function(err) {
        if (err) {
          console.error('❌ Update error:', err);
          reject(err);
        } else {
          console.log(`✅ Emission ${id} updated, changes: ${this.changes}`);
          resolve();
        }
      });
    });
    
    // Get updated emission
    const updatedEmission = await new Promise((resolve, reject) => {
      localDB.db.get(
        'SELECT * FROM emissions WHERE id = ? AND organisation_id = ?', 
        [id, req.organisationId], 
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    // Log activity
    await localDB.logActivity({
      userId: req.user.id,
      action: 'emission_updated',
      resourceType: 'emission',
      resourceId: id,
      details: `Updated emission: ${updatedEmission.activity}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({
      success: true,
      data: updatedEmission,
      message: 'Emission updated successfully'
    });
    
  } catch (error) {
    console.error('❌ Update emission error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update emission'
    });
  }
};

// @desc    Delete emission
// @route   DELETE /api/emissions/:id
// @access  Private (Admin, Contributor - own data)
const deleteEmission = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🗑️ Deleting emission:', id, 'by user:', req.user.email);
    
    // First, get the emission to check ownership
    let query = 'SELECT * FROM emissions WHERE id = ?';
    const params = [id];
    
    // Add organisation filter
    if (req.organisationId) {
      query += ' AND organisation_id = ?';
      params.push(req.organisationId);
    }
    
    const emission = await new Promise((resolve, reject) => {
      localDB.db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
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
        message: 'You can only delete your own emissions'
      });
    }
    
    // Delete emission
    await new Promise((resolve, reject) => {
      localDB.db.run(
        'DELETE FROM emissions WHERE id = ? AND organisation_id = ?',
        [id, req.organisationId],
        function(err) {
          if (err) {
            console.error('❌ Delete error:', err);
            reject(err);
          } else {
            console.log(`✅ Emission ${id} deleted, changes: ${this.changes}`);
            resolve();
          }
        }
      );
    });
    
    // Log activity
    await localDB.logActivity({
      userId: req.user.id,
      action: 'emission_deleted',
      resourceType: 'emission',
      resourceId: id,
      details: `Deleted emission: ${emission.activity}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({
      success: true,
      message: 'Emission deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ Delete emission error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete emission'
    });
  }
};

// @desc    Verify emission
// @route   PATCH /api/emissions/:id/verify
// @access  Private (Admin, Analyst)
const verifyEmission = async (req, res) => {
  try {
    const { id } = req.params;
    const { verified } = req.body;
    
    console.log('✅ Verifying emission:', id, 'by:', req.user.email);
    
    // Get emission
    const emission = await new Promise((resolve, reject) => {
      localDB.db.get(
        'SELECT * FROM emissions WHERE id = ? AND organisation_id = ?',
        [id, req.organisationId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
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
    
    await new Promise((resolve, reject) => {
      localDB.db.run(
        'UPDATE emissions SET status = ?, verified_by = ?, verified_at = ? WHERE id = ?',
        [status, verifiedBy, verifiedAt, id],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    // Get updated emission
    const updatedEmission = await new Promise((resolve, reject) => {
      localDB.db.get(
        'SELECT * FROM emissions WHERE id = ?',
        [id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
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
    console.error('❌ Verify emission error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to verify emission'
    });
  }
};

// @desc    Get emission statistics
// @route   GET /api/emissions/stats
// @access  Private (Admin, Analyst, Viewer)
const getEmissionStats = async (req, res) => {
  try {
    console.log('📊 Getting emission stats for org:', req.organisationId);
    
    // Build query with organisation filter
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (req.organisationId) {
      whereClause += ' AND organisation_id = ?';
      params.push(req.organisationId);
    }
    
    // Get stats by scope
    const scopeStats = await new Promise((resolve, reject) => {
      localDB.db.all(
        `SELECT 
          scope,
          COUNT(*) as count,
          SUM(co2e) as total_co2e,
          AVG(co2e) as avg_co2e
        FROM emissions 
        ${whereClause}
        GROUP BY scope
        ORDER BY scope`,
        params,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
    
    // Get total stats
    const totalStats = await new Promise((resolve, reject) => {
      localDB.db.get(
        `SELECT 
          COUNT(*) as total_emissions,
          SUM(co2e) as total_co2e,
          AVG(co2e) as avg_co2e,
          MIN(date) as earliest_date,
          MAX(date) as latest_date
        FROM emissions 
        ${whereClause}`,
        params,
        (err, row) => {
          if (err) reject(err);
          else resolve(row || {});
        }
      );
    });
    
    // Get status breakdown
    const statusStats = await new Promise((resolve, reject) => {
      localDB.db.all(
        `SELECT 
          status,
          COUNT(*) as count
        FROM emissions 
        ${whereClause}
        GROUP BY status`,
        params,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
    
    res.json({
      success: true,
      data: {
        by_scope: scopeStats,
        by_status: statusStats,
        totals: totalStats,
        organisation: req.organisation?.name || 'N/A'
      }
    });
    
  } catch (error) {
    console.error('❌ Get stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch emission statistics'
    });
  }
};

// @desc    Get emission categories
// @route   GET /api/emissions/categories
// @access  Private
const getEmissionCategories = async (req, res) => {
  try {
    // Get unique categories for this organisation
    const categories = await new Promise((resolve, reject) => {
      localDB.db.all(
        `SELECT DISTINCT category 
        FROM emissions 
        WHERE organisation_id = ? AND category IS NOT NULL
        ORDER BY category`,
        [req.organisationId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows?.map(r => r.category) || []);
        }
      );
    });
    
    res.json({
      success: true,
      data: categories
    });
    
  } catch (error) {
    console.error('❌ Get categories error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch categories'
    });
  }
};

// @desc    Get user's allowed activities
// @route   GET /api/emissions/user/allowed-activities
// @access  Private
const getUserAllowedActivities = async (req, res) => {
  try {
    // Admin and Analyst can access all activities
    if (['admin', 'analyst'].includes(req.user.role)) {
      return res.json({
        success: true,
        data: {
          all: true,
          activities: []
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
        activities: []
      }
    });
    
  } catch (error) {
    console.error('❌ Get allowed activities error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  getEmissions,
  getEmissionById,
  createEmission,
  updateEmission,
  deleteEmission,
  verifyEmission,
  getEmissionStats,
  getEmissionCategories,
  getUserAllowedActivities
};