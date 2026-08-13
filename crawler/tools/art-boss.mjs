#!/usr/bin/env node
/**
 * Build the floor boss out of the LPC layers already vendored in this
 * repository, at `crown-and-circuit/public/lpc/` on the default branch.
 *
 * Those files are a different shape from the universal sheet art-lpc.mjs uses:
 * one file per ANIMATION rather than one file per character, each a 64 px grid
 * of four directions. So this stitches what it needs into a single sheet the
 * importer already understands —
 *
 *     rows 0-3   walk    up, left, down, right   (9 frames)
 *     rows 4-7   thrust  up, left, down, right   (8 frames, last column blank)
 *
 * — a 9x8 grid, which `art-import --grid 9x8` slices with `--map` naming the
 * walk rows and `--attack-map` naming the thrust rows.
 *
 * The layers are read with `git show` rather than copied in, so nothing
 * binary is duplicated into this project and the source stays one commit.
 *
 * Usage: node tools/art-boss.mjs [--out DIR] [--sheets-only]
 *
 * LICENCE: same LPC terms as the rest of public/art — GPL-3.0 / CC-BY-SA-3.0
 * and friends, attribution required. The upstream per-file author list lives
 * in crown-and-circuit/public/lpc/CREDITS.md; keep it with any build you ship.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { chromium } from 'playwright-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(ROOT, '..');            // the repo root holds both projects
const SRC = 'crown-and-circuit/public/lpc';
const REF = process.env.BOSS_REF ?? 'origin/master';

const argv = process.argv.slice(2);
const flagOf = (n, d = null) => {
  const i = argv.indexOf('--' + n);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const OUT = resolvePath(flagOf('out', join(ROOT, 'public/art')));
const SHEETS_ONLY = argv.includes('--sheets-only');

/**
 * The boss, back to front.
 *
 * A muscular body rather than the standard one, full plate, and a closed
 * armet: the point is that he does not read as a bigger Redcloak. Silhouette
 * does most of that work, so the helm matters more than the colour does.
 */
const STACK = ['body_king', 'legs_plate', 'feet_plate', 'torso_plate', 'helm_armet'];
/** Drawn on walk rows only — the thrust sword is a 192px cell and will not align. */
const WALK_ONLY = ['weapon_sword'];

const read = (name) => {
  try {
    return execFileSync('git', ['show', `${REF}:${SRC}/${name}.png`], {
      cwd: REPO, maxBuffer: 64 * 1024 * 1024, encoding: 'buffer',
    });
  } catch {
    return null;
  }
};

const files = {};
for (const base of [...STACK, ...WALK_ONLY]) {
  for (const anim of ['walk', 'thrust']) {
    const key = `${base}_${anim}`;
    const buf = read(key);
    if (buf && buf.length > 100) files[key] = buf;
  }
}
const missing = STACK.filter((b) => !files[`${b}_walk`] || !files[`${b}_thrust`]);
if (missing.length) {
  console.error(`missing layers for: ${missing.join(', ')}`);
  console.error(`looked in ${REF}:${SRC}/ — is the repo fetched? try: git fetch origin`);
  process.exit(1);
}
console.log(`layers      ${Object.keys(files).length} read from ${REF}:${SRC}`);

const server = createServer((req, res) => {
  const key = decodeURIComponent((req.url ?? '/').slice(1));
  if (key in files) {
    res.writeHead(200, { 'content-type': 'image/png' });
    res.end(files[key]);
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end('<!doctype html><meta charset="utf-8"><title>boss</title><body>');
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({
  executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined,
  args: ['--use-angle=swiftshader'],
});
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/`);

const png = await page.evaluate(async ({ base, stack, walkOnly }) => {
  const load = (u) => new Promise((ok, no) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => no(new Error('load ' + u));
    i.src = u;
  });
  const CELL = 64, COLS = 9, ROWS = 8;
  const cv = document.createElement('canvas');
  cv.width = CELL * COLS;
  cv.height = CELL * ROWS;
  const c = cv.getContext('2d');

  // walk into rows 0-3, thrust into rows 4-7, both in up/left/down/right order
  for (const [anim, rowBase] of [['walk', 0], ['thrust', 4]]) {
    const names = anim === 'walk' ? [...stack, ...walkOnly] : stack;
    for (const name of names) {
      const img = await load(base + name + '_' + anim);
      const cols = Math.floor(img.width / CELL);
      const rows = Math.min(4, Math.floor(img.height / CELL));
      for (let r = 0; r < rows; r++) {
        for (let n = 0; n < cols && n < COLS; n++) {
          c.drawImage(img, n * CELL, r * CELL, CELL, CELL,
            n * CELL, (rowBase + r) * CELL, CELL, CELL);
        }
      }
    }
  }
  return cv.toDataURL('image/png');
}, { base: `http://127.0.0.1:${port}/`, stack: STACK, walkOnly: WALK_ONLY });

await browser.close();
server.close();

const sheetDir = join(ROOT, '.lpc-cache/sheets');
mkdirSync(sheetDir, { recursive: true });
const sheet = join(sheetDir, 'boss.png');
writeFileSync(sheet, Buffer.from(png.split(',')[1], 'base64'));
console.log(`composite   boss  ${STACK.length} layers + sword → ${sheet}`);

if (!SHEETS_ONLY) {
  const out = execFileSync('node', [
    join(ROOT, 'tools/art-import.mjs'), sheet,
    '--kind', 'boss', '--cell', '112x120',
    '--grid', '9x8',
    '--map', 'up,left,down,right,skip,skip,skip,skip',
    '--attack-map', 'skip,skip,skip,skip,up,left,down,right',
    '--walk', '1,3,5,7', '--attack', '3',
    '--pixel', '--out', OUT,
  ], { encoding: 'utf8' });
  console.log(out.split('\n').filter((l) => /^(source|cells|rows|cols|attack|resampled|wrote)/.test(l))
    .map((l) => '            ' + l).join('\n'));
}
console.log('\nnext        npm run art:check && npm run dev');
