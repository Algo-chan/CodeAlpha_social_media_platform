const request = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../src/app');
const { sequelize, User, Follow, Like } = require('../src/models');

describe('Posts API & Feeds', () => {
  let user1, user2, user3, token1, token2, token3;

  beforeEach(async () => {
    await sequelize.sync({ force: true });

    const reg1 = await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'u1', email: 'u1@t.com', password: 'Password123!' });
    token1 = reg1.body.data.token;
    user1 = reg1.body.data.user;

    const reg2 = await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'u2', email: 'u2@t.com', password: 'Password123!' });
    token2 = reg2.body.data.token;
    user2 = reg2.body.data.user;

    const reg3 = await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'u3', email: 'u3@t.com', password: 'Password123!' });
    token3 = reg3.body.data.token;
    user3 = reg3.body.data.user;
  });

  describe('Post Creation', () => {
    it('creates a text-only post', async () => {
      const res = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${token1}`)
        .field('content', 'First test post');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.post).toBeDefined();
      expect(res.body.data.post.content).toBe('First test post');
      expect(res.body.data.post.user_id).toBe(user1.id);
      expect(res.body.data.post.image_url).toBeNull();
      expect(res.body.data.post.author).toBeDefined();
      expect(res.body.data.post.author.username).toBe('u1');
    });

    it('creates a post with text and valid image upload', async () => {
      const samplePng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );

      const res = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${token1}`)
        .field('content', 'Post with image')
        .attach('image', samplePng, 'sample.png');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.post.content).toBe('Post with image');
      expect(res.body.data.post.image_url).toMatch(/^\/uploads\/.+\.png$/);

      // Verify file actually saved on disk
      const uploadedFilename = path.basename(res.body.data.post.image_url);
      const filePath = path.join(__dirname, '../public/uploads', uploadedFilename);
      expect(fs.existsSync(filePath)).toBe(true);

      // Cleanup
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });

    it('rejects post creation without authentication', async () => {
      const res = await request(app)
        .post('/api/v1/posts')
        .field('content', 'Unauthorized post');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects post creation with empty content', async () => {
      const res = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${token1}`)
        .field('content', '   ');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects post creation with content exceeding 500 characters', async () => {
      const longText = 'a'.repeat(501);
      const res = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${token1}`)
        .field('content', longText);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects post creation with invalid file MIME type', async () => {
      const textFile = Buffer.from('console.log("hello");');
      const res = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${token1}`)
        .field('content', 'Malicious file')
        .attach('image', textFile, 'virus.exe');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects post creation with file exceeding 5MB', async () => {
      const largeFile = Buffer.alloc(5 * 1024 * 1024 + 1024); // > 5MB
      const res = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${token1}`)
        .field('content', 'Large file')
        .attach('image', largeFile, 'huge.png');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Explore Feed', () => {
    it('lists posts sorted newest first with author and counts', async () => {
      await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${token1}`)
        .field('content', 'Post 1 by u1');

      await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${token2}`)
        .field('content', 'Post 2 by u2');

      const res = await request(app).get('/api/v1/posts?tab=explore');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.posts.length).toBe(2);
      expect(res.body.data.posts[0].content).toBe('Post 2 by u2');
      expect(res.body.data.posts[1].content).toBe('Post 1 by u1');
      expect(res.body.data.posts[0].likesCount).toBe(0);
      expect(res.body.data.posts[0].commentsCount).toBe(0);
      expect(res.body.data.posts[0].isLiked).toBe(false);
    });

    it('indicates isLiked for authenticated user in explore feed', async () => {
      const postRes = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${token1}`)
        .field('content', 'Post to be liked');

      const postId = postRes.body.data.post.id;
      await Like.create({ user_id: user2.id, post_id: postId });

      // User 2 checking feed -> isLiked true, likesCount 1
      const resU2 = await request(app)
        .get('/api/v1/posts?tab=explore')
        .set('Authorization', `Bearer ${token2}`);
      expect(resU2.body.data.posts[0].isLiked).toBe(true);
      expect(resU2.body.data.posts[0].likesCount).toBe(1);

      // Guest checking feed -> isLiked false, likesCount 1
      const resGuest = await request(app).get('/api/v1/posts?tab=explore');
      expect(resGuest.body.data.posts[0].isLiked).toBe(false);
      expect(resGuest.body.data.posts[0].likesCount).toBe(1);
    });

    it('supports pagination in explore feed', async () => {
      for (let i = 1; i <= 5; i++) {
        await request(app)
          .post('/api/v1/posts')
          .set('Authorization', `Bearer ${token1}`)
          .field('content', `Page item ${i}`);
      }

      const page1 = await request(app).get('/api/v1/posts?tab=explore&page=1&limit=2');
      expect(page1.body.data.posts.length).toBe(2);
      expect(page1.body.data.total).toBe(5);

      const page2 = await request(app).get('/api/v1/posts?tab=explore&page=2&limit=2');
      expect(page2.body.data.posts.length).toBe(2);

      const page3 = await request(app).get('/api/v1/posts?tab=explore&page=3&limit=2');
      expect(page3.body.data.posts.length).toBe(1);
    });
  });

  describe('Following Feed', () => {
    it('returns empty list gracefully when user follows 0 accounts or is guest', async () => {
      await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${token2}`)
        .field('content', 'Post from u2');

      // User 1 follows no one
      const userRes = await request(app)
        .get('/api/v1/posts?tab=following')
        .set('Authorization', `Bearer ${token1}`);
      expect(userRes.status).toBe(200);
      expect(userRes.body.data.posts).toEqual([]);
      expect(userRes.body.data.total).toBe(0);

      // Guest accessing following feed returns empty array gracefully
      const guestRes = await request(app).get('/api/v1/posts?tab=following');
      expect(guestRes.status).toBe(200);
      expect(guestRes.body.data.posts).toEqual([]);
    });

    it('filters following feed to only show followed authors', async () => {
      await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${token2}`)
        .field('content', 'Post from u2');

      await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${token3}`)
        .field('content', 'Post from u3');

      // user1 follows only user2
      await Follow.create({ follower_id: user1.id, following_id: user2.id });

      const feedRes = await request(app)
        .get('/api/v1/posts?tab=following')
        .set('Authorization', `Bearer ${token1}`);

      expect(feedRes.status).toBe(200);
      expect(feedRes.body.data.posts.length).toBe(1);
      expect(feedRes.body.data.posts[0].content).toBe('Post from u2');
      expect(feedRes.body.data.posts[0].author.username).toBe('u2');
    });
  });

  describe('Single Post Retrieval', () => {
    it('gets a single post by id with author and counts', async () => {
      const createRes = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${token1}`)
        .field('content', 'Single post test');

      const postId = createRes.body.data.post.id;

      const getRes = await request(app).get(`/api/v1/posts/${postId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.post.id).toBe(postId);
      expect(getRes.body.data.post.content).toBe('Single post test');
      expect(getRes.body.data.post.author.username).toBe('u1');
    });

    it('returns 404 for non-existent post', async () => {
      const getRes = await request(app).get('/api/v1/posts/9999');
      expect(getRes.status).toBe(404);
      expect(getRes.body.success).toBe(false);
    });
  });

  describe('Post Deletion', () => {
    it('allows author to delete own post and unlinks file from disk', async () => {
      const samplePng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );

      const postRes = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${token1}`)
        .field('content', 'Post to be deleted')
        .attach('image', samplePng, 'to_delete.png');

      const postId = postRes.body.data.post.id;
      const uploadedFilename = path.basename(postRes.body.data.post.image_url);
      const filePath = path.join(__dirname, '../public/uploads', uploadedFilename);
      expect(fs.existsSync(filePath)).toBe(true);

      const delRes = await request(app)
        .delete(`/api/v1/posts/${postId}`)
        .set('Authorization', `Bearer ${token1}`);

      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);

      // Verify file was unlinked
      expect(fs.existsSync(filePath)).toBe(false);

      // Verify post no longer exists
      const getRes = await request(app).get(`/api/v1/posts/${postId}`);
      expect(getRes.status).toBe(404);
    });

    it('rejects deletion by non-author with 403 Forbidden', async () => {
      const postRes = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${token1}`)
        .field('content', 'Author is u1');

      const postId = postRes.body.data.post.id;

      const delRes = await request(app)
        .delete(`/api/v1/posts/${postId}`)
        .set('Authorization', `Bearer ${token2}`);

      expect(delRes.status).toBe(403);
      expect(delRes.body.success).toBe(false);
    });

    it('rejects deletion without token with 401 Unauthorized', async () => {
      const postRes = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${token1}`)
        .field('content', 'Author is u1');

      const postId = postRes.body.data.post.id;

      const delRes = await request(app).delete(`/api/v1/posts/${postId}`);
      expect(delRes.status).toBe(401);
      expect(delRes.body.success).toBe(false);
    });

    it('returns 404 when deleting non-existent post', async () => {
      const delRes = await request(app)
        .delete('/api/v1/posts/99999')
        .set('Authorization', `Bearer ${token1}`);

      expect(delRes.status).toBe(404);
      expect(delRes.body.success).toBe(false);
    });
  });
});
