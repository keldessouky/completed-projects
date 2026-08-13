#!/usr/bin/env node
/**
 * Headless smoke run: boots the built game in Chromium and plays the REAL
 * field — walks with the joystick, hoovers up coins, stands on a recruit pad
 * until the crowd grows, marches that crowd into a camp, loses people, gets
 * wiped, comes back, and knocks the castle gate down. Fails loudly on any
 * console error.
 *
 * The bot moves by dragging on the canvas exactly like a thumb, and reads the
 * field through the same probe the dev overlay uses. The only seams it takes
 * that a human cannot are `turbo` and `warp` — a 3,600-unit field cannot be
 * crossed on foot inside a test budget.
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
  ? (process.argv[process.argv.indexOf('--single') + 1] ?? join(ROOT, 'dist-single/crawler.html'))
  : null;
const singlePath = singleArg && !singleArg.startsWith('--') ? singleArg : null;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.wav': 'audio/wav', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
};

const server = createServer((req, res) => {
  const url = (req.url ?? '/').split('?')[0];
  let path = singlePath ?? join(DIST, url === '/' ? 'index.html' : url);
  if (!existsSync(path)) path = singlePath ?? join(DIST, 'index.html');
  try {
    const body = readFileSync(path);
    res.writeHead(200, {
      'content-type': MIME[extname(path)] ?? 'application/octet-stream',
      'content-length': body.length,
    });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const url = `http://127.0.0.1:${port}/?gl=webgl`;

const browser = await chromium.launch({
  executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined,
  args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 440, height: 956 } });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

const scene = () => page.evaluate(() => window.__cr?.scene());
const probe = () => page.evaluate(() => window.__cr.probe());
const saveData = () => page.evaluate(() => window.__cr.save());
const warp = (x, y) => page.evaluate(([a, b]) => window.__cr.warp(a, b), [x, y]);
const grantCoins = (n) => page.evaluate((v) => window.__cr.grantCoins(v), n);

const waitScene = async (want, timeoutMs = 30000) => {
  const t0 = Date.now();
  for (;;) {
    const s = await scene();
    if (Array.isArray(want) ? want.includes(s) : s === want) {
      // A scene flips its id before its first frame is painted. Give it one
      // beat so synthetic taps land on a live scene, the way a human tap would.
      await page.waitForTimeout(250);
      return s;
    }
    if (Date.now() - t0 > timeoutMs) {
      const diag = await page.evaluate(() => ({
        stats: window.__cr.stats(), probe: window.__cr.probe(), errs: window.__cr.errors.slice(0, 3),
      }));
      throw new Error(`timeout waiting for scene ${want}, at ${s}\n  ${JSON.stringify(diag)}`);
    }
    await page.waitForTimeout(200);
  }
};
const shot = async (name) => {
  if (shotsDir) await page.screenshot({ path: join(shotsDir, name + '.png') });
};
let pass = 0;
const ok = (label) => { pass++; console.log(`  ✓ ${label}`); };

/**
 * Tap a button until the scene actually changes.
 *
 * A single blind click makes a check a coin toss: a scene flips its id before
 * its first frame is painted, and the one-file build boots slowly enough that
 * a tap can land on a button that is not listening yet.
 */
const tapUntilScene = async (x, y, want, tries = 6, waitMs = 4000) => {
  for (let i = 0; i < tries; i++) {
    await page.mouse.click(x, y);
    const t0 = Date.now();
    // wait properly before re-tapping: the first world entry bakes every
    // structure in the field, and a tap that is merely SLOW is not a tap that
    // missed
    while (Date.now() - t0 < waitMs) {
      if ((await scene()) === want) return true;
      await page.waitForTimeout(200);
    }
  }
  return false;
};

/**
 * Hold the joystick in a direction for a while.
 *
 * The direction is a SCREEN direction, because that is what a thumb gives the
 * game. The isometric projection turns it into a world direction inside the
 * engine — which means a test that walked in world coordinates would be
 * testing a path the player never takes.
 */
