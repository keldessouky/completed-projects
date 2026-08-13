#!/usr/bin/env node
/**
 * Turn somebody else's sprite art into a sheet this game can load.
 *
 * Two kinds of source come in, and they need opposite treatment:
 *
 *   GRID    — a downloaded pack. Already a pixel-exact grid of equal cells,
 *             usually pixel art at 16-48 px, usually with rows in the order
 *             down / left / right / up. Nothing needs detecting; it needs
 *             slicing, its rows remapping onto this game's five facings, and
 *             resampling with the smoothing turned OFF.  --grid 4x4
 *
 *   CONTACT — a generated contact sheet. Characters scattered on a background
 *             at whatever scale and spacing the model felt like, frequently
 *             with labels baked in. This has to key out the background, find
 *             the figures, and normalise them onto a common baseline.
 *             (the default, no --grid)
 *
 * Either way the output is the same: the 5-column × 5-row sheet the loader
 * expects, plus a merged entry in public/art/manifest.json.
 *
 * The image work happens inside headless Chromium, because that is where a
 * canvas already exists — the same trick tools/art-export.mjs uses. No image
 * library is added to the project for this.
 *
 * Usage:
 *   node tools/art-import.mjs <image> --kind hero --cell 60x76 [options]
 *
 * Source layout:
 *   --preset <name>    fill in the flags for a known pack layout. `lpc` is the
 *                      Liberated Pixel Cup universal sheet — 13×21 of 64px,
 *                      walk on rows 8-11 and slash on rows 12-15, both in
 *                      up/left/down/right order. Anything you pass explicitly
 *                      wins over the preset.
 *   --grid CxR         the source IS a grid of C columns × R rows: slice it
 *                      (omit for a generated contact sheet — see above)
 *   --map <spec>       what the source's rows ARE, top to bottom, so they can
 *                      be remapped onto s,se,e,ne,n. Names —
 *                        down|south|s  up|north|n  left|west|w  right|east|e
 *                        downright|se  downleft|sw  upright|ne  upleft|nw
 *                        skip          a row that is not a facing
 *                      e.g. --map down,left,right,up
 *                      Or five raw source-row indices: --map 0,2,2,3,3
 *   --attack-map <spec>  the same, for the attack pose, when a pack keeps its
 *                      attack animation in DIFFERENT ROWS from its walk —
 *                      which every LPC-descended pack does. Omit and the
 *                      attack pose is cut from the walk rows.
 *   --walk a,b,c,d     source columns for the four walk frames
 *                      (default: as many as the grid has, cycled)
 *   --attack N         source column for the attack pose (default: last, or 0)
 *
 * Output:
 *   --kind <name>      atlas kind: hero, donut, levy0..2, grunt, archer, heavy, captain
 *   --cell WxH         cell size in DESIGN pixels (see the README table)
 *   --scale N          pixels per design pixel for the output sheet (default 3)
 *   --pixel            pixel-art source: nearest-neighbour, integer scale only
 *   --out <dir>        where to write (default public/art)
 *
 * Contact-sheet detection (ignored with --grid):
 *   --region x,y,w,h   only look inside this rectangle of the source
 *   --rows N           how many facing rows to fill from the figures found
 *   --bg <hex|auto>    background colour to key out (default auto: the corners)
 *   --tol N            colour distance counted as background, 0-255 (default 18)
 *   --min N            ignore blobs narrower or shorter than this many px (default 24)
 *   --pick a,b,c       use these figure indices, in this order, instead of the first N
 *
 * Also:
 *   --preview          write <out>/<kind>.preview.png showing what was found
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

/**
 * Known pack layouts.
 *
 * A preset is not a shortcut so much as the only usable interface for the
 * layouts that need one. Describing the LPC sheet by hand means a --map of
 * twenty-one comma-separated tokens, nineteen of which are `skip`; nobody is
 * typing that correctly on the first go, and getting it wrong shows up as a
 * character who moonwalks rather than as an error.
 */
