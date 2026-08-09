/**
 * Balance probe.
 *
 * Plays a real run headlessly and reports what the horde actually does: how
 * many enemies are alive over time, how long one takes to die, whether the keep
 * survives, and what the frame time looks like at peak crowd. The design goal
 * it is checking is "difficulty comes from managing numbers, not from chewing
 * through health bars" — so a wave where kills-per-second collapses while enemy
 * count climbs is the failure signal, not a loss on its own.
 *
 *   node tools/balance.mjs [waves] [--json out.json]
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.wav': 'audio/wav', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json',
};

const args = process.argv.slice(2);
const WAVES = Number(args.find((a) => /^\d+$/.test(a)) ?? 8);
const jsonAt = args.indexOf('--json');
const JSON_OUT = jsonAt >= 0 ? args[jsonAt + 1] : null;

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
const port = server.address().port;

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 440, height: 956 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });

await page.goto(`http://127.0.0.1:${port}/?gl=webgl`);
await page.waitForFunction(() => !!window.__cc, { timeout: 30000 });
for (let i = 0; i < 100 && (await page.evaluate(() => window.__cc.scene())) !== 'title'; i++) {
  await page.waitForTimeout(300);
}
await page.evaluate(() => window.__cc.startRun());
await page.waitForFunction(() => typeof window.__cc.probe === 'function', { timeout: 15000 });

/**
 * The king plays himself through the real input path — a held drag whose
 * direction is recomputed each poll. The policy is the one a player actually
 * uses: park on an empty build pad so ferried coins turn into a tower, then
 * move to the next pad; with nothing to build, orbit the keep where the coins
 * drop. Screen axes match world axes, so a world direction is a drag direction.
 */
const CX = 220;
const CY = 620;
await page.mouse.move(CX, CY);
await page.mouse.down();

const steerTo = async (from, tx, ty) => {
  const dx = tx - from.x;
  const dy = ty - from.y;
  const d = Math.hypot(dx, dy) || 1;
  await page.mouse.move(CX + (dx / d) * 80, CY + (dy / d) * 80);
};

/** Between waves the run offers upgrade cards and blocks until one is taken. */
const takeCardIfOpen = async () => {
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
  await page.mouse.up();                 // release the steering drag first
  await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(150);
  await page.mouse.move(CX, CY);
  await page.mouse.down();
  return true;
};

let orbit = 0;
let cards = 0;
let builds = 0;
// barracks first — the squad is the game's main weapon, and a bot that only
// ever stacks towers measures a fort defending itself, not a king with an army
const BUILD_ORDER = ['barracks', 'tower', 'barracks', 'tower', 'tower', 'forge'];
const play = async () => {
  if (await takeCardIfOpen()) { cards++; return; }
  const kind = BUILD_ORDER[builds % BUILD_ORDER.length];
  const s = await page.evaluate((k) => {
    const w = window.__cc;
    return { king: w.kingAt(), pads: w.pads(), build: (kk) => w.buildHere(kk), k };
  }, kind);

  // head for the nearest pad, preferring one already accepting coins so the
  // ferry finishes what it started
  let best = null;
  let bestD = Infinity;
  for (const p of s.pads) {
    const d = Math.hypot(p.x - s.king.x, p.y - s.king.y) - (p.pending ? 60 : 0);
    if (d < bestD) { bestD = d; best = p; }
  }
  if (!best) {
    orbit += 0.35;
    return steerTo(s.king, 950 + Math.cos(orbit) * 150, 950 + Math.sin(orbit) * 150);
  }
  // standing on it and nothing queued? commit to a structure — once. Asking
  // again every poll would restart the build and never finish one.
  if (!best.pending && Math.hypot(best.x - s.king.x, best.y - s.king.y) < 26) {
    const started = await page.evaluate((k) => window.__cc.buildHere(k), kind);
    if (started) builds++;
  }
  return steerTo(s.king, best.x, best.y);
};

const samples = [];
let lastKills = 0;
let lastT = Date.now();

await page.evaluate(() => { window.__cc.turbo(4); });

const deadline = Date.now() + 240000;
let done = false;
let outcome = 'timeout';

while (Date.now() < deadline) {
  await play();
  const p = await page.evaluate(() => {
    const w = window.__cc;
    if (typeof w.probe !== 'function') return null;
    return { ...w.probe(), fps: w.stats().fps, scene: w.scene() };
  });
  if (!p) { outcome = 'run ended'; break; }
  if (p.scene !== 'run') { outcome = `left run → ${p.scene}`; break; }

  const now = Date.now();
  const dt = (now - lastT) / 1000;
  samples.push({
    t: samples.length,
    wave: p.wave, phase: p.phase, era: p.era,
    enemies: p.enemies, soldiers: p.soldiers, kills: p.kills,
    kps: dt > 0 ? (p.kills - lastKills) / dt : 0,
    keepHp: p.keepHp, kingHp: p.kingHp, fps: p.fps, projs: p.projs,
  });
  lastKills = p.kills;
  lastT = now;

  if (p.wave >= WAVES) { outcome = `reached wave ${p.wave + 1}`; done = true; break; }
  await page.waitForTimeout(500);
}

// ---------------------------------------------------------------- report
const peak = samples.reduce((a, b) => (b.enemies > a.enemies ? b : a), samples[0] ?? { enemies: 0 });
const minFps = samples.reduce((a, b) => Math.min(a, b.fps), Infinity);
const busy = samples.filter((s) => s.enemies >= 40);
const busyFps = busy.length ? busy.reduce((a, b) => a + b.fps, 0) / busy.length : NaN;

const byWave = new Map();
for (const s of samples) {
  const e = byWave.get(s.wave) ?? { wave: s.wave, peak: 0, kills: 0, fps: Infinity, n: 0, sum: 0 };
  e.peak = Math.max(e.peak, s.enemies);
  e.sq = Math.max(e.sq ?? 0, s.soldiers);
  e.kills = Math.max(e.kills, s.kills);
  e.fps = Math.min(e.fps, s.fps);
  e.sum += s.kps; e.n++;
  byWave.set(s.wave, e);
}

const pad = (v, n) => String(v).padStart(n);
console.log(`\noutcome: ${outcome}   samples: ${samples.length}   cards taken: ${cards}   (turbo 4×)`);
console.log('\n wave  peakAlive  peakSquad  totalKills  kills/s');
for (const e of [...byWave.values()].sort((a, b) => a.wave - b.wave)) {
  console.log(`  ${pad(e.wave + 1, 2)}   ${pad(e.peak, 7)}   ${pad(e.sq, 7)}   ${pad(e.kills, 9)}  ${pad((e.sum / e.n).toFixed(1), 6)}`);
}
console.log(`\npeak alive:      ${peak.enemies} (wave ${peak.wave + 1})`);
console.log(`min fps:         ${minFps.toFixed(0)}`);
console.log(`fps @ 40+ alive: ${Number.isNaN(busyFps) ? 'n/a' : busyFps.toFixed(0)} over ${busy.length} samples`);
console.log(`keep hp at end:  ${samples.at(-1)?.keepHp ?? '?'}`);
console.log(`errors:          ${errors.length}${errors.length ? '\n  ' + errors.slice(0, 5).join('\n  ') : ''}`);

if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ outcome, samples }, null, 1));

await browser.close();
server.close();
process.exit(done && errors.length === 0 ? 0 : errors.length ? 1 : 0);
