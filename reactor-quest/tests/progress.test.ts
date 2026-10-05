import { describe, expect, test } from 'vitest';
import { ALL_LEVELS, DECKS } from '../src/content';
import { codeStars, crawlerLevel, emptySave, isUnlocked, maxXp, parseSave, quizStars, stationPower, xpToReach } from '../src/game/progress';
import { completeLevel, type Outcome } from '../src/game/rewards';

/** A deterministic random number generator, so loot and commentary are repeatable. */
export function seeded(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export const perfect: Outcome = { stars: 3, firstTry: true, failedRuns: 0, clean: true, perfect: true, seconds: 60, hour: 12 };

const first = ALL_LEVELS[0];
const second = ALL_LEVELS[1];

describe('stars', () => {
  test('hints and the solution cost stars; token-paid hints don\'t', () => {
    expect(codeStars({ hints: 0, freeHints: 0, solution: false })).toBe(3);
    expect(codeStars({ hints: 1, freeHints: 0, solution: false })).toBe(2);
    expect(codeStars({ hints: 3, freeHints: 0, solution: false })).toBe(1);
    expect(codeStars({ hints: 2, freeHints: 2, solution: false })).toBe(3);
    expect(codeStars({ hints: 2, freeHints: 1, solution: false })).toBe(2);
    expect(codeStars({ hints: 0, freeHints: 0, solution: true })).toBe(1);
  });
  test('quiz mistakes cost stars, never below one', () => {
    expect([0, 1, 2, 5].map(quizStars)).toEqual([3, 2, 1, 1]);
  });
});

describe('the levelling curve', () => {
  test('your first level clear is your first level-up', () => {
    expect(crawlerLevel(0).level).toBe(1);
    expect(maxXp(first)).toBeGreaterThanOrEqual(xpToReach(2));
  });
  test('levels get steadily (not wildly) harder', () => {
    const gaps = [2, 3, 4, 5, 10, 20, 30].map((l) => xpToReach(l + 1) - xpToReach(l));
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]).toBeGreaterThan(gaps[i - 1]);
    expect(gaps[gaps.length - 1] / gaps[0]).toBeLessThan(20);
  });
  test('clearing everything perfectly makes you a Reactor Architect', () => {
    let s = emptySave();
    const rng = seeded();
    for (const l of ALL_LEVELS) s = completeLevel(s, l, perfect, rng).save;
    const lvl = crawlerLevel(s.xp);
    expect(lvl.title).toBe('Reactor Architect');
    expect(lvl.level).toBeGreaterThanOrEqual(36);
  });
  test('every floor brings a level-up at least every three clears', () => {
    let s = emptySave();
    const rng = seeded();
    for (const deck of DECKS) {
      const before = crawlerLevel(s.xp).level;
      for (const l of deck.levels) s = completeLevel(s, l, perfect, rng).save;
      const ups = crawlerLevel(s.xp).level - before;
      expect(deck.levels.length / ups, deck.name).toBeLessThanOrEqual(3);
    }
  });
});

describe('unlocking', () => {
  test('levels open in order, or all at once', () => {
    let s = emptySave();
    expect(isUnlocked(s, first.id)).toBe(true);
    expect(isUnlocked(s, second.id)).toBe(false);
    s = completeLevel(s, first, perfect, seeded()).save;
    expect(isUnlocked(s, second.id)).toBe(true);
    expect(isUnlocked({ ...emptySave(), unlockAll: true }, ALL_LEVELS.at(-1)!.id)).toBe(true);
  });
  test('a floor\'s boss is open as soon as you reach the floor, and beating it opens the next floor', () => {
    const floor1 = DECKS[0];
    const boss = floor1.levels.at(-1)!;
    let s = emptySave();
    expect(isUnlocked(s, boss.id)).toBe(true);
    expect(isUnlocked(s, DECKS[1].levels[0].id)).toBe(false);
    expect(isUnlocked(s, DECKS[1].levels.at(-1)!.id)).toBe(false);
    s = completeLevel(s, boss, perfect, seeded()).save;
    expect(isUnlocked(s, DECKS[1].levels[0].id)).toBe(true);
  });
  test('station power reaches 100% when every level is done', () => {
    let s = emptySave();
    expect(stationPower(s)).toBe(0);
    for (const l of ALL_LEVELS) s = completeLevel(s, l, perfect, seeded()).save;
    expect(stationPower(s)).toBe(100);
  });
});

describe('save parsing', () => {
  test('garbage falls back to a fresh save', () => {
    expect(parseSave(null)).toEqual(emptySave());
    expect(parseSave('not json')).toEqual(emptySave());
    expect(parseSave('{"v":99}')).toEqual(emptySave());
  });
  test('fields are validated one by one', () => {
    const s = parseSave(JSON.stringify({ v: 2, xp: -5, gold: 'lots', levels: { a: { done: true, stars: 9, code: 'x' }, b: 'nope' }, sound: false, equipped: { title: 'not-owned' } }));
    expect(s.xp).toBe(0);
    expect(s.gold).toBe(0);
    expect(s.levels.a).toEqual({ done: true, stars: 3, hints: 0, freeHints: 0, solution: false, runs: 0, code: 'x' });
    expect(s.levels.b).toBeUndefined();
    expect(s.sound).toBe(false);
    expect(s.equipped.title).toBe('title-crawler');
  });
  test('a save round-trips', () => {
    let s = emptySave();
    for (const l of ALL_LEVELS.slice(0, 15)) s = completeLevel(s, l, perfect, seeded()).save;
    expect(parseSave(JSON.stringify(s))).toEqual(s);
  });
  test('a version-1 save is migrated, keeping progress and crediting skills', () => {
    const v1 = { v: 1, xp: 450, arcadeBest: 12, arcadeCombo: 4, flags: { firstTry: true }, sound: true, unlockAll: false, levels: { 'power-bus': { done: true, stars: 3, hints: 0, solution: false, runs: 1 } } };
    const s = parseSave(JSON.stringify(v1));
    expect(s.v).toBe(2);
    expect(s.xp).toBe(450);
    expect(s.arcadeBest).toBe(12);
    expect(s.levels['power-bus'].stars).toBe(3);
    expect(s.skills.types).toBe(1);
    expect(s.counters.levelsPassed).toBe(1);
  });
});
