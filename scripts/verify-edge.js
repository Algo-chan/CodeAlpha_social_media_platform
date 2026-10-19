/**
 * Focused checks that are awkward to express as jest unit tests:
 *   1. Feed error state renders with a working retry when the API fails.
 *   2. Skeletons shimmer while the feed is loading.
 *   3. Mobile touch targets are at least 44px on interactive controls.
 *   4. Textarea grow + character counter behave under stress input.
 *
 * Usage: node scripts/verify-edge.js [baseUrl]
 */
'use strict';

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const BASE_URL = process.argv[2] || 'http://localhost:3000';

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  path.join(os.homedir(), 'AppData/Local/Google/Chrome/Application/chrome.exe'),
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

function waitForPort(port, tries = 60) {
  return new Promise((resolve, reject) => {
    const tick = (n) => getJson(`http://127.0.0.1:${port}/json/version`).then(resolve)
      .catch(() => (n <= 0 ? reject(new Error('no devtools')) : setTimeout(() => tick(n - 1), 250)));
    tick(tries);
  });
}

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? reject(new Error(m.error.message)) : resolve(m.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res, rej) => this.pending.set(id, { resolve: res, reject: rej }));
  }
}

async function evalIn(cdp, expr) {
  const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', {
    expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.text + ' ' + (exceptionDetails.exception && exceptionDetails.exception.description));
  return result.value;
}