const PRESETS = {
  lpc: {
    grid: '13x21',
    // rows 0-7 spellcast + thrust, 8-11 walk, 12-15 slash, 16-19 shoot, 20 hurt
    map: [
      ...Array(8).fill('skip'),
      'up', 'left', 'down', 'right',
      ...Array(9).fill('skip'),
    ].join(','),
    'attack-map': [
      ...Array(12).fill('skip'),
      'up', 'left', 'down', 'right',
      ...Array(5).fill('skip'),
    ].join(','),
    // column 0 of an LPC walk is a standing pose, not part of the cycle
    walk: '1,3,5,7',
    attack: '4',
    pixel: true,
  },
};

const presetName = (() => {
  const i = argv.indexOf('--preset');
  return i >= 0 ? argv[i + 1] : null;
})();
if (presetName && !(presetName in PRESETS)) {
  console.error(`unknown --preset "${presetName}". Known: ${Object.keys(PRESETS).join(', ')}`);
  process.exit(1);
}
const preset = presetName ? PRESETS[presetName] : {};

/** An explicit flag always beats the preset; the preset beats the default. */
const flag = (name, fallback = null) => {
  const i = argv.indexOf('--' + name);
  if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1];
  return preset[name] ?? fallback;
};
const has = (name) => argv.includes('--' + name) || preset[name] === true;

const SRC = argv.find((a) => !a.startsWith('--') && /\.(png|jpe?g|webp)$/i.test(a));
const KIND = flag('kind');
const CELL = flag('cell');
if (!SRC || !KIND || !CELL) {
  console.error('usage: node tools/art-import.mjs <image> --kind hero --cell 60x76 [--grid 4x4 --map down,left,right,up --pixel]');
  console.error('       run `npm run art:export` first if you need the cell size for a character');
  process.exit(1);
}
const m = /^(\d+)x(\d+)$/.exec(CELL);
if (!m) { console.error(`--cell must look like 60x76, got "${CELL}"`); process.exit(1); }
const CELL_W = Number(m[1]);
const CELL_H = Number(m[2]);
const SCALE = Number(flag('scale', '3'));
const TOL = Number(flag('tol', '18'));
const MIN = Number(flag('min', '24'));
const BG = flag('bg', 'auto');
const OUT = resolvePath(flag('out', join(ROOT, 'public/art')));
const REGION = flag('region');
const PICK = flag('pick');
const MAP = flag('map');
const ATTACK_MAP = flag('attack-map');
const DRY = has('dry');
const PREVIEW = has('preview');
const PIXEL = has('pixel');

const GRID = flag('grid');
let gridCols = 0;
let gridRows = 0;
if (GRID) {
  const g = /^(\d+)x(\d+)$/.exec(GRID);
  if (!g) { console.error(`--grid must look like 4x4, got "${GRID}"`); process.exit(1); }
  gridCols = Number(g[1]);
  gridRows = Number(g[2]);
}

const srcPath = resolvePath(SRC);
if (!existsSync(srcPath)) { console.error(`no such file: ${srcPath}`); process.exit(1); }

// ─────────────────────────── row and column plans ───────────────────────────

/**
 * Every spelling of a direction anyone puts in a sprite pack's README, folded
 * onto the eight compass points. `skip` is for rows that are not a facing at
 * all — an idle strip, a death strip, a row of icons.
 */
const DIRS = {
  down: 's', d: 's', south: 's', s: 's', front: 's',
  up: 'n', u: 'n', north: 'n', n: 'n', back: 'n',
  right: 'e', r: 'e', east: 'e', e: 'e',
  left: 'w', l: 'w', west: 'w', w: 'w',
  downright: 'se', southeast: 'se', se: 'se',
  downleft: 'sw', southwest: 'sw', sw: 'sw',
  upright: 'ne', northeast: 'ne', ne: 'ne',
  upleft: 'nw', northwest: 'nw', nw: 'nw',
  skip: null, none: null, x: null, '-': null,
};

