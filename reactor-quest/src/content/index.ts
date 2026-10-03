import type { Deck, Level } from '../game/types';
import { deck1 } from './deck1';
import { deck2 } from './deck2';
import { deck3 } from './deck3';
import { deck4 } from './deck4';
import { deck5 } from './deck5';

export const DECKS: Deck[] = [deck1, deck2, deck3, deck4, deck5];

export const ALL_LEVELS: Level[] = DECKS.flatMap((d) => d.levels);

export function findLevel(id: string): { deck: Deck; level: Level; index: number } | undefined {
  for (const deck of DECKS) {
    const index = deck.levels.findIndex((l) => l.id === id);
    if (index >= 0) return { deck, level: deck.levels[index], index };
  }
  return undefined;
}
