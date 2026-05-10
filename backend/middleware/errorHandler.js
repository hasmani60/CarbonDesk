// middleware/errorHandler.js - MongoDB-compatible error handler
const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  logger.error('Error handler caught error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  // MongoDB CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    const message = `Resource not found with id: ${err.value}`;
    error = { message, statusCode: 404 };
  }

  // MongoDB duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    const value = err.keyValue?.[field];
    const message = field 
      ? `${field.charAt(0).toUpperCase() + field.slice(1)} '${value}' already exists`
      : 'Duplicate field value entered';
    error = { message, statusCode: 400 };
  }

  // MongoDB validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map(val => val.message)
      .join(', ');
    error = { message, statusCode: 400 };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid authentication token. Please login again.';
    error = { message, statusCode: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Authentication token expired. Please login again.';
    error = { message, statusCode: 401 };
  }

  // MongoDB connection errors
  if (err.name === 'MongoNetworkError') {
    const message = 'Database connection error. Please try again later.';
    error = { message, statusCode: 503 };
  }

  if (err.name === 'MongooseServerSelectionError') {
    const message = 'Database server unavailable. Please try again later.';
    error = { message, statusCode: 503 };
  }

  // MongoDB timeout errors
  if (err.name === 'MongooseError' && err.message.includes('buffering timed out')) {
    const message = 'Database operation timed out. Please try again.';
    error = { message, statusCode: 504 };
  }

  // Handle specific MongoDB write errors
  if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    if (err.code === 11000) {
      // Duplicate key - already handled above but as backup
      const message = 'Duplicate entry detected';
      error = { message, statusCode: 400 };
    } else {
      const message = 'Database operation failed';
      error = { message, statusCode: 500 };
    }
  }

  // Multer file upload errors
  if (err.name === 'MulterError') {
    const message = `File upload error: ${err.message}`;
    error = { message, statusCode: 400 };
  }

  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal server error';

  // Log error details for debugging
  if (statusCode === 500) {
    logger.error('Internal server error', {
      error: err,
      stack: err.stack,
      path: req.path,
      method: req.method,
      user: req.user?.email
    });
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    message: message, // Duplicate for compatibility
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      details: err
    })
  });
};

// Not Found middleware
const notFound = (req, res, next) => {
  const error = new Error(`Route not found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

module.exports = {
  errorHandler,
  notFound
};