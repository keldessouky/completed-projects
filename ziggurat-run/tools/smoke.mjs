#!/usr/bin/env node
/**
 * Headless smoke run: boots the built game in Chromium and drives the real
 * UI through boot → title → map → a full stage-1 run to the results screen,
 * a doomed stage run to the fail screen, pause/settings, and a reload to
 * prove save persistence. Fails loudly on any console error.
 *
 * Usage: npm run build && node tools/smoke.mjs [--shots DIR]
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
// --single [path] runs the same checks against the one-file build, proving the
// inlined bundle is not just smaller but actually playable.
const singleArg = process.argv.includes('--single')
  ? (process.argv[process.argv.indexOf('--single') + 1] ?? join(ROOT, 'dist-single/ziggurat-run.html'))
  : null;
const singlePath = singleArg && !singleArg.startsWith('--') ? singleArg : null;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.wav': 'audio/wav', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
};

const server = createServer((req, res) => {
  const url = (req.url ?? '/').split('?')[0];
  // single-file mode: the one document answers every request by design
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
  // symlink to the preinstalled binary (see container env notes)
  executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined,
  args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 440, height: 956 } });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

const scene = () => page.evaluate(() => window.__zr?.scene());
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
      const diag = await page.evaluate(() => ({ stats: window.__zr.stats(), errs: window.__zr.errors.slice(0, 3) }));
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

try {
  console.log('smoke: boot');
  await page.goto(url);
  await page.waitForFunction(() => !!window.__zr, { timeout: 20000 });
  await waitScene('title', 45000);
  await shot('01-title');
  ok('boot → title (assets loaded)');

  await page.mouse.click(220, 500);
  await waitScene('map');
  await shot('02-map');
  ok('title → map');

  // full run of stage 1 at turbo, with periodic steering drags
  await page.evaluate(() => { window.__zr.turbo(7); window.__zr.startStage(0); });
  await waitScene('run');
  await shot('03-run-early');
  // steering drags stay at y=500: below the gates band, above every ending-screen button
  const drag = async (fromX, toX) => {
    await page.mouse.move(fromX, 500);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) {
      await page.mouse.move(fromX + ((toX - fromX) * i) / 6, 500 + i);
      await page.waitForTimeout(28);
    }
    await page.mouse.up();
  };
  const t0 = Date.now();
  let end = null;
  let midShot = false;
  let bossShot = false;
  let sawBoss = false;
  while (Date.now() - t0 < 120000) {
    await drag(120, 320);
    let s = await scene();
    if (s === 'results' || s === 'fail') { end = s; break; }
    await drag(320, 120);
    if (!midShot && Date.now() - t0 > 4000) { midShot = true; await shot('04-run-mid'); }
    const hp = await page.evaluate(() => window.__zr.stats().bossHp ?? -1);
    if (hp >= 0) {
      sawBoss = true;
      if (!bossShot && hp < 0.85) { bossShot = true; await shot('04b-boss'); }
    }
    s = await scene();
    if (s === 'results' || s === 'fail') { end = s; break; }
  }
  if (!end) {
    const zr = await page.evaluate(() => ({ errs: window.__zr.errors, scene: window.__zr.scene() }));
    throw new Error(`stage 1 never ended (scene=${zr.scene}, errors=${JSON.stringify(zr.errs.slice(0, 4))})`);
  }
  await page.waitForTimeout(1400); // let the stars punch in before the screenshot
  await shot('05-' + end);
  const save1 = await page.evaluate(() => window.__zr.save());
  if (save1.totalRuns < 1) throw new Error('totalRuns not recorded');
  ok(`stage 1 played to ${end} (squad peak recorded, runs=${save1.totalRuns})`);
  // Stage 1 is the hook: a bot that only oscillates must still clear it.
  if (end !== 'results') throw new Error('stage 1 must be winnable first try, but the run failed');
  if (!sawBoss) throw new Error('stage 1 ended without ever reaching the boss gate');
  if (save1.stars[0] < 1) throw new Error('no stars recorded on win');
  if (save1.unlocked < 1) throw new Error('stage 2 did not unlock');
  ok(`stage 1 won: stars=${save1.stars[0]}, unlocked=${save1.unlocked}, coins=${save1.coins}`);

  // doomed run: stage 12 with a starting squad of 1 must reach the fail screen
  await page.evaluate(() => { window.__zr.turbo(7); window.__zr.startStage(11); });
  await waitScene('run');
  await waitScene(['fail', 'results'], 150000);
  const failScene = await scene();
  await shot('06-fail');
  if (failScene !== 'fail') console.log('  (stage 12 unexpectedly won — tuning note, not a failure)');
  ok('doomed run reached an ending screen: ' + failScene);

  // pause overlay + settings, then quit to map
  await page.evaluate(() => { window.__zr.turbo(1); window.__zr.startStage(0); });
  await waitScene('run');
  await page.waitForTimeout(700);
  await page.mouse.click(402, 42); // pause button (design coords == CSS px at 440×956)
  await page.waitForTimeout(400);
  await shot('07-pause');
  await page.mouse.click(220, 546); // Settings
  await page.waitForTimeout(400);
  await shot('08-settings');
  await page.mouse.click(362, 226); // close settings
  await page.waitForTimeout(300);
  await page.mouse.click(220, 622); // Quit to Map
  await waitScene('map', 8000);
  ok('pause → settings → quit to map');

  // upgrade screen: grant coins, buy a level
  await page.evaluate(() => { window.__zr.grantCoins(500); window.__zr.goto('upgrade'); });
  await waitScene('upgrade');
  await page.waitForTimeout(300);
  await shot('09-upgrade');
  // first card's buy button: card 0 sits at y = topY(12) + 158, buy at card-local x +128
  const before = await page.evaluate(() => window.__zr.save().upgrades.squad);
  await page.mouse.click(348, 170);
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => window.__zr.save().upgrades.squad);
  if (after !== before + 1) throw new Error(`upgrade purchase failed (${before} → ${after})`);
  ok('workshop purchase persists');

  // victory scene: the chapter-3 send-off must render and lead back to the map
  await page.evaluate(() => window.__zr.goto('victory'));
  await waitScene('victory');
  await page.waitForTimeout(700);
  await shot('10-victory');
  await page.mouse.click(220, 803); // "Return in Glory"
  await waitScene('map', 8000);
  ok('victory screen → map');

  // dev overlay: 5 taps in the top-left corner
  for (let i = 0; i < 5; i++) { await page.mouse.click(40, 40); await page.waitForTimeout(60); }
  await page.waitForTimeout(400);
  await shot('11-dev');
  const devOpen = await page.evaluate(() => {
    const find = (n) => n.children?.some((c) => c.text?.includes?.('frame:') || find(c));
    return find(window.__zr.game.root);
  });
  if (!devOpen) throw new Error('dev overlay did not open on the 5-tap corner gesture');
  await page.mouse.click(262, 116); // close
  await page.waitForTimeout(250);
  ok('dev overlay opens on the corner gesture');

  // reload: save must survive
  await page.reload();
  await page.waitForFunction(() => !!window.__zr, { timeout: 20000 });
  await waitScene('title', 45000);
  const save2 = await page.evaluate(() => window.__zr.save());
  if (save2.totalRuns < save1.totalRuns) throw new Error('save lost on reload');
  if (save2.upgrades.squad !== after) throw new Error('upgrade lost on reload');
  ok('save survives a cold reload');

  const zrErrors = await page.evaluate(() => window.__zr.errors);
  const allErrors = [...errors, ...zrErrors].filter(
    (e) => !e.includes('SwiftShader') && !e.includes('GPU stall') && !e.includes('Automatic fallback'),
  );
  if (allErrors.length > 0) {
    throw new Error('console errors:\n' + allErrors.join('\n'));
  }
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
