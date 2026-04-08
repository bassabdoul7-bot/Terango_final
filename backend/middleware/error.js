// Error handler middleware — logs all unhandled errors to AppLog + Telegram
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging
  console.error(err);

  // Save to AppLog (async, non-blocking)
  try {
    var AppLog = require('../models/AppLog');
    AppLog.create({
      level: 'error',
      source: 'backend',
      screen: req.originalUrl || '',
      message: (err.message || 'Unknown error').substring(0, 2000),
      stack: (err.stack || '').substring(0, 5000),
      userId: req.user ? (req.user._id || '').toString() : '',
      metadata: {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('user-agent') || ''
      }
    }).catch(function(e) { console.error('AppLog save failed:', e.message); });
  } catch (e) { /* model not ready yet */ }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { message, statusCode: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = { message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message);
    error = { message, statusCode: 400 };
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

module.exports = errorHandler;
