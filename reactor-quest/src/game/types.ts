import type { ReactElement, ReactNode, createElement } from 'react';
import type { Module, View, Mock, expect as expectFn } from '../engine/runtime';
import type { SkillId } from './skills';

/** Everything a level check gets to work with. */
export interface Kit {
  /** The player's exports. */
  mod: Module;
  /** The player's source, for checks like "uses .map()". */
  source: string;
  h: typeof createElement;
  expect: typeof expectFn;
  render(el: ReactElement): Promise<View>;
  fn<A extends unknown[] = any[], R = any>(impl?: (...args: A) => R): Mock<A, R>;
  wait(ms: number): Promise<void>;
  /** How many timers the player's code has started and not yet cleared. */
  activeTimers(): number;
  /** Every line the player's code has printed with console.log, so far. */
  logs: string[];
}

export interface Check {
  label: string;
  run(kit: Kit): void | Promise<void>;
}

/**
 * A type-level check: a TypeScript file that imports from './solution' and must
 * compile cleanly. Use `// @ts-expect-error` above lines your types must reject.
 */
export interface TypeCheck {
  label: string;
  code: string;
}

interface LevelBase {
  id: string;
  title: string;
  /** The station system this level restores — flavour for the map. */
  system: string;
  /** Story: what's broken and what ARIA asks of you. Mini-markdown. */
  brief: string;
  /** The concept, taught. Mini-markdown with code blocks. */
  lesson: string;
  /** The skills this level trains. */
  skills: SkillId[];
}

export interface CodeLevel extends LevelBase {
  kind: 'code';
  file: 'solution.ts' | 'solution.tsx';
  starter: string;
  solution: string;
  hints: string[];
  checks: Check[];
  typeChecks?: TypeCheck[];
  /** Render something live in the preview pane from the player's module. `log` writes to the console panel. */
  preview?: (mod: Module, h: typeof createElement, log: (line: string) => void) => ReactNode;
  boss?: boolean;
}

export interface Question {
  prompt: string;
  code?: string;
  options: string[];
  answer: number;
  explain: string;
}

export interface QuizLevel extends LevelBase {
  kind: 'quiz';
  questions: Question[];
}

export type Level = CodeLevel | QuizLevel;

export interface Deck {
  id: string;
  name: string;
  subtitle: string;
  /** One line on what you can do once this floor is cleared — shown on the map. */
  outcome: string;
  /** Accent colour for the deck on the map. */
  hue: number;
  levels: Level[];
}

/** A "does this compile?" review card. */
export interface CompileCard {
  code: string;
  /** Does this compile under strict mode? */
  ok: boolean;
  /** The level that teaches this card's idea: the card unlocks when it's cleared. */
  after: string;
  why: string;
}

/** One spaced-review question. */
export interface ReviewItem {
  id: string;
  /** The level whose clear unlocks this question. */
  after: string;
  prompt: string;
  code?: string;
  options: string[];
  answer: number;
  explain: string;
}
