const request = require('supertest');
const app = require('../src/app');

// Component modules
const postCard = require('../public/js/components/postCard');
const feed = require('../public/js/components/feed');
const authView = require('../public/js/components/authView');
const profileView = require('../public/js/components/profileView');
const appClient = require('../public/js/app');

/**
 * Minimal Mock DOM Environment for testing frontend components in Node.js
 */
class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.id = '';
    this._className = '';
    this.attributes = {};
    this.children = [];
    this.parentNode = null;
    this.style = {};
    this.listeners = {};
    this._innerHTML = '';
    this._textContent = '';
    this.disabled = false;
    this.value = '';
    this.files = [];

    const self = this;
    this.classList = {
      _classes: new Set(),
      add(...classes) {
        classes.forEach((c) => self.classList._classes.add(c));
        self._className = Array.from(self.classList._classes).join(' ');
      },
      remove(...classes) {
        classes.forEach((c) => self.classList._classes.delete(c));
        self._className = Array.from(self.classList._classes).join(' ');
      },
      contains(c) {
        return self.classList._classes.has(c);
      },
      toggle(c, force) {
        if (force !== undefined) {
          if (force) self.classList.add(c);
          else self.classList.remove(c);
          return force;
        }
        if (self.classList.contains(c)) {
          self.classList.remove(c);
          return false;
        } else {
          self.classList.add(c);
          return true;
        }
      },
    };
  }

  get className() {
    return this._className;
  }

  set className(val) {
    this._className = val || '';
    this.classList._classes = new Set(this._className.split(/\s+/).filter(Boolean));
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(html) {
    this._innerHTML = html;
    this._textContent = html.replace(/<[^>]*>?/gm, '');
  }

  get textContent() {
    return this._textContent;
  }

  set textContent(txt) {
    this._textContent = txt;
    this._innerHTML = txt;
  }

  setAttribute(k, v) {
    this.attributes[k] = String(v);
    if (k === 'id') this.id = String(v);
    if (k === 'class') this.className = String(v);
  }

  getAttribute(k) {
    return this.attributes[k] !== undefined ? this.attributes[k] : null;
  }

  removeAttribute(k) {
    delete this.attributes[k];
  }

  appendChild(child) {
    if (child) {
      child.parentNode = this;
      this.children.push(child);
    }
    return child;
  }

  insertBefore(newChild, refChild) {
    const idx = this.children.indexOf(refChild);
    if (idx !== -1) {
      newChild.parentNode = this;
      this.children.splice(idx, 0, newChild);
    } else {
      this.appendChild(newChild);
    }
    return newChild;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      child.parentNode = null;
      this.children.splice(idx, 1);
    }
    return child;
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  addEventListener(event, handler) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }

  dispatchEvent(event) {
    const type = typeof event === 'string' ? event : event.type;
    const handlers = this.listeners[type] || [];
    handlers.forEach((h) => h(event));
    return true;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const results = [];
    const traverse = (node) => {
      for (const child of node.children) {
        if (matches(child, selector)) {
          results.push(child);
        }
        traverse(child);
      }
    };
    traverse(this);
    return results;
  }
}

function matches(el, selector) {
  if (!el || !selector) return false;
  if (selector.startsWith('#')) {
    return el.id === selector.substring(1) || el.attributes['id'] === selector.substring(1);
  }
  if (selector.startsWith('.')) {
    return el.classList && el.classList.contains(selector.substring(1));
  }
  if (selector.includes('.')) {
    const [tag, cls] = selector.split('.');
    return el.tagName.toLowerCase() === tag.toLowerCase() && el.classList.contains(cls);
  }
  return el.tagName.toLowerCase() === selector.toLowerCase();
}

function setupMockDOM() {
  const elementsById = new Map();

  const mockDoc = {
    createElement: (tag) => new MockElement(tag),
    getElementById: (id) => elementsById.get(id) || null,
    querySelectorAll: (sel) => {
      const results = [];
      for (const el of elementsById.values()) {
        if (matches(el, sel)) results.push(el);
      }
      return results;
    },
    querySelector: (sel) => {
      for (const el of elementsById.values()) {
        if (matches(el, sel)) return el;
      }
      return null;
    },
    registerElement: (id, el) => {
      el.id = id;
      el.setAttribute('id', id);
      elementsById.set(id, el);
      return el;
    },
  };

  const store = new Map();
  const mockLocalStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };

  const mockWindow = {
    location: {
      hash: '#explore',
    },
    addEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  };

  return { mockDoc, mockLocalStorage, mockWindow, elementsById };
}

