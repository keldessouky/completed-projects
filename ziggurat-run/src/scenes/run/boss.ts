import { Container, Sprite } from 'pixi.js';
import { Easing, Tween } from '@tweenjs/tween.js';
import { CONFIG } from '../../config';
import type { Ctx } from '../../core/game';
import type { StageDef } from '../../types';
import type { Particles, NumberPops } from './particles';

export type BossPhase = 'inactive' | 'entering' | 'fighting' | 'breached';
export type HitResult = 'miss' | 'shield' | 'hit';

/**
 * The stage-end set piece: a ziggurat gate with an HP pool, flanked by two
 * lamassu that wake at 50% and begin cycling a shield over the gate.
 * Damage-per-second is simply the squad's arrow stream — surviving units are
 * the weapon. Breach = win; the gate grinding down to the line = wipe.
 */
export class BossFight {
  phase: BossPhase = 'inactive';
  hp = 1;
  maxHp = 1;
  /** bottom edge of the gate in design y — the crush line chases this */
  gateY = -320;
  awake = false;
  shielded = false;

  private view = new Container();
  private gate: Sprite;
  private lamL: Sprite;
  private lamR: Sprite;
  private ring: Sprite;
  private cx = CONFIG.design.width / 2;
  private cycleT = 0;
  private telegraphT = 0;
  private flashT = 0;
  private lastHitSfx = 0;

  onBreach: (() => void) | null = null;

  constructor(
    private ctx: Ctx,
    layer: Container,
    def: StageDef,
    private particles: Particles,
    private pops: NumberPops,
  ) {
    this.maxHp = this.hp = def.bossHp;
    const a = ctx.atlas;
    this.gate = new Sprite(a.get('bossGate'));
    this.gate.anchor.set(0.5, 1);
    this.lamL = new Sprite(a.get('lamassuIdle'));
    this.lamL.anchor.set(0.5, 1);
    this.lamL.scale.x = -1; // faces inward from the left flank
    this.lamR = new Sprite(a.get('lamassuIdle'));
    this.lamR.anchor.set(0.5, 1);
    this.ring = new Sprite(a.get('shieldRing'));
    this.ring.anchor.set(0.5);
    this.ring.tint = CONFIG.colors.lapisBright;
    this.ring.blendMode = 'add';
    this.ring.alpha = 0;
    this.view.addChild(this.gate, this.lamL, this.lamR, this.ring);
    this.view.visible = false;
    layer.addChild(this.view);
  }

  activate(): void {
    if (this.phase !== 'inactive') return;
    this.phase = 'entering';
    this.view.visible = true;
    this.gateY = -300;
  }

  get hpFrac(): number { return Math.max(0, this.hp / this.maxHp); }

  step(dt: number): void {
    if (this.phase === 'entering') {
      const target = CONFIG.hero.screenY - CONFIG.boss.fightDistance;
      this.gateY += (target - this.gateY) * Math.min(1, 2.2 * dt) + 40 * dt;
      if (this.gateY >= target) {
        this.gateY = target;
        this.phase = 'fighting';
      }
      return;
    }
    if (this.phase !== 'fighting') return;

    this.gateY += CONFIG.boss.approachSpeed * dt;

    if (this.awake) {
      this.cycleT += dt;
      const period = CONFIG.boss.shieldPeriod;
      const inCycle = this.cycleT % period;
      // 0.45 s telegraph before the shield snaps closed
      this.telegraphT = inCycle > period - CONFIG.boss.shieldDuration - 0.45 && inCycle <= period - CONFIG.boss.shieldDuration
        ? 1 : 0;
      const wasShielded = this.shielded;
      this.shielded = inCycle > period - CONFIG.boss.shieldDuration;
      if (this.shielded && !wasShielded) this.ctx.audio.play('shieldClang', { vol: 0.5, rate: 0.9 });
    }
  }

  /** Projectile at (x, y) — did it connect, and did armor eat it? */
  tryHit(x: number, y: number, dmg: number): HitResult {
    if (this.phase !== 'fighting') return 'miss';
    const halfW = CONFIG.boss.gateWidth / 2;
    if (x < this.cx - halfW || x > this.cx + halfW) return 'miss';
    if (y > this.gateY || y < this.gateY - 250) return 'miss';
    if (this.shielded) {
      this.particles.burst(x, this.gateY - 30, {
        frame: 'spark', count: 3, tint: CONFIG.colors.lapisBright, speed: 90, ttl: 0.25, additive: true, s0: 1, s1: 0.4,
      });
      this.ctx.audio.play('shieldClang', { throttleMs: 160, vol: 0.35 });
      return 'shield';
    }
    this.hp -= dmg;
    this.flashT = 0.09;
    const now = performance.now();
    if (now - this.lastHitSfx > CONFIG.boss.hitSfxThrottleMs) {
      this.lastHitSfx = now;
      this.ctx.audio.play('bossHit', { vol: 0.5 });
      this.ctx.fx.shake(CONFIG.fx.shakeBossHit * 0.35);
    }
    this.particles.burst(x, y, {
      frame: 'shard', count: CONFIG.fx.hitParticles, tint: CONFIG.colors.gold, speed: 130, ttl: 0.35, gravity: 500,
    });
    this.pops.spawn(x, y - 18, String(Math.max(1, Math.round(dmg))), CONFIG.colors.goldBright);

    if (!this.awake && this.hpFrac <= CONFIG.boss.lamassuWakeAt) this.wake();
    if (this.hp <= 0) this.breach();
    return 'hit';
  }

