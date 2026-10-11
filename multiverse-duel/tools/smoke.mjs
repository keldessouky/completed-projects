// `npm run smoke`: a headless Chromium bot plays whole duels through the real UI —
// themed and Universal decks, lands, spells, targets, attacks and blocks — and fails
// on any page error. Screenshots land in test-results/.
//
//   node tools/smoke.mjs [--games 3] [--headed] [--offline]
// Needs a build (npm run build). Real card images load from Scryfall and the run
// fails if they don't show; --offline blocks them and checks the drawn fallback instead.
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { startServer } from './server.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'test-results');
mkdirSync(out, { recursive: true });
const args = process.argv.slice(2);
const offline = args.includes('--offline');
const games = args.includes('--games') ? Number(args[args.indexOf('--games') + 1]) : 3;

const executablePath = process.env.CHROME_PATH ?? (process.env.PLAYWRIGHT_BROWSERS_PATH ? '/opt/pw-browsers/chromium' : undefined);
const { server, url } = await startServer({ root: join(root, 'dist'), port: 4555 });
const browser = await chromium.launch({
  executablePath,
  channel: executablePath ? undefined : 'chrome',
  headless: !args.includes('--headed'),
  ...(process.env.HTTPS_PROXY && !offline ? { proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } } : {}),
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) errors.push(`console: ${m.text()}`);
});
if (offline) await page.route(/scryfall\.(io|com)/, (r) => r.abort());

/** Before a screenshot: give visible card images a moment to finish loading. */
async function settleImages() {
  if (offline) return;
  await page.waitForFunction(() => [...document.querySelectorAll('img.card-img')].every((i) => i.complete), null, { timeout: 10_000 }).catch(() => {});
}

/** How many real card images (not drawn fallbacks) inside `scope` have finished loading. */
async function loadedImages(scope) {
  return page.evaluate((sel) => [...document.querySelectorAll(`${sel} img.card-img`)].filter((i) => i.complete && i.naturalWidth > 0).length, scope);
}
/** Wait until at least `n` real card images in `scope` have loaded (or, offline, drawn frames show). */
async function checkCardArt(scope, n, what) {
  if (offline) {
    await page.waitForFunction((sel) => document.querySelectorAll(`${sel} .drawn-card`).length > 0, scope, { timeout: 15_000 });
    check(true, `${what}: drawn card frames show offline`);
    return;
  }
  try {
    await page.waitForFunction(([sel, k]) => [...document.querySelectorAll(`${sel} img.card-img`)].filter((i) => i.complete && i.naturalWidth > 0).length >= k, [scope, n], { timeout: 30_000 });
  } catch {
    /* reported below */
  }
  const got = await loadedImages(scope);
  check(got >= n, `${what}: ${got} real card images loaded from Scryfall`);
}

let checks = 0;
const check = (ok, what) => {
  if (!ok) throw new Error(`FAILED: ${what}`);
  checks++;
  console.log(`  ✓ ${what}`);
};
const visible = async (sel) => (await page.locator(sel).count()) > 0 && (await page.locator(sel).first().isVisible());
const text = async (sel) => ((await page.locator(sel).count()) ? (await page.locator(sel).first().innerText()).trim() : '');
const clickButton = async (name) => {
  const b = page.getByRole('button', { name, exact: true });
  if ((await b.count()) && (await b.first().isEnabled())) {
    await b.first().click();
    return true;
  }
  return false;
};

