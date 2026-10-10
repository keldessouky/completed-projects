// `npm run smoke`: a headless Chromium bot plays whole duels through the real UI —
// themed and Universal decks, lands, spells, targets, attacks and blocks — and fails
// on any page error. Screenshots land in test-results/.
//
//   node tools/smoke.mjs [--games 2] [--headed]
// Needs a build (npm run build). Card images are blocked so the run works offline;
// set SMOKE_IMAGES=1 to let them load.
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { startServer } from './server.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'test-results');
mkdirSync(out, { recursive: true });
const args = process.argv.slice(2);
const games = args.includes('--games') ? Number(args[args.indexOf('--games') + 1]) : 2;

const executablePath = process.env.CHROME_PATH ?? (process.env.PLAYWRIGHT_BROWSERS_PATH ? '/opt/pw-browsers/chromium' : undefined);
const { server, url } = await startServer({ root: join(root, 'dist'), port: 4555 });
const browser = await chromium.launch({
  executablePath,
  channel: executablePath ? undefined : 'chrome',
  headless: !args.includes('--headed'),
  ...(process.env.HTTPS_PROXY && process.env.SMOKE_IMAGES ? { proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } } : {}),
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) errors.push(`console: ${m.text()}`);
});
if (!process.env.SMOKE_IMAGES) await page.route(/scryfall\.(io|com)/, (r) => r.abort());

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
  await page.screenshot({ path: join(out, 'library.png') });
  await page.getByRole('button', { name: 'Decks' }).click();

  for (let gameNo = 0; gameNo < games; gameNo++) {
    console.log(`Game ${gameNo + 1}`);
    // Game 1: a themed deck (Lord of the Rings) vs Universal. Game 2: a creature type vs a plane.
    const pickers = page.locator('.picker');
    const themed = gameNo === 0 ? ['Franchises', 'The Lord of the Rings'] : ['Creature types', 'Dragons'];
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
    if (gameNo === 0) await page.screenshot({ path: join(out, 'setup.png') });

    await page.getByRole('button', { name: 'Start duel ▸' }).click();
    await page.waitForSelector('.board');
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
            await page.screenshot({ path: join(out, `board-${gameNo + 1}.png`) });
            shotTaken = true;
          }
          if (!(await clickButton('Attack ▸')) && !(await clickButton('End turn'))) await clickButton('Go to combat ▸');
          continue;
        }
        if (phase === 'Attack') {
          await clickButton('Select all');
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
      } else if (prompt.startsWith('You’re being attacked')) {
        // Block the first attacker with the first untapped creature, if we can.
        const mineFree = page.locator('.battlefield.you .perm:not(.tapped)');
        const atk = page.locator('.battlefield.opp .perm.attacking');
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
    check(await visible('.game-over'), `game ${gameNo + 1} reached the end (${castCount} cards played, ${attacks} attacks, ${blocksTried} blocking steps)`);
    check(castCount >= 5, 'the bot played lands and spells');
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
