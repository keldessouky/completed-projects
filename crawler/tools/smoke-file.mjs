#!/usr/bin/env node
/**
 * Open the one-file build the way a PLAYER opens it: straight off the disk,
 * on a `file://` URL, with no server anywhere.
 *
 * This exists because `npm run smoke:single` does not test that. It serves the
 * bundle over HTTP, which is a different origin class with different rules —
 * and the difference hid a total failure: the build inlined an ES module, and
 * WebKit blocks module scripts from `file://`, so on iOS the page sat on its
 * static HTML splash forever and the game never started. Every automated check
 * passed the whole time, because every automated check used a web server.
 *
 * The rule this encodes: if the deliverable is "a file you double-click", then
 * double-clicking the file is the thing that has to be tested.
 *
 * Usage: node tools/smoke-file.mjs [path-to-crawler.html]
 */
import { existsSync, realpathSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = resolve(process.argv[2] ?? join(ROOT, 'dist-single/crawler.html'));
if (!existsSync(FILE)) {
  console.error(`no such file: ${FILE}\n  run: npm run build && npm run build:single`);
  process.exit(1);
}

const browser = await chromium.launch({
  executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined,
  args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader'],
});
// A phone-shaped viewport, because that is what this build is for.
const page = await browser.newPage({ viewport: { width: 440, height: 956 } });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

const url = pathToFileURL(realpathSync(FILE)).href;
console.log(`opening  ${url}`);
await page.goto(url);

let pass = 0;
const ok = (s) => { pass++; console.log(`  ✓ ${s}`); };
const fail = (s) => { console.error(`\nFILE SMOKE FAIL: ${s}`); throw new Error(s); };

try {
  // 1. the module actually executed at all
  const started = await page.waitForFunction(() => !!window.__cr, { timeout: 30000 })
    .then(() => true).catch(() => false);
  if (!started) {
    fail('the bundle never executed — window.__cr was never defined.\n'
      + '  This is the file:// module block: a classic <script> is required, not type="module".');
  }
  ok('the bundle executes from file:// (window.__cr exists)');

  // 2. it got past the static splash and off the boot scene
  const reached = await page.waitForFunction(
    () => window.__cr?.scene?.() === 'title', { timeout: 60000 },
  ).then(() => true).catch(() => false);
  if (!reached) {
    const s = await page.evaluate(() => window.__cr?.scene?.() ?? null);
    fail(`never reached the title screen (stuck at scene "${s}")`);
  }
  ok('boot completes and reaches the title');

  // 3. the pre-JS splash is gone — the thing the player was staring at
  const splashGone = await page.evaluate(() => {
    const el = document.getElementById('splash');
    if (!el) return true;
    const cs = getComputedStyle(el);
    return cs.display === 'none' || Number(cs.opacity) < 0.05;
  });
  if (!splashGone) fail('the static #splash is still covering the page');
  ok('the static splash has handed over to the engine');

  // 4. something is actually on the canvas
  const painted = await page.evaluate(() => {
    const c = document.querySelector('#app canvas');
    return !!c && c.width > 0 && c.height > 0;
  });
  if (!painted) fail('no sized canvas in #app — the renderer never came up');
  ok('the renderer has a live canvas');

  // 5. and it can start a run
  await page.evaluate(() => window.__cr.enterWorld(true));
  const inWorld = await page.waitForFunction(
    () => window.__cr?.scene?.() === 'world', { timeout: 30000 },
  ).then(() => true).catch(() => false);
  if (!inWorld) fail('could not enter the world from file://');
  const p = await page.evaluate(() => window.__cr.probe());
  if (!p) fail('entered the world but the probe is empty');
  ok(`a run starts (${p.squad} in the crew, ${p.chunks} chunks mounted)`);

  const real = errors.filter((e) => !/favicon|404/i.test(e));
  if (real.length) fail(`console errors:\n  ${real.slice(0, 4).join('\n  ')}`);
  ok('zero console errors');

  console.log(`\nFILE SMOKE PASS — ${pass} checks green`);
  await browser.close();
  process.exit(0);
} catch (err) {
  if (errors.length) console.error('\nconsole:\n  ' + errors.slice(0, 6).join('\n  '));
  console.error(String(err.message ?? err));
  await browser.close();
  process.exit(1);
}
