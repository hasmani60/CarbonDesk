// backend/controllers/organisationController.js
// Controller for organisation information (for regular admins, not company operators)

const localDB = require('../database/localDB');

// @desc    Get organisation details for current user's organisation
// @route   GET /api/organisation/details
// @access  Private (Admin only)
const getOrganisationDetails = async (req, res) => {
  try {
    const organisationId = req.organisationId;
    
    console.log('🏢 getOrganisationDetails called');
    console.log('   User ID:', req.user?.id);
    console.log('   User Email:', req.user?.email);
    console.log('   Organisation ID:', organisationId);
    
    if (!organisationId) {
      return res.status(404).json({
        success: false,
        message: 'No organisation assigned to your account'
      });
    }

    // Get organisation details
    const organisation = await localDB.findOrganisationById(organisationId);
    
    if (!organisation) {
      console.error('❌ Organisation not found for ID:', organisationId);
      return res.status(404).json({
        success: false,
        message: 'Organisation not found'
      });
    }

    console.log('✅ Organisation found:', organisation.name);

    // Get organisation settings
    const settings = await localDB.getOrganisationSettings(organisationId);
    console.log('✅ Organisation settings retrieved');
    
    // Get organisation stats with detailed logging
    console.log('📊 Fetching organisation stats for:', organisationId);
    const stats = await localDB.getOrganisationStats(organisationId);
    console.log('📊 Stats received from database:', stats);

    const responseData = {
      success: true,
      data: {
        organisation: {
          id: organisation.id,
          name: organisation.name,
          display_name: organisation.display_name,
          industry_type: organisation.industry_type,
          location: organisation.location,
          contact_email: organisation.contact_email,
          contact_phone: organisation.contact_phone,
          address: organisation.address,
          website: organisation.website,
          
          // Organisation Details (NEW)
          registered_name: organisation.registered_name,
          cin_number: organisation.cin_number,
          registered_address: organisation.registered_address,
          gst_number: organisation.gst_number,
          current_employees: organisation.current_employees,
          
          // System Info
          subscription_tier: organisation.subscription_tier,
          max_users: organisation.max_users,
          max_storage_gb: organisation.max_storage_gb,
          is_active: organisation.is_active,
          created_at: organisation.created_at,
          created_by: organisation.created_by,
          notes: organisation.notes
        },
        settings: settings || {},
        stats: stats || {}
      }
    };

    console.log('✅ Sending response with stats:', responseData.data.stats);
    res.json(responseData);

  } catch (error) {
    console.error('❌ Get organisation details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve organisation details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Update organisation details (for admins)
// @route   PATCH /api/organisation/details
// @access  Private (Admin only)
const updateOrganisationDetails = async (req, res) => {
  try {
    const organisationId = req.organisationId;
    
    console.log('🏢 updateOrganisationDetails called');
    console.log('   User ID:', req.user?.id);
    console.log('   Organisation ID:', organisationId);
    console.log('   Updates:', Object.keys(req.body));
    
    if (!organisationId) {
      return res.status(404).json({
        success: false,
        message: 'No organisation assigned to your account'
      });
    }

    const updates = req.body;
    
    // Remove fields that shouldn't be updated by regular admins
    delete updates.id;
    delete updates.created_at;
    delete updates.created_by;
    delete updates.subscription_tier; // Only company operators can change this
    delete updates.max_users; // Only company operators can change this
    delete updates.is_active; // Only company operators can change this

    await localDB.updateOrganisation(organisationId, updates);
    console.log('✅ Organisation updated successfully');

    // Log activity
    await localDB.logActivity({
      userId: req.user.id,
      action: 'organisation_updated',
      resourceType: 'organisation',
      resourceId: organisationId,
      details: `Updated organisation details: ${Object.keys(updates).join(', ')}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    const updatedOrg = await localDB.findOrganisationById(organisationId);

    res.json({
      success: true,
      message: 'Organisation details updated successfully',
      data: updatedOrg
    });

  } catch (error) {
    console.error('❌ Update organisation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update organisation details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getOrganisationDetails,
  updateOrganisationDetails
};