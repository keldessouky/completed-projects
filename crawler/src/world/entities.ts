import { Sprite } from 'pixi.js';
import { CONFIG, type EnemyKind } from '../config';
import { Pool } from '../core/pool';
import type { GameAtlas } from '../assets/atlas';
import type { GearItem, Poi } from '../types';

/**
 * Everything that lives in world space and moves.
 *
 * Enemies are spawned from POI populations as the player approaches and
 * refunded to the pool when they fall far behind, so a 5120² world costs the
 * same as one crowded screen. Nothing is constructed during play.
 */

export interface Enemy {
  sp: Sprite;
  kind: EnemyKind;
  x: number; y: number; px: number; py: number;
  /** knockback velocity, decayed every step */
  kx: number; ky: number;
  hp: number; maxHp: number;
  cd: number;
  flashT: number;
  /** −1 facing left, 1 facing right */
  face: number;
  /** leash anchor: where it was spawned */
  hx: number; hy: number;
  /** the POI whose population this belongs to */
  poi: string;
  aggro: boolean;
  /** walk-bob phase, so a crowd doesn't move in lockstep */
  phase: number;
}

export interface Shot {
  sp: Sprite;
  x: number; y: number; px: number; py: number;
  vx: number; vy: number;
  dmg: number;
  life: number;
  /** true when it came from the player or Donut */
  friendly: boolean;
  crit: boolean;
}

export interface Drop {
  sp: Sprite;
  x: number; y: number;
  /** hop animation */
  t: number;
  life: number;
  /** exactly one of these is set */
  gold: number;
  gear: GearItem | null;
}

/** The biggest body in the game — the padding every proximity query needs. */
const MAX_ENEMY_RADIUS = Math.max(
  ...(['rat', 'brute', 'drone', 'elite', 'boss'] as const).map((k) => CONFIG.enemies[k].radius),
);

/**
 * Uniform-grid spatial hash over the world.
 *
 * Rebuilt from scratch every simulation step — with ~120 live enemies that is
 * 120 inserts, far cheaper than the alternative it removes: 220 projectiles ×
 * 120 enemies is 26k pair tests per step, which at 120 Hz is 3.2M tests a
 * second and exactly the kind of thing that cooks a phone.
 */
export class SpatialHash {
  private cells = new Map<number, number[]>();
  constructor(private cell = 128) {}

  private key(x: number, y: number): number {
    // 16-bit fold: the world is 5120 units, so cell indices stay well inside
    return ((Math.floor(x / this.cell) & 0xffff) << 16) | (Math.floor(y / this.cell) & 0xffff);
  }

  clear(): void { this.cells.clear(); }

  insert(x: number, y: number, index: number): void {
    const k = this.key(x, y);
    const list = this.cells.get(k);
    if (list) list.push(index);
    else this.cells.set(k, [index]);
  }

  /** Indices in the cells overlapping a circle. May include a few extras. */
  query(x: number, y: number, radius: number, out: number[]): number[] {
    out.length = 0;
    const c = this.cell;
    const x0 = Math.floor((x - radius) / c), x1 = Math.floor((x + radius) / c);
    const y0 = Math.floor((y - radius) / c), y1 = Math.floor((y + radius) / c);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const list = this.cells.get(((cx & 0xffff) << 16) | (cy & 0xffff));
        if (list) for (const i of list) out.push(i);
      }
    }
    return out;
  }
}

/** The three pools plus the hash, built once per world scene. */
export class Entities {
  enemies: Pool<Enemy>;
  shots: Pool<Shot>;
  drops: Pool<Drop>;
  hash = new SpatialHash();
  private scratch: number[] = [];

  constructor(
    atlas: GameAtlas,
    enemyLayer: import('pixi.js').Container,
    shotLayer: import('pixi.js').Container,
    dropLayer: import('pixi.js').Container,
  ) {
    this.enemies = new Pool<Enemy>(CONFIG.enemies.poolSize, () => {
      const sp = new Sprite(atlas.get('rat_s'));
      sp.anchor.set(0.5, 0.72);
      sp.visible = false;
      enemyLayer.addChild(sp);
      return {
        sp, kind: 'rat', x: 0, y: 0, px: 0, py: 0, kx: 0, ky: 0,
        hp: 1, maxHp: 1, cd: 0, flashT: 0, face: 1, hx: 0, hy: 0,
        poi: '', aggro: false, phase: 0,
      };
    });

    this.shots = new Pool<Shot>(CONFIG.combat.projPoolSize, () => {
      const sp = new Sprite(atlas.get('nail'));
      sp.anchor.set(0.5);
      sp.visible = false;
      shotLayer.addChild(sp);
      return { sp, x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, dmg: 1, life: 0, friendly: true, crit: false };
    });

    this.drops = new Pool<Drop>(64, () => {
      const sp = new Sprite(atlas.get('coinDrop'));
      sp.anchor.set(0.5, 0.8);
      sp.visible = false;
      dropLayer.addChild(sp);
      return { sp, x: 0, y: 0, t: 0, life: 0, gold: 0, gear: null };
    });
  }

