// Meridian Bay — takes the four screenshots with headless Chrome over CDP.
// No dependencies: the static server, the DevTools client and the JPEG
// capture are all plain Node. Run from the repository root:
//
//   node render-shots.mjs            (all four shots)
//   node render-shots.mjs --shot chase
//
// Each shot loads game/?shot=<name>&seed=7 at 1280x720, waits for the
// game's window.__shotReady flag, then captures screenshots/N-<name>.jpg.
// A shot that reports window.__shotError, or never becomes ready, fails.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, extname, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const root = dirname(fileURLToPath(import.meta.url));
const gameDir = join(root, 'game');
const shotsDir = join(root, 'screenshots');
const CHROME = process.env.CHROME_BIN ?? join(process.env.HOME ?? '', 'chrome-linux64', 'chrome');

const SHOTS = [
  { id: 'chase', file: '1-chase.jpg' },
  { id: 'foot', file: '2-onfoot.jpg' },
  { id: 'dialog', file: '3-dialog.jpg' },
  { id: 'passed', file: '4-progress.jpg' },
];

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// -- static server for game/ -------------------------------------------------
function serveGame() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1');
        let path = decodeURIComponent(url.pathname);
        if (path === '/') path = '/index.html';
        const file = join(gameDir, normalize(path));
        if (!file.startsWith(gameDir)) {
          res.writeHead(403);
          res.end();
          return;
        }
        const data = await readFile(file);
        res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end('not found');
      }
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// -- minimal DevTools client ---------------------------------------------------
class DevTools {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.id && this.pending.has(data.id)) {
        const { resolve, reject } = this.pending.get(data.id);
        this.pending.delete(data.id);
        if (data.error) reject(new Error(data.error.message));
        else resolve(data.result);
      } else if (data.method) {
        this.events.push(data);
      }
    };
    this.ready = new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = (e) => reject(new Error(`DevTools socket error: ${e.message || 'unknown'}`));
    });
  }

  async send(method, params = {}, sessionId = undefined) {
    await this.ready;
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`DevTools timeout on ${method}`));
        }
      }, 30000);
    });
  }

  close() {
    try { this.ws.close(); } catch { /* already closed */ }
  }
}

async function waitForDevTools(port, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return await res.json();
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('Chrome DevTools did not come up');
}

async function captureShot(dev, sessionId, url, outFile, shotId) {
  const errors = [];
  dev.events.length = 0;
  await dev.send('Page.navigate', { url }, sessionId);
  // wait for the game's ready flag (or its error flag)
  const start = Date.now();
  while (Date.now() - start < 90000) {
    await sleep(500);
    const r = await dev.send('Runtime.evaluate', { expression: `({id: window.__shotId || null, ready: !!window.__shotReady, error: window.__shotError || null})`, returnByValue: true }, sessionId);
    const v = r.result.value;
    if (v.error) throw new Error(`shot failed in the page: ${v.error}`);
    if (v.id === shotId && v.ready) break;
    if (Date.now() - start > 85000) throw new Error('shot never became ready (90s)');
  }
  // surface console errors and failed requests, for the log
  for (const e of dev.events) {
    if (e.method === 'Runtime.exceptionThrown') {
      errors.push(e.params.exceptionDetails.text + ' ' + (e.params.exceptionDetails.exception?.description || ''));
    }
    if (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') {
      errors.push(e.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    }
    if (e.method === 'Network.loadingFailed') errors.push(`network failed: ${e.params.errorText}`);
  }
  let quality = 88;
  let buf = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const shot = await dev.send('Page.captureScreenshot', { format: 'jpeg', quality }, sessionId);
    buf = Buffer.from(shot.data, 'base64');
    if (buf.length <= 262144) break;
    quality -= 18;
  }
  await writeFile(outFile, buf);
  const size = (await stat(outFile)).size;
  return { size, errors };
}

async function main() {
  const args = process.argv.slice(2);
  const only = args[args.indexOf('--shot') + 1];
  const wanted = only ? SHOTS.filter((s) => s.id === only) : SHOTS;
  if (wanted.length === 0) throw new Error(`unknown shot: ${only}`);
  await mkdir(shotsDir, { recursive: true });
  const server = await serveGame();
  const port = server.address().port;
  const profile = await mkdtemp(join(tmpdir(), 'mb-shots-'));
  const chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--hide-scrollbars', '--window-size=1280,720',
    `--user-data-dir=${profile}`,
    '--remote-debugging-port=9222', 'about:blank',
  ], { stdio: 'ignore' });
  try {
    const version = await waitForDevTools(9222);
    const dev = new DevTools(version.webSocketDebuggerUrl);
    const { targetId } = await dev.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await dev.send('Target.attachToTarget', { targetId, flatten: true });
    await dev.send('Page.enable', {}, sessionId);
    await dev.send('Runtime.enable', {}, sessionId);
    await dev.send('Network.enable', {}, sessionId);
    await dev.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false }, sessionId);
    for (const shot of wanted) {
      const url = `http://127.0.0.1:${port}/index.html?shot=${shot.id}&seed=7`;
      const outFile = join(shotsDir, shot.file);
      const { size, errors } = await captureShot(dev, sessionId, url, outFile, shot.id);
      console.log(`${shot.id}: ${outFile} (${size} bytes)${errors.length ? ` — page errors: ${errors.slice(0, 3).join(' | ')}` : ''}`);
      if (size > 262144) throw new Error(`${shot.file} is ${size} bytes, over the 256 KiB cap`);
    }
    dev.close();
  } finally {
    chrome.kill('SIGKILL');
    server.close();
  }
}

main().catch((err) => {
  console.error(`render-shots: ${err.message}`);
  process.exit(1);
});
