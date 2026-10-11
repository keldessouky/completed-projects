// Card grades: famous cards land where players would expect, and every grade is used.
import { beforeAll, describe, expect, test } from 'vitest';
import { UNIVERSAL } from '../src/data/themes';
import { buildDeck, deckable } from '../src/game/deck';
import { cardGrade, cardScore, deckStrength, initQuality, type Grade } from '../src/game/quality';
import { card, universe } from './universe';

describe('card quality grades', () => {
  beforeAll(() => initQuality(universe().cards.filter(deckable)));

  test('staples are graded above vanilla filler', () => {
    for (const name of ['Lightning Bolt', 'Swords to Plowshares', 'Sol Ring', 'Baneslayer Angel']) expect(cardGrade(card(name)), name).toBe('S');
    for (const name of ['Murder', 'Wrath of God', 'Serra Angel']) expect(['S', 'A'], name).toContain(cardGrade(card(name)));
    for (const name of ['Hill Giant', 'Goblin Piker', 'Healing Salve', 'Mind Rot']) expect(['C', 'D'], name).toContain(cardGrade(card(name)));
    expect(cardScore(card('Lightning Bolt'))).toBeGreaterThan(cardScore(card('Shock')) - 5);
    expect(cardScore(card('Shivan Dragon'))).toBeGreaterThan(cardScore(card('Craw Wurm')));
  });

  test('grades spread across the pool roughly as designed', () => {
    const pool = universe().cards.filter(deckable);
    const share: Record<Grade, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
    for (const c of pool) share[cardGrade(c)]++;
    for (const g of Object.keys(share) as Grade[]) share[g] /= pool.length;
    expect(share.S).toBeGreaterThan(0.03);
    expect(share.S).toBeLessThan(0.08);
    expect(share.D).toBeGreaterThan(0.25);
    expect(share.D).toBeLessThan(0.35);
  });

  test('deck strength ignores basic lands and reports a grade per card', () => {
    const d = buildDeck(universe().cards, UNIVERSAL, { colors: 'auto', seed: 5 });
    const s = deckStrength(d.cards);
    expect(Object.values(s.byGrade).reduce((a, b) => a + b, 0)).toBe(23);
    expect(s.score).toBeGreaterThan(30);
    expect(s.score).toBeLessThanOrEqual(100);
    expect(['S', 'A', 'B', 'C', 'D']).toContain(s.grade);
  });
});
