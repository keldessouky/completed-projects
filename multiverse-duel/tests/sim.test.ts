// AI-vs-AI games across many themes: every game must finish without an error.
import { describe, expect, test } from 'vitest';
import { buildThemes } from '../src/data/themes';
import { playOut } from '../src/game/ai';
import { buildDeck } from '../src/game/deck';
import { Game } from '../src/game/engine';
import { universe } from './universe';

describe('AI vs AI', () => {
  const u = universe();
  const themes = buildThemes(u);
  const sample = themes.filter((t, i) => t.group !== 'Sets' || i % 25 === 0);
  test(`plays ${sample.length} themed games to the end`, () => {
    const stats = { turns: 0, games: 0, wins: [0, 0, 0] };
    for (const [i, theme] of sample.entries()) {
      const a = buildDeck(u.cards, theme, { colors: 'auto', seed: i + 1 });
      const b = buildDeck(u.cards, themes[(i * 7) % themes.length], { colors: 'auto', seed: i + 1000 });
      expect(a.cards).toHaveLength(40);
      expect(b.cards).toHaveLength(40);
      const g = new Game([a.cards, b.cards], { seed: i + 7 });
      try {
        playOut(g);
      } catch (e) {
        console.error(`theme ${theme.name} turn ${g.turn}`, g.log.slice(-8));
        throw e;
      }
      expect(g.winner).not.toBeNull();
      stats.turns += g.turn;
      stats.games++;
      stats.wins[g.winner === "draw" ? 2 : (g.winner as number)]++;
    }
    console.log(`avg turns ${(stats.turns / stats.games).toFixed(1)}; wins`, stats.wins);
  });

  test.each([3, 4])('%i-player free-for-alls play to a single winner', (n) => {
    const places: number[][] = [];
    for (let i = 0; i < 12; i++) {
      const decks = Array.from({ length: n }, (_, k) => buildDeck(u.cards, themes[(i * 13 + k * 31) % themes.length], { colors: 'auto', seed: i * 10 + k }).cards);
      const g = new Game(decks, { seed: i + 99 });
      playOut(g);
      expect(g.winner).not.toBeNull();
      if (g.winner !== null && g.winner !== "draw") {
        expect(g.alive().map((p) => p.id)).toEqual([g.winner]);
        expect(g.players[g.winner].place).toBe(1);
        // Everyone else is out with a place from 2 to n, and has no permanents left.
        for (const p of g.players.filter((x) => x.id !== g.winner)) {
          expect(p.lost).toBe(true);
          expect(p.place).toBeGreaterThanOrEqual(2);
          expect(p.battlefield).toHaveLength(0);
        }
      }
      places.push(g.players.map((p) => p.place ?? 0));
    }
    console.log(`${n} players, finishing places by seat:`, places.map((p) => p.join('')).join(' '));
  });
});
