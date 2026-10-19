const { verifyToken } = require('../utils/jwt');
const { User } = require('../models');

/**
 * Middleware to require a valid JWT Bearer token.
 * Populates req.user if authenticated, returns 401 otherwise.
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];

  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: {
        message: 'Authentication token required',
        code: 'UNAUTHORIZED',
      },
    });
  }

  const token = authHeader.substring(7).trim();

  try {
    const decoded = verifyToken(token);
    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password_hash'] },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'User no longer exists',
          code: 'UNAUTHORIZED',
        },
      });
    }

    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: {
        message: 'Invalid or expired token',
        code: 'UNAUTHORIZED',
      },
    });
  }
}

/**
 * Middleware for optional JWT authentication.
 * Populates req.user if valid token provided; does not reject guests.
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];

  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.substring(7).trim();

  try {
    const decoded = verifyToken(token);
    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password_hash'] },
    });

    req.user = user || null;
  } catch (err) {
    req.user = null;
  }

  return next();
}

module.exports = {
  authenticateToken,
  optionalAuth,
};