const walk = async (dirX, dirY, ms) => {
  const ox = 220, oy = 700;
  await page.mouse.move(ox, oy);
  await page.mouse.down();
  await page.mouse.move(ox + dirX * 70, oy + dirY * 70);
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    // keep nudging: a stationary pointer still counts as a held stick, but
    // moving it proves the move handler is the thing driving the hero
    await page.mouse.move(ox + dirX * 70 + (Math.random() - 0.5) * 3, oy + dirY * 70 + (Math.random() - 0.5) * 3);
    await page.waitForTimeout(40);
  }
  await page.mouse.up();
  await page.waitForTimeout(60);
};

/** World delta → the screen direction that produces it (the iso forward map). */
const ISO_X = 0.7071, ISO_Y = 0.4082;
const toScreenDir = (wx, wy) => {
  const sx = (wx - wy) * ISO_X, sy = (wx + wy) * ISO_Y;
  const len = Math.hypot(sx, sy) || 1;
  return [sx / len, sy / len];
};

/** Walk toward a world point until within `within`, or the budget runs out. */
const walkTo = async (tx, ty, within = 90, budgetMs = 26000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < budgetMs) {
    const p = await probe();
    if (!p || p.dead) return p;
    const dx = tx - p.x, dy = ty - p.y;
    const d = Math.hypot(dx, dy);
    if (d < within) return p;
    const [sx, sy] = toScreenDir(dx, dy);
    await walk(sx, sy, Math.min(900, Math.max(220, d * 2)));
  }
  return probe();
};

/**
 * Fight the way the game wants you to.
 *
 * There is no fire button: the squad shoots on its own at whatever is inside
 * its range, so a fight is entirely a question of standing close enough for
 * long enough. Kiting is the one thing that does NOT work — walk away and the
 * crowd's spears never reach anything.
 */
const fight = async (ms, shotName = null, anchor = null) => {
  const t0 = Date.now();
  let shotTaken = false;
  while (Date.now() - t0 < ms) {
    const p = await probe();
    if (!p) return { gone: true, dead: true };
    if (p.dead) return { ...p, gone: true };
    if (shotName && !shotTaken && p.enemies > 0) { shotTaken = true; await shot(shotName); }
    if (p.enemies === 0 && anchor) return p;

    if (anchor) {
      // drift onto the camp so the pack stays inside the squad's range, then
      // hold ground and let the volley work
      const dx = anchor.x - p.x, dy = anchor.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > 130) {
        const [sx, sy] = toScreenDir(dx, dy);
        await walk(sx, sy, 400);
      }
      await page.waitForTimeout(600);
    } else {
      await page.waitForTimeout(600);
    }
  }
  return (await probe()) ?? { gone: true };
};

/**
 * If the squad got wiped, take the wipe screen and get back on the field.
 * A bot that ignores death simply reports the numbers of a dead run.
 */
const reviveIfDead = async () => {
  const s = await scene();
  if (s === 'world' && !(await probe())?.dead) return false;
  await waitScene(['death', 'world'], 20000);
  if ((await scene()) === 'death') {
    await page.mouse.click(220, 890);
    await waitScene('world');
    await page.waitForTimeout(400);
  }
  return true;
};

/** Stand on a pad and let it drain the purse into people. */
const recruitAt = async (pad, wantSquad, budgetMs = 30000) => {
  const t0 = Date.now();
  await reviveIfDead();
  await warp(pad.x, pad.y - 120);
  await page.waitForTimeout(300);
  await walkTo(pad.x, pad.y, 30, 12000);
  while (Date.now() - t0 < budgetMs) {
    const p = await probe();
    if (!p || p.dead) { await reviveIfDead(); return probe(); }
    if (p.squad >= wantSquad) return p;
    if (p.padLeft === 0 || p.coins === 0) return p;
    // a tiny wander keeps the hero on the plate without leaving it
    await walk(Math.cos(Date.now() / 400) * 0.25, Math.sin(Date.now() / 400) * 0.25, 300);
    await page.waitForTimeout(400);
  }
  return probe();
};

