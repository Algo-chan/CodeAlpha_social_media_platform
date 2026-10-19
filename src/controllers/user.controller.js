const userService = require('../services/user.service');

/**
 * Handle following a user.
 */
async function follow(req, res, next) {
  try {
    const data = await userService.followUser({
      followerId: req.user.id,
      targetUserId: req.params.id,
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
 * Handle unfollowing a user.
 */
async function unfollow(req, res, next) {
  try {
    const data = await userService.unfollowUser({
      followerId: req.user.id,
      targetUserId: req.params.id,
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
 * Handle retrieving user profile by username.
 */
async function getProfile(req, res, next) {
  try {
    const currentUserId = req.user ? req.user.id : null;
    const profile = await userService.getUserProfile({
      username: req.params.username,
      currentUserId,
    });

    return res.status(200).json({
      success: true,
      data: {
        ...profile,
        user: profile,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Handle updating current user profile (bio, avatar_url).
 */
async function updateProfile(req, res, next) {
  try {
    const user = await userService.updateUserProfile({
      userId: req.user.id,
      bio: req.body.bio,
      avatar_url: req.body.avatar_url,
    });

    return res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  follow,
  unfollow,
  getProfile,
  updateProfile,
};
