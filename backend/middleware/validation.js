// backend/middleware/validation.js - Request validation middleware
const { body, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

const validateRegistration = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  handleValidationErrors
];

const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
];

const validateEmission = [
  body('scope')
    .isIn([1, 2, 3])
    .withMessage('Scope must be 1, 2, or 3'),
  body('category')
    .trim()
    .notEmpty()
    .withMessage('Category is required'),
  body('activityType')
    .trim()
    .notEmpty()
    .withMessage('Activity type is required'),
  body('source')
    .trim()
    .notEmpty()
    .withMessage('Source is required'),
  body('amount')
    .isFloat({ min: 0 })
    .withMessage('Amount must be a positive number'),
  body('unit')
    .isIn(['kg', 'tons', 'tonnes', 'litres', 'kWh', 'km', 'hours'])
    .withMessage('Invalid unit'),
  handleValidationErrors
];

module.exports = {
  validateRegistration,
  validateLogin,
  validateEmission,
  handleValidationErrors
};