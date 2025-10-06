-- backend/database/migrations/002_macc_opportunities.sql
-- Run this SQL directly on your SQLite database if needed

-- MACC Opportunities Table
CREATE TABLE IF NOT EXISTS macc_opportunities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organisation_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  scope INTEGER,
  cost_per_tCO2e REAL NOT NULL,
  reduction_potential REAL NOT NULL,
  payback_period REAL,
  implementation_status TEXT DEFAULT 'proposed',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_macc_org ON macc_opportunities(organisation_id);
CREATE INDEX IF NOT EXISTS idx_macc_cost ON macc_opportunities(cost_per_tCO2e);
CREATE INDEX IF NOT EXISTS idx_macc_scope ON macc_opportunities(scope);

-- Insert sample MACC opportunities (Optional - for testing)
INSERT INTO macc_opportunities (
  organisation_id, name, category, scope,
  cost_per_tCO2e, reduction_potential, payback_period,
  implementation_status, notes
) VALUES 
  ('ORG-LEGACY-001', 'LED Lighting Retrofit', 'Energy Efficiency', 2, 20.00, 50.00, 2.5, 'proposed', 'Replace existing lighting with LED across all facilities'),
  ('ORG-LEGACY-001', 'Solar PV Installation', 'Renewable Energy', 2, 40.00, 120.00, 5.0, 'proposed', '500kW rooftop solar installation'),
  ('ORG-LEGACY-001', 'HVAC Optimization', 'Energy Efficiency', 2, 15.00, 35.00, 1.8, 'proposed', 'Install smart HVAC controls and optimize schedules'),
  ('ORG-LEGACY-001', 'Electric Vehicle Fleet', 'Transport', 1, 60.00, 80.00, 7.0, 'proposed', 'Replace 50% of fleet with EVs'),
  ('ORG-LEGACY-001', 'Waste Heat Recovery', 'Process Optimization', 1, -10.00, 25.00, 1.2, 'proposed', 'Capture and reuse waste heat from manufacturing');