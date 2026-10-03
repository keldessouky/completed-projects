// `npm run smoke`: a headless-Chromium bot plays the built game through its
// real UI. It walks the first-run flow, then opens every code level, types the
// reference solution into the editor, presses Run and waits for the victory
// screen — proving each level is beatable in a real browser, timers and all.
// It also plays a quiz and an arcade round, and screenshots each screen.
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { startServer } from './server.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shots = join(root, 'test-results');
mkdirSync(shots, { recursive: true });
if (!existsSync(join(root, 'dist', 'index.html'))) {
  console.error('Build first: npm run build');
  process.exit(1);
}

// Use a browser that's already there: $CHROMIUM_PATH, a Playwright-managed
// Chromium, or the installed Google Chrome.
async function launchBrowser() {
  const explicit = process.env.CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  if (explicit) return chromium.launch({ executablePath: explicit });
  try {
    return await chromium.launch();
  } catch {
    return chromium.launch({ channel: 'chrome' });
  }
}
const browser = await launchBrowser();
const { server, url } = await startServer({ root: join(root, 'dist'), port: 4390, quiet: true });

let failures = 0;
const results = [];
async function step(name, fn) {
  const t = Date.now();
  try {
    await fn();
    results.push(`  ✓ ${name} (${Date.now() - t} ms)`);
  } catch (e) {
    failures++;
    results.push(`  ✗ ${name}\n      ${String(e.message ?? e).split('\n').slice(0, 6).join('\n      ')}`);
  }
  console.log(results.at(-1));
}

const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

async function setEditor(text) {
  await page.locator('.cm-content').click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(text);
  const got = await page.locator('.cm-content').evaluate((el) => el.cmView?.view?.state?.doc?.toString() ?? null);
  if (got !== null && got !== text) throw new Error('Editor content did not match after insert');
}

async function waitCompiler() {
  await page.waitForFunction(() => !document.body.textContent?.includes('Loading compiler…'), null, { timeout: 30_000 });
}

// ---------------------------------------------------------------- first run
await step('Title screen renders', async () => {
  await page.goto(url);
  await page.getByRole('button', { name: 'Begin' }).waitFor();
  await page.screenshot({ path: join(shots, '01-title.png') });
});

