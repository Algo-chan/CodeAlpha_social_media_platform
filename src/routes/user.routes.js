const express = require('express');
const userController = require('../controllers/user.controller');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Update current user profile (bio, avatar)
router.put('/profile', authenticateToken, userController.updateProfile);

// Follow user
router.post('/:id/follow', authenticateToken, userController.follow);

// Unfollow user
router.delete('/:id/follow', authenticateToken, userController.unfollow);

// Get user profile by username (with posts, follower/following counts, isFollowing)
router.get('/:username', optionalAuth, userController.getProfile);

module.exports = router;
