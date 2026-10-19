const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const createAuthLimiter = (options = {}) =>
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 15, // 15 requests per 15 minutes per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        message: 'Too many authentication attempts, please try again later.',
        code: 'AUTH_RATE_LIMIT_EXCEEDED',
      },
    },
    ...options,
  });

const createPostLimiter = (options = {}) =>
  rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 30, // 30 posts per hour per user/IP
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => (req.user?.id ? `user_${req.user.id}` : ipKeyGenerator(req.ip)),
    message: {
      success: false,
      error: {
        message: 'Post creation limit reached, please try again later.',
        code: 'POST_RATE_LIMIT_EXCEEDED',
      },
    },
    ...options,
  });

const realAuthLimiter = createAuthLimiter();
const realPostLimiter = createPostLimiter();

const authLimiter = (req, res, next) => {
  if (process.env.NODE_ENV === 'test') {
    return next();
  }
  return realAuthLimiter(req, res, next);
};

const postLimiter = (req, res, next) => {
  if (process.env.NODE_ENV === 'test') {
    return next();
  }
  return realPostLimiter(req, res, next);
};

module.exports = {
  authLimiter,
  postLimiter,
  createAuthLimiter,
  createPostLimiter,
  realAuthLimiter,
  realPostLimiter,
};
