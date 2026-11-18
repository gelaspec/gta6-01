// v2 screenshot renderer: serves game/ locally, opens each ?shot= scene
// from shots.json in headless Chrome via playwright-core, waits for
// window.__shotReady, and saves a JPEG into screenshots/. Written for this
// build; it is not part of the game or the dossier (main.ts only copies
// game/ and screenshots/), and it never touches the network beyond
// localhost. Usage: node render-shots.mjs

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('/home/hatch/workspace/makefun/shot-tools/node_modules/playwright-core');

const here = dirname(fileURLToPath(import.meta.url));
const PORT = 8901;
const shots = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
  for (let i = 0; i < 30; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/`);
      if (res.ok) return true;
    } catch {
      // Not up yet.
    }
    await sleep(500);
  }
  return false;
}

const server = spawn(process.execPath, ['serve.ts', '--port', String(PORT)], {
  cwd: here,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, NO_PROXY: '127.0.0.1,localhost' },
});
let serverOut = '';
server.stdout.on('data', (d) => { serverOut += d; });
server.stderr.on('data', (d) => { serverOut += d; });

try {
  if (!await waitForServer()) {
    console.log('server did not come up');
    console.log(serverOut);
    process.exit(1);
  }
  const browser = await chromium.launch({
    executablePath: '/home/hatch/chrome-linux64/chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-proxy-server', '--enable-unsafe-swiftshader'],
    env: { ...process.env, NO_PROXY: '127.0.0.1,localhost' },
  });
  try {
    for (const shot of shots) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      const errors = [];
      page.on('pageerror', (err) => errors.push(String(err)));
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      await page.goto(`http://127.0.0.1:${PORT}/${shot.query}`, { waitUntil: 'load', timeout: 30000 });
      await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 30000 });
      const gameErrors = await page.evaluate(() => window.__errors || []);
      const outPath = join(here, 'screenshots', shot.name);
      await page.screenshot({ path: outPath, type: 'jpeg', quality: 85 });
      const bytes = statSync(outPath).size;
      console.log(`${shot.name}: ${bytes} bytes${bytes > 262144 ? ' OVER 256 KiB!' : ''}`);
      if (errors.length > 0 || gameErrors.length > 0) {
        console.log(`  page errors: ${JSON.stringify(errors)} game errors: ${JSON.stringify(gameErrors)}`);
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
} finally {
  server.kill();
}
console.log('done');
