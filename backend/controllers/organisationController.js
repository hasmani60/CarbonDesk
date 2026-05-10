// controllers/organisationController.js - Compatible with String IDs (FIXED)
const { Organisation, OrganisationSettings, User, ActivityLog, Emission, Task } = require('../models');

/** Company portal seed operator → product company name shown as "Created by". */
function formatCreatedByForResponse(raw) {
  if (raw == null || raw === '') return raw;
  const e = String(raw).trim().toLowerCase();
  if (e === 'admin@carbontrack-company.com') return 'NatureMark Systems';
  return raw;
}

/** Users may reference org by `_id`, `id`, or legacy/alternate field spellings. */
function collectOrgIdVariants(reqOrgId, organisationDoc) {
  const set = new Set();
  if (reqOrgId != null && reqOrgId !== '') set.add(String(reqOrgId).trim());
  if (organisationDoc) {
    const o = organisationDoc.toObject ? organisationDoc.toObject() : organisationDoc;
    if (o._id != null) set.add(String(o._id).trim());
    if (o.id != null) set.add(String(o.id).trim());
  }
  return [...set];
}

function matchDocumentsForOrgIds(fieldNames, orgIds) {
  if (!orgIds.length) {
    return { [fieldNames[0]]: '__no_org_match__' };
  }
  const or = [];
  for (const id of orgIds) {
    for (const field of fieldNames) {
      or.push({ [field]: id });
    }
  }
  return { $or: or };
}

// @desc    Get organisation details
// @route   GET /api/organisations/details
// @access  Private (Admin only)
const getOrganisationDetails = async (req, res) => {
  try {
    const organisationId = req.organisationId; // String
    
    if (!organisationId) {
      return res.status(404).json({
        success: false,
        message: 'No organisation assigned to your account'
      });
    }

    // FIXED: Find by _id field (which is the string ID users are linked to)
    const organisation = await Organisation.findById(organisationId);
    
    if (!organisation) {
      return res.status(404).json({
        success: false,
        message: 'Organisation not found'
      });
    }

    // Get settings
    let settings = await OrganisationSettings.findOne({ organisation_id: organisationId });
    if (!settings) {
      settings = await OrganisationSettings.create({
        organisation_id: organisationId
      });
    }

    const orgIdVariants = collectOrgIdVariants(organisationId, organisation);
    const userOrgMatch = matchDocumentsForOrgIds(
      ['organisation_id', 'organization_id'],
      orgIdVariants
    );
    const resourceOrgMatch = matchDocumentsForOrgIds(['organisation_id'], orgIdVariants);
    
    const [summaryRow] = await User.aggregate([
      { $match: userOrgMatch },
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: {
            $sum: {
              $cond: [{ $eq: [{ $toLower: { $ifNull: ['$status', ''] } }, 'active'] }, 1, 0]
            }
          },
          inactiveUsers: {
            $sum: {
              $cond: [{ $ne: [{ $toLower: { $ifNull: ['$status', ''] } }, 'active'] }, 1, 0]
            }
          }
        }
      }
    ]);

    const roleRows = await User.aggregate([
      { $match: userOrgMatch },
      {
        $group: {
          _id: {
            $toLower: { $trim: { input: { $ifNull: ['$role', 'contributor'] } } }
          },
          n: { $sum: 1 }
        }
      }
    ]);

    const totalUsers = summaryRow ? summaryRow.totalUsers : 0;
    const activeUsers = summaryRow ? summaryRow.activeUsers : 0;
    const inactiveUsers = summaryRow ? summaryRow.inactiveUsers : 0;

    const roleMap = Object.fromEntries(
      roleRows.filter((r) => r._id).map((r) => [r._id, r.n])
    );
    let admins = roleMap.admin || 0;
    let analysts = roleMap.analyst || 0;
    let contributors = roleMap.contributor || 0;
    let viewers = roleMap.viewer || 0;
    const knownRoleSum = admins + analysts + contributors + viewers;
    if (totalUsers > knownRoleSum) {
      contributors += totalUsers - knownRoleSum;
    }
    
    const orgUserIds = await User.find(userOrgMatch).distinct('_id');
    const orgUserIdStrings = orgUserIds.map((id) => String(id));
    const totalActivities = orgUserIdStrings.length
      ? await ActivityLog.countDocuments({ user_id: { $in: orgUserIdStrings } })
      : 0;
    
    const totalEmissions = await Emission.countDocuments(resourceOrgMatch);
    const pendingEmissions = await Emission.countDocuments({
      $and: [resourceOrgMatch, { status: { $in: ['pending', 'submitted'] } }]
    });
    const verifiedEmissions = await Emission.countDocuments({
      $and: [resourceOrgMatch, { status: 'verified' }]
    });
    
    const totalTasks = await Task.countDocuments(resourceOrgMatch);
    const pendingTasks = await Task.countDocuments({
      $and: [resourceOrgMatch, { status: 'pending' }]
    });
    const completedTasks = await Task.countDocuments({
      $and: [resourceOrgMatch, { status: 'completed' }]
    });
    
    const stats = {
      totalUsers,
      activeUsers,
      inactiveUsers,
      admins,
      analysts,
      contributors,
      viewers,
      totalActivities,
      totalEmissions,
      pendingEmissions,
      verifiedEmissions,
      totalTasks,
      pendingTasks,
      completedTasks
    };

    res.json({
      success: true,
      data: {
        organisation: {
          id: organisation.id,
          _id: organisation._id,
          name: organisation.name,
          display_name: organisation.display_name,
          industry_type: organisation.industry_type,
          location: organisation.location,
          contact_email: organisation.contact_email,
          contact_phone: organisation.contact_phone,
          address: organisation.address,
          website: organisation.website,
          registered_name: organisation.registered_name,
          cin_number: organisation.cin_number,
          registered_address: organisation.registered_address,
          gst_number: organisation.gst_number,
          current_employees: organisation.current_employees,
          subscription_tier: organisation.subscription_tier,
          max_users: organisation.max_users,
          max_storage_gb: organisation.max_storage_gb,
          is_active: organisation.is_active,
          created_at: organisation.created_at,
          created_by: formatCreatedByForResponse(organisation.created_by),
          notes: organisation.notes
        },
        settings: settings.toObject(),
        stats
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve organisation details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Update organisation details
// @route   PATCH /api/organisations/details
// @access  Private (Admin only)
const updateOrganisationDetails = async (req, res) => {
  try {
    const organisationId = req.organisationId;
    
    if (!organisationId) {
      return res.status(404).json({
        success: false,
        message: 'No organisation assigned to your account'
      });
    }

    const updates = { ...req.body };
    
    // Remove protected fields
    delete updates.id;
    delete updates._id;
    delete updates.created_at;
    delete updates.created_by;
    delete updates.subscription_tier;
    delete updates.max_users;
    delete updates.is_active;

    updates.updated_at = new Date();

    // FIXED: Update using findByIdAndUpdate
    const updatedOrg = await Organisation.findByIdAndUpdate(
      organisationId,
      { $set: updates },
      { new: true }
    );

    if (!updatedOrg) {
      return res.status(404).json({
        success: false,
        message: 'Organisation not found'
      });
    }

    await ActivityLog.create({
      user_id: req.user.id,
      action: 'organisation_updated',
      resource_type: 'organisation',
      resource_id: organisationId,
      details: `Updated organisation details: ${Object.keys(updates).join(', ')}`,
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Organisation details updated successfully',
      data: updatedOrg
    });

  } catch (error) {
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