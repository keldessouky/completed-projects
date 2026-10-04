// `npm run smoke:mobile`: plays the built game as a phone would, by touch.
//
//   SMOKE_DEVICE=iphone (default) | android      which phone to emulate
//   SMOKE_BROWSER=chromium (default) | webkit     webkit is Safari's engine (macOS CI)
//
// It checks the phone layout (panes, bottom tabs, safe areas, nothing wider
// than the screen), types code with the on-screen coding keys, taps a name for
// its type, runs, swipes arcade cards, switches colour profiles, and proves the
// home-screen web app installs (manifest + icons) and plays offline.
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices, webkit } from 'playwright-core';
import { startServer } from './server.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shots = join(root, 'test-results', 'mobile');
mkdirSync(shots, { recursive: true });
if (!existsSync(join(root, 'dist', 'index.html'))) {
  console.error('Build first: npm run build');
  process.exit(1);
}

const which = process.env.SMOKE_DEVICE === 'android' ? 'android' : 'iphone';
const device = which === 'android' ? devices['Pixel 7'] : devices['iPhone 15 Pro'];
const engine = process.env.SMOKE_BROWSER === 'webkit' ? webkit : chromium;
const tag = `${which}-${engine.name()}`;

async function launch() {
  if (engine === webkit) return webkit.launch();
  const explicit = process.env.CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  if (explicit) return chromium.launch({ executablePath: explicit });
  try {
    return await chromium.launch();
  } catch {
    return chromium.launch({ channel: 'chrome' });
  }
}

const browser = await launch();
const { server, url } = await startServer({ root: join(root, 'dist'), port: 4395, quiet: true });
const context = await browser.newContext({ ...device, serviceWorkers: 'allow' });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

let failures = 0;
const results = [];
async function step(name, fn) {
  const t = Date.now();
  try {
    await fn();
    results.push(`  ✓ ${name} (${Date.now() - t} ms)`);
  } catch (e) {
    failures++;
    await page.screenshot({ path: join(shots, `${tag}-fail-${failures}.png`) }).catch(() => {});
    results.push(`  ✗ ${name}\n      ${String(e.message ?? e).split('\n').slice(0, 6).join('\n      ')}`);
  }
  console.log(results.at(-1));
}
const shot = (name) => page.screenshot({ path: join(shots, `${tag}-${name}.png`) });
const doc = () => page.locator('.cm-content').evaluate((el) => [...el.querySelectorAll('.cm-line')].map((l) => l.textContent).join('\n'));
const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
async function noOverflow(where) {
  const o = await overflow();
  if (o > 1) throw new Error(`${where} is ${o}px wider than the phone's screen`);
}
const visible = (sel) => page.locator(sel).first().isVisible();
/** Close THE FEED's cards so they don't sit over what we tap. */
async function clearNotes() {
  for (let i = 0; i < 30 && (await page.locator('.note-close').count()); i++) await page.locator('.note-close').first().tap({ timeout: 2000 }).catch(() => {});
}
/** A finger dragging across an element (synthetic touch pointer events). */
async function swipe(selector, dx, { release = true } = {}) {
  await page.locator(selector).evaluate(
    async (el, { dx, release }) => {
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const frame = () => new Promise((done) => requestAnimationFrame(() => done()));
      const ev = (type, cx) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: cx, clientY: y }));
      ev('pointerdown', x);
      for (let i = 1; i <= 6; i++) {
        await frame();
        ev('pointermove', x + (dx * i) / 6);
      }
      await frame();
      if (release) ev('pointerup', x + dx);
    },
    { dx, release },
  );
}

console.log(`Playing as ${device.userAgent.includes('iPhone') ? 'an iPhone 15 Pro' : 'a Pixel 7'} (${device.viewport.width}×${device.viewport.height}) in ${engine.name()}`);

await step('Title screen fits the phone; the 🎨 button sits top right, inside the safe area', async () => {
  await page.goto(url);
  await page.getByRole('button', { name: 'Begin' }).waitFor();
  const b = await page.getByRole('button', { name: /Colour profile/ }).boundingBox();
  if (!b || b.x + b.width > device.viewport.width || b.y < 0 || b.x < device.viewport.width / 2) throw new Error(`theme button misplaced: ${JSON.stringify(b)}`);
  await noOverflow('the title screen');
  await shot('01-title');
});

