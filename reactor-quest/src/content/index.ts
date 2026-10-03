import type { Deck, Level } from '../game/types';
import { floor1 } from './floor1';
import { floor2 } from './floor2';
import { floor3 } from './floor3';
import { floor4 } from './floor4';
import { floor5 } from './floor5';
import { floor7 } from './floor7';
import { floor8 } from './floor8';
import { floor9 } from './floor9';

/** The floors of the station, in play order. */
export const DECKS: Deck[] = [floor1, floor2, floor3, floor4, floor5, floor7, floor8, floor9];

export const ALL_LEVELS: Level[] = DECKS.flatMap((d) => d.levels);

export function findLevel(id: string): { deck: Deck; level: Level; index: number } | undefined {
  for (const deck of DECKS) {
    const index = deck.levels.findIndex((l) => l.id === id);
    if (index >= 0) return { deck, level: deck.levels[index], index };
  }
  return undefined;
}
