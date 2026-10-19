const request = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../src/app');
const { sequelize } = require('../src/models');

describe('End-to-End Social Media Flow', () => {
  let createdImagePath = null;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    if (createdImagePath && fs.existsSync(createdImagePath)) {
      try {
        fs.unlinkSync(createdImagePath);
      } catch (err) {
        // Ignore file cleanup errors
      }
    }
  });

  it('runs complete lifecycle: register, post with image, like, comment, follow, view feeds and profiles, verify auth gating & invariants', async () => {
    // 1. Register User 1 (dev_user)
    const u1Res = await request(app).post('/api/v1/auth/register').send({
      username: 'dev_user',
      email: 'dev@test.com',
      password: 'Password123!',
    });
    expect(u1Res.status).toBe(201);
    expect(u1Res.body.success).toBe(true);
    const token1 = u1Res.body.data.token;
    const u1 = u1Res.body.data.user;
    expect(u1.username).toBe('dev_user');

    // Register User 2 (designer_user)
    const u2Res = await request(app).post('/api/v1/auth/register').send({
      username: 'designer_user',
      email: 'design@test.com',
      password: 'Password123!',
    });
    expect(u2Res.status).toBe(201);
    expect(u2Res.body.success).toBe(true);
    const token2 = u2Res.body.data.token;
    const u2 = u2Res.body.data.user;
    expect(u2.username).toBe('designer_user');

    // 2. User 1 publishes a text + image post
    const samplePng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    const postRes = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token1}`)
      .field('content', 'Excited to show our new UI!')
      .attach('image', samplePng, 'screenshot.png');

    expect(postRes.status).toBe(201);
    expect(postRes.body.success).toBe(true);
    const post = postRes.body.data.post;
    expect(post.content).toBe('Excited to show our new UI!');
    expect(post.image_url).toMatch(/^\/uploads\/.+\.png$/);
    expect(post.user_id).toBe(u1.id);
    const postId = post.id;

    if (post.image_url) {
      const filename = path.basename(post.image_url);
      createdImagePath = path.join(__dirname, '../public/uploads', filename);
      expect(fs.existsSync(createdImagePath)).toBe(true);
    }

    // 3. User 2 likes the post (verifying like status and like counter = 1)
    const likeRes = await request(app)
      .post(`/api/v1/posts/${postId}/likes`)
      .set('Authorization', `Bearer ${token2}`);
    expect(likeRes.status).toBe(200);
    expect(likeRes.body.success).toBe(true);
    expect(likeRes.body.data.liked).toBe(true);
    expect(likeRes.body.data.likesCount).toBe(1);

    // 4. User 2 adds a comment to the post (verifying comments list and comment counter = 1)
    const commentRes = await request(app)
      .post(`/api/v1/posts/${postId}/comments`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ content: 'Looks super clean!' });
    expect(commentRes.status).toBe(201);
    expect(commentRes.body.success).toBe(true);
    expect(commentRes.body.data.comment.content).toBe('Looks super clean!');
    expect(commentRes.body.data.comment.author.username).toBe('designer_user');

    const commentListRes = await request(app).get(`/api/v1/posts/${postId}/comments`);
    expect(commentListRes.status).toBe(200);
    expect(commentListRes.body.success).toBe(true);
    expect(commentListRes.body.data.comments).toHaveLength(1);
    expect(commentListRes.body.data.comments[0].content).toBe('Looks super clean!');

    // 5. User 2 follows User 1
    const followRes = await request(app)
      .post(`/api/v1/users/${u1.id}/follow`)
      .set('Authorization', `Bearer ${token2}`);
    expect(followRes.status).toBe(200);
    expect(followRes.body.success).toBe(true);
    expect(followRes.body.data.following).toBe(true);
    expect(followRes.body.data.followersCount).toBe(1);

    // 6. User 2 checks Following feed (/api/v1/posts?tab=following)
    // Confirms User 1's post appears with isLiked: true, likesCount: 1, commentsCount: 1
    const followingFeedRes = await request(app)
      .get('/api/v1/posts?tab=following')
      .set('Authorization', `Bearer ${token2}`);
    expect(followingFeedRes.status).toBe(200);
    expect(followingFeedRes.body.success).toBe(true);
    expect(followingFeedRes.body.data.posts.length).toBe(1);
    const followingPost = followingFeedRes.body.data.posts[0];
    expect(followingPost.id).toBe(postId);
    expect(followingPost.isLiked).toBe(true);
    expect(followingPost.likesCount).toBe(1);
    expect(followingPost.commentsCount).toBe(1);

    // 7. User 2 checks User 1's public profile (/api/v1/users/dev_user)
    // Confirms followersCount: 1, postsCount: 1, and isFollowing: true
    const profileRes = await request(app)
      .get('/api/v1/users/dev_user')
      .set('Authorization', `Bearer ${token2}`);
    expect(profileRes.status).toBe(200);
    expect(profileRes.body.success).toBe(true);
    expect(profileRes.body.data.username).toBe('dev_user');
    expect(profileRes.body.data.followersCount).toBe(1);
    expect(profileRes.body.data.postsCount).toBe(1);
    expect(profileRes.body.data.isFollowing).toBe(true);
    expect(profileRes.body.data.posts.length).toBe(1);

    // 8. Anonymous guest visits /api/v1/posts?tab=explore and sees the post with isLiked: false
    const guestExploreRes = await request(app).get('/api/v1/posts?tab=explore');
    expect(guestExploreRes.status).toBe(200);
    expect(guestExploreRes.body.success).toBe(true);
    expect(guestExploreRes.body.data.posts.length).toBe(1);
    const guestPost = guestExploreRes.body.data.posts[0];
    expect(guestPost.id).toBe(postId);
    expect(guestPost.isLiked).toBe(false);
    expect(guestPost.likesCount).toBe(1);
    expect(guestPost.commentsCount).toBe(1);

    // 9. Gated actions verification: unauthenticated like, comment, and follow requests return 401
    const anonLikeRes = await request(app).post(`/api/v1/posts/${postId}/likes`);
    expect(anonLikeRes.status).toBe(401);
    expect(anonLikeRes.body.success).toBe(false);

    const anonCommentRes = await request(app)
      .post(`/api/v1/posts/${postId}/comments`)
      .send({ content: 'Unauthenticated comment attempt' });
    expect(anonCommentRes.status).toBe(401);
    expect(anonCommentRes.body.success).toBe(false);

    const anonFollowRes = await request(app).post(`/api/v1/users/${u1.id}/follow`);
    expect(anonFollowRes.status).toBe(401);
    expect(anonFollowRes.body.success).toBe(false);

    // 10. Duplicate like attempt and self-follow rejection checks pass
    // Duplicate like attempt by User 2
    const dupLikeRes = await request(app)
      .post(`/api/v1/posts/${postId}/likes`)
      .set('Authorization', `Bearer ${token2}`);
    expect(dupLikeRes.status).toBe(200);
    expect(dupLikeRes.body.success).toBe(true);
    expect(dupLikeRes.body.data.liked).toBe(true);
    expect(dupLikeRes.body.data.likesCount).toBe(1);

    // Self-follow rejection attempt by User 1
    const selfFollowRes = await request(app)
      .post(`/api/v1/users/${u1.id}/follow`)
      .set('Authorization', `Bearer ${token1}`);
    expect(selfFollowRes.status).toBe(400);
    expect(selfFollowRes.body.success).toBe(false);
    expect(selfFollowRes.body.error.code).toBe('CANNOT_FOLLOW_SELF');
  });
});