await step('Begin → a level laid out as panes: Mission first, with Run always in reach', async () => {
  await page.getByRole('button', { name: 'Begin' }).tap();
  await page.getByLabel('Your name').fill('Thumbs');
  await page.getByRole('button', { name: 'Go live' }).tap();
  await page.waitForURL(/#\/level\/hello-world/);
  await page.locator('.pane-bar').waitFor();
  if (!(await visible('.brief')) || (await visible('.work'))) throw new Error('the Mission pane should be the only one showing');
  if (!(await page.locator('.run-fab').isVisible())) throw new Error('Run should be in the pane bar');
  if (!(await page.locator('.tabbar').isVisible())) throw new Error('the bottom tab bar is missing');
  await noOverflow('the level screen');
  await shot('02-mission');
});

await step('Code pane: the coding keys type brackets and quotes (auto-closed) for you', async () => {
  await page.getByRole('tab', { name: /Code/ }).tap();
  await page.waitForFunction(() => !document.body.textContent?.includes('Loading compiler…'), null, { timeout: 30_000 });
  await page.locator('.cm-content').tap();
  await page.locator('.keybar').waitFor();
  const mod = (await page.evaluate(() => /Mac|iPhone|iPad/.test(navigator.platform))) ? 'Meta' : 'Control';
  await page.keyboard.press(`${mod}+A`);
  await page.keyboard.press('Backspace');
  await page.keyboard.insertText('console.log');
  const key = (label) => page.locator('.keybar').getByRole('button', { name: label, exact: true }).tap();
  await key('(');
  await key('"');
  await page.keyboard.insertText('Hello, Orrery');
  await key('Cursor right');
  await key('Cursor right');
  await key(';');
  const got = await doc();
  if (got !== 'console.log("Hello, Orrery");') throw new Error(`typed ${JSON.stringify(got)}`);
  await page.locator('.keybar-keys').evaluate((el) => (el.scrollLeft = 0));
  await shot('03-keybar');
});

await step('Tapping a name shows its type (phones have no hover)', async () => {
  await page.locator('.cm-content').getByText('console', { exact: false }).first().tap({ position: { x: 4, y: 6 } });
  const info = page.locator('.tap-info');
  await info.waitFor({ timeout: 10_000 });
  const text = (await info.textContent()) ?? '';
  if (!/console/i.test(text)) throw new Error(`tap info said: ${text}`);
});

await step('▶ Run wins the level; the victory card fits the screen', async () => {
  await page.locator('.run-fab').tap();
  await page.locator('.victory').waitFor({ timeout: 15_000 });
  const b = await page.locator('.victory').boundingBox();
  if (!b || b.width > device.viewport.width) throw new Error('victory card wider than the screen');
  await page.waitForTimeout(700);
  await shot('04-victory');
  await page.getByRole('button', { name: /Next system/ }).tap();
  await page.waitForURL(/#\/level\/strings/);
});

await step('A failing Run jumps to the Checks pane and says what is wrong', async () => {
  await clearNotes();
  await page.locator('.run-fab').tap();
  await page.locator('.checks li.fail').first().waitFor({ timeout: 15_000 });
  if (!(await visible('.results')) || (await visible('.work'))) throw new Error('should be showing the Checks pane');
  await shot('05-checks');
});

await step('Bottom tabs reach every section; nothing is wider than the screen', async () => {
  for (const [tab, re, sel] of [['Map', /#\/map/, '.deck'], ['Arcade', /#\/arcade/, '.arcade'], ['Loot', /#\/loot/, '.loot-screen'], ['Shop', /#\/shop/, '.shop'], ['You', /#\/character/, '.character']]) {
    await page.locator('.tabbar').getByRole('button', { name: new RegExp(tab) }).tap();
    await page.waitForURL(re);
    await page.locator(sel).first().waitFor();
    await noOverflow(`the ${tab} screen`);
    if (tab === 'Map') {
      await clearNotes();
      await shot('06-map');
    }
  }
});

await step('Arcade: swipe right for "compiles", left for "type error"', async () => {
  await page.locator('.tabbar').getByRole('button', { name: /Arcade/ }).tap();
  await page.getByRole('button', { name: /Start/ }).tap();
  await page.locator('.arcade-card pre.code').waitFor();
  await swipe('.arcade-card', 140, { release: false });
  await page.locator('.swipe-stamp.yes').waitFor();
  await shot('07-swipe');
  await page.locator('.arcade-card').evaluate((el) => el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7, pointerType: 'touch' })));
  await page.locator('.arcade-card .explain').waitFor();
  // A short swipe is not an answer.
  if (await page.locator('.arcade-card.wrong').count()) await page.getByRole('button', { name: /Next card/ }).tap();
  else await page.waitForTimeout(1000);
  await page.locator('.arcade-card:not(.right):not(.wrong)').waitFor();
  await swipe('.arcade-card', -40);
  await page.waitForTimeout(300);
  if (await page.locator('.arcade-card .explain').count()) throw new Error('a 40px nudge should not count as an answer');
  await swipe('.arcade-card', -140);
  await page.locator('.arcade-card .explain').waitFor();
});

await step('Colour profiles: the menu fits the phone and a tap switches the whole game', async () => {
  await page.locator('.tabbar').getByRole('button', { name: /Map/ }).tap();
  await page.getByRole('button', { name: /Colour profile/ }).tap();
  const m = await page.locator('.theme-menu').boundingBox();
  if (!m || m.x < 0 || m.x + m.width > device.viewport.width) throw new Error(`theme menu off screen: ${JSON.stringify(m)}`);
  await page.getByRole('radio', { name: /GitHub Light/ }).tap();
  if ((await page.evaluate(() => document.documentElement.dataset.theme)) !== 'github-light') throw new Error('profile did not switch');
  const lum = await page.evaluate(() => {
    const [r, g, b] = getComputedStyle(document.querySelector('main')).backgroundColor === 'rgba(0, 0, 0, 0)'
      ? getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number)
      : getComputedStyle(document.querySelector('main')).backgroundColor.match(/\d+/g).map(Number);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  });
  if (lum < 0.8) throw new Error(`the page behind the game should be light, luminance ${lum.toFixed(2)}`);
  const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
  if (themeColor !== '#f0f3f6') throw new Error(`theme-color should follow the profile, is ${themeColor}`);
  await shot('08-light');
  await page.getByRole('button', { name: /Colour profile/ }).tap();
  await page.getByRole('radio', { name: /^Reactor/ }).tap();
});

