// Meridian Bay — the entrypoint: hands the game in. It copies game/ and
// screenshots/ from this repository into the output directory and writes
// /output/dossier.json with buildDossier from vendor/makefun-game.ts.
//
// The output directory is a mount point on the grader, so this program
// never removes it: it only creates it (mkdirSync, recursive) and copies
// into it. Removing a mount point throws EBUSY and fails the run.
//
// Run it anywhere: paths come from import.meta.url, never from the cwd.
//   MAKEFUN_OUTPUT_DIR=out node main.ts
// Outside the grader MAKEFUN_OUTPUT_DIR stands in for /output.
import { buildDossier } from './vendor/makefun-game.ts';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(root, 'game'), join(out, 'game'), { recursive: true });
cpSync(join(root, 'screenshots'), join(out, 'screenshots'), { recursive: true });

const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

const sha = createHash('sha256').update(dossier).digest('hex');
console.log(`dossier.json: ${dossier.length} bytes, sha256 ${sha}`);
console.log(`output: ${out}`);
