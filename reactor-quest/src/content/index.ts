import type { Deck, Level, Path, PathId } from '../game/types';
import { AIF } from './aws/aif';
import { CLF } from './aws/clf';
import { SAA } from './aws/saa';
import { floor1 } from './floor1';
import { floor2 } from './floor2';
import { floor3 } from './floor3';
import { floor4 } from './floor4';
import { floor5 } from './floor5';
import { floor6 } from './floor6';
import { floor7 } from './floor7';
import { floor8 } from './floor8';
import { floor9 } from './floor9';
import { floor10 } from './floor10';

/** The floors of the station (the TypeScript & React path), in play order. */
export const DECKS: Deck[] = [floor1, floor2, floor3, floor4, floor5, floor6, floor7, floor8, floor9, floor10];

export const ALL_LEVELS: Level[] = DECKS.flatMap((d) => d.levels);

export const REACTOR: Path = {
  id: 'reactor',
  name: 'TypeScript & React',
  short: 'TypeScript & React',
  tagline: 'From your first line of code to professional TypeScript and React.',
  icon: '⚛',
  decks: DECKS,
};

/** Every journey, in the order the path picker shows them. AWS certifications run foundational first, AI Practitioner leading. */
export const PATHS: Path[] = [REACTOR, AIF, CLF, SAA];
export const CERT_PATHS = PATHS.filter((p) => p.exam);
/** The certification an AWS journey starts with: AI Practitioner, a foundational exam. */
export const DEFAULT_CERT: PathId = 'aws-aif';

export const pathById = (id: PathId): Path => PATHS.find((p) => p.id === id) ?? REACTOR;
export const pathLevels = (path: Path): Level[] => path.decks.flatMap((d) => d.levels);

const LEVEL_PATH = new Map<string, Path>(PATHS.flatMap((p) => pathLevels(p).map((l) => [l.id, p] as const)));
/** The path a level belongs to. */
export const pathOfLevel = (id: string): Path | undefined => LEVEL_PATH.get(id);

export function findLevel(id: string): { deck: Deck; level: Level; index: number; path: Path } | undefined {
  const path = LEVEL_PATH.get(id);
  if (!path) return undefined;
  for (const deck of path.decks) {
    const index = deck.levels.findIndex((l) => l.id === id);
    if (index >= 0) return { deck, level: deck.levels[index], index, path };
  }
  return undefined;
}
