// Every arcade card's verdict is checked against the real compiler.
import { describe, expect, test } from 'vitest';
import { ARCADE_CARDS } from '../src/content/arcade';
import { Checker } from '../src/engine/checker';
import typings from '../src/generated/typings.json';

const checker = new Checker(typings as Record<string, string>);

describe('arcade cards', () => {
  test.each(ARCADE_CARDS.map((c, i) => [i, c] as const))('card %i', (_i, card) => {
    const { diagnostics } = checker.check({ '/card.tsx': `${card.code}\nexport {};\n` });
    expect({ compiles: diagnostics.length === 0, errors: diagnostics.map((d) => d.message) }).toMatchObject({ compiles: card.ok });
  });

  test('a healthy mix of yes and no', () => {
    const yes = ARCADE_CARDS.filter((c) => c.ok).length;
    expect(yes).toBeGreaterThan(ARCADE_CARDS.length / 4);
    expect(yes).toBeLessThan((ARCADE_CARDS.length * 3) / 4);
  });
});
