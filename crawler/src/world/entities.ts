import { Sprite } from 'pixi.js';
import { CONFIG, ENEMY_KINDS, type EnemyKind } from '../config';
import { Pool } from '../core/pool';
import { depth, screenX, screenY } from '../iso';
import { LOOK_S, type Look } from '../anim';
import type { GameAtlas } from '../assets/atlas';
import type { Poi } from '../types';

/**
 * Everything that lives in world space and moves.
 *
 * Enemies are spawned from camp populations as the player approaches and
 * refunded to the pool when they fall far behind, so a 3600² field costs the
 * same as one crowded screen. Nothing is constructed during play.
 *
 * Positions are cartesian; only the sprite placement is isometric, and that is
 * a `screenX/screenY` call at draw time. Depth sorting uses `depth()`, which is
 * just the sum of the world axes.
 */

export interface Enemy {
  sp: Sprite;
  kind: EnemyKind;
  /** which alternate look this one wears; rolled once at spawn */
  variant: number;
  /** multiplies this one's move speed; the boss raises it when enraged */
  speedMul: number;
  x: number; y: number; px: number; py: number;
  /** knockback velocity, decayed every step */
  kx: number; ky: number;
  hp: number; maxHp: number;
  cd: number;
  flashT: number;
  /** −1 facing screen-left, 1 facing screen-right */
  face: number;
  /** walk-cycle position in cycles, advanced by distance travelled */
  walk: number;
  /** the facing last drawn */
  look: Look;
  /** counts down while the attack pose plays */
  attackT: number;
  /** leash anchor: where it was spawned */
  hx: number; hy: number;
  /** the camp whose population this belongs to */
  poi: string;
  aggro: boolean;
  /** walk-bob phase, so a pack doesn't move in lockstep */
  phase: number;
}

export interface Shot {
  sp: Sprite;
  x: number; y: number; px: number; py: number;
  vx: number; vy: number;
  dmg: number;
  life: number;
  maxLife: number;
  /** true when it came from your line */
  friendly: boolean;
}

/** A coin lying in the field, or one an enemy dropped. */
export interface Coin {
  sp: Sprite;
  x: number; y: number;
  /** hop-and-settle animation clock */
  t: number;
  value: number;
  /** index into the world's fixed coin table, or −1 for a drop */
  spot: number;
  /** magnet state: once hooked it flies to the hero and cannot be un-hooked */
  hooked: boolean;
  /** current magnet speed, world units/sec; ramps while hooked */
  mv: number;
  /** seconds since hooking, which drives the sideways arc */
  ht: number;
}

/** The biggest body in the game — the padding every proximity query needs. */
const MAX_ENEMY_RADIUS = Math.max(...ENEMY_KINDS.map((k) => CONFIG.enemies[k].radius));

/**
 * Uniform-grid spatial hash over the world.
 *
 * Rebuilt from scratch every simulation step — with ~120 live enemies that is
 * 120 inserts, far cheaper than the alternative it removes: 180 projectiles ×
 * 120 enemies is 21k pair tests per step, which at 120 Hz is 2.6M tests a
 * second and exactly the kind of thing that cooks a phone.
 */
export class SpatialHash {
  private cells = new Map<number, number[]>();
  constructor(private cell = 128) {}

