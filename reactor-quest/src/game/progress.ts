// Save data, scoring and unlock rules. Pure functions over a plain object, so
// the rules are unit-testable; the store below persists it to localStorage.
import { DECKS, ALL_LEVELS } from '../content';
import type { Level } from './types';

export interface LevelProgress {
  done: boolean;
  stars: number; // best so far, 0–3
  hints: number; // hints revealed on the current attempt
  solution: boolean; // solution revealed on the current attempt
  runs: number; // runs on the current attempt
  code?: string; // the player's latest code, so leaving never loses work
}

export interface Save {
  v: 1;
  levels: Record<string, LevelProgress>;
  xp: number;
  arcadeBest: number;
  arcadeCombo: number;
  flags: { firstTry?: boolean; persistence?: boolean; quizPerfect?: boolean };
  sound: boolean;
  unlockAll: boolean;
}

export const emptySave = (): Save => ({
  v: 1,
  levels: {},
  xp: 0,
  arcadeBest: 0,
  arcadeCombo: 0,
  flags: { firstTry: false, persistence: false, quizPerfect: false },
  sound: true,
  unlockAll: false,
});

export const blankLevel = (): LevelProgress => ({ done: false, stars: 0, hints: 0, solution: false, runs: 0 });

export function levelState(save: Save, id: string): LevelProgress {
  return save.levels[id] ?? blankLevel();
}

/** Stars for a code level: hints and peeking at the solution cost stars. */
export function codeStars(p: Pick<LevelProgress, 'hints' | 'solution'>): number {
  if (p.solution) return 1;
  return 3 - Math.min(p.hints, 2);
}

/** Stars for a quiz: one off per wrong answer, never below 1. */
export function quizStars(mistakes: number): number {
  return Math.max(1, 3 - mistakes);
}

export function maxXp(level: Level): number {
  if (level.kind === 'quiz') return 60;
  return level.boss ? 250 : 100;
}

export function xpFor(level: Level, stars: number): number {
  return Math.round((maxXp(level) * stars) / 3);
}

/** Record a completion; XP is only paid for improving your best stars. */
export function complete(save: Save, level: Level, stars: number): { save: Save; xpGained: number } {
  const prev = levelState(save, level.id);
  const best = Math.max(prev.stars, stars);
  const xpGained = xpFor(level, best) - xpFor(level, prev.stars);
  return {
    xpGained,
    save: { ...save, xp: save.xp + xpGained, levels: { ...save.levels, [level.id]: { ...prev, done: true, stars: best } } },
  };
}

export function isUnlocked(save: Save, id: string): boolean {
  if (save.unlockAll) return true;
  const index = ALL_LEVELS.findIndex((l) => l.id === id);
  if (index <= 0) return index === 0;
  return levelState(save, ALL_LEVELS[index - 1].id).done || levelState(save, id).done;
}

export function stationPower(save: Save): number {
  const done = ALL_LEVELS.filter((l) => levelState(save, l.id).done).length;
  return Math.round((done / ALL_LEVELS.length) * 100);
}

export const RANKS = [
  { xp: 0, name: 'Cadet' },
  { xp: 200, name: 'Junior Engineer' },
  { xp: 600, name: 'Engineer' },
  { xp: 1200, name: 'Senior Engineer' },
  { xp: 2000, name: 'Staff Engineer' },
  { xp: 3000, name: 'Principal Engineer' },
  { xp: 4000, name: 'Reactor Architect' },
];

export function rankOf(xp: number) {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i++;
  const next = RANKS[i + 1];
  return {
    name: RANKS[i].name,
    index: i,
    next: next?.name,
    progress: next ? (xp - RANKS[i].xp) / (next.xp - RANKS[i].xp) : 1,
    toNext: next ? next.xp - xp : 0,
  };
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned(save: Save): boolean;
}

