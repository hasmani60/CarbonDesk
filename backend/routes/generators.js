// routes/generators.js
const express = require('express');
const { 
  getGenerators, 
  createGenerator, 
  updateGenerator, 
  deleteGenerator 
} = require('../controllers/generatorController');
const { authorizeRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/', getGenerators);
router.post('/', authorizeRoles('admin', 'analyst'), createGenerator);
router.patch('/:id', authorizeRoles('admin', 'analyst'), updateGenerator);
router.delete('/:id', authorizeRoles('admin'), deleteGenerator);

module.exports = router;