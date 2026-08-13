import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const vite = spawn('npx', ['vite', '--port', '5199', '--strictPort'], { cwd: process.cwd(), stdio: 'pipe' });
await new Promise((ok) => {
  vite.stdout.on('data', (b) => { if (String(b).includes('ready in') || String(b).includes('Local:')) ok(); });
  setTimeout(ok, 9000);
});

const browser = await chromium.launch({
  executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined,
  args: ['--use-angle=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 2 });
const errs = [];
page.on('pageerror', (e) => errs.push('ERR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
await page.goto('http://127.0.0.1:5199/');

const scene = () => page.evaluate(() => window.__cr?.scene?.() ?? null);
const waitScene = async (want, ms = 40000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if ((await scene()) === want) return true; await page.waitForTimeout(300); }
  return false;
};
await waitScene('title');
for (let i = 0; i < 8 && (await scene()) !== 'world'; i++) {
  await page.mouse.click(220, 592); await page.waitForTimeout(900);
}
await page.waitForTimeout(1200);
await page.evaluate(() => { window.__cr.grantCoins(900); });
const pads = await page.evaluate(() => window.__cr.worldDef().pois.filter((p) => p.kind === 'pad'));
for (const pad of pads.slice(0, 5)) {
  await page.evaluate(([x, y]) => window.__cr.warp(x, y), [pad.x, pad.y]);
  await page.evaluate(() => { window.__cr.turbo(8); });
  await page.waitForTimeout(2000);
}
await page.evaluate(() => { window.__cr.turbo(1); });
await page.waitForTimeout(900);
console.log('probe:', JSON.stringify(await page.evaluate(() => window.__cr.probe())));
await page.screenshot({ path: 'tools/.shot-crowd.png' });

const camp = await page.evaluate(() => window.__cr.worldDef().pois.find((p) => p.kind === 'camp'));
await page.evaluate(([x, y]) => window.__cr.warp(x, y), [camp.x, camp.y - 190]);
await page.waitForTimeout(3200);
await page.screenshot({ path: 'tools/.shot-camp.png' });
console.log(errs.length ? errs.slice(0, 5).join('\n') : 'no console errors');
await browser.close();
vite.kill('SIGTERM');
process.exit(0);
