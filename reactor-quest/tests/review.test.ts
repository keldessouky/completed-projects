// Every review card's verdict is checked against the real compiler, and every
// review question is tied to a real level that comes before or with its topic.
import { describe, expect, test } from 'vitest';
import { ALL_LEVELS, DECKS } from '../src/content';
import { COMPILE_CARDS, REVIEW_ITEMS } from '../src/content/review';
import { Checker } from '../src/engine/checker';
import typings from '../src/generated/typings.json';

const checker = new Checker(typings as Record<string, string>);

describe('compile cards', () => {
  test.each(COMPILE_CARDS.map((c, i) => [i + 1, c] as const))('card %i', (_i, card) => {
    const { diagnostics } = checker.check({ '/card.tsx': `${card.code}\nexport {};\n` });
    expect({ compiles: diagnostics.length === 0, errors: diagnostics.map((d) => d.message) }).toMatchObject({ compiles: card.ok });
  });

  test('a healthy mix of yes and no', () => {
    const yes = COMPILE_CARDS.filter((c) => c.ok).length;
    expect(yes).toBeGreaterThan(COMPILE_CARDS.length / 4);
    expect(yes).toBeLessThan((COMPILE_CARDS.length * 3) / 4);
  });

  test('no card unlocks before the TypeScript floors', () => {
    const firstTypeScriptLevel = ALL_LEVELS.findIndex((l) => l.id === 'power-bus');
    for (const c of COMPILE_CARDS) expect(ALL_LEVELS.findIndex((l) => l.id === c.after), c.after).toBeGreaterThanOrEqual(firstTypeScriptLevel);
  });
});

describe('review items', () => {
  test('ids are unique and every item unlocks from a real level', () => {
    expect(new Set(REVIEW_ITEMS.map((r) => r.id)).size).toBe(REVIEW_ITEMS.length);
    const ids = new Set(ALL_LEVELS.map((l) => l.id));
    for (const r of REVIEW_ITEMS) expect(ids.has(r.after), r.id).toBe(true);
  });

  test('every answer is one of the options', () => {
    for (const r of REVIEW_ITEMS) {
      expect(r.answer).toBeGreaterThanOrEqual(0);
      expect(r.answer).toBeLessThan(r.options.length);
    }
  });

  test('every floor contributes something to review', () => {
    for (const deck of DECKS) expect(REVIEW_ITEMS.some((r) => deck.levels.some((l) => l.id === r.after)), deck.name).toBe(true);
  });
});
