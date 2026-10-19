const request = require('supertest');
const app = require('../src/app');
const { sequelize } = require('../src/models');

describe('Interactions API', () => {
  let tokenA, userA, tokenB, userB, tokenC, userC, post;

  beforeEach(async () => {
    await sequelize.sync({ force: true });

    const regA = await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'alice', email: 'alice@example.com', password: 'Password123!' });
    const regB = await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'bob', email: 'bob@example.com', password: 'Password123!' });
    const regC = await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'charlie', email: 'charlie@example.com', password: 'Password123!' });

    tokenA = regA.body.data.token;
    userA = regA.body.data.user;
    tokenB = regB.body.data.token;
    userB = regB.body.data.user;
    tokenC = regC.body.data.token;
    userC = regC.body.data.user;

    const postRes = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${tokenA}`)
      .field('content', 'Alice test post');
    post = postRes.body.data.post;
  });

  describe('Likes', () => {
    it('allows liking and unliking a post idempotently', async () => {
      // 1. First like
      const likeRes = await request(app)
        .post(`/api/v1/posts/${post.id}/likes`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(likeRes.status).toBe(200);
      expect(likeRes.body.success).toBe(true);
      expect(likeRes.body.data.liked).toBe(true);
      expect(likeRes.body.data.likesCount).toBe(1);

      // 2. Duplicate like attempt returns success/already liked
      const dupRes = await request(app)
        .post(`/api/v1/posts/${post.id}/likes`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(dupRes.status).toBe(200);
      expect(dupRes.body.success).toBe(true);
      expect(dupRes.body.data.liked).toBe(true);
      expect(dupRes.body.data.likesCount).toBe(1);

      // 3. Second user likes post
      const userCLike = await request(app)
        .post(`/api/v1/posts/${post.id}/likes`)
        .set('Authorization', `Bearer ${tokenC}`);
      expect(userCLike.status).toBe(200);
      expect(userCLike.body.data.likesCount).toBe(2);

      // 4. Unlike post
      const unlikeRes = await request(app)
        .delete(`/api/v1/posts/${post.id}/likes`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(unlikeRes.status).toBe(200);
      expect(unlikeRes.body.success).toBe(true);
      expect(unlikeRes.body.data.liked).toBe(false);
      expect(unlikeRes.body.data.likesCount).toBe(1);

      // 5. Idempotent unlike
      const dupUnlike = await request(app)
        .delete(`/api/v1/posts/${post.id}/likes`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(dupUnlike.status).toBe(200);
      expect(dupUnlike.body.data.liked).toBe(false);
      expect(dupUnlike.body.data.likesCount).toBe(1);
    });

    it('requires authentication for liking and unliking', async () => {
      const likeRes = await request(app).post(`/api/v1/posts/${post.id}/likes`);
      expect(likeRes.status).toBe(401);

      const unlikeRes = await request(app).delete(`/api/v1/posts/${post.id}/likes`);
      expect(unlikeRes.status).toBe(401);
    });

    it('returns 404 when liking non-existent post', async () => {
      const res = await request(app)
        .post('/api/v1/posts/99999/likes')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Comments', () => {
    it('creates a comment and retrieves post comments list with author info', async () => {
      const createRes = await request(app)
        .post(`/api/v1/posts/${post.id}/comments`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ content: 'Awesome post Alice!' });

      expect(createRes.status).toBe(201);
      expect(createRes.body.success).toBe(true);
      expect(createRes.body.data.comment).toBeDefined();
      expect(createRes.body.data.comment.content).toBe('Awesome post Alice!');
      expect(createRes.body.data.comment.author.username).toBe('bob');

      // Second comment by Alice
      await request(app)
        .post(`/api/v1/posts/${post.id}/comments`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ content: 'Thank you Bob!' });

      // Get comments
      const listRes = await request(app).get(`/api/v1/posts/${post.id}/comments`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.success).toBe(true);
      expect(listRes.body.data.comments).toHaveLength(2);
      expect(listRes.body.data.comments[0].content).toBe('Awesome post Alice!');
      expect(listRes.body.data.comments[0].author.username).toBe('bob');
      expect(listRes.body.data.comments[1].content).toBe('Thank you Bob!');
      expect(listRes.body.data.comments[1].author.username).toBe('alice');
    });

    it('validates comment content length (1 to 300 chars)', async () => {
      const emptyRes = await request(app)
        .post(`/api/v1/posts/${post.id}/comments`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ content: '' });
      expect(emptyRes.status).toBe(400);
      expect(emptyRes.body.success).toBe(false);

      const whitespaceRes = await request(app)
        .post(`/api/v1/posts/${post.id}/comments`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ content: '   ' });
      expect(whitespaceRes.status).toBe(400);

      const tooLongRes = await request(app)
        .post(`/api/v1/posts/${post.id}/comments`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ content: 'a'.repeat(301) });
      expect(tooLongRes.status).toBe(400);
    });

    it('requires authentication to post comment', async () => {
      const res = await request(app)
        .post(`/api/v1/posts/${post.id}/comments`)
        .send({ content: 'Unauthorized comment' });
      expect(res.status).toBe(401);
    });

    it('returns 404 when commenting on non-existent post', async () => {
      const res = await request(app)
        .post('/api/v1/posts/99999/comments')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ content: 'Hello' });
      expect(res.status).toBe(404);
    });
  });

  describe('Follow Network', () => {
    it('allows following and unfollowing users idempotently', async () => {
      // Bob follows Alice
      const followRes = await request(app)
        .post(`/api/v1/users/${userA.id}/follow`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(followRes.status).toBe(200);
      expect(followRes.body.success).toBe(true);
      expect(followRes.body.data.following).toBe(true);
      expect(followRes.body.data.followersCount).toBe(1);

      // Duplicate follow
      const dupFollow = await request(app)
        .post(`/api/v1/users/${userA.id}/follow`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(dupFollow.status).toBe(200);
      expect(dupFollow.body.data.following).toBe(true);
      expect(dupFollow.body.data.followersCount).toBe(1);

      // Charlie also follows Alice
      const charlieFollow = await request(app)
        .post(`/api/v1/users/${userA.id}/follow`)
        .set('Authorization', `Bearer ${tokenC}`);
      expect(charlieFollow.status).toBe(200);
      expect(charlieFollow.body.data.followersCount).toBe(2);

      // Bob unfollows Alice
      const unfollowRes = await request(app)
        .delete(`/api/v1/users/${userA.id}/follow`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(unfollowRes.status).toBe(200);
      expect(unfollowRes.body.success).toBe(true);
      expect(unfollowRes.body.data.following).toBe(false);
      expect(unfollowRes.body.data.followersCount).toBe(1);
    });

    it('rejects self-follow attempt with 400 Bad Request', async () => {
      const res = await request(app)
        .post(`/api/v1/users/${userA.id}/follow`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CANNOT_FOLLOW_SELF');
    });

    it('requires authentication to follow or unfollow', async () => {
      const followRes = await request(app).post(`/api/v1/users/${userA.id}/follow`);
      expect(followRes.status).toBe(401);

      const unfollowRes = await request(app).delete(`/api/v1/users/${userA.id}/follow`);
      expect(unfollowRes.status).toBe(401);
    });

    it('returns 404 when target user does not exist', async () => {
      const res = await request(app)
        .post('/api/v1/users/99999/follow')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(404);
    });
  });

  describe('User Profile', () => {
    it('returns profile with counts, isFollowing flag, and recent posts', async () => {
      // Bob follows Alice
      await request(app)
        .post(`/api/v1/users/${userA.id}/follow`)
        .set('Authorization', `Bearer ${tokenB}`);

      // Guest view of Alice's profile
      const guestRes = await request(app).get(`/api/v1/users/${userA.username}`);
      expect(guestRes.status).toBe(200);
      expect(guestRes.body.success).toBe(true);
      expect(guestRes.body.data.username).toBe('alice');
      expect(guestRes.body.data.followersCount).toBe(1);
      expect(guestRes.body.data.followingCount).toBe(0);
      expect(guestRes.body.data.postsCount).toBe(1);
      expect(guestRes.body.data.isFollowing).toBe(false);
      expect(guestRes.body.data.posts).toBeDefined();
      expect(guestRes.body.data.posts.length).toBe(1);

      // Authenticated view by Bob (who follows Alice)
      const authRes = await request(app)
        .get(`/api/v1/users/${userA.username}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(authRes.status).toBe(200);
      expect(authRes.body.data.isFollowing).toBe(true);

      // Authenticated view by Alice (her own profile -> isFollowing is false)
      const ownRes = await request(app)
        .get(`/api/v1/users/${userA.username}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(ownRes.status).toBe(200);
      expect(ownRes.body.data.isFollowing).toBe(false);
    });

    it('returns 404 for non-existent user profile', async () => {
      const res = await request(app).get('/api/v1/users/nonexistentuser');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('updates user profile bio and avatar_url', async () => {
      const updateRes = await request(app)
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          bio: 'Full-stack software developer',
          avatar_url: 'https://example.com/avatar.png',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.data.user.bio).toBe('Full-stack software developer');
      expect(updateRes.body.data.user.avatar_url).toBe('https://example.com/avatar.png');

      // Verify profile get reflects changes
      const getRes = await request(app).get(`/api/v1/users/${userA.username}`);
      expect(getRes.body.data.bio).toBe('Full-stack software developer');
      expect(getRes.body.data.avatar_url).toBe('https://example.com/avatar.png');
    });

    it('requires authentication to update profile', async () => {
      const res = await request(app)
        .put('/api/v1/users/profile')
        .send({ bio: 'Hacker' });
      expect(res.status).toBe(401);
    });
  });
});
