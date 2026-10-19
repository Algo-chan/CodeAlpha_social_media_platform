const fs = require('fs');
const postService = require('../services/post.service');

/**
 * Handle new post creation with optional image upload.
 */
async function create(req, res, next) {
  try {
    const post = await postService.createPost({
      userId: req.user.id,
      content: req.body.content,
      file: req.file,
    });

    return res.status(201).json({
      success: true,
      data: { post },
    });
  } catch (err) {
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_) {}
    }
    return next(err);
  }
}

/**
 * Handle feed retrieval (Explore vs Following).
 */
async function list(req, res, next) {
  try {
    const tab = (req.query.tab || 'explore').toLowerCase();
    const { page, limit } = req.query;
    const currentUserId = req.user ? req.user.id : null;

    let feedData;
    if (tab === 'following') {
      feedData = await postService.getFollowingFeed({
        currentUserId,
        page,
        limit,
      });
    } else {
      feedData = await postService.getExploreFeed({
        currentUserId,
        page,
        limit,
      });
    }

    return res.status(200).json({
      success: true,
      data: feedData,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Handle single post retrieval by ID.
 */
async function getById(req, res, next) {
  try {
    const currentUserId = req.user ? req.user.id : null;
    const post = await postService.getPostById(req.params.id, currentUserId);

    return res.status(200).json({
      success: true,
      data: { post },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Handle post deletion by post author.
 */
async function remove(req, res, next) {
  try {
    await postService.deletePost({
      postId: req.params.id,
      userId: req.user.id,
    });

    return res.status(200).json({
      success: true,
      data: {
        message: 'Post deleted successfully',
      },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  create,
  list,
  getById,
  remove,
};
