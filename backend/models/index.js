// backend/models/index.js
// Central export for all MongoDB models

const User = require('./User');
const Organisation = require('./Organisation');
const OrganisationSettings = require('./OrganisationSettings');
const CompanyOperator = require('./CompanyOperator');
const Emission = require('./Emission');
const Task = require('./Task');
const ActivityLog = require('./ActivityLog');
const MACCOpportunity = require('./MACCOpportunity');
const Notification = require('./Notification');
const AIReport = require('./AIReport');

module.exports = {
  User,
  Organisation,
  OrganisationSettings,
  CompanyOperator,
  Emission,
  Task,
  ActivityLog,
  MACCOpportunity,
  Notification,
  AIReport
};
