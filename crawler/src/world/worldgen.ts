import { CONFIG, type EnemyKind } from '../config';
import {
  CAMP_NAMES, LAIR_NAME, NPC, RUIN_NAMES, SHRINE_NAMES, TOWN_NAMES,
} from '../flavour';
import type { Biome, NpcDef, Poi, Vec, WorldDef } from '../types';

/**
 * The world is generated once from a single seed and never stored: terrain is a
 * pure function of position, and the POI layout is deterministic, so a save only
 * has to record what the player *did* — where they went, what they killed, what
 * they picked up. That keeps saves tiny and makes the world identical across
 * devices without shipping a map file.
 */

// ─────────────────────────── noise ───────────────────────────

/** integer hash → [0,1); the basis for every layer below */
function hash2(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1274126177) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** classic value noise: bilinear-interpolated lattice with a smoothstep */
function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = smooth(xf), v = smooth(yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

/** three octaves is enough shape for a floor that is supposed to look built-over */
export function fbm(x: number, y: number, seed: number): number {
  return (
    valueNoise(x, y, seed) * 0.55 +
    valueNoise(x * 2.1, y * 2.1, seed + 17) * 0.3 +
    valueNoise(x * 4.3, y * 4.3, seed + 41) * 0.15
  );
}

// ─────────────────────────── biomes ───────────────────────────

const SEED = CONFIG.world.seed;

/**
 * Which biome sits at a world position.
 *
 * Two independent fields — elevation and wet — are crossed rather than one
 * noise being sliced into bands, so regions interlock instead of forming
 * concentric rings around the middle of the map.
 */
export function biomeAt(x: number, y: number): Biome {
  const s = 1 / 900;
  const elev = fbm(x * s, y * s, SEED);
  const wet = fbm(x * s + 100, y * s + 100, SEED + 999);
  if (elev < 0.36 && wet > 0.5) return 'swamp';
  if (elev > 0.63) return wet > 0.48 ? 'ruins' : 'waste';
  if (wet > 0.58) return 'forest';
  return 'grass';
}

/** 0..1 clutter density — drives grass tufts, rubble, trees per tile. */
export function clutterAt(x: number, y: number): number {
  return fbm(x / 260, y / 260, SEED + 313);
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

/** Camp populations get harder the further they sit from the first town. */
function campSpawns(r: () => number, far: number): EnemyKind[] {
  const out: EnemyKind[] = [];
  const n = CONFIG.poi.campSize;
  for (let i = 0; i < n; i++) {
    // `far` biases the whole roll, so the camps you can walk to from the first
    // town are rats and the ones across the map are not
    const roll = r() * 0.8 + far * 0.9;
    out.push(roll > 1.02 ? 'brute' : roll > 0.68 ? 'drone' : 'rat');
  }
  // the distant camps are run by a Foreman; the near ones are nobody's problem
  if (far > 0.5 && r() < 0.7) out.push('elite');
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
    p.x > 420 && p.y > 420 && p.x < size - 420 && p.y < size - 420 &&
    placed.every((q) => dist(p, q) >= CONFIG.poi.minSpacing);

  const put = (poi: Poi): void => { pois.push(poi); placed.push(poi); };

  // ── fixed anchors: two towns and the lair, spread across the map ──
  const townA: Poi = {
    id: 'town_a', kind: 'town', x: size * 0.2, y: size * 0.58, name: TOWN_NAMES[0],
    npcs: ['guide', 'broker', 'quartermaster'],
  };
  const townB: Poi = {
    id: 'town_b', kind: 'town', x: size * 0.56, y: size * 0.24, name: TOWN_NAMES[1],
    npcs: ['quartermaster'],
  };
  const lair: Poi = {
    id: 'lair', kind: 'lair', x: size * 0.84, y: size * 0.66, name: LAIR_NAME,
    spawns: ['brute', 'drone', 'elite', 'boss'],
  };
  put(townA); put(townB); put(lair);

  // ── scattered POIs by rejection sampling ──
  const scatter = (
    kind: 'camp' | 'ruin' | 'shrine', count: number, names: readonly string[],
  ): void => {
    for (let i = 0; i < count; i++) {
      let p: Vec | null = null;
      // bounded attempts: a crowded map should thin out, never hang
      for (let tries = 0; tries < 300 && !p; tries++) {
        const c = { x: 420 + r() * (size - 840), y: 420 + r() * (size - 840) };
        if (fits(c)) p = c;
      }
      if (!p) return;
      const far = Math.min(1, dist(p, townA) / (size * 0.75));
      put({
        id: `${kind}_${i}`,
        kind,
        x: p.x,
        y: p.y,
        name: names[i % names.length],
        spawns: kind === 'camp' ? campSpawns(r, far) : undefined,
      });
    }
  };
  scatter('camp', CONFIG.poi.camps, CAMP_NAMES);
  scatter('ruin', CONFIG.poi.ruins, RUIN_NAMES);
  scatter('shrine', CONFIG.poi.shrines, SHRINE_NAMES);

  // ── roads: town A → town B → lair, with a wobble so they aren't rulers ──
  const road = (a: Poi, b: Poi): Vec[] => {
    const steps = 8;
    const out: Vec[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const wob = i === 0 || i === steps ? 0 : (r() - 0.5) * 260;
      out.push({
        x: a.x + (b.x - a.x) * t + wob,
        y: a.y + (b.y - a.y) * t + (r() - 0.5) * (i === 0 || i === steps ? 0 : 260),
      });
    }
    return out;
  };

  // ── NPCs stand around town centres ──
  const npcs: NpcDef[] = [
    { id: 'guide', poi: 'town_a', dx: 0, dy: -58, name: NPC.guide.name, role: 'guide' },
    { id: 'broker', poi: 'town_a', dx: -72, dy: 34, name: NPC.broker.name, role: 'quests' },
    { id: 'quartermaster', poi: 'town_a', dx: 74, dy: 30, name: NPC.quartermaster.name, role: 'vendor' },
    { id: 'quartermaster_b', poi: 'town_b', dx: 0, dy: 52, name: NPC.quartermaster.name, role: 'vendor' },
  ];

  cached = {
    size,
    pois,
    npcs,
    roads: [road(townA, townB), road(townB, lair), road(townA, lair)],
    spawn: { x: townA.x, y: townA.y + 96 },
    lair: 'lair',
  };
  return cached;
}

export const poiById = (id: string): Poi | undefined => getWorld().pois.find((p) => p.id === id);
export const npcById = (id: string): NpcDef | undefined => getWorld().npcs.find((n) => n.id === id);

/** World position of an NPC, resolved through the POI they stand in. */
export function npcPos(n: NpcDef): Vec {
  const p = poiById(n.poi);
  return { x: (p?.x ?? 0) + n.dx, y: (p?.y ?? 0) + n.dy };
}

/**
 * How close a point is to the nearest road, in world units — capped, because
 * only the first few hundred units matter to the terrain painter.
 */
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