/**
 * For each facing this game paints, which source directions will stand in for
 * it, best first.
 *
 * The game paints only the east half of the compass and mirrors for the west,
 * so a west-facing source row is not a wasted row — it is an east row that
 * needs flipping, and it is often the only diagonal a four-direction pack has
 * to offer.
 */
const PREF = {
  s: ['s', 'se', 'sw', 'e', 'w', 'ne', 'nw', 'n'],
  se: ['se', 'sw', 's', 'e', 'w', 'ne', 'nw', 'n'],
  e: ['e', 'w', 'se', 'sw', 'ne', 'nw', 's', 'n'],
  ne: ['ne', 'nw', 'n', 'e', 'w', 'se', 'sw', 's'],
  n: ['n', 'ne', 'nw', 'e', 'w', 'se', 'sw', 's'],
};
const MIRRORED = new Set(['w', 'sw', 'nw']);

/**
 * Work out, for each of the five output rows, which source row to cut it from
 * and whether to flip it.
 *
 * Returns `null` when no --map was given and the source rows are simply taken
 * in order, which is what a sheet exported by this project already is.
 */
function planRows(spec, srcRows) {
  if (!spec) {
    return FACINGS.map((_, i) => ({ src: Math.min(i, srcRows - 1), mirror: false, why: 'in order' }));
  }
  const tokens = spec.split(',').map((t) => t.trim().toLowerCase());

  // Five plain numbers: the caller is naming source rows directly and has
  // already decided everything this function would otherwise decide.
  if (tokens.length === FACINGS.length && tokens.every((t) => /^\d+$/.test(t))) {
    return tokens.map((t) => ({
      src: Math.min(Number(t), srcRows - 1), mirror: false, why: 'given',
    }));
  }

  const dirOf = tokens.map((t) => {
    if (!(t in DIRS)) {
      console.error(`--map: "${t}" is not a direction. Use ${Object.keys(DIRS).slice(0, 12).join(', ')}…`);
      process.exit(1);
    }
    return DIRS[t];
  });
  if (dirOf.length !== srcRows) {
    console.error(`--map names ${dirOf.length} rows but the source has ${srcRows}`);
    process.exit(1);
  }

  return FACINGS.map((face) => {
    for (const want of PREF[face]) {
      const src = dirOf.indexOf(want);
      if (src >= 0) {
        return { src, mirror: MIRRORED.has(want), why: want + (MIRRORED.has(want) ? ' flipped' : '') };
      }
    }
    return { src: 0, mirror: false, why: 'fallback' };
  });
}

/**
 * Which source column each of the five output frames comes from.
 *
 * Output is fixed at four walk frames plus an attack pose. A pack with three
 * walk frames is the common awkward case — contact, passing, contact is what
 * it actually drew, so the fourth frame reuses the passing pose rather than
 * stalling on a contact.
 */
function planCols(srcCols) {
  const explicit = flag('walk');
  const walk = explicit
    ? explicit.split(',').map((t) => Math.min(Number(t.trim()), srcCols - 1))
    : srcCols >= 4 ? [0, 1, 2, 3]
      : srcCols === 3 ? [0, 1, 2, 1]
        : srcCols === 2 ? [0, 1, 0, 1]
          : [0, 0, 0, 0];
  while (walk.length < 4) walk.push(walk[walk.length - 1] ?? 0);
  const attack = Number(flag('attack', String(srcCols > 4 ? 4 : 0)));
  return [...walk.slice(0, 4), Math.min(attack, srcCols - 1)];
}

