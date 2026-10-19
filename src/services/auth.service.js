const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { User } = require('../models');
const { signToken } = require('../utils/jwt');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_]{2,30}$/;

/**
 * Register a new user.
 * @param {Object} data - { username, email, password }
 * @returns {Promise<{ user: Object, token: string }>}
 */
async function registerUser({ username, email, password }) {
  if (!username || typeof username !== 'string' || !USERNAME_REGEX.test(username.trim())) {
    const err = new Error('Username must be 2-30 characters and alphanumeric (letters, numbers, underscores)');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    const err = new Error('A valid email address is required');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    const err = new Error('Password must be at least 6 characters long');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const cleanUsername = username.trim();
  const cleanEmail = email.trim().toLowerCase();

  const existingUsername = await User.findOne({ where: { username: cleanUsername } });
  if (existingUsername) {
    const err = new Error('Username is already taken');
    err.status = 400;
    err.code = 'DUPLICATE_RESOURCE';
    throw err;
  }

  const existingEmail = await User.findOne({ where: { email: cleanEmail } });
  if (existingEmail) {
    const err = new Error('Email is already registered');
    err.status = 400;
    err.code = 'DUPLICATE_RESOURCE';
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    username: cleanUsername,
    email: cleanEmail,
    password_hash: passwordHash,
  });

  const userObj = user.toJSON();
  delete userObj.password_hash;

  const token = signToken({
    id: user.id,
    username: user.username,
    email: user.email,
  });

  return { user: userObj, token };
}

/**
 * Login user using username or email and password.
 * @param {Object} credentials - { login, password }
 * @returns {Promise<{ user: Object, token: string }>}
 */
async function loginUser({ login, password }) {
  if (!login || typeof login !== 'string' || !password || typeof password !== 'string') {
    const err = new Error('Login identifier (username or email) and password are required');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const cleanLogin = login.trim();

  const user = await User.findOne({
    where: {
      [Op.or]: [
        { username: cleanLogin },
        { email: cleanLogin.toLowerCase() },
      ],
    },
  });

  if (!user) {
    const err = new Error('Invalid login credentials');
    err.status = 401;
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    const err = new Error('Invalid login credentials');
    err.status = 401;
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  const userObj = user.toJSON();
  delete userObj.password_hash;

  const token = signToken({
    id: user.id,
    username: user.username,
    email: user.email,
  });

  return { user: userObj, token };
}

/**
 * Get profile for the current user.
 * @param {number} userId
 * @returns {Promise<Object>}
 */
async function getCurrentUser(userId) {
  const user = await User.findByPk(userId, {
    attributes: { exclude: ['password_hash'] },
  });

  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  return user.toJSON();
}

module.exports = {
  registerUser,
  loginUser,
  getCurrentUser,
};
