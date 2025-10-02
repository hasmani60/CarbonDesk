-- Multi-Tenant Database Schema
-- This adds organization-level multi-tenancy to the existing system

-- ============================================
-- 1. ORGANISATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS organisations (
  id TEXT PRIMARY KEY, -- e.g., 'ORG-2025-001'
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  industry_type TEXT NOT NULL,
  location TEXT,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  address TEXT,
  website TEXT,
  
  -- Configuration
  config TEXT, -- JSON: { branding, settings, limits }
  is_active INTEGER DEFAULT 1,
  
  -- Subscription/Billing
  subscription_tier TEXT DEFAULT 'standard', -- basic, standard, premium
  max_users INTEGER DEFAULT 50,
  max_storage_gb INTEGER DEFAULT 10,
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  activated_at DATETIME,
  
  -- Metadata
  created_by TEXT, -- Company operator who created this org
  notes TEXT
);

-- ============================================
-- 2. COMPANY OPERATORS TABLE (Internal Use Only)
-- ============================================
CREATE TABLE IF NOT EXISTS company_operators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'operator', -- operator, super_operator
  
  -- Access Control
  can_create_orgs INTEGER DEFAULT 1,
  can_manage_orgs INTEGER DEFAULT 1,
  can_view_all_orgs INTEGER DEFAULT 1,
  
  -- Security
  is_active INTEGER DEFAULT 1,
  last_login DATETIME,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until DATETIME,
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- Metadata
  created_by INTEGER,
  notes TEXT,
  
  FOREIGN KEY (created_by) REFERENCES company_operators (id)
);

-- ============================================
-- 3. UPDATE USERS TABLE - Add Organisation Reference
-- ============================================
-- Add organisation_id column to existing users table
ALTER TABLE users ADD COLUMN organisation_id TEXT REFERENCES organisations(id);

-- Add super_admin role capability
-- Note: We keep existing roles and add super_admin as highest privilege

-- ============================================
-- 4. ORGANISATION SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS organisation_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organisation_id TEXT NOT NULL,
  
  -- Branding
  logo_url TEXT,
  primary_color TEXT DEFAULT '#10b981',
  secondary_color TEXT DEFAULT '#059669',
  
  -- Reporting Preferences
  default_reporting_period TEXT DEFAULT 'monthly', -- monthly, quarterly, yearly
  fiscal_year_start TEXT DEFAULT '01-01', -- MM-DD format
  timezone TEXT DEFAULT 'UTC',
  currency TEXT DEFAULT 'USD',
  
  -- Emission Calculation Preferences
  emission_factors_version TEXT DEFAULT 'latest',
  calculation_methodology TEXT DEFAULT 'GHG_Protocol',
  
  -- Features Enabled
  features_enabled TEXT, -- JSON: ['analytics', 'reporting', 'api_access']
  
  -- Notifications
  notification_settings TEXT, -- JSON config
  
  -- Data Retention
  data_retention_days INTEGER DEFAULT 365,
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE
);

-- ============================================
-- 5. ORGANISATION ACTIVITY LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS organisation_activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organisation_id TEXT NOT NULL,
  
  -- Activity Details
  action TEXT NOT NULL, -- org_created, org_updated, org_deactivated, etc.
  actor_type TEXT NOT NULL, -- company_operator, super_admin, admin
  actor_id INTEGER NOT NULL,
  actor_name TEXT,
  
  -- Details
  details TEXT, -- JSON with change details
  ip_address TEXT,
  user_agent TEXT,
  
  -- Timestamp
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE
);

-- ============================================
-- 6. INDICES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_organisation ON users(organisation_id);
CREATE INDEX IF NOT EXISTS idx_org_active ON organisations(is_active);
CREATE INDEX IF NOT EXISTS idx_org_settings_org ON organisation_settings(organisation_id);
CREATE INDEX IF NOT EXISTS idx_org_logs_org ON organisation_activity_logs(organisation_id);
CREATE INDEX IF NOT EXISTS idx_org_logs_created ON organisation_activity_logs(created_at);

-- ============================================
-- 7. COMPANY OPERATORS SESSIONS (Optional)
-- ============================================
CREATE TABLE IF NOT EXISTS company_operator_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operator_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (operator_id) REFERENCES company_operators (id) ON DELETE CASCADE
);

-- ============================================
-- 8. SEED DEFAULT COMPANY OPERATOR (CRITICAL!)
-- ============================================
-- This is the FIRST company operator who can create organisations
-- Password: 'CompanyAdmin2025!' (hashed)
-- IMPORTANT: Change this password immediately after first login!

INSERT OR IGNORE INTO company_operators (
  id, name, email, password, role, 
  can_create_orgs, can_manage_orgs, can_view_all_orgs,
  is_active, notes
) VALUES (
  1,
  'System Administrator',
  'admin@carbontrack-company.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIxKzUCvSu', -- 'CompanyAdmin2025!'
  'super_operator',
  1, 1, 1, 1,
  'Default company operator. CHANGE PASSWORD IMMEDIATELY!'
);

-- ============================================
-- MIGRATION NOTES:
-- ============================================
-- 1. Existing users will have NULL organisation_id initially
-- 2. You can create a "Default Organisation" and migrate existing users to it
-- 3. Or keep them separate until properly assigned to organisations
-- 4. All new users MUST have an organisation_id

-- ============================================
-- EXAMPLE: Migrate Existing Users to Default Org
-- ============================================
-- Uncomment if you want to migrate existing users:

-- INSERT INTO organisations (
--   id, name, display_name, industry_type, 
--   contact_email, is_active, created_by
-- ) VALUES (
--   'ORG-DEFAULT-001',
--   'Default Organisation',
--   'Default Organisation',
--   'General',
--   'admin@example.com',
--   1,
--   'system_migration'
-- );

-- UPDATE users 
-- SET organisation_id = 'ORG-DEFAULT-001' 
-- WHERE organisation_id IS NULL;