const ROW_PLAN = GRID ? planRows(MAP, gridRows) : null;
// The attack pose defaults to being cut from the walk rows; a pack that keeps
// its attack animation somewhere else says so with --attack-map.
const ATK_PLAN = GRID ? (ATTACK_MAP ? planRows(ATTACK_MAP, gridRows) : ROW_PLAN) : null;
const COL_PLAN = GRID ? planCols(gridCols) : null;
const ROWS = GRID
  ? FACINGS.length
  : Math.max(1, Math.min(FACINGS.length, Number(flag('rows', '1'))));

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

  // ── does this image already have an alpha channel doing the job? ──
  //
  // Downloaded packs almost always do, and when they do there is nothing to
  // key: transparent IS the background, exactly and by construction. Guessing
  // at a background colour in that case can only make things worse — a
  // character wearing the same blue as the sheet's unused corner would lose
  // its shirt.
  let transparent = 0;
  for (let p = 3; p < px.length; p += 4) if (px[p] < 8) { transparent++; if (transparent > 64) break; }
  const hasAlpha = transparent > 64;

  const solid = new Uint8Array(rw * rh);
  let bg = [0, 0, 0];

  if (hasAlpha) {
    for (let p = 0; p < solid.length; p++) if (px[p * 4 + 3] >= 8) solid[p] = 1;
  } else {
    // ── background colour ──
    if (opts.bg === 'auto') {
      // the four corners, averaged: a sheet's border is background far more
      // reliably than any single sampled pixel is
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
    // Background is instead whatever is CONNECTED TO THE EDGE. A dark outline
    // inside a character is enclosed by the character, so it survives; the
    // surrounding field does not. With --grid the seeds are every CELL's
    // border, not just the image's, because each cell has its own field of
    // background around its figure.
    const isBg = (i) => {
      const d = Math.abs(px[i] - bg[0]) + Math.abs(px[i + 1] - bg[1]) + Math.abs(px[i + 2] - bg[2]);
      return px[i + 3] < 8 || d <= opts.tol * 3;
    };
    const back = new Uint8Array(rw * rh);
    const q = new Int32Array(rw * rh);
    let qh = 0, qt = 0;
    const seed = (x, y) => {
      if (x < 0 || y < 0 || x >= rw || y >= rh) return;
      const p = y * rw + x;
      if (!back[p] && isBg(p * 4)) { back[p] = 1; q[qt++] = p; }
    };
    const frames = opts.grid
      ? (() => {
        const out = [];
        for (let r = 0; r < opts.grid.rows; r++) {
          for (let c = 0; c < opts.grid.cols; c++) {
            out.push({
              x0: Math.round((c * rw) / opts.grid.cols),
              y0: Math.round((r * rh) / opts.grid.rows),
              x1: Math.round(((c + 1) * rw) / opts.grid.cols) - 1,
              y1: Math.round(((r + 1) * rh) / opts.grid.rows) - 1,
            });
          }
        }
        return out;
      })()
      : [{ x0: 0, y0: 0, x1: rw - 1, y1: rh - 1 }];
    for (const f of frames) {
      for (let x = f.x0; x <= f.x1; x++) { seed(x, f.y0); seed(x, f.y1); }
      for (let y = f.y0; y <= f.y1; y++) { seed(f.x0, y); seed(f.x1, y); }
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
    for (let p = 0; p < solid.length; p++) {
      if (back[p]) px[p * 4 + 3] = 0;
      else if (px[p * 4 + 3] >= 8) solid[p] = 1;
    }
  }

  /** Tightest box around the solid pixels inside a rectangle, or null. */
  const bboxIn = (x0, y0, x1, y1) => {
    let ax = x1, ay = y1, bx = x0, by = y0, any = false;
    for (let y = y0; y <= y1; y++) {
      const base = y * rw;
      for (let x = x0; x <= x1; x++) {
        if (!solid[base + x]) continue;
        any = true;
        if (x < ax) ax = x;
        if (x > bx) bx = x;
        if (y < ay) ay = y;
        if (y > by) by = y;
      }
    }
    return any ? { x: ax, y: ay, w: bx - ax + 1, h: by - ay + 1 } : null;
  };

  // ── keyed source, for cutting cells out of ──
  const keyed = document.createElement('canvas');
  keyed.width = rw;
  keyed.height = rh;
  keyed.getContext('2d').putImageData(data, 0, 0);

  const pw = Math.round(opts.cellW * opts.scale);
  const ph = Math.round(opts.cellH * opts.scale);
  const sheet = document.createElement('canvas');
  sheet.width = pw * opts.cols;
  sheet.height = ph * opts.rows;
  const sc = sheet.getContext('2d');
  sc.imageSmoothingEnabled = !opts.pixel;
  sc.imageSmoothingQuality = 'high';

  /**
   * Scale that fits `w`×`h` into a cell.
   *
   * With --pixel it is snapped to a whole number (or a whole reciprocal). A
   * pixel-art sprite drawn at ×2.7 has some source pixels landing on 3 output
   * pixels and some on 2, which shows up as a shimmer crawling along every
   * edge the moment the sprite moves. Whole numbers only, even at the cost of
   * the character sitting smaller in its cell than it strictly had to.
   */
  const fit = (w, h) => {
    const raw = Math.min((ph * 0.94) / h, (pw * 0.94) / w);
    if (!opts.pixel) return raw;
    return raw >= 1 ? Math.max(1, Math.floor(raw)) : 1 / Math.ceil(1 / raw);
  };

  let report;

  if (opts.grid) {
    // ── grid: slice, remap, draw ──
    const cw = rw / opts.grid.cols;
    const ch = rh / opts.grid.rows;
    const cellAt = (c, r) => ({
      x0: Math.round(c * cw), y0: Math.round(r * ch),
      x1: Math.round((c + 1) * cw) - 1, y1: Math.round((r + 1) * ch) - 1,
    });

    // One crop rectangle, in cell-local coordinates, shared by every frame.
    //
    // Fitting each frame to its own content would be the obvious thing and is
    // wrong: a walk cycle's frames differ in height by a pixel or two, and
    // normalising each one independently makes the character pulse and hop
    // through its own animation. The artist already aligned these frames to
    // each other — the union box keeps that alignment and only trims the dead
    // margin they all share.
    let lx = Infinity, ly = Infinity, hx = -Infinity, hy = -Infinity;
    const used = new Set();
    for (const rp of opts.rowPlan) for (const c of opts.colPlan.slice(0, 4)) used.add(rp.src + ',' + c);
    for (const rp of opts.atkPlan) used.add(rp.src + ',' + opts.colPlan[4]);
    for (const key of used) {
      const [r, c] = key.split(',').map(Number);
      const cell = cellAt(c, r);
      const b = bboxIn(cell.x0, cell.y0, cell.x1, cell.y1);
      if (!b) continue;
      lx = Math.min(lx, b.x - cell.x0);
      ly = Math.min(ly, b.y - cell.y0);
      hx = Math.max(hx, b.x + b.w - cell.x0);
      hy = Math.max(hy, b.y + b.h - cell.y0);
    }
    if (!Number.isFinite(lx)) { lx = 0; ly = 0; hx = Math.round(cw); hy = Math.round(ch); }
    const crop = { x: lx, y: ly, w: hx - lx, h: hy - ly };

    const k = fit(crop.w, crop.h);
    const dw = crop.w * k;
    const dh = crop.h * k;

    for (let r = 0; r < opts.rows; r++) {
      for (let n = 0; n < opts.cols; n++) {
        // the last column is the attack pose, which may live in its own rows
        const plan = n === opts.cols - 1 ? opts.atkPlan : opts.rowPlan;
        const rp = plan[Math.min(r, plan.length - 1)];
        const cell = cellAt(opts.colPlan[Math.min(n, opts.colPlan.length - 1)], rp.src);
        const sx = cell.x0 + crop.x;
        const sy = cell.y0 + crop.y;
        const dx = n * pw + (pw - dw) / 2;
        const dy = r * ph + (ph - dh);
        sc.save();
        if (rp.mirror) {
          sc.translate(dx + dw, dy);
          sc.scale(-1, 1);
          sc.drawImage(keyed, sx, sy, crop.w, crop.h, 0, 0, dw, dh);
        } else {
          sc.drawImage(keyed, sx, sy, crop.w, crop.h, dx, dy, dw, dh);
        }
        sc.restore();
      }
    }

    report = {
      mode: 'grid',
      found: opts.grid.cols * opts.grid.rows,
      used: opts.rows * opts.cols,
      crop,
      cellPx: [Math.round(cw), Math.round(ch)],
      scaleApplied: k,
      boxes: [],
    };
  } else {
    // ── contact sheet: segment by projection, not by flood fill ──
    //
    // A sprite strip separates its figures with clear bands of background, so
    // projecting the solid pixels onto each axis finds them directly: rows
    // that contain anything form horizontal bands, and within a band, columns
    // that contain anything form figures.
    //
    // This replaced a connected-component pass, which kept splitting
    // characters into pieces — a detached hair cap, a raised weapon, a cast
    // shadow — and then needed increasingly baroque rules to glue the right
    // pieces back together. Projection has no such problem: anything sharing a
    // column with a figure IS that figure, which is exactly the intent.
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
        const b = bboxIn(bx0, by0, bx1, by1);
        if (b) boxes.push({ x: bx0, y: b.y, w: bx1 - bx0 + 1, h: b.h });
      }
    }

    // ── group into rows, then order left to right within each ──
    boxes.sort((a, b) => a.y - b.y);
    const rows = [];
    for (const b of boxes) {
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

    const pick = opts.pick ? opts.pick.split(',').map(Number) : ordered.map((_, i) => i);
    const want = opts.cols * opts.rows;
    const chosen = [];
    for (let i = 0; i < want && ordered.length; i++) {
      // run short? repeat the last figure rather than leaving a hole
      const idx = pick[Math.min(i, pick.length - 1)];
      chosen.push(ordered[idx] ?? ordered[ordered.length - 1]);
    }

    // One scale for the whole sheet, from the TALLEST figure. Fitting each
    // figure to its own cell independently would make a character grow and
    // shrink through its own walk cycle.
    const k = chosen.length
      ? fit(Math.max(...chosen.map((b) => b.w)), Math.max(...chosen.map((b) => b.h)))
      : 1;

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

    report = {
      mode: 'contact',
      found: ordered.length,
      used: chosen.length,
      scaleApplied: k,
      boxes: ordered.map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h })),
      ordered,
    };
  }

  // ── optional preview ──
  let preview = null;
  if (opts.preview) {
    const pv = document.createElement('canvas');
    pv.width = rw;
    pv.height = rh;
    const c = pv.getContext('2d');
    c.fillStyle = '#101418';
    c.fillRect(0, 0, rw, rh);
    c.imageSmoothingEnabled = !opts.pixel;
    c.drawImage(keyed, 0, 0);
    c.font = 'bold 16px monospace';
    c.lineWidth = 2;
    if (opts.grid) {
      const cw = rw / opts.grid.cols;
      const ch = rh / opts.grid.rows;
      for (let r = 0; r < opts.grid.rows; r++) {
        for (let n = 0; n < opts.grid.cols; n++) {
          c.strokeStyle = '#2f6f88';
          c.strokeRect(n * cw, r * ch, cw, ch);
        }
        c.strokeStyle = '#00e5ff';
        c.strokeRect(report.crop.x, r * ch + report.crop.y, report.crop.w, report.crop.h);
        c.fillStyle = '#00e5ff';
        c.fillText(String(r), 3, r * ch + 16);
      }
    } else {
      (report.ordered ?? []).forEach((b, i) => {
        c.strokeStyle = '#00e5ff';
        c.strokeRect(b.x - 1, b.y - 1, b.w + 2, b.h + 2);
        c.fillStyle = '#00e5ff';
        c.fillText(String(i), b.x + 2, b.y - 4);
      });
    }
    preview = pv.toDataURL('image/png');
  }

  delete report.ordered;
  return { ...report, bg, hasAlpha, png: sheet.toDataURL('image/png'), preview };
}, {
  url: `http://127.0.0.1:${port}/img`,
  region: REGION, bg: BG, tol: TOL, min: MIN, pick: PICK,
  cols: COLS, rows: ROWS, cellW: CELL_W, cellH: CELL_H, scale: SCALE,
  preview: PREVIEW, pixel: PIXEL,
  grid: GRID ? { cols: gridCols, rows: gridRows } : null,
  rowPlan: ROW_PLAN, atkPlan: ATK_PLAN, colPlan: COL_PLAN,
});