  /** Rebuild the hash from the live enemy list. Call once per step. */
  reindex(): void {
    this.hash.clear();
    for (let i = 0; i < this.enemies.count; i++) {
      const e = this.enemies.items[i];
      this.hash.insert(e.x, e.y, i);
    }
  }

  /** Enemy indices whose bodies overlap a circle. */
  near(x: number, y: number, radius: number): number[] {
    // Pad the cell query by the largest body in the game: the hash returns
    // cells overlapping `radius`, but the actual test is against
    // `radius + enemy.radius`, so an enemy whose centre sits in the next cell
    // over can still be touching. Without the pad, projectiles pass through
    // anything that happens to straddle a cell boundary.
    const found = this.hash.query(x, y, radius + MAX_ENEMY_RADIUS, this.scratch);
    // the hash returns whole cells; narrow to an actual circle test
    let n = 0;
    for (const i of found) {
      const e = this.enemies.items[i];
      if (!e) continue;
      const r = radius + CONFIG.enemies[e.kind].radius;
      const dx = e.x - x, dy = e.y - y;
      if (dx * dx + dy * dy <= r * r) found[n++] = i;
    }
    found.length = n;
    return found;
  }

  /** Closest live enemy within range, or −1. */
  nearest(x: number, y: number, range: number): number {
    let best = -1;
    let bestD = range * range;
    for (const i of this.hash.query(x, y, range, this.scratch)) {
      const e = this.enemies.items[i];
      if (!e) continue;
      const dx = e.x - x, dy = e.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  spawnEnemy(atlas: GameAtlas, kind: EnemyKind, x: number, y: number, poi: string, hpScale = 1): Enemy | null {
    const e = this.enemies.obtain();
    if (!e) return null;
    const stat = CONFIG.enemies[kind];
    e.kind = kind;
    e.x = e.px = e.hx = x;
    e.y = e.py = e.hy = y;
    e.kx = e.ky = 0;
    e.maxHp = e.hp = Math.round(stat.hp * hpScale);
    e.cd = Math.random() * stat.cooldown;
    e.flashT = 0;
    e.face = 1;
    e.poi = poi;
    e.aggro = false;
    e.phase = Math.random() * Math.PI * 2;
    e.sp.texture = atlas.get(kind + '_s');
    e.sp.visible = true;
    e.sp.alpha = 1;
    e.sp.scale.set(1);
    return e;
  }

  killEnemy(i: number): void {
    const e = this.enemies.items[i];
    e.sp.visible = false;
    this.enemies.release(i);
  }

  spawnShot(
    atlas: GameAtlas, x: number, y: number, vx: number, vy: number,
    dmg: number, friendly: boolean, crit = false,
  ): void {
    const s = this.shots.obtain();
    if (!s) return;
    s.x = s.px = x; s.y = s.py = y;
    s.vx = vx; s.vy = vy;
    s.dmg = dmg;
    s.life = 0;
    s.friendly = friendly;
    s.crit = crit;
    s.sp.texture = atlas.get(friendly ? 'nail' : 'bolt');
    s.sp.rotation = Math.atan2(vy, vx) + Math.PI / 2;
    s.sp.visible = true;
  }

  spawnDrop(atlas: GameAtlas, x: number, y: number, gold: number, gear: GearItem | null): void {
    const d = this.drops.obtain();
    if (!d) return;
    d.x = x; d.y = y;
    d.t = 0;
    d.life = 0;
    d.gold = gold;
    d.gear = gear;
    d.sp.texture = atlas.get(gear ? 'gearDrop' : 'coinDrop');
    d.sp.tint = gear
      ? (gear.tier === 'prime' ? CONFIG.colors.amberBright
        : gear.tier === 'fine' ? CONFIG.colors.sysBright
        : gear.tier === 'solid' ? CONFIG.colors.goodTeal
        : CONFIG.colors.boneDim)
      : 0xffffff;
    d.sp.visible = true;
  }
}

/** Where each member of a POI's population stands when it spawns. */
export function campPositions(poi: Poi): { x: number; y: number; kind: EnemyKind }[] {
  const out: { x: number; y: number; kind: EnemyKind }[] = [];
  const spawns = poi.spawns ?? [];
  const isLair = poi.kind === 'lair';
  spawns.forEach((kind, i) => {
    if (kind === 'boss') { out.push({ x: poi.x, y: poi.y - 40, kind }); return; }
    const a = (i / Math.max(1, spawns.length)) * Math.PI * 2;
    const r = isLair ? 130 + (i % 3) * 46 : CONFIG.poi.campRadius * (0.45 + (i % 3) * 0.22);
    out.push({ x: poi.x + Math.cos(a) * r, y: poi.y + Math.sin(a) * r, kind });
  });
  return out;
}
