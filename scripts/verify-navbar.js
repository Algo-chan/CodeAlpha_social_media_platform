'use strict';
/** Measure the navbar geometry: icon size, navbar height, overflow. */
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
const waitPort = (p, n = 60) => new Promise((res, rej) => { const t = (k) => getJson(`http://127.0.0.1:${p}/json/version`).then(res).catch(() => (k <= 0 ? rej(new Error('no cd')) : setTimeout(() => t(k - 1), 250))); t(n); });

(async () => {
  const port = 9350;
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
    `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(os.tmpdir(), 'nav-' + Date.now())}`, 'about:blank'], { stdio: 'ignore' });
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

    const probe = `
      const nav = document.querySelector('.navbar');
      const navRect = nav.getBoundingClientRect();
      const icons = [...document.querySelectorAll('.nav-icon')].map(s => {
        const r = s.getBoundingClientRect();
        return { cls: s.getAttribute('class'), w: Math.round(r.width), h: Math.round(r.height) };
      });
      const links = [...document.querySelectorAll('.nav-link')].map(a => {
        const r = a.getBoundingClientRect();
        return { text: a.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom) };
      });
      const h1 = document.querySelector('h1');
      // Does any nav child stick out of the navbar box?
      const escaping = [...nav.querySelectorAll('*')].filter(el => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return false;
        return r.bottom > navRect.bottom + 1 || r.top < navRect.top - 1;
      }).map(el => ({ tag: el.tagName, cls: (el.className||'').toString().slice(0,30),
                      top: Math.round(el.getBoundingClientRect().top), bottom: Math.round(el.getBoundingClientRect().bottom) }));
      return {
        navHeight: Math.round(navRect.height),
        navTop: Math.round(navRect.top), navBottom: Math.round(navRect.bottom),
        icons, links,
        h1: h1 ? { text: h1.textContent.trim().slice(0,30), top: Math.round(h1.getBoundingClientRect().top) } : null,
        escapingNavbar: escaping,
        docOverflowX: document.documentElement.scrollWidth - window.innerWidth
      };
    `;

    for (const [name, w, h] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w <= 480 });
      await send('Page.navigate', { url: `${BASE}/?cb=${Date.now()}#explore` });
      await sleep(2200);
      const r = await ev(probe);
      console.log(`\n=== ${name} (${w}x${h}) ===`);
      console.log('navbar height:', r.navHeight, 'box:', r.navTop, '->', r.navBottom);
      console.log('icons:', JSON.stringify(r.icons));
      console.log('links:', JSON.stringify(r.links));
      console.log('h1:', JSON.stringify(r.h1));
      console.log('elements escaping navbar:', JSON.stringify(r.escapingNavbar));
      console.log('doc horizontal overflow:', r.docOverflowX);
    }
  } finally { proc.kill(); }
})();
