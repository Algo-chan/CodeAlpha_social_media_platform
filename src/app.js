const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const authRoutes = require('./routes/auth.routes');
const postRoutes = require('./routes/post.routes');
const userRoutes = require('./routes/user.routes');

const app = express();

// Ensure public/uploads directory exists
const uploadsDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Core middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static file serving
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname, '../public')));

// Versioned API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/posts', postRoutes);
app.use('/api/v1/users', userRoutes);

// 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Resource not found',
      code: 'NOT_FOUND',
    },
  });
});

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let code = err.code || 'INTERNAL_ERROR';

  if (err.name === 'SequelizeUniqueConstraintError') {
    status = 400;
    message = 'Username or email already in use';
    code = 'DUPLICATE_RESOURCE';
  } else if (err.name === 'SequelizeValidationError') {
    status = 400;
    message = err.errors ? err.errors.map((e) => e.message).join(', ') : 'Validation error';
    code = 'VALIDATION_ERROR';
  } else if (err.name === 'MulterError') {
    status = 400;
    message = err.message;
    code = err.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : err.code || 'UPLOAD_ERROR';
  }

  res.status(status).json({
    success: false,
    error: {
      message,
      code,
    },
  });
});

module.exports = app;