  private key(x: number, y: number): number {
    // 16-bit fold: the world is 3600 units, so cell indices stay well inside
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
  coins: Pool<Coin>;
  hash = new SpatialHash();
  private scratch: number[] = [];

  constructor(
    atlas: GameAtlas,
    enemyLayer: import('pixi.js').Container,
    shotLayer: import('pixi.js').Container,
    coinLayer: import('pixi.js').Container,
  ) {
    this.enemies = new Pool<Enemy>(CONFIG.enemies.poolSize, () => {
      const sp = new Sprite(atlas.get('grunt_s_0'));
      // anchored at the feet: the sprite stands ON the ground plane point
      sp.anchor.set(0.5, 1);
      sp.visible = false;
      enemyLayer.addChild(sp);
      return {
        sp, kind: 'grunt', variant: 0, speedMul: 1, x: 0, y: 0, px: 0, py: 0, kx: 0, ky: 0,
        hp: 1, maxHp: 1, cd: 0, flashT: 0, face: 1, hx: 0, hy: 0,
        poi: '', aggro: false, phase: 0,
        walk: 0, look: LOOK_S, attackT: 0,
      };
    });

    this.shots = new Pool<Shot>(CONFIG.combat.shotPoolSize, () => {
      const sp = new Sprite(atlas.get('spear'));
      sp.anchor.set(0.5);
      sp.visible = false;
      shotLayer.addChild(sp);
      return {
        sp, x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0,
        dmg: 1, life: 0, maxLife: 1, friendly: true,
      };
    });

    this.coins = new Pool<Coin>(CONFIG.coins.poolSize, () => {
      const sp = new Sprite(atlas.get('coin'));
      sp.anchor.set(0.5, 1);
      sp.visible = false;
      coinLayer.addChild(sp);
      return { sp, x: 0, y: 0, t: 0, value: 1, spot: -1, hooked: false, mv: 0, ht: 0 };
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

  spawnEnemy(atlas: GameAtlas, kind: EnemyKind, x: number, y: number, poi: string): Enemy | null {
    const e = this.enemies.obtain();
    if (!e) return null;
    const stat = CONFIG.enemies[kind];
    e.kind = kind;
    // A camp of eight identical thugs reads as a decal, not a gang.
    e.variant = (Math.random() * 1024) | 0;
    e.speedMul = 1;
    e.x = e.px = e.hx = x;
    e.y = e.py = e.hy = y;
    e.kx = e.ky = 0;
    e.maxHp = e.hp = stat.hp;
    e.cd = Math.random() * CONFIG.enemies.contactInterval;
    e.flashT = 0;
    e.face = 1;
    e.poi = poi;
    e.aggro = false;
    e.phase = Math.random() * Math.PI * 2;
    e.walk = Math.random();
    e.look = LOOK_S;
    e.attackT = 0;
    e.sp.texture = atlas.get(atlas.variantKind(kind, e.variant) + '_s_0');
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
    dmg: number, friendly: boolean,
  ): void {
    const s = this.shots.obtain();
    if (!s) return;
    s.x = s.px = x; s.y = s.py = y;
    s.vx = vx; s.vy = vy;
    s.dmg = dmg;
    s.life = 0;
    s.maxLife = friendly ? CONFIG.combat.spearLife : CONFIG.combat.arrowLife;
    s.friendly = friendly;
    s.sp.texture = atlas.get(friendly ? 'spear' : 'arrow');
    // the flight angle is a SCREEN angle: a shot travelling world-east reads
    // as down-right, and pointing the sprite along the world vector would look
    // wrong by exactly the projection.
    s.sp.rotation = Math.atan2(screenY(vx, vy), screenX(vx, vy)) + Math.PI / 2;
    s.sp.visible = true;
  }

  /**
   * Put a coin in the field. `spot` ties it to the world's fixed coin table so
   * a save can record which ones are gone; drops pass −1.
   */
  spawnCoin(x: number, y: number, value: number, spot: number): Coin | null {
    const c = this.coins.obtain();
    if (!c) return null;
    c.x = x; c.y = y;
    c.t = spot >= 0 ? 1 : 0;   // table coins are already settled; drops hop
    c.value = value;
    c.spot = spot;
    c.hooked = false;
    c.mv = 0;
    c.ht = 0;
    c.sp.visible = true;
    c.sp.alpha = 1;
    return c;
  }

  takeCoin(i: number): void {
    this.coins.items[i].sp.visible = false;
    this.coins.release(i);
  }

  /** Depth-sort a layer's children by their world position. */
  static sortByDepth(layer: import('pixi.js').Container): void {
    layer.children.sort((a, b) => (a.zIndex - b.zIndex));
  }
}

/** The depth key a sprite should carry, given its world position. */
export const spriteDepth = (x: number, y: number): number => depth(x, y);

/** Where each member of a camp's population stands when it spawns. */
export function campPositions(poi: Poi): { x: number; y: number; kind: EnemyKind }[] {
  const out: { x: number; y: number; kind: EnemyKind }[] = [];
  const spawns = poi.spawns ?? [];
  spawns.forEach((kind, i) => {
    // captains hold the middle; everything else rings the fire
    if (kind === 'captain') { out.push({ x: poi.x, y: poi.y, kind }); return; }
    const a = (i / Math.max(1, spawns.length)) * Math.PI * 2;
    const r = CONFIG.poi.campRadius * (0.45 + (i % 3) * 0.2);
    out.push({ x: poi.x + Math.cos(a) * r, y: poi.y + Math.sin(a) * r, kind });
  });
  return out;
}
