// backend/controllers/companyController.js
// COMPANY-ONLY Operations - Hidden from regular users

const jwt = require('jsonwebtoken');
const localDB = require('../database/localDB');

// Generate JWT for company operators
const generateCompanyToken = (operator) => {
  return jwt.sign(
    { 
      id: operator.id,
      email: operator.email,
      role: operator.role,
      type: 'company_operator'
    }, 
    process.env.COMPANY_JWT_SECRET || process.env.JWT_SECRET || 'company-secret-key',
    { expiresIn: '8h' } // Shorter expiry for company operators
  );
};

// @desc    Company operator login (HIDDEN endpoint)
// @route   POST /api/company/auth/login
// @access  Public (but hidden)
const companyLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔐 Company operator login attempt:', { email });

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find company operator
    const operator = await localDB.findCompanyOperatorByEmail(email.toLowerCase());
    
    if (!operator) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if account is active
    if (!operator.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account is not active'
      });
    }

    // Check if account is locked
    if (operator.locked_until && new Date(operator.locked_until) > new Date()) {
      return res.status(403).json({
        success: false,
        message: 'Account is temporarily locked due to failed login attempts'
      });
    }

    // Verify password
    const isPasswordCorrect = await localDB.verifyPassword(password, operator.password);
    
    if (!isPasswordCorrect) {
      // Increment failed attempts (implement this in localDB if needed)
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    await localDB.updateCompanyOperatorLogin(operator.id);

    const token = generateCompanyToken(operator);

    console.log('✅ Company operator login successful:', email);

    return res.json({
      success: true,
      data: {
        token,
        operator: {
          id: operator.id,
          name: operator.name,
          email: operator.email,
          role: operator.role,
          permissions: {
            canCreateOrgs: operator.can_create_orgs === 1,
            canManageOrgs: operator.can_manage_orgs === 1,
            canViewAllOrgs: operator.can_view_all_orgs === 1
          }
        }
      }
    });

  } catch (error) {
    console.error('Company login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.'
    });
  }
};

// @desc    Create new organisation with Super Admin
// @route   POST /api/company/organisations
// @access  Private (Company operators only)
const createOrganisation = async (req, res) => {
  try {
    const {
      // Organisation details
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
      
      // Super Admin details
      super_admin_name,
      super_admin_email,
      super_admin_password,
      
      // Optional settings
      settings
    } = req.body;

    console.log('🏢 Creating new organisation:', name);

    // Validate required fields
    if (!name || !industry_type || !contact_email) {
      return res.status(400).json({
        success: false,
        message: 'Organisation name, industry type, and contact email are required'
      });
    }

    if (!super_admin_name || !super_admin_email || !super_admin_password) {
      return res.status(400).json({
        success: false,
        message: 'Super Admin name, email, and password are required'
      });
    }

    // Check if organisation with similar name exists
    const existingOrgs = await localDB.getAllOrganisations({ search: name });
    if (existingOrgs && existingOrgs.length > 0) {
      const exactMatch = existingOrgs.find(org => 
        org.name.toLowerCase() === name.toLowerCase()
      );
      if (exactMatch) {
        return res.status(400).json({
          success: false,
          message: 'Organisation with this name already exists'
        });
      }
    }

    // Check if Super Admin email already exists
    const existingSuperAdmin = await localDB.findUserByEmail(super_admin_email);
    if (existingSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Super Admin email already exists in the system'
      });
    }

    // Step 1: Create Organisation
    const organisation = await localDB.createOrganisation({
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
      created_by: req.companyOperator.email,
      notes: notes || `Created by ${req.companyOperator.name}`
    });

    console.log('✅ Organisation created:', organisation.id);

    // Step 2: Create Organisation Settings
    await localDB.createOrganisationSettings(organisation.id, settings || {});
    console.log('✅ Organisation settings initialized');

    // Step 3: Create Super Admin user
    const superAdmin = await localDB.createSuperAdmin({
      name: super_admin_name,
      email: super_admin_email,
      password: super_admin_password
    }, organisation.id);

    console.log('✅ Super Admin created:', superAdmin.email);

    // Step 4: Log organisation creation activity
    await localDB.logOrganisationActivity({
      organisation_id: organisation.id,
      action: 'org_created',
      actor_type: 'company_operator',
      actor_id: req.companyOperator.id,
      actor_name: req.companyOperator.name,
      details: {
        organisation_name: name,
        super_admin_email: super_admin_email,
        subscription_tier: subscription_tier || 'standard'
      },
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    console.log('✅ Organisation creation complete');

    res.status(201).json({
      success: true,
      message: 'Organisation and Super Admin created successfully',
      data: {
        organisation: {
          id: organisation.id,
          name: organisation.name,
          display_name: organisation.display_name,
          industry_type: organisation.industry_type,
          contact_email: organisation.contact_email,
          subscription_tier: organisation.subscription_tier || 'standard',
          max_users: organisation.max_users || 50
        },
        super_admin: {
          id: superAdmin.id,
          name: superAdmin.name,
          email: superAdmin.email,
          role: superAdmin.role
        }
      }
    });

  } catch (error) {
    console.error('Organisation creation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create organisation'
    });
  }
};

// @desc    Get all organisations
// @route   GET /api/company/organisations
// @access  Private (Company operators only)
const getAllOrganisations = async (req, res) => {
  try {
    const { search, is_active, industry_type, limit } = req.query;

    const organisations = await localDB.getAllOrganisations({
      search,
      is_active: is_active !== undefined ? is_active === 'true' : undefined,
      industry_type,
      limit: limit ? parseInt(limit) : undefined
    });

    // Get stats for each organisation
    const orgsWithStats = await Promise.all(
      organisations.map(async (org) => {
        const stats = await localDB.getOrganisationStats(org.id);
        return {
          ...org,
          stats
        };
      })
    );

    res.json({
      success: true,
      data: orgsWithStats,
      total: orgsWithStats.length
    });

  } catch (error) {
    console.error('Get organisations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve organisations'
    });
  }
};