try {
  await page.goto(url);
  await page.waitForSelector('.setup', { timeout: 90_000 });
  check(true, 'card database loads and the deck screen appears');
  const counts = await text('.topbar .small');
  check(/\d{2},\d{3} cards/.test(counts), `topbar shows the size of the universe (${counts})`);

  // Library: search works.
  await page.getByRole('button', { name: 'Card library' }).click();
  await page.getByLabel('Search cards').fill('lightning bolt');
  await page.waitForTimeout(400);
  check((await page.locator('.grid-card').count()) >= 1, 'card library finds Lightning Bolt');
  await checkCardArt('.card-grid', 1, 'library');
  await settleImages();
  await page.screenshot({ path: join(out, 'library.png') });
  await page.getByRole('button', { name: 'Decks' }).click();

  for (let gameNo = 0; gameNo < games; gameNo++) {
    console.log(`Game ${gameNo + 1}`);
    // Game 1: a themed deck (Lord of the Rings) vs Universal. Game 2: a creature type vs a plane.
    // Game 3: a four-player free-for-all against three computers.
    const seats = gameNo === 2 ? 4 : 2;
    await page.getByRole('radio', { name: new RegExp(`^${seats} — you`) }).click();
    check((await page.locator('.picker').count()) === seats, `${seats} deck pickers for ${seats} players`);
    const pickers = page.locator('.picker');
    const themed = gameNo === 0 ? ['Franchises', 'The Lord of the Rings'] : gameNo === 1 ? ['Creature types', 'Dragons'] : ['Planes', 'Ravnica'];
    await pickers.nth(0).getByRole('tab', { name: 'Themed' }).click();
    await pickers.nth(0).getByRole('button', { name: themed[0], exact: true }).click();
    await pickers.nth(0).locator('.theme', { hasText: themed[1] }).first().click();
    if (gameNo === 1) {
      await pickers.nth(1).getByRole('tab', { name: 'Themed' }).click();
      await pickers.nth(1).getByRole('button', { name: 'Planes', exact: true }).click();
      await pickers.nth(1).locator('.theme', { hasText: 'Innistrad' }).first().click();
    } else {
      await pickers.nth(1).getByRole('tab', { name: 'Universal' }).click();
    }
    const deckTitle = await pickers.nth(0).locator('.deck-title strong').innerText();
    check(deckTitle.startsWith(themed[1]), `deck built from theme: ${deckTitle}`);
    const total = await pickers.nth(0).locator('.deck-group h3 .muted').allInnerTexts();
    const sum = total.map((t) => Number(t.replace(/\D/g, ''))).reduce((a, b) => a + b, 0);
    check(sum === 40, `deck list has 40 cards (${total.join(' + ')})`);
    if (gameNo === 0) {
      await settleImages();
      await page.screenshot({ path: join(out, 'setup.png') });
    }

    await page.locator('.setup-intro button.primary').click();
    await page.waitForSelector('.board');
    check((await page.locator('.opp-zone').count()) === seats - 1, `${seats - 1} opponent${seats > 2 ? 's' : ''} at the table`);
    await checkCardArt('.hand', 5, 'opening hand');
    await page.locator('.hand-card').first().hover();
    await checkCardArt('.inspector', 1, 'card inspector');
    await page.getByRole('button', { name: 'fast', exact: true }).click();
    check(true, 'duel starts');

    let castCount = 0;
    let attacks = 0;
    let blocksTried = 0;
    let shotTaken = false;
    const started = Date.now();
    for (let step = 0; step < 1500; step++) {
      if (await visible('.game-over')) break;
      if (Date.now() - started > 240_000) throw new Error('game took too long');
      const prompt = await text('.prompt');
      if (await visible('.modal .mode-option:not([disabled])')) {
        await page.locator('.modal .mode-option:not([disabled])').first().click();
        continue;
      }
      if (prompt.startsWith('Choose a target') || prompt.startsWith('Choose one of your creatures')) {
        const target = page.locator('.targetable');
        if (await target.count()) await target.first().click();
        else if (!(await clickButton('Skip'))) await clickButton('Cancel');
        continue;
      }
      const mine = (await text('.whose')) === 'Your turn';
      if (mine) {
        const phase = await text('.phase.on');
        if (phase === 'Main' || phase === 'Main 2') {
          const playable = page.locator('.hand-card.playable');
          if (await playable.count()) {
            await playable.first().click();
            castCount++;
            await page.waitForTimeout(60);
            continue;
          }
          if (phase === 'Main' && !shotTaken && castCount >= 6) {
            await settleImages();
            await page.screenshot({ path: join(out, `board-${gameNo + 1}.png`) });
            shotTaken = true;
          }
          if (!(await clickButton('Attack ▸')) && !(await clickButton('End turn'))) await clickButton('Go to combat ▸');
          continue;
        }
        if (phase === 'Attack') {
          // In multiplayer, aim at the opponent with the lowest life by clicking their life total.
          const lives = page.locator('.opp-zone:not(.out) .life');
          if ((await lives.count()) > 1) {
            const values = (await lives.locator('.life-num').allInnerTexts()).map(Number);
            await lives.nth(values.indexOf(Math.min(...values))).click();
          }
          const all = page.locator('.actions button', { hasText: /^(Select all|All at )/ });
          if (await all.count()) await all.first().click();
          const b = page.locator('.actions button.primary');
          const label = await b.innerText();
          if (label.startsWith('Attack with')) attacks++;
          await b.click();
          continue;
        }
        if (phase === 'Damage') {
          await clickButton('Deal combat damage');
          continue;
        }
      } else if (prompt.includes('is attacking you')) {
        // Block the first attacker with the first untapped creature, if we can.
        const mineFree = page.locator('.battlefield.you .perm:not(.tapped)');
        const atk = page.locator('.battlefield.opp .perm.at-you');
        if (blocksTried % 2 === 0 && (await mineFree.count()) && (await atk.count())) {
          await mineFree.first().click();
          await atk.first().click();
        }
        blocksTried++;
        const confirm = page.locator('.actions button.primary');
        if (await confirm.isEnabled()) await confirm.click();
        else {
          // e.g. a single blocker on a menace creature: undo it and take the hit.
          await page.keyboard.press('Escape');
          await page.locator('.battlefield.you .perm.blocking').first().click().catch(() => {});
          if (await confirm.isEnabled()) await confirm.click();
        }
        continue;
      }
      await page.waitForTimeout(120);
    }
    check(await visible('.game-over'), `game ${gameNo + 1} reached the end for you (${castCount} cards played, ${attacks} attacks, ${blocksTried} blocking steps): ${await text('.game-over h2')}`);
    // Knocked out of a multiplayer game: watch the computers finish it.
    if (seats > 2 && (await clickButton('Watch the rest'))) {
      await page.waitForFunction(() => document.querySelector('.whose')?.textContent === 'Game over', null, { timeout: 180_000 });
      check(true, `the computer players finished the game: ${await text('.recent-log .log-line:last-child')}`);
      await settleImages();
      await page.screenshot({ path: join(out, `game-${gameNo + 1}-finished.png`) });
      await page.locator('.actions').getByRole('button', { name: 'New decks' }).click();
      await page.waitForSelector('.setup');
      continue;
    }
    check(castCount >= 5, 'the bot played lands and spells');
    await settleImages();
    await page.screenshot({ path: join(out, `game-over-${gameNo + 1}.png`) });
    await page.locator('.game-over').getByRole('button', { name: 'Game log' }).click();
    check(await visible('.full-log'), 'full game log opens');
    await page.keyboard.press('Escape');
    check(!(await visible('.full-log')), 'Esc closes the log');
    await page.locator('.game-over').getByRole('button', { name: 'New decks' }).click();
    await page.waitForSelector('.setup');
  }
  check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  console.log(`\n${checks} checks passed.`);
} catch (e) {
  await page.screenshot({ path: join(out, 'failure.png') }).catch(() => {});
  console.error(e.message);
  if (errors.length) console.error(errors.join('\n'));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
