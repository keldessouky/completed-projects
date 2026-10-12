// The card universe, the theme catalogue and the deck builder.
import { describe, expect, test } from 'vitest';
import { buildThemes, searchTheme, UNIVERSAL } from '../src/data/themes';
import { buildDeck, deckable, fitsColors, LAND_COUNT } from '../src/game/deck';
import { card, universe } from './universe';

describe('the card universe', () => {
  test('holds every real card, once', () => {
    const u = universe();
    expect(u.cards.length).toBeGreaterThan(30_000);
    expect(new Set(u.cards.map((c) => c.fullName)).size).toBeGreaterThan(u.cards.length * 0.99);
    for (const name of ['Black Lotus', 'Lightning Bolt', 'Llanowar Elves', 'Gandalf the Grey', 'Sol Ring']) expect(card(name)).toBeTruthy();
    expect(card('Lightning Bolt').firstSet).toBe('lea');
  });

  test('no tokens, art cards or un-cards', () => {
    const u = universe();
    expect(u.cards.some((c) => c.typeLine.startsWith('Token'))).toBe(false);
    expect(u.cards.some((c) => c.typeLine.startsWith('Card'))).toBe(false);
  });
});

describe('themes', () => {
  const u = universe();
  const themes = buildThemes(u);
  const byId = (id: string) => themes.find((t) => t.id === id)!;

  test('every group is represented', () => {
    const groups = new Set(themes.map((t) => t.group));
    for (const g of ['Universal', 'Franchises', 'Planes', 'Creature types', 'Play styles', 'Eras', 'Sets']) expect(groups).toContain(g);
    expect(themes.filter((t) => t.group === 'Sets').length).toBeGreaterThan(150);
  });

  test('franchises use cards that debuted there, not reprints', () => {
    const lotr = byId('f-lotr');
    expect(lotr.match(card('Gandalf the Grey'))).toBe(true);
    expect(lotr.match(card('Sol Ring'))).toBe(false);
    expect(byId('f-warhammer').match(card('Lightning Bolt'))).toBe(false);
  });

  test('every non-set theme can make a 40-card deck', () => {
    for (const t of themes.filter((x) => x.group !== 'Sets')) {
      const d = buildDeck(u.cards, t, { colors: 'auto', seed: 42 });
      expect(d.cards, t.name).toHaveLength(40);
      expect(d.cards.filter((c) => c.types.includes('Land')), t.name).toHaveLength(LAND_COUNT);
      for (const c of d.cards) if (!c.types.includes('Land')) expect(fitsColors(c, d.colors), `${t.name}: ${c.name}`).toBe(true);
    }
  });

  test('themed decks are mostly on theme', () => {
    for (const id of ['f-lotr', 'f-warhammer', 'f-finalfantasy', 'p-innistrad', 'p-ravnica', 's-flyers', 'e-90s']) {
      const t = byId(id);
      const d = buildDeck(u.cards, t, { colors: 'auto', seed: 7 });
      const spells = d.cards.filter((c) => !c.types.includes('Land'));
      expect(spells.filter((c) => t.match(c)).length, t.name).toBeGreaterThanOrEqual(18);
    }
    const dragons = buildDeck(u.cards, byId('t-dragon'), { colors: 'auto', seed: 7 });
    expect(dragons.cards.filter((c) => c.subtypes.includes('Dragon')).length).toBeGreaterThanOrEqual(12);
  });

  test('chosen colours are respected and decks vary by seed', () => {
    const a = buildDeck(u.cards, UNIVERSAL, { colors: ['U', 'B'], seed: 1 });
    expect(a.colors).toEqual(['U', 'B']);
    expect(a.cards.filter((c) => !c.types.includes('Land')).every((c) => fitsColors(c, ['U', 'B']))).toBe(true);
    const b = buildDeck(u.cards, UNIVERSAL, { colors: ['U', 'B'], seed: 2 });
    expect(a.cards.map((c) => c.name)).not.toEqual(b.cards.map((c) => c.name));
  });

  test('every card in a generated deck is one the game can play', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const d = buildDeck(u.cards, UNIVERSAL, { colors: 'auto', seed });
      for (const c of d.cards) if (!c.types.includes('Land')) expect(deckable(c), c.name).toBe(true);
    }
  });

  test('free-text search themes', () => {
    const t = searchTheme('halfling');
    expect(t.match(card('Bilbo, Retired Burglar'))).toBe(true);
    expect(buildDeck(u.cards, t, { colors: 'auto', seed: 3 }).cards).toHaveLength(40);
  });

  test('must-have cards are always in the deck, and the colours stretch to cast them', () => {
    const ring = card('The One Ring');
    const familiar = card('Cauldron Familiar');
    const bolt = card('Lightning Bolt');
    for (let seed = 1; seed <= 10; seed++) {
      const d = buildDeck(u.cards, byId('f-lotr'), { colors: 'auto', seed, pinned: [ring, familiar, bolt] });
      expect(d.cards).toHaveLength(40);
      for (const c of [ring, familiar, bolt]) expect(d.cards, `seed ${seed}`).toContain(c);
      expect(d.colors).toEqual(expect.arrayContaining(['B', 'R']));
      for (const c of d.cards) if (!c.types.includes('Land')) expect(fitsColors(c, d.colors), c.name).toBe(true);
    }
    // Even with fixed colours, a must-have card brings its own colour along.
    const d = buildDeck(u.cards, UNIVERSAL, { colors: ['G'], seed: 4, pinned: [bolt] });
    expect(d.colors).toEqual(['R', 'G']);
    expect(d.cards).toContain(bolt);
  });
});

