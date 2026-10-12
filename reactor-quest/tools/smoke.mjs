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
/** Wait for an announcement card. Cards arrive one at a time, so dismiss the ones ahead of it. */
async function waitForNote(text) {
  for (let i = 0; i < 40; i++) {
    if (await page.locator('.card-note').filter({ hasText: text }).count()) return;
    const close = page.locator('.note-close').first();
    if (await close.count()) await close.click({ timeout: 2000 }).catch(() => {});
    else await page.waitForTimeout(250);
  }
  throw new Error(`no "${text}" announcement arrived`);
}

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

await step('The first hint is free, a token pays for the next; the solution waits for every hint, and caps the win at one star', async () => {
  const worth = () => page.locator('.stars-line').textContent();
  await page.getByRole('tab', { name: /Hints/ }).click();
  if (await page.getByRole('button', { name: /Use a hint token/ }).count()) throw new Error('the first hint is free, so no token should be offered for it');
  await page.getByRole('button', { name: /Reveal hint 1/ }).click();
  await page.locator('.hint').first().waitFor();
  if (!(await worth())?.includes('★★★')) throw new Error(`the first hint should be free, but it shows: ${await worth()}`);
  await page.getByRole('button', { name: /Show the solution/ }).click();
  await page.getByRole('button', { name: 'Back to the hints' }).click();
  await page.getByRole('button', { name: /Use a hint token/ }).click();
  await page.locator('.hint').nth(1).waitFor();
  if (!(await worth())?.includes('★★★')) throw new Error(`a token-paid hint should keep three stars, but it shows: ${await worth()}`);
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
  await waitForNote('Hello, World');
  await page.waitForTimeout(900); // let the stars land
  await page.screenshot({ path: join(shots, '03-victory.png') });
});

await step('Explaining the level back saves a note to the notebook', async () => {
  await page.getByLabel(/Explain it back/).fill('The line was a comment, so it never ran. Removing the slashes made it a real instruction.');
  await page.getByRole('button', { name: 'Save note' }).click();
  await page.getByText('Saved to your notebook.').waitFor();
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
  await waitForNote('First Try');
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
await step('Settings: download a backup of your progress, and restore it', async () => {
  await page.goto(`${url}#/character/settings`);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download a backup' }).click()]);
  const file = join(shots, 'backup.json');
  await download.saveAs(file);
  const backup = JSON.parse(readFileSync(file, 'utf8'));
  if (backup.game !== 'reactor-quest' || !backup.save?.levels?.['hello-world']?.done) throw new Error('the backup is missing the progress');
  // Lose the progress, then bring it back from the file.
  await page.evaluate(() => localStorage.removeItem('reactor-quest/save'));
  await page.reload();
  await page.locator('input[type=file]').setInputFiles(file);
  await page.getByRole('button', { name: 'Restore it' }).click();
  await page.goto(`${url}#/map`);
  await page.locator('.node.done').nth(1).waitFor();
});

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

// ---------------------------------------------------------------- AWS certification paths
await step('Journeys: AWS starts with AI Practitioner; its map shows domain floors and readiness', async () => {
  await clearNotes();
  await page.goto(url);
  await page.getByRole('radio', { name: /AWS Certification/ }).click();
  const aif = page.locator('.cert').filter({ has: page.locator('b', { hasText: /^AI Practitioner$/ }) });
  if ((await aif.getAttribute('aria-checked')) !== 'true') throw new Error('AWS did not start with AI Practitioner');
  await aif.getByText('Start here').waitFor();
  const certs = await page.locator('.cert b').allTextContents();
  for (const name of ['AI Practitioner', 'Cloud Practitioner', 'Developer', 'Solutions Architect', 'Generative AI Developer']) {
    if (!certs.includes(name)) throw new Error(`the ${name} certification is missing from the picker (found ${certs.join(', ')})`);
  }
  await page.getByText('AWS certification prep · AIF-C01').waitFor();
  await page.screenshot({ path: join(shots, '20-aws-title.png') });
  await page.getByRole('button', { name: 'Lessons map' }).click();
  await page.locator('.readiness-panel').getByText('AIF-C01 readiness').waitFor();
  await page.locator('.deck h3').filter({ hasText: 'AI and ML Fundamentals' }).waitFor();
  if ((await page.locator('.path-switch select').inputValue()) !== 'aws-aif') throw new Error('the header switcher shows the wrong journey');
  await page.screenshot({ path: join(shots, '21-aws-map.png') });
});

await step('An AWS lesson teaches, quizzes, and its first answers count towards exam readiness', async () => {
  await page.goto(`${url}#/level/aif-ai-terms`);
  await page.getByText('Nested ideas', { exact: false }).first().waitFor();
  await answerUntilDone(page.locator('.quiz-card'), /Next question|Finish/, () => page.locator('.victory').count());
  await page.locator('.victory').getByText('counts towards your exam readiness').waitFor();
  const answered = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('reactor-quest/save')).exam.answers).filter((id) => id.startsWith('aif-ai-terms/')).length);
  if (answered !== 6) throw new Error(`expected 6 recorded answers, got ${answered}`);
});

