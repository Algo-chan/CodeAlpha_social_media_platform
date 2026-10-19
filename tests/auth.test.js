const request = require('supertest');
const app = require('../src/app');
const { sequelize, User } = require('../src/models');
const { signToken, verifyToken } = require('../src/utils/jwt');
const { authenticateToken, optionalAuth } = require('../src/middleware/auth');

describe('Auth API & JWT Middleware', () => {
  beforeEach(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('POST /api/v1/auth/register', () => {
    it('registers a new user and returns JWT token and sanitized user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'johndoe', email: 'john@example.com', password: 'Password123!' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(typeof res.body.data.token).toBe('string');
      expect(res.body.data.user.username).toBe('johndoe');
      expect(res.body.data.user.email).toBe('john@example.com');
      expect(res.body.data.user.password_hash).toBeUndefined();

      // Verify token payload
      const decoded = verifyToken(res.body.data.token);
      expect(decoded.id).toBe(res.body.data.user.id);
      expect(decoded.username).toBe('johndoe');
    });

    it('fails registration with duplicate username', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'john', email: 'j1@ex.com', password: 'Password123!' });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'john', email: 'j2@ex.com', password: 'Password123!' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.message).toBeDefined();
    });

    it('fails registration with duplicate email', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'john1', email: 'duplicate@ex.com', password: 'Password123!' });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'john2', email: 'duplicate@ex.com', password: 'Password123!' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });

    it('validates required fields', async () => {
      const res1 = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'test@ex.com', password: 'Password123!' });
      expect(res1.status).toBe(400);
      expect(res1.body.success).toBe(false);

      const res2 = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'testuser', password: 'Password123!' });
      expect(res2.status).toBe(400);
      expect(res2.body.success).toBe(false);

      const res3 = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'testuser', email: 'test@ex.com' });
      expect(res3.status).toBe(400);
      expect(res3.body.success).toBe(false);
    });

    it('validates email format', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'validuser', email: 'invalid-email', password: 'Password123!' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('validates password minimum length of 6', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'validuser', email: 'val@ex.com', password: '123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('validates alphanumeric username', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'user with spaces!', email: 'val@ex.com', password: 'Password123!' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'alice', email: 'alice@example.com', password: 'SecurePassword123' });
    });

    it('logs in successfully using username', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ login: 'alice', password: 'SecurePassword123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.username).toBe('alice');
      expect(res.body.data.user.password_hash).toBeUndefined();
    });

    it('logs in successfully using email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ login: 'alice@example.com', password: 'SecurePassword123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe('alice@example.com');
      expect(res.body.data.user.password_hash).toBeUndefined();
    });

    it('rejects invalid password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ login: 'alice', password: 'WrongPassword' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });

    it('rejects non-existent login', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ login: 'nonexistent', password: 'Password123!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });

    it('rejects missing login or password', async () => {
      const res1 = await request(app)
        .post('/api/v1/auth/login')
        .send({ password: 'Password123!' });
      expect(res1.status).toBe(400);

      const res2 = await request(app)
        .post('/api/v1/auth/login')
        .send({ login: 'alice' });
      expect(res2.status).toBe(400);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    let token, user;

    beforeEach(async () => {
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({ username: 'bob', email: 'bob@example.com', password: 'Password123!' });
      token = regRes.body.data.token;
      user = regRes.body.data.user;
    });

    it('returns current user profile with valid Bearer token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.id).toBe(user.id);
      expect(res.body.data.user.username).toBe('bob');
      expect(res.body.data.user.email).toBe('bob@example.com');
      expect(res.body.data.user.password_hash).toBeUndefined();
    });

    it('rejects request without token with 401', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });

    it('rejects request with invalid token with 401', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token-value');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('Middleware: optionalAuth', () => {
    it('leaves req.user undefined/null when no token is present', async () => {
      const req = { headers: {} };
      const res = {};
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      await optionalAuth(req, res, next);
      expect(nextCalled).toBe(true);
      expect(req.user).toBeFalsy();
    });

    it('populates req.user when valid token is present', async () => {
      const testUser = await User.create({
        username: 'charlie',
        email: 'charlie@example.com',
        password_hash: 'hash'
      });
      const validToken = signToken({ id: testUser.id, username: testUser.username });

      const req = { headers: { authorization: `Bearer ${validToken}` } };
      const res = {};
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      await optionalAuth(req, res, next);
      expect(nextCalled).toBe(true);
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(testUser.id);
      expect(req.user.username).toBe('charlie');
    });
  });
});
