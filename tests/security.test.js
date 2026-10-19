const express = require('express');
const request = require('supertest');
const app = require('../src/app');
const { createAuthLimiter, createPostLimiter } = require('../src/middleware/rateLimit');

describe('Security Hardening & Headers', () => {
  it('sets secure HTTP headers via Helmet including custom CSP', async () => {
    const res = await request(app).get('/api/v1/posts?tab=explore');
    expect(res.headers['x-dns-prefetch-control']).toBeDefined();
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['content-security-policy']).toContain('res.cloudinary.com');
    expect(res.headers['content-security-policy']).toContain('images.unsplash.com');
  });

  it('allows high throughput in test mode without triggering 429', async () => {
    for (let i = 0; i < 20; i++) {
      const res = await request(app).get('/api/v1/posts?tab=explore');
      expect(res.status).not.toBe(429);
    }
  });

  it('configures trust proxy on express app', () => {
    expect(app.get('trust proxy')).toBeTruthy();
  });

  it('allows high throughput to auth routes in test mode without 429', async () => {
    for (let i = 0; i < 20; i++) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'wrong' });
      expect(res.status).not.toBe(429);
    }
  });

  it('enforces rate limits when active', async () => {
    const testApp = express();
    const limiter = createAuthLimiter({
      windowMs: 60 * 1000,
      max: 2,
    });
    testApp.use('/test-auth', limiter, (req, res) => res.json({ ok: true }));

    const res1 = await request(testApp).get('/test-auth');
    expect(res1.status).toBe(200);

    const res2 = await request(testApp).get('/test-auth');
    expect(res2.status).toBe(200);

    const res3 = await request(testApp).get('/test-auth');
    expect(res3.status).toBe(429);
    expect(res3.body.error.code).toBe('AUTH_RATE_LIMIT_EXCEEDED');
  });

  it('enforces post rate limits when active', async () => {
    const testApp = express();
    const limiter = createPostLimiter({
      windowMs: 60 * 1000,
      max: 2,
    });
    testApp.post('/test-post', limiter, (req, res) => res.json({ ok: true }));

    const res1 = await request(testApp).post('/test-post');
    expect(res1.status).toBe(200);

    const res2 = await request(testApp).post('/test-post');
    expect(res2.status).toBe(200);

    const res3 = await request(testApp).post('/test-post');
    expect(res3.status).toBe(429);
    expect(res3.body.error.code).toBe('POST_RATE_LIMIT_EXCEEDED');
  });
});
