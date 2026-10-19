# Mini Social Media Platform

A distilled, production-grade mini social media web platform built with a layered Express.js REST API, SQLite via Sequelize ORM, and a responsive, accessible vanilla client with zero external CDN dependencies.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture & Design](#architecture--design)
- [Tech Stack](#tech-stack)
- [Zero-Setup Quickstart](#zero-setup-quickstart)
- [🌐 Zero-Cost Cloud Deployment Guide](#-zero-cost-cloud-deployment-guide)
- [Demo Credentials](#demo-credentials)
- [API Reference](#api-reference)
- [Database Schema & Constraints](#database-schema--constraints)
- [Testing Suite](#testing-suite)
- [Directory Structure](#directory-structure)
- [License](#license)

---

## Overview

Most portfolio social applications are either superficial mockups or fragile clones with business logic tangled inside routing files. This platform is designed from the ground up to reflect modern production web practices:

- **Layered Architecture:** Strict separation across Routes $\rightarrow$ Controllers $\rightarrow$ Services $\rightarrow$ Models.
- **Strict Relational Integrity:** Enforces composite keys, foreign keys, and self-follow rejection directly at the database and application levels.
- **Friction-Free Guest Loop:** Anonymous visitors explore public media feeds with zero barrier to entry; any attempt to like, comment, follow, or post smoothly routes them through auth registration and seamlessly returns them to their previous location.
- **Modern UI & Dark Mode:** Built strictly with semantic HTML5 and vanilla CSS custom properties (Modern Slate aesthetic), providing a fluid Dark/Light mode toggle with `localStorage` persistence and zero external UI libraries.

---

## Key Features

1. **Dual Feed System:**
   - **Explore Feed:** Global chronological stream of public posts from all users.
   - **Following Feed:** Personalized feed streaming posts exclusively from followed creators.
2. **Media Upload Pipeline:**
   - Image upload support via Multer (`image/jpeg`, `image/png`, `image/webp`) with 5MB file size limits and MIME-type validation.
   - Local disk storage served as static assets with instant client-side file picker preview.
3. **Idempotent Likes & Social Engagements:**
   - One like per user per post enforced at both REST API and SQLite unique composite index levels.
   - Real-time like toggle with optimistic UI counters.
4. **Threaded Comments:**
   - Single-level threaded comments and direct post comments with author handles, timestamps, and real-time counter updates.
5. **Follow Network:**
   - Follow/unfollow creators with instant follower/following count synchronization.
   - Database and service-level prevention of self-following (`CANNOT_FOLLOW_SELF`).
6. **User Profiles with Live Stats:**
   - Public creator profile cards displaying bio, avatar, joined timestamp, post count, follower count, following count, and post stream.
   - Editable bio and avatar for authenticated account owners.
7. **Adaptive Light / Dark Theme:**
   - Single-click theme switcher persisting user preference in `localStorage` with automated system `prefers-color-scheme` fallback.
8. **Auth-Gated Interaction Routing:**
   - Unauthenticated guest clicks on Like, Comment, Follow, or Post Creation redirect to `/register?redirect=<target>&reason=interact` with return navigation.

---

## Architecture & Design

### High-Level System Architecture

```mermaid
graph TD
    Client["Client (Browser: Vanilla JS, CSS3, Semantic HTML5)"]
    Router["Express Router (/api/v1)"]
    AuthMW["Auth Middleware (JWT Verify & Guest Pass-Through)"]
    UploadMW["Upload Middleware (Multer Disk Storage & Validation)"]
    Controllers["Controllers (HTTP Request/Response Parsing)"]
    Services["Services (Business Logic & Relational Operations)"]
    ORM["Sequelize ORM (Data Models & Constraints)"]
    DB[(SQLite3 Database)]
    Disk[(Local File Storage: /public/uploads)]

    Client -->|HTTP / JSON| Router
    Router --> AuthMW
    Router --> UploadMW
    AuthMW --> Controllers
    UploadMW -->|Save File| Disk
    Controllers --> Services
    Services --> ORM
    ORM --> DB
```

### Request Flow
1. **Client** makes fetch request via the unified API client (`public/js/api.js`).
2. **Middleware** handles JWT authentication (`src/middleware/auth.js`) and file uploads (`src/middleware/upload.js`).
3. **Controllers** validate inputs and delegate work to domain services (`auth`, `post`, `interaction`, `user`).
4. **Services** execute domain logic, verify constraints, and query models.
5. **Sequelize ORM** executes SQL transactions and enforces foreign key / uniqueness constraints against SQLite.

---

## Tech Stack

| Component | Technology | Rationale |
|---|---|---|
| **Backend Framework** | Node.js / Express.js (v4.21+) | High performance, lightweight, modular REST API |
| **Database** | PostgreSQL (Neon.tech) / SQLite3 via Sequelize | Multi-dialect: Cloud PostgreSQL in production; SQLite for zero-setup local dev & instant testing |
| **Authentication** | JWT (`jsonwebtoken`) + `bcryptjs` (10 rounds) | Stateless bearer token authentication and secure password hashing |
| **Media Storage** | Cloudinary / Multer (5MB limit, MIME whitelist) | Persistent cloud media storage with local disk fallback for offline development |
| **Security & Hardening** | Helmet, `express-rate-limit`, reverse proxy trust | CSP media whitelisting, brute-force & spam mitigation, accurate proxy IP detection |
| **Frontend** | Vanilla ES6+ Modules, Semantic HTML5, CSS Variables | Ultra-fast load times, zero build tool overhead, offline reliability |
| **Testing** | Jest (v29.7+) + Supertest (v7.0+) | In-memory testing covering routes, services, models, and full E2E lifecycle |

---

## Zero-Setup Quickstart

### Prerequisites
- Node.js $\ge$ 18.0.0
- npm $\ge$ 9.0.0

### Step-by-Step Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/codealpha-social-media-platform.git
   cd codealpha-social-media-platform
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Seed the database with sample data:**
   ```bash
   npm run seed
   ```
   *Seeds 4 realistic user profiles, 9 posts with images, threaded comments, likes, and follow relationships.*

4. **Start the server:**
   ```bash
   npm start
   ```

5. **Open in browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

---

## 🌐 Zero-Cost Cloud Deployment Guide

Deploy this platform to the public internet at **$0.00/month** using free tiers of industry-standard cloud providers:
- **Compute / Hosting:** [Render.com](https://render.com) (Free Node.js Web Service)
- **Database:** [Neon.tech](https://neon.tech) (Free Serverless PostgreSQL with SSL)
- **Persistent Media Storage:** [Cloudinary](https://cloudinary.com) (Free 25GB media storage)

```mermaid
flowchart LR
    User["Web & Mobile Users"]
    Render["Render.com<br/>(Node.js Web Service)"]
    Neon["Neon.tech<br/>(PostgreSQL Database)"]
    Cloudinary["Cloudinary CDN<br/>(Media Storage)"]

    User -->|"HTTPS"| Render
    Render -->|"DATABASE_URL (SSL)"| Neon
    Render -->|"Direct Image Stream"| Cloudinary
    Cloudinary -->|"Optimized CDN Delivery"| User
```

### Step 1: Create a Free PostgreSQL Database on Neon.tech

1. Visit [neon.tech](https://neon.tech) and register for a free account (no credit card required).
2. Click **Create Project**, enter a project name (e.g. `social-media-platform`), and choose your preferred cloud region.
3. In your project dashboard, navigate to **Connection Details**.
4. Select the connection string format (Node.js / Connection string) and copy it. Ensure `?sslmode=require` is appended to the string:
   ```text
   postgresql://username:password@ep-sample-pooler.region.aws.neon.tech/neondb?sslmode=require
   ```
   *(Keep this string secure—this is your `DATABASE_URL`)*.

### Step 2: Create a Free Media Storage Account on Cloudinary

1. Visit [cloudinary.com](https://cloudinary.com) and sign up for the free tier (includes 25GB managed cloud storage and 25 monthly transformation credits).
2. From the **Cloudinary Dashboard**, locate your **Product Environment Credentials**:
   - **Cloud Name** (`CLOUDINARY_CLOUD_NAME`)
   - **API Key** (`CLOUDINARY_API_KEY`)
   - **API Secret** (`CLOUDINARY_API_SECRET`)
3. Copy these credentials. When configured, image uploads are directly streamed into your Cloudinary bucket with automatic width constraints (1200px max) and quality optimization, ensuring images survive Render container restarts.

### Step 3: Deploy to Render.com

Deploy your repository using either Render's Infrastructure-as-Code Blueprint (`render.yaml`) or manual web service configuration:

#### Option A: 1-Click Blueprint Deployment (Recommended)
1. Fork or push this repository to your GitHub account.
2. In the [Render.com Dashboard](https://dashboard.render.com), click **New +** $\rightarrow$ **Blueprint**.
3. Select and connect your GitHub repository. Render will automatically parse [render.yaml](render.yaml).
4. Supply the secret environment variables when prompted:
   - `DATABASE_URL`: Your Neon PostgreSQL connection string from Step 1.
   - `CLOUDINARY_CLOUD_NAME`: From Step 2.
   - `CLOUDINARY_API_KEY`: From Step 2.
   - `CLOUDINARY_API_SECRET`: From Step 2.
5. Click **Apply**. Render will generate a cryptographically secure `JWT_SECRET`, build the project, and provision your live HTTPS URL.

#### Option B: Manual Web Service Setup
1. In the Render Dashboard, click **New +** $\rightarrow$ **Web Service**.
2. Connect your GitHub repository.
3. Configure the service settings:
   - **Name:** `codealpha-social-media` (or any custom name)
   - **Environment:** `Node`
   - **Region:** Closest to your Neon.tech database region
   - **Branch:** `main`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`
4. In the **Environment Variables** section, add the following variables:
   | Variable | Value / Description |
   |---|---|
   | `NODE_ENV` | `production` |
   | `PORT` | `10000` (Render default) |
   | `DATABASE_URL` | Your Neon PostgreSQL connection string (`?sslmode=require`) |
   | `JWT_SECRET` | A secure 64+ char random string (e.g. `openssl rand -hex 32`) |
   | `CLOUDINARY_CLOUD_NAME` | Your Cloudinary Cloud Name |
   | `CLOUDINARY_API_KEY` | Your Cloudinary API Key |
   | `CLOUDINARY_API_SECRET` | Your Cloudinary API Secret |
   | `CORS_ORIGIN` | `*` (or your custom domain) |
5. Click **Create Web Service**.

### Clean Production Startup & Data Isolation

- **Clean Schema Synchronization:** In production, running `npm start` executes `sequelize.sync()`. This verifies connection to PostgreSQL and automatically establishes all required relational tables (`users`, `posts`, `comments`, `likes`, `follows`), primary keys, foreign key constraints, and unique indices.
- **Pure Production State:** Startup initializes an entirely clean schema without populating any placeholder users or sample posts. Live visitors will register real accounts and author real content.
- **Seeder Isolation:** The seed script (`npm run seed`) is decoupled and intended strictly for local development and demonstration. It is never invoked automatically during deployment or production server boot.
- **Production Hardening in Action:**
  - **Reverse Proxy Trust:** `trust proxy` is enabled so Render's forwarding proxies do not obscure user IP addresses.
  - **Rate Limiting:** Protects registration/login routes (15 req / 15 min per IP) and post submissions (30 posts / hour per account) from brute-force attacks and spam.
  - **Helmet Content Security Policy:** Content Security Policy headers whitelist `https://res.cloudinary.com` to guarantee secure media rendering across all modern web browsers.

---

## Demo Credentials

All seed accounts share the same default password:

| Username | Email | Role / Bio Focus | Password |
|---|---|---|---|
| `alex_tech` | `alex@example.com` | Full-stack developer & open source enthusiast | `password123` |
| `sarah_design` | `sarah@example.com` | UI/UX designer & design systems enthusiast | `password123` |
| `elena_photo` | `elena@example.com` | Landscape photographer & visual artist | `password123` |
| `marcus_dev` | `marcus@example.com` | Backend engineer & DevOps tinkerer | `password123` |

---

## API Reference

All API routes are prefixed under `/api/v1`.

### Authentication Endpoints (`/api/v1/auth`)

| Method | Endpoint | Auth | Request Body | Description |
|---|---|---|---|---|
| `POST` | `/auth/register` | Public | `{ username, email, password, bio?, avatar_url? }` | Register new user account |
| `POST` | `/auth/login` | Public | `{ email, password }` | Authenticate and obtain JWT token |
| `GET` | `/auth/me` | Bearer Token | _None_ | Retrieve authenticated user profile |

### Posts & Feeds Endpoints (`/api/v1/posts`)

| Method | Endpoint | Auth | Query / Form Data | Description |
|---|---|---|---|---|
| `GET` | `/posts` | Optional | `tab=explore\|following`, `page=1`, `limit=20` | Fetch chronological feed with like status |
| `POST` | `/posts` | Bearer Token | `multipart/form-data`: `content`, `image` (file) | Create a post with optional image upload |
| `GET` | `/posts/:id` | Optional | _None_ | Get single post details and counters |
| `DELETE` | `/posts/:id` | Bearer Token | _None_ | Delete post (author only) |

### Interactions Endpoints (`/api/v1/posts/:id`)

| Method | Endpoint | Auth | Request Body | Description |
|---|---|---|---|---|
| `POST` | `/posts/:id/likes` | Bearer Token | _None_ | Like a post (idempotent) |
| `DELETE` | `/posts/:id/likes` | Bearer Token | _None_ | Unlike a post (idempotent) |
| `GET` | `/posts/:id/comments` | Optional | _None_ | Fetch threaded comments for a post |
| `POST` | `/posts/:id/comments` | Bearer Token | `{ content, parent_comment_id? }` | Post a comment or reply |

### User Network & Profile Endpoints (`/api/v1/users`)

| Method | Endpoint | Auth | Request Body | Description |
|---|---|---|---|---|
| `GET` | `/users/:username` | Optional | _None_ | Fetch user profile, post stream, and counts |
| `PUT` | `/users/profile` | Bearer Token | `{ bio, avatar_url }` | Update user profile bio and avatar |
| `POST` | `/users/:id/follow` | Bearer Token | _None_ | Follow user (rejects self-follow) |
| `DELETE` | `/users/:id/follow` | Bearer Token | _None_ | Unfollow user |

---

## Database Schema & Constraints

```mermaid
erDiagram
    USERS ||--o{ POSTS : creates
    USERS ||--o{ COMMENTS : writes
    USERS ||--o{ LIKES : gives
    USERS ||--o{ FOLLOWS : follows
    USERS ||--o{ FOLLOWS : followed_by
    POSTS ||--o{ COMMENTS : contains
    POSTS ||--o{ LIKES : receives

    USERS {
        int id PK
        string username UK
        string email UK
        string password_hash
        string bio
        string avatar_url
        datetime created_at
        datetime updated_at
    }

    POSTS {
        int id PK
        int user_id FK
        text content
        string image_url
        datetime created_at
        datetime updated_at
    }

    COMMENTS {
        int id PK
        int post_id FK
        int user_id FK
        int parent_comment_id FK
        text content
        datetime created_at
        datetime updated_at
    }

    LIKES {
        int id PK
        int user_id FK
        int post_id FK
        datetime created_at
        datetime updated_at
    }

    FOLLOWS {
        int id PK
        int follower_id FK
        int following_id FK
        datetime created_at
        datetime updated_at
    }
```

### Relational Invariants
- **Likes:** Enforces unique composite key `(user_id, post_id)` preventing duplicate likes.
- **Follows:** Enforces unique composite key `(follower_id, following_id)` and database check `follower_id != following_id`.
- **Foreign Keys:** Cascading deletes cleanly remove associated likes and comments upon post deletion.

---

## Testing Suite

The project includes unit, integration, and full lifecycle end-to-end tests using Jest and Supertest.

### Running Tests

```bash
# Run the complete test suite (all 9 test suites)
npm test

# Run the end-to-end user lifecycle flow test
npm run test:e2e
```

### Test Coverage Breakdown
- `tests/database.test.js`: Database connection and schema verification.
- `tests/database-config.test.js`: PostgreSQL multi-dialect handling, SSL configuration, and SQLite fallbacks.
- `tests/models.test.js`: Sequelize model constraints, validations, and cascading rules.
- `tests/auth.test.js`: User registration, login, JWT validation, and invalid credentials.
- `tests/posts.test.js`: Post creation, image uploads, 5MB limits, Explore/Following feeds.
- `tests/interactions.test.js`: Idempotent likes, comments validation, follow network, and self-follow rejection.
- `tests/seed.test.js`: Database seeding idempotency and relations.
- `tests/cloudinary.test.js`: Cloudinary stream upload, optimization, and post deletion asset cleanup.
- `tests/security.test.js`: Helmet CSP headers, rate-limiting on auth and posts, reverse proxy trust.
- `tests/production-env.test.js`: Production environment template variables and Render Blueprint configuration.
- `tests/frontend-core.test.js`: API client bearer token handling and dark/light theme switching.
- `tests/frontend-components.test.js`: Feed rendering, like toggling, modal comments, and auth redirect flows.
- `tests/e2e-flow.test.js`: Complete multi-user simulation (registration $\rightarrow$ post with media $\rightarrow$ like $\rightarrow$ comment $\rightarrow$ follow $\rightarrow$ feed verification $\rightarrow$ profile verification $\rightarrow$ guest gating).

---

## Directory Structure

```
├── .env.example               # Development environment variable template
├── .env.production.example    # Cloud production environment variable template
├── render.yaml                # Render.com Infrastructure-as-Code Blueprint
├── docs/                      # Architectural specifications & requirements
├── public/                    # Static client assets (Zero-CDN)
│   ├── css/                   # Design system tokens and styles
│   ├── js/                    # Vanilla ES6 modules & API client
│   ├── uploads/               # Local uploads (development fallback)
│   └── index.html             # Single-page application shell
├── scripts/
│   └── seed.js                # Database seeder with realistic demo data
├── src/
│   ├── config/                # Database (PostgreSQL/SQLite) & environment configurations
│   ├── controllers/           # HTTP handlers (auth, post, interaction, user)
│   ├── middleware/            # Auth JWT validation, Multer/Cloudinary upload handling
│   ├── models/                # Sequelize relational models & associations
│   ├── routes/                # Versioned Express routes (/api/v1)
│   ├── services/              # Domain logic & database operations
│   ├── utils/                 # Token utilities & helpers
│   ├── app.js                 # Express application setup (Helmet, Rate Limiter)
│   └── server.js              # Server entry point
├── tests/                     # Integration and end-to-end test suites
│   ├── auth.test.js
│   ├── cloudinary.test.js
│   ├── database-config.test.js
│   ├── database.test.js
│   ├── e2e-flow.test.js
│   ├── frontend-components.test.js
│   ├── frontend-core.test.js
│   ├── interactions.test.js
│   ├── models.test.js
│   ├── posts.test.js
│   ├── production-env.test.js
│   ├── security.test.js
│   ├── seed.test.js
│   └── setup.js
├── package.json
└── README.md
```

---

## License

ISC
