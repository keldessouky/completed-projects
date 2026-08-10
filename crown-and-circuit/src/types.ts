import type { EraId, MetaKey } from './config';

/** Persistent save, version 1. */
export interface SaveData {
  v: 1;
  shards: number;
  bestWave: number;
  bestEra: EraId;
  runs: number;
  wins: number;
  tutorialDone: boolean;
  meta: Record<MetaKey, number>;
  settings: {
    music: number;
    sfx: number;
    haptics: boolean;
    reducedMotion: boolean;
    shake: number;
  };
}

/** Handed to the results screen when a run ends. */
export interface RunResult {
  won: boolean;
  wave: number;          // waves fully cleared
  era: EraId;
  coinsBanked: number;
  kills: number;
  structures: number;
  shardsEarned: number;
  newBest: boolean;
  durationSec: number;
  /** one-line cause of death for the fail screen */
  epitaph: string;
}

/** An upgrade card offered between waves. */
export interface CardDef {
  id: string;
  title: string;
  body: string;
  icon: string;
  apply: () => void;
}
