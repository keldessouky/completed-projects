import type { EnemyKind, GearSlot, GearTier, StatKey } from './config';

/** The seven attributes. */
export type Stats = Record<StatKey, number>;

/** A point in world space. */
export interface Vec { x: number; y: number; }

// ─────────────────────────── gear ───────────────────────────

export interface GearItem {
  /** stable id so equipment and inventory can reference the same object */
  id: string;
  slot: GearSlot;
  tier: GearTier;
  /** stat budget — the single number every gear effect derives from */
  budget: number;
  /** trinkets only: which attribute they boost */
  stat?: StatKey;
  /** generated display name */
  name: string;
}

// ─────────────────────────── world ───────────────────────────

export type Biome = 'grass' | 'forest' | 'ruins' | 'swamp' | 'waste';
export type PoiKind = 'town' | 'camp' | 'ruin' | 'shrine' | 'lair';

export interface Poi {
  id: string;
  kind: PoiKind;
  x: number;
  y: number;
  /** camps and the lair: what lives here */
  spawns?: EnemyKind[];
  /** towns: which vendor and quest-giver stand here */
  npcs?: string[];
  name: string;
}

export interface NpcDef {
  id: string;
  /** which POI they stand in, and their offset from its centre */
  poi: string;
  dx: number;
  dy: number;
  name: string;
  role: 'vendor' | 'quests' | 'guide';
}

export interface WorldDef {
  size: number;
  pois: Poi[];
  npcs: NpcDef[];
  /** road waypoints, drawn into terrain and used to bias travel */
  roads: Vec[][];
  spawn: Vec;
  lair: string;
}

// ─────────────────────────── quests ───────────────────────────

export type QuestGoal =
  | { type: 'kill'; kind: EnemyKind; count: number }
  | { type: 'clear'; poi: string }
  | { type: 'discover'; count: number }
  | { type: 'boss' };

export interface QuestDef {
  id: string;
  giver: string;
  title: string;
  brief: string;
  done: string;
  goal: QuestGoal;
  rewardGold: number;
  rewardXp: number;
  /** quest ids that must be complete before this one is offered */
  requires: string[];
}

export type QuestState = 'locked' | 'offered' | 'active' | 'ready' | 'done';

// ─────────────────────────── save ───────────────────────────

/** Persistent save schema, version 4. See core/save.ts for migrations. */
export interface SaveData {
  v: 4;
  gold: number;
  level: number;
  xp: number;
  points: number;
  stats: Stats;
  hp: number;
  achievements: string[];
  totalDeaths: number;
  kills: number;
  playSec: number;
  tutorialDone: boolean;
  /** null until the world has been entered once */
  world: SavedWorld | null;
  settings: {
    music: number;
    sfx: number;
    haptics: boolean;
    reducedMotion: boolean;
    shake: number;
  };
}

/** Everything about a world in progress that has to survive a force-quit. */
export interface SavedWorld {
  x: number;
  y: number;
  /** POI ids the player has been near */
  discovered: string[];
  /** POI ids whose population is dead, with the time they were cleared */
  cleared: [string, number][];
  /** shrine ids already used */
  shrines: string[];
  quests: [string, QuestState][];
  /** progress counters keyed by quest id */
  progress: [string, number][];
  inventory: GearItem[];
  equipped: Partial<Record<GearSlot, GearItem>>;
  /** run-length encoded fog: alternating unseen/seen counts over the fog grid */
  fog: number[];
  bossDown: boolean;
  /** the town the player respawns at */
  home: string;
}

export const SCENES = [
  'boot', 'title', 'world', 'charsheet', 'inventory', 'journal', 'shop', 'death',
] as const;
export type SceneId = (typeof SCENES)[number];
