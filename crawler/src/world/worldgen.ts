import { CONFIG, type EnemyKind } from '../config';
import { CAMP_NAMES, PAD_NAMES } from '../flavour';
import type { Vec } from '../iso';

/**
 * The world is generated once from a single seed and never stored: terrain is a
 * pure function of position and the layout is deterministic, so a save only has
 * to record what the player *did* — which camps are dead, which pads are spent,
 * how big the squad got.
 */

export type Biome = 'grass' | 'field' | 'scrub';
export type PoiKind = 'pad' | 'camp' | 'castle' | 'start';

export interface Poi {
  id: string;
  kind: PoiKind;
  x: number;
  y: number;
  name: string;
  /** camps only */
  spawns?: EnemyKind[];
}

export interface WorldDef {
  size: number;
  pois: Poi[];
  /** road waypoints, drawn into terrain and used to bias scatter */
  roads: Vec[][];
  spawn: Vec;
  castle: string;
}

// ─────────────────────────── noise ───────────────────────────

function hash2(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1274126177) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = smooth(xf), v = smooth(yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

export function fbm(x: number, y: number, seed: number): number {
  return (
    valueNoise(x, y, seed) * 0.6 +
    valueNoise(x * 2.2, y * 2.2, seed + 17) * 0.28 +
    valueNoise(x * 4.5, y * 4.5, seed + 41) * 0.12
  );
}

const SEED = CONFIG.world.seed;

/**
 * Ground variation. Deliberately only three shades of the same green — the
 * reference reads as one continuous sunlit field, and biome *borders* would
 * fight the structures for attention.
 */
export function biomeAt(x: number, y: number): Biome {
  const n = fbm(x / 620, y / 620, SEED);
  if (n > 0.58) return 'field';
  if (n < 0.4) return 'scrub';
  return 'grass';
}

/** 0..1 prop density — trees, rocks, fences. */
export function clutterAt(x: number, y: number): number {
  return fbm(x / 210, y / 210, SEED + 313);
}

// ─────────────────────────── layout ───────────────────────────

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Camps get meaner the closer they sit to the castle. */
function campSpawns(r: () => number, near: number): EnemyKind[] {
  const out: EnemyKind[] = [];
  for (let i = 0; i < CONFIG.poi.campSize; i++) {
    const roll = r() * 0.8 + near * 0.9;
    out.push(roll > 1.05 ? 'heavy' : roll > 0.7 ? 'archer' : 'grunt');
  }
  if (near > 0.55 && r() < 0.75) out.push('captain');
  return out;
}

let cached: WorldDef | null = null;

export function getWorld(): WorldDef {
  if (cached) return cached;

  const size = CONFIG.world.size;
  const r = rng(SEED);
  const pois: Poi[] = [];
  const placed: Vec[] = [];

  const fits = (p: Vec): boolean =>
    p.x > 280 && p.y > 280 && p.x < size - 280 && p.y < size - 280 &&
    placed.every((q) => dist(p, q) >= CONFIG.poi.minSpacing);

  const put = (poi: Poi): void => { pois.push(poi); placed.push(poi); };

  // ── the two fixed ends: where you start, and what you are walking toward ──
  const start: Poi = { id: 'start', kind: 'start', x: size * 0.16, y: size * 0.84, name: 'Muster' };
  const castle: Poi = { id: 'castle', kind: 'castle', x: size * 0.82, y: size * 0.18, name: 'The Keep' };
  put(start); put(castle);

  // ── scatter pads and camps between them ──
  const scatter = (kind: 'pad' | 'camp', count: number, names: readonly string[]): void => {
    for (let i = 0; i < count; i++) {
      let p: Vec | null = null;
      for (let tries = 0; tries < 400 && !p; tries++) {
        const c = { x: 280 + r() * (size - 560), y: 280 + r() * (size - 560) };
        if (fits(c)) p = c;
      }
      if (!p) return;
      const near = 1 - Math.min(1, dist(p, castle) / (size * 0.9));
      put({
        id: `${kind}_${i}`,
        kind,
        x: p.x,
        y: p.y,
        name: names[i % names.length],
        spawns: kind === 'camp' ? campSpawns(r, near) : undefined,
      });
    }
  };
  // pads first so the early ones are not crowded out by camps
  scatter('pad', CONFIG.poi.pads, PAD_NAMES);
  scatter('camp', CONFIG.poi.camps, CAMP_NAMES);

  // ── one meandering road from the muster point to the keep ──
  const road = (a: Poi, b: Poi): Vec[] => {
    const steps = 10;
    const out: Vec[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const edge = i === 0 || i === steps;
      out.push({
        x: a.x + (b.x - a.x) * t + (edge ? 0 : (r() - 0.5) * 300),
        y: a.y + (b.y - a.y) * t + (edge ? 0 : (r() - 0.5) * 300),
      });
    }
    return out;
  };

  cached = {
    size,
    pois,
    roads: [road(start, castle)],
    spawn: { x: start.x, y: start.y },
    castle: 'castle',
  };
  return cached;
}

export const poiById = (id: string): Poi | undefined => getWorld().pois.find((p) => p.id === id);

/** Distance to the nearest road, capped — only the first few hundred units matter. */
export function roadDist(x: number, y: number): number {
  let best = 1e9;
  for (const line of getWorld().roads) {
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i], b = line[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2));
      const d = Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t));
      if (d < best) best = d;
      if (best < 1) return best;
    }
  }
  return best;
}

/** True when a point sits inside a structure's footprint (no props, no coins). */
export function insideStructure(x: number, y: number): boolean {
  for (const p of getWorld().pois) {
    const rad = p.kind === 'castle' ? 340 : p.kind === 'start' ? 190 : 150;
    if (Math.hypot(p.x - x, p.y - y) < rad) return true;
  }
  return false;
}

/**
 * Loose coins scattered over the map, generated deterministically so a save
 * only has to remember which ones are gone.
 */
export function coinSpots(): Vec[] {
  const size = CONFIG.world.size;
  const n = Math.round((size * size) / 1_000_000 * CONFIG.coins.density * 1000 / 1000) * 1;
  const total = Math.max(60, Math.round(((size / 1000) ** 2) * CONFIG.coins.density * 12));
  const r = rng(SEED + 4242);
  const out: Vec[] = [];
  for (let i = 0; i < total * 3 && out.length < total; i++) {
    const p = { x: 120 + r() * (size - 240), y: 120 + r() * (size - 240) };
    if (insideStructure(p.x, p.y)) continue;
    // bias toward the road: coins are a trail, not confetti
    if (roadDist(p.x, p.y) > 260 && r() < 0.6) continue;
    out.push(p);
  }
  void n;
  return out;
}
