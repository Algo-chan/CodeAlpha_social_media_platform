const express = require('express');
const postController = require('../controllers/post.controller');
const interactionController = require('../controllers/interaction.controller');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { uploadPostMedia } = require('../middleware/upload');

const router = express.Router();

// Create a new post (multipart text + optional image)
router.post('/', authenticateToken, uploadPostMedia, postController.create);

// List posts in Explore or Following feed
router.get('/', optionalAuth, postController.list);

// Get single post by ID
router.get('/:id', optionalAuth, postController.getById);

// Delete post (author only)
router.delete('/:id', authenticateToken, postController.remove);

// Likes
router.post('/:id/likes', authenticateToken, interactionController.likePost);
router.delete('/:id/likes', authenticateToken, interactionController.unlikePost);

// Comments
router.post('/:id/comments', authenticateToken, interactionController.createComment);
router.get('/:id/comments', optionalAuth, interactionController.getComments);

module.exports = router;