await step('Exam prep: a drill explains every answer, "Choose TWO" needs both, and every answer counts towards readiness', async () => {
  await dismissModals();
  // Mark every single-answer AI and ML fundamentals question as known, so the drill must serve the "Choose TWO" ones.
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('reactor-quest/save'));
    const lessons = { 'aif-ai-terms': 6, 'aif-learning-data': 6, 'aif-use-cases': 6, 'aif-aws-ai-services': 6, 'aif-ml-lifecycle': 6, 'aif-metrics': 6, 'aif-ml-checkpoint': 8 };
    for (const [id, n] of Object.entries(lessons)) for (let i = 1; i <= n; i++) save.exam.answers[`${id}/${i}`] = '1';
    for (const n of [3, 5, 6]) save.exam.answers[`aif/aif-d1/${n}`] = '1';
    localStorage.setItem('reactor-quest/save', JSON.stringify(save));
  });
  await page.goto(`${url}#/exam`);
  await page.reload();
  await page.locator('.domain-table tr').filter({ hasText: 'Fundamentals of AI and ML' }).getByRole('button', { name: 'Drill' }).click();
  let multi = 0;
  for (let i = 0; i < 10; i++) {
    const card = page.locator('.exam-card');
    const two = await card.locator('.choose-n').count();
    if (two) {
      multi++;
      await card.locator('.option').nth(0).click();
      if (!(await page.getByRole('button', { name: 'Check answer' }).isDisabled())) throw new Error('"Choose TWO" could be checked with one option');
      await card.locator('.option').nth(1).click();
    } else await card.locator('.option').first().click();
    await page.getByRole('button', { name: 'Check answer' }).click();
    await card.locator('.explain').waitFor();
    if (i === 0) await page.screenshot({ path: join(shots, '22-aws-drill.png') });
    await page.getByRole('button', { name: /Next question|See results/ }).click();
  }
  if (multi < 4) throw new Error(`the drill served ${multi} "Choose TWO" questions, expected the 4 unseen ones`);
  await page.locator('.exam-results .final-score').waitFor();
  await page.locator('.exam-results').getByText(/^Readiness \d+% →/).waitFor();
  const recorded = await page.evaluate(() => [1, 2, 4, 7].filter((n) => JSON.parse(localStorage.getItem('reactor-quest/save')).exam.answers[`aif/aif-d1/${n}`]).length);
  if (recorded !== 4) throw new Error(`only ${recorded} of the 4 "Choose TWO" answers were recorded`);
  await page.screenshot({ path: join(shots, '23-aws-results.png'), fullPage: true });
  await page.getByRole('button', { name: 'Back to exam prep' }).click();
  await page.locator('.history').getByText('Drill: Fundamentals of AI and ML').waitFor();
});