describe('Frontend Components & Gated Interaction Loop (Task 8)', () => {
  describe('Static Asset Delivery', () => {
    test('GET /js/components/postCard.js should return 200 OK with javascript content-type', async () => {
      const res = await request(app).get('/js/components/postCard.js');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/(application|text)\/javascript/);
      expect(res.text).toContain('renderPostCard');
      expect(res.text).toContain('getPostCardHtml');
    });

    test('GET /js/components/feed.js should return 200 OK with javascript content-type', async () => {
      const res = await request(app).get('/js/components/feed.js');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/(application|text)\/javascript/);
      expect(res.text).toContain('renderFeed');
      expect(res.text).toContain('requireAuth');
    });

    test('GET /js/components/authView.js should return 200 OK with javascript content-type', async () => {
      const res = await request(app).get('/js/components/authView.js');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/(application|text)\/javascript/);
      expect(res.text).toContain('renderAuthView');
      expect(res.text).toContain('auth-banner');
    });

    test('GET /js/components/profileView.js should return 200 OK with javascript content-type', async () => {
      const res = await request(app).get('/js/components/profileView.js');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/(application|text)\/javascript/);
      expect(res.text).toContain('renderProfile');
      expect(res.text).toContain('btn-follow-toggle');
    });
  });

  describe('Component Exports & Interface Integrity', () => {
    test('postCard exports core rendering and formatting methods', () => {
      expect(typeof postCard.renderPostCard).toBe('function');
      expect(typeof postCard.getPostCardHtml).toBe('function');
      expect(typeof postCard.formatTimestamp).toBe('function');
      expect(typeof postCard.escapeHtml).toBe('function');
    });

    test('feed exports feed switcher, composer initializer, and requireAuth', () => {
      expect(typeof feed.renderFeed).toBe('function');
      expect(typeof feed.initPostComposer).toBe('function');
      expect(typeof feed.requireAuth).toBe('function');
      expect(typeof feed.getCurrentUser).toBe('function');
    });

    test('authView exports rendering and query param helpers', () => {
      expect(typeof authView.renderAuthView).toBe('function');
      expect(typeof authView.initAuthForms).toBe('function');
      expect(typeof authView.parseQueryParams).toBe('function');
      expect(typeof authView.getRedirectTarget).toBe('function');
    });

    test('profileView exports profile renderer and editor helpers', () => {
      expect(typeof profileView.renderProfile).toBe('function');
      expect(typeof profileView.toggleProfileEditor).toBe('function');
      expect(typeof profileView.formatJoinedDate).toBe('function');
    });

    test('app orchestrator exports user session and navigation helpers', () => {
      expect(typeof appClient.getCurrentUser).toBe('function');
      expect(typeof appClient.updateAuthUI).toBe('function');
      expect(typeof appClient.handleLogout).toBe('function');
      expect(typeof appClient.requireAuth).toBe('function');
    });
  });

  describe('Gated Interaction Interceptor (requireAuth)', () => {
    let mockDOM;

    beforeEach(() => {
      mockDOM = setupMockDOM();
      global.localStorage = mockDOM.mockLocalStorage;
      global.window = mockDOM.mockWindow;
      global.router = { navigate: jest.fn() };
    });

    afterEach(() => {
      delete global.localStorage;
      delete global.window;
      delete global.router;
    });

    test('unauthenticated visitor clicking action is redirected to #register?redirect=<target>&reason=interact', () => {
      global.window.location.hash = '#explore';
      const actionCallback = jest.fn();

      const result = feed.requireAuth(actionCallback, '#explore');

      expect(result).toBe(false);
      expect(actionCallback).not.toHaveBeenCalled();
      expect(global.router.navigate).toHaveBeenCalledWith('#register?redirect=%23explore&reason=interact');
    });

    test('unauthenticated visitor on profile view is redirected with encoded target profile hash', () => {
      global.window.location.hash = '#profile/janedoe';
      const actionCallback = jest.fn();

      const result = feed.requireAuth(actionCallback, '#profile/janedoe');

      expect(result).toBe(false);
      expect(actionCallback).not.toHaveBeenCalled();
      expect(global.router.navigate).toHaveBeenCalledWith('#register?redirect=%23profile%2Fjanedoe&reason=interact');
    });

    test('authenticated user clicking action executes the callback immediately without redirect', () => {
      global.localStorage.setItem('auth_token', 'jwt_test_token_123');
      global.localStorage.setItem('user', JSON.stringify({ id: 1, username: 'testuser' }));

      const actionCallback = jest.fn().mockReturnValue('action_done');

      const result = feed.requireAuth(actionCallback, '#explore');

      expect(result).toBe('action_done');
      expect(actionCallback).toHaveBeenCalledTimes(1);
      expect(global.router.navigate).not.toHaveBeenCalled();
    });
  });

  describe('AuthView & Reason Banner Rendering', () => {
    let mockDOM;
    let bannerEl, loginFormEl, registerFormEl, headingEl, subtitleEl, switchRegEl, switchLogEl;

    beforeEach(() => {
      mockDOM = setupMockDOM();
      global.document = mockDOM.mockDoc;
      global.window = mockDOM.mockWindow;
      global.localStorage = mockDOM.mockLocalStorage;

      bannerEl = mockDOM.mockDoc.registerElement('auth-banner', new MockElement('div'));
      loginFormEl = mockDOM.mockDoc.registerElement('login-form', new MockElement('form'));
      registerFormEl = mockDOM.mockDoc.registerElement('register-form', new MockElement('form'));
      headingEl = mockDOM.mockDoc.registerElement('auth-heading', new MockElement('h1'));
      subtitleEl = mockDOM.mockDoc.registerElement('auth-subtitle', new MockElement('p'));
      switchRegEl = mockDOM.mockDoc.registerElement('switch-to-register', new MockElement('a'));
      switchLogEl = mockDOM.mockDoc.registerElement('switch-to-login', new MockElement('a'));
    });

    afterEach(() => {
      delete global.document;
      delete global.window;
      delete global.localStorage;
    });

    test('parses query params from hash correctly', () => {
      const params = authView.parseQueryParams('#register?redirect=%23explore&reason=interact');
      expect(params.redirect).toBe('#explore');
      expect(params.reason).toBe('interact');
    });

    test('defaults redirect target to #explore when not specified', () => {
      expect(authView.getRedirectTarget({})).toBe('#explore');
      expect(authView.getRedirectTarget({ redirect: '#profile/bob' })).toBe('#profile/bob');
    });

    test('renders prominent banner when reason=interact is present in query parameters', () => {
      global.window.location.hash = '#register?redirect=%23explore&reason=interact';

      authView.renderAuthView('register');

      expect(bannerEl.style.display).toBe('flex');
      expect(bannerEl.innerHTML).toContain('Create an account or sign in to like, comment, and connect.');
      expect(bannerEl.innerHTML).toContain('auth-banner-text');
    });

    test('hides banner when reason is absent or normal navigation', () => {
      global.window.location.hash = '#register';

      authView.renderAuthView('register');

      expect(bannerEl.style.display).toBe('none');
      expect(bannerEl.innerHTML).toBe('');
    });

    test('switches form display and title between login and register modes', () => {
      // Register Mode
      authView.renderAuthView('register');
      expect(registerFormEl.style.display).toBe('block');
      expect(loginFormEl.style.display).toBe('none');
      expect(headingEl.textContent).toBe('Join CodeAlpha');

      // Login Mode
      authView.renderAuthView('login');
      expect(loginFormEl.style.display).toBe('block');
      expect(registerFormEl.style.display).toBe('none');
      expect(headingEl.textContent).toBe('Welcome Back');
    });

    test('preserves redirect and reason query parameters in mode switcher links', () => {
      global.window.location.hash = '#login?redirect=%23profile%2Falice&reason=interact';

      authView.renderAuthView('login');

      expect(switchRegEl.getAttribute('href')).toBe('#register?redirect=%23profile%2Falice&reason=interact');
      expect(switchLogEl.getAttribute('href')).toBe('#login?redirect=%23profile%2Falice&reason=interact');
    });
  });

  describe('PostCard Component Rendering', () => {
    const samplePost = {
      id: 42,
      user_id: 10,
      content: 'This is an awesome post about #javascript and modern web!',
      image_url: '/uploads/sample-photo.png',
      created_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      author: {
        id: 10,
        username: 'coder_dev',
        avatar_url: 'https://example.com/avatar.jpg',
      },
      isLiked: false,
      likesCount: 5,
      commentsCount: 2,
    };

    test('getPostCardHtml generates complete markup including image attachment, likes, and comment drawer', () => {
      const html = postCard.getPostCardHtml(samplePost, { id: 99, username: 'other_user' });

      // Author & Content
      expect(html).toContain('coder_dev');
      expect(html).toContain('href="#profile/coder_dev"');
      expect(html).toContain('This is an awesome post');

      // Image Attachment
      expect(html).toContain('class="post-media"');
      expect(html).toContain('src="/uploads/sample-photo.png"');

      // Likes Counter & Status (Unliked)
      expect(html).toContain('class="btn-like "');
      expect(html).toContain('<span class="heart-icon">🤍</span>');
      expect(html).toContain('<span class="likes-count">5</span>');

      // Comments Drawer & Form
      expect(html).toContain('class="btn-comment-action"');
      expect(html).toContain('<span class="comments-count">2</span>');
      expect(html).toContain('class="comments-drawer"');
      expect(html).toContain('class="comment-form"');
      expect(html).toContain('placeholder="Write a comment..."');

      // Non-author: should NOT render delete button
      expect(html).not.toContain('class="btn-post-delete"');
    });

    test('renders delete button when currentUser is the post author', () => {
      const authorUser = { id: 10, username: 'coder_dev' };
      const html = postCard.getPostCardHtml(samplePost, authorUser);

      expect(html).toContain('class="btn-post-delete"');
    });

    test('renders liked heart status when post.isLiked is true', () => {
      const likedPost = Object.assign({}, samplePost, { isLiked: true, likesCount: 6 });
      const html = postCard.getPostCardHtml(likedPost, { id: 99 });

      expect(html).toContain('class="btn-like liked"');
      expect(html).toContain('<span class="heart-icon">❤️</span>');
      expect(html).toContain('<span class="likes-count">6</span>');
    });

    test('omits media container when post does not contain image_url', () => {
      const textOnlyPost = Object.assign({}, samplePost, { image_url: null });
      const html = postCard.getPostCardHtml(textOnlyPost, { id: 99 });

      expect(html).not.toContain('class="post-media-container"');
    });

    test('formatTimestamp formats relative intervals correctly', () => {
      const now = new Date();
      expect(postCard.formatTimestamp(new Date(now - 10000).toISOString())).toBe('Just now');
      expect(postCard.formatTimestamp(new Date(now - 5 * 60000).toISOString())).toBe('5m ago');
      expect(postCard.formatTimestamp(new Date(now - 3 * 3600000).toISOString())).toBe('3h ago');
      expect(postCard.formatTimestamp(new Date(now - 2 * 86400000).toISOString())).toBe('2d ago');
    });

    test('escapeHtml prevents XSS injection in user content', () => {
      const unsafe = '<script>alert("hack")</script>&"\'';
      const safe = postCard.escapeHtml(unsafe);
      expect(safe).toBe('&lt;script&gt;alert(&quot;hack&quot;)&lt;/script&gt;&amp;&quot;&#39;');
    });
  });

  describe('ProfileView Component Rendering', () => {
    let mockDOM;
    let headingEl, handleEl, bioEl, joinedEl, avatarEl, actionContainerEl, statPostsEl, statFollowersEl, statFollowingEl, postsContainerEl;

    beforeEach(() => {
      mockDOM = setupMockDOM();
      global.document = mockDOM.mockDoc;
      global.window = mockDOM.mockWindow;
      global.localStorage = mockDOM.mockLocalStorage;

      headingEl = mockDOM.mockDoc.registerElement('profile-heading', new MockElement('h1'));
      handleEl = mockDOM.mockDoc.registerElement('profile-handle', new MockElement('p'));
      bioEl = mockDOM.mockDoc.registerElement('profile-bio', new MockElement('p'));
      joinedEl = mockDOM.mockDoc.registerElement('profile-joined-date', new MockElement('p'));
      avatarEl = mockDOM.mockDoc.registerElement('profile-avatar', new MockElement('div'));
      actionContainerEl = mockDOM.mockDoc.registerElement('profile-action-container', new MockElement('div'));
      statPostsEl = mockDOM.mockDoc.registerElement('stat-posts-count', new MockElement('span'));
      statFollowersEl = mockDOM.mockDoc.registerElement('stat-followers-count', new MockElement('span'));
      statFollowingEl = mockDOM.mockDoc.registerElement('stat-following-count', new MockElement('span'));
      postsContainerEl = mockDOM.mockDoc.registerElement('profile-posts-container', new MockElement('div'));
    });

    afterEach(() => {
      delete global.document;
      delete global.window;
      delete global.localStorage;
      delete global.api;
    });

    test('formatJoinedDate formats timestamp to readable month and year', () => {
      const formatted = profileView.formatJoinedDate('2026-10-19T00:00:00.000Z');
      expect(formatted).toMatch(/Joined/);
      expect(formatted).toMatch(/2026/);
    });

    test('renderProfile renders profile stats, follow button for other users, and post stream', async () => {
      global.api = {
        get: jest.fn().mockResolvedValue({
          data: {
            id: 20,
            username: 'alice',
            bio: 'Creator & builder',
            avatar_url: null,
            created_at: '2026-01-15T00:00:00.000Z',
            followersCount: 42,
            followingCount: 15,
            postsCount: 3,
            isFollowing: false,
            posts: [
              { id: 1, content: 'First post', user_id: 20, author: { username: 'alice' } }
            ]
          }
        }),
      };

      profileView.renderProfile('alice');

      // Wait a tick for promise resolution
      await new Promise(process.nextTick);

      expect(headingEl.textContent).toBe('alice');
      expect(handleEl.textContent).toBe('@alice');
      expect(bioEl.textContent).toBe('Creator & builder');
      expect(statPostsEl.textContent).toBe(3);
      expect(statFollowersEl.textContent).toBe(42);
      expect(statFollowingEl.textContent).toBe(15);

      // Follow button generated
      const followBtn = actionContainerEl.querySelector('#btn-follow-toggle');
      expect(followBtn).not.toBeNull();
      expect(followBtn.textContent).toBe('Follow');
      expect(followBtn.classList.contains('btn-primary')).toBe(true);
    });

    test('renderProfile renders unfollow button when current user already follows target', async () => {
      global.api = {
        get: jest.fn().mockResolvedValue({
          data: {
            id: 20,
            username: 'alice',
            bio: 'Creator',
            followersCount: 10,
            followingCount: 5,
            postsCount: 1,
            isFollowing: true,
            posts: []
          }
        }),
      };

      profileView.renderProfile('alice');
      await new Promise(process.nextTick);

      const followBtn = actionContainerEl.querySelector('#btn-follow-toggle');
      expect(followBtn).not.toBeNull();
      expect(followBtn.textContent).toBe('Unfollow');
      expect(followBtn.classList.contains('btn-outline')).toBe(true);
    });

    test('renderProfile renders Edit Profile button when viewing own profile', async () => {
      global.localStorage.setItem('user', JSON.stringify({ id: 20, username: 'alice' }));

      global.api = {
        get: jest.fn().mockResolvedValue({
          data: {
            id: 20,
            username: 'alice',
            bio: 'My bio',
            followersCount: 5,
            followingCount: 2,
            postsCount: 0,
            posts: []
          }
        }),
      };

      profileView.renderProfile('alice');
      await new Promise(process.nextTick);

      const editBtn = actionContainerEl.querySelector('#btn-edit-profile-toggle');
      expect(editBtn).not.toBeNull();
      expect(editBtn.textContent).toBe('Edit Profile');
      // Should NOT show follow button on self-profile
      expect(actionContainerEl.querySelector('#btn-follow-toggle')).toBeNull();
    });
  });

  describe('Dual Feed Tabs & Following Feed Gating', () => {
    let mockDOM;
    let exploreBtn, followingBtn, feedPostsEl;

    beforeEach(() => {
      mockDOM = setupMockDOM();
      global.document = mockDOM.mockDoc;
      global.window = mockDOM.mockWindow;
      global.localStorage = mockDOM.mockLocalStorage;

      exploreBtn = mockDOM.mockDoc.registerElement('tab-explore', new MockElement('button'));
      followingBtn = mockDOM.mockDoc.registerElement('tab-following', new MockElement('button'));
      feedPostsEl = mockDOM.mockDoc.registerElement('feed-posts-container', new MockElement('div'));
    });

    afterEach(() => {
      delete global.document;
      delete global.window;
      delete global.localStorage;
      delete global.api;
    });

    test('unauthenticated visitor on Following tab receives engaging sign-in call to action', () => {
      feed.renderFeed('following');

      expect(feedPostsEl.innerHTML).toContain('Follow creators to fill your feed');
      expect(feedPostsEl.innerHTML).toContain('Sign in to see posts from people you follow');
      expect(feedPostsEl.innerHTML).toContain('href="#register?redirect=%23following&reason=interact"');
    });

    test('authenticated user on Following tab with 0 follows sees friendly discover prompt', async () => {
      global.localStorage.setItem('user', JSON.stringify({ id: 1, username: 'newuser' }));
      global.localStorage.setItem('auth_token', 'valid_token');

      global.api = {
        get: jest.fn().mockResolvedValue({
          data: { posts: [], total: 0 }
        }),
      };

      feed.renderFeed('following');
      await new Promise(process.nextTick);

      expect(feedPostsEl.innerHTML).toContain("You're not following anyone yet. Discover creators in Explore!");
    });
  });
});
