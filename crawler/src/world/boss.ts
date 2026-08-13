import { Container, Graphics } from 'pixi.js';
import { CONFIG } from '../config';
import { ISO_X, ISO_Y, screenX, screenY } from '../iso';
import type { Enemy } from './entities';

/**
 * The Warden: the floor's boss, and the one fight in this game that is about
 * reading a pattern rather than about how many people are behind you.
 *
 * Structured as a controller over an ordinary `Enemy` record rather than as a
 * parallel entity. Everything that already works on enemies — spatial hash,
 * spear targeting, damage numbers, hit flash, knockback, health bars, corpse
 * handling — therefore works on the boss for free, and the only thing this
 * class owns is the part that is genuinely different: what he DOES.
 *
 * Three phases, each ADDING a behaviour rather than replacing one, so the
 * fight escalates instead of cycling:
 *
 *   1  walks you down and swings
 *   2  + calls the garrison out of the keep
 *   3  + slams the ground, and stops pacing himself
 *
 * Every attack is telegraphed on the ground before it lands. On a phone, a
 * boss that hits you from off-screen with no warning is not difficult, it is
 * unfair — so the tell is drawn in world space, at the place the hit will
 * happen, for long enough to walk out of.
 */

// Widened off the `as const` config so the countdown fields can be assigned.
// CONFIG is frozen-by-type, not frozen at runtime; the boss keeps its own
// mutable clocks and only READS these.
const B: { [K in keyof typeof CONFIG.boss]: number } = CONFIG.boss;

export type BossPhase = 1 | 2 | 3;
export type BossAct = 'idle' | 'chargeTell' | 'charging' | 'slamTell' | 'slam';

/** What the world scene needs to react to, drained once per step. */
export interface BossEvents {
  /** the phase just changed to this */
  phase: BossPhase | null;
  /** he just started winding up a charge */
  telegraphed: 'charge' | 'slam' | null;
  /** squad members the slam ring just cost you, 0 if it did not land */
  slamHit: number;
  /** summon this many grunts, at these positions */
  summon: { x: number; y: number }[];
}

export class Boss {
  /** the enemy record this controller drives; null until spawned */
  e: Enemy | null = null;
  phase: BossPhase = 1;
  act: BossAct = 'idle';
  /** counts down within the current act */
  private t = 0;
  private chargeCd = B.chargeCooldown;
  private summonCd = B.summonEvery;
  private slamCd = B.slamEvery;
  /** unit vector locked in when a charge starts, so it cannot home mid-dash */
  private cx = 0;
  private cy = 0;
  /** 0..1 while a slam ring expands */
  private slamT = -1;
  private slamX = 0;
  private slamY = 0;
  /** the slam ring only ever costs you once per slam */
  private slamSpent = false;

  private readonly tell = new Graphics();
  private readonly ring = new Graphics();

  constructor(layer: Container) {
    this.tell.visible = false;
    this.ring.visible = false;
    layer.addChild(this.tell, this.ring);
  }

  get alive(): boolean { return this.e !== null && this.e.hp > 0; }
  get hpFrac(): number {
    return this.e ? Math.max(0, this.e.hp / this.e.maxHp) : 0;
  }

  /** Take ownership of a freshly spawned enemy record. */
  attach(e: Enemy): void {
    this.e = e;
    this.phase = 1;
    this.act = 'idle';
    this.t = 0;
    this.chargeCd = B.chargeCooldown;
    this.summonCd = B.summonEvery;
    this.slamCd = B.slamEvery;
    this.slamT = -1;
  }

  clear(): void {
    this.e = null;
    this.tell.visible = false;
    this.ring.visible = false;
  }

