import type { UpgradeKey } from './config';

/** Persistent save schema, version 2. See core/save.ts for migrations. */
export interface SaveData {
  v: 2;
  coins: number;
  /** highest stage index (0-based) the player may enter; stage 0 always open */
  unlocked: number;
  /** stars per stage, 0-3, length 12 */
  stars: number[];
  /** best squad-alive-at-breach per stage, length 12 */
  bestSquad: number[];
  totalRuns: number;
  tutorialDone: boolean;
  upgrades: Record<UpgradeKey, number>;
  settings: {
    music: number;        // 0..1
    sfx: number;          // 0..1
    haptics: boolean;
    reducedMotion: boolean; // user override; OS prefers-reduced-motion also honored
    shake: number;        // 0..1 screen-shake intensity
  };
}

/** Outcome carried from the run scene to results/fail screens. */
export interface RunOutcome {
  stage: number;
  win: boolean;
  /** squad alive at the moment the boss died (or when the run ended) */
  squadAtEnd: number;
  squadPeak: number;
  coinsEarned: number;
  stars: number;          // 0 on fail
  newBestSquad: boolean;
  firstClear: boolean;
  /** one-line diagnostic for the fail screen, e.g. "You lost 40 units to the scorpion wave." */
  failReason: string;
  durationSec: number;
}

/** A single stage's generated layout. */
export interface StageDef {
  index: number;
  chapter: number;         // 0..2
  durationSec: number;
  trackLength: number;     // design px of scroll before the boss
  gates: GateSpawn[];
  waves: WaveSpawn[];
  bossHp: number;
  star2At: number;         // squad thresholds at boss death
  star3At: number;
}

export interface GateSpawn {
  /** distance along the track (design px) where the pair sits */
  at: number;
  left: import('./config').GateKind;
  right: import('./config').GateKind;
}

export interface WaveSpawn {
  at: number;
  kind: import('./config').EnemyKind;
  count: number;
  /** lateral center of the cluster, design px from lane center */
  x: number;
}

export const SCENES = ['boot', 'title', 'map', 'upgrade', 'run', 'results', 'fail', 'victory'] as const;
export type SceneId = (typeof SCENES)[number];