await step('Begin opens the first level; starter code fails with type errors', async () => {
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.waitForURL(/#\/level\/power-bus/);
  await waitCompiler();
  await page.getByRole('button', { name: /^Run/ }).click();
  await page.locator('.report .checks li').first().waitFor();
  const typeErrors = await page.locator('.type-errors .diag').count();
  if (typeErrors < 1) throw new Error('expected type errors from the starter');
  await page.locator('.cm-lintRange-error').first().waitFor();
  await page.screenshot({ path: join(shots, '02-level-starter.png') });
});

await step('Hints, then the solution modal, then victory at one star', async () => {
  await page.getByRole('tab', { name: /Hints/ }).click();
  await page.getByRole('button', { name: /Reveal hint 1/ }).click();
  await page.locator('.hint').first().waitFor();
  await page.getByRole('button', { name: /Show the solution/ }).click();
  await page.getByRole('button', { name: 'Reveal the solution' }).click();
  await page.getByRole('button', { name: 'Load it into the editor' }).click();
  await page.getByRole('button', { name: /^Run/ }).click();
  await page.locator('.victory').waitFor({ timeout: 10_000 });
  const on = await page.locator('.big-stars span.on').count();
  if (on !== 1) throw new Error(`expected 1 star after using the solution, got ${on}`);
  await page.locator('.toast').filter({ hasText: 'First Light' }).waitFor();
  await page.waitForTimeout(900); // let the stars land
  await page.screenshot({ path: join(shots, '03-victory.png') });
});

await step('Next system → level 2, solved by typing: three stars and First Try', async () => {
  await page.getByRole('button', { name: /Next system/ }).click();
  await page.waitForURL(/#\/level\/comms-relay/);
  await setEditor(readFileSync(join(root, 'src/content/code/comms-relay/solution.ts'), 'utf8'));
  await page.getByText('✓ No type errors').waitFor({ timeout: 10_000 });
  await page.keyboard.press('Control+Enter');
  await page.locator('.victory').waitFor({ timeout: 10_000 });
  const on = await page.locator('.big-stars span.on').count();
  if (on !== 3) throw new Error(`expected 3 stars, got ${on}`);
  await page.locator('.toast').filter({ hasText: 'First Try' }).waitFor();
});

await step('Map shows progress and the next level', async () => {
  await page.goto(`${url}#/map`);
  await page.locator('.node.done').nth(1).waitFor();
  await page.locator('.node.next').waitFor();
  const deckHeight = await page.locator('.deck').first().evaluate((el) => el.getBoundingClientRect().height);
  if (deckHeight > 400) throw new Error(`deck panel is ${deckHeight}px tall — layout broken`);
  await page.waitForTimeout(4600); // let the achievement toasts clear
  await page.screenshot({ path: join(shots, '04-map.png') });
});

await step('Locked levels stay locked', async () => {
  await page.goto(`${url}#/level/core-reboot`);
  await page.getByText('This system is still dark').waitFor();
});

// ---------------------------------------------------------------- every level
await step('Open every system from Profile → Settings', async () => {
  await page.goto(`${url}#/profile`);
  await page.getByLabel(/Open every system/).check();
  await page.screenshot({ path: join(shots, '05-profile.png') });
});

const ids = readdirSync(join(root, 'src/content/code'));
for (const id of ids) {
  await step(`Level ${id}: the solution wins in the real UI`, async () => {
    const ext = existsSync(join(root, `src/content/code/${id}/solution.tsx`)) ? 'tsx' : 'ts';
    await page.goto(`${url}#/level/${id}`);
    await page.locator('.cm-content').waitFor();
    await setEditor(readFileSync(join(root, `src/content/code/${id}/solution.${ext}`), 'utf8'));
    await page.getByRole('button', { name: /^Run/ }).click();
    try {
      await page.locator('.victory').waitFor({ timeout: 15_000 });
    } catch {
      const failed = await page.locator('.checks li.fail, .diag').allTextContents();
      throw new Error(`no victory. ${failed.join(' | ')}`);
    }
    if (id === 'thruster') {
      await page.getByRole('button', { name: 'Stay here' }).click();
      const preview = page.locator('.preview-surface');
      await preview.getByRole('button', { name: 'Increase' }).click();
      await preview.getByRole('button', { name: 'Increase' }).click();
      await preview.getByText('Thrust: 2').waitFor();
      await page.screenshot({ path: join(shots, '06-react-level.png') });
    }
    if (id === 'core-reboot') {
      await page.waitForTimeout(900);
      await page.screenshot({ path: join(shots, '07-final-victory.png') });
    }
  });
}

// ---------------------------------------------------------------- quiz + arcade
await step('A quiz plays through to victory', async () => {
  await page.goto(`${url}#/level/quiz-jsx`);
  for (let q = 0; q < 10; q++) {
    await page.locator('.option').first().click();
    if (q === 0) await page.screenshot({ path: join(shots, '08-quiz.png') });
    const next = page.getByRole('button', { name: /Next question|Finish/ });
    const label = await next.textContent();
    await next.click();
    if (label?.includes('Finish')) break;
  }
  await page.locator('.victory').waitFor();
});

await step('Arcade: a round starts, answers score, wrong answers explain', async () => {
  await page.goto(`${url}#/arcade`);
  await page.getByRole('button', { name: /Start/ }).click();
  let explained = false;
  for (let i = 0; i < 6; i++) {
    await page.locator('.arcade-card pre.code').waitFor();
    await page.keyboard.press('ArrowRight');
    await page.locator('.arcade-card .explain').waitFor();
    if (await page.locator('.arcade-card.wrong').count()) {
      explained = true;
      await page.locator('.compiler-says').waitFor({ timeout: 10_000 });
      if (i === 0 || !existsSync(join(shots, '09-arcade.png'))) await page.screenshot({ path: join(shots, '09-arcade.png') });
      await page.keyboard.press('Enter');
    } else {
      await page.waitForTimeout(1000);
    }
  }
  if (!explained) throw new Error('six "compiles" answers and none were wrong? unlikely');
});

await step('Narrow (phone) layout renders without horizontal scroll', async () => {
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone.goto(`${url}#/map`);
  await phone.locator('.deck').first().waitFor();
  const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await phone.screenshot({ path: join(shots, '10-phone-map.png') });
  await phone.close();
  if (overflow > 1) throw new Error(`page is ${overflow}px wider than the viewport`);
});

await step('Launcher server answers its probe and heartbeat', async () => {
  const sig = await (await fetch(`${url}__reactor`)).text();
  const beat = await fetch(`${url}__heartbeat`, { method: 'POST' });
  if (sig !== 'reactor-quest' || beat.status !== 204) throw new Error('server endpoints misbehaved');
});

await step('No uncaught page errors', async () => {
  if (pageErrors.length) throw new Error(pageErrors.join('\n'));
});

await browser.close();
server.close();
console.log(`\n${results.length - failures}/${results.length} smoke checks passed. Screenshots in test-results/.`);
process.exit(failures ? 1 : 0);
