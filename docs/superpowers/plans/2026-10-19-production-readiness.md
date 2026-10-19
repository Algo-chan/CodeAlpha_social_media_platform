# Production Readiness & Zero-Cost Cloud Deployment Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the mini social media web platform into a real-world, production-ready system running at zero cost with managed PostgreSQL, Cloudinary persistent media storage, rate limiting, and security hardening.

**Architecture:** Sequelize multi-dialect configuration (`DATABASE_URL` -> PostgreSQL with SSL; fallback to SQLite for offline/testing), Multer memory buffer piped to Cloudinary CDN for persistent media URLs with automatic deletion, `helmet` with custom CSP allowing Cloudinary assets, `express-rate-limit` for DDoS/brute-force defense (bypassed in test mode), reverse proxy trust, and comprehensive deployment guide for free hosting on Render/Railway + Neon.tech + Cloudinary.

**Tech Stack:** Node.js, Express.js, PostgreSQL (`pg`, `pg-hstore`), SQLite (tests/offline), Cloudinary SDK, Helmet, Express-Rate-Limit, Jest + Supertest.

**Spec:** [docs/superpowers/specs/2026-10-19-production-readiness-design.md](file:///c:/Users/USER/Desktop/CodeAlpha_social_media_platform/docs/superpowers/specs/2026-10-19-production-readiness-design.md)

## Global Constraints

- Zero-cost: Everything must be runnable and deployable on 100% free tiers (Neon.tech PostgreSQL, Cloudinary Free, Render.com free web service).
- Clean production state: Normal `npm start` must run on clean database tables without automatic demo seeding.
- Backward compatibility: Existing test suites and offline local development without Cloudinary credentials or internet must continue to pass 100%.
- Security: Helmet security headers with CSP permitting `res.cloudinary.com`, rate limiting on auth endpoints (15 req / 15 min) and post creation (30 posts / hour).

## Review Focus

- Automated tests must bypass rate limiting when `NODE_ENV === 'test'` to avoid false `429 Too Many Requests`.
- Upload pipeline must fall back cleanly to local disk storage if Cloudinary credentials are not provided.
- Helmet Content-Security-Policy must allow `https://res.cloudinary.com` in `img-src` so browser doesn't block user photos.
- PostgreSQL connection in Sequelize must support SSL mode (`ssl: { require: true, rejectUnauthorized: false }`) required by Neon/Supabase cloud databases.
- Deleting a post must clean up the asset in Cloudinary if `image_url` is a Cloudinary URL.

---

### Task 1: Multi-Dialect Database Support (PostgreSQL + SQLite Fallback)

**Files:**
- Modify: `package.json`
- Modify: `src/config/database.js`
- Test: `tests/database.test.js`

**Interfaces:**
- Consumes: `process.env.DATABASE_URL`, `process.env.NODE_ENV`
- Produces: Sequelize connection supporting both PostgreSQL (via `pg` and `pg-hstore` with SSL) and SQLite (`:memory:` or local file).

- [ ] **Step 1: Write test for PostgreSQL dialect configuration check**

```javascript
// tests/database-config.test.js
const { getDatabaseConfig } = require('../src/config/database');

describe('Database Configuration Multi-Dialect', () => {
  it('detects postgresql from DATABASE_URL and configures SSL', () => {
    const config = getDatabaseConfig('postgresql://user:pass@ep-cool.us-east-2.aws.neon.tech/neondb?sslmode=require');
    expect(config.dialect).toBe('postgres');
    expect(config.dialectOptions.ssl).toBeDefined();
  });

  it('falls back to sqlite in-memory for test environment', () => {
    const config = getDatabaseConfig(undefined, 'test');
    expect(config.dialect).toBe('sqlite');
    expect(config.storage).toBe(':memory:');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/database-config.test.js`
Expected: FAIL (`getDatabaseConfig` is not defined)

- [ ] **Step 3: Install `pg` & `pg-hstore` and implement `getDatabaseConfig` in `src/config/database.js`**

Run: `npm install pg pg-hstore`
Update `src/config/database.js` to export `{ sequelize, getDatabaseConfig }` dynamically switching between Postgres and SQLite based on `process.env.DATABASE_URL`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/database-config.test.js tests/database.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/config/database.js tests/database-config.test.js
git commit -m "feat: add postgresql support with ssl and sqlite fallback"
```

---

### Task 2: Cloudinary Media Storage Integration

**Files:**
- Modify: `package.json`
- Create: `src/utils/cloudinary.js`
- Modify: `src/middleware/upload.js`
- Modify: `src/services/post.service.js`
- Test: `tests/cloudinary.test.js`

**Interfaces:**
- Consumes: `process.env.CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- Produces:
  - `uploadToCloudinary(buffer, options)` -> Promise<{ secure_url, public_id }>
  - `deleteFromCloudinary(publicIdOrUrl)` -> Promise
  - `uploadPostMedia` middleware utilizing `memoryStorage()` when Cloudinary is configured, or `diskStorage()` when running locally without credentials.

- [ ] **Step 1: Write tests for Cloudinary utility and fallback upload**

```javascript
// tests/cloudinary.test.js
const { extractPublicId, isCloudinaryConfigured } = require('../src/utils/cloudinary');

describe('Cloudinary Integration Helper', () => {
  it('extracts public ID from Cloudinary secure URL', () => {
    const url = 'https://res.cloudinary.com/demo/image/upload/v1612345678/social_posts/sample_post_123.jpg';
    expect(extractPublicId(url)).toBe('social_posts/sample_post_123');
  });

  it('detects if Cloudinary is configured via environment', () => {
    expect(isCloudinaryConfigured({})).toBe(false);
    expect(isCloudinaryConfigured({ CLOUDINARY_CLOUD_NAME: 'c', CLOUDINARY_API_KEY: 'k', CLOUDINARY_API_SECRET: 's' })).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/cloudinary.test.js`
Expected: FAIL

- [ ] **Step 3: Install `cloudinary` and implement Cloudinary utilities and upload middleware**

Run: `npm install cloudinary`
Implement `src/utils/cloudinary.js` with `uploadToCloudinary`, `deleteFromCloudinary`, and `extractPublicId`. Update `src/middleware/upload.js` and `src/services/post.service.js` to pipe memory buffer to Cloudinary when configured, otherwise save to disk.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/cloudinary.test.js tests/posts.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/utils/cloudinary.js src/middleware/upload.js src/services/post.service.js tests/cloudinary.test.js
git commit -m "feat: integrate cloudinary cloud media pipeline with local disk fallback"
```

---

### Task 3: Security Hardening (Helmet, Rate Limiting & Proxy Trust)

**Files:**
- Modify: `package.json`
- Create: `src/middleware/rateLimit.js`
- Modify: `src/app.js`
- Test: `tests/security.test.js`

**Interfaces:**
- Produces:
  - `authLimiter` (15 requests / 15 minutes per IP on auth routes)
  - `postLimiter` (30 posts / hour per user/IP on post creation)
  - `app.set('trust proxy', 1)` for reverse proxy IP detection
  - Helmet CSP headers permitting `https://res.cloudinary.com` and `https://images.unsplash.com`

- [ ] **Step 1: Write test for security headers and rate limiter bypass in test mode**

```javascript
// tests/security.test.js
const request = require('supertest');
const app = require('../src/app');

describe('Security Hardening & Headers', () => {
  it('sets secure HTTP headers via Helmet including custom CSP', async () => {
    const res = await request(app).get('/api/v1/posts?tab=explore');
    expect(res.headers['x-dns-prefetch-control']).toBeDefined();
    expect(res.headers['content-security-policy']).toContain('res.cloudinary.com');
  });

  it('allows high throughput in test mode without triggering 429', async () => {
    for (let i = 0; i < 20; i++) {
      const res = await request(app).get('/api/v1/posts?tab=explore');
      expect(res.status).not.toBe(429);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/security.test.js`
Expected: FAIL (missing helmet headers or CSP)

- [ ] **Step 3: Install `helmet` and `express-rate-limit`, configure in `src/app.js`**

Run: `npm install helmet express-rate-limit`
Implement `src/middleware/rateLimit.js` (bypassing if `NODE_ENV === 'test'`). Configure Helmet CSP in `src/app.js` and mount `authLimiter` on `/api/v1/auth` and `postLimiter` on `POST /api/v1/posts`. Add `app.set('trust proxy', 1)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/security.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/middleware/rateLimit.js src/app.js tests/security.test.js
git commit -m "feat: add helmet security headers, rate limiting, and reverse proxy trust"
```

---

### Task 4: Production Environment Templates & Zero-Cost Cloud Deployment Guide

**Files:**
- Create: `.env.production.example`
- Create: `render.yaml`
- Modify: `README.md`
- Test: `tests/production-env.test.js`

**Interfaces:**
- Produces:
  - `.env.production.example` listing all required production variables (`DATABASE_URL`, `JWT_SECRET`, `CLOUDINARY_*`, `PORT`, `NODE_ENV=production`).
  - `render.yaml`: Blueprint for 1-click free web service deployment on Render.com.
  - Step-by-step deployment guide in `README.md` covering:
    1. Neon.tech (Free cloud PostgreSQL setup).
    2. Cloudinary (Free cloud media bucket setup).
    3. Render.com (Free web hosting setup with continuous GitHub deployment).

- [ ] **Step 1: Write test verifying production env templates and render blueprint**

```javascript
// tests/production-env.test.js
const fs = require('fs');
const path = require('path');

describe('Production Deployment Assets', () => {
  it('provides .env.production.example with required cloud variables', () => {
    const envExample = fs.readFileSync(path.join(__dirname, '../.env.production.example'), 'utf8');
    expect(envExample).toContain('DATABASE_URL=');
    expect(envExample).toContain('CLOUDINARY_CLOUD_NAME=');
    expect(envExample).toContain('JWT_SECRET=');
  });

  it('provides render.yaml deployment configuration', () => {
    const renderYaml = fs.readFileSync(path.join(__dirname, '../render.yaml'), 'utf8');
    expect(renderYaml).toContain('type: web');
    expect(renderYaml).toContain('buildCommand: npm install');
    expect(renderYaml).toContain('startCommand: npm start');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/production-env.test.js`
Expected: FAIL

- [ ] **Step 3: Create `.env.production.example`, `render.yaml`, and update `README.md`**

Write clear walkthrough with screenshots/steps explaining how to get free keys from Neon and Cloudinary, and deploy to Render without spending anything.

- [ ] **Step 4: Run full test suite to verify 100% pass**

Run: `npm test`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add .env.production.example render.yaml README.md tests/production-env.test.js
git commit -m "docs: add free cloud deployment blueprint and zero-cost setup guide"
```
