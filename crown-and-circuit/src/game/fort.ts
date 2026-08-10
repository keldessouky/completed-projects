import { CONFIG, type EraId, type StructureKind } from '../config';

export interface Pad {
  /** world position */
  x: number;
  y: number;
  ring: number;
  /** index within the ring, and the angle it sits at */
  slot: number;
  angle: number;
  /** null until something is built here */
  kind: StructureKind | null;
  level: number;
  /** era the structure was built/last upgraded in — drives its art and stats */
  era: EraId;
  hp: number;
  maxHp: number;
  /** coins deposited toward the current build/upgrade */
  progress: number;
  /** cost of the pending build/upgrade, 0 when nothing is pending */
  goal: number;
  /** what the pending deposit will produce */
  pending: StructureKind | null;
  /** >0 while destroyed; counts down to a free self-rebuild */
  rubble: number;
  /** weapon cooldown for towers */
  cool: number;
  /** last thing this tower shot at, so its garrison can face it */
  aimX: number;
  aimY: number;
  /** the cooldown this tower was reloaded to, for timing the firing pose */
  reload: number;
  /** transient visual pulse when it fires or is hit */
  flash: number;
}

export interface WallSpan {
  ring: number;
  /** angular span [a0, a1], normalised so a1 > a0 */
  a0: number;
  a1: number;
  /** the two pads it bridges */
  pa: number;
  pb: number;
  hp: number;
  maxHp: number;
  flash: number;
}

const TAU = Math.PI * 2;

/** normalise an angle into [0, TAU) */
export const norm = (a: number): number => {
  const m = a % TAU;
  return m < 0 ? m + TAU : m;
};

/**
 * The fort: concentric rings of authored build pads, with walls that appear
 * automatically between neighbouring built pads.
 *
 * Because rings are circles, wall collision is done in polar space: an enemy
 * crossing a ring radius inward is blocked if its angle falls inside a built
 * span. That is O(rings) per enemy instead of a segment test per wall.
 */
export class Fort {
  pads: Pad[] = [];
  walls: WallSpan[] = [];
  keepHp: number;
  keepMaxHp: number;
  /** rings unlocked so far (index < unlockedRings are buildable) */
  unlockedRings = 1;
  /** rebuilt whenever structures change: per-ring list of blocking spans */
  spans: WallSpan[][] = [];

  constructor(keepHpMult: number) {
    this.keepMaxHp = Math.round(CONFIG.fort.keepHp * keepHpMult);
    this.keepHp = this.keepMaxHp;
    const cx = CONFIG.world.fortCenter;
    const cy = CONFIG.world.fortCenter;
    for (let ring = 0; ring < CONFIG.fort.ringRadius.length; ring++) {
      const R = CONFIG.fort.ringRadius[ring];
      const n = CONFIG.fort.ringPads[ring];
      const off = CONFIG.fort.ringOffset[ring];
      this.spans.push([]);
      for (let s = 0; s < n; s++) {
        const angle = norm((s / n) * TAU + off);
        this.pads.push({
          x: cx + Math.cos(angle) * R,
          y: cy + Math.sin(angle) * R,
          ring, slot: s, angle,
          kind: null, level: 0, era: 0,
          hp: 0, maxHp: 0, progress: 0, goal: 0, pending: null,
          rubble: 0, cool: 0, flash: 0, aimX: 0, aimY: 1, reload: 1,
        });
      }
    }
  }

  padsOfRing(ring: number): Pad[] {
    return this.pads.filter((p) => p.ring === ring);
  }

  /** Cost of the next action on a pad, scaled by era and upgrade level. */
  cost(pad: Pad, kind: StructureKind, era: EraId): number {
    const base = CONFIG.fort.cost[kind];
    const eraMult = CONFIG.eras[era].costMult;
    const lvlMult = pad.kind ? Math.pow(CONFIG.fort.upgradeCostMult, pad.level) : 1;
    return Math.round(base * eraMult * lvlMult);
  }

  /** Complete a pending build/upgrade. */
  finish(pad: Pad, era: EraId): void {
    const kind = pad.pending;
    if (!kind) return;
    if (pad.kind === kind) {
      pad.level = Math.min(CONFIG.fort.upgradeMaxLevel, pad.level + 1);
    } else {
      pad.kind = kind;
      pad.level = 0;
    }
    pad.era = era;
    pad.maxHp = Math.round(
      (kind === 'tower' ? CONFIG.fort.towerHp : CONFIG.fort.towerHp * 0.8)
      * (1 + pad.level * 0.5) * (1 + era * 0.9),
    );
    pad.hp = pad.maxHp;
    pad.progress = 0;
    pad.goal = 0;
    pad.pending = null;
    pad.rubble = 0;
    this.rebuildWalls(era);
    this.checkRingUnlock();
  }

