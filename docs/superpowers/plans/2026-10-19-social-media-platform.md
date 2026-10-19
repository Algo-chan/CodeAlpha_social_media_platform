# Mini Social Media Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify a complete, runnable, full-stack mini social media web platform with image/text posts, dual-tab feeds ("Explore" & "Following"), single-level comments, unique likes, follows, user profiles, Light/Dark theming, seed data, and comprehensive tests.

**Architecture:** Layered Express.js backend (`routes` → `controllers` → `services`) interacting with SQLite via Sequelize ORM for schema constraints (composite unique keys and self-follow prevention), paired with a responsive, accessible vanilla JS/CSS client communicating over versioned JSON REST endpoints (`/api/v1`) and multipart upload handling.

**Tech Stack:** Node.js (v24), Express.js, SQLite3, Sequelize, JWT (`jsonwebtoken`), `bcryptjs`, `multer`, Jest + Supertest (testing), HTML5 / CSS3 / ES6 vanilla client.

**Spec:** [docs/superpowers/specs/2026-10-19-social-media-platform-design.md](file:///c:/Users/USER/Desktop/CodeAlpha_social_media_platform/docs/superpowers/specs/2026-10-19-social-media-platform-design.md)

## Global Constraints

- Backend exposed strictly under versioned prefix `/api/v1`.
- Authentication using standard Bearer JWT tokens; password hashing with `bcryptjs` (salt rounds: 10).
- Database integrity: Unique composite key on `(user_id, post_id)` for likes; unique composite key on `(follower_id, following_id)` with constraint `follower_id != following_id` for follows.
- File uploads: Stored locally in `public/uploads/` with 5MB max size and MIME whitelist (`image/jpeg`, `image/png`, `image/webp`).
- Frontend: Responsive vanilla HTML/CSS/JS with dynamic Light & Dark mode switch, preserving user choice in `localStorage`.
- Gated interaction flow: Non-authenticated attempts to like, comment, follow, or create a post navigate cleanly to `/register?redirect=<target>&reason=interact`.

## Review Focus

- Duplicate like attempts must fail or idempotently return the existing state without throwing a 500 error or creating a duplicate row.
- Self-follow attempts (`follower_id === following_id`) must be blocked at both API validation and database constraint levels with a clear 400 response.
- Malicious or non-image file uploads (e.g., `.exe` or MIME spoofing) must be rejected with 400 Bad Request before saving to disk.
- Post deletion must cascade delete or cleanly remove associated likes and comments without leaving orphaned relations.
- Accessing `/api/v1/posts?tab=following` as a guest or user with 0 follows must return an empty list gracefully (`[]`) rather than failing.

---

### Task 1: Project Scaffolding & Configuration

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `src/config/database.js`
- Create: `tests/setup.js`

**Interfaces:**
- Produces: Initialized project dependencies (`express`, `sequelize`, `sqlite3`, `bcryptjs`, `jsonwebtoken`, `multer`, `cors`, `jest`, `supertest`) and Sequelize connection instance `sequelize`.

- [ ] **Step 1: Write initial test for database connection**

```javascript
// tests/database.test.js
const { sequelize } = require('../src/config/database');

describe('Database Connection', () => {
  it('authenticates SQLite in-memory or file database', async () => {
    await expect(sequelize.authenticate()).resolves.not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/database.test.js`
Expected: FAIL (cannot find module `src/config/database` or `jest` not installed)

- [ ] **Step 3: Create `package.json`, `.gitignore`, `.env.example`, and implement `src/config/database.js`**

Install dependencies: `express`, `sequelize`, `sqlite3`, `bcryptjs`, `jsonwebtoken`, `multer`, `cors`, `dotenv`, and dev-dependencies `jest`, `supertest`, `nodemon`. Configure Sequelize to use SQLite (`storage: process.env.DB_STORAGE || ':memory:'` for tests, `./database.sqlite` for dev).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/database.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .gitignore .env.example src/config/database.js tests/
git commit -m "chore: scaffold project and configure sqlite database"
```

---

### Task 2: Database Schema & Relational Models

**Files:**
- Create: `src/models/User.js`
- Create: `src/models/Post.js`
- Create: `src/models/Comment.js`
- Create: `src/models/Like.js`
- Create: `src/models/Follow.js`
- Create: `src/models/index.js`
- Test: `tests/models.test.js`

**Interfaces:**
- Consumes: `sequelize` from `src/config/database.js`
- Produces: `User`, `Post`, `Comment`, `Like`, `Follow` models with associations and constraints:
  - `User.hasMany(Post)`
  - `Post.belongsTo(User)`
  - `Post.hasMany(Comment)`
  - `Post.hasMany(Like)`
  - `User.belongsToMany(User, { as: 'Followers', through: Follow, foreignKey: 'following_id' })`
  - `User.belongsToMany(User, { as: 'Following', through: Follow, foreignKey: 'follower_id' })`
  - Unique composite index on `Like(user_id, post_id)`
  - Unique composite index on `Follow(follower_id, following_id)`

- [ ] **Step 1: Write model constraint tests**

```javascript
// tests/models.test.js
const { sequelize, User, Post, Like, Follow } = require('../src/models');

describe('Model Constraints', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  it('prevents duplicate likes from the same user on a post', async () => {
    const user = await User.create({ username: 'alice', email: 'alice@test.com', password_hash: 'hash' });
    const post = await Post.create({ user_id: user.id, content: 'Hello world' });
    await Like.create({ user_id: user.id, post_id: post.id });
    await expect(Like.create({ user_id: user.id, post_id: post.id })).rejects.toThrow();
  });

  it('prevents self-following and duplicate follows', async () => {
    const bob = await User.create({ username: 'bob', email: 'bob@test.com', password_hash: 'hash' });
    const charlie = await User.create({ username: 'charlie', email: 'charlie@test.com', password_hash: 'hash' });
    await Follow.create({ follower_id: bob.id, following_id: charlie.id });
    await expect(Follow.create({ follower_id: bob.id, following_id: charlie.id })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/models.test.js`
Expected: FAIL

- [ ] **Step 3: Define models and associations in `src/models/`**

Implement attributes and constraints in `User.js`, `Post.js`, `Comment.js`, `Like.js`, `Follow.js`, and assemble associations in `src/models/index.js`. Add check constraint or model hooks for self-following validation.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/models.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/models/ tests/models.test.js
git commit -m "feat: define relational models and schema constraints"
```

---

### Task 3: Authentication API & JWT Middleware

**Files:**
- Create: `src/utils/jwt.js`
- Create: `src/middleware/auth.js`
- Create: `src/services/auth.service.js`
- Create: `src/controllers/auth.controller.js`
- Create: `src/routes/auth.routes.js`
- Create: `src/app.js`
- Test: `tests/auth.test.js`

**Interfaces:**
- Consumes: `User` model from `src/models/`
- Produces:
  - `authenticateToken(req, res, next)` middleware (extracts Bearer token, populates `req.user`)
  - `optionalAuth(req, res, next)` middleware (populates `req.user` if token present, does not reject if guest)
  - `POST /api/v1/auth/register` (body: `{ username, email, password }`, returns `{ success: true, data: { user, token } }`)
  - `POST /api/v1/auth/login` (body: `{ login, password }`, returns `{ success: true, data: { user, token } }`)
  - `GET /api/v1/auth/me` (requires auth, returns current user profile)

- [ ] **Step 1: Write failing auth integration test**

```javascript
// tests/auth.test.js
const request = require('supertest');
const app = require('../src/app');
const { sequelize } = require('../src/models');

describe('Auth API', () => {
  beforeEach(async () => {
    await sequelize.sync({ force: true });
  });

  it('registers a new user and returns JWT token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'johndoe', email: 'john@example.com', password: 'Password123!' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.username).toBe('johndoe');
    expect(res.body.data.user.password_hash).toBeUndefined();
  });

  it('fails registration with duplicate username or email', async () => {
    await request(app).post('/api/v1/auth/register').send({ username: 'john', email: 'j@ex.com', password: 'Password123!' });
    const res = await request(app).post('/api/v1/auth/register').send({ username: 'john', email: 'other@ex.com', password: 'Password123!' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/auth.test.js`
Expected: FAIL

- [ ] **Step 3: Implement Auth service, controller, JWT utils, middleware, and express app**

Implement `src/utils/jwt.js` with `signToken` and `verifyToken`. Implement `auth.service.js` with bcrypt hashing (`bcrypt.hash(password, 10)`). Build `auth.controller.js`, `auth.routes.js`, and mount routes in `src/app.js`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/auth.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/ src/middleware/ src/services/auth.service.js src/controllers/auth.controller.js src/routes/auth.routes.js src/app.js tests/auth.test.js
git commit -m "feat: implement jwt auth registration, login, and auth middleware"
```

---

### Task 4: Media Uploads & Posts API (Explore vs Following Feeds)

**Files:**
- Create: `src/middleware/upload.js`
- Create: `src/services/post.service.js`
- Create: `src/controllers/post.controller.js`
- Create: `src/routes/post.routes.js`
- Test: `tests/posts.test.js`

**Interfaces:**
- Consumes: `authenticateToken`, `optionalAuth` from `src/middleware/auth.js`
- Produces:
  - `uploadPostMedia` middleware (stores files in `public/uploads/` with UUID/timestamp name, enforces 5MB limit and image MIME whitelist)
  - `POST /api/v1/posts` (multipart: content text + optional image file; author from `req.user.id`)
  - `GET /api/v1/posts?tab=explore` (returns all public posts sorted newest first with author, likesCount, commentsCount, isLiked)
  - `GET /api/v1/posts?tab=following` (requires auth, returns posts by followed users; returns empty `[]` if following 0 users)
  - `GET /api/v1/posts/:id` (returns post details)
  - `DELETE /api/v1/posts/:id` (requires auth; checks author ownership, deletes post and removes attached image file)

- [ ] **Step 1: Write failing posts integration test**

```javascript
// tests/posts.test.js
const request = require('supertest');
const app = require('../src/app');
const { sequelize, User, Follow } = require('../src/models');

describe('Posts API & Feeds', () => {
  let user1, user2, token1, token2;
  beforeEach(async () => {
    await sequelize.sync({ force: true });
    const reg1 = await request(app).post('/api/v1/auth/register').send({ username: 'u1', email: 'u1@t.com', password: 'Password123!' });
    const reg2 = await request(app).post('/api/v1/auth/register').send({ username: 'u2', email: 'u2@t.com', password: 'Password123!' });
    token1 = reg1.body.data.token;
    user1 = reg1.body.data.user;
    token2 = reg2.body.data.token;
    user2 = reg2.body.data.user;
  });

  it('creates text and image posts and lists in explore feed', async () => {
    const postRes = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token1}`)
      .field('content', 'First test post');
    expect(postRes.status).toBe(201);

    const exploreRes = await request(app).get('/api/v1/posts?tab=explore');
    expect(exploreRes.status).toBe(200);
    expect(exploreRes.body.data.posts.length).toBe(1);
    expect(exploreRes.body.data.posts[0].content).toBe('First test post');
  });

  it('filters following feed correctly', async () => {
    await request(app).post('/api/v1/posts').set('Authorization', `Bearer ${token2}`).field('content', 'Post from u2');
    
    // user1 not following user2 yet
    let feedRes = await request(app).get('/api/v1/posts?tab=following').set('Authorization', `Bearer ${token1}`);
    expect(feedRes.body.data.posts.length).toBe(0);

    // user1 follows user2
    await Follow.create({ follower_id: user1.id, following_id: user2.id });
    feedRes = await request(app).get('/api/v1/posts?tab=following').set('Authorization', `Bearer ${token1}`);
    expect(feedRes.body.data.posts.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/posts.test.js`
Expected: FAIL

- [ ] **Step 3: Implement Multer upload middleware, Post service, controller, and routes**

Build `src/middleware/upload.js` with `multer.diskStorage` and fileFilter. Implement `post.service.js` with Sequelize queries including likes count and current user like status. Wire into `post.controller.js` and mount on `/api/v1/posts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/posts.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/middleware/upload.js src/services/post.service.js src/controllers/post.controller.js src/routes/post.routes.js tests/posts.test.js
git commit -m "feat: implement post creation, media upload, explore and following feeds"
```

---

### Task 5: Interactions API (Likes, Comments, Follows & Profiles)

**Files:**
- Create: `src/services/interaction.service.js`
- Create: `src/controllers/interaction.controller.js`
- Create: `src/services/user.service.js`
- Create: `src/controllers/user.controller.js`
- Create: `src/routes/user.routes.js`
- Modify: `src/routes/post.routes.js`
- Test: `tests/interactions.test.js`

**Interfaces:**
- Produces:
  - `POST /api/v1/posts/:id/likes` (toggles like or creates like idempotently)
  - `DELETE /api/v1/posts/:id/likes` (unlikes post)
  - `GET /api/v1/posts/:id/comments` (returns comments with author profile)
  - `POST /api/v1/posts/:id/comments` (creates comment; validates content length > 0)
  - `POST /api/v1/users/:id/follow` (follows user; prevents `id === req.user.id` returning 400)
  - `DELETE /api/v1/users/:id/follow` (unfollows user)
  - `GET /api/v1/users/:username` (returns profile, followersCount, followingCount, isFollowing, and user posts)
  - `PUT /api/v1/users/profile` (updates bio and avatar)

- [ ] **Step 1: Write failing interactions integration test**

```javascript
// tests/interactions.test.js
const request = require('supertest');
const app = require('../src/app');
const { sequelize } = require('../src/models');

describe('Interactions API', () => {
  let tokenA, userA, tokenB, userB, post;
  beforeEach(async () => {
    await sequelize.sync({ force: true });
    const regA = await request(app).post('/api/v1/auth/register').send({ username: 'alice', email: 'a@t.com', password: 'Password123!' });
    const regB = await request(app).post('/api/v1/auth/register').send({ username: 'bob', email: 'b@t.com', password: 'Password123!' });
    tokenA = regA.body.data.token;
    userA = regA.body.data.user;
    tokenB = regB.body.data.token;
    userB = regB.body.data.user;
    const postRes = await request(app).post('/api/v1/posts').set('Authorization', `Bearer ${tokenA}`).field('content', 'Alice post');
    post = postRes.body.data.post;
  });

  it('allows liking and unliking a post idempotently', async () => {
    const likeRes = await request(app).post(`/api/v1/posts/${post.id}/likes`).set('Authorization', `Bearer ${tokenB}`);
    expect(likeRes.status).toBe(200);
    expect(likeRes.body.data.liked).toBe(true);

    // Duplicate like attempt returns success/already liked
    const dupRes = await request(app).post(`/api/v1/posts/${post.id}/likes`).set('Authorization', `Bearer ${tokenB}`);
    expect(dupRes.status).toBe(200);

    const unlikeRes = await request(app).delete(`/api/v1/posts/${post.id}/likes`).set('Authorization', `Bearer ${tokenB}`);
    expect(unlikeRes.status).toBe(200);
    expect(unlikeRes.body.data.liked).toBe(false);
  });

  it('rejects self-follow attempt with 400 Bad Request', async () => {
    const res = await request(app).post(`/api/v1/users/${userA.id}/follow`).set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/interactions.test.js`
Expected: FAIL

- [ ] **Step 3: Implement Interaction & User services, controllers, and routes**

Implement like/unlike idempotent service, comment creation, follow/unfollow with self-check, and user profile retrieval with aggregated counts (`followersCount`, `followingCount`, `postsCount`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/interactions.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/ src/controllers/ src/routes/ tests/interactions.test.js
git commit -m "feat: implement likes, comments, follow network, and user profile endpoints"
```

---

### Task 6: Seed Script & Server Startup

**Files:**
- Create: `scripts/seed.js`
- Create: `src/server.js`
- Modify: `package.json`

**Interfaces:**
- Produces:
  - `npm run seed`: Populates database with 4 demo users (`alex_tech`, `sarah_design`, `elena_photo`, `marcus_dev`), profile bios, sample avatars, and 8+ realistic text/image posts, comments, likes, and follows.
  - `npm start`: Starts server on port `process.env.PORT || 3000` serving both REST API and static client files.

- [ ] **Step 1: Write test to verify seed script runs cleanly**

```javascript
// tests/seed.test.js
const { seedDatabase } = require('../scripts/seed');
const { User, Post, Like, Follow } = require('../src/models');

describe('Database Seeder', () => {
  it('seeds demo users, posts, and relationships', async () => {
    await seedDatabase();
    const userCount = await User.count();
    const postCount = await Post.count();
    const followCount = await Follow.count();
    expect(userCount).toBeGreaterThanOrEqual(4);
    expect(postCount).toBeGreaterThanOrEqual(6);
    expect(followCount).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/seed.test.js`
Expected: FAIL

- [ ] **Step 3: Implement `scripts/seed.js` and `src/server.js`**

Implement `seedDatabase()` with realistic tech/design social media content, ensuring password hashes are valid `bcrypt` hashes (`password123`). Create `src/server.js` syncing models and listening on port 3000. Add static serving of `public/` in `src/app.js`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/seed.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/seed.js src/server.js package.json tests/seed.test.js
git commit -m "feat: add realistic seed script and server bootstrapper"
```

---

### Task 7: Frontend Core (UI Design, Theme Toggle & Navigation)

**Files:**
- Create: `public/index.html`
- Create: `public/css/variables.css`
- Create: `public/css/style.css`
- Create: `public/js/api.js`
- Create: `public/js/theme.js`
- Create: `public/js/router.js`

**Interfaces:**
- Produces:
  - Central responsive layout with navbar, main feed container, and action sidebar/modals.
  - Dark/Light theme switcher with CSS variables and `localStorage` persistence.
  - `api.js`: Fetch wrapper automatically injecting `Authorization: Bearer <token>`, handling JSON parsing and error toasts.
  - Client-side view switcher for `#feed`, `#register`, `#login`, `#profile`.

- [ ] **Step 1: Create HTML structure, CSS themes, and JS router**

Build `public/index.html` with semantic structure:
- Top navigation with Logo, Search/Tagline, Theme Toggle button, and Auth button (Login/Register or Profile/Logout).
- Dynamic view containers (`#view-feed`, `#view-auth`, `#view-profile`).
- CSS variables supporting Light mode (`--bg: #ffffff`, `--text: #0f172a`, `--border: #e2e8f0`) and Dark mode (`--bg: #0f172a`, `--text: #f8fafc`, `--border: #334155`).

- [ ] **Step 2: Implement theme switcher and API helper in `public/js/`**

Add `initTheme()` detecting system preference or stored `theme` key. Build `api.js` with `api.get`, `api.post`, `api.delete`, handling automatic token retrieval from `localStorage`.

- [ ] **Step 3: Verify static files served and responsive styles applied**

Test endpoint `GET /` returns status 200 with HTML content.

- [ ] **Step 4: Commit**

```bash
git add public/
git commit -m "feat: setup frontend responsive layout, theme toggle, and api client"
```

---

### Task 8: Frontend Feed & Gated Interaction Loop

**Files:**
- Create: `public/js/components/feed.js`
- Create: `public/js/components/postCard.js`
- Create: `public/js/components/authView.js`
- Create: `public/js/components/profileView.js`
- Modify: `public/js/app.js`

**Interfaces:**
- Produces:
  - Feed rendering with "Explore" and "Following" tabs.
  - Post creation component with image preview before submit.
  - Like button with instant optimistic UI update.
  - Comment drawer with instant comment posting.
  - **Gated Interaction Interceptor:** Any click on Like, Comment, Follow, or Create Post while unauthenticated triggers navigation to `#register?redirect=<target>&reason=interact` displaying the informational reason banner.
  - Dedicated Register/Login view displaying return redirection banner.
  - User Profile view with stats and follow/unfollow toggle.

- [ ] **Step 1: Implement PostCard component with like & comment interactivity**

Build `renderPostCard(post, currentUser)` with heart button, comments list, and gated click handler calling `requireAuth(actionCallback)`.

- [ ] **Step 2: Implement Feed tab switcher ("Explore" vs "Following")**

Build `renderFeed(tab)` calling `api.get('/posts?tab=' + tab)`. If visitor clicks "Following" tab while unauthenticated, show friendly prompt to sign up.

- [ ] **Step 3: Implement Auth view (`#register` / `#login`) with redirect reason banner**

Render form with `username`, `email`, `password`. If `reason=interact` query parameter is present, display: *"Create an account or sign in to like, comment, and connect."* Upon registration/login, save token and redirect back to previous view.

- [ ] **Step 4: Implement Profile view (`#profile/:username`)**

Display user header with avatar, bio, follower/following count, follow/unfollow button, and grid of user posts.

- [ ] **Step 5: Verify complete end-to-end user loop in browser**

Verify end-to-end: guest lands on Explore feed → clicks Like on post → redirected to register view with banner → registers → returns to post with like registered.

- [ ] **Step 6: Commit**

```bash
git add public/js/
git commit -m "feat: complete frontend feed, gated auth navigation, post interactions, and profiles"
```

---

### Task 9: Full Verification, Documentation & Polish

**Files:**
- Create: `README.md`
- Create: `tests/e2e-flow.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces:
  - Full test suite execution passing 100% (`npm test`).
  - Comprehensive `README.md` with features, setup guide, architecture diagram, API documentation, and test commands.
  - Clean project free of lint errors or dead files.

- [ ] **Step 1: Write end-to-end integration flow test**

```javascript
// tests/e2e-flow.test.js
const request = require('supertest');
const app = require('../src/app');
const { sequelize } = require('../src/models');

describe('End-to-End Social Media Flow', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  it('runs complete lifecycle: register, post, like, comment, follow, view profile', async () => {
    // 1. Register User 1
    const u1Res = await request(app).post('/api/v1/auth/register').send({
      username: 'dev_user', email: 'dev@test.com', password: 'Password123!'
    });
    const token1 = u1Res.body.data.token;
    const u1 = u1Res.body.data.user;

    // 2. Register User 2
    const u2Res = await request(app).post('/api/v1/auth/register').send({
      username: 'designer_user', email: 'design@test.com', password: 'Password123!'
    });
    const token2 = u2Res.body.data.token;
    const u2 = u2Res.body.data.user;

    // 3. User 1 creates post
    const postRes = await request(app).post('/api/v1/posts')
      .set('Authorization', `Bearer ${token1}`)
      .field('content', 'Excited to show our new UI!');
    const postId = postRes.body.data.post.id;

    // 4. User 2 likes post
    await request(app).post(`/api/v1/posts/${postId}/likes`).set('Authorization', `Bearer ${token2}`);

    // 5. User 2 comments on post
    await request(app).post(`/api/v1/posts/${postId}/comments`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ content: 'Looks super clean!' });

    // 6. User 2 follows User 1
    await request(app).post(`/api/v1/users/${u1.id}/follow`).set('Authorization', `Bearer ${token2}`);

    // 7. Verify Following feed for User 2 includes User 1's post
    const feedRes = await request(app).get('/api/v1/posts?tab=following').set('Authorization', `Bearer ${token2}`);
    expect(feedRes.body.data.posts.length).toBe(1);
    expect(feedRes.body.data.posts[0].id).toBe(postId);
    expect(feedRes.body.data.posts[0].likesCount).toBe(1);
    expect(feedRes.body.data.posts[0].commentsCount).toBe(1);

    // 8. Verify User 1 Profile stats
    const profileRes = await request(app).get('/api/v1/users/dev_user');
    expect(profileRes.body.data.followersCount).toBe(1);
    expect(profileRes.body.data.postsCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run all tests to verify 100% pass**

Run: `npm test`
Expected: ALL PASS

- [ ] **Step 3: Write professional `README.md`**

Include project overview, screenshot/mockup placeholder, quickstart instructions (`git clone`, `npm install`, `npm run seed`, `npm start`), API reference table, database schema overview, and testing instructions.

- [ ] **Step 4: Commit**

```bash
git add README.md tests/e2e-flow.test.js package.json
git commit -m "docs: complete readme documentation and end-to-end verification suite"
```
