const { sequelize } = require('../config/database');
const defineUser = require('./User');
const definePost = require('./Post');
const defineComment = require('./Comment');
const defineLike = require('./Like');
const defineFollow = require('./Follow');

const User = defineUser(sequelize);
const Post = definePost(sequelize);
const Comment = defineComment(sequelize);
const Like = defineLike(sequelize);
const Follow = defineFollow(sequelize);

// User <-> Post
User.hasMany(Post, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Post.belongsTo(User, { foreignKey: 'user_id', as: 'author' });

// Post <-> Comment
Post.hasMany(Comment, { foreignKey: 'post_id', onDelete: 'CASCADE' });
Comment.belongsTo(Post, { foreignKey: 'post_id' });

// User <-> Comment
User.hasMany(Comment, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Comment.belongsTo(User, { foreignKey: 'user_id', as: 'author' });

// Comment <-> Comment (Self-referencing for parent/reply comments)
Comment.hasMany(Comment, { foreignKey: 'parent_comment_id', as: 'replies', onDelete: 'CASCADE' });
Comment.belongsTo(Comment, { foreignKey: 'parent_comment_id', as: 'parent' });

// Post <-> Like
Post.hasMany(Like, { foreignKey: 'post_id', onDelete: 'CASCADE' });
Like.belongsTo(Post, { foreignKey: 'post_id' });

// User <-> Like
User.hasMany(Like, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Like.belongsTo(User, { foreignKey: 'user_id' });

// User <-> User (Follows)
User.belongsToMany(User, {
  as: 'Followers',
  through: Follow,
  foreignKey: 'following_id',
  otherKey: 'follower_id',
});

User.belongsToMany(User, {
  as: 'Following',
  through: Follow,
  foreignKey: 'follower_id',
  otherKey: 'following_id',
});

User.hasMany(Follow, { foreignKey: 'follower_id', as: 'followingRelations', onDelete: 'CASCADE' });
User.hasMany(Follow, { foreignKey: 'following_id', as: 'followerRelations', onDelete: 'CASCADE' });
Follow.belongsTo(User, { foreignKey: 'follower_id', as: 'follower' });
Follow.belongsTo(User, { foreignKey: 'following_id', as: 'following' });

module.exports = {
  sequelize,
  User,
  Post,
  Comment,
  Like,
  Follow,
};
