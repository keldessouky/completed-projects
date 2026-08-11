#!/usr/bin/env node
/**
 * Headless smoke run: boots the built game in Chromium and drives the REAL UI
 * through a complete floor — title → floor map → tunnels, nests, loot boxes and
 * a safe room → boss → stairs → cleared — plus the death paths, mid-floor
 * resume, and a cold reload. Fails loudly on any console error.
 *
 * The bot taps actual node buttons at coordinates the floor map publishes; it
 * does not call into game logic to move itself. The only debug seams it uses
 * are ones a human cannot reach: turbo, and burning the floor clock to test
 * the seal.
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
const runState = () => page.evaluate(() => window.__cr.run());
const saveData = () => page.evaluate(() => window.__cr.save());
const nodes = () => page.evaluate(() => window.__cr.mapNodes());

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
        stats: window.__cr.stats(), run: window.__cr.run(), errs: window.__cr.errors.slice(0, 3),
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

/** One steering swipe. y=500 sits below the doors band and above every button. */
const drag = async (fromX, toX) => {
  await page.mouse.move(fromX, 500);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(fromX + ((toX - fromX) * i) / 6, 500 + i);
    await page.waitForTimeout(24);
  }
  await page.mouse.up();
};

/**
 * Play whatever encounter is on screen until it hands control back.
 * Oscillates like a distracted human and leans on the abilities when it can.
 */
const playEncounter = async (label, budgetMs = 120000, shotName = null) => {
  const t0 = Date.now();
  let sawBoss = false;
  let left = true;
  let firedAbility = false;
  let shotTaken = false;
  while (Date.now() - t0 < budgetMs) {
    await drag(left ? 120 : 320, left ? 320 : 120);
    left = !left;
    const s = await scene();
    if (s !== 'encounter') return { scene: s, sawBoss, firedAbility };
    const stats = await page.evaluate(() => window.__cr.stats());
    if ((stats.bossHp ?? -1) >= 0) sawBoss = true;
    // grab the frame while there is something to look at: a formed-up party in
    // a tunnel, or a boss that is still mostly alive
    const ready = label === 'boss' ? (stats.bossHp ?? -1) > 0.55 : stats.party > 8;
    if (shotName && !shotTaken && ready) { shotTaken = true; await shot(shotName); }
    // tap both ability buttons periodically; they no-op while on cooldown
    if (Date.now() - t0 > 3000) {
      await page.mouse.click(56, 900);
      await page.mouse.click(384, 900);
      firedAbility = true;
    }
  }
  throw new Error(`${label}: encounter never ended (budget ${budgetMs}ms)`);
};

/**
 * Route the floor. Prefers rooms that grow the party, saves the boss for last,
 * and takes the stairs the moment they open.
 */
const crawlFloor = async (budgetMs = 300000) => {
  const t0 = Date.now();
  const seen = { corridor: 0, mob: 0, loot: 0, safe: 0, boss: 0, backtrack: 0, abilities: false };
  while (Date.now() - t0 < budgetMs) {
    const s = await scene();
    if (s === 'clear' || s === 'death') return { end: s, seen };
    if (s !== 'floormap') { await waitScene(['floormap', 'clear', 'death'], 40000); continue; }

    const rs = await runState();
    const all = await nodes();
    const open = all.filter((n) => n.walkable);
    if (open.length === 0) {
      throw new Error(
        `stranded at ${rs?.at} with nowhere to walk\n  run=${JSON.stringify(rs)}\n  nodes=${JSON.stringify(all)}`,
      );
    }

    const fresh = open.filter((n) => !n.spent && n.kind !== 'boss');
    const rank = { corridor: 0, loot: 1, safe: 2, mob: 3 };
    fresh.sort((a, b) => (rank[a.kind] ?? 9) - (rank[b.kind] ?? 9));
    const boss = open.find((n) => n.kind === 'boss' && !n.spent);
    const deepest = [...open].sort((a, b) => b.layer - a.layer)[0];

    // Prove every room type before heading for the boss, but never at the cost
    // of the clock: under 150s left, the boss is the only thing that matters.
    const unseen = ['corridor', 'mob', 'loot', 'safe'].filter((k) => seen[k] === 0);
    const wanted = fresh.filter((n) => unseen.includes(n.kind));
    const stairs = open.find((n) => n.kind === 'stairs');

    let target;
    if (stairs) target = stairs;
    else if (boss && (rs.timeLeft < 150 || (unseen.length === 0 && rs.party >= 45) || fresh.length === 0)) target = boss;
    else if (wanted.length > 0) target = wanted[0];
    else if (fresh.length > 0) target = fresh[0];
    else if (boss) target = boss;
    else { target = deepest; seen.backtrack++; }

    if (target.kind !== 'stairs' && !target.spent) seen[target.kind] = (seen[target.kind] ?? 0) + 1;
    await page.mouse.click(target.x, target.y);
    await page.waitForTimeout(350);

    const after = await scene();
    if (after === 'encounter') {
      const r = await playEncounter(
        target.kind, 120000,
        target.kind === 'corridor' && seen.corridor === 1 ? '03-tunnel'
          : target.kind === 'boss' ? '03b-boss' : null,
      );
      if (r.firedAbility) seen.abilities = true;
      if (r.scene === 'death' || r.scene === 'clear') return { end: r.scene, seen };
    } else if (after === 'loot') {
      await page.waitForTimeout(500);
      await page.mouse.click(220, 886); // Continue
    } else if (after === 'safe') {
      await page.waitForTimeout(400);
      await page.mouse.click(312, 902); // Leave
    }
    await page.waitForTimeout(300);
  }
  throw new Error('floor never ended within budget');
};

