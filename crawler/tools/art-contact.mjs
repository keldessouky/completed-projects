#!/usr/bin/env node
/**
 * One picture of every sheet currently installed in public/art/.
 *
 * Answers "what am I actually looking at" without booting the game: each row
 * is one atlas kind, showing its south-facing walk cycle and its attack pose,
 * at the scale the game draws it. Variants sit under their base so the point
 * of having them — that a crowd is not one man copied — is visible at a glance.
 *
 * Usage: node tools/art-contact.mjs [--out FILE] [--dir public/art]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { chromium } from 'playwright-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flagOf = (n, d) => {
  const i = argv.indexOf('--' + n);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const DIR = resolvePath(flagOf('dir', join(ROOT, 'public/art')));
const OUT = resolvePath(flagOf('out', join(ROOT, 'art-contact.png')));

const manifestPath = join(DIR, 'manifest.json');
if (!existsSync(manifestPath)) {
  console.error(`no manifest at ${manifestPath} — nothing is installed, the game paints its own`);
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const actors = manifest.actors ?? {};
const defScale = manifest.scale ?? 3;

/** Group variants under the base they patch, preserving cast order. */
const bases = [];
for (const key of Object.keys(actors)) {
  if (/_v\d+$/.test(key)) continue;
  bases.push(key);
}
const rows = [];
for (const b of bases) {
  rows.push({ key: b, label: b });
  for (const key of Object.keys(actors)) {
    if (key.startsWith(b + '_v')) rows.push({ key, label: '   ' + key.slice(b.length + 1) });
  }
}

const files = {};
for (const { key } of rows) {
  const f = actors[key].file;
  files[f] = readFileSync(join(DIR, f));
}

const server = createServer((req, res) => {
  const name = decodeURIComponent((req.url ?? '/').slice(1));
  if (name in files) {
    res.writeHead(200, { 'content-type': 'image/png' });
    res.end(files[name]);
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end('<!doctype html><meta charset="utf-8"><title>contact</title><body>');
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({
  executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined,
  args: ['--use-angle=swiftshader'],
});
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/`);

const png = await page.evaluate(async ({ base, rows, actors, defScale }) => {
  const load = (u) => new Promise((ok, no) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => no(new Error('load ' + u));
    i.src = u;
  });

  const COLS = 5;
  const GUT = 10;
  const LABEL = 150;
  // one row height per kind, from its own cell size
  const metrics = [];
  for (const r of rows) {
    const e = actors[r.key];
    const s = e.scale ?? defScale;
    metrics.push({ ...r, cw: e.cell[0] * s, ch: e.cell[1] * s, file: e.file });
  }
  const rowH = metrics.map((m) => m.ch + GUT);
  const width = LABEL + Math.max(...metrics.map((m) => m.cw)) * COLS + GUT * 2;
  const height = rowH.reduce((a, b) => a + b, 0) + GUT;

  const cv = document.createElement('canvas');
  cv.width = width;
  cv.height = height;
  const c = cv.getContext('2d');
  c.fillStyle = '#171b21';
  c.fillRect(0, 0, width, height);
  c.imageSmoothingEnabled = false;

  let y = GUT;
  for (const m of metrics) {
    const img = await load(base + m.file);
    // banded background so rows are separable
    c.fillStyle = m.label.startsWith(' ') ? '#1c2129' : '#222834';
    c.fillRect(0, y - GUT / 2, width, m.ch + GUT);

    c.fillStyle = m.label.startsWith(' ') ? '#8c96a8' : '#e8edf5';
    c.font = m.label.startsWith(' ') ? '15px monospace' : 'bold 17px monospace';
    c.textBaseline = 'middle';
    c.fillText(m.label, 10, y + m.ch / 2);

    // row 0 of the sheet is the south facing: walk 0-3 then the attack pose
    for (let n = 0; n < COLS; n++) {
      c.drawImage(img, n * m.cw, 0, m.cw, m.ch,
        LABEL + n * m.cw, y, m.cw, m.ch);
    }
    y += m.ch + GUT;
  }

  c.fillStyle = '#5c6675';
  c.font = '14px monospace';
  c.fillText('walk 0    walk 1    walk 2    walk 3    attack', LABEL, height - 6);
  return cv.toDataURL('image/png');
}, { base: `http://127.0.0.1:${port}/`, rows, actors, defScale });

await browser.close();
server.close();
writeFileSync(OUT, Buffer.from(png.split(',')[1], 'base64'));
console.log(`${rows.length} sheets → ${OUT}`);
