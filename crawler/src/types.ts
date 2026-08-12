import type { EnemyKind } from './config';

/** A point in world space. */
export interface Vec { x: number; y: number; }

export type Biome = 'grass' | 'field' | 'scrub';
export type PoiKind = 'pad' | 'camp' | 'castle' | 'start';

export interface Poi {
  id: string;
  kind: PoiKind;
  x: number;
  y: number;
  name: string;
  /** camps only: what lives here */
  spawns?: EnemyKind[];
}

export interface WorldDef {
  size: number;
  pois: Poi[];
  roads: Vec[][];
  spawn: Vec;
  castle: string;
}

// ─────────────────────────── save ───────────────────────────

/**
 * Persistent save schema, version 5.
 *
 * The world is a pure function of the seed, so none of it is stored — only
 * what the player *did* to it: which camps are dead, which pads are drained,
 * which coins are picked up, and how big the crowd got.
 */
export interface SaveData {
  v: 5;
  coins: number;
  /** best squad size ever reached, kept across runs for the title card */
  bestSquad: number;
  achievements: string[];
  totalRuns: number;
  kills: number;
  playSec: number;
  tutorialDone: boolean;
  /** null until the field has been entered once */
  run: SavedRun | null;
  settings: {
    music: number;
    sfx: number;
    haptics: boolean;
    reducedMotion: boolean;
    shake: number;
  };
}

/** Everything about a run in progress that has to survive a force-quit. */
export interface SavedRun {
  x: number;
  y: number;
  squad: number;
  coins: number;
  /** camp ids whose population is dead */
  cleared: string[];
  /** pad id → recruits already taken from it */
  padsUsed: [string, number][];
  /** indices into coinSpots() that have been collected */
  coinsTaken: number[];
  gateHp: number;
  breached: boolean;
  /** true while the squad has never dropped below ten — an achievement gate */
  untouched: boolean;
}

export const SCENES = ['boot', 'title', 'world', 'death'] as const;
export type SceneId = (typeof SCENES)[number];
