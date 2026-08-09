/**
 * Sprite contact sheet.
 *
 * Boots the real game headlessly and dumps chosen atlas frames onto one PNG at
 * 3× so the pixels are readable. This is the review loop for the procedural art:
 * you cannot judge a walk cycle from source code, and rendering the frames side
 * by side is how the stride, the silhouettes and the era progression get
 * checked. Also reports how full the 2048² sheet is, which is the budget that
 * decides whether a sprite can afford to grow.
 *
 *   node tools/spritesheet.mjs out.png
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const OUT = process.argv[2] ?? 'sprites.png';
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.wav': 'audio/wav', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json',
};

const server = createServer((req, res) => {
  const u = (req.url ?? '/').split('?')[0];
  let p = join(DIST, u === '/' ? 'index.html' : u);
  if (!existsSync(p)) p = join(DIST, 'index.html');
  try {
    res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' });
    res.end(readFileSync(p));
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, r));

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 600, height: 600 } });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error') console.log('[error]', m.text().slice(0, 300)); });

await page.goto(`http://127.0.0.1:${server.address().port}/?gl=webgl`);
await page.waitForFunction(() => !!window.__cc, { timeout: 30000 });
for (let i = 0; i < 80 && (await page.evaluate(() => window.__cc.scene())) !== 'title'; i++) {
  await page.waitForTimeout(400);
}

const { png, fill } = await page.evaluate(() => {
  const a = window.__cc.game.atlas;
  const want = [];
  for (let f = 0; f < 6; f++) want.push('king0_' + f);          // the full walk cycle
  for (let f = 0; f < 3; f++) want.push('king0_atk' + f);       // and the swing
  for (let t = 0; t < 3; t++) want.push('sol0_' + t + '_0');    // levy / drilled / elite
  want.push('king4_0', 'sol4_2_0', 'king2_0', 'sol2_1_0');      // era progression
  for (let f = 0; f < 4; f++) want.push('e_runner_' + f);
  want.push('e_brute_0', 'e_brute_2', 'e_shooter_0', 'e_flyer_0', 'e_flyer_2', 'e_boss_0');
  want.push('tower0', 'tower4', 'keep0', 'keep4', 'barracks', 'forge', 'coin');

  const S = 3, PAD = 6, maxW = 1500;
  let x = PAD, y = PAD, rowH = 0;
  const boxes = [];
  for (const n of want) {
    const t = a.frames[n];
    if (!t) continue;
    const w = t.frame.width * S, h = t.frame.height * S;
    if (x + w + PAD > maxW) { x = PAD; y += rowH + PAD + 14; rowH = 0; }
    boxes.push({ t, x, y, w, h });
    x += w + PAD;
    rowH = Math.max(rowH, h);
  }
  const cv = document.createElement('canvas');
  cv.width = maxW;
  cv.height = y + rowH + PAD + 20;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.fillStyle = '#2a2f38';
  c.fillRect(0, 0, cv.width, cv.height);
  for (const b of boxes) {
    c.drawImage(a.canvas, b.t.frame.x * 2, b.t.frame.y * 2, b.t.frame.width * 2, b.t.frame.height * 2, b.x, b.y, b.w, b.h);
  }

  // how far down the 2048² sheet the packer actually reached
  let bottom = 0, count = 0;
  for (const k of Object.keys(a.frames)) {
    const f = a.frames[k].frame;
    bottom = Math.max(bottom, (f.y + f.height) * 2);
    count++;
  }
  return { png: cv.toDataURL('image/png'), fill: { bottom, count } };
});

writeFileSync(OUT, Buffer.from(png.split(',')[1], 'base64'));
console.log(`sheet → ${OUT}`);
console.log(`atlas: ${fill.count} frames, packed to y=${fill.bottom} of 2048 (${((fill.bottom / 2048) * 100).toFixed(0)}% of the sheet used)`);

await browser.close();
server.close();
