// Renders the four screenshots listed in shots.json with the shared
// headless-Chromium shot tool (~/workspace/makefun/shot-tools/gta6-shots.js).
// Each shot loads the game with ?shot=<scene>&seed=1, waits for
// window.__shotReady, and saves a JPEG under 250 KiB into screenshots/.
// The first shot by name is the cover: the late-mission chase.
//
// Usage: node render-shots.mjs [chase|onfoot|dialog|progress|all]

import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const tool = join(repoRoot, '..', 'shot-tools', 'gta6-shots.js');
const shots = JSON.parse(readFileSync(join(repoRoot, 'shots.json'), 'utf8'));

const want = process.argv[2] || 'all';
const keys = want === 'all' ? shots.map((s) => s.scene) : [want];
for (const key of keys) {
  if (!shots.some((s) => s.scene === key)) {
    console.error(`unknown shot: ${key}`);
    process.exit(1);
  }
}

if (!existsSync(tool)) {
  console.error(`shot tool not found: ${tool}`);
  process.exit(1);
}

for (const key of keys) {
  const spec = shots.find((s) => s.scene === key);
  const result = spawnSync('node', [tool, key], { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`shot ${key} failed (exit ${result.status})`);
    process.exit(result.status || 1);
  }
  const file = join(repoRoot, 'screenshots', spec.name);
  if (existsSync(file)) {
    console.log(`${spec.name}: ${(statSync(file).size / 1024).toFixed(0)} KiB`);
  }
}
console.log('all shots done');