  /**
   * Advance one simulation step.
   *
   * Returns what happened, for the scene to turn into particles, sound, System
   * lines and squad losses. The boss deliberately does not reach into the
   * world itself: keeping the effects on the caller's side is what stops this
   * file from needing to know about audio, haptics or the HUD.
   */
  step(dt: number, hx: number, hy: number, out: BossEvents): void {
    out.phase = null;
    out.telegraphed = null;
    out.slamHit = 0;
    out.summon.length = 0;

    const e = this.e;
    if (!e || e.hp <= 0) return;

    // ── phase, on health ──
    const f = this.hpFrac;
    const want: BossPhase = f <= B.phase3At ? 3 : f <= B.phase2At ? 2 : 1;
    if (want > this.phase) {
      this.phase = want;
      out.phase = want;
      // a phase change interrupts whatever he was doing — the escalation
      // should feel like him deciding, not like a timer expiring
      this.act = 'idle';
      this.t = 0;
      this.chargeCd = Math.min(this.chargeCd, 1.2);
      // Phase 3 has to SHOW its move. Left on its full cooldown the slam
      // simply never happened — the phase does not last five seconds once a
      // grown army is on him, so the fight's headline attack was unreachable.
      if (want === 3) this.slamCd = Math.min(this.slamCd, 0.8);
    }

    const dx = hx - e.x, dy = hy - e.y;
    const dist = Math.hypot(dx, dy) || 1;

    // ── the slam ring, expanding independently of what he does next ──
    if (this.slamT >= 0) {
      this.slamT += dt / B.slamGrowSec;
      if (!this.slamSpent) {
        const r = this.slamT * B.slamRadius;
        const pd = Math.hypot(hx - this.slamX, hy - this.slamY);
        // the ring is a band, not a disc: standing in the middle is safe,
        // which is what makes "get close" a real answer to it
        if (pd < r && pd > r - 90) {
          out.slamHit = B.slamContact;
          this.slamSpent = true;
        }
      }
      if (this.slamT >= 1) this.slamT = -1;
    }

    // ── cooldowns ──
    this.chargeCd -= dt;
    if (this.phase >= 2) this.summonCd -= dt;
    if (this.phase >= 3) this.slamCd -= dt;

    switch (this.act) {
      case 'chargeTell':
        // planted, winding up
        e.speedMul = 0;
        this.t -= dt;
        if (this.t <= 0) {
          this.act = 'charging';
          this.t = B.chargeSec;
          // direction locks HERE, at the end of the wind-up. Homing during the
          // dash would make the charge unavoidable and therefore not a
          // decision; locking it makes stepping aside the answer.
          this.cx = dx / dist;
          this.cy = dy / dist;
        }
        break;

      case 'charging': {
        // The charge DOES move him here, and suppresses the shared step's
        // approach for its duration by parking the multiplier at zero.
        e.speedMul = 0;
        this.t -= dt;
        e.x += this.cx * B.chargeSpeed * dt;
        e.y += this.cy * B.chargeSpeed * dt;
        if (this.t <= 0) {
          this.act = 'idle';
          this.chargeCd = B.chargeCooldown;
          e.speedMul = 1;
        }
        break;
      }

      case 'slamTell':
        e.speedMul = 0;
        this.t -= dt;
        if (this.t <= 0) {
          this.act = 'slam';
          this.slamT = 0;
          this.slamSpent = false;
          this.slamX = e.x;
          this.slamY = e.y;
          this.slamCd = B.slamEvery;
          this.act = 'idle';
        }
        break;

      default: {
        // Walking him down and swinging is NOT this class's job — the ordinary
        // enemy step already closes to contact range and bites on a timer, and
        // having both move him meant they disagreed about where to stop: the
        // controller parked him at 80 units while contact needs 57, so across
        // an entire three-phase fight he never once landed a hit. The
        // controller owns only what is special. Enrage is a multiplier the
        // shared step reads.
        e.speedMul = this.phase >= 3 ? B.enrageSpeed : 1;

        // pick the next special, slam first so phase 3 leads with its own move
        if (this.phase >= 3 && this.slamCd <= 0) {
          this.act = 'slamTell';
          this.t = B.slamTellSec;
          out.telegraphed = 'slam';
        } else if (this.chargeCd <= 0) {
          // No distance gate. The obvious one — only charge from range — meant
          // he never charged at all: the shared enemy step closes him to
          // contact range and parks him there, so `dist > 120` was false for
          // the entire fight and this whole branch was dead code. He barrels
          // THROUGH you instead, which reads better anyway: the charge carries
          // him 460 units past wherever you were standing.
          this.act = 'chargeTell';
          this.t = B.chargeTellSec;
          out.telegraphed = 'charge';
        }
        break;
      }
    }

    // ── summoning ──
    if (this.phase >= 2 && this.summonCd <= 0) {
      this.summonCd = B.summonEvery;
      for (let i = 0; i < B.summonCount; i++) {
        const a = (i / B.summonCount) * Math.PI * 2 + Math.random();
        out.summon.push({
          x: e.x + Math.cos(a) * 150,
          y: e.y + Math.sin(a) * 150,
        });
      }
    }
  }

  /**
   * Redraw the ground marks. Render-time only — nothing here affects the
   * simulation, so it can be skipped on a slow frame without desyncing.
   */
  draw(camX: number, camY: number): void {
    const e = this.e;
    this.tell.visible = false;
    this.ring.visible = false;
    if (!e || e.hp <= 0) return;

    // Ground marks are ellipses on the ground plane: a circle drawn on screen
    // reads as a disc hanging in the air in front of the field, and the whole
    // point of a tell is that it is on the floor you are standing on.
    const ex = screenX(e.x, e.y) - camX;
    const ey = screenY(e.x, e.y) - camY;
    const K = ISO_Y / ISO_X;

    if (this.act === 'chargeTell' || this.act === 'slamTell') {
      const total = this.act === 'chargeTell' ? B.chargeTellSec : B.slamTellSec;
      const p = 1 - Math.max(0, this.t) / total;
      this.tell.visible = true;
      this.tell.clear();
      if (this.act === 'chargeTell') {
        // a lane pointing where he will go, filling up as the wind-up runs
        const len = 460 * p;
        const a = Math.atan2(this.tellDy, this.tellDx);
        this.tell.moveTo(ex, ey);
        this.tell
          .ellipse(ex + Math.cos(a) * len * 0.5, ey + Math.sin(a) * len * 0.5 * K,
            Math.max(30, len * 0.5), 44 * K)
          .fill({ color: 0xd63a2c, alpha: 0.16 + p * 0.14 });
      } else {
        this.tell
          .ellipse(ex, ey, B.slamRadius * p, B.slamRadius * p * K)
          .stroke({ color: 0xf5c033, width: 6, alpha: 0.25 + p * 0.5 });
      }
    }

    if (this.slamT >= 0) {
      const r = this.slamT * B.slamRadius;
      const sx = screenX(this.slamX, this.slamY) - camX;
      const sy = screenY(this.slamX, this.slamY) - camY;
      this.ring.visible = true;
      this.ring.clear();
      this.ring
        .ellipse(sx, sy, r, r * K)
        .stroke({ color: 0xf5c033, width: 14 * (1 - this.slamT) + 4, alpha: 1 - this.slamT });
    }
  }

  /** Where the charge tell should point; kept so draw() need not re-derive it. */
  tellDx = 1;
  tellDy = 0;

  /** Point the tell at the hero while the wind-up runs. */
  aim(hx: number, hy: number): void {
    const e = this.e;
    if (!e) return;
    this.tellDx = hx - e.x;
    this.tellDy = hy - e.y;
  }
}
