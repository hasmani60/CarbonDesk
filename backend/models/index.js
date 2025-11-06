// backend/models/index.js - MongoDB Models Export
// Import all MongoDB models
const User = require('./User');
const Organisation = require('./Organisation');
const Emission = require('./Emission');
const ActivityLog = require('./ActivityLog');
const Task = require('./Task');
const CompanyOperator = require('./CompanyOperator');
const OrganisationSettings = require('./OrganisationSettings');
const MACCOpportunity = require('./MACCOpportunity');

// Export all models
module.exports = {
  User,
  Organisation,
  Emission,
  ActivityLog,
  Task,
  CompanyOperator,
  OrganisationSettings,
  MACCOpportunity
};