import { CONFIG, type DoorKind, type EnemyKind, type LootTier } from '../config';
import type { DoorSpawn, EncounterDef, FloorDef, FloorNode, NodeKind, WaveSpawn } from '../types';

/** mulberry32 — a floor's layout is seeded, so it is identical on every attempt. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(r: () => number, arr: readonly T[]): T => arr[Math.floor(r() * arr.length) % arr.length];

const shuffle = <T,>(r: () => number, arr: T[]): T[] => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// ─────────────────────────── encounter content ───────────────────────────

/**
 * Door-pair composition.
 *  - Floor 1 exists to be survived: every pair holds a clearly better side and
 *    hazards only appear opposite a strong reward.
 *  - Later floors force real choices; the nastiest pairs offer a small gain
 *    against a catastrophic loss, so steering keeps mattering.
 */
function makeDoorPair(r: () => number, floor: number, slot: number, slots: number): [DoorKind, DoorKind] {
  const early = floor === 0 || slot < 2;
  const trapRoll = r() < CONFIG.encounter.trapRatio(floor) && !early;
  const smallBuffs: DoorKind[] = ['add5', 'add10'];
  const bigBuffs: DoorKind[] = floor < 2 ? ['x2', 'add10'] : slot > slots - 3 ? ['x2', 'x3'] : ['x2'];
  if (!trapRoll) {
    const a = pick(r, smallBuffs);
    const b = pick(r, bigBuffs);
    return r() < 0.5 ? [a, b] : [b, a];
  }
  const trap: DoorKind = floor < 4 ? 'sub5' : pick(r, ['sub5', 'half', 'pct50'] as const);
  const buff: DoorKind = trap === 'sub5' ? pick(r, smallBuffs) : pick(r, bigBuffs);
  return r() < 0.5 ? [trap, buff] : [buff, trap];
}

/** Mob mix widens with depth. Floor 1 skews to rats so an early mistake costs 3, not 8. */
function mobMix(floor: number): EnemyKind[] {
  if (floor === 0) return ['rat', 'rat', 'brute', 'rat'];
  if (floor < 4) return ['brute', 'rat', 'brute', 'rat', 'rat'];
  if (floor < 8) return ['brute', 'rat', 'rat', 'drone', 'rat'];
  return ['brute', 'rat', 'drone', 'drone', 'rat', 'brute'];
}

function waveCount(r: () => number, kind: EnemyKind, floor: number): number {
  const n = kind === 'brute' ? 1 + Math.floor(r() * 2 + floor * 0.15)
    : kind === 'drone' ? 2 + Math.floor(r() * 2 + floor * 0.2)
    : 3 + Math.floor(r() * 3 + floor * 0.3);
  return Math.min(n, 9);
}

function makeCorridor(r: () => number, floor: number): EncounterDef {
  const len = CONFIG.encounter.corridorLen(floor);
  const spacing = CONFIG.encounter.doorEverySec(floor) * CONFIG.run.baseSpeed;
  const slots = Math.max(1, Math.floor((len - 2200) / spacing));

  const doors: DoorSpawn[] = [];
  for (let i = 0; i < slots; i++) {
    const at = 700 + i * spacing + r() * spacing * 0.18;
    const [left, right] = makeDoorPair(r, floor, i, slots);
    doors.push({ at, left, right });
  }

  // Mobs hold off until a few door pairs have gone by. The opening of a tunnel
  // is for building the party, not fighting: a brute costs 8, so meeting one on
  // a party of six ends the run before it starts.
  const lead = 700 + CONFIG.encounter.waveLeadDoors(floor) * spacing;
  const usable = len - 700;
  const minutes = len / CONFIG.run.baseSpeed / 60;
  const n = Math.max(1, Math.round(CONFIG.encounter.wavesPerMin(floor) * minutes));
  const kinds = mobMix(floor);
  const waves: WaveSpawn[] = [];
  for (let i = 0; i < n; i++) {
    const at = lead + ((i + 0.3 + r() * 0.5) / n) * (usable - lead);
    // keep waves off door lines so the choice stays readable
    const nearDoor = doors.some((d) => Math.abs(d.at - at) < 260);
    const kind = pick(r, kinds);
    waves.push({
      at: nearDoor ? at + 300 : at,
      kind,
      count: waveCount(r, kind, floor),
      x: (r() * 2 - 1) * (CONFIG.hero.laneHalfWidth - 40),
    });
  }
  waves.sort((a, b) => a.at - b.at);
  return { kind: 'corridor', length: len, doors, waves, bossHp: 0 };
}

/** A nest: no scroll, waves on a timer, clear them all to leave. */
function makeArena(r: () => number, floor: number): EncounterDef {
  const n = CONFIG.encounter.arenaWaves(floor);
  const kinds = mobMix(floor);
  const waves: WaveSpawn[] = [];
  for (let i = 0; i < n; i++) {
    const kind = pick(r, kinds);
    waves.push({
      at: i * CONFIG.encounter.arenaWaveGap,
      kind,
      count: waveCount(r, kind, floor) + 1,
      x: (r() * 2 - 1) * (CONFIG.hero.laneHalfWidth - 40),
    });
  }
  return { kind: 'arena', length: 0, doors: [], waves, bossHp: 0 };
}

