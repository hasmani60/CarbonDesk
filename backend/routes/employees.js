const express = require('express');
const router = express.Router();
const { authorizeRoles } = require('../middleware/auth');
const {
  listEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  bulkAttendance,
  getAttendance,
  getEmissions,
  getCommuteTotal
} = require('../controllers/employeeController');

const readRoles = ['admin', 'analyst', 'contributor', 'viewer'];
const manageRoles = ['admin', 'analyst'];
const attendanceRoles = ['admin', 'analyst', 'contributor'];

router.get('/commute-total', authorizeRoles(...readRoles), getCommuteTotal);
router.get('/emissions', authorizeRoles(...readRoles), getEmissions);
router.get('/attendance', authorizeRoles(...readRoles), getAttendance);
router.post('/attendance/bulk', authorizeRoles(...attendanceRoles), bulkAttendance);

router.get('/', authorizeRoles(...readRoles), listEmployees);
router.post('/', authorizeRoles(...manageRoles), createEmployee);
router.put('/:id', authorizeRoles(...manageRoles), updateEmployee);
router.delete('/:id', authorizeRoles(...manageRoles), deleteEmployee);

module.exports = router;
