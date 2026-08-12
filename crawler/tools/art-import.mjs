#!/usr/bin/env node
/**
 * Turn a contact sheet of generated sprites into a sheet the game can load.
 *
 * Image generators do not emit pixel-exact sprite grids. They emit a picture of
 * some characters on a background, at whatever scale and spacing they felt like,
 * frequently with labels baked in. This bridges that gap: it keys out the
 * background, finds the individual figures, normalises them onto a common
 * baseline, and packs them into the 5-column × 5-row layout the loader expects.
 *
 * The image work happens inside headless Chromium, because that is where a
 * canvas already exists — the same trick tools/art-export.mjs uses. No image
 * library is added to the project for this.
 *
 * Usage:
 *   node tools/art-import.mjs <image> --kind hero --cell 60x76 [options]
 *
 * Options:
 *   --kind <name>      atlas kind: hero, donut, levy0..2, grunt, archer, heavy, captain
 *   --cell WxH         cell size in DESIGN pixels (see the README table)
 *   --scale N          pixels per design pixel for the output sheet (default 3)
 *   --region x,y,w,h   only look inside this rectangle of the source
 *   --rows N           how many facing rows to fill from the figures found (default 1)
 *   --bg <hex|auto>    background colour to key out (default auto: sample the corners)
 *   --tol N            colour distance counted as background, 0-255 (default 18)
 *   --min N            ignore blobs narrower or shorter than this many px (default 24)
 *   --pick a,b,c       use these figure indices, in this order, instead of the first N
 *   --preview          also write <out>.preview.png with every detected figure boxed
 *   --out <dir>        where to write (default public/art)
 *   --dry              detect and report, write nothing
 *
 * A one-row sheet is a perfectly good result: the loader repeats the last row
 * for every facing it was not given, so side-view-only art works everywhere at
 * the cost of characters never turning to face the camera.
 */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COLS = 5;            // walk 0-3, attack
const FACINGS = ['s', 'se', 'e', 'ne', 'n'];

// ─────────────────────────── arguments ───────────────────────────

const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const has = (name) => argv.includes('--' + name);

const SRC = argv.find((a) => !a.startsWith('--') && /\.(png|jpe?g|webp)$/i.test(a));
const KIND = flag('kind');
const CELL = flag('cell');
if (!SRC || !KIND || !CELL) {
  console.error('usage: node tools/art-import.mjs <image> --kind hero --cell 60x76 [--rows 1]');
  console.error('       run `npm run art:export` first if you need the cell size for a character');
  process.exit(1);
}
const m = /^(\d+)x(\d+)$/.exec(CELL);
if (!m) { console.error(`--cell must look like 60x76, got "${CELL}"`); process.exit(1); }
const CELL_W = Number(m[1]);
const CELL_H = Number(m[2]);
const SCALE = Number(flag('scale', '3'));
const ROWS = Math.max(1, Math.min(FACINGS.length, Number(flag('rows', '1'))));
const TOL = Number(flag('tol', '18'));
const MIN = Number(flag('min', '24'));
const BG = flag('bg', 'auto');
const OUT = resolvePath(flag('out', join(ROOT, 'public/art')));
const REGION = flag('region');
const PICK = flag('pick');
const DRY = has('dry');
const PREVIEW = has('preview');

const srcPath = resolvePath(SRC);
if (!existsSync(srcPath)) { console.error(`no such file: ${srcPath}`); process.exit(1); }

// ─────────────────────────── serve + drive a canvas ───────────────────────────

const srcBytes = readFileSync(srcPath);
const srcMime = /\.jpe?g$/i.test(srcPath) ? 'image/jpeg'
  : /\.webp$/i.test(srcPath) ? 'image/webp' : 'image/png';
