const interactionService = require('../services/interaction.service');

/**
 * Handle liking a post.
 */
async function likePost(req, res, next) {
  try {
    const data = await interactionService.likePost({
      postId: req.params.id,
      userId: req.user.id,
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Handle unliking a post.
 */
async function unlikePost(req, res, next) {
  try {
    const data = await interactionService.unlikePost({
      postId: req.params.id,
      userId: req.user.id,
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Handle adding a comment to a post.
 */
async function createComment(req, res, next) {
  try {
    const comment = await interactionService.createComment({
      postId: req.params.id,
      userId: req.user.id,
      content: req.body.content,
      parentCommentId: req.body.parent_comment_id,
    });

    return res.status(201).json({
      success: true,
      data: { comment },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Handle retrieving all comments for a post.
 */
async function getComments(req, res, next) {
  try {
    const comments = await interactionService.getPostComments({
      postId: req.params.id,
    });

    return res.status(200).json({
      success: true,
      data: { comments },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  likePost,
  unlikePost,
  createComment,
  getComments,
};