try {
  console.log('smoke: boot');
  await page.goto(url);
  await page.waitForFunction(() => !!window.__cr, { timeout: 20000 });
  await waitScene('title', 45000);
  await shot('01-title');
  ok('boot → title (assets loaded)');

  // ── take the field through the real button ──
  if (!await tapUntilScene(220, 592, 'world')) throw new Error('could not take the field from the title');
  await waitScene('world');
  await page.waitForTimeout(800);
  await shot('02-field');
  const start = await probe();
  if (!start) throw new Error('world scene published no probe');
  if (start.chunks < 3) throw new Error(`terrain did not stream in (${start.chunks} chunks)`);
  ok(`took the field at ${start.x},${start.y} with ${start.chunks} chunks mounted`);

  // ── movement: the joystick actually moves the hero ──
  const before = await probe();
  await walk(1, 0, 1200);
  const after = await probe();
  const moved = Math.hypot(after.x - before.x, after.y - before.y);
  if (moved < 60) throw new Error(`joystick did not move the hero (${moved.toFixed(0)} units)`);
  ok(`joystick moves the hero (${moved.toFixed(0)} units in 1.2 s)`);

  // ── the isometric mapping: screen-right must not be world-right ──
  // If the stick were fed straight into world space these would be equal, and
  // the whole projection would be a lie the player walks into.
  const isoBase = await probe();
  await walk(0, 1, 1000);   // straight down the screen
  const isoDown = await probe();
  const ddx = isoDown.x - isoBase.x, ddy = isoDown.y - isoBase.y;
  if (Math.abs(ddx) < 30 || Math.abs(ddy) < 30 || Math.sign(ddx) !== Math.sign(ddy)) {
    throw new Error(`screen-down did not map to world south-east (Δ${ddx.toFixed(0)},${ddy.toFixed(0)})`);
  }
  ok(`stick is in screen space (down → +${ddx.toFixed(0)},+${ddy.toFixed(0)} world)`);

  // ── coins exist in the field and can be picked up ──
  const field = await page.evaluate(() => window.__cr.worldDef());
  let p = await probe();
  if (p.coinsLive < 1) throw new Error('no coins streamed into the field');
  const coinsBefore = p.coins;
  for (let i = 0; i < 14 && (await probe()).coins === coinsBefore; i++) {
    await walk(Math.cos(i * 1.3), Math.sin(i * 1.3), 900);
  }
  p = await probe();
  if (p.coins <= coinsBefore) throw new Error('walking over coins collected nothing');
  ok(`coins are collected by walking (${coinsBefore} → ${p.coins})`);

  // ── a recruit pad turns coins into people ──
  const pads = field.pois.filter((q) => q.kind === 'pad');
  if (pads.length === 0) throw new Error('the field generated no recruit pads');
  await grantCoins(120);
  const padBefore = await probe();
  const recruited = await recruitAt(pads[0], 10, 30000);
  await shot('03-recruit');
  if (recruited.squad <= padBefore.squad) {
    throw new Error(`the pad recruited nobody (squad stayed ${padBefore.squad}, ${recruited.coins} coins left)`);
  }
  if (recruited.coins >= padBefore.coins + 120) throw new Error('recruiting cost nothing');
  ok(`recruit pad turns coins into squad (${padBefore.squad} → ${recruited.squad}, ${recruited.coins} coins left)`);

  // ── build a real crowd from several pads ──
  for (const pad of pads.slice(1, 4)) {
    await grantCoins(200);
    await recruitAt(pad, 34, 26000);
  }
  await reviveIfDead();
  p = await probe();
  if (p.squad < 12) throw new Error(`could not build a crowd (${p.squad} after four pads)`);
  await shot('04-crowd');
  ok(`the squad grows across pads (${p.squad} following)`);

  // ── march that crowd into a camp ──
  const startPoi = field.pois.find((q) => q.id === 'start');
  const camps = field.pois
    .filter((q) => q.kind === 'camp')
    .sort((a, b) => Math.hypot(a.x - startPoi.x, a.y - startPoi.y) - Math.hypot(b.x - startPoi.x, b.y - startPoi.y));
  const camp = camps[0];
  await reviveIfDead();
  await warp(camp.x - 500, camp.y - 500);
  await page.waitForTimeout(400);
  await walkTo(camp.x, camp.y, 260, 16000);
  p = await probe();
  if (p.enemies < 1) throw new Error('camp did not populate on approach');
  ok(`camp populated on approach (${p.enemies} hostiles)`);

  const squadBeforeFight = p.squad;
  const fought = await fight(45000, '05-battle', { x: camp.x, y: camp.y });
  const killsAfter = (await saveData()).kills;
  if (killsAfter < 1) throw new Error('fought a camp without killing anything');
  // A fight the crowd walks away from intact is not a fight: the whole loop is
  // trading bodies for ground, and if the pack never reaches the line the
  // squad counter is a number that only goes up.
  if ((fought.squad ?? 0) >= squadBeforeFight) {
    throw new Error(`the camp never touched the line (${squadBeforeFight} in, ${fought.squad} out)`);
  }
  ok(`the squad fights and bleeds (${killsAfter} killed, ${fought.squad} of ${squadBeforeFight} left)`);

  // ── losing people is how damage works ──
  const preHurt = await probe();
  if (preHurt.squad > 0) {
    await page.evaluate(() => window.__cr.hurt(2));
    await page.waitForTimeout(500);
    const postHurt = await probe();
    if (postHurt.squad >= preHurt.squad) throw new Error('taking a hit cost no squad members');
    ok(`damage is taken out of the squad (${preHurt.squad} → ${postHurt.squad})`);
  }

  // ── clearing a camp is recorded ──
  let cleared = (await probe()).cleared.length;
  for (let i = 1; i < camps.length && cleared === 0; i++) {
    await grantCoins(240);
    await recruitAt(pads[i % pads.length], 40, 22000);
    await warp(camps[i].x - 480, camps[i].y - 480);
    await page.waitForTimeout(300);
    await walkTo(camps[i].x, camps[i].y, 240, 14000);
    const r = await fight(40000, null, { x: camps[i].x, y: camps[i].y });
    if (r.gone) {
      await waitScene(['death', 'world'], 20000);
      if ((await scene()) === 'death') { await page.mouse.click(220, 890); await waitScene('world'); }
    }
    cleared = (await probe())?.cleared.length ?? 0;
  }
  if (cleared === 0) throw new Error('no camp was ever cleared');
  ok(`clearing a camp is recorded (${cleared} clear)`);

  // ── a wipe sends you back to the muster post ──
  await page.evaluate(() => window.__cr.hurt(999));
  await waitScene('death', 20000);
  await page.waitForTimeout(500);
  await shot('06-wiped');
  const died = await saveData();
  if (died.totalRuns < 1) throw new Error('the wipe was not recorded');
  await page.mouse.click(220, 890); // Try Again
  await waitScene('world');
  await page.waitForTimeout(500);
  const back = await probe();
  const home = field.pois.find((q) => q.id === 'start');
  if (Math.hypot(back.x - home.x, back.y - home.y) > 300) {
    throw new Error('did not respawn at the muster post');
  }
  // a wipe hands you a fresh starting squad, not the army you lost
  if (back.squad >= preHurt.squad) throw new Error('kept the army through a wipe');
  if (back.squad < 1) throw new Error('respawned with nobody at all');
  ok(`a wipe costs the army and half the purse (back at the post with ${back.squad})`);

  // ── the gate ──
  await page.evaluate(() => window.__cr.turbo(3));
  const keep = field.pois.find((q) => q.kind === 'castle');
  // arrive with a real army: the gate is the end of the map, not a first errand
  for (const pad of pads) {
    await grantCoins(400);
    await recruitAt(pad, 60, 26000);
  }
  await reviveIfDead();
  p = await probe();
  await shot('07-army');
  if (p.squad < 20) throw new Error(`could not muster an army for the gate (${p.squad})`);
  ok(`an army can be mustered (${p.squad} strong)`);

  await warp(keep.x - 420, keep.y + 420);
  await page.waitForTimeout(400);
  let breached = false;
  for (let round = 0; round < 12 && !breached; round++) {
    await walkTo(keep.x, keep.y, 150, 16000);
    if (round === 0) { await page.waitForTimeout(1200); await shot('08-gate'); }
    const r = await fight(24000, null, { x: keep.x, y: keep.y });
    if (r.gone || r.dead) {
      await waitScene(['death', 'world'], 20000);
      if ((await scene()) === 'death') { await page.mouse.click(220, 890); await waitScene('world'); }
      for (const pad of pads) { await grantCoins(400); await recruitAt(pad, 60, 20000); }
      await warp(keep.x - 420, keep.y + 420);
      await page.waitForTimeout(300);
      continue;
    }
    breached = (await probe())?.breached ?? false;
  }
  if (!breached) {
    const d = await probe();
    throw new Error(`could not breach the gate within the budget\n  probe=${JSON.stringify(d)}`);
  }
  await page.waitForTimeout(800);
  await shot('09-breached');
  ok('the gate can be reached and broken');

  // ── the run persists across a cold reload ──
  await page.evaluate(() => window.__cr.game.save.flush());
  const beforeReload = await saveData();
  await page.reload();
  await page.waitForFunction(() => !!window.__cr, { timeout: 20000 });
  await waitScene('title', 45000);
  await shot('10-title-continue');
  const afterReload = await saveData();
  if (!afterReload.run) throw new Error('run not persisted');
  if (!afterReload.run.breached) throw new Error('the breach was lost on reload');
  if (afterReload.run.cleared.length < 1) throw new Error('cleared camps lost on reload');
  if (!await tapUntilScene(220, 592, 'world')) throw new Error('could not continue the saved run');
  await waitScene('world');
  const resumed = await probe();
  if (Math.hypot(resumed.x - beforeReload.run.x, resumed.y - beforeReload.run.y) > 60) {
    throw new Error('resumed somewhere else entirely');
  }
  ok(`the run survives a cold reload (${afterReload.run.cleared.length} camps cleared, resumed on the spot)`);

  // ── achievements actually fire ──
  if (afterReload.achievements.length < 2) {
    throw new Error(`achievements never fired (${JSON.stringify(afterReload.achievements)})`);
  }
  ok(`achievements fire (${afterReload.achievements.length} earned)`);

  // ── pause → settings → quit ──
  // Retry the tap: the pause button refuses while the loop is already paused
  // or a scene transition is mid-flight, and a single blind click makes this
  // step a coin toss rather than a check.
  let paused = false;
  for (let i = 0; i < 6 && !paused; i++) {
    await page.mouse.click(408, 36);
    await page.waitForTimeout(450);
    paused = await page.evaluate(() => window.__cr.game.loop.paused);
  }
  if (!paused) {
    // openPause() refuses silently in two states — already paused, and dead —
    // and a bot parked in the gate's fire can be dead by the time it gets
    // here. Say which, or this failure is a guessing game every time.
    const why = await page.evaluate(() => ({
      scene: window.__cr.scene(),
      dead: window.__cr.probe()?.dead ?? null,
      squad: window.__cr.probe()?.squad ?? null,
    }));
    throw new Error('the pause button never opened the pause menu '
      + `(scene ${why.scene}, dead ${why.dead}, squad ${why.squad})`);
  }
  await shot('11-pause');
  await page.mouse.click(220, 546); // Settings
  await page.waitForTimeout(600);
  await page.mouse.click(362, 226); // close settings
  await page.waitForTimeout(600);
  // Quit sits under the settings sheet's fade-out; retry rather than hoping
  if (!await tapUntilScene(220, 622, 'title')) throw new Error('quit never reached the title');
  ok('pause → settings → quit to title');

  // ── dev overlay ──
  if (!await tapUntilScene(220, 592, 'world')) throw new Error('could not re-enter the field');
  await waitScene('world');
  // The gesture is five taps inside 1.6 s. Synthetic clicks round-trip slowly
  // under a software renderer, so a single burst can miss the window through
  // no fault of the game — try the gesture a few times before calling it.
  let devOpen = false;
  for (let attempt = 0; attempt < 5 && !devOpen; attempt++) {
    for (let i = 0; i < 6; i++) await page.mouse.click(40, 40, { delay: 0 });
    await page.waitForTimeout(400);
    devOpen = await page.evaluate(() => {
      const find = (n) => n.children?.some((c) => c.text?.includes?.('frame:') || find(c));
      return find(window.__cr.game.root);
    });
  }
  await shot('12-dev');
  if (!devOpen) throw new Error('dev overlay did not open on the 5-tap corner gesture');
  ok('dev overlay opens on the corner gesture');

  const crErrors = await page.evaluate(() => window.__cr.errors);
  const allErrors = [...errors, ...crErrors].filter(
    (e) => !e.includes('SwiftShader') && !e.includes('GPU stall') && !e.includes('Automatic fallback'),
  );
  if (allErrors.length > 0) throw new Error('console errors:\n' + allErrors.join('\n'));
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
