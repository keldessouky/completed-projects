import { CONFIG, type EnemyKind, type GateKind } from '../config';
import type { GateSpawn, StageDef, WaveSpawn } from '../types';

/** mulberry32 — layouts are seeded per stage, identical on every attempt. */
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

/**
 * Gate-pair composition per stage third:
 *  - Stage 0 exists to be won: every pair holds a clearly better side and
 *    traps only appear opposite a strong buff.
 *  - Later stages force real choices; the nastiest pairs offer a small gain
 *    against a catastrophic loss, so steering keeps mattering.
 */
function makeGatePair(r: () => number, stage: number, slot: number, slots: number): [GateKind, GateKind] {
  const early = stage === 0 || slot < 2; // opening pairs of any stage stay kind
  const trapRoll = r() < CONFIG.stages.trapRatio(stage) && !early;
  const smallBuffs: GateKind[] = ['add5', 'add10'];
  const bigBuffs: GateKind[] = stage < 2 ? ['x2', 'add10'] : slot > slots - 3 ? ['x2', 'x3'] : ['x2'];
  if (!trapRoll) {
    // buff vs buff: one side strictly better — a reward for reading the glyphs
    const a = pick(r, smallBuffs);
    const b = pick(r, bigBuffs);
    return r() < 0.5 ? [a, b] : [b, a];
  }
  const trap: GateKind = stage < 4 ? 'sub5' : pick(r, ['sub5', 'half', 'pct50'] as const);
  const buff: GateKind = trap === 'sub5' ? pick(r, smallBuffs) : pick(r, bigBuffs);
  return r() < 0.5 ? [trap, buff] : [buff, trap];
}

function makeWaves(
  r: () => number, stage: number, chapter: number, track: number, gates: GateSpawn[], gateSpacing: number,
): WaveSpawn[] {
  const waves: WaveSpawn[] = [];
  const minutes = CONFIG.stages.durationSec(stage) / 60;
  const n = Math.round(CONFIG.stages.wavesPerMin(stage) * minutes);
  /** enemy mix widens by chapter: marsh husks → steppe scorpions → sky over the walls.
   *  Stage 1 skews to cheap scorpions so an early mistake costs 3, not 8. */
  const kinds: EnemyKind[] =
    stage === 0 ? ['scorpion', 'scorpion', 'golem', 'scorpion']
    : chapter === 0 ? ['golem', 'scorpion', 'golem', 'scorpion', 'scorpion']
    : chapter === 1 ? ['golem', 'scorpion', 'scorpion', 'anzu', 'scorpion']
    : ['golem', 'scorpion', 'anzu', 'anzu', 'scorpion', 'golem'];
  // let the player clear a few gates and build a squad before anything bites
  const lead = 700 + CONFIG.stages.waveLeadGates(stage) * gateSpacing;
  const usable = track - 700;   // …and nothing right at the boss door
  for (let i = 0; i < n; i++) {
    const at = lead + ((i + 0.3 + r() * 0.5) / n) * (usable - lead);
    // keep waves off gate lines so choices stay readable
    const nearGate = gates.some((g) => Math.abs(g.at - at) < 260);
    const kind = pick(r, kinds);
    const count = kind === 'golem' ? 1 + Math.floor(r() * 2 + stage * 0.15)
      : kind === 'anzu' ? 2 + Math.floor(r() * 2 + stage * 0.2)
      : 3 + Math.floor(r() * 3 + stage * 0.3);
    waves.push({
      at: nearGate ? at + 300 : at,
      kind,
      count: Math.min(count, 9),
      x: (r() * 2 - 1) * (CONFIG.hero.laneHalfWidth - 40),
    });
  }
  return waves.sort((a, b) => a.at - b.at);
}

const cache = new Map<number, StageDef>();

export function getStage(index: number): StageDef {
  const hit = cache.get(index);
  if (hit) return hit;
  const S = CONFIG.stages;
  const r = rng(S.seedBase + index * 7919);
  const chapter = Math.floor(index / S.perChapter);
  const durationSec = S.durationSec(index);
  const track = Math.round(durationSec * CONFIG.run.baseSpeed);

  const gates: GateSpawn[] = [];
  const spacing = S.gateEverySec(index) * CONFIG.run.baseSpeed;
  const slots = Math.floor((track - 1500) / spacing);
  for (let i = 0; i < slots; i++) {
    const at = 700 + i * spacing + r() * spacing * 0.18;
    const [left, right] = makeGatePair(r, index, i, slots);
    gates.push({ at, left, right });
  }

  const strong = S.strongSquad(index);
  const def: StageDef = {
    index,
    chapter,
    durationSec,
    trackLength: track,
    gates,
    waves: makeWaves(r, index, chapter, track, gates, spacing),
    bossHp: S.bossHp(index, CONFIG.boss.baseHp),
    star2At: Math.round(strong * S.stars2Frac),
    star3At: Math.round(strong * S.stars3Frac),
  };
  cache.set(index, def);
  return def;
}

export const chapterName = (c: number): string =>
  ['The Alluvial Marsh', 'The Open Steppe', 'The City of Walls'][c] ?? '?';

export const stageName = (i: number): string => {
  const names = [
    'Reed Gate', 'Silt Crossing', 'Heron Shallows', 'The Drowned Shrine',
    'First Steppe', 'Wind Scar', 'Terebinth Road', 'The Broken Caravan',
    'Outer Walls', 'Processional Way', 'Glazed Court', 'The Ziggurat Crown',
  ];
  return names[i] ?? `Stage ${i + 1}`;
};
