// Meridian Bay — the entrypoint that hands the game in.
//
// It copies game/ and screenshots/ from beside this file into the output
// directory and writes /output/dossier.json with the kit's buildDossier
// library (vendor/makefun-game.ts). The output directory is created if
// needed and NEVER removed: the grader mounts /output as a volume, and
// deleting a mount point fails with EBUSY. Outside the grader's container,
// MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Create the output directory (recursive: harmless when it already exists
// as a mount point) and copy the whole game plus its screenshots in.
mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps: only text_max_bytes shapes the bytes; the others
// refuse an entry the scorer would refuse (more than 4 screenshots or one
// over 256 KiB; more than 993 files in game/ or 48 MiB of game files, in
// all, or a path under game/ over 1000 bytes).
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

const bytes = Buffer.byteLength(dossier, 'utf8');
const sha = createHash('sha256').update(dossier, 'utf8').digest('hex');
console.log(`dossier.json: ${bytes} bytes, sha256 ${sha}`);
console.log(`output: ${out}`);
