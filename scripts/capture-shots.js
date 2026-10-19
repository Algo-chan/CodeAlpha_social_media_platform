'use strict';
/** Capture screenshots of the running app at several viewports and states. */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const BASE = process.argv[2] || 'http://localhost:3000';
const OUT = path.join(os.tmpdir(), 'opencode');
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].find((p) => fs.existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = (u) => new Promise((res, rej) => http.get(u, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej));
const waitPort = (p, n = 60) => new Promise((res, rej) => { const t = (k) => getJson(`http://127.0.0.1:${p}/json/version`).then(res).catch(() => (k <= 0 ? rej(new Error('no cd')) : setTimeout(() => t(k - 1), 250))); t(n); });

const SHOTS = [
  { name: 'explore-desktop-light', w: 1440, h: 1000, hash: '#explore', theme: 'light' },
  { name: 'explore-desktop-dark', w: 1440, h: 1000, hash: '#explore', theme: 'dark' },
  { name: 'explore-mobile', w: 390, h: 844, hash: '#explore', theme: 'light' },
  { name: 'auth-register', w: 1440, h: 1000, hash: '#register?redirect=%23explore&reason=interact', theme: 'light' },
  { name: 'profile', w: 1440, h: 1000, hash: '#profile/alex_tech', theme: 'dark' },
  { name: 'following-guest', w: 390, h: 844, hash: '#following', theme: 'light' },
];

(async () => {
  const port = 9340;
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
    `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(os.tmpdir(), 'shots-' + Date.now())}`, 'about:blank'], { stdio: 'ignore' });
  try {
    await waitPort(port);
    const t = (await getJson(`http://127.0.0.1:${port}/json/list`)).find((x) => x.type === 'page');
    const ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r));
    let id = 0; const pend = new Map();
    ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
    const send = (method, params = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((r) => pend.set(i, r)); };
    const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result.result.value;

    await send('Page.enable');
    await send('Runtime.enable');

    for (const s of SHOTS) {
      await send('Emulation.setDeviceMetricsOverride', { width: s.w, height: s.h, deviceScaleFactor: 1, mobile: s.w <= 480 });
      await send('Page.navigate', { url: `${BASE}/${s.hash}` });
      await sleep(2200);
      await ev(`document.documentElement.setAttribute('data-theme', ${JSON.stringify(s.theme)}); true;`);
      await sleep(500);
      const { result } = await send('Page.captureScreenshot', { format: 'png' });
      const file = path.join(OUT, `ui-${s.name}.png`);
      fs.writeFileSync(file, Buffer.from(result.data, 'base64'));
      console.log(`saved ${file} (${fs.statSync(file).size} bytes)`);
    }
  } finally { proc.kill(); }
})();
