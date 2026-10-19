const bcrypt = require('bcryptjs');
const { seedDatabase } = require('../scripts/seed');
const { sequelize, User, Post, Comment, Like, Follow } = require('../src/models');

describe('Database Seeder', () => {
  beforeEach(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('seeds demo users, posts, and relationships', async () => {
    const summary = await seedDatabase();

    const userCount = await User.count();
    const postCount = await Post.count();
    const commentCount = await Comment.count();
    const likeCount = await Like.count();
    const followCount = await Follow.count();

    expect(userCount).toBeGreaterThanOrEqual(4);
    expect(postCount).toBeGreaterThanOrEqual(8);
    expect(commentCount).toBeGreaterThanOrEqual(1);
    expect(likeCount).toBeGreaterThanOrEqual(1);
    expect(followCount).toBeGreaterThanOrEqual(3);

    // Verify demo users
    const demoUsers = await User.findAll();
    for (const user of demoUsers) {
      expect(user.password_hash).toBeDefined();
      const isMatch = await bcrypt.compare('password123', user.password_hash);
      expect(isMatch).toBe(true);
      expect(user.bio).toBeDefined();
    }

    // Verify summary returned
    expect(summary).toBeDefined();
    expect(summary.users).toBeGreaterThanOrEqual(4);
    expect(summary.posts).toBeGreaterThanOrEqual(8);
  });

  it('boots server and listens on configured port', async () => {
    process.env.PORT = '0';
    const { startServer } = require('../src/server');
    const server = await startServer();
    expect(server).toBeDefined();
    expect(server.listening).toBe(true);
    await new Promise((resolve) => server.close(resolve));
  });
});