// @desc    Get organisation by ID
// @route   GET /api/company/organisations/:id
// @access  Private (Company operators only)
const getOrganisationById = async (req, res) => {
  try {
    const { id } = req.params;

    const organisation = await localDB.findOrganisationById(id);
    
    if (!organisation) {
      return res.status(404).json({
        success: false,
        message: 'Organisation not found'
      });
    }

    // Get settings
    const settings = await localDB.getOrganisationSettings(id);
    
    // Get stats
    const stats = await localDB.getOrganisationStats(id);
    
    // Get recent activities
    const activities = await localDB.getOrganisationActivities(id, 10);

    res.json({
      success: true,
      data: {
        ...organisation,
        settings,
        stats,
        recent_activities: activities
      }
    });

  } catch (error) {
    console.error('Get organisation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve organisation'
    });
  }
};

// @desc    Update organisation
// @route   PATCH /api/company/organisations/:id
// @access  Private (Company operators only)
const updateOrganisation = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Remove fields that shouldn't be updated directly
    delete updates.id;
    delete updates.created_at;
    delete updates.created_by;

    await localDB.updateOrganisation(id, updates);

    // Log activity
    await localDB.logOrganisationActivity({
      organisation_id: id,
      action: 'org_updated',
      actor_type: 'company_operator',
      actor_id: req.companyOperator.id,
      actor_name: req.companyOperator.name,
      details: { updated_fields: Object.keys(updates) },
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    const updatedOrg = await localDB.findOrganisationById(id);

    res.json({
      success: true,
      message: 'Organisation updated successfully',
      data: updatedOrg
    });

  } catch (error) {
    console.error('Update organisation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update organisation'
    });
  }
};

// @desc    Deactivate organisation
// @route   DELETE /api/company/organisations/:id
// @access  Private (Company operators only)
const deactivateOrganisation = async (req, res) => {
  try {
    const { id } = req.params;

    await localDB.deactivateOrganisation(id);

    // Log activity
    await localDB.logOrganisationActivity({
      organisation_id: id,
      action: 'org_deactivated',
      actor_type: 'company_operator',
      actor_id: req.companyOperator.id,
      actor_name: req.companyOperator.name,
      details: { reason: req.body.reason || 'Not specified' },
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Organisation deactivated successfully'
    });

  } catch (error) {
    console.error('Deactivate organisation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate organisation'
    });
  }
};

// @desc    Get organisation statistics
// @route   GET /api/company/organisations/:id/stats
// @access  Private (Company operators only)
const getOrganisationStats = async (req, res) => {
  try {
    const { id } = req.params;

    const stats = await localDB.getOrganisationStats(id);
    const activities = await localDB.getOrganisationActivities(id, 50);

    res.json({
      success: true,
      data: {
        stats,
        activity_count: activities.length,
        last_activity: activities[0] || null
      }
    });

  } catch (error) {
    console.error('Get org stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve statistics'
    });
  }
};

// @desc    Get company operator profile
// @route   GET /api/company/auth/profile
// @access  Private (Company operators only)
const getCompanyProfile = async (req, res) => {
  try {
    const operator = await localDB.findCompanyOperatorById(req.companyOperator.id);
    
    if (!operator) {
      return res.status(404).json({
        success: false,
        message: 'Operator not found'
      });
    }

    // Remove sensitive data
    delete operator.password;
    delete operator.failed_login_attempts;
    delete operator.locked_until;

    res.json({
      success: true,
      data: operator
    });

  } catch (error) {
    console.error('Get company profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve profile'
    });
  }
};

// @desc    Get dashboard summary for company operators
// @route   GET /api/company/dashboard
// @access  Private (Company operators only)
const getCompanyDashboard = async (req, res) => {
  try {
    const allOrgs = await localDB.getAllOrganisations();
    
    const stats = {
      total_organisations: allOrgs.length,
      active_organisations: allOrgs.filter(org => org.is_active).length,
      inactive_organisations: allOrgs.filter(org => !org.is_active).length,
      total_users: 0,
      active_users: 0,
      by_subscription: {
        basic: 0,
        standard: 0,
        premium: 0
      },
      by_industry: {}
    };

    // Calculate totals
    for (const org of allOrgs) {
      const orgStats = await localDB.getOrganisationStats(org.id);
      stats.total_users += orgStats.totalUsers || 0;
      stats.active_users += orgStats.activeUsers || 0;
      
      // Count by subscription
      const tier = org.subscription_tier || 'standard';
      stats.by_subscription[tier] = (stats.by_subscription[tier] || 0) + 1;
      
      // Count by industry
      stats.by_industry[org.industry_type] = (stats.by_industry[org.industry_type] || 0) + 1;
    }

    // Get recent activities across all organisations
    const recentActivities = [];
    for (const org of allOrgs.slice(0, 10)) {
      const activities = await localDB.getOrganisationActivities(org.id, 5);
      recentActivities.push(...activities.map(a => ({ ...a, org_name: org.name })));
    }
    
    recentActivities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({
      success: true,
      data: {
        stats,
        recent_activities: recentActivities.slice(0, 20),
        organisations: allOrgs.slice(0, 10) // Latest 10 orgs
      }
    });

  } catch (error) {
    console.error('Company dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load dashboard'
    });
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
  getCompanyProfile,
  getCompanyDashboard
};