'use strict';
/**
 * Verify the reworked navbar:
 *  - one Explore/Following control (the feed tabs), no nav-link duplicates
 *  - the account menu opens/closes, contains logout, and logout works
 *  - nothing escapes the 56px navbar; no horizontal overflow
 *  - the theme toggle inside the menu still switches theme
 */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const BASE = 'http://localhost:3000';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = (u) => new Promise((res, rej) => http.get(u, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej));
const waitPort = (p, n = 60) => new Promise((res, rej) => { const t = (k) => getJson(`http://127.0.0.1:${p}/json/version`).then(res).catch(() => (k <= 0 ? rej(new Error('no cdp')) : setTimeout(() => t(k - 1), 250))); t(n); });

(async () => {
  const port = 9360;
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
    `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(os.tmpdir(), 'nav3-' + Date.now())}`, 'about:blank'], { stdio: 'ignore' });
  try {
    await waitPort(port);
    const t = (await getJson(`http://127.0.0.1:${port}/json/list`)).find((x) => x.type === 'page');
    const ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r));
    let id = 0; const pend = new Map();
    ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
    const send = (method, params = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((r) => pend.set(i, r)); };
    const ev = async (expr) => (await send('Runtime.evaluate', { expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true })).result.result.value;
    await send('Runtime.enable'); await send('Page.enable');

    for (const [name, w, h] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w <= 480 });
      await send('Page.navigate', { url: `${BASE}/?cb=${Date.now()}#explore` });
      await sleep(2200);

      const out = await ev(`
        // ---- 1. Duplicate Explore/Following controls?
        const duplicateControls = {
          navLinks: document.querySelectorAll('.nav-link').length,
          feedTabs: document.querySelectorAll('.tab-btn').length,
          tabLabels: [...document.querySelectorAll('.tab-btn')].map(b => b.textContent.trim())
        };

        // ---- 2. Guest state: does anything break?
        const guestToggleInHeader = !!document.querySelector('.nav-right > #theme-toggle-btn');
        const accountVisible = !document.getElementById('nav-auth-logged-in').hidden;

        // ---- 2b. Guest theme toggle lives on the auth card and works.
        window.location.hash = '#login';
        await new Promise(r => setTimeout(r, 500));
        const authToggle = document.getElementById('auth-theme-toggle');
        const authToggleBox = authToggle ? authToggle.getBoundingClientRect() : null;
        const themeBefore = document.documentElement.getAttribute('data-theme');
        if (authToggle) authToggle.click();
        await new Promise(r => setTimeout(r, 300));
        const themeAfter = document.documentElement.getAttribute('data-theme');
        if (authToggle) authToggle.click();
        await new Promise(r => setTimeout(r, 200));
        const guestTheme = {
          togglePresent: !!authToggle,
          size: authToggleBox ? { w: Math.round(authToggleBox.width), h: Math.round(authToggleBox.height) } : null,
          before: themeBefore, after: themeAfter,
          restored: document.documentElement.getAttribute('data-theme'),
          changed: themeBefore !== themeAfter
        };

        // ---- 3. Exercise the nav geometry.
        const nav = document.querySelector('.navbar').getBoundingClientRect();
        const escaping = [...document.querySelectorAll('.navbar *')].filter(el => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) return false;
          return r.bottom > nav.bottom + 1 || r.top < nav.top - 1;
        }).map(el => (el.className || '').toString().slice(0, 30));

        return {
          duplicateControls, guestToggleInHeader, accountVisible, guestTheme,
          navHeight: Math.round(nav.height), escaping,
          docOverflowX: document.documentElement.scrollWidth - window.innerWidth
        };
      `);

      console.log(`\n=== ${name} (${w}x${h}) — guest ===`);
      console.log(JSON.stringify(out, null, 2));

      // ---- Sign in through the real API, then test the menu for real.
      const signedIn = await ev(`
        const res = await fetch('/api/v1/auth/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ login: 'alex_tech', password: 'password123' })
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, status: res.status, body: data };
        const payload = data.data || data;
        localStorage.setItem('auth_token', payload.token);
        localStorage.setItem('user', JSON.stringify(payload.user));
        window.dispatchEvent(new CustomEvent('auth:change'));
        await new Promise(r => setTimeout(r, 400));
        return { ok: true, username: payload.user.username };
      `);
      console.log(`-- login:`, JSON.stringify(signedIn));

      const menuTest = await ev(`
        const trigger = document.getElementById('nav-user-profile-link');
        const menu = document.getElementById('account-menu');
        const triggerBoxBefore = trigger.getBoundingClientRect();

        // open
        trigger.click();
        await new Promise(r => setTimeout(r, 250));
        const opened = { hidden: menu.hidden, expanded: trigger.getAttribute('aria-expanded') };
        const menuBox = menu.getBoundingClientRect();
        const items = [...menu.querySelectorAll('.account-menu-item')].map(i => ({
          id: i.id, text: i.textContent.trim(),
          h: Math.round(i.getBoundingClientRect().height),
          w: Math.round(i.getBoundingClientRect().width)
        }));
        const inViewport = menuBox.right <= window.innerWidth + 1 && menuBox.left >= -1;

        // theme toggle inside the menu
        const before = document.documentElement.getAttribute('data-theme');
        const themeBtn = document.getElementById('theme-toggle-btn');
        const themeLabelBefore = themeBtn.textContent.trim();
        themeBtn.click();
        await new Promise(r => setTimeout(r, 250));
        const after = document.documentElement.getAttribute('data-theme');
        const themeLabelAfter = themeBtn.textContent.trim();
        // restore
        themeBtn.click();
        await new Promise(r => setTimeout(r, 200));

        // escape closes
        trigger.click();
        await new Promise(r => setTimeout(r, 150));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        await new Promise(r => setTimeout(r, 150));
        const closedByEsc = { hidden: menu.hidden, expanded: trigger.getAttribute('aria-expanded') };

        // click outside closes
        trigger.click();
        await new Promise(r => setTimeout(r, 150));
        document.body.click();
        await new Promise(r => setTimeout(r, 150));
        const closedByOutside = menu.hidden;

        // logout from inside the menu
        trigger.click();
        await new Promise(r => setTimeout(r, 150));
        document.getElementById('nav-logout-btn').click();
        await new Promise(r => setTimeout(r, 400));
        const afterLogout = {
          menuHidden: document.getElementById('account-menu').hidden,
          loggedInHidden: document.getElementById('nav-auth-logged-in').hidden,
          loggedOutVisible: !document.getElementById('nav-auth-logged-out').hidden,
          token: localStorage.getItem('auth_token'),
          hash: window.location.hash
        };

        return {
          triggerSize: { w: Math.round(triggerBoxBefore.width), h: Math.round(triggerBoxBefore.height) },
          opened, menuInViewport: inViewport, items,
          theme: { before, after, labelBefore: themeLabelBefore, labelAfter: themeLabelAfter, restored: document.documentElement.getAttribute('data-theme') },
          closedByEsc, closedByOutside, afterLogout
        };
      `);
      console.log(`-- account menu:`, JSON.stringify(menuTest, null, 2));
    }
  } finally { proc.kill(); }
})();
