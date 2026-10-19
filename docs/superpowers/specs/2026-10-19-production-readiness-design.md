# Production Readiness Specification: Mini Social Media Platform

**Date:** 2026-10-19  
**Status:** In Review  
**Target Architecture:** Zero-Cost Real-World Deployment (PostgreSQL + Cloudinary + Free Node Host)  

---

## 1. Intent & Purpose
Transition the application from a demo/offline portfolio project into a real-world, production-ready web application running at zero cost:
- Remove reliance on local demo mocks; startup runs against a clean production database with real user registrations.
- Connect a durable free managed PostgreSQL database (e.g., Neon.tech / Supabase / Render Postgres).
- Integrate Cloudinary's free tier for persistent media storage, solving the ephemeral disk problem of free cloud hosts.
- Add real-world security defenses: rate limiting (`express-rate-limit`), security headers (`helmet`), and CORS origin restriction.

---

## 2. Real-World Free Cloud Architecture

```mermaid
flowchart TD
    User["Real Web Users / Mobile Browsers"]
    Host["Free Node.js Host (Render / Railway / Fly.io)"]
    DB["Free Cloud PostgreSQL (Neon / Supabase)"]
    CDN["Cloudinary Free Media Storage"]

    User -->|"HTTPS (SPA & REST API)"| Host
    Host -->|"DATABASE_URL (SSL)"| DB
    Host -->|"Multer Memory -> Upload Stream"| CDN
    CDN -->|"Secure CDN Image URLs (res.cloudinary.com)"| User
```

---

## 3. Key Components & Implementation Changes

### 3.1 Database: PostgreSQL + Sequelize Multi-Dialect
- Install `pg` and `pg-hstore`.
- Update `src/config/database.js`:
  - When `DATABASE_URL` is set, instantiate Sequelize with `dialect: 'postgres'` and SSL config (`ssl: { require: true, rejectUnauthorized: false }`).
  - When running tests (`NODE_ENV === 'test'`), keep SQLite in-memory for instant, zero-cost test suite runs.
  - When developing locally without internet, fall back to `./database.sqlite`.

### 3.2 Media Uploads: Cloudinary Integration
- Install `cloudinary`.
- Update `src/middleware/upload.js`:
  - Switch Multer to `multer.memoryStorage()` when Cloudinary credentials (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`) are present.
  - Pipe buffer via `cloudinary.uploader.upload_stream` with automatic image optimization and resizing (max width 1200px).
  - Store permanent Cloudinary HTTPS URL in `post.image_url`.
  - When a post with a Cloudinary image is deleted, delete the asset from Cloudinary via `cloudinary.uploader.destroy()` (deriving `public_id` from the URL or storing it).
  - Fall back to local disk storage if Cloudinary credentials are not provided (so local dev/tests run offline with zero setup).

### 3.3 Security & Anti-Abuse (Real Internet Hardening)
- Install `helmet` and `express-rate-limit`.
- Reverse proxy trust: Enable `app.set('trust proxy', 1)` so IP detection works accurately behind Render/Railway/Fly.io proxies.
- Rate limiting:
  - Bypassed completely when `NODE_ENV === 'test'` so automated test suites run without false `429 Too Many Requests`.
  - Auth routes (`/api/v1/auth/login`, `/api/v1/auth/register`): max 15 requests per 15 minutes per IP.
  - Post creation (`/api/v1/posts`): keyed by authenticated `req.user.id` (with IP fallback), max 30 posts per hour.
- Helmet CSP configuration:
  - Configure `helmet.contentSecurityPolicy` to explicitly allow `img-src: ["'self'", "data:", "https://res.cloudinary.com", "https://images.unsplash.com"]` and `script-src: ["'self'"]` so external Cloudinary images and seed images load properly without being blocked by the browser.
- CORS policy:
  - Uses `CORS_ORIGIN` env var if defined, defaulting to allowing requests from same-origin / all origins for the statically hosted SPA.

### 3.4 Clean Production Environment (Zero Demo Mocks)
- Normal `npm start` creates clean database tables (`sequelize.sync()`) without any demo users or demo posts.
- `scripts/seed.js` remains strictly as a manual test script (`npm run seed`) and is never run automatically in production.
- Production environment template `.env.production.example` created with:
  ```env
  PORT=3000
  NODE_ENV=production
  DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
  JWT_SECRET=generate_a_secure_long_random_string_here
  CLOUDINARY_CLOUD_NAME=your_cloud_name
  CLOUDINARY_API_KEY=your_api_key
  CLOUDINARY_API_SECRET=your_api_secret
  CORS_ORIGIN=*
  ```

### 3.5 Free Hosting & Deployment Guide
- Step-by-step instructions in documentation for:
  1. Creating a free Neon.tech PostgreSQL database (takes 1 minute, no credit card).
  2. Creating a free Cloudinary account (takes 1 minute, free forever, 25GB bandwidth).
  3. Deploying to Render.com as a free Web Service connected to GitHub repository.

