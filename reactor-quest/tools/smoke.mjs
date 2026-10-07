// `npm run smoke`: a headless-Chromium bot plays the built game through its
// real UI. It walks the first-run flow, then opens every code level, types the
// reference solution into the editor, presses Run and waits for the victory
// screen — proving each level is beatable in a real browser, timers and all.
// It also plays a quiz and a spaced-review session, and screenshots each screen.
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
    await page.screenshot({ path: join(shots, `fail-${failures}.png`) }).catch(() => {});
    const blocker = await page.evaluate(() => [...document.querySelectorAll('.modal-backdrop, .announcer .card-note')].map((el) => `${el.className}: ${el.textContent?.slice(0, 80)}`).join(' || ')).catch(() => '');
    results.push(`  ✗ ${name}\n      ${String(e.message ?? e).split('\n').slice(0, 6).join('\n      ')}${blocker ? `\n      overlays: ${blocker}` : ''}`);
  }
  console.log(results.at(-1));
}

const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
// SMOKE_PLATFORM=mac makes the page believe it runs on macOS, so the Mac
// keyboard paths (⌘ shortcuts) can be exercised from any machine.
if (process.env.SMOKE_PLATFORM === 'mac') {
  await context.addInitScript(() => Object.defineProperty(Navigator.prototype, 'platform', { get: () => 'MacIntel' }));
}
const page = await context.newPage();
// The editor's primary modifier: ⌘ on a Mac, Ctrl elsewhere.
const modKey = async () => ((await page.evaluate(() => /Mac/.test(navigator.platform))) ? 'Meta' : 'Control');
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

async function setEditor(text) {
  await page.locator('.cm-content').click();
  await page.keyboard.press(`${await modKey()}+A`);
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(text);
  const got = await page.locator('.cm-content').evaluate((el) => el.cmView?.view?.state?.doc?.toString() ?? null);
  if (got !== null && got !== text) throw new Error('Editor content did not match after insert');
}

async function waitCompiler() {
  await page.waitForFunction(() => !document.body.textContent?.includes('Loading compiler…'), null, { timeout: 30_000 });
}

// ---------------------------------------------------------------- first run
/** Close any offer dialog (pet, class) that pops up when a victory screen closes. */
async function dismissModals() {
  for (let i = 0; i < 4 && (await page.locator('.modal-backdrop .modal:not(.victory)').count()); i++) await page.keyboard.press('Escape');
}

/** Dismiss THE FEED's announcement cards so they never sit on top of what we click. */
async function clearNotes() {
  // Cards that were waiting their turn slide in as others go, so keep going until none are left.
  for (let i = 0; i < 30 && (await page.locator('.note-close').count()); i++) await page.locator('.note-close').first().click({ timeout: 2000 }).catch(() => {});
}

await step('Title screen renders', async () => {
  await page.goto(url);
  await page.getByRole('button', { name: 'Begin' }).waitFor();
  await page.screenshot({ path: join(shots, '01-title.png') });
});