await step('A full mock exam is timed, can be flagged and finished early, and is scored against the pass mark', async () => {
  await page.getByRole('button', { name: /Full mock exam/ }).click();
  const clock = await page.locator('.exam-clock').textContent();
  if (!/(90:00|89:5\d)/.test(clock)) throw new Error(`clock shows ${clock}`);
  if ((await page.locator('.q-grid button').count()) !== 65) throw new Error('the mock exam does not have 65 questions');
  const card = page.locator('.exam-card');
  await card.locator('.option').first().click();
  if (await card.locator('.explain').count()) throw new Error('the mock exam gave feedback before the end');
  await page.getByRole('button', { name: /Flag for review/ }).click();
  await page.locator('.q-grid button.flagged').first().waitFor();
  await page.screenshot({ path: join(shots, '24-aws-mock.png') });
  await page.getByRole('button', { name: 'Finish the exam now' }).click();
  await page.getByRole('dialog', { name: 'Finish the exam?' }).getByText(/unanswered/).waitFor();
  await page.getByRole('button', { name: 'Finish and score it' }).click();
  await page.locator('.exam-results').getByText(/Below the pass mark of 700/).waitFor();
  await page.getByText(/To learn from/).waitFor();
  await page.getByRole('button', { name: 'Back to exam prep' }).click();
  await page.locator('.history').getByText('Mock exam').waitFor();
  // Exam prep fits a phone.
  await page.setViewportSize({ width: 390, height: 844 });
  // Nothing may stick out past the screen, even inside a container that hides it.
  const overflow = await page.evaluate(() =>
    Math.max(document.documentElement.scrollWidth - window.innerWidth, ...[...document.querySelectorAll('.exam-prep .panel, .exam-prep .panel > *')].map((el) => el.getBoundingClientRect().right - window.innerWidth)),
  );
  await page.screenshot({ path: join(shots, '25-aws-phone.png') });
  await page.setViewportSize({ width: 1440, height: 900 });
  if (overflow > 1) throw new Error(`exam prep is ${overflow}px wider than a phone`);
});

await step('Switching journeys keeps every journey\'s progress', async () => {
  await page.locator('.path-switch select').selectOption('aws-clf');
  await page.locator('.deck h3').filter({ hasText: 'Cloud Concepts' }).waitFor();
  await page.locator('.readiness-panel').getByText('CLF-C02 readiness').waitFor();
  await page.locator('.path-switch select').selectOption('reactor');
  await page.locator('.deck .kicker').filter({ hasText: /^Floor 1 ·/ }).waitFor();
  if (await page.locator('.readiness-panel').count()) throw new Error('the station map shows exam readiness');
  await page.goto(url);
  await page.getByRole('radio', { name: /AWS Certification/ }).click();
  await page.locator('.cert').filter({ has: page.locator('b', { hasText: /^AI Practitioner$/ }) }).getByText(/1\/28 lessons/).waitFor();
  await page.locator('.journey').filter({ hasText: 'TypeScript & React' }).click();
  await page.getByText('A TypeScript & React quest').waitFor();
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

await step('Launcher server answers its probe and heartbeat, and never moves to another port', async () => {
  const sig = await (await fetch(`${url}__reactor`)).text();
  const beat = await fetch(`${url}__heartbeat`, { method: 'POST' });
  if (sig !== 'reactor-quest' || beat.status !== 204) throw new Error('server endpoints misbehaved');
  // Progress is saved per address: a second server on a busy port must refuse, not drift to the next one.
  const refused = await startServer({ root: join(root, 'dist'), port: 4390, quiet: true }).then(
    (s) => (s.server.close(), false),
    (e) => e.code === 'EADDRINUSE',
  );
  if (!refused) throw new Error('a second server started on another port instead of refusing');
});

await step('No uncaught page errors', async () => {
  if (pageErrors.length) throw new Error(pageErrors.join('\n'));
});

await browser.close();
server.close();
console.log(`\n${results.length - failures}/${results.length} smoke checks passed. Screenshots in test-results/.`);
process.exit(failures ? 1 : 0);