// Serve a page AND the image from the same origin. An about:blank page has an
// opaque origin, so an image fetched into it is cross-origin however the CORS
// headers are set — it taints the canvas and getImageData throws. Same-origin
// sidesteps the whole question.
const server = createServer((req, res) => {
  if ((req.url ?? '/').startsWith('/img')) {
    res.writeHead(200, { 'content-type': srcMime });
    res.end(srcBytes);
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end('<!doctype html><meta charset="utf-8"><title>art-import</title><body></body>');
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({
  executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined,
  args: ['--use-angle=swiftshader'],
});
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/`);

const result = await page.evaluate(async (opts) => {
  const img = await new Promise((ok, no) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => no(new Error('image failed to decode'));
    i.src = opts.url;
  });

  const full = document.createElement('canvas');
  full.width = img.width;
  full.height = img.height;
  const fc = full.getContext('2d', { willReadFrequently: true });
  fc.drawImage(img, 0, 0);

  const reg = opts.region
    ? opts.region.split(',').map(Number)
    : [0, 0, img.width, img.height];
  const [rx, ry, rw, rh] = reg;
  const data = fc.getImageData(rx, ry, rw, rh);
  const px = data.data;

  // ── background colour ──
  let bg;
  if (opts.bg === 'auto') {
    // the four corners, averaged: a generated sheet's border is background
    // far more reliably than any single sampled pixel is
    const corners = [
      [0, 0], [rw - 1, 0], [0, rh - 1], [rw - 1, rh - 1],
    ].map(([x, y]) => {
      const i = (y * rw + x) * 4;
      return [px[i], px[i + 1], px[i + 2]];
    });
    bg = [0, 1, 2].map((c) => Math.round(corners.reduce((s, k) => s + k[c], 0) / corners.length));
  } else {
    const h = opts.bg.replace('#', '');
    const n = parseInt(h, 16);
    bg = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // ── key it out, from the border inward ──
  //
  // NOT "every pixel near the background colour": this art is outlined in a
  // near-black keyline, and a dark background makes that keyline a background
  // match. Keying by colour alone therefore dissolves every outline and
  // shatters each figure into a dozen unconnected pieces — which is exactly
  // what the first version of this tool did.
  //
  // Background is instead whatever is CONNECTED TO THE EDGE of the image. A
  // dark outline inside a character is enclosed by the character, so it
  // survives; the surrounding field does not.
  const isBg = (i) => {
    const d = Math.abs(px[i] - bg[0]) + Math.abs(px[i + 1] - bg[1]) + Math.abs(px[i + 2] - bg[2]);
    return px[i + 3] < 8 || d <= opts.tol * 3;
  };
  const back = new Uint8Array(rw * rh);
  const q = new Int32Array(rw * rh);
  let qh = 0, qt = 0;
  for (let x = 0; x < rw; x++) {
    for (const y of [0, rh - 1]) {
      const p = y * rw + x;
      if (!back[p] && isBg(p * 4)) { back[p] = 1; q[qt++] = p; }
    }
  }
  for (let y = 0; y < rh; y++) {
    for (const x of [0, rw - 1]) {
      const p = y * rw + x;
      if (!back[p] && isBg(p * 4)) { back[p] = 1; q[qt++] = p; }
    }
  }
  while (qh < qt) {
    const p = q[qh++];
    const x = p % rw, y = (p / rw) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= rw || ny >= rh) continue;
      const n = ny * rw + nx;
      if (!back[n] && isBg(n * 4)) { back[n] = 1; q[qt++] = n; }
    }
  }

  const solid = new Uint8Array(rw * rh);
  for (let p = 0; p < solid.length; p++) {
    if (back[p]) px[p * 4 + 3] = 0;
    else if (px[p * 4 + 3] >= 8) solid[p] = 1;
  }

  // ── segment by projection, not by flood fill ──
  //
  // A sprite strip separates its figures with clear bands of background, so
  // projecting the solid pixels onto each axis finds them directly: rows that
  // contain anything form horizontal bands, and within a band, columns that
  // contain anything form figures.
  //
  // This replaced a connected-component pass, which kept splitting characters
  // into pieces — a detached hair cap, a raised weapon, a cast shadow — and
  // then needed increasingly baroque rules to glue the right pieces back
  // together. Projection has no such problem: anything sharing a column with a
  // figure IS that figure, which is exactly the intent.
  const rowHas = new Uint8Array(rh);
  const colHasIn = (y0, y1) => {
    const cols = new Uint8Array(rw);
    for (let y = y0; y <= y1; y++) {
      const base = y * rw;
      for (let x = 0; x < rw; x++) if (solid[base + x]) cols[x] = 1;
    }
    return cols;
  };
  for (let y = 0; y < rh; y++) {
    const base = y * rw;
    for (let x = 0; x < rw; x++) if (solid[base + x]) { rowHas[y] = 1; break; }
  }

  /** Runs of set values in a mask, allowing gaps up to `gap`. */
  const runs = (mask, gap) => {
    const out = [];
    let start = -1, blank = 0;
    for (let i = 0; i < mask.length; i++) {
      if (mask[i]) {
        if (start < 0) start = i;
        blank = 0;
      } else if (start >= 0) {
        blank++;
        if (blank > gap) { out.push([start, i - blank]); start = -1; blank = 0; }
      }
    }
    if (start >= 0) out.push([start, mask.length - 1 - blank]);
    return out;
  };

  // Bands first. The gap tolerance is generous vertically because a raised
  // weapon can float a few pixels clear of the body it belongs to.
  const bands = runs(rowHas, Math.max(4, Math.round(rh * 0.012)));
  const tallestBand = bands.reduce((k, [a, b]) => Math.max(k, b - a + 1), 1);

  const boxes = [];
  for (const [by0, by1] of bands) {
    // A caption is a band too, and it is never within half the height of the
    // band the characters are in.
    if (by1 - by0 + 1 < Math.max(opts.min, tallestBand * 0.42)) continue;
    const cols = colHasIn(by0, by1);
    for (const [bx0, bx1] of runs(cols, Math.max(3, Math.round(rw * 0.004)))) {
      if (bx1 - bx0 + 1 < opts.min * 0.3) continue;
      // trim to the real content inside this column run
      let y0 = by1, y1 = by0;
      for (let y = by0; y <= by1; y++) {
        const base = y * rw;
        for (let x = bx0; x <= bx1; x++) {
          if (solid[base + x]) { if (y < y0) y0 = y; if (y > y1) y1 = y; break; }
        }
      }
      boxes.push({ x: bx0, y: y0, w: bx1 - bx0 + 1, h: y1 - y0 + 1 });
    }
  }
  const merged = boxes;

  // ── group into rows, then order left to right within each ──
  merged.sort((a, b) => a.y - b.y);
  const rows = [];
  for (const b of merged) {
    const row = rows.find((r) => b.y < r.y1 && b.y + b.h > r.y0);
    if (row) {
      row.items.push(b);
      row.y0 = Math.min(row.y0, b.y);
      row.y1 = Math.max(row.y1, b.y + b.h);
    } else {
      rows.push({ y0: b.y, y1: b.y + b.h, items: [b] });
    }
  }
  for (const r of rows) r.items.sort((a, b) => a.x - b.x);
  const ordered = rows.flatMap((r) => r.items);

  // ── keyed source, for cutting cells out of ──
  const keyed = document.createElement('canvas');
  keyed.width = rw;
  keyed.height = rh;
  keyed.getContext('2d').putImageData(data, 0, 0);

  // ── optional preview ──
  let preview = null;
  if (opts.preview) {
    const pv = document.createElement('canvas');
    pv.width = rw;
    pv.height = rh;
    const c = pv.getContext('2d');
    c.fillStyle = '#101418';
    c.fillRect(0, 0, rw, rh);
    c.drawImage(keyed, 0, 0);
    c.font = 'bold 16px monospace';
    ordered.forEach((b, i) => {
      c.strokeStyle = '#00e5ff';
      c.lineWidth = 2;
      c.strokeRect(b.x - 1, b.y - 1, b.w + 2, b.h + 2);
      c.fillStyle = '#00e5ff';
      c.fillText(String(i), b.x + 2, b.y - 4);
    });
    preview = pv.toDataURL('image/png');
  }

  // ── pack ──
  const pick = opts.pick
    ? opts.pick.split(',').map(Number)
    : ordered.map((_, i) => i);
  const want = opts.cols * opts.rows;
  const chosen = [];
  for (let i = 0; i < want; i++) {
    // run short? repeat the last figure rather than leaving a hole
    const idx = pick[Math.min(i, pick.length - 1)];
    chosen.push(ordered[idx] ?? ordered[ordered.length - 1]);
  }

  const pw = Math.round(opts.cellW * opts.scale);
  const ph = Math.round(opts.cellH * opts.scale);
  const sheet = document.createElement('canvas');
  sheet.width = pw * opts.cols;
  sheet.height = ph * opts.rows;
  const sc = sheet.getContext('2d');
  sc.imageSmoothingEnabled = true;
  sc.imageSmoothingQuality = 'high';

  // One scale for the whole sheet, from the TALLEST figure. Fitting each
  // figure to its own cell independently would make a character grow and
  // shrink through its own walk cycle.
  const tallest = Math.max(...chosen.map((b) => b.h));
  const widest = Math.max(...chosen.map((b) => b.w));
  const margin = 0.94;
  const k = Math.min((ph * margin) / tallest, (pw * margin) / widest);

  chosen.forEach((b, i) => {
    const col = i % opts.cols;
    const row = (i / opts.cols) | 0;
    const dw = b.w * k;
    const dh = b.h * k;
    // centred horizontally, feet on the bottom edge — the anchor the game uses
    const dx = col * pw + (pw - dw) / 2;
    const dy = row * ph + (ph - dh);
    sc.drawImage(keyed, b.x, b.y, b.w, b.h, dx, dy, dw, dh);
  });

  return {
    bg,
    found: ordered.length,
    used: chosen.length,
    boxes: ordered.map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h })),
    scaleApplied: k,
    png: sheet.toDataURL('image/png'),
    preview,
  };
}, {
  url: `http://127.0.0.1:${port}/img`,
  region: REGION, bg: BG, tol: TOL, min: MIN, pick: PICK,
  cols: COLS, rows: ROWS, cellW: CELL_W, cellH: CELL_H, scale: SCALE,
  preview: PREVIEW,
});

await browser.close();
server.close();

// ─────────────────────────── report + write ───────────────────────────

console.log(`background  #${result.bg.map((v) => v.toString(16).padStart(2, '0')).join('')}`);
console.log(`figures     ${result.found} found, ${result.used} placed`
  + (result.found < COLS * ROWS ? '  (short — the last one repeats)' : ''));
console.log(`resampled   ×${result.scaleApplied.toFixed(3)} to fit a ${CELL_W}×${CELL_H} cell at ${SCALE}×`);

if (result.found === 0) {
  console.error('\nNothing detected. The background key is the usual cause:');
  console.error('  --bg #1a1f2e   name the background colour explicitly');
  console.error('  --tol 60       widen what counts as background');
  console.error('  --region x,y,w,h  crop to one character\'s panel first');
  process.exit(1);
}

if (DRY) {
  console.log('\n--dry: nothing written. Detected boxes:');
  result.boxes.forEach((b, i) => console.log(`  ${String(i).padStart(2)}  ${b.x},${b.y} ${b.w}×${b.h}`));
  process.exit(0);
}

mkdirSync(OUT, { recursive: true });
const file = `${KIND}.png`;
writeFileSync(join(OUT, file), Buffer.from(result.png.split(',')[1], 'base64'));
if (result.preview) {
  writeFileSync(join(OUT, `${KIND}.preview.png`), Buffer.from(result.preview.split(',')[1], 'base64'));
}

// merge into the manifest rather than replacing it: importing a second
// character must not delete the first
const manifestPath = join(OUT, 'manifest.json');
const manifest = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, 'utf8'))
  : { scale: SCALE, actors: {} };
manifest.actors = manifest.actors ?? {};
manifest.actors[KIND] = { file, cell: [CELL_W, CELL_H], ...(SCALE === (manifest.scale ?? 3) ? {} : { scale: SCALE }) };
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(`\nwrote       ${join(OUT, file)}  (${COLS * CELL_W * SCALE}×${ROWS * CELL_H * SCALE})`);
if (result.preview) console.log(`preview     ${join(OUT, KIND + '.preview.png')}`);
console.log(`manifest    ${manifestPath}`);
if (ROWS < FACINGS.length) {
  console.log(`\nOne row of art: every facing will use it, so ${KIND} never turns to`);
  console.log('face the camera. Import with --rows 5 once you have all five facings.');
}
console.log('\nnext        npm run art:check && npm run dev');