await step('Begin asks for a name, then opens Floor 1, level 1 — whose starter prints nothing', async () => {
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.getByLabel('Your name').fill('Smoke Tester');
  await page.getByRole('button', { name: 'Go live' }).click();
  await page.waitForURL(/#\/level\/hello-world/);
  await page.getByText('Smoke Tester').first().waitFor();
  await waitCompiler();
  await page.getByRole('button', { name: /^Run/ }).click();
  await page.locator('.checks li.fail').getByText('Nothing was printed').waitFor();
  await page.screenshot({ path: join(shots, '02-level-starter.png') });
});

await step('Two failed runs suggest the lesson; a plain-English line explains a compiler error', async () => {
  await page.getByRole('button', { name: /^Run/ }).click();
  await page.locator('.nudge').getByText('Stuck?').waitFor();
  await setEditor('console.log("Hello, Orrery")\nconst x: number = "five";');
  await page.getByRole('button', { name: /^Run/ }).click();
  await page.locator('.diag .plain').getByText('the code promised').waitFor();
  await page.locator('.nudge').getByRole('button', { name: 'Open the lesson' }).click();
  await page.getByRole('heading', { name: 'What is code?' }).waitFor();
});

await step('A hint token reveals a hint for free; the solution waits for every hint, and caps the win at one star', async () => {
  await page.getByRole('tab', { name: /Hints/ }).click();
  await page.getByRole('button', { name: /Use a hint token/ }).click();
  await page.locator('.hint').first().waitFor();
  const worth = await page.locator('.stars-line').textContent();
  if (!worth?.includes('★★★')) throw new Error(`a token-paid hint should keep three stars, but it shows: ${worth}`);
  await page.getByRole('button', { name: /Show the solution/ }).click();
  await page.getByRole('button', { name: 'Back to the hints' }).click();
  await page.getByRole('button', { name: /Reveal hint 2/ }).click();
  await page.getByRole('button', { name: /Reveal hint 3/ }).click();
  await page.getByRole('button', { name: /Show the solution/ }).click();
  await page.getByRole('button', { name: 'Reveal the solution' }).click();
  if (await page.getByRole('button', { name: 'Load it into the editor' }).count()) throw new Error('the solution should be retyped, not pasted, before the level is solved');
  await page.locator('.modal').getByRole('button', { name: 'Close' }).click();
  await setEditor('console.log("Hello, Orrery");');
  await page.getByRole('button', { name: /^Run/ }).click();
  await page.locator('.victory').waitFor({ timeout: 10_000 });
  const on = await page.locator('.big-stars span.on').count();
  if (on !== 1) throw new Error(`expected 1 star after using the solution, got ${on}`);
  await page.locator('.card-note').filter({ hasText: 'Hello, World' }).waitFor();
  await page.waitForTimeout(900); // let the stars land
  await page.screenshot({ path: join(shots, '03-victory.png') });
});

await step('Explaining the level back saves a note to the notebook, for XP', async () => {
  await page.getByLabel(/Explain it back/).fill('The line was a comment, so it never ran. Removing the slashes made it a real instruction.');
  await page.getByRole('button', { name: 'Save note' }).click();
  await page.getByText('+15 XP for explaining it').waitFor();
});

await step('Opening the loot boxes from the victory screen', async () => {
  await page.locator('.victory').getByRole('button', { name: /Open \d* ?box/ }).click();
  for (let i = 0; i < 12 && (await page.locator('.box-modal').count()); i++) {
    await page.getByRole('button', { name: 'Open it' }).click();
    await page.locator('.loot-list li').first().waitFor();
    if (i === 0) {
      await page.waitForTimeout(800);
      await page.screenshot({ path: join(shots, '04-box.png') });
    }
    await page.locator('.box-modal .btn.primary').click();
  }
  if (await page.locator('.box-modal').count()) throw new Error('the box opener never closed');
});

await step('Next system → level 2, solved by typing: three stars and First Try', async () => {
  await clearNotes();
  await page.getByRole('button', { name: /Next system/ }).click();
  await page.waitForURL(/#\/level\/strings/);
  await setEditor(readFileSync(join(root, 'src/content/code/strings/solution.ts'), 'utf8'));
  await page.getByText('✓ No type errors').waitFor({ timeout: 10_000 });
  await page.keyboard.press(`${await modKey()}+Enter`);
  await page.locator('.victory').waitFor({ timeout: 10_000 });
  const on = await page.locator('.big-stars span.on').count();
  if (on !== 3) throw new Error(`expected 3 stars, got ${on}`);
  await page.locator('.card-note').filter({ hasText: 'First Try' }).first().waitFor();
  await page.locator('.card-note').filter({ hasText: 'Level up!' }).first().waitFor();
});

await step('Map: progress, daily quests (one claimable), floors and the next level', async () => {
  await page.goto(`${url}#/map`);
  await page.locator('.node.done').nth(1).waitFor();
  await page.locator('.node.next').waitFor();
  await page.locator('.quests li').first().waitFor();
  const deckHeight = await page.locator('.deck').first().evaluate((el) => el.getBoundingClientRect().height);
  if (deckHeight > 460) throw new Error(`deck panel is ${deckHeight}px tall — layout broken`);
  const claim = page.getByRole('button', { name: 'Claim 🎁' });
  if (await claim.count()) {
    await claim.first().click();
    await page.locator('.quests li.claimed').first().waitFor();
  }
  await clearNotes();
  await page.locator('main').evaluate((el) => el.scrollTo(0, 0));
  await page.screenshot({ path: join(shots, '05-map.png') });
});

await step('Locked levels stay locked; a floor\'s boss is open from the start', async () => {
  await page.goto(`${url}#/level/core-reboot`);
  await page.getByText('This system is still dark').waitFor();
  await page.goto(`${url}#/level/boot-diagnostics`);
  await page.locator('.boss-bar').waitFor();
});

// ---------------------------------------------------------------- every level
await step('Open every system from Character → Settings', async () => {
  await page.goto(`${url}#/character/settings`);
  await page.getByLabel(/Open every system/).check();
});

await step('Hovering a name shows its type; typing a dot offers members', async () => {
  await page.goto(`${url}#/level/telemetry`);
  await waitCompiler();
  await page.locator('.cm-content').getByText('summarize', { exact: true }).first().hover();
  const tip = page.locator('.cm-type-tip');
  await tip.waitFor({ timeout: 10_000 });
  const sig = (await tip.textContent()) ?? '';
  if (!sig.includes('function summarize(readings: Reading[]): Summary')) throw new Error(`unexpected hover: ${sig}`);
  await page.screenshot({ path: join(shots, '11-hover-type.png') });
  await page.locator('.cm-content').click();
  await page.keyboard.press(`${await modKey()}+End`);
  await page.keyboard.insertText('\nMath.');
  await page.keyboard.type('ma');
  const list = page.locator('.cm-tooltip-autocomplete');
  await list.waitFor({ timeout: 10_000 });
  const items = await list.locator('li').allTextContents();
  if (!items.some((t) => t.includes('max'))) throw new Error(`no "max" in completions: ${items.slice(0, 8).join(', ')}`);
  await page.screenshot({ path: join(shots, '12-autocomplete.png') });
  await page.keyboard.press('Escape');
});

const ids = readdirSync(join(root, 'src/content/code')).filter((id) => !process.env.SMOKE_LEVELS || process.env.SMOKE_LEVELS.split(',').includes(id));
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
      await clearNotes();
      await page.getByRole('button', { name: 'Stay here' }).click();
      await dismissModals();
      await clearNotes();
      const preview = page.locator('.preview-surface');
      await preview.getByRole('button', { name: 'Increase' }).click();
      await preview.getByRole('button', { name: 'Increase' }).click();
      await preview.getByText('Thrust: 2').waitFor();
      await page.screenshot({ path: join(shots, '06-react-level.png') });
    }
    if (id === 'mission-dashboard') {
      await page.waitForTimeout(900);
      await page.screenshot({ path: join(shots, '07-final-victory.png') });
    }
  });
}