await step('Landscape: the level still fits', async () => {
  await page.setViewportSize({ width: device.viewport.height, height: device.viewport.width });
  try {
    await page.goto(`${url}#/level/strings`);
    await page.locator('.level').waitFor();
    await noOverflow('the level screen in landscape');
    await shot('09-landscape');
  } finally {
    await page.setViewportSize(device.viewport);
  }
});

await step('Installable: manifest, icons and home-screen tags are all there', async () => {
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await fetch(new URL(href, url))).json();
  if (manifest.display !== 'standalone' || !manifest.icons?.some((i) => i.purpose === 'maskable')) throw new Error('manifest incomplete');
  for (const icon of manifest.icons) {
    const r = await fetch(new URL(icon.src, url));
    if (!r.ok || r.headers.get('content-type') !== 'image/png') throw new Error(`icon ${icon.src} missing`);
  }
  for (const sel of ['link[rel="apple-touch-icon"]', 'meta[name="apple-mobile-web-app-capable"]', 'meta[name="viewport"][content*="viewport-fit=cover"]']) {
    if (!(await page.locator(sel).count())) throw new Error(`missing ${sel}`);
  }
});

await step(`Offline: once loaded, the whole game — compiler included — ${engine === webkit ? 'is cached by the service worker' : 'works with no connection'}`, async () => {
  await page.goto(url);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  // Wait until the service worker has cached everything.
  await page.waitForFunction(async () => {
    const keys = await caches.keys();
    const c = keys.find((k) => k.startsWith('reactor-quest-'));
    return c ? (await (await caches.open(c)).keys()).length >= 8 : false;
  }, null, { timeout: 30_000 });
  // Playwright's WebKit can't serve a service worker to an offline page (real
  // Safari can); there, checking the worker cached the whole build is the test.
  if (engine === webkit) return;
  await context.setOffline(true);
  try {
    await page.reload();
    await page.getByRole('button', { name: /Continue|Return/ }).waitFor();
    await page.goto(`${url}#/level/strings`);
    await page.getByRole('tab', { name: /Code/ }).tap();
    await page.locator('.run-fab').tap();
    await page.locator('.checks li').first().waitFor({ timeout: 20_000 });
    await shot('10-offline');
  } finally {
    await context.setOffline(false);
  }
});

await step('No uncaught page errors', async () => {
  if (pageErrors.length) throw new Error(pageErrors.join('\n'));
});

// A strip of four phone screens, for the README.
await step('Phone screenshots composed', async () => {
  const { readFileSync } = await import('node:fs');
  const pics = ['02-mission', '03-keybar', '05-checks', '07-swipe'].map((n) => `data:image/png;base64,${readFileSync(join(shots, `${tag}-${n}.png`)).toString('base64')}`);
  const strip = await browser.newPage({ viewport: { width: 1660, height: 200 } });
  await strip.setContent(`<body style="margin:0;padding:20px;background:#05070d;display:flex;gap:20px;align-items:flex-start;width:max-content">${pics.map((src) => `<img src="${src}" style="width:375px;height:auto;border-radius:28px;border:6px solid #1c2434">`).join('')}</body>`);
  await strip.screenshot({ path: join(shots, `${tag}-strip.png`), fullPage: true });
  await strip.close();
});

await browser.close();
server.close();
console.log(`\n${results.length - failures}/${results.length} phone checks passed (${tag}). Screenshots in test-results/mobile/.`);
process.exit(failures ? 1 : 0);
