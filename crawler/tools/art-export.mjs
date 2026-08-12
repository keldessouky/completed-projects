#!/usr/bin/env node
/**
 * Export the game's own character art as PNG sprite sheets.
 *
 * This is the starting point for replacing it. Every sheet comes out at
 * exactly the layout the loader expects — five columns (walk 0-3, attack) by
 * five rows (facing s, se, e, ne, n) — so you can open one in any editor,
 * paint over the top, drop it into public/art/ and have it work.
 *
 * It writes a ready-to-use manifest.json alongside the sheets, listing every
 * character with its real cell size. Delete the lines for anything you are not
 * replacing.
 *
 * Usage:
 *   npm run build          # the exporter reads the built game
 *   npm run art:export     # → art-template/
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const OUT = process.argv[2] ?? join(ROOT, 'art-template');

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('no dist/ — run `npm run build` first');
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.wav': 'audio/wav', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.json': 'application/json', '.png': 'image/png',
};
const server = createServer((req, res) => {
  const url = (req.url ?? '/').split('?')[0];
  let path = join(DIST, url === '/' ? 'index.html' : url);
  if (!existsSync(path)) path = join(DIST, 'index.html');
  const body = readFileSync(path);
  res.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'application/octet-stream' });
  res.end(body);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({
  executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined,
  args: ['--use-angle=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 440, height: 956 } });
await page.goto(`http://127.0.0.1:${port}/?gl=webgl`);
await page.waitForFunction(() => !!window.__cr?.game?.atlas, { timeout: 60000 });

/**
 * Compose each character's frames into one sheet, inside the page where the
 * atlas canvases live. Returns data URLs plus the cell size the loader will
 * need to be told about.
 */
const sheets = await page.evaluate(({ rows, cols, scale }) => {
  const atlas = window.__cr.game.atlas;
  const kinds = new Set();
  for (const name of Object.keys(atlas.frames)) {
    const m = /^(.+)_(s|se|e|ne|n)_(\d+)$/.exec(name);
    if (m) kinds.add(m[1]);
  }

  const out = [];
  for (const kind of [...kinds].sort()) {
    const first = atlas.frames[`${kind}_s_0`];
    if (!first) continue;
    // frame rects are in design units; multiply back up to sheet pixels
    const cw = Math.round(first.frame.width);
    const ch = Math.round(first.frame.height);
    const pw = cw * scale;
    const ph = ch * scale;

    const canvas = document.createElement('canvas');
    canvas.width = pw * cols;
    canvas.height = ph * rows.length;
    const c = canvas.getContext('2d');
    for (let r = 0; r < rows.length; r++) {
      for (let n = 0; n < cols; n++) {
        const tex = atlas.frames[`${kind}_${rows[r]}_${n}`];
        if (!tex) continue;
        const src = tex.source.resource;          // the atlas page canvas
        const res = tex.source.resolution;
        c.drawImage(
          src,
          tex.frame.x * res, tex.frame.y * res, tex.frame.width * res, tex.frame.height * res,
          n * pw, r * ph, pw, ph,
        );
      }
    }
    out.push({ kind, cell: [cw, ch], png: canvas.toDataURL('image/png') });
  }
  return out;
}, { rows: ['s', 'se', 'e', 'ne', 'n'], cols: 5, scale: 3 });

const manifest = { scale: 3, actors: {} };
for (const s of sheets) {
  const file = `${s.kind}.png`;
  writeFileSync(join(OUT, file), Buffer.from(s.png.split(',')[1], 'base64'));
  manifest.actors[s.kind] = { file, cell: s.cell };
  const [w, h] = s.cell;
  console.log(
    `${file.padEnd(12)} cell ${String(w).padStart(3)}×${String(h).padStart(3)} design px`
    + `  →  sheet ${w * 3 * 5}×${h * 3 * 5} px`,
  );
}
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

console.log(`\n${sheets.length} sheets + manifest.json → ${OUT}`);
console.log('Copy what you want to replace into public/art/, repaint, and reload.');

await browser.close();
server.close();
