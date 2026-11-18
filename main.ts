// Meridian Bay — entry program. Copies game/ and screenshots/ into
// the output directory and writes dossier.json with the kit's
// buildDossier. Runs under `node main.ts` with no flags and no build
// step; it is cwd-independent (paths come from import.meta.url,
// never the cwd).
//
// v4 fix (v3 died here): NEVER rmSync the output directory. The
// grader mounts /output as a docker volume, and removing a mount
// point throws EBUSY "Device or resource busy" — exit 1, run
// fails. mkdirSync + cpSync (overwrite) is all it needs; the
// grader's /output always starts empty.

import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`dossier written: ${dossier.length} bytes -> ${join(outDir, 'dossier.json')}`);