// ---------------------------------------------------------------- rewards
await step('The companion and the class are offered, and chosen', async () => {
  await page.goto(`${url}#/character`);
  await clearNotes();
  await page.getByRole('button', { name: 'Adopt your companion' }).click();
  await page.getByRole('button', { name: /Octo/ }).click();
  await page.getByLabel('Name it').fill('Inky');
  await page.getByRole('button', { name: 'Adopt', exact: true }).click();
  await page.locator('.companion .pet').waitFor();
  await page.getByRole('button', { name: 'Choose your class' }).click();
  await page.getByRole('button', { name: /Bug Hunter/ }).click();
  await page.getByRole('button', { name: /Become a Bug Hunter/ }).click();
  await page.getByText('Bug Hunter').first().waitFor();
  await clearNotes();
  await page.screenshot({ path: join(shots, '15-character.png') });
});

await step('Loot: a boss box guarantees a Codex scroll, which can be read', async () => {
  await page.goto(`${url}#/loot/boxes`);
  await clearNotes();
  const bossBox = page.locator('.box-list li').filter({ hasText: 'Boss Box: Boot Sequence' });
  await bossBox.getByRole('button', { name: 'Open' }).click();
  await page.getByRole('button', { name: 'Open it' }).click();
  await page.locator('.loot-list').getByText('Scroll of First Principles').waitFor();
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(shots, '13-boss-box.png') });
  await page.locator('.box-modal .btn.primary').click();
  if (await page.locator('.box-modal').count()) await page.keyboard.press('Escape');
  await page.goto(`${url}#/loot/codex`);
  await page.locator('.codex-list li').filter({ hasText: 'Scroll of First Principles' }).getByRole('button', { name: 'Read' }).click();
  await page.locator('.modal').getByText('Values and variables').waitFor();
  await page.keyboard.press('Escape');
});

await step('The Safe Room sells things', async () => {
  await page.goto(`${url}#/shop`);
  const before = await page.locator('.wallet').textContent();
  await page.locator('.ware').filter({ hasText: 'Hint Token' }).getByRole('button').click();
  await page.waitForFunction((b) => document.querySelector('.wallet')?.textContent !== b, before);
  await clearNotes();
  await page.screenshot({ path: join(shots, '14-shop.png') });
});

// ---------------------------------------------------------------- quiz + review
/**
 * Answer multiple-choice cards until the screen moves on: the first option the
 * first time (often wrong, on purpose), and the right one when a missed card
 * comes back. Returns how many cards came back for another try.
 */
async function answerUntilDone(card, nextName, done, shot) {
  const known = new Map();
  let retries = 0;
  for (let i = 0; i < 40 && !(await done()); i++) {
    const key = await card.locator('.prompt, pre.code').allTextContents().then((t) => t.join('|'));
    const option = known.has(key) ? card.locator('.option').filter({ hasText: known.get(key) }).first() : card.locator('.option').first();
    if (known.has(key)) retries++;
    await option.click();
    known.set(key, (await card.locator('.option.right').textContent())?.replace(/^[A-D]/, '') ?? '');
    if (i === 0 && shot) await page.screenshot({ path: join(shots, shot) });
    await page.getByRole('button', { name: nextName }).click();
  }
  return retries;
}

