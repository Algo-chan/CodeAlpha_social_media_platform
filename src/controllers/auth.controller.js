const authService = require('../services/auth.service');

/**
 * Handle user registration request.
 */
async function register(req, res, next) {
  try {
    const { username, email, password } = req.body;
    const result = await authService.registerUser({ username, email, password });
    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Handle user login request.
 */
async function login(req, res, next) {
  try {
    const { login, password } = req.body;
    const result = await authService.loginUser({ login, password });
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Handle current user profile request.
 */
async function me(req, res, next) {
  try {
    const user = await authService.getCurrentUser(req.user.id);
    return res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  register,
  login,
  me,
};