  private wake(): void {
    this.awake = true;
    this.cycleT = 0;
    const a = this.ctx.atlas;
    this.lamL.texture = a.get('lamassuAwake');
    this.lamR.texture = a.get('lamassuAwake');
    this.ctx.audio.play('lamassuWake');
    this.ctx.fx.shake(CONFIG.fx.shakeBossHit);
    this.ctx.fx.flash(0.22, 1.6);
    for (const lx of [this.cx - 150, this.cx + 150]) {
      this.particles.burst(lx, this.gateY - 60, {
        frame: 'softDot', count: 10, tint: CONFIG.colors.goldBright, speed: 70, ttl: 0.6, additive: true, s0: 1.4, s1: 0.2,
      });
    }
  }

  private breach(): void {
    if (this.phase === 'breached') return;
    this.phase = 'breached';
    this.shielded = false;
    const fx = this.ctx.fx;
    fx.freeze(CONFIG.boss.breachFreezeMs);
    fx.flash(0.95, 1000 / CONFIG.boss.breachFlashMs);
    fx.shake(CONFIG.fx.shakeBossBreach);
    this.ctx.audio.play('breach');
    this.ctx.haptics.bossBreach();

    // debris collapse: brick chunks pour from the gate face, statues topple
    const gy = this.gateY;
    for (let i = 0; i < 30; i++) {
      this.particles.burst(this.cx + (Math.random() - 0.5) * CONFIG.boss.gateWidth, gy - 40 - Math.random() * 180, {
        frame: 'brickChunk', count: 1,
        tint: i % 3 === 0 ? CONFIG.colors.gold : i % 2 === 0 ? CONFIG.colors.lapisBright : CONFIG.colors.boneDim,
        speed: 60, speedVar: 40, gravity: 640, drag: 0.4, ttl: 1.6, ttlVar: 0.5, spin: 7, s0: 1.1, s1: 0.9,
      });
    }
    this.particles.burst(this.cx, gy - 120, {
      frame: 'softDot', count: 24, tint: CONFIG.colors.bone, speed: 150, speedVar: 90, ttl: 1.1, additive: true, s0: 2.2, s1: 0.3,
    });
    this.gate.visible = false;
    this.ring.visible = false;
    for (const [lam, dir] of [[this.lamL, -1], [this.lamR, 1]] as [Sprite, number][]) {
      const state = { rot: 0, y: 0, alpha: 1 };
      const tw = new Tween(state)
        .to({ rot: dir * 0.55, y: 46, alpha: 0 }, CONFIG.boss.breachDebrisMs * 0.7)
        .easing(Easing.Quadratic.In)
        .onUpdate(() => {
          lam.rotation = state.rot;
          lam.y = this.gateY + state.y;
          lam.alpha = state.alpha;
        })
        .delay(220)
        .start(performance.now());
      this.ctx.tweens.add(tw);
    }
    this.onBreach?.();
  }

  frame(dtReal: number): void {
    if (this.phase === 'inactive') return;
    this.gate.position.set(this.cx, this.gateY);
    if (this.phase !== 'breached') {
      this.lamL.position.set(this.cx - 150, this.gateY);
      this.lamR.position.set(this.cx + 150, this.gateY);
      // awake statues breathe
      if (this.awake) {
        const b = 1 + Math.sin(performance.now() / 300) * 0.015;
        this.lamL.scale.set(-b, b);
        this.lamR.scale.set(b, b);
      }
    }
    this.ring.position.set(this.cx, this.gateY - 120);
    const targetAlpha = this.shielded ? 0.95 : this.telegraphT > 0 ? 0.35 : 0;
    this.ring.alpha += (targetAlpha - this.ring.alpha) * Math.min(1, 12 * dtReal);
    this.ring.scale.set(3.0 + Math.sin(performance.now() / 140) * 0.06);

    if (this.flashT > 0) {
      this.flashT -= dtReal;
      this.gate.tint = 0xffd9a0;
    } else {
      this.gate.tint = 0xffffff;
    }
  }
}
