// routes/monitor.js
const express = require('express');
const { 
  getActivities, 
  createTask, 
  updateTask, 
  deleteTask, 
  getTasks, 
  assignActivity 
} = require('../controllers/monitorController');

const router = express.Router();

router.get('/activities', getActivities);
router.post('/tasks', createTask);
router.get('/tasks', getTasks);
router.patch('/tasks/:id', updateTask);
router.delete('/tasks/:id', deleteTask);
router.post('/assign', assignActivity);

module.exports = router;