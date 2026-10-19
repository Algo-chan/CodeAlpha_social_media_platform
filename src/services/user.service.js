const { User, Post, Follow, sequelize } = require('../models');

/**
 * Follow another user idempotently.
 *
 * @param {Object} params
 * @param {number|string} params.followerId
 * @param {number|string} params.targetUserId
 * @returns {Promise<{ following: boolean, followersCount: number }>}
 */
async function followUser({ followerId, targetUserId }) {
  if (String(followerId) === String(targetUserId)) {
    const error = new Error('You cannot follow yourself');
    error.status = 400;
    error.code = 'CANNOT_FOLLOW_SELF';
    throw error;
  }

  const targetUser = await User.findByPk(targetUserId);
  if (!targetUser) {
    const error = new Error('User not found');
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  try {
    await Follow.findOrCreate({
      where: {
        follower_id: followerId,
        following_id: targetUserId,
      },
      defaults: {
        follower_id: followerId,
        following_id: targetUserId,
      },
    });
  } catch (err) {
    if (err.name !== 'SequelizeUniqueConstraintError') {
      throw err;
    }
  }

  const followersCount = await Follow.count({
    where: { following_id: targetUserId },
  });

  return {
    following: true,
    followersCount,
  };
}

/**
 * Unfollow another user idempotently.
 *
 * @param {Object} params
 * @param {number|string} params.followerId
 * @param {number|string} params.targetUserId
 * @returns {Promise<{ following: boolean, followersCount: number }>}
 */
async function unfollowUser({ followerId, targetUserId }) {
  const targetUser = await User.findByPk(targetUserId);
  if (!targetUser) {
    const error = new Error('User not found');
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  await Follow.destroy({
    where: {
      follower_id: followerId,
      following_id: targetUserId,
    },
  });

  const followersCount = await Follow.count({
    where: { following_id: targetUserId },
  });

  return {
    following: false,
    followersCount,
  };
}

/**
 * Get comprehensive user profile with stats and posts.
 *
 * @param {Object} params
 * @param {string} params.username
 * @param {number|string|null} [params.currentUserId]
 * @returns {Promise<Object>}
 */
async function getUserProfile({ username, currentUserId = null }) {
  const user = await User.findOne({
    where: { username },
    attributes: ['id', 'username', 'email', 'bio', 'avatar_url', 'created_at'],
  });

  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  const [postsCount, followersCount, followingCount] = await Promise.all([
    Post.count({ where: { user_id: user.id } }),
    Follow.count({ where: { following_id: user.id } }),
    Follow.count({ where: { follower_id: user.id } }),
  ]);

  let isFollowing = false;
  if (currentUserId && String(currentUserId) !== String(user.id)) {
    const followRecord = await Follow.findOne({
      where: {
        follower_id: currentUserId,
        following_id: user.id,
      },
    });
    isFollowing = Boolean(followRecord);
  }

  const isPostgres = sequelize.getDialect() === 'postgres';
  const postRef = isPostgres ? '"Post"."id"' : 'Post.id';
  const booleanExpr = isPostgres ? '::boolean' : '';

  const includeAttributes = [
    [
      sequelize.literal(`(SELECT COUNT(*) FROM likes WHERE likes.post_id = ${postRef})`),
      'likesCount',
    ],
    [
      sequelize.literal(`(SELECT COUNT(*) FROM comments WHERE comments.post_id = ${postRef})`),
      'commentsCount',
    ],
  ];

  if (currentUserId) {
    const safeUserId = parseInt(currentUserId, 10);
    includeAttributes.push([
      sequelize.literal(
        `((SELECT COUNT(*) FROM likes WHERE likes.post_id = ${postRef} AND likes.user_id = ${safeUserId}) > 0)${booleanExpr}`
      ),
      'isLiked',
    ]);
  }


  const posts = await Post.findAll({
    where: { user_id: user.id },
    order: [['created_at', 'DESC']],
    limit: 50,
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['id', 'username', 'email', 'avatar_url', 'bio', 'created_at'],
      },
    ],
    attributes: {
      include: includeAttributes,
    },
  });

  const formattedPosts = posts.map((post) => {
    const p = post.toJSON ? post.toJSON() : post;
    return {
      ...p,
      likesCount: parseInt(p.likesCount || 0, 10),
      commentsCount: parseInt(p.commentsCount || 0, 10),
      isLiked: currentUserId ? Boolean(p.isLiked && p.isLiked !== 0 && p.isLiked !== '0') : false,
    };
  });

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    bio: user.bio,
    avatar_url: user.avatar_url,
    created_at: user.created_at,
    postsCount,
    followersCount,
    followingCount,
    isFollowing,
    posts: formattedPosts,
  };
}

/**
 * Update user bio and avatar URL.
 *
 * @param {Object} params
 * @param {number|string} params.userId
 * @param {string} [params.bio]
 * @param {string} [params.avatar_url]
 * @returns {Promise<Object>}
 */
async function updateUserProfile({ userId, bio, avatar_url }) {
  const user = await User.findByPk(userId);
  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (bio !== undefined) {
    user.bio = typeof bio === 'string' ? bio.trim() : null;
  }

  if (avatar_url !== undefined) {
    user.avatar_url = typeof avatar_url === 'string' ? avatar_url.trim() : null;
  }

  await user.save();

  const userObj = user.toJSON();
  delete userObj.password_hash;
  return userObj;
}

module.exports = {
  followUser,
  unfollowUser,
  getUserProfile,
  updateUserProfile,
};