const bossDone = (deckIndex: number) => (s: Save) => {
  const deck = DECKS[deckIndex];
  return !!deck && deck.levels.every((l) => levelState(s, l.id).done);
};
const threeStarCount = (s: Save) => Object.values(s.levels).filter((l) => l.stars === 3).length;

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-light', name: 'First Light', icon: '💡', description: 'Restore your first system.', earned: (s) => Object.values(s.levels).some((l) => l.done) },
  { id: 'first-try', name: 'First Try', icon: '🎯', description: 'Pass a code level on your very first run.', earned: (s) => !!s.flags.firstTry },
  { id: 'persistence', name: 'Persistence', icon: '🔧', description: 'Pass a level after 5 or more failed runs.', earned: (s) => !!s.flags.persistence },
  { id: 'self-taught', name: 'Self-Taught', icon: '📘', description: 'Earn 3 stars on 5 levels.', earned: (s) => threeStarCount(s) >= 5 },
  { id: 'sharp-eye', name: 'Sharp Eye', icon: '👁', description: 'Finish a quiz without a single mistake.', earned: (s) => !!s.flags.quizPerfect },
  { id: 'deck-1', name: 'Type Founder', icon: '🔩', description: 'Clear the Type Foundry.', earned: bossDone(0) },
  { id: 'deck-2', name: 'Lab Director', icon: '🧪', description: 'Clear the Generics Lab.', earned: bossDone(1) },
  { id: 'deck-3', name: 'Component Architect', icon: '🧩', description: 'Clear the Component Bay.', earned: bossDone(2) },
  { id: 'deck-4', name: 'Mission Controller', icon: '🎛', description: 'Clear the Control Room.', earned: bossDone(3) },
  { id: 'deck-5', name: 'Station Restored', icon: '☢', description: 'Reboot the reactor core.', earned: bossDone(4) },
  { id: 'flawless', name: 'Flawless Deck', icon: '⭐', description: '3 stars on every level of a deck.', earned: (s) => DECKS.some((d) => d.levels.every((l) => levelState(s, l.id).stars === 3)) },
  { id: 'human-compiler', name: 'Human Compiler', icon: '🧠', description: 'Score 10 in Compiler Says.', earned: (s) => s.arcadeBest >= 10 },
  { id: 'strict-mode', name: 'tsc --strict', icon: '⚡', description: 'Score 20 in Compiler Says.', earned: (s) => s.arcadeBest >= 20 },
  { id: 'on-a-roll', name: 'On a Roll', icon: '🔥', description: 'An 8-card streak in Compiler Says.', earned: (s) => s.arcadeCombo >= 8 },
];

export function earnedIds(save: Save): Set<string> {
  return new Set(ACHIEVEMENTS.filter((a) => a.earned(save)).map((a) => a.id));
}

/** Validate untrusted JSON from storage field by field; anything odd falls back to defaults. */
export function parseSave(raw: string | null): Save {
  const base = emptySave();
  if (!raw) return base;
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || data.v !== 1) return base;
    const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d);
    const levels: Record<string, LevelProgress> = {};
    for (const [id, l] of Object.entries((data.levels ?? {}) as Record<string, any>)) {
      if (!l || typeof l !== 'object') continue;
      levels[id] = {
        done: l.done === true,
        stars: Math.min(3, num(l.stars, 0)),
        hints: Math.min(3, num(l.hints, 0)),
        solution: l.solution === true,
        runs: num(l.runs, 0),
        ...(typeof l.code === 'string' ? { code: l.code } : {}),
      };
    }
    const flags = typeof data.flags === 'object' && data.flags ? data.flags : {};
    return {
      v: 1,
      levels,
      xp: num(data.xp, 0),
      arcadeBest: num(data.arcadeBest, 0),
      arcadeCombo: num(data.arcadeCombo, 0),
      flags: { firstTry: flags.firstTry === true, persistence: flags.persistence === true, quizPerfect: flags.quizPerfect === true },
      sound: data.sound !== false,
      unlockAll: data.unlockAll === true,
    };
  } catch {
    return base;
  }
}
