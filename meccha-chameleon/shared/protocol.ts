// Shared contract between server and client: game constants, data shapes, and
// the socket message payloads. Keep this dependency-free so both sides can import it.

export const GRID = 8; // chameleon is an 8x8 grid of paint cells
export const SPRITE = 64; // rendered sprite size in px (cell = SPRITE/GRID)
export const CELL = SPRITE / GRID;

export const STAGE_W = 960;
export const STAGE_H = 600;

export const HIDE_MS = 45_000;
export const SEEK_MS = 60_000;
export const RESULTS_MS = 12_000;
export const TICK_MS = 80; // ~12.5 Hz state broadcast

// Scoring knobs (server-authoritative).
export const SURVIVE_TICK_POINTS = 6; // per seek tick, scaled by blend
export const RISK_MULTIPLIER = 1.5; // extra factor for exposure (open spots)
export const SURVIVE_BONUS = 400; // end-of-round bonus if never found, scaled by blend
export const FIND_POINTS = 300; // seeker reward for a correct tag, scaled by blend
export const MISS_PENALTY = 120; // seeker penalty for a wrong tag

export type Color = [number, number, number]; // rgb 0-255
export type Grid = Color[]; // length GRID*GRID
export type Pose = 'stand' | 'crouch' | 'ball' | 'flat';
export const POSES: Pose[] = ['stand', 'crouch', 'ball', 'flat'];

export type Phase = 'lobby' | 'hide' | 'seek' | 'results';
export type Role = 'hider' | 'seeker';

/** Pose masks: which of the GRID*GRID cells are solid body (true) vs empty. */
export const POSE_MASKS: Record<Pose, boolean[]> = {
  // full upright body
  stand: maskFromRows([
    '..####..',
    '..####..',
    '.######.',
    '.######.',
    '.######.',
    '.######.',
    '..####..',
    '..#..#..',
  ]),
  // shorter, wider
  crouch: maskFromRows([
    '........',
    '........',
    '.######.',
    '########',
    '########',
    '########',
    '.######.',
    '........',
  ]),
  // compact ball
  ball: maskFromRows([
    '........',
    '..####..',
    '.######.',
    '########',
    '########',
    '.######.',
    '..####..',
    '........',
  ]),
  // flattened against a surface
  flat: maskFromRows([
    '........',
    '........',
    '........',
    '########',
    '########',
    '########',
    '........',
    '........',
  ]),
};

function maskFromRows(rows: string[]): boolean[] {
  const out: boolean[] = [];
  for (const row of rows) for (const ch of row) out.push(ch === '#');
  return out;
}

export interface PlayerView {
  id: string;
  name: string;
  role: Role;
  x: number;
  y: number;
  pose: Pose;
  alive: boolean;
  score: number;
  ready: boolean;
  grid: Grid;
}

/** Lightweight per-tick player record (no grid). */
export interface PlayerTick {
  id: string;
  x: number;
  y: number;
  alive: boolean;
  score: number;
}

export interface Snapshot {
  phase: Phase;
  round: number;
  stageId: string;
  endsAt: number; // epoch ms when the current phase ends (0 in lobby)
  hostId: string;
  players: PlayerView[];
}

export interface Tick {
  remainingMs: number;
  players: PlayerTick[];
}

// ---- socket message names + payloads ----

export interface ClientToServer {
  join: (name: string) => void;
  startMatch: () => void;
  nextRound: () => void;
  move: (pos: { x: number; y: number }) => void;
  setPose: (pose: Pose) => void;
  paint: (grid: Grid) => void;
  tag: (pos: { x: number; y: number }) => void;
  toggleReady: () => void;
}

export interface ServerToClient {
  welcome: (youId: string) => void;
  snapshot: (s: Snapshot) => void;
  tick: (t: Tick) => void;
  paint: (p: { id: string; grid: Grid; pose: Pose }) => void;
  roundEnd: (r: { scores: { id: string; name: string; score: number }[] }) => void;
  errorMsg: (msg: string) => void;
}