  private checkRingUnlock(): void {
    const frac = CONFIG.fort.ringUnlockFrac;
    while (this.unlockedRings < CONFIG.fort.ringRadius.length) {
      const ring = this.unlockedRings - 1;
      const pads = this.padsOfRing(ring);
      const built = pads.filter((p) => p.kind !== null).length;
      if (built / pads.length >= frac) this.unlockedRings++;
      else break;
    }
  }

  /** Walls exist between adjacent built pads on the same ring. */
  rebuildWalls(era: EraId): void {
    const prev = new Map<string, WallSpan>();
    for (const w of this.walls) prev.set(`${w.ring}:${w.pa}:${w.pb}`, w);
    this.walls = [];
    for (const list of this.spans) list.length = 0;

    for (let ring = 0; ring < CONFIG.fort.ringRadius.length; ring++) {
      const pads = this.padsOfRing(ring);
      const n = pads.length;
      for (let i = 0; i < n; i++) {
        const a = pads[i];
        const b = pads[(i + 1) % n];
        if (!a.kind || !b.kind || a.rubble > 0 || b.rubble > 0) continue;
        let a0 = a.angle;
        let a1 = b.angle;
        if (a1 <= a0) a1 += TAU;      // wraps past 0
        const key = `${ring}:${a.slot}:${b.slot}`;
        const old = prev.get(key);
        const maxHp = Math.round(CONFIG.fort.wallHp * (1 + era * 0.9));
        const wall: WallSpan = old
          ? { ...old, a0, a1, maxHp, hp: Math.min(old.hp, maxHp) }
          : { ring, a0, a1, pa: a.slot, pb: b.slot, hp: maxHp, maxHp, flash: 0 };
        this.walls.push(wall);
        this.spans[ring].push(wall);
      }
    }
  }

  /**
   * Does a wall block movement from radius `rFrom` to `rTo` at angle `ang`?
   * Returns the wall if blocked, else null.
   */
  blockingWall(ang: number, rFrom: number, rTo: number): WallSpan | null {
    if (rTo >= rFrom) return null;              // only inward movement is blocked
    const a = norm(ang);
    for (let ring = CONFIG.fort.ringRadius.length - 1; ring >= 0; ring--) {
      const R = CONFIG.fort.ringRadius[ring];
      if (!(rFrom > R && rTo <= R)) continue;
      const list = this.spans[ring];
      for (let i = 0; i < list.length; i++) {
        const w = list[i];
        if (w.hp <= 0) continue;
        if ((a >= w.a0 && a <= w.a1) || (a + TAU >= w.a0 && a + TAU <= w.a1)) return w;
      }
    }
    return null;
  }

  /** Damage a wall; returns true if it fell. */
  hurtWall(w: WallSpan, dmg: number, era: EraId): boolean {
    w.hp -= dmg;
    w.flash = 0.12;
    if (w.hp <= 0) {
      w.hp = 0;
      this.rebuildWalls(era);
      return true;
    }
    return false;
  }

  /** Damage a structure; returns true if it was destroyed. */
  hurtPad(pad: Pad, dmg: number, era: EraId): boolean {
    if (!pad.kind || pad.rubble > 0) return false;
    pad.hp -= dmg;
    pad.flash = 0.12;
    if (pad.hp <= 0) {
      pad.hp = 0;
      pad.rubble = CONFIG.fort.rubbleSec;
      this.rebuildWalls(era);
      return true;
    }
    return false;
  }

  /** Free self-repair after rubble timer, so a bad wave isn't unrecoverable. */
  step(dt: number, era: EraId): void {
    let dirty = false;
    for (const p of this.pads) {
      if (p.flash > 0) p.flash -= dt;
      if (p.rubble > 0) {
        p.rubble -= dt;
        if (p.rubble <= 0) {
          p.rubble = 0;
          p.hp = p.maxHp;
          dirty = true;
        }
      }
    }
    for (const w of this.walls) if (w.flash > 0) w.flash -= dt;
    if (dirty) this.rebuildWalls(era);
  }

  /** Totals used by the HUD and the results screen. */
  get builtCount(): number {
    return this.pads.reduce((n, p) => n + (p.kind ? 1 : 0), 0);
  }

  /** Sum of forge bonuses currently standing. */
  get forgeBonus(): number {
    let b = 0;
    for (const p of this.pads) {
      if (p.kind === 'forge' && p.rubble <= 0) b += CONFIG.fort.forgeDamage * (1 + p.level * 0.5);
    }
    return b;
  }

  /** Soldiers granted by standing barracks. */
  get barracksSoldiers(): number {
    let n = 0;
    for (const p of this.pads) {
      if (p.kind === 'barracks' && p.rubble <= 0) {
        n += CONFIG.fort.barracksSoldiers * (1 + p.level);
      }
    }
    return n;
  }
}