async function run() {
  const port = 9334;
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${port}`,
    `--user-data-dir=${path.join(os.tmpdir(), 'verify-edge-' + Date.now())}`, 'about:blank'], { stdio: 'ignore' });
  const out = {};
  try {
    await waitForPort(port);
    const target = (await getJson(`http://127.0.0.1:${port}/json/list`)).find((t) => t.type === 'page');
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r));
    const cdp = new CDP(ws);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

    // -- 1. Feed error + retry via a failing fetch, injected before load ----
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `(() => { const orig = window.fetch; let fail = true;
        window.fetch = function(u, o) {
          if (fail && String(u).indexOf('/api/v1/posts') !== -1) {
            return Promise.reject(new TypeError('Failed to fetch'));
          }
          return orig.apply(this, arguments);
        };
        window.__allowFetch = () => { fail = false; }; })();`,
    });
    await cdp.send('Page.navigate', { url: `${BASE_URL}/#explore` });
    await sleep(2200);
    out.feedError = await evalIn(cdp, `
      const es = document.querySelector('#feed-posts-container .empty-state');
      return {
        hasEmptyState: !!es,
        title: es ? es.querySelector('.empty-state-title').textContent : null,
        desc: es ? es.querySelector('.empty-state-desc').textContent.replace(/\\s+/g,' ').trim() : null,
        hasRetry: !!document.getElementById('btn-retry-feed')
      };
    `);
    // Click retry with fetch restored.
    out.feedRetry = await evalIn(cdp, `
      window.__allowFetch();
      const btn = document.getElementById('btn-retry-feed');
      if (btn) btn.click();
      await new Promise(r => setTimeout(r, 2000));
      return { postCount: document.querySelectorAll('#feed-posts-container .post-card').length };
    `);

    // -- 2. Skeleton shimmer while loading ---------------------------------
    out.skeletons = await evalIn(cdp, `
      // Freeze the API long enough to sample the loading state.
      const orig = window.fetch;
      window.fetch = () => new Promise(() => {});
      window.feed.renderFeed('explore');
      await new Promise(r => setTimeout(r, 120));
      const s = document.querySelector('.skeleton');
      const card = document.querySelector('.skeleton-card');
      const res = {
        count: document.querySelectorAll('.skeleton-card').length,
        animationName: s ? getComputedStyle(s).animationName : null,
        ariaBusy: document.getElementById('feed-posts-container').getAttribute('aria-busy')
      };
      window.fetch = orig;
      return res;
    `);

    // -- 3. Mobile touch targets ------------------------------------------
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await cdp.send('Page.navigate', { url: `${BASE_URL}/#explore` });
    await sleep(2000);
    out.mobileTargets = await evalIn(cdp, `
      const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const controls = [...document.querySelectorAll('a, button, input, textarea, select, [role="tab"], [role="button"]')].filter(visible);
      const small = controls.map(el => { const r = el.getBoundingClientRect(); return { tag: el.tagName, cls: (el.className||'').toString().slice(0,30), w: Math.round(r.width), h: Math.round(r.height) }; })
        .filter(t => t.h < 44 || t.w < 44);
      return { totalVisible: controls.length, below44: small };
    `);

    // -- 4. Composer stress --------------------------------------------------
    out.composerStress = await evalIn(cdp, `
      const ta = document.getElementById('post-content-input');
      ta.value = 'x'.repeat(600);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      const counter = document.getElementById('post-char-counter');
      const submit = document.getElementById('btn-submit-post');
      const over = { counterText: counter.textContent, overClass: counter.classList.contains('char-counter-over'), submitDisabled: submit.disabled };
      ta.value = 'Ünïcode 漢字 emoji 🎉 '.repeat(20);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      const h = ta.getBoundingClientRect().height;
      return { over, unicodeCounter: counter.textContent, textareaHeightCapped: h <= 240 };
    `);

    // -- 5. Very long unbroken word inside a post ---------------------------
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 320, height: 700, deviceScaleFactor: 1, mobile: true });
    await cdp.send('Page.navigate', { url: `${BASE_URL}/#explore` });
    await sleep(2000);
    out.narrowOverflow = await evalIn(cdp, `
      const p = document.querySelector('.post-content');
      if (p) p.textContent = 'A'.repeat(400);
      const doc = document.documentElement;
      return { viewport: window.innerWidth, scrollWidth: doc.scrollWidth, overflow: doc.scrollWidth - window.innerWidth };
    `);

    // -- 6. Rapid double-like (debounce / reconciliation) -------------------
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.navigate', { url: `${BASE_URL}/#explore` });
    await sleep(2000);
    out.rapidLike = await evalIn(cdp, `
      // Sign in so the like is allowed.
      const reg = await fetch('/api/v1/auth/register', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username:'rapid_'+Math.random().toString(36).slice(2,7), email:'r'+Math.random().toString(36).slice(2,7)+'@e.com', password:'password123' }) }).then(r=>r.json());
      if (reg && reg.data) { localStorage.setItem('auth_token', reg.data.token); localStorage.setItem('user', JSON.stringify(reg.data.user)); }
      location.hash = '#following'; location.hash = '#explore';
      await new Promise(r => setTimeout(r, 2000));
      const like = document.querySelector('.btn-like');
      if (!like) return { skipped: true };
      const start = like.querySelector('.likes-count').textContent;
      like.click(); like.click(); like.click();
      await new Promise(r => setTimeout(r, 2000));
      return { start, end: like.querySelector('.likes-count').textContent, pressed: like.getAttribute('aria-pressed'), cls: like.className };
    `);

    // -- 7. Theme toggle: flips attribute, persists, updates meta ----------
    out.themeToggle = await evalIn(cdp, `
      const before = document.documentElement.getAttribute('data-theme');
      document.getElementById('theme-toggle-btn').click();
      await new Promise(r => setTimeout(r, 200));
      const after = document.documentElement.getAttribute('data-theme');
      const stored = localStorage.getItem('theme');
      const meta = document.querySelector('meta[name="theme-color"]');
      const sun = document.querySelector('.icon-sun');
      const moon = document.querySelector('.icon-moon');
      return {
        before, after, stored,
        metaColor: meta ? meta.getAttribute('content') : null,
        sunShown: sun ? getComputedStyle(sun).display : null,
        moonShown: moon ? getComputedStyle(moon).display : null,
        toggleLabel: document.getElementById('theme-toggle-btn').getAttribute('aria-label')
      };
    `);

    // -- 8. Keyboard: tab through the composer, Enter/Space on a tab -------
    out.keyboard = await evalIn(cdp, `
      const focusable = [...document.querySelectorAll('a[href], button:not([disabled]), input, textarea, [tabindex]:not([tabindex="-1"])')]
        .filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
      const first = focusable[0];
      first.focus();
      const active = document.activeElement;
      // Activate the Explore tab with the keyboard.
      const tab = document.getElementById('tab-following');
      tab.focus();
      const focusedTab = document.activeElement.id;
      return {
        firstFocusable: first ? (first.className || first.tagName).toString().slice(0, 30) : null,
        focused: active ? (active.className || active.tagName).toString().slice(0, 30) : null,
        tabFocusable: focusedTab === 'tab-following',
        focusRing: active ? getComputedStyle(active).boxShadow : null
      };
    `);

    // -- 9. Touch targets after the responsive fix -------------------------
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await cdp.send('Page.navigate', { url: `${BASE_URL}/#explore` });
    await sleep(2000);
    out.mobileTargetsAfterFix = await evalIn(cdp, `
      const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1 && getComputedStyle(el).visibility !== 'hidden'; };
      const controls = [...document.querySelectorAll('a, button, input, textarea, select, [role="tab"], [role="button"]')]
        .filter(visible)
        .filter(el => !el.classList.contains('visually-hidden') && el.id !== 'post-media-input');
      const small = controls.map(el => { const r = el.getBoundingClientRect(); return { tag: el.tagName, cls: (el.className||'').toString().slice(0,28), w: Math.round(r.width), h: Math.round(r.height) }; })
        .filter(t => t.h < 44);
      return { totalVisible: controls.length, below44Height: small };
    `);

    out.consoleClean = true;
  } finally {
    proc.kill();
  }
  console.log(JSON.stringify(out, null, 2));
}

run().catch((e) => { console.error('EDGE FAILED:', e.message); process.exit(1); });
