#!/usr/bin/env node
/**
 * Headless smoke run: boots the built game in Chromium and drives the real UI
 * through boot → title → a run where the king ferries coins and raises a
 * tower → wave clears → card pick → pause/settings → war table purchase →
 * reload for save persistence. Fails loudly on any console error.
 *
 * Usage: npm run build && node tools/smoke.mjs [--shots DIR] [--single [path]]
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const shotsDir = process.argv.includes('--shots')
  ? process.argv[process.argv.indexOf('--shots') + 1]
  : null;
if (shotsDir) mkdirSync(shotsDir, { recursive: true });
const singleArg = process.argv.includes('--single')
  ? (process.argv[process.argv.indexOf('--single') + 1] ?? join(ROOT, 'dist-single/crown-and-circuit.html'))
  : null;
const singlePath = singleArg && !singleArg.startsWith('--') ? singleArg : null;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.wav': 'audio/wav', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.json': 'application/json', '.png': 'image/png',
};

const server = createServer((req, res) => {
  const url = (req.url ?? '/').split('?')[0];
  let path = singlePath ?? join(DIST, url === '/' ? 'index.html' : url);
  if (!existsSync(path)) path = singlePath ?? join(DIST, 'index.html');
  try {
    const body = readFileSync(path);
    res.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'application/octet-stream', 'content-length': body.length });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, r));
const url = `http://127.0.0.1:${server.address().port}/?gl=webgl`;

const browser = await chromium.launch({
  executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined,
  args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 800 } });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

const scene = () => page.evaluate(() => window.__cc?.scene());
const stats = () => page.evaluate(() => window.__cc.stats());
const waitScene = async (want, timeoutMs = 30000) => {
  const t0 = Date.now();
  for (;;) {
    const s = await scene();
    if (Array.isArray(want) ? want.includes(s) : s === want) {
      // a scene flips its id before its first frame is painted
      await page.waitForTimeout(250);
      return s;
    }
    if (Date.now() - t0 > timeoutMs) {
      const diag = await page.evaluate(() => ({ stats: window.__cc.stats(), errs: window.__cc.errors.slice(0, 3) }));
      throw new Error(`timeout waiting for ${want}, at ${s}\n  ${JSON.stringify(diag)}`);
    }
    await page.waitForTimeout(200);
  }
};
const shot = async (n) => { if (shotsDir) await page.screenshot({ path: join(shotsDir, n + '.png') }); };
let pass = 0;
const ok = (l) => { pass++; console.log(`  ✓ ${l}`); };

/** hold a drag toward a world point until the king arrives */
async function steerTo(tx, ty, ms) {
  const t0 = Date.now();
  await page.mouse.move(450, 400);
  await page.mouse.down();
  while (Date.now() - t0 < ms) {
    const k = await page.evaluate(() => window.__cc.kingAt && window.__cc.kingAt());
    if (!k) break;
    const dx = tx - k.x;
    const dy = ty - k.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 14) break;
    await page.mouse.move(450 + (dx / d) * 90, 400 + (dy / d) * 90);
    await page.waitForTimeout(70);
  }
  await page.mouse.up();
}

/** click a card's Take button if the picker is open (walks the real UI tree) */
async function takeCardIfOpen() {
  const pt = await page.evaluate(() => {
    const ov = window.__cc.game.overlays.children.find((c) => c.zIndex === 750);
    if (!ov) return null;
    const hits = [];
    const walk = (n) => {
      if (n.eventMode === 'static' && n.hitArea) {
        const g = n.getGlobalPosition();
        hits.push({ x: g.x, y: g.y });
      }
      for (const c of n.children ?? []) walk(c);
    };
    walk(ov);
    return hits.length > 1 ? hits[1] : null;
  });
  if (!pt) return false;
  await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(250);
  return true;
}