function makeBoss(floor: number): EncounterDef {
  return {
    kind: 'boss',
    length: 0,
    doors: [],
    waves: [],
    bossHp: CONFIG.floors.bossHp(floor, CONFIG.boss.baseHp),
  };
}

// ─────────────────────────── the graph ───────────────────────────

/**
 * Layer composition per floor. Guarantees the floor is playable and that a
 * player who explores is rewarded: at least one safe room, and enough
 * party-building nodes that a full sweep meaningfully out-scales a boss rush.
 */
function layerKinds(r: () => number, floor: number, layers: number): NodeKind[][] {
  const width = floor < 4 ? 2 : 3;
  const out: NodeKind[][] = [];

  // A bag sized to the graph, then dealt out — so the mix is stable in
  // proportion rather than drifting with the RNG.
  const bag: NodeKind[] = [];
  const total = layers * width;
  bag.push('safe');
  const rest = total - 1;
  for (let i = 0; i < rest; i++) {
    bag.push(i % 3 === 0 ? 'corridor' : i % 3 === 1 ? 'mob' : 'loot');
  }
  shuffle(r, bag);

  // The first layer is always a tunnel on at least one branch: the floor
  // should open with the verb the player just learned.
  const firstCorridor = bag.findIndex((k) => k === 'corridor');
  if (firstCorridor > 0) { [bag[0], bag[firstCorridor]] = [bag[firstCorridor], bag[0]]; }
  // …and the safe room should never be the very first thing you can reach.
  const safeAt = bag.indexOf('safe');
  if (safeAt < width) {
    const swap = width + Math.floor(r() * (bag.length - width));
    [bag[safeAt], bag[swap]] = [bag[swap], bag[safeAt]];
  }

  for (let l = 0; l < layers; l++) out.push(bag.slice(l * width, (l + 1) * width));
  return out;
}

export function getFloor(index: number): FloorDef {
  const hit = cache.get(index);
  if (hit) return hit;

  const F = CONFIG.floors;
  const r = rng(F.seedBase + index * 7919);
  const layers = F.layers(index);
  const kinds = layerKinds(r, index, layers);

  const nodes: Record<string, FloorNode> = {};
  const layout: string[][] = [];

  const add = (id: string, kind: NodeKind, layer: number, row: number): FloorNode => {
    const enc = kind === 'corridor' ? makeCorridor(r, index)
      : kind === 'mob' ? makeArena(r, index)
      : kind === 'boss' ? makeBoss(index)
      : undefined;
    const tier: LootTier | undefined = kind === 'loot'
      ? (r() < 0.16 ? 'gold' : r() < 0.45 ? 'silver' : 'bronze')
      : undefined;
    const estSec = kind === 'corridor' ? Math.round(CONFIG.encounter.corridorLen(index) / CONFIG.run.baseSpeed)
      : kind === 'mob' ? Math.round(CONFIG.encounter.arenaWaves(index) * CONFIG.encounter.arenaWaveGap + 12)
      : kind === 'loot' ? CONFIG.floors.lootCostSec
      : kind === 'safe' ? CONFIG.floors.safeCostSec
      : kind === 'boss' ? 45
      : 0;
    const n: FloorNode = { id, kind, layer, row, links: [], estSec, tier, enc };
    nodes[id] = n;
    return n;
  };

  // entry → middle layers → boss → stairs
  add('entry', 'entry', 0, 0);
  layout.push(['entry']);

  for (let l = 0; l < layers; l++) {
    const ids: string[] = [];
    kinds[l].forEach((kind, row) => {
      const id = `n${l}_${row}`;
      add(id, kind, l + 1, row);
      ids.push(id);
    });
    layout.push(ids);
  }

  add('boss', 'boss', layers + 1, 0);
  layout.push(['boss']);
  add('stairs', 'stairs', layers + 2, 0);
  layout.push(['stairs']);

  // Edges between adjacent layers. Every node gets at least one link forward
  // and every node in the next layer at least one link back, so no node is
  // ever stranded.
  const link = (a: string, b: string): void => {
    if (!nodes[a].links.includes(b)) nodes[a].links.push(b);
    if (!nodes[b].links.includes(a)) nodes[b].links.push(a);
  };

  for (let l = 0; l < layout.length - 1; l++) {
    const from = layout[l], to = layout[l + 1];
    for (const a of from) {
      const count = to.length === 1 ? 1 : 1 + (r() < 0.55 ? 1 : 0);
      for (const b of shuffle(r, [...to]).slice(0, count)) link(a, b);
    }
    // guarantee inbound coverage
    for (const b of to) {
      if (!from.some((a) => nodes[a].links.includes(b))) link(pick(r, from), b);
    }
  }

  const def: FloorDef = {
    index,
    timeLimitSec: F.timeLimitSec(index),
    nodes,
    layers: layout,
    entry: 'entry',
    boss: 'boss',
    stairs: 'stairs',
    bossHp: CONFIG.floors.bossHp(index, CONFIG.boss.baseHp),
  };
  cache.set(index, def);
  return def;
}

const cache = new Map<number, FloorDef>();

/** Every node except entry and stairs — what "visit everything" means. */
export function clearableNodes(def: FloorDef): string[] {
  return Object.keys(def.nodes).filter((id) => {
    const k = def.nodes[id].kind;
    return k !== 'entry' && k !== 'stairs';
  });
}
