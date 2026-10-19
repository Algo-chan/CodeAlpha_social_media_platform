const request = require('supertest');
const app = require('../src/app');

describe('Frontend Core (Task 7)', () => {
  describe('Static Asset Delivery & Content-Type', () => {
    test('GET / should serve index.html with 200 OK and text/html', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.text).toContain('<!DOCTYPE html>');
      expect(res.text).toContain('CodeAlpha');
    });

    test('GET /css/variables.css should return 200 OK with text/css', async () => {
      const res = await request(app).get('/css/variables.css');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/css/);
      expect(res.text).toContain('--bg-canvas');
      expect(res.text).toContain('--accent-primary');
      expect(res.text).toContain('--accent-heart');
      expect(res.text).toContain('[data-theme="dark"]');
    });

    test('GET /css/style.css should return 200 OK with text/css', async () => {
      const res = await request(app).get('/css/style.css');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/css/);
      expect(res.text).toContain('.navbar');
      expect(res.text).toContain('.main-container');
      expect(res.text).toContain('.view');
      expect(res.text).toContain('#toast-container');
    });

    test('GET /js/api.js should return 200 OK with javascript content-type', async () => {
      const res = await request(app).get('/js/api.js');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/(application|text)\/javascript/);
      expect(res.text).toContain('API_BASE_URL');
      expect(res.text).toContain('showToast');
    });

    test('GET /js/theme.js should return 200 OK with javascript content-type', async () => {
      const res = await request(app).get('/js/theme.js');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/(application|text)\/javascript/);
      expect(res.text).toContain('toggleTheme');
      expect(res.text).toContain('initTheme');
    });

    test('GET /js/router.js should return 200 OK with javascript content-type', async () => {
      const res = await request(app).get('/js/router.js');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/(application|text)\/javascript/);
      expect(res.text).toContain('addRoute');
      expect(res.text).toContain('setActiveView');
    });

    test('GET /js/app.js should return 200 OK with javascript content-type', async () => {
      const res = await request(app).get('/js/app.js');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/(application|text)\/javascript/);
      expect(res.text).toContain('updateAuthUI');
    });
  });

  describe('HTML Semantic Layout & Core Elements', () => {
    let htmlContent;

    beforeAll(async () => {
      const res = await request(app).get('/');
      htmlContent = res.text;
    });

    test('includes sticky navbar with brand and links', () => {
      expect(htmlContent).toContain('class="navbar"');
      expect(htmlContent).toContain('class="brand-logo"');
      expect(htmlContent).toContain('id="theme-toggle-btn"');
      expect(htmlContent).toContain('id="nav-auth-logged-out"');
      expect(htmlContent).toContain('id="nav-auth-logged-in"');
    });

    test('contains required view containers', () => {
      expect(htmlContent).toContain('id="view-feed"');
      expect(htmlContent).toContain('id="view-auth"');
      expect(htmlContent).toContain('id="view-profile"');
    });

    test('contains accessible toast container', () => {
      expect(htmlContent).toContain('id="toast-container"');
      expect(htmlContent).toContain('aria-live="polite"');
    });

    test('links stylesheets and client script modules', () => {
      expect(htmlContent).toContain('href="/css/variables.css"');
      expect(htmlContent).toContain('href="/css/style.css"');
      expect(htmlContent).toContain('src="/js/theme.js"');
      expect(htmlContent).toContain('src="/js/api.js"');
      expect(htmlContent).toContain('src="/js/router.js"');
      expect(htmlContent).toContain('src="/js/app.js"');
    });
  });

  describe('Theme Manager & Design Tokens', () => {
    test('theme module exports expected methods', () => {
      const ThemeManager = require('../public/js/theme');
      expect(typeof ThemeManager.getTheme).toBe('function');
      expect(typeof ThemeManager.setTheme).toBe('function');
      expect(typeof ThemeManager.toggleTheme).toBe('function');
      expect(typeof ThemeManager.initTheme).toBe('function');
    });

    test('CSS variables file defines required design system palette', async () => {
      const res = await request(app).get('/css/variables.css');
      const css = res.text;

      // Light theme tokens
      expect(css).toContain('--bg-canvas: #f8fafc');
      expect(css).toContain('--bg-surface: #ffffff');
      expect(css).toContain('--text-primary: #0f172a');
      expect(css).toContain('--text-secondary: #475569');
      expect(css).toContain('--border-subtle: #e2e8f0');
      expect(css).toContain('--accent-primary: #2563eb');
      expect(css).toContain('--accent-heart: #e11d48');

      // Dark theme tokens
      expect(css).toContain('--bg-canvas: #090d16');
      expect(css).toContain('--bg-surface: #111827');
      expect(css).toContain('--text-primary: #f8fafc');
      expect(css).toContain('--text-secondary: #94a3b8');
      expect(css).toContain('--border-subtle: #1f2937');
      expect(css).toContain('--accent-primary: #38bdf8');
      expect(css).toContain('--accent-heart: #fb7185');

      // Layout tokens
      expect(css).toContain('--navbar-height: 56px');
      expect(css).toContain('--max-width-feed: 640px');
    });
  });

  describe('API Client Module', () => {
    test('api module exports HTTP helper methods and config', () => {
      const api = require('../public/js/api');
      expect(typeof api.get).toBe('function');
      expect(typeof api.post).toBe('function');
      expect(typeof api.put).toBe('function');
      expect(typeof api.delete).toBe('function');
      expect(typeof api.request).toBe('function');
      expect(typeof api.showToast).toBe('function');
      expect(api.API_BASE_URL).toBe('/api/v1');
    });
  });

  describe('Router Module', () => {
    test('router module exports routing functions', () => {
      const router = require('../public/js/router');
      expect(typeof router.addRoute).toBe('function');
      expect(typeof router.navigate).toBe('function');
      expect(typeof router.handleRoute).toBe('function');
      expect(typeof router.setActiveView).toBe('function');
    });
  });
});
