// Meridian Bay — entrypoint (v6, fresh authoring).
// Copies game/ and screenshots/ into the output dir and writes dossier.json.
// The grader runs this with the repo read-only and /output as a docker volume
// mount — so this file NEVER removes the output dir (rmSync on a mount point
// throws EBUSY and killed the v3 entry). It only creates missing directories
// and copies files in. buildDossier returns the dossier JSON as a string;
// dossier.json must equal exactly what it writes.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || join(here, 'dist');

// Create the output dir if it is missing. Never delete it: on the grader it
// is a mounted volume, and removing a mount point throws EBUSY.
mkdirSync(outDir, { recursive: true });

const gameDir = join(here, 'game');
const shotDir = join(here, 'screenshots');

if (!existsSync(gameDir)) throw new Error('game/ missing next to main.ts');
if (!existsSync(shotDir)) throw new Error('screenshots/ missing next to main.ts');

cpSync(gameDir, join(outDir, 'game'), { recursive: true });
cpSync(shotDir, join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`dossier written: ${dossier.length} bytes -> ${join(outDir, 'dossier.json')}`);