await browser.close();
server.close();

// ─────────────────────────── report + write ───────────────────────────

console.log(`source      ${result.mode === 'grid' ? `${gridCols}×${gridRows} grid` : 'contact sheet'}`
  + (result.hasAlpha ? ', already transparent' : `, keyed against #${result.bg.map((v) => v.toString(16).padStart(2, '0')).join('')}`));

if (result.mode === 'grid') {
  console.log(`cells       ${result.cellPx[0]}×${result.cellPx[1]} px, cropped to ${result.crop.w}×${result.crop.h}`);
  console.log('rows        ' + FACINGS.map((f, i) => `${f}←${ROW_PLAN[i].src}(${ROW_PLAN[i].why})`).join('  '));
  console.log(`cols        walk ${COL_PLAN.slice(0, 4).join(',')}  attack ${COL_PLAN[4]}`);
  if (ATK_PLAN !== ROW_PLAN) {
    console.log('attack rows ' + FACINGS.map((f, i) => `${f}←${ATK_PLAN[i].src}(${ATK_PLAN[i].why})`).join('  '));
  }
} else {
  console.log(`figures     ${result.found} found, ${result.used} placed`
    + (result.found < COLS * ROWS ? '  (short — the last one repeats)' : ''));
}
console.log(`resampled   ×${result.scaleApplied.toFixed(3)}${PIXEL ? ' (whole-number, nearest)' : ''}`
  + ` to fit a ${CELL_W}×${CELL_H} cell at ${SCALE}×`);

