// Solmar Bay: an open-world crime game for make.fun's gta6-01 bounty.
// Node 22, standard library only. main.ts hands the entry in: it copies
// game/ and screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, using the vendored
// make.fun library. Outside the grader, MAKEFUN_OUTPUT_DIR stands in
// for /output:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(here, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The scorer's caps: only text_max_bytes shapes the bytes; the rest refuse
// an entry the scorer would refuse (more than 4 screenshots, one over
// 256 KiB, more than 993 files or 48 MiB in game/, or a game/ path over
// 1000 bytes: game/ counts beside /output's own 1000-entry cap, with
// screenshots/ and dossier.json).
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
