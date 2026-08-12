#!/usr/bin/env node
/**
 * Headless smoke run: boots the built game in Chromium and plays the REAL open
 * world — walks with the joystick, fights a camp, loots, equips, takes and
 * turns in a quest, buys from a vendor, uses a shrine, dies, respawns, and
 * kills the boss. Fails loudly on any console error.
 *
 * The bot moves by dragging on the canvas exactly like a thumb, and reads the
 * world through the same probe the dev overlay uses. The only seams it takes
 * that a human cannot are `turbo` and `warp` — a 5,120-unit world cannot be
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
/** Equipment count read from the save — the probe only exists inside the world. */
const equippedCount = async () => Object.keys((await saveData()).world?.equipped ?? {}).length;

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
 * Hold the joystick in a direction for a while. The stick is born wherever the
 * pointer lands in the lower part of the screen, so this is exactly the gesture
 * a thumb makes.
 */
const walk = async (dirX, dirY, ms) => {
  const ox = 220, oy = 700;
  await page.mouse.move(ox, oy);
  await page.mouse.down();
  await page.mouse.move(ox + dirX * 70, oy + dirY * 70);
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    // keep nudging: a stationary pointer still counts as a held stick, but
    // moving it proves the move handler is the thing driving the player
    await page.mouse.move(ox + dirX * 70 + (Math.random() - 0.5) * 3, oy + dirY * 70 + (Math.random() - 0.5) * 3);
    await page.waitForTimeout(40);
  }
  await page.mouse.up();
  await page.waitForTimeout(60);
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
    const len = d || 1;
    await walk(dx / len, dy / len, Math.min(900, Math.max(220, d * 2)));
  }
  return probe();
};

/**
 * Fight the way the game wants you to.
 *
 * The player out-runs every melee enemy and out-ranges every shooter, so the
 * shape of a fight is: hold your ground while the auto-attack works, and pull
 * out when health drops. Running constantly is the one thing that does NOT
 * work — you outrun your own attack range and nothing ever dies.
 */
const fight = async (ms, shotName = null, anchor = null) => {
  const t0 = Date.now();
  let shotTaken = false;
  let firedAbility = false;
  let tick = 0;
  while (Date.now() - t0 < ms) {
    const p = await probe();
    if (!p) return { gone: true, dead: true, firedAbility };
    if (p.dead) return { ...p, gone: true, firedAbility };
    if (shotName && !shotTaken && p.enemies > 0) { shotTaken = true; await shot(shotName); }
    if (p.enemies === 0 && anchor) return { ...p, firedAbility };
    tick++;

    // abilities every few beats — each click also lands in the stick zone, so
    // spamming them would fight the movement we are trying to make
    if (tick % 3 === 1) {
      await page.mouse.click(58, 894);   // Firecracker
      await page.mouse.click(382, 894);  // Second Wind
      firedAbility = true;
    }

    const hurt = p.hp / Math.max(1, p.maxHp) < 0.45;
    const outRange = anchor ? Math.hypot(p.x - anchor.x, p.y - anchor.y) : 0;
    // Retreat, but never past the point where the population despawns — a bot
    // that keeps running simply leaves the fight and the fight resets.
    if (hurt && anchor && outRange < 620) {
      const away = Math.atan2(p.y - anchor.y, p.x - anchor.x) || 0;
      await walk(Math.cos(away), Math.sin(away), 800);
    } else if (anchor) {
      // drift toward the camp so the pack stays inside attack range, then
      // stand still and let the auto-attack do its job
      const dx = anchor.x - p.x, dy = anchor.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > 150) await walk(dx / d, dy / d, 400);
      await page.waitForTimeout(650);
    } else {
      await page.waitForTimeout(650);
    }
  }
  return { ...((await probe()) ?? { gone: true }), firedAbility };
};

