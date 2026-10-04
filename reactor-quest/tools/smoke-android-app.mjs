// CI: plays the installed Android app (Reactor-Quest.apk) on an emulator.
// Playwright attaches to the app's own WebView over adb, so this taps through
// the real native app, not a browser: launch, sign the register, write code
// on Floor 1, Run, win. Screenshots land in test-results/android-app/.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _android as android } from 'playwright-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shots = join(root, 'test-results', 'android-app');
mkdirSync(shots, { recursive: true });
const PKG = 'io.github.keldessouky.reactorquest';

const [device] = await android.devices();
if (!device) throw new Error('No Android device or emulator found (adb devices is empty).');
console.log(`Device: ${device.model()} (${device.serial()})`);

const snap = async (name) => writeFileSync(join(shots, `${name}.png`), await device.screenshot());
let failed = false;
const step = async (name, fn) => {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed = true;
    console.log(`  ✗ ${name}\n      ${String(e.message ?? e).split('\n').slice(0, 5).join('\n      ')}`);
    await snap(`fail-${name.replace(/\W+/g, '-').slice(0, 40)}`).catch(() => {});
  }
};

await device.shell(`am force-stop ${PKG}`);
await device.shell(`am start -W -n ${PKG}/.MainActivity`);
const webview = await device.webView({ pkg: PKG }, { timeout: 60_000 });
const page = await webview.page();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await step('The app opens on the title screen', async () => {
  await page.getByRole('button', { name: /Begin|Continue/ }).waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1500);
  await snap('01-title');
});

await step('It knows it is the native app (no install hint, no service worker)', async () => {
  const native = await page.evaluate(() => !!window.Capacitor?.isNativePlatform?.());
  if (!native) throw new Error('window.Capacitor says this is not the native app');
  if (await page.locator('.install-hint').count()) throw new Error('the app should not suggest installing itself');
});

await step('Begin → sign the register → Floor 1 in phone panes', async () => {
  await page.getByRole('button', { name: /Begin|Continue/ }).tap();
  const name = page.getByLabel('Your name');
  if (await name.isVisible({ timeout: 5000 }).catch(() => false)) {
    await name.fill('Droid');
    await page.getByRole('button', { name: 'Go live' }).tap();
  }
  await page.locator('.pane-bar').waitFor({ timeout: 30_000 });
  await snap('02-mission');
});

await step('TypeScript runs on the phone: write code, Run, win', async () => {
  await page.getByRole('tab', { name: /Code/ }).tap();
  await page.waitForFunction(() => !document.body.textContent?.includes('Loading compiler…'), null, { timeout: 90_000 });
  await page.locator('.cm-content').tap();
  await page.locator('.keybar').waitFor();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.insertText('console.log("Hello, Orrery");');
  await page.waitForTimeout(800);
  await snap('03-code');
  await page.locator('.run-fab').tap();
  await page.locator('.victory').waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1200);
  await snap('04-victory');
});

await step('No uncaught errors in the app', async () => {
  if (errors.length) throw new Error(errors.join('\n'));
});

await device.close();
process.exit(failed ? 1 : 0);
