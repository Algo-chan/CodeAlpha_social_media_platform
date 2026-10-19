const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const { Post, User, Follow, sequelize } = require('../models');
const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary');

/**
 * Helper to unlink an uploaded file if validation or creation fails.
 */
function cleanupUploadedFile(file) {
  if (file && file.path && fs.existsSync(file.path)) {
    try {
      fs.unlinkSync(file.path);
    } catch (err) {
      console.error('Failed to clean up uploaded file:', err);
    }
  }
}

/**
 * Create a new post with optional uploaded media.
 */
async function createPost({ userId, content, file }) {
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    cleanupUploadedFile(file);
    const error = new Error('Post content is required and cannot be empty');
    error.status = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  const trimmedContent = content.trim();
  if (trimmedContent.length > 500) {
    cleanupUploadedFile(file);
    const error = new Error('Post content cannot exceed 500 characters');
    error.status = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  let imageUrl = null;
  let uploadedToCloud = false;

  if (file) {
    if (file.buffer) {
      const uploadResult = await uploadToCloudinary(file.buffer);
      imageUrl = uploadResult.secure_url;
      uploadedToCloud = true;
    } else if (file.filename) {
      imageUrl = `/uploads/${file.filename}`;
    }
  }

  try {
    const post = await Post.create({
      user_id: userId,
      content: trimmedContent,
      image_url: imageUrl,
    });

    return await getPostById(post.id, userId);
  } catch (err) {
    cleanupUploadedFile(file);
    if (uploadedToCloud && imageUrl) {
      try {
        await deleteFromCloudinary(imageUrl);
      } catch (delErr) {
        console.error('Failed to clean up Cloudinary image on post creation failure:', delErr);
      }
    }
    throw err;
  }
}

/**
 * Format raw Sequelize post instance into JSON with normalized counters and isLiked boolean.
 */
function formatPost(post, currentUserId) {
  const p = post.toJSON ? post.toJSON() : post;
  return {
    ...p,
    likesCount: parseInt(p.likesCount || 0, 10),
    commentsCount: parseInt(p.commentsCount || 0, 10),
    isLiked: currentUserId ? Boolean(p.isLiked && p.isLiked !== 0 && p.isLiked !== '0') : false,
  };
}

/**
 * Helper to build attributes with like & comment count subqueries.
 */
function getPostAttributes(currentUserId) {
  const includeAttributes = [
    [
      sequelize.literal('(SELECT COUNT(*) FROM likes WHERE likes.post_id = Post.id)'),
      'likesCount',
    ],
    [
      sequelize.literal('(SELECT COUNT(*) FROM comments WHERE comments.post_id = Post.id)'),
      'commentsCount',
    ],
  ];

  if (currentUserId) {
    const safeUserId = parseInt(currentUserId, 10);
    includeAttributes.push([
      sequelize.literal(
        `(SELECT COUNT(*) FROM likes WHERE likes.post_id = Post.id AND likes.user_id = ${safeUserId}) > 0`
      ),
      'isLiked',
    ]);
  }

  return {
    include: includeAttributes,
  };
}

/**
 * Get Explore Feed containing all posts sorted newest first.
 */
async function getExploreFeed({ currentUserId = null, page = 1, limit = 10 } = {}) {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const offset = (safePage - 1) * safeLimit;

  const { count, rows: posts } = await Post.findAndCountAll({
    order: [['created_at', 'DESC']],
    limit: safeLimit,
    offset,
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['id', 'username', 'email', 'avatar_url', 'bio', 'created_at'],
      },
    ],
    attributes: getPostAttributes(currentUserId),
  });

  return {
    posts: posts.map((post) => formatPost(post, currentUserId)),
    total: count,
    page: safePage,
    limit: safeLimit,
  };
}

/**
 * Get Following Feed containing posts authored by accounts the current user follows.
 */
async function getFollowingFeed({ currentUserId, page = 1, limit = 10 } = {}) {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const offset = (safePage - 1) * safeLimit;

  if (!currentUserId) {
    return {
      posts: [],
      total: 0,
      page: safePage,
      limit: safeLimit,
    };
  }

  const follows = await Follow.findAll({
    where: { follower_id: currentUserId },
    attributes: ['following_id'],
  });

  const followedIds = follows.map((f) => f.following_id);

  if (followedIds.length === 0) {
    return {
      posts: [],
      total: 0,
      page: safePage,
      limit: safeLimit,
    };
  }

  const { count, rows: posts } = await Post.findAndCountAll({
    where: {
      user_id: {
        [Op.in]: followedIds,
      },
    },
    order: [['created_at', 'DESC']],
    limit: safeLimit,
    offset,
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['id', 'username', 'email', 'avatar_url', 'bio', 'created_at'],
      },
    ],
    attributes: getPostAttributes(currentUserId),
  });

  return {
    posts: posts.map((post) => formatPost(post, currentUserId)),
    total: count,
    page: safePage,
    limit: safeLimit,
  };
}

/**
 * Retrieve a single post by ID with author information and interaction counts.
 */
async function getPostById(postId, currentUserId = null) {
  const post = await Post.findByPk(postId, {
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['id', 'username', 'email', 'avatar_url', 'bio', 'created_at'],
      },
    ],
    attributes: getPostAttributes(currentUserId),
  });

  if (!post) {
    const error = new Error('Post not found');
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  return formatPost(post, currentUserId);
}

/**
 * Delete a post, removing its associated media from disk and ensuring author authorization.
 */
async function deletePost({ postId, userId }) {
  const post = await Post.findByPk(postId);

  if (!post) {
    const error = new Error('Post not found');
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (post.user_id !== userId) {
    const error = new Error('Unauthorized to delete this post');
    error.status = 403;
    error.code = 'FORBIDDEN';
    throw error;
  }

  if (post.image_url) {
    if (post.image_url.includes('res.cloudinary.com')) {
      try {
        await deleteFromCloudinary(post.image_url);
      } catch (err) {
        // Log error silently, do not block post deletion
        console.error('Error removing Cloudinary asset:', err);
      }
    } else {
      const filename = path.basename(post.image_url);
      const filePath = path.join(__dirname, '../../public/uploads', filename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          // Log error silently, do not block post deletion
          console.error('Error removing post media file:', err);
        }
      }
    }
  }

  await post.destroy();
  return { success: true };
}

module.exports = {
  createPost,
  getExploreFeed,
  getFollowingFeed,
  getPostById,
  deletePost,
};
