#!/bin/bash
# Script to help organize MongoDB model files

echo "Creating individual model files from backend-models-others.js..."
echo ""

# Check if the file exists
if [ ! -f "backend-models-others.js" ]; then
    echo "Error: backend-models-others.js not found"
    echo "Please make sure you're in the directory with the generated files"
    exit 1
fi

# Create models directory if it doesn't exist
mkdir -p backend/models

echo "Step 1: Extracting Task.js..."
cat > backend/models/Task.js << 'EOF'
const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  assigned_to: {
    type: Number,
    required: true,
    index: true,
    ref: 'User'
  },
  assigned_by: {
    type: Number,
    required: true,
    index: true,
    ref: 'User'
  },
  assigned_to_name: String,
  assigned_by_name: String,
  scope: {
    type: Number,
    required: true,
    min: 1,
    max: 3,
    index: true
  },
  activity: {
    type: String,
    required: true
  },
  source: String,
  start_date: {
    type: String,
    required: true
  },
  end_date: {
    type: String,
    required: true
  },
  deadline: {
    type: String,
    required: true,
    index: true
  },
  comments: String,
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'cancelled'],
    default: 'pending',
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  organisation_id: {
    type: String,
    required: true,
    index: true,
    ref: 'Organisation'
  },
  completed_at: Date
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

taskSchema.index({ organisation_id: 1, assigned_to: 1 });
taskSchema.index({ organisation_id: 1, status: 1 });
taskSchema.index({ organisation_id: 1, deadline: 1 });

module.exports = mongoose.model('Task', taskSchema);
EOF

echo "✓ Task.js created"

echo "Step 2: Extracting CompanyOperator.js..."
cat > backend/models/CompanyOperator.js << 'EOF'
const mongoose = require('mongoose');

const companyOperatorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['operator', 'super_operator'],
    default: 'operator'
  },
  can_create_orgs: {
    type: Boolean,
    default: true
  },
  can_manage_orgs: {
    type: Boolean,
    default: true
  },
  can_view_all_orgs: {
    type: Boolean,
    default: true
  },
  is_active: {
    type: Boolean,
    default: true,
    index: true
  },
  last_login: Date,
  failed_login_attempts: {
    type: Number,
    default: 0
  },
  locked_until: Date,
  created_by: Number,
  notes: String
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('CompanyOperator', companyOperatorSchema);
EOF

echo "✓ CompanyOperator.js created"

echo "Step 3: Extracting OrganisationSettings.js..."
cat > backend/models/OrganisationSettings.js << 'EOF'
const mongoose = require('mongoose');

const organisationSettingsSchema = new mongoose.Schema({
  organisation_id: {
    type: String,
    required: true,
    unique: true,
    index: true,
    ref: 'Organisation'
  },
  logo_url: String,
  primary_color: {
    type: String,
    default: '#10b981'
  },
  secondary_color: {
    type: String,
    default: '#059669'
  },
  default_reporting_period: {
    type: String,
    enum: ['monthly', 'quarterly', 'yearly'],
    default: 'monthly'
  },
  fiscal_year_start: {
    type: String,
    default: '01-01'
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  currency: {
    type: String,
    default: 'USD'
  },
  emission_factors_version: {
    type: String,
    default: 'latest'
  },
  calculation_methodology: {
    type: String,
    default: 'GHG_Protocol'
  },
  features_enabled: {
    type: [String],
    default: ['analytics', 'reporting']
  },
  notification_settings: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  data_retention_days: {
    type: Number,
    default: 365
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('OrganisationSettings', organisationSettingsSchema);
EOF

echo "✓ OrganisationSettings.js created"

echo "Step 4: Extracting ActivityLog.js..."
cat > backend/models/ActivityLog.js << 'EOF'
const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  user_id: {
    type: Number,
    required: true,
    index: true,
    ref: 'User'
  },
  action: {
    type: String,
    required: true,
    index: true
  },
  resource_type: String,
  resource_id: String,
  details: String,
  ip_address: String,
  user_agent: String
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false }
});

activityLogSchema.index({ user_id: 1, created_at: -1 });
activityLogSchema.index({ action: 1, created_at: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
EOF

echo "✓ ActivityLog.js created"

echo "Step 5: Extracting MACCOpportunity.js..."
cat > backend/models/MACCOpportunity.js << 'EOF'
const mongoose = require('mongoose');

const maccOpportunitySchema = new mongoose.Schema({
  organisation_id: {
    type: String,
    required: true,
    index: true,
    ref: 'Organisation'
  },
  name: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  scope: {
    type: Number,
    min: 1,
    max: 3
  },
  cost_per_tCO2e: {
    type: Number,
    required: true
  },
  reduction_potential: {
    type: Number,
    required: true
  },
  payback_period: Number,
  implementation_status: {
    type: String,
    enum: ['proposed', 'in_progress', 'implemented', 'rejected'],
    default: 'proposed'
  },
  notes: String
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

maccOpportunitySchema.index({ organisation_id: 1, cost_per_tCO2e: 1 });

module.exports = mongoose.model('MACCOpportunity', maccOpportunitySchema);
EOF

echo "✓ MACCOpportunity.js created"

echo ""
echo "═══════════════════════════════════════════════════"
echo "All model files created successfully!"
echo "═══════════════════════════════════════════════════"
echo ""
echo "Created files:"
echo "  - backend/models/Task.js"
echo "  - backend/models/CompanyOperator.js"
echo "  - backend/models/OrganisationSettings.js"
echo "  - backend/models/ActivityLog.js"
echo "  - backend/models/MACCOpportunity.js"
echo ""
echo "Next: Copy the remaining model files and run the migration!"
