// controllers/companyController.js - Fixed to set both _id and id for Organisation
const jwt = require('jsonwebtoken');
const { CompanyOperator, Organisation, OrganisationSettings, User, ActivityLog } = require('../models');
const bcrypt = require('bcryptjs');
const emailService = require('../utils/emailService');
const logger = require('../utils/logger');

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
};

const verifyPassword = async (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword);
};

/** Resolve the primary org admin (bootstrap super admin) for password resets. */
const getBootstrapSuperAdminForOrg = async (orgId) => {
  const org = await Organisation.findOne({ id: orgId }).lean();
  if (!org) return null;
  if (org.bootstrap_admin_user_id) {
    const byId = await User.findById(org.bootstrap_admin_user_id);
    if (byId && byId.organisation_id === orgId && byId.role === 'admin') {
      return byId;
    }
  }
  return User.findOne({ organisation_id: orgId, role: 'admin' }).sort({ created_at: 1 });
};

const generateCompanyToken = (operator) => {
  return jwt.sign(
    {
      id: operator._id.toString(),
      email: operator.email,
      role: operator.role,
      type: 'company_operator'
    },
    process.env.COMPANY_JWT_SECRET || process.env.JWT_SECRET || 'company-secret-key',
    { expiresIn: '8h' }
  );
};

// @desc    Company operator login
// @route   POST /api/company/auth/login
// @access  Public
const companyLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    const operator = await CompanyOperator.findOne({ email: email.toLowerCase() });

    if (!operator) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (!operator.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account is not active'
      });
    }

    const isPasswordCorrect = await verifyPassword(password, operator.password);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    operator.last_login = new Date();
    await operator.save();

    const token = generateCompanyToken(operator);

    return res.json({
      success: true,
      data: {
        token,
        operator: {
          id: operator._id.toString(),
          name: operator.name,
          email: operator.email,
          role: operator.role,
          permissions: {
            canCreateOrgs: operator.can_create_orgs,
            canManageOrgs: operator.can_manage_orgs,
            canViewAllOrgs: operator.can_view_all_orgs
          }
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.'
    });
  }
};