await step('A quiz plays through to victory; a missed question comes back until it is right', async () => {
  await page.goto(`${url}#/level/quiz-jsx`);
  const retries = await answerUntilDone(page.locator('.quiz-card'), /Next question|Finish/, () => page.locator('.victory').count(), '08-quiz.png');
  await page.locator('.victory').waitFor();
  const missed = await page.locator('.victory .big-stars span.on').count() < 3;
  if (missed && retries === 0) throw new Error('a question was missed, but never came back');
});

await step('Review: cleared quizzes become spaced-review cards; missed cards return within the session', async () => {
  await page.goto(`${url}#/map`);
  await page.locator('.review-panel').getByText(/All caught up|to review/).waitFor();
  // Cards are first due the day after their level. Jump the deck forward a day.
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('reactor-quest/save'));
    for (const r of Object.values(save.reviews)) r.due = '2000-01-01';
    localStorage.setItem('reactor-quest/save', JSON.stringify(save));
  });
  await page.goto(`${url}#/review`);
  await page.reload();
  await page.locator('.review-card').waitFor();
  await answerUntilDone(page.locator('.review-card'), /Next card|Finish/, () => page.getByText('Session complete').count(), '09-review.png');
  await page.getByText('Session complete').waitFor();
  await page.getByText('remembered on the first try').waitFor();
  await page.goto(`${url}#/character/notebook`);
  await page.locator('.notebook li').filter({ hasText: 'Hello, Orrery' }).waitFor();
});

await step('Colour profiles: 🎨 previews on hover, Escape reverts, a click keeps it, and it survives a reload', async () => {
  const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
  const bgLum = () =>
    page.evaluate(() => {
      const [r, g, b] = getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number);
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    });
  await page.goto(`${url}#/level/thruster`);
  await page.locator('.cm-content').waitFor();
  await waitCompiler();
  // The starter (some checks red, some green) makes a colourful backdrop for the gallery.
  await setEditor(readFileSync(join(root, 'src/content/code/thruster/starter.tsx'), 'utf8'));
  await page.getByRole('button', { name: /^Run/ }).click();
  await page.locator('.checks li.fail').first().waitFor();
  const picker = page.getByRole('button', { name: /Colour profile/ });
  await clearNotes();
  await picker.click();
  const options = page.getByRole('radio');
  if ((await options.count()) !== 17) throw new Error(`expected 16 profiles + the original, got ${await options.count()}`);
  await page.waitForTimeout(400); // let it fade in
  await page.screenshot({ path: join(shots, '16-theme-menu.png') });
  await options.filter({ hasText: 'Dracula' }).hover();
  if ((await theme()) !== 'dracula') throw new Error('hovering a profile should preview it');
  await page.keyboard.press('Escape');
  if ((await theme()) !== 'reactor') throw new Error('Escape should put the old profile back');
  await picker.click();
  await options.filter({ hasText: 'GitHub Light' }).click();
  if ((await theme()) !== 'github-light' || (await bgLum()) < 0.8) throw new Error('GitHub Light should make the page light');
  await page.reload();
  await page.locator('.cm-content').waitFor();
  if ((await theme()) !== 'github-light') throw new Error('the profile should be remembered');
  // Keyboard: arrows move through the list (previewing as they go), Return keeps one.
  await picker.click();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  if ((await theme()) !== 'dracula') throw new Error('keyboard choice failed');
  // A gallery of every profile, for the README.
  await page.getByRole('button', { name: /^Run/ }).click();
  await page.locator('.checks li').first().waitFor();
  const cells = [];
  for (let i = 1; i < 17; i++) {
    await picker.click();
    const opt = options.nth(i);
    const name = (await opt.locator('.name').textContent()).replace('✓', '').trim();
    await opt.click();
    await page.waitForTimeout(150);
    cells.push({ name, src: `data:image/jpeg;base64,${(await page.screenshot({ type: 'jpeg', quality: 85, clip: { x: 0, y: 0, width: 1012, height: 640 } })).toString('base64')}` });
  }
  await picker.click();
  await options.filter({ hasText: 'Reactor' }).click();
  if ((await theme()) !== 'reactor') throw new Error('could not switch back');
  const gallery = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await gallery.setContent(`<body style="margin:0;padding:16px;background:#05070d;font:600 15px system-ui;color:#dbe5f7">
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px">${cells
      .map((c) => `<figure style="margin:0"><img src="${c.src}" style="width:100%;border-radius:8px;display:block;border:1px solid #22304f"><figcaption style="margin-top:6px">${c.name}</figcaption></figure>`)
      .join('')}</div></body>`);
  await gallery.screenshot({ path: join(shots, '17-themes.png'), fullPage: true });
  await gallery.close();
});

await step('Narrow (phone) layout renders without horizontal scroll', async () => {
  await clearNotes();
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
