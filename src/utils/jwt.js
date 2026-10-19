const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_key_123';

/**
 * Sign a JWT token with a payload.
 * @param {Object} payload - Data to encode in token.
 * @param {Object} [options] - jsonwebtoken sign options.
 * @returns {string} - Signed JWT token string.
 */
function signToken(payload, options = {}) {
  const signOptions = {
    expiresIn: '7d',
    ...options,
  };
  return jwt.sign(payload, JWT_SECRET, signOptions);
}

/**
 * Verify and decode a JWT token.
 * @param {string} token - JWT token string.
 * @returns {Object} - Decoded token payload.
 * @throws {JsonWebTokenError|TokenExpiredError}
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = {
  signToken,
  verifyToken,
};