// @desc    Create new organisation
// @route   POST /api/company/organisations
// @access  Private (Company operators only)
const createOrganisation = async (req, res) => {
  try {
    const {
      name,
      display_name,
      industry_type,
      location,
      contact_email,
      contact_phone,
      address,
      website,
      subscription_tier,
      max_users,
      max_storage_gb,
      notes,
      registered_name,
      cin_number,
      registered_address,
      gst_number,
      current_employees,
      super_admin_name,
      super_admin_email,
      super_admin_password,
      settings
    } = req.body;

    if (!name || !industry_type || !contact_email) {
      return res.status(400).json({
        success: false,
        message: 'Organisation name, industry type, and contact email are required'
      });
    }

    if (!registered_address || !current_employees) {
      return res.status(400).json({
        success: false,
        message: 'Registered address and current employees are required'
      });
    }

    if (!super_admin_name || !super_admin_email || !super_admin_password) {
      return res.status(400).json({
        success: false,
        message: 'Super Admin details are required'
      });
    }

    const existingOrg = await Organisation.findOne({
      name: new RegExp(`^${name}$`, 'i')
    });

    if (existingOrg) {
      return res.status(400).json({
        success: false,
        message: 'Organisation with this name already exists'
      });
    }

    const existingSuperAdmin = await User.findOne({ email: super_admin_email.toLowerCase() });
    if (existingSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Super Admin email already exists'
      });
    }

    // Generate unique org ID
    const orgId = `org_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // FIXED: Set both _id and id to the same value
    const organisation = await Organisation.create({
      _id: orgId,  // CRITICAL: Must set _id for custom string ID
      id: orgId,   // Also set id field
      name,
      display_name: display_name || name,
      industry_type,
      location,
      contact_email,
      contact_phone,
      address,
      website,
      subscription_tier: subscription_tier || 'standard',
      max_users: max_users || 50,
      max_storage_gb: max_storage_gb || 10,
      registered_name: registered_name || name,
      cin_number,
      registered_address,
      gst_number,
      current_employees: parseInt(current_employees),
      created_by: req.companyOperator.email,
      notes: notes || `Created by ${req.companyOperator.name}`
    });

    await OrganisationSettings.create({
      organisation_id: orgId,
      ...settings
    });

    const hashedPassword = await hashPassword(super_admin_password);
    const superAdmin = await User.create({
      name: super_admin_name,
      email: super_admin_email.toLowerCase(),
      password: hashedPassword,
      role: 'admin',
      status: 'active',
      organisation_id: orgId // String ID
    });

    await Organisation.findOneAndUpdate(
      { id: orgId },
      { $set: { bootstrap_admin_user_id: superAdmin._id.toString() } }
    );

    res.status(201).json({
      success: true,
      message: 'Organisation and Super Admin created successfully',
      data: {
        organisation: {
          id: organisation.id,
          name: organisation.name,
          display_name: organisation.display_name
        },
        super_admin: {
          id: superAdmin._id.toString(),
          name: superAdmin.name,
          email: superAdmin.email
        }
      }
    });

  } catch (error) {
    console.error('Create organisation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create organisation'
    });
  }
};

// @desc    Get all organisations
// @route   GET /api/company/organisations
// @access  Private
const getAllOrganisations = async (req, res) => {
  try {
    const { is_active, industry_type, limit, search } = req.query;

    const query = {};

    if (is_active !== undefined) {
      query.is_active = is_active === 'true';
    }

    if (industry_type && industry_type !== 'all') {
      query.industry_type = industry_type;
    }

    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { display_name: new RegExp(search, 'i') }
      ];
    }

    let orgsQuery = Organisation.find(query).sort({ created_at: -1 });

    if (limit) {
      orgsQuery = orgsQuery.limit(parseInt(limit));
    }

    const organisations = await orgsQuery;

    res.json({
      success: true,
      data: organisations,
      total: organisations.length
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve organisations'
    });
  }
};

// Placeholder for other company controller functions
const getOrganisationById = async (req, res) => {
  try {
    const organisation = await Organisation.findOne({ id: req.params.id });
    if (!organisation) {
      return res.status(404).json({ success: false, message: 'Organisation not found' });
    }
    const bootstrapUser = await getBootstrapSuperAdminForOrg(req.params.id);
    const payload = organisation.toObject();
    payload.bootstrap_super_admin = bootstrapUser
      ? {
          id: bootstrapUser._id.toString(),
          name: bootstrapUser.name,
          email: bootstrapUser.email
        }
      : null;
    res.json({ success: true, data: payload });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateOrganisation = async (req, res) => {
  try {
    const updates = req.body;
    delete updates.id;
    delete updates._id;
    
    const org = await Organisation.findOneAndUpdate(
      { id: req.params.id },
      { $set: updates },
      { new: true }
    );
    
    res.json({ success: true, data: org });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deactivateOrganisation = async (req, res) => {
  try {
    await Organisation.findOneAndUpdate(
      { id: req.params.id },
      { $set: { is_active: false } }
    );
    res.json({ success: true, message: 'Organisation deactivated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getOrganisationStats = async (req, res) => {
  try {
    const orgId = req.params.id;
    const totalUsers = await User.countDocuments({ organisation_id: orgId });
    res.json({ success: true, data: { stats: { totalUsers } } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Set a new password for the organisation bootstrap super admin (company operations)
// @route   PATCH /api/company/organisations/:id/super-admin-password
// @access  Private (company operators with can_manage_orgs)
const resetSuperAdminPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    const orgId = req.params.id;

    if (!newPassword || typeof newPassword !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'newPassword is required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    const organisation = await Organisation.findOne({ id: orgId });
    if (!organisation) {
      return res.status(404).json({ success: false, message: 'Organisation not found' });
    }

    const superAdmin = await getBootstrapSuperAdminForOrg(orgId);
    if (!superAdmin) {
      return res.status(404).json({
        success: false,
        message: 'No organisation admin account found to update'
      });
    }

    superAdmin.password = await hashPassword(newPassword);
    superAdmin.password_reset_token = null;
    superAdmin.password_reset_expires = null;
    await superAdmin.save();

    let mail = { sent: false };
    try {
      mail = await emailService.sendPasswordChangedConfirmation(
        { name: superAdmin.name, email: superAdmin.email },
        { ip: req.ip }
      );
    } catch (emailErr) {
      logger.warn('Super-admin password reset confirmation email error', emailErr.message);
    }

    return res.json({
      success: true,
      message: 'Super admin password updated',
      data: {
        super_admin: {
          id: superAdmin._id.toString(),
          email: superAdmin.email
        },
        emailConfirmationSent: mail.sent === true
      }
    });
  } catch (error) {
    console.error('resetSuperAdminPassword error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to reset super admin password'
    });
  }
};

const getCompanyProfile = async (req, res) => {
  try {
    const operator = await CompanyOperator.findById(req.companyOperator.id).select('-password');
    res.json({ success: true, data: operator });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getCompanyDashboard = async (req, res) => {
  try {
    const allOrgs = await Organisation.find();
    res.json({
      success: true,
      data: {
        stats: { total_organisations: allOrgs.length },
        organisations: allOrgs.slice(0, 10)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  companyLogin,
  createOrganisation,
  getAllOrganisations,
  getOrganisationById,
  updateOrganisation,
  deactivateOrganisation,
  getOrganisationStats,
  resetSuperAdminPassword,
  getCompanyProfile,
  getCompanyDashboard
};