try {
  console.log('smoke: boot');
  await page.goto(url);
  await page.waitForFunction(() => !!window.__cr, { timeout: 20000 });
  await waitScene('title', 45000);
  await shot('01-title');
  ok('boot → title (assets loaded)');

  // ── enter the world through the real button ──
  await page.mouse.click(220, 574); // "Enter the Floor"
  await waitScene('world');
  await page.waitForTimeout(600);
  await shot('02-world');
  const start = await probe();
  if (!start) throw new Error('world scene published no probe');
  if (start.chunks < 4) throw new Error(`terrain did not stream in (${start.chunks} chunks)`);
  ok(`entered the world at ${start.x},${start.y} with ${start.chunks} chunks mounted`);

  // ── movement: the joystick actually moves the player ──
  const before = await probe();
  await walk(1, 0, 1200);
  const after = await probe();
  const moved = Math.hypot(after.x - before.x, after.y - before.y);
  if (moved < 60) throw new Error(`joystick did not move the player (${moved.toFixed(0)} units)`);
  ok(`joystick moves the player (${moved.toFixed(0)} units in 1.2 s)`);

  // ── talk to the quest broker and take a quest ──
  const world = await page.evaluate(() => window.__cr.worldDef());
  const broker = world.npcs.find((n) => n.id === 'broker');
  await walkTo(broker.x, broker.y, 40);
  let p = await probe();
  if (!p.interact || p.interact.id !== 'broker') {
    throw new Error(`no interact prompt beside the broker (got ${JSON.stringify(p.interact)})`);
  }
  await shot('03-town');
  await page.evaluate(() => window.__cr.interact());
  await page.waitForTimeout(500);
  await shot('04-dialogue');
  // "Accept: <first quest>" is the first button in the panel
  const accepted = await page.evaluate(() => {
    const before = window.__cr.probe().quests.filter((q) => q[1] === 'active').length;
    return before;
  });
  await page.mouse.click(220, 640);
  await page.waitForTimeout(400);
  await page.mouse.click(220, 706);
  await page.waitForTimeout(400);
  let active = (await probe()).quests.filter((q) => q[1] === 'active').length;
  if (active <= accepted) {
    // the button row shifts with how many quests are on offer; sweep it
    for (const y of [574, 640, 706, 772]) {
      await page.mouse.click(220, y);
      await page.waitForTimeout(300);
      active = (await probe()).quests.filter((q) => q[1] === 'active').length;
      if (active > accepted) break;
    }
  }
  if (active <= accepted) throw new Error('could not accept a quest from the broker');
  ok(`quest accepted through dialogue (${active} active)`);
  // close the dialogue: "Goodbye" is the last button
  for (const y of [838, 772, 706]) {
    await page.mouse.click(220, y);
    await page.waitForTimeout(250);
    if (!(await page.evaluate(() => window.__cr.game.loop.paused))) break;
  }

  // ── find a camp and clear it ──
  // the camp a new character would actually walk to: the closest one
  const town = world.pois.find((q) => q.id === 'town_a');
  const camp = world.pois
    .filter((q) => q.kind === 'camp')
    .sort((a, b) => Math.hypot(a.x - town.x, a.y - town.y) - Math.hypot(b.x - town.x, b.y - town.y))[0];
  await warp(camp.x, camp.y - 420);
  await page.waitForTimeout(400);
  await walkTo(camp.x, camp.y, 200, 14000);
  p = await probe();
  if (p.enemies < 1) throw new Error('camp did not populate on approach');
  ok(`camp populated on approach (${p.enemies} hostiles)`);

  const fought = await fight(40000, '05-combat', { x: camp.x, y: camp.y });
  const killsAfter = (await saveData()).kills;
  if (killsAfter < 1) throw new Error('fought a camp without killing anything');
  if (!fought.firedAbility) throw new Error('abilities were never exercised');
  ok(`combat works (${killsAfter} kills, ${(await probe()).hp} hp left)`);

  // ── loot ──
  let bagged = (await probe()).bag;
  if (bagged === 0) {
    // sweep the area for drops; gold auto-collects, gear needs walking over
    for (let i = 0; i < 8 && bagged === 0; i++) {
      await walk(Math.cos(i) * 0.8, Math.sin(i) * 0.8, 700);
      bagged = (await probe()).bag;
    }
  }
  // Gear is a 34% roll per kill, so one camp is not a guarantee. Clear more of
  // them until something drops: the equip path is worth proving every run.
  const camps = world.pois
    .filter((q) => q.kind === 'camp')
    .sort((a, b) => Math.hypot(a.x - town.x, a.y - town.y) - Math.hypot(b.x - town.x, b.y - town.y));
  for (let i = 1; i < camps.length && bagged === 0; i++) {
    await warp(camps[i].x, camps[i].y - 380);
    await page.waitForTimeout(400);
    await walkTo(camps[i].x, camps[i].y, 200, 14000);
    const r = await fight(30000, null, { x: camps[i].x, y: camps[i].y });
    if (r.gone) {
      await waitScene(['death', 'world'], 20000);
      if ((await scene()) === 'death') { await page.mouse.click(220, 890); await waitScene('world'); }
    }
    for (let sweep = 0; sweep < 6 && bagged === 0; sweep++) {
      await walk(Math.cos(sweep) * 0.85, Math.sin(sweep) * 0.85, 700);
      bagged = (await probe())?.bag ?? 0;
    }
  }
  const goldNow = (await saveData()).gold;
  if (goldNow <= 0 && bagged === 0) throw new Error('killing camps produced no loot at all');
  ok(`loot picked up (${goldNow} gold, ${bagged} items in the bag)`);

  // ── equip through the real inventory screen ──
  if (bagged > 0) {
    await page.mouse.click(404, 216); // bag button
    await waitScene('inventory');
    await page.waitForTimeout(300);
    await shot('06-inventory');
    // first bag row sits under the three equipped rows and the divider
    for (const y of [316, 372, 428, 484, 540]) {
      await page.mouse.click(374, y);
      await page.waitForTimeout(250);
      if ((await equippedCount()) > 0) break;
    }
    const eq = await equippedCount();
    if (eq < 1) throw new Error('could not equip anything from the bag');
    ok(`gear equipped from the bag (${eq} slot${eq === 1 ? '' : 's'} filled)`);
    await page.mouse.click(220, 880); // Back
    await waitScene('world');
  } else {
    throw new Error('no gear dropped across every camp — the loot path is broken');
  }

  // ── a shrine grants a permanent point ──
  const shrine = world.pois
    .filter((q) => q.kind === 'shrine')
    .sort((a, b) => Math.hypot(a.x - town.x, a.y - town.y) - Math.hypot(b.x - town.x, b.y - town.y))[0];
  await warp(shrine.x, shrine.y - 150);
  await page.waitForTimeout(300);
  await walkTo(shrine.x, shrine.y, 34, 12000);
  const ptsBefore = (await saveData()).points;
  await page.evaluate(() => window.__cr.interact());
  await page.waitForTimeout(400);
  const ptsAfter = (await saveData()).points;
  if (ptsAfter <= ptsBefore) throw new Error('shrine granted nothing');
  ok(`shrine grants an attribute point (${ptsBefore} → ${ptsAfter})`);

  // ── spend it on the real character sheet ──
  await page.mouse.click(404, 276); // char button
  await waitScene('charsheet');
  await page.waitForTimeout(300);
  await shot('07-charsheet');
  const strBefore = (await saveData()).stats.str;
  await page.mouse.click(396, 194);
  await page.waitForTimeout(300);
  if ((await saveData()).stats.str !== strBefore + 1) {
    throw new Error(`spending an attribute point did not take (str stayed ${strBefore})`);
  }
  ok(`attribute point spent (STR ${strBefore} → ${strBefore + 1})`);
  await page.mouse.click(220, 906); // Back
  await waitScene('world');

  // ── the journal reflects the world ──
  await page.mouse.click(404, 336); // journal button
  await waitScene('journal');
  await page.waitForTimeout(400);
  await shot('08-journal');
  await page.mouse.click(220, 178); // "Places" tab
  await page.waitForTimeout(300);
  await shot('09-journal-places');
  await page.mouse.click(220, 880);
  await waitScene('world');
  ok('journal opens and lists quests and discovered places');

  // ── vendor ──
  const qm = world.npcs.find((n) => n.id === 'quartermaster');
  await warp(qm.x, qm.y - 150);
  await page.waitForTimeout(300);
  await walkTo(qm.x, qm.y, 40, 12000);
  await page.evaluate(() => window.__cr.interact());
  await page.waitForTimeout(400);
  for (const y of [706, 772, 640, 838]) {
    await page.mouse.click(220, y);
    await page.waitForTimeout(350);
    if ((await scene()) === 'shop') break;
  }
  if ((await scene()) !== 'shop') throw new Error('could not open the vendor');
  await page.waitForTimeout(300);
  await shot('10-shop');
  await page.mouse.click(220, 880); // Leave
  await waitScene('world');
  ok('vendor opens from dialogue and closes back to the world');

  // ── death and respawn ──
  await page.evaluate(() => window.__cr.hurt(100000));
  await waitScene('death', 20000);
  await page.waitForTimeout(500);
  await shot('11-death');
  const died = await saveData();
  if (died.totalDeaths < 1) throw new Error('death not recorded');
  await page.mouse.click(220, 890); // Get Up
  await waitScene('world');
  await page.waitForTimeout(400);
  const back = await probe();
  if (back.hp <= 0) throw new Error('respawned dead');
  ok(`death costs gold and respawns you whole (${back.hp} hp at home)`);

  // ── the boss ──
  await page.evaluate(() => window.__cr.turbo(3));
  const lair = world.pois.find((q) => q.kind === 'lair');
  // arrive strong: the Depot is an end-game fight, not a first errand
  await page.evaluate(() => { window.__cr.grantLevels(14); });
  await warp(lair.x, lair.y - 700);
  await page.waitForTimeout(400);
  await walkTo(lair.x, lair.y - 260, 120, 16000);
  p = await probe();
  if (p.enemies < 1) throw new Error('the lair did not populate');
  let bossDown = false;
  let bossShot = false;
  for (let round = 0; round < 10 && !bossDown; round++) {
    // re-approach every round: a fight that drifted apart has to be restarted
    await walkTo(lair.x, lair.y - 200, 170, 14000);
    if (!bossShot) {
      // in the yard, mid-fight: the frame worth keeping
      await walkTo(lair.x, lair.y - 90, 110, 12000);
      await page.waitForTimeout(1200);
      await shot('12-boss');
      bossShot = true;
    }
    const r = await fight(30000, null, { x: lair.x, y: lair.y });
    if (r.gone || r.dead) {
      await waitScene(['death', 'world'], 20000);
      if ((await scene()) === 'death') { await page.mouse.click(220, 890); await waitScene('world'); }
      await warp(lair.x, lair.y - 700);
      await page.waitForTimeout(300);
      await walkTo(lair.x, lair.y - 260, 140, 16000);
      continue;
    }
    bossDown = (await probe())?.bossDown ?? false;
  }
  if (!bossDown) {
    const d = await probe();
    const sv = await saveData();
    throw new Error(
      `could not kill the boss within the budget\n  probe=${JSON.stringify(d)}` +
      `\n  level=${sv.level} stats=${JSON.stringify(sv.stats)} deaths=${sv.totalDeaths}`,
    );
  }
  await page.waitForTimeout(700);
  await shot('13-boss-down');
  ok('the boss can be found and killed');

  // ── the world persists across a cold reload ──
  await page.evaluate(() => window.__cr.game.save.flush());
  const beforeReload = await saveData();
  await page.reload();
  await page.waitForFunction(() => !!window.__cr, { timeout: 20000 });
  await waitScene('title', 45000);
  await shot('14-title-continue');
  const afterReload = await saveData();
  if (!afterReload.world) throw new Error('world not persisted');
  if (afterReload.world.discovered.length < 2) throw new Error('discoveries lost on reload');
  if (afterReload.level < beforeReload.level) throw new Error('level lost on reload');
  if (!afterReload.world.bossDown) throw new Error('boss kill lost on reload');
  await page.mouse.click(220, 574); // Continue
  await waitScene('world');
  const resumed = await probe();
  if (Math.hypot(resumed.x - beforeReload.world.x, resumed.y - beforeReload.world.y) > 40) {
    throw new Error('resumed somewhere else entirely');
  }
  ok(`world survives a cold reload (${afterReload.world.discovered.length} places, resumed on the spot)`);

  // ── pause → settings → quit ──
  await page.mouse.click(408, 34);
  await page.waitForTimeout(400);
  await shot('15-pause');
  await page.mouse.click(220, 546); // Settings
  await page.waitForTimeout(400);
  await page.mouse.click(362, 226); // close settings
  await page.waitForTimeout(300);
  await page.mouse.click(220, 622); // Quit
  await waitScene('title', 10000);
  ok('pause → settings → quit to title');

  // ── dev overlay ──
  await page.mouse.click(220, 574);
  await waitScene('world');
  for (let i = 0; i < 5; i++) { await page.mouse.click(40, 40); await page.waitForTimeout(60); }
  await page.waitForTimeout(400);
  await shot('16-dev');
  const devOpen = await page.evaluate(() => {
    const find = (n) => n.children?.some((c) => c.text?.includes?.('frame:') || find(c));
    return find(window.__cr.game.root);
  });
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
