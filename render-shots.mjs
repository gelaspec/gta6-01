// Meridian Bay — the four screenshots, taken in headless Chrome.
//
// For every entry in shots.json it loads the game at that entry's query,
// waits until the game raises window.__shotReady (the shot state has been
// applied and the frame has settled), then captures a JPEG. Shots over the
// 256 KiB cap are retaken at lower quality until they fit.
//
//   node render-shots.mjs [--port 8123]
//
// The browser is the Chrome for Testing build in this environment, driven
// through playwright-core (already installed under shot-tools/).

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('/home/hatch/workspace/makefun/shot-tools/node_modules/playwright-core');

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const portFlag = args.indexOf('--port');
const PORT = portFlag === -1 ? 8123 : Number(args[portFlag + 1]) || 8123;
const CHROME = '/home/hatch/chrome-linux64/chrome';
const MAX_BYTES = 262144;
const SHOTS = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch { /* not up yet */ }
    await sleep(500);
  }
  throw new Error(`server did not come up at ${url}`);
}

async function main() {
  mkdirSync(join(here, 'screenshots'), { recursive: true });
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: here, stdio: 'ignore' });
  try {
    await waitForServer(`http://127.0.0.1:${PORT}/`);
    console.log(`server up on :${PORT}`);
    const browser = await chromium.launch({
      executablePath: CHROME,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      page.on('console', (msg) => {
        if (msg.type() === 'error') console.log(`[page console.error] ${msg.text()}`);
      });
      page.on('pageerror', (err) => console.log(`[pageerror] ${err.message}`));
      for (const shot of SHOTS) {
        const url = `http://127.0.0.1:${PORT}/${shot.query}`;
        console.log(`shot ${shot.name} <- ${shot.query}`);
        await page.goto(url, { waitUntil: 'load', timeout: 60000 });
        await page.waitForFunction(() => window.__shotReady === true, { timeout: 60000 });
        await sleep(400);
        const out = join(here, 'screenshots', shot.name);
        let quality = 82;
        for (;;) {
          await page.screenshot({ path: out, type: 'jpeg', quality });
          const size = statSync(out).size;
          console.log(`  ${shot.name}: ${size} bytes (quality ${quality})`);
          if (size <= MAX_BYTES || quality <= 55) break;
          quality -= 8;
        }
        const finalSize = statSync(out).size;
        if (finalSize > MAX_BYTES) throw new Error(`${shot.name} still ${finalSize} bytes over the 256 KiB cap`);
      }
    } finally {
      await browser.close();
    }
  } finally {
    server.kill('SIGTERM');
  }
  console.log('all shots done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
