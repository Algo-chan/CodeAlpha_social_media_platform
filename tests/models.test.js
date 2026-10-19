const { sequelize, User, Post, Comment, Like, Follow } = require('../src/models');

describe('Model Constraints and Associations', () => {
  beforeEach(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('User Model', () => {
    it('enforces unique username and email constraints', async () => {
      await User.create({
        username: 'alice',
        email: 'alice@test.com',
        password_hash: 'hash123',
      });

      // Duplicate username
      await expect(
        User.create({
          username: 'alice',
          email: 'different@test.com',
          password_hash: 'hash123',
        })
      ).rejects.toThrow();

      // Duplicate email
      await expect(
        User.create({
          username: 'bob',
          email: 'alice@test.com',
          password_hash: 'hash123',
        })
      ).rejects.toThrow();
    });
  });

  describe('Like Model', () => {
    it('prevents duplicate likes from the same user on a post', async () => {
      const user = await User.create({
        username: 'alice',
        email: 'alice@test.com',
        password_hash: 'hash',
      });
      const post = await Post.create({
        user_id: user.id,
        content: 'Hello world',
      });

      await Like.create({ user_id: user.id, post_id: post.id });
      await expect(
        Like.create({ user_id: user.id, post_id: post.id })
      ).rejects.toThrow();
    });
  });

  describe('Follow Model', () => {
    it('prevents self-following and duplicate follows', async () => {
      const bob = await User.create({
        username: 'bob',
        email: 'bob@test.com',
        password_hash: 'hash',
      });
      const charlie = await User.create({
        username: 'charlie',
        email: 'charlie@test.com',
        password_hash: 'hash',
      });

      // Self-following should fail
      await expect(
        Follow.create({ follower_id: bob.id, following_id: bob.id })
      ).rejects.toThrow();

      // First follow succeeds
      await Follow.create({ follower_id: bob.id, following_id: charlie.id });

      // Duplicate follow should fail
      await expect(
        Follow.create({ follower_id: bob.id, following_id: charlie.id })
      ).rejects.toThrow();
    });
  });

  describe('Associations', () => {
    it('supports Post author, comments with author, and likes associations', async () => {
      const author = await User.create({
        username: 'author_user',
        email: 'author@test.com',
        password_hash: 'hash',
      });
      const commenter = await User.create({
        username: 'commenter_user',
        email: 'commenter@test.com',
        password_hash: 'hash',
      });

      const post = await Post.create({
        user_id: author.id,
        content: 'My test post',
      });

      const comment = await Comment.create({
        post_id: post.id,
        user_id: commenter.id,
        content: 'Great post!',
      });

      const like = await Like.create({
        post_id: post.id,
        user_id: commenter.id,
      });

      // Fetch post with author, comments (with author), and likes
      const loadedPost = await Post.findByPk(post.id, {
        include: [
          { model: User, as: 'author' },
          { model: Comment, include: [{ model: User, as: 'author' }] },
          { model: Like, include: [User] },
        ],
      });

      expect(loadedPost.author.username).toBe('author_user');
      expect(loadedPost.Comments.length).toBe(1);
      expect(loadedPost.Comments[0].content).toBe('Great post!');
      expect(loadedPost.Comments[0].author.username).toBe('commenter_user');
      expect(loadedPost.Likes.length).toBe(1);
      expect(loadedPost.Likes[0].user_id).toBe(commenter.id);
    });

    it('supports Followers and Following many-to-many associations', async () => {
      const user1 = await User.create({
        username: 'user1',
        email: 'u1@test.com',
        password_hash: 'hash',
      });
      const user2 = await User.create({
        username: 'user2',
        email: 'u2@test.com',
        password_hash: 'hash',
      });

      await Follow.create({ follower_id: user1.id, following_id: user2.id });

      const u2Followers = await user2.getFollowers();
      const u1Following = await user1.getFollowing();

      expect(u2Followers.length).toBe(1);
      expect(u2Followers[0].id).toBe(user1.id);
      expect(u1Following.length).toBe(1);
      expect(u1Following[0].id).toBe(user2.id);
    });

    it('cascades deletion of posts when user is deleted, and comments/likes when post is deleted', async () => {
      const user = await User.create({
        username: 'test_cascade',
        email: 'cascade@test.com',
        password_hash: 'hash',
      });
      const post = await Post.create({
        user_id: user.id,
        content: 'To be deleted',
      });
      await Comment.create({
        post_id: post.id,
        user_id: user.id,
        content: 'Comment on delete',
      });
      await Like.create({
        post_id: post.id,
        user_id: user.id,
      });

      // Delete post
      await post.destroy();
      const commentsAfterPostDestroy = await Comment.findAll({ where: { post_id: post.id } });
      const likesAfterPostDestroy = await Like.findAll({ where: { post_id: post.id } });
      expect(commentsAfterPostDestroy.length).toBe(0);
      expect(likesAfterPostDestroy.length).toBe(0);

      // Create another post and delete user
      const post2 = await Post.create({
        user_id: user.id,
        content: 'Post 2',
      });
      await user.destroy();
      const postsAfterUserDestroy = await Post.findAll({ where: { user_id: user.id } });
      expect(postsAfterUserDestroy.length).toBe(0);
    });
  });
});
