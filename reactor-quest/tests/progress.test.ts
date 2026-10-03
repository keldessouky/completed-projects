import { describe, expect, test } from 'vitest';
import { ALL_LEVELS, DECKS } from '../src/content';
import { codeStars, complete, earnedIds, emptySave, isUnlocked, maxXp, parseSave, quizStars, rankOf, stationPower } from '../src/game/progress';

const first = ALL_LEVELS[0];
const second = ALL_LEVELS[1];

describe('stars', () => {
  test('hints and the solution cost stars', () => {
    expect(codeStars({ hints: 0, solution: false })).toBe(3);
    expect(codeStars({ hints: 1, solution: false })).toBe(2);
    expect(codeStars({ hints: 3, solution: false })).toBe(1);
    expect(codeStars({ hints: 0, solution: true })).toBe(1);
  });
  test('quiz mistakes cost stars, never below one', () => {
    expect([0, 1, 2, 5].map(quizStars)).toEqual([3, 2, 1, 1]);
  });
});

describe('completing levels', () => {
  test('XP is paid only for improving your best', () => {
    let s = emptySave();
    const a = complete(s, first, 1);
    expect(a.xpGained).toBe(Math.round(maxXp(first) / 3));
    s = a.save;
    expect(complete(s, first, 1).xpGained).toBe(0);
    const b = complete(s, first, 3);
    expect(b.save.xp).toBe(maxXp(first));
    expect(complete(b.save, first, 2).save.levels[first.id].stars).toBe(3);
  });

  test('levels unlock in order, or all at once', () => {
    let s = emptySave();
    expect(isUnlocked(s, first.id)).toBe(true);
    expect(isUnlocked(s, second.id)).toBe(false);
    s = complete(s, first, 3).save;
    expect(isUnlocked(s, second.id)).toBe(true);
    expect(isUnlocked({ ...emptySave(), unlockAll: true }, ALL_LEVELS.at(-1)!.id)).toBe(true);
  });

  test('station power and ranks follow progress', () => {
    let s = emptySave();
    expect(stationPower(s)).toBe(0);
    for (const l of ALL_LEVELS) s = complete(s, l, 3).save;
    expect(stationPower(s)).toBe(100);
    expect(rankOf(s.xp).name).toBe('Reactor Architect');
    expect(rankOf(0).name).toBe('Cadet');
  });

  test('perfect play earns every level achievement', () => {
    let s = emptySave();
    for (const l of ALL_LEVELS) s = complete(s, l, 3).save;
    const got = earnedIds(s);
    for (const id of ['first-light', 'self-taught', 'flawless', ...DECKS.map((_, i) => `deck-${i + 1}`)]) expect(got.has(id)).toBe(true);
  });
});

describe('save parsing', () => {
  test('garbage falls back to a fresh save', () => {
    expect(parseSave(null)).toEqual(emptySave());
    expect(parseSave('not json')).toEqual(emptySave());
    expect(parseSave('{"v":99}')).toEqual(emptySave());
  });
  test('fields are validated one by one', () => {
    const s = parseSave(JSON.stringify({ v: 1, xp: -5, arcadeBest: 'lots', levels: { a: { done: true, stars: 9, code: 'x' }, b: 'nope' }, sound: false }));
    expect(s.xp).toBe(0);
    expect(s.arcadeBest).toBe(0);
    expect(s.levels.a).toEqual({ done: true, stars: 3, hints: 0, solution: false, runs: 0, code: 'x' });
    expect(s.levels.b).toBeUndefined();
    expect(s.sound).toBe(false);
  });
  test('a save round-trips', () => {
    const s = complete(emptySave(), first, 2).save;
    expect(parseSave(JSON.stringify(s))).toEqual(s);
  });
});
