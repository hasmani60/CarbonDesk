-- backend/database/migrations/003_prevent_duplicate_emissions.sql
-- Migration to prevent duplicate emission entries
-- Run this migration after updating the controller code

-- ============================================
-- STEP 1: Create unique composite index
-- ============================================
-- This prevents exact duplicates at the database level
-- Matches on: organisation_id + scope + activity + date + co2e + created_by

CREATE UNIQUE INDEX IF NOT EXISTS idx_emissions_unique_entry ON emissions(
  organisation_id,
  scope,
  activity,
  date,
  co2e,
  created_by
);

-- ============================================
-- STEP 2: Create additional performance indexes
-- ============================================
-- These improve query performance for duplicate detection

CREATE INDEX IF NOT EXISTS idx_emissions_org_scope ON emissions(organisation_id, scope);
CREATE INDEX IF NOT EXISTS idx_emissions_org_activity ON emissions(organisation_id, activity);
CREATE INDEX IF NOT EXISTS idx_emissions_org_date ON emissions(organisation_id, date);
CREATE INDEX IF NOT EXISTS idx_emissions_created_by_date ON emissions(created_by, date);

-- ============================================
-- STEP 3: Remove existing exact duplicates (if any)
-- ============================================
-- This identifies and removes duplicate entries that already exist
-- Keeps the oldest record and deletes newer duplicates

DELETE FROM emissions
WHERE id NOT IN (
  SELECT MIN(id)
  FROM emissions
  GROUP BY organisation_id, scope, activity, date, co2e, created_by
);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these after migration to verify success:

-- Check for remaining duplicates (should return 0 rows):
-- SELECT organisation_id, scope, activity, date, co2e, created_by, COUNT(*) as count
-- FROM emissions
-- GROUP BY organisation_id, scope, activity, date, co2e, created_by
-- HAVING count > 1;

-- Verify index creation:
-- SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='emissions';

-- ============================================
-- ROLLBACK (if needed)
-- ============================================
-- To rollback this migration, run:
-- DROP INDEX IF EXISTS idx_emissions_unique_entry;
-- DROP INDEX IF EXISTS idx_emissions_org_scope;
-- DROP INDEX IF EXISTS idx_emissions_org_activity;
-- DROP INDEX IF EXISTS idx_emissions_org_date;
-- DROP INDEX IF EXISTS idx_emissions_created_by_date;