try {
  console.log('smoke: boot');
  await page.goto(url);
  await page.waitForFunction(() => !!window.__cc, { timeout: 25000 });
  await waitScene('title', 60000);
  await shot('01-title');
  ok('boot → title (atlas, terrain and audio loaded)');

  await page.evaluate(() => window.__cc.goto('run'));
  await waitScene('run');
  await page.evaluate(() => window.__cc.turbo(3));
  await shot('02-run');
  ok('title → run');

  // ferry coins into a build pad and raise a structure
  const pad = await page.evaluate(() => window.__cc.nearestPad());
  if (!pad) throw new Error('no build pad available');
  await steerTo(pad.x, pad.y, 12000);
  const onPad = await page.evaluate(() => window.__cc.buildHere('tower'));
  if (!onPad) throw new Error('king never reached the build pad');
  await page.waitForTimeout(2500);
  const built = await stats();
  if (built.built < 1) throw new Error(`deposit never completed the tower (${JSON.stringify(built)})`);
  await shot('03-built');
  ok(`coin ferry built a tower (carry ${built.carry}, built ${built.built})`);

  // play through waves; pick cards when offered
  let sawCard = false;
  let maxWave = 0;
  let sawEnemies = false;
  for (let t = 0; t < 60; t++) {
    const a = t * 0.55;
    await steerTo(950 + Math.cos(a) * 200, 950 + Math.sin(a) * 200, 1500);
    if (await takeCardIfOpen()) sawCard = true;
    const s = await scene();
    if (s !== 'run') break;
    const st = await stats();
    maxWave = Math.max(maxWave, st.wave);
    if (st.enemies > 0) sawEnemies = true;
    await page.evaluate(() => window.__cc.buildHere('tower'));
    if (maxWave >= 3 && sawCard) break;
  }
  if (!sawEnemies) throw new Error('no enemies ever spawned');
  if (maxWave < 1) throw new Error('never cleared a wave');
  if (!sawCard) throw new Error('never got an upgrade card between waves');
  await shot('04-waves');
  ok(`survived to wave ${maxWave + 1} and took an upgrade card`);

  // pause → settings → resume
  if (await scene() === 'run') {
    const pausePos = await page.evaluate(() => {
      const cam = window.__cc.game.camera;
      return { x: (cam.uiW - 36) * cam.uiScale, y: (Math.max(cam.safeTop, 10) + 108) * cam.uiScale };
    });
    await page.mouse.click(pausePos.x, pausePos.y);
    await page.waitForTimeout(400);
    await shot('05-pause');
    const paused = await page.evaluate(() => window.__cc.game.loop.paused);
    if (!paused) throw new Error('pause overlay did not pause the loop');
    ok('pause overlay opens and halts the simulation');
  }

  // war table: grant shards, buy an upgrade through the real button
  await page.evaluate(() => { window.__cc.grantShards(500); window.__cc.goto('shop'); });
  await waitScene('shop');
  await shot('06-shop');
  const before = await page.evaluate(() => window.__cc.save().meta.squad);
  const buyPos = await page.evaluate(() => {
    const ui = window.__cc.game.ui;
    const hits = [];
    const walk = (n) => {
      if (n.eventMode === 'static' && n.hitArea) {
        const g = n.getGlobalPosition();
        hits.push({ x: g.x, y: g.y });
      }
      for (const c of n.children ?? []) walk(c);
    };
    walk(ui);
    return hits[1] ?? null;
  });
  if (buyPos) await page.mouse.click(buyPos.x, buyPos.y);
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => window.__cc.save().meta.squad);
  if (after !== before + 1) throw new Error(`war table purchase failed (${before} → ${after})`);
  ok('war table purchase persists');

  // reload: progress must survive
  const save1 = await page.evaluate(() => window.__cc.save());
  await page.reload();
  await page.waitForFunction(() => !!window.__cc, { timeout: 25000 });
  await waitScene('title', 60000);
  const save2 = await page.evaluate(() => window.__cc.save());
  if (save2.runs < save1.runs) throw new Error('run count lost on reload');
  if (save2.meta.squad !== after) throw new Error('upgrade lost on reload');
  ok('save survives a cold reload');

  const zr = await page.evaluate(() => window.__cc.errors);
  const all = [...errors, ...zr].filter(
    (e) => !e.includes('SwiftShader') && !e.includes('GPU stall') && !e.includes('Automatic fallback') && !e.includes('WebGPU'),
  );
  if (all.length) throw new Error('console errors:\n' + all.join('\n'));
  ok('zero console errors');

  console.log(`\nSMOKE PASS — ${pass} checks green`);
  await browser.close();
  server.close();
  process.exit(0);
} catch (err) {
  await shot('99-failure');
  console.error('\nSMOKE FAIL:', err.message);
  await browser.close();
  server.close();
  process.exit(1);
}
