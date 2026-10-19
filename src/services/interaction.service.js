const { Post, Like, Comment, User } = require('../models');

/**
 * Add a like to a post idempotently.
 *
 * @param {Object} params
 * @param {number|string} params.postId
 * @param {number|string} params.userId
 * @returns {Promise<{ liked: boolean, likesCount: number }>}
 */
async function likePost({ postId, userId }) {
  const post = await Post.findByPk(postId);
  if (!post) {
    const error = new Error('Post not found');
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  try {
    await Like.findOrCreate({
      where: { user_id: userId, post_id: postId },
      defaults: { user_id: userId, post_id: postId },
    });
  } catch (err) {
    if (err.name !== 'SequelizeUniqueConstraintError') {
      throw err;
    }
  }

  const likesCount = await Like.count({ where: { post_id: postId } });
  return { liked: true, likesCount };
}

/**
 * Remove a like from a post idempotently.
 *
 * @param {Object} params
 * @param {number|string} params.postId
 * @param {number|string} params.userId
 * @returns {Promise<{ liked: boolean, likesCount: number }>}
 */
async function unlikePost({ postId, userId }) {
  const post = await Post.findByPk(postId);
  if (!post) {
    const error = new Error('Post not found');
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  await Like.destroy({
    where: { user_id: userId, post_id: postId },
  });

  const likesCount = await Like.count({ where: { post_id: postId } });
  return { liked: false, likesCount };
}

/**
 * Create a new comment on a post.
 *
 * @param {Object} params
 * @param {number|string} params.postId
 * @param {number|string} params.userId
 * @param {string} params.content
 * @param {number|string|null} [params.parentCommentId]
 * @returns {Promise<Object>} populated comment
 */
async function createComment({ postId, userId, content, parentCommentId = null }) {
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    const error = new Error('Comment content is required');
    error.status = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  const trimmed = content.trim();
  if (trimmed.length > 300) {
    const error = new Error('Comment content cannot exceed 300 characters');
    error.status = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  const post = await Post.findByPk(postId);
  if (!post) {
    const error = new Error('Post not found');
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  const comment = await Comment.create({
    post_id: postId,
    user_id: userId,
    content: trimmed,
    parent_comment_id: parentCommentId || null,
  });

  const populatedComment = await Comment.findByPk(comment.id, {
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['id', 'username', 'avatar_url'],
      },
    ],
  });

  return populatedComment;
}

/**
 * Get all comments for a post, chronologically ordered.
 *
 * @param {Object} params
 * @param {number|string} params.postId
 * @returns {Promise<Array>}
 */
async function getPostComments({ postId }) {
  const post = await Post.findByPk(postId);
  if (!post) {
    const error = new Error('Post not found');
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  const comments = await Comment.findAll({
    where: { post_id: postId },
    order: [['created_at', 'ASC']],
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['id', 'username', 'avatar_url'],
      },
    ],
  });

  return comments;
}

module.exports = {
  likePost,
  unlikePost,
  createComment,
  getPostComments,
};
