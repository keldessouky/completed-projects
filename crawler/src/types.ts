import type { DoorKind, EnemyKind, LootTier, StatKey } from './config';

/** The seven attributes. */
export type Stats = Record<StatKey, number>;

/** Persistent save schema, version 3. See core/save.ts for migrations. */
export interface SaveData {
  v: 3;
  gold: number;
  /** highest floor index (0-based) the player may enter */
  unlocked: number;
  /** best clear time in seconds per floor; 0 = never cleared */
  bestTime: number[];
  /** whether each floor has been cleared at all */
  cleared: boolean[];
  level: number;
  xp: number;
  /** unspent attribute points */
  points: number;
  stats: Stats;
  /** achievement ids already earned */
  achievements: string[];
  totalRuns: number;
  totalDeaths: number;
  tutorialDone: boolean;
  /** a floor left in progress, restored on next boot; null when idle */
  inProgress: SavedRun | null;
  settings: {
    music: number;
    sfx: number;
    haptics: boolean;
    reducedMotion: boolean;
    shake: number;
  };
}

/** Enough of a live floor to put the player back where they were. */
export interface SavedRun {
  floor: number;
  /** seconds left on the floor clock */
  timeLeft: number;
  /** node ids already resolved */
  visited: string[];
  /** where the player currently stands */
  at: string;
  party: number;
  partyPeak: number;
  goldThisRun: number;
  xpThisRun: number;
  kills: number;
  /** blame tallies for the death broadcast */
  losses: [string, number][];
  hitHazard: boolean;
}

// ─────────────────────────── floor graph ───────────────────────────

export type NodeKind = 'entry' | 'corridor' | 'mob' | 'loot' | 'safe' | 'boss' | 'stairs';

export interface FloorNode {
  id: string;
  kind: NodeKind;
  /** graph column (0 = entry) and row within that column — layout only */
  layer: number;
  row: number;
  /**
   * Bidirectional adjacency. You walk the floor freely along these edges,
   * forwards or back, paying the travel cost each step — so rushing the boss
   * with a thin party and farming the map until the clock bites are both
   * real options.
   */
  links: string[];
  /** estimated clock cost in seconds, shown on the map */
  estSec: number;
  /** loot nodes only */
  tier?: LootTier;
  /** the encounter to run, for corridor/mob/boss nodes */
  enc?: EncounterDef;
}

export interface FloorDef {
  index: number;
  timeLimitSec: number;
  nodes: Record<string, FloorNode>;
  /** ids grouped by layer, for layout */
  layers: string[][];
  entry: string;
  boss: string;
  stairs: string;
  bossHp: number;
}

// ─────────────────────────── encounters ───────────────────────────

export interface EncounterDef {
  kind: 'corridor' | 'arena' | 'boss';
  /** corridor: design px of scroll. arena/boss: 0 */
  length: number;
  doors: DoorSpawn[];
  waves: WaveSpawn[];
  bossHp: number;
}

export interface DoorSpawn {
  /** distance along the corridor (design px) */
  at: number;
  left: DoorKind;
  right: DoorKind;
}

export interface WaveSpawn {
  /** corridor: track px. arena: seconds from encounter start. */
  at: number;
  kind: EnemyKind;
  count: number;
  /** lateral center of the cluster, design px from lane center */
  x: number;
}

/** Result of one encounter, handed back to the floor map. */
export interface EncounterResult {
  nodeId: string;
  survived: boolean;
  elapsedSec: number;
  /** set when the party wiped or the clock ran out */
  failReason: string;
}

/** Result of a whole floor, handed to the ending scenes. */
export interface FloorOutcome {
  floor: number;
  win: boolean;
  timeLeft: number;
  elapsedSec: number;
  partyAtEnd: number;
  partyPeak: number;
  goldEarned: number;
  xpEarned: number;
  kills: number;
  levelsGained: number;
  nodesVisited: number;
  nodesTotal: number;
  failReason: string;
  newAchievements: string[];
}

export const SCENES = [
  'boot', 'title', 'floormap', 'encounter', 'loot', 'safe', 'charsheet', 'clear', 'death',
] as const;
export type SceneId = (typeof SCENES)[number];