if (result.found === 0 || result.used === 0) {
  console.error('\nNothing detected. The background key is the usual cause:');
  console.error('  --bg #1a1f2e   name the background colour explicitly');
  console.error('  --tol 60       widen what counts as background');
  console.error('  --region x,y,w,h  crop to one character\'s panel first');
  console.error('  --grid CxR     if the source is already a regular grid, say so');
  process.exit(1);
}

if (DRY) {
  console.log('\n--dry: nothing written.');
  if (result.boxes.length) {
    console.log('Detected boxes:');
    result.boxes.forEach((b, i) => console.log(`  ${String(i).padStart(2)}  ${b.x},${b.y} ${b.w}×${b.h}`));
  }
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
manifest.actors[KIND] = {
  file,
  cell: [CELL_W, CELL_H],
  ...(SCALE === (manifest.scale ?? 3) ? {} : { scale: SCALE }),
  ...(PIXEL === (manifest.pixelArt === true) ? {} : { pixelArt: PIXEL }),
};
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(`\nwrote       ${join(OUT, file)}  (${COLS * CELL_W * SCALE}×${ROWS * CELL_H * SCALE})`);
if (result.preview) console.log(`preview     ${join(OUT, KIND + '.preview.png')}`);
console.log(`manifest    ${manifestPath}`);
if (ROWS < FACINGS.length) {
  console.log(`\nOne row of art: every facing will use it, so ${KIND} never turns to`);
  console.log('face the camera. Import with --rows 5 once you have all five facings.');
}
console.log('\nnext        npm run art:check && npm run dev');
