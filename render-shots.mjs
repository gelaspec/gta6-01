// Meridian Bay — screenshot runner (v6, fresh authoring).
// Starts serve.ts, loads each ?shot= scene in headless Chrome via
// playwright-core, waits for window.__shotReady, and saves the four dossier
// frames as JPEGs (1280x720, quality 82 — each must stay under 256 KiB).
// Usage: node render-shots.mjs [--port 8091] [--out screenshots]
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('/home/hatch/workspace/makefun/shot-tools/node_modules/playwright-core');

const here = resolve(new URL('.', import.meta.url).pathname);
const args = process.argv.slice(2);
const portIdx = args.indexOf('--port');
const PORT = portIdx >= 0 ? Number(args[portIdx + 1]) : 8091;
const outIdx = args.indexOf('--out');
const OUT = outIdx >= 0 ? resolve(args[outIdx + 1]) : join(here, 'screenshots');

const SHOTS = [
  { shot: 'chase', file: '1-chase.jpg' },
  { shot: 'foot', file: '2-onfoot.jpg' },
  { shot: 'dialog', file: '3-dialog.jpg' },
  { shot: 'mission', file: '4-progress.jpg' },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitServer(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch (e) { /* not up yet */ }
    await sleep(500);
  }
  return false;
}

const server = spawn('node', ['serve.ts'], {
  cwd: here,
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout.on('data', (d) => process.stdout.write(`[serve] ${d}`));
server.stderr.on('data', (d) => process.stderr.write(`[serve:err] ${d}`));

let failed = false;
try {
  const up = await waitServer(`http://127.0.0.1:${PORT}/index.html`);
  if (!up) throw new Error('serve.ts did not come up');

  const browser = await chromium.launch({
    executablePath: '/home/hatch/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-gpu-sandbox', '--use-gl=swiftshader'],
    proxy: { server: 'http://127.0.0.1:8899', bypass: 'localhost,127.0.0.1' },
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('[page:error]', msg.text());
  });
  page.on('pageerror', (err) => console.log('[pageerror]', String(err).slice(0, 300)));

  for (const s of SHOTS) {
    const url = `http://127.0.0.1:${PORT}/index.html?shot=${s.shot}&seed=1`;
    console.log(`shot ${s.shot} <- ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    try {
      await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 90000 });
    } catch (e) {
      const errs = await page.evaluate(() => (window.__errors || []).slice(0, 5));
      console.log(`TIMEOUT __shotReady for ${s.shot}; page errors:`, JSON.stringify(errs));
      throw new Error(`shot ${s.shot} never became ready`);
    }
    await page.waitForTimeout(500);
    const path = join(OUT, s.file);
    await page.screenshot({ path, type: 'jpeg', quality: 82 });
    const errs = await page.evaluate(() => (window.__errors || []).slice(0, 5));
    console.log(`saved ${path} (errors: ${JSON.stringify(errs)})`);
  }
  await browser.close();
  console.log('ALL SHOTS DONE');
} catch (e) {
  console.error('SHOT SCRIPT FAILED:', e.message);
  failed = true;
} finally {
  server.kill('SIGTERM');
}
process.exit(failed ? 1 : 0);