try {
  console.log('smoke: boot');
  await page.goto(url);
  await page.waitForFunction(() => !!window.__cr, { timeout: 20000 });
  await waitScene('title', 45000);
  await shot('01-title');
  ok('boot → title (assets loaded)');

  // ── enter the dungeon through the real button ──
  await page.evaluate(() => window.__cr.turbo(7));
  await page.mouse.click(220, 588); // "Enter the Dungeon"
  await waitScene('floormap');
  await shot('02-floormap');
  const start = await runState();
  if (start.floor !== 0) throw new Error('did not enter floor 1');
  if (start.timeLeft < 400) throw new Error(`floor clock did not start full (${start.timeLeft})`);
  ok(`title → floor 1 map (clock ${Math.round(start.timeLeft)}s, ${(await nodes()).length} nodes)`);

  // ── the crawl ──
  const { end, seen } = await crawlFloor();
  await page.waitForTimeout(900);
  await shot('04-' + end);

  const save1 = await saveData();
  if (end !== 'clear') {
    throw new Error(`floor 1 must be clearable by an oscillating bot, but the run ended in "${end}"`);
  }
  if (!save1.cleared[0]) throw new Error('floor 1 clear not recorded in the save');
  if (save1.bestTime[0] <= 0) throw new Error('clear time not recorded');
  if (seen.boss < 1) throw new Error('floor cleared without fighting the boss');
  for (const kind of ['corridor', 'mob', 'loot', 'safe']) {
    if (seen[kind] < 1) throw new Error(`route never exercised a "${kind}" room`);
  }
  ok(`floor 1 cleared: ${Math.round(save1.bestTime[0])}s, ${save1.gold} gold, level ${save1.level}`);
  ok(`route: ${seen.corridor} tunnels, ${seen.mob} nests, ${seen.loot} boxes, ${seen.safe} safe rooms, ${seen.backtrack} backtracks`);
  if (!seen.abilities) throw new Error('ability buttons were never exercised');
  if (save1.level < 2) throw new Error(`no level gained across a whole floor (level ${save1.level})`);
  ok(`levelling works: level ${save1.level} with ${save1.points} unspent points`);
  if (save1.achievements.length === 0) throw new Error('no achievements unlocked on a full floor clear');
  ok(`achievements unlocked: ${save1.achievements.join(', ')}`);

  // ── character sheet: spend a point through the real UI ──
  await page.mouse.click(220, 890); // Continue → title
  await waitScene('title');
  await page.mouse.click(220, 676); // "Character"
  await waitScene('charsheet');
  await page.waitForTimeout(300);
  await shot('05-charsheet');
  // rows start at topY(12)+182 and step 62; the "+" is at x = W/2 + (W/2 - 44)
  const strBefore = (await saveData()).stats.str;
  const pointsBefore = (await saveData()).points;
  await page.mouse.click(396, 194); // Strength "+"
  await page.waitForTimeout(300);
  await page.mouse.click(396, 194 + 62); // Dexterity "+"
  await page.waitForTimeout(300);
  const after = await saveData();
  if (after.stats.str !== strBefore + 1) {
    throw new Error(`Strength did not increase (${strBefore} → ${after.stats.str})`);
  }
  if (after.points !== pointsBefore - 2) {
    throw new Error(`points not deducted (${pointsBefore} → ${after.points})`);
  }
  ok(`attribute points spent: STR ${after.stats.str}, DEX ${after.stats.dex}, ${after.points} left`);

  // ── mid-floor resume: walk into a floor, reload, continue where we stood ──
  await page.mouse.click(220, 906); // Back → title
  await waitScene('title');
  await page.mouse.click(220, 588); // Enter the Dungeon
  await waitScene('floormap');
  const first = (await nodes()).filter((n) => n.walkable && !n.spent)[0];
  await page.mouse.click(first.x, first.y);
  await page.waitForTimeout(400);
  if ((await scene()) === 'encounter') { await playEncounter('resume-seed', 90000); }
  const before = await runState();
  await page.evaluate(() => window.__cr.game.save.flush());
  await page.reload();
  await page.waitForFunction(() => !!window.__cr, { timeout: 20000 });
  await waitScene('title', 45000);
  await shot('06-resume-offer');
  const resumeSave = await saveData();
  if (!resumeSave.inProgress) throw new Error('in-progress floor was not persisted');
  await page.mouse.click(220, 588); // "Resume Crawl"
  await waitScene('floormap');
  const resumed = await runState();
  if (resumed.at !== before.at) throw new Error(`resumed at ${resumed.at}, expected ${before.at}`);
  if (Math.abs(resumed.timeLeft - before.timeLeft) > 2) {
    throw new Error(`clock drifted on resume: ${before.timeLeft} → ${resumed.timeLeft}`);
  }
  ok(`mid-floor resume restores position ${resumed.at} and the clock`);

  // ── the seal: burn the clock and confirm the floor kills you ──
  await page.evaluate(() => window.__cr.burnClock(100000));
  const openNode = (await nodes()).filter((n) => n.walkable && !n.spent)[0];
  await page.mouse.click(openNode.x, openNode.y);
  await waitScene('death', 40000);
  await page.waitForTimeout(600);
  await shot('07-death-timeout');
  const deaths = (await saveData()).totalDeaths;
  if (deaths < 1) throw new Error('timeout death not recorded');
  ok('running out of clock seals the floor and ends the run');

  // ── pause → settings → quit ──
  await page.mouse.click(220, 890); // Try Again → title
  await waitScene('title');
  await page.evaluate(() => window.__cr.turbo(1));
  await page.mouse.click(220, 588);
  await waitScene('floormap');
  const corridor = (await nodes()).find((n) => n.walkable && !n.spent && n.kind === 'corridor')
    ?? (await nodes()).filter((n) => n.walkable && !n.spent)[0];
  await page.mouse.click(corridor.x, corridor.y);
  await waitScene('encounter');
  await page.waitForTimeout(700);
  await page.mouse.click(402, 42); // pause
  await page.waitForTimeout(400);
  await shot('08-pause');
  await page.mouse.click(220, 546); // Settings
  await page.waitForTimeout(400);
  await shot('09-settings');
  await page.mouse.click(362, 226); // close settings
  await page.waitForTimeout(300);
  await page.mouse.click(220, 622); // Quit to Map
  await waitScene('floormap', 10000);
  ok('pause → settings → quit to floor map');

  // ── dev overlay: 5 taps in the top-left corner ──
  for (let i = 0; i < 5; i++) { await page.mouse.click(40, 40); await page.waitForTimeout(60); }
  await page.waitForTimeout(400);
  await shot('10-dev');
  const devOpen = await page.evaluate(() => {
    const find = (n) => n.children?.some((c) => c.text?.includes?.('frame:') || find(c));
    return find(window.__cr.game.root);
  });
  if (!devOpen) throw new Error('dev overlay did not open on the 5-tap corner gesture');
  await page.mouse.click(262, 116); // close
  await page.waitForTimeout(250);
  ok('dev overlay opens on the corner gesture');

  // ── cold reload keeps everything banked ──
  await page.evaluate(() => window.__cr.game.save.flush());
  await page.reload();
  await page.waitForFunction(() => !!window.__cr, { timeout: 20000 });
  await waitScene('title', 45000);
  const save2 = await saveData();
  if (!save2.cleared[0]) throw new Error('floor clear lost on reload');
  if (save2.level < save1.level) throw new Error('level lost on reload');
  if (save2.achievements.length < save1.achievements.length) throw new Error('achievements lost on reload');
  ok('save survives a cold reload');

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
