/**
 * Browser verification harness (Stage G).
 * Drives headless Chrome over the DevTools Protocol, loads the running app at
 * several viewport widths, and prints concrete evidence: rendered counts,
 * computed styles, geometry, contrast ratios and interaction results.
 *
 * Usage: node scripts/verify-ui.js [baseUrl]
 */
'use strict';

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const BASE_URL = process.argv[2] || 'http://localhost:3000';

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  path.join(os.homedir(), 'AppData/Local/Google/Chrome/Application/chrome.exe'),
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];

function findChrome() {
  for (const p of CHROME_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('No Chrome/Edge binary found.');
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function waitForPort(port, tries = 60) {
  return new Promise((resolve, reject) => {
    const tick = (n) => {
      getJson(`http://127.0.0.1:${port}/json/version`)
        .then(resolve)
        .catch(() => (n <= 0 ? reject(new Error('DevTools did not start')) : setTimeout(() => tick(n - 1), 250)));
    };
    tick(tries);
  });
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.addEventListener('open', () => resolve(new CDP(ws)));
    ws.addEventListener('error', (e) => reject(e));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Evaluate an async expression in the page and return its JSON value. */
async function evaluate(cdp, expression) {
  const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', {
    expression: `(async () => { ${expression} })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.text + ' ' + JSON.stringify(exceptionDetails.exception && exceptionDetails.exception.description));
  return result.value;
}

async function withViewport(cdp, width, height, fn) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: width <= 480,
  });
  return fn();
}

async function navigate(cdp, url) {
  await cdp.send('Page.navigate', { url });
  await sleep(1500);
}

/** Shared probe: reports layout, styles and a11y-ish facts for the current page. */
const PROBE = `
  const out = {};
  const cs = (el) => el ? getComputedStyle(el) : null;
  const px = (v) => parseFloat(v) || 0;
  out.title = document.title;
  out.hash = location.hash;
  out.bodyOverflowX = document.documentElement.scrollWidth - window.innerWidth;
  out.viewActive = [...document.querySelectorAll('.view')].filter(v => getComputedStyle(v).display !== 'none').map(v => v.id);
  out.postCount = document.querySelectorAll('#feed-posts-container .post-card').length;
  out.skeletonGone = document.querySelectorAll('.skeleton-card').length === 0;
  out.navbar = (() => { const n = document.querySelector('.navbar'); if (!n) return null; const s = cs(n); const r = n.getBoundingClientRect(); return { position: s.position, height: Math.round(r.height), z: s.zIndex, bg: s.backgroundColor }; })();
  out.brand = (() => { const b = document.querySelector('.brand-logo'); return b ? b.textContent.trim() : null; })();
  out.mainWidth = (() => { const m = document.querySelector('.main-container'); return m ? Math.round(m.getBoundingClientRect().width) : null; })();
  out.postCardWidth = (() => { const p = document.querySelector('.post-card'); return p ? Math.round(p.getBoundingClientRect().width) : null; })();
  out.primaryBtn = (() => { const b = document.querySelector('.btn-primary'); if (!b) return null; const s = cs(b); const r = b.getBoundingClientRect(); return { h: Math.round(r.height), w: Math.round(r.width), bg: s.backgroundColor, color: s.color, radius: s.borderRadius }; })();
  out.touchTargets = [...document.querySelectorAll('.btn, .btn-icon, .nav-link, .tab-btn, .action-btn')].map(b => { const r = b.getBoundingClientRect(); return { cls: b.className.split(' ')[0], w: Math.round(r.width), h: Math.round(r.height) }; }).filter(t => t.h < 32);
  out.headings = [...document.querySelectorAll('h1,h2,h3')].map(h => h.tagName + ':' + h.textContent.trim().slice(0, 40));
  out.theme = document.documentElement.getAttribute('data-theme');
  out.tabs = [...document.querySelectorAll('.tab-btn')].map(t => ({ label: t.textContent.trim(), sel: t.getAttribute('aria-selected'), active: t.classList.contains('active') }));
  out.heart = (() => { const h = document.querySelector('.heart-icon'); return h ? h.textContent : null; })();
  out.likeClass = (() => { const l = document.querySelector('.btn-like'); return l ? l.className : null; })();
  out.commentPlaceholder = (() => { const c = document.querySelector('.comment-input'); return c ? c.getAttribute('placeholder') : null; })();
  return out;
`;

async function run() {
  const chrome = findChrome();
  const port = 9333;
  const userDataDir = path.join(os.tmpdir(), 'verify-ui-profile-' + Date.now());
  const proc = spawn(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--window-size=1440,900',
    'about:blank',
  ], { stdio: 'ignore' });

  const report = { baseUrl: BASE_URL, viewports: {}, interactions: {}, a11y: {}, consoleErrors: [] };

  try {
    await waitForPort(port);
    const targets = await getJson(`http://127.0.0.1:${port}/json/list`);
    const page = targets.find((t) => t.type === 'page');
    const cdp = await connect(page.webSocketDebuggerUrl);

    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Log.enable');
    cdp.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
        report.consoleErrors.push(msg.params.entry.text.slice(0, 200));
      }
    });

    // ---- Explore feed at each viewport ------------------------------------
    for (const [name, w, h] of [['desktop', 1440, 900], ['laptop', 1024, 800], ['tablet', 768, 1024], ['mobile', 390, 844]]) {
      await withViewport(cdp, w, h, async () => {
        await navigate(cdp, `${BASE_URL}/#explore`);
        await sleep(1200);
        report.viewports[name] = await evaluate(cdp, PROBE);
        report.viewports[name].viewportWidth = w;
      });
    }

    // ---- Following tab (signed out gating) --------------------------------
    await withViewport(cdp, 1440, 900, async () => {
      await navigate(cdp, `${BASE_URL}/#following`);
      await sleep(1000);
      report.interactions.followingSignedOut = await evaluate(cdp, `
        const es = document.querySelector('#feed-posts-container .empty-state');
        return {
          hasEmptyState: !!es,
          title: es ? es.querySelector('.empty-state-title').textContent : null,
          cta: es ? !!es.querySelector('a[href*="redirect="]') : false,
          text: es ? es.textContent.replace(/\\s+/g,' ').trim().slice(0,160) : null
        };
      `);
    });

    // ---- Auth view: banner + heading --------------------------------------
    await navigate(cdp, `${BASE_URL}/#register?redirect=%23explore&reason=interact`);
    await sleep(800);
    report.interactions.authBanner = await evaluate(cdp, `
      const b = document.getElementById('auth-banner');
      return {
        display: b ? getComputedStyle(b).display : null,
        text: b ? b.textContent.replace(/\\s+/g,' ').trim() : null,
        heading: (document.getElementById('auth-heading')||{}).textContent,
        subtitle: (document.getElementById('auth-subtitle')||{}).textContent,
        registerVisible: getComputedStyle(document.getElementById('register-form')).display,
        loginVisible: getComputedStyle(document.getElementById('login-form')).display
      };
    `);

    // ---- Login form validation (no network) -------------------------------
    report.interactions.loginValidation = await evaluate(cdp, `
      document.getElementById('login-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      await new Promise(r => setTimeout(r, 150));
      const err = document.querySelector('#login-form .form-error');
      return { errorShown: !!err, message: err ? err.textContent : null };
    `);

    // ---- Register a throwaway account, then exercise interactions ---------
    const username = 'verify_' + Math.random().toString(36).slice(2, 8);
    await navigate(cdp, `${BASE_URL}/#register`);
    await sleep(700);
    report.interactions.register = await evaluate(cdp, `
      document.getElementById('register-username').value = ${JSON.stringify(username)};
      document.getElementById('register-email').value = ${JSON.stringify(username + '@example.com')};
      document.getElementById('register-password').value = 'password123';
      document.getElementById('register-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      await new Promise(r => setTimeout(r, 2500));
      return {
        token: !!localStorage.getItem('auth_token'),
        user: localStorage.getItem('user'),
        hashAfter: location.hash,
        navLoggedInVisible: getComputedStyle(document.getElementById('nav-auth-logged-in')).display,
        navLoggedOutVisible: getComputedStyle(document.getElementById('nav-auth-logged-out')).display
      };
    `);

    // ---- Compose a post ----------------------------------------------------
    await navigate(cdp, `${BASE_URL}/#explore`);
    await sleep(1200);
    report.interactions.compose = await evaluate(cdp, `
      const ta = document.getElementById('post-content-input');
      ta.value = 'Automated verification post — ' + Date.now();
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      const counter = document.getElementById('post-char-counter').textContent;
      document.getElementById('create-post-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      await new Promise(r => setTimeout(r, 2500));
      const first = document.querySelector('#feed-posts-container .post-card');
      return {
        counterAfterInput: counter,
        cleared: document.getElementById('post-content-input').value === '',
        firstPostIsNew: first ? first.textContent.includes('Automated verification post') : false,
        postCount: document.querySelectorAll('#feed-posts-container .post-card').length
      };
    `);

    // ---- Like toggle (optimistic + persisted) -----------------------------
    report.interactions.like = await evaluate(cdp, `
      const like = document.querySelector('.btn-like');
      const before = { cls: like.className, pressed: like.getAttribute('aria-pressed'), count: like.querySelector('.likes-count').textContent, heart: like.querySelector('.heart-icon').textContent };
      like.click();
      await new Promise(r => setTimeout(r, 1800));
      const after = { cls: like.className, pressed: like.getAttribute('aria-pressed'), count: like.querySelector('.likes-count').textContent, heart: like.querySelector('.heart-icon').textContent, pop: like.classList.contains('just-liked') };
      return { before, after };
    `);

    // ---- Comment drawer ----------------------------------------------------
    report.interactions.comments = await evaluate(cdp, `
      const btn = document.querySelector('.btn-comment-action');
      btn.click();
      await new Promise(r => setTimeout(r, 1500));
      const drawer = document.querySelector('.comments-drawer');
      const input = drawer.querySelector('.comment-input');
      input.value = 'Verification comment';
      drawer.querySelector('.comment-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      await new Promise(r => setTimeout(r, 1800));
      return {
        expanded: btn.getAttribute('aria-expanded'),
        drawerHidden: drawer.hidden,
        items: drawer.querySelectorAll('.comment-item').length,
        firstText: drawer.querySelector('.comment-item') ? drawer.querySelector('.comment-item').textContent.replace(/\\s+/g,' ').trim().slice(0,80) : null,
        countLabel: document.querySelector('.comments-count').textContent
      };
    `);

    // ---- Profile view (own) ------------------------------------------------
    await navigate(cdp, `${BASE_URL}/#profile/${username}`);
    await sleep(1800);
    report.interactions.ownProfile = await evaluate(cdp, `
      return {
        heading: (document.getElementById('profile-heading')||{}).textContent,
        handle: (document.getElementById('profile-handle')||{}).textContent,
        editBtn: !!document.getElementById('btn-edit-profile-toggle'),
        followBtn: !!document.getElementById('btn-follow-toggle'),
        stats: ['stat-posts-count','stat-followers-count','stat-following-count'].map(id => (document.getElementById(id)||{}).textContent),
        postCount: document.querySelectorAll('#profile-posts-container .post-card').length
      };
    `);

    // ---- Seed user profile (follow button) --------------------------------
    await navigate(cdp, `${BASE_URL}/#profile/alex_tech`);
    await sleep(1800);
    report.interactions.otherProfile = await evaluate(cdp, `
      const f = document.getElementById('btn-follow-toggle');
      return {
        heading: (document.getElementById('profile-heading')||{}).textContent,
        followText: f ? f.textContent : null,
        followClass: f ? f.className : null
      };
    `);

    // ---- Unknown user ------------------------------------------------------
    await navigate(cdp, `${BASE_URL}/#profile/does_not_exist_zzz`);
    await sleep(1800);
    report.interactions.unknownProfile = await evaluate(cdp, `
      const es = document.querySelector('#profile-posts-container .empty-state');
      return { heading: (document.getElementById('profile-heading')||{}).textContent, emptyTitle: es ? es.querySelector('.empty-state-title').textContent : null, text: es ? es.textContent.replace(/\\s+/g,' ').trim().slice(0,120) : null };
    `);

    // ---- Contrast + focus ring -------------------------------------------
    await navigate(cdp, `${BASE_URL}/#explore`);
    await sleep(1500);
    report.a11y = await evaluate(cdp, `
      function lum(c){const [r,g,b]=c.match(/\\d+(\\.\\d+)?/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);});return 0.2126*r+0.7152*g+0.0722*b;}
      function ratio(a,b){const l1=lum(a),l2=lum(b);return ((Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05)).toFixed(2);}
      const bodyBg = getComputedStyle(document.body).backgroundColor;
      const bodyFg = getComputedStyle(document.body).color;
      const secondary = document.querySelector('.post-timestamp') || document.querySelector('.post-author-handle');
      const secFg = secondary ? getComputedStyle(secondary).color : null;
      const link = document.querySelector('.form-switch a') || document.querySelector('a[href="#explore"]');
      const linkFg = link ? getComputedStyle(link).color : null;
      const primary = document.querySelector('.btn-primary');
      const pBg = primary ? getComputedStyle(primary).backgroundColor : null;
      const pFg = primary ? getComputedStyle(primary).color : null;
      const skel = document.querySelector('.skeleton');
      return {
        bodyFgOnBg: ratio(bodyFg, bodyBg),
        secondaryOnBg: secFg ? ratio(secFg, bodyBg) : null,
        linkOnBg: linkFg ? ratio(linkFg, bodyBg) : null,
        primaryBtn: pBg && pFg ? ratio(pFg, pBg) : null,
        skeletonAnimating: skel ? getComputedStyle(skel).animationName : null,
        lang: document.documentElement.lang,
        skipLink: !!document.querySelector('a[href="#main-content"]'),
        imgAlts: [...document.querySelectorAll('.post-media')].every(i => i.hasAttribute('alt')),
        landmarks: {
          header: !!document.querySelector('header'), main: !!document.querySelector('main'),
          nav: !!document.querySelector('nav'), sections: document.querySelectorAll('main section').length
        }
      };
    `);

    // ---- Reduced motion ---------------------------------------------------
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    report.a11y.reducedMotion = await evaluate(cdp, `
      const view = document.querySelector('.view.active');
      return { viewAnimation: view ? getComputedStyle(view).animationDuration : null };
    `);
    await cdp.send('Emulation.setEmulatedMedia', { features: [] });

    // ---- Dark theme contrast ---------------------------------------------
    await evaluate(cdp, `document.documentElement.setAttribute('data-theme','dark'); return true;`);
    await sleep(400);
    report.a11y.dark = await evaluate(cdp, `
      function lum(c){const [r,g,b]=c.match(/\\d+(\\.\\d+)?/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);});return 0.2126*r+0.7152*g+0.0722*b;}
      function ratio(a,b){const l1=lum(a),l2=lum(b);return ((Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05)).toFixed(2);}
      const bodyBg = getComputedStyle(document.body).backgroundColor;
      const bodyFg = getComputedStyle(document.body).color;
      const primary = document.querySelector('.btn-primary');
      return { theme: document.documentElement.getAttribute('data-theme'), bodyFgOnBg: ratio(bodyFg, bodyBg), primaryBtn: primary ? ratio(getComputedStyle(primary).color, getComputedStyle(primary).backgroundColor) : null };
    `);

    // ---- Long-content stress (break-ui) ----------------------------------
    await evaluate(cdp, `document.documentElement.setAttribute('data-theme','light'); return true;`);
    await navigate(cdp, `${BASE_URL}/#explore`);
    await sleep(1200);
    report.interactions.stress = await evaluate(cdp, `
      const posts = [...document.querySelectorAll('#feed-posts-container .post-card')];
      if (!posts.length) return { skipped: true };
      const c = posts[0].querySelector('.post-content');
      c.textContent = 'Ś'.repeat(60) + ' ' + 'X'.repeat(180);
      const a = posts[0].querySelector('.post-author-name');
      a.textContent = 'bartholomew.fitzgerald.verylongusername';
      const doc = document.documentElement;
      const card = posts[0].getBoundingClientRect();
      return {
        viewport: window.innerWidth,
        docScrollWidth: doc.scrollWidth,
        horizontalOverflow: doc.scrollWidth - window.innerWidth,
        cardRight: Math.round(card.right),
        wrapsInsideCard: card.right <= window.innerWidth
      };
    `);

    // ---- Outage resilience -------------------------------------------------
    await cdp.send('Network.enable');
    await cdp.send('Network.setBlockedURLs', { urls: ['*api/v1/posts*'] });
    await navigate(cdp, `${BASE_URL}/#explore`);
    await sleep(1800);
    report.interactions.offline = await evaluate(cdp, `
      const es = document.querySelector('#feed-posts-container .empty-state');
      const err = document.querySelector('#feed-posts-container .empty-state-title');
      return { hasEmptyState: !!es, title: err ? err.textContent : null, hasRetry: !!document.getElementById('btn-retry-feed'), text: es ? es.textContent.replace(/\\s+/g,' ').trim().slice(0,140) : null };
    `);
    await cdp.send('Network.setBlockedURLs', { urls: [] });

    report.consoleErrors = report.consoleErrors.filter((e) => !/Failed to load resource|net::ERR|blocked/i.test(e));
  } finally {
    proc.kill();
  }

  console.log(JSON.stringify(report, null, 2));
}

run().catch((e) => {
  console.error('VERIFY FAILED:', e.message);
  process.exit(1);
});
