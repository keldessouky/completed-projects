import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js';
import { CONFIG, type EnemyKind, type GateKind } from '../../config';
import type { Ctx } from '../../core/game';
import type { Stepper } from '../../core/loop';
import { Pool } from '../../core/pool';
import { getStage } from '../../game/stages';
import * as economy from '../../game/economy';
import type { GateSpawn, RunOutcome, StageDef } from '../../types';
import { Scene } from '../scene';
import { BossFight } from './boss';
import { RunHud } from './hud';
import { NumberPops, Particles } from './particles';
import { NumberDisplay } from '../../ui/digits';
import { uiText } from '../../ui/widgets';
import { showPause } from '../../ui/overlays';

const W = CONFIG.design.width;
const CX = W / 2;
const HERO_Y = CONFIG.hero.screenY;

interface Unit {
  sp: Sprite;
  x: number; y: number; px: number; py: number;
  vx: number; vy: number;
  fireDelay: number; // >0 while waiting for its slot in the current volley
}
interface Corpse {
  sp: Sprite;
  x: number; y: number; vx: number; vy: number; vrot: number; life: number; ttl: number;
}
interface Proj {
  sp: Sprite;
  x: number; y: number; px: number; py: number;
  vx: number; dmg: number; life: number; trailT: number;
}
interface Enemy {
  sp: Sprite;
  kind: EnemyKind;
  x: number; y: number; px: number; py: number;
  hp: number; flashT: number; crossDir: number; phase: number; flapT: number;
}

/** visual chrome for one gate pair; pooled — at most three exist */
class GatePairView {
  root = new Container();
  private archL: Sprite;
  private archR: Sprite;
  private panelL: Sprite;
  private panelR: Sprite;
  private labelL: NumberDisplay;
  private labelR: NumberDisplay;
  private symL: Sprite;
  private symR: Sprite;
  spawn: GateSpawn | null = null;
  done = false;

  constructor(ctx: Ctx) {
    const a = ctx.atlas;
    const half = CONFIG.gates.archWidth / 2 + CONFIG.gates.pairGapX / 2;
    this.archL = new Sprite(a.get('gateArch'));
    this.archR = new Sprite(a.get('gateArch'));
    this.panelL = new Sprite(a.get('gatePanel'));
    this.panelR = new Sprite(a.get('gatePanel'));
    this.symL = new Sprite(a.get('symUp'));
    this.symR = new Sprite(a.get('symUp'));
    this.labelL = new NumberDisplay(a, 5, 0.62);
    this.labelR = new NumberDisplay(a, 5, 0.62);
    for (const [arch, panel, sym, label, dx] of [
      [this.archL, this.panelL, this.symL, this.labelL, -half],
      [this.archR, this.panelR, this.symR, this.labelR, half],
    ] as [Sprite, Sprite, Sprite, NumberDisplay, number][]) {
      arch.anchor.set(0.5); arch.position.set(CX + dx, 0);
      panel.anchor.set(0.5); panel.position.set(CX + dx, 22);
      sym.anchor.set(0.5); sym.position.set(CX + dx, -34);
      label.position.set(CX + dx, 22);
      this.root.addChild(arch, panel, sym, label);
    }
    this.root.visible = false;
  }

  assign(spawn: GateSpawn): void {
    this.spawn = spawn;
    this.done = false;
    this.root.visible = true;
    this.root.alpha = 1;
    const E = CONFIG.gates.effects;
    for (const [side, panel, arch, sym, label] of [
      [spawn.left, this.panelL, this.archL, this.symL, this.labelL],
      [spawn.right, this.panelR, this.archR, this.symR, this.labelR],
    ] as [GateKind, Sprite, Sprite, Sprite, NumberDisplay][]) {
      const eff = E[side];
      // color + SHAPE + text — never color alone (colorblind-safe)
      const tint = eff.trap ? CONFIG.colors.trapRed : CONFIG.colors.lapisBright;
      arch.tint = eff.trap ? 0xd8a294 : 0xbfd0ff;
      panel.tint = tint;
      sym.texture = (eff.trap ? this.symTexX : this.symTexUp)!;
      sym.tint = eff.trap ? CONFIG.colors.trapRed : CONFIG.colors.goodTeal;
      label.set(eff.label);
      label.tint = 0xffffff;
      panel.scale.set(1);
      label.scale.set(0.62);
    }
  }
  symTexUp: import('pixi.js').Texture | null = null;
  symTexX: import('pixi.js').Texture | null = null;

  markResolved(side: 'left' | 'right'): void {
    this.done = true;
    this.root.alpha = 0.55;
    const panel = side === 'left' ? this.panelL : this.panelR;
    const label = side === 'left' ? this.labelL : this.labelR;
    panel.scale.set(1.22);
    label.scale.set(0.78);
  }

  release(): void {
    this.spawn = null;
    this.root.visible = false;
  }
}

/**
 * The auto-runner. Fixed-step simulation (steering, squad springs, volleys,
 * collisions, gates, boss) at 120 Hz; render-time interpolation for every
 * moving sprite; pooled everything.
 */
export class RunScene extends Scene implements Stepper {
  private def!: StageDef;
  private phase: 'run' | 'boss' | 'ending' = 'run';

  // world layers
  private sky = new Sprite();
  private world = new Container();
  private farTile!: TilingSprite;
  private laneTile!: TilingSprite;
  private nearTile!: TilingSprite;
  private gateLayer = new Container();
  private corpseLayer = new Container();
  private enemyLayer = new Container();
  private squadLayer = new Container();
  private projLayer = new Container();
  private particles!: Particles;
  private pops!: NumberPops;
  private hud!: RunHud;

  // sim state
  private dist = 0;
  private prevDist = 0;
  private heroX = CX;
  private heroPX = CX;
  private heroTargetX = CX;
  private heroSp!: Sprite;
  private squad = 0;
  private squadPeak = 0;
  private spawnBudget = 0;
  private tier = 0;
  private fireT = 0.6;
  private playT = 0;
  private runCoins = 0;
  private endT = -1;
  private endGoto: (() => void) | null = null;
  private losses = new Map<string, number>();
  private failLine = '';

  // pools
  private units!: Pool<Unit>;
  private corpses!: Pool<Corpse>;
  private projs!: Pool<Proj>;
  private enemies!: Pool<Enemy>;
  private gateViews: GatePairView[] = [];
  private activeGates: { spawn: GateSpawn; view: GatePairView }[] = [];
  private nextGate = 0;
  private nextWave = 0;
  private boss!: BossFight;

  // formation slots (precomputed)
  private slotX: number[] = [];
  private slotY: number[] = [];

  // tutorial
  private tut: Container | null = null;
  private tutHand: Sprite | null = null;
  private tutActive = false;
  private tutT = 0;

  enter(data?: unknown): void {
    const stage = Math.max(0, Math.min(CONFIG.stages.count - 1, (data as { stage?: number })?.stage ?? 0));
    this.def = getStage(stage);
    const ctx = this.ctx;
    const art = ctx.backdrops[this.def.chapter];

    // --- scenery: full-bleed sky, parallax strips, paved lane ---
    this.sky.texture = art.sky;
    this.sky.anchor.set(0.5, 0);
    this.sky.position.set(CX, -240);
    this.sky.width = W + 480; // bleeds past letterbox on wide-ish screens
    this.sky.height = CONFIG.design.height + 480;
    this.farTile = new TilingSprite({ texture: art.far, width: W + 240, height: CONFIG.design.height + 300 });
    this.farTile.position.set(-120, -150);
    this.farTile.alpha = 0.9;
    this.laneTile = new TilingSprite({ texture: art.lane, width: W, height: CONFIG.design.height + 300 });
    this.laneTile.position.set(0, -150);
    this.nearTile = new TilingSprite({ texture: art.near, width: W, height: CONFIG.design.height + 300 });
    this.nearTile.position.set(0, -150);

    this.world.addChild(this.farTile, this.laneTile, this.nearTile, this.gateLayer, this.corpseLayer,
      this.enemyLayer, this.squadLayer, this.projLayer);
    this.particles = new Particles(ctx.atlas);
    this.pops = new NumberPops(ctx.atlas);
    this.world.addChild(this.particles, this.pops);
    // camera pull-back pivots on the hero so growth reads as the world widening
    this.world.pivot.set(CX, HERO_Y);
    this.world.position.set(CX, HERO_Y);

    this.hud = new RunHud(ctx, stage, () => this.openPause());
    this.container.addChild(this.sky, this.world, this.hud);

    // --- pools ---
    const a = ctx.atlas;
    this.heroSp = new Sprite(a.get('hero'));
    this.heroSp.anchor.set(0.5, 0.6);
    this.units = new Pool<Unit>(CONFIG.squad.max, () => {
      const sp = new Sprite(a.get('unit0'));
      sp.anchor.set(0.5, 0.6);
      sp.visible = false;
      this.squadLayer.addChild(sp);
      return { sp, x: CX, y: HERO_Y, px: CX, py: HERO_Y, vx: 0, vy: 0, fireDelay: -1 };
    });
    this.squadLayer.addChild(this.heroSp);
    this.corpses = new Pool<Corpse>(48, () => {
      const sp = new Sprite(a.get('unit0'));
      sp.anchor.set(0.5);
      sp.visible = false;
      this.corpseLayer.addChild(sp);
      return { sp, x: 0, y: 0, vx: 0, vy: 0, vrot: 0, life: 0, ttl: 1 };
    });
    this.projs = new Pool<Proj>(CONFIG.fire.poolSize, () => {
      const sp = new Sprite(a.get('arrow'));
      sp.anchor.set(0.5);
      sp.visible = false;
      this.projLayer.addChild(sp);
      return { sp, x: 0, y: 0, px: 0, py: 0, vx: 0, dmg: 1, life: 0, trailT: 0 };
    });
    this.enemies = new Pool<Enemy>(CONFIG.enemies.poolSize, () => {
      const sp = new Sprite(a.get('golem'));
      sp.anchor.set(0.5);
      sp.visible = false;
      this.enemyLayer.addChild(sp);
      return { sp, kind: 'golem', x: 0, y: 0, px: 0, py: 0, hp: 1, flashT: 0, crossDir: 1, phase: 0, flapT: 0 };
    });
    for (let i = 0; i < 3; i++) {
      const v = new GatePairView(ctx);
      v.symTexUp = a.get('symUp');
      v.symTexX = a.get('symX');
      this.gateViews.push(v);
      this.gateLayer.addChild(v.root);
    }
    this.boss = new BossFight(ctx, this.world, this.def, this.particles, this.pops);
    this.boss.onBreach = () => this.onBreach();

    // --- formation slots: triangular V-wedge, rows compressed to the lane ---
    const SQ = CONFIG.squad;
    const laneMax = CONFIG.hero.laneHalfWidth - SQ.laneClampPad;
    for (let i = 0; i < SQ.max; i++) {
      const r = Math.floor((Math.sqrt(8 * i + 1) - 1) / 2);
      const j = i - (r * (r + 1)) / 2;
      const eff = Math.min(SQ.colSpacing, (2 * laneMax) / Math.max(1, r));
      const jx = (Math.sin(i * 127.1) * 43758.5453) % 1;
      const jy = (Math.sin(i * 311.7) * 12543.21) % 1;
      this.slotX.push((j - r / 2) * eff + jx * SQ.jitter);
      this.slotY.push((r + 1) * SQ.rowSpacing + jy * SQ.jitter + 10);
    }

    // --- starting state ---
    const save = ctx.save.data;
    this.squad = 0;
    this.setSquad(economy.startSquad(save), null);
    this.hud.snapSquad(economy.startSquad(save));
    this.particles.reducedMotion = ctx.fx.reducedMotion();

    // tutorial: first gate of the first run, once, ever
    if (!save.tutorialDone && stage === 0) this.buildTutorial();

    ctx.audio.music('musicRun');
    ctx.loop.stepper = this;
    ctx.onAutoPause = () => this.openPause(true);
    ctx.runStats = () => ({
      squad: this.squad,
      arrows: this.projs.count,
      enemies: this.enemies.count,
      particles: this.particles.liveCount,
      pops: this.pops.liveCount,
      corpses: this.corpses.count,
      bossHp: this.boss.phase === 'inactive' ? -1 : this.boss.hpFrac,
    });
  }

  override exit(): void {
    this.ctx.loop.stepper = null;
    this.ctx.runStats = null;
    this.ctx.onAutoPause = null;
  }

  // ============================== SIM ==============================

  step(dt: number): void {
    if (this.endT >= 0) return; // ending cinematic: sim frozen, visuals run

    this.playT += dt;
    this.heroPX = this.heroX;
    this.prevDist = this.dist;

    // steering: exponential chase of the finger target — 1:1 with slight smoothing
    this.heroX += (this.heroTargetX - this.heroX) * Math.min(1, CONFIG.hero.steerLerp * dt);

    // scroll
    const speedMult = Math.min(CONFIG.run.speedMax, 1 + this.squad * CONFIG.run.speedPerSquad);
    const scroll = this.phase === 'run' ? CONFIG.run.baseSpeed * speedMult : 0;
    if (this.phase === 'run') {
      this.dist += scroll * dt;
      if (this.dist >= this.def.trackLength) {
        this.phase = 'boss';
        this.boss.activate();
        this.hud.showBossBar();
      }
    }

    this.spawnDue();
    this.stepGates();
    this.stepSquad(dt);
    this.stepFire(dt);
    this.stepProjectiles(dt, scroll);
    this.stepEnemies(dt, scroll);

    if (this.phase === 'boss') {
      this.boss.step(dt);
      this.hud.setBossHp(this.boss.hpFrac);
      if (this.boss.phase === 'fighting' && this.boss.gateY >= HERO_Y - CONFIG.boss.crushLine) {
        const pct = Math.round(this.boss.hpFrac * 100);
        this.failLine = `The gate ground your line down with ${pct}% of its strength left.`;
        this.die();
      }
    }
  }

  /** activate gates and enemy waves whose track position nears the screen */
  private spawnDue(): void {
    const ahead = this.dist + CONFIG.design.height + 160;
    while (this.nextGate < this.def.gates.length && this.def.gates[this.nextGate].at <= ahead) {
      const spawn = this.def.gates[this.nextGate++];
      const view = this.gateViews.find((v) => v.spawn === null);
      if (view) {
        view.assign(spawn);
        this.activeGates.push({ spawn, view });
      }
    }
    while (this.nextWave < this.def.waves.length && this.def.waves[this.nextWave].at <= ahead) {
      const wave = this.def.waves[this.nextWave++];
      this.spawnWave(wave.kind, wave.count, wave.x);
    }
  }

  private spawnWave(kind: EnemyKind, count: number, waveX: number): void {
    const stats = CONFIG.enemies[kind];
    for (let i = 0; i < count; i++) {
      const e = this.enemies.obtain();
      if (!e) return;
      e.kind = kind;
      e.hp = stats.hp * (1 + this.def.index * CONFIG.enemies.hpPerStage);
      e.flashT = 0;
      e.phase = Math.random() * Math.PI * 2;
      e.flapT = 0;
      if (kind === 'anzu') {
        e.crossDir = i % 2 === 0 ? 1 : -1;
        e.x = CX - e.crossDir * (CONFIG.hero.laneHalfWidth + 70);
        e.y = -60 - i * 52;
      } else {
        e.crossDir = 0;
        e.x = CX + waveX + ((i % 3) - 1) * 40 + (Math.random() - 0.5) * 18;
        e.y = -50 - Math.floor(i / 3) * 48 - Math.random() * 24;
      }
      e.px = e.x; e.py = e.y;
      e.sp.texture = this.ctx.atlas.get(kind === 'anzu' ? 'anzu0' : kind);
      e.sp.visible = true;
      e.sp.alpha = 1;
    }
  }

  private stepGates(): void {
    for (let i = this.activeGates.length - 1; i >= 0; i--) {
      const g = this.activeGates[i];
      const rel = g.spawn.at - this.dist;
      if (!g.view.done && rel <= CONFIG.gates.triggerBand) {
        this.resolveGate(g.spawn, g.view);
      }
      if (rel < -(CONFIG.design.height - HERO_Y + 120)) {
        g.view.release();
        this.activeGates.splice(i, 1);
      }
    }
    // tutorial trigger: hand appears as the first pair approaches the hero
    if (this.tut && !this.tutActive && this.activeGates.length > 0) {
      const rel = this.activeGates[0].spawn.at - this.dist;
      if (rel < 430) this.showTutorial();
    }
  }

  private resolveGate(spawn: GateSpawn, view: GatePairView): void {
    const side: 'left' | 'right' = this.heroX < CX ? 'left' : 'right';
    const kind = side === 'left' ? spawn.left : spawn.right;
    const other = side === 'left' ? spawn.right : spawn.left;
    const eff = CONFIG.gates.effects[kind];
    const otherEff = CONFIG.gates.effects[other];
    view.markResolved(side);

    const before = this.squad;
    let after: number;
    if (eff.trap) {
      const rawLoss = before - Math.floor(before * eff.mult + eff.add);
      const loss = Math.max(0, Math.round(rawLoss * (1 - economy.trapResist(this.ctx.save.data))));
      after = before - loss;
      if (loss > 0) this.addLoss(`the ${eff.label} trap`, loss);
    } else {
      after = Math.floor(before * eff.mult + eff.add);
    }
    const gx = CX + (side === 'left' ? -1 : 1) * (CONFIG.gates.archWidth / 2 + 2);
    const gy = HERO_Y - (spawn.at - this.dist);
    // The prompt has done its job once a pair is behind you: never let the hand
    // (or the slow-motion it holds) leak past the gate it was teaching.
    this.dismissTutorial();

    if (eff.trap) {
      this.ctx.audio.play('gateBad');
      this.ctx.audio.play('squadLoss');
      this.ctx.haptics.trapHit();
      this.ctx.fx.shake(CONFIG.fx.shakeTrap);
      this.particles.burst(gx, gy, {
        frame: 'shard', count: CONFIG.fx.gateParticles, tint: CONFIG.colors.trapRed,
        speed: 150, gravity: 420, ttl: 0.5, s0: 1.2, s1: 0.4,
      });
      this.pops.spawn(gx, gy - 30, `−${before - after}`, CONFIG.colors.trapRed, true);
    } else {
      this.ctx.audio.play('gateGood');
      if (after - before > 4) this.ctx.audio.play('squadGain');
      this.ctx.haptics.gateTap();
      this.ctx.fx.shake(CONFIG.fx.shakeGate);
      this.particles.burst(gx, gy, {
        frame: 'softDot', count: CONFIG.fx.gateParticles, tint: CONFIG.colors.goldBright,
        speed: 120, ttl: 0.55, additive: true, s0: 1.6, s1: 0.2,
      });
      this.particles.burst(gx, gy, {
        frame: 'star4', count: 6, tint: CONFIG.colors.bone, speed: 90, ttl: 0.5, additive: true, s0: 1, s1: 0.3,
      });
      this.pops.spawn(gx, gy - 30, `+${Math.max(0, after - before)}`, CONFIG.colors.goodTeal, true);
      // near-miss drama: skimmed past a trap by a hair
      if (otherEff.trap && Math.abs(this.heroX - CX) < CONFIG.gates.nearMissPx) {
        this.ctx.fx.slowmo(CONFIG.gates.slowmoScale, CONFIG.gates.slowmoMs);
        this.ctx.audio.play('whoosh', { rate: 0.82 });
      }
    }

    this.setSquad(after, eff.trap ? `the ${eff.label} trap` : null);
  }

  /** change squad count, syncing HUD, tier, peak, overflow coins, and death */
  private setSquad(n: number, wipeSource: string | null): void {
    const SQ = CONFIG.squad;
    let target = Math.max(0, n);
    if (target > SQ.max) {
      const overflow = target - SQ.max;
      target = SQ.max;
      this.bankCoins(overflow * SQ.overflowCoinPer, CX, HERO_Y - 60);
    }
    this.squad = target;
    this.squadPeak = Math.max(this.squadPeak, target);
    this.hud.setSquad(target);
    const tiers = SQ.tierAt;
    const newTier = target >= tiers[3] ? 4 : target >= tiers[2] ? 3 : target >= tiers[1] ? 2 : target >= tiers[0] ? 1 : 0;
    if (newTier !== this.tier) {
      this.tier = newTier;
      const tex = this.ctx.atlas.get('unit' + newTier);
      for (let i = 0; i < this.units.count; i++) this.units.items[i].sp.texture = tex;
    }
    if (target <= 0 && this.endT < 0 && this.phase !== 'ending') {
      if (wipeSource) this.failLine = `${cap(wipeSource)} took your last ${this.units.count} spearmen.`;
      this.die();
    }
  }

  private stepSquad(dt: number): void {
    const SQ = CONFIG.squad;
    // stagger visual reinforcements in (~250 ms for big gains)
    if (this.units.count < this.squad) {
      this.spawnBudget += dt * Math.max(28, (this.squad - this.units.count) * 4.2);
      while (this.spawnBudget >= 1 && this.units.count < this.squad) {
        this.spawnBudget -= 1;
        const u = this.units.obtain();
        if (!u) break;
        u.x = u.px = this.heroX + (Math.random() - 0.5) * 30;
        u.y = u.py = HERO_Y + 16;
        u.vx = u.vy = 0;
        u.fireDelay = -1;
        u.sp.texture = this.ctx.atlas.get('unit' + this.tier);
        u.sp.visible = true;
      }
    } else if (this.units.count > this.squad) {
      while (this.units.count > this.squad) this.killUnitVisual(this.units.count - 1);
    }

    // spring-damper follow into the V wedge
    const laneMin = CX - CONFIG.hero.laneHalfWidth + SQ.laneClampPad;
    const laneMax = CX + CONFIG.hero.laneHalfWidth - SQ.laneClampPad;
    const k = SQ.springK, d = SQ.springD;
    for (let i = 0; i < this.units.count; i++) {
      const u = this.units.items[i];
      u.px = u.x; u.py = u.y;
      const tx = Math.min(laneMax, Math.max(laneMin, this.heroX + this.slotX[i]));
      const ty = HERO_Y + this.slotY[i];
      u.vx += (k * (tx - u.x) - d * u.vx) * dt;
      u.vy += (k * (ty - u.y) - d * u.vy) * dt;
      u.x += u.vx * dt;
      u.y += u.vy * dt;
    }
  }

  private killUnitVisual(i: number): void {
    const u = this.units.items[i];
    const c = this.corpses.obtain();
    if (c) {
      c.sp.texture = u.sp.texture;
      c.sp.visible = true;
      c.sp.alpha = 1;
      c.x = u.x; c.y = u.y;
      c.vx = (Math.random() - 0.5) * 130;
      c.vy = 60 + Math.random() * 90;
      c.vrot = (Math.random() - 0.5) * 9;
      c.life = 0;
      c.ttl = CONFIG.squad.deathFlyMs / 1000;
      c.sp.rotation = 0;
    }
    u.sp.visible = false;
    this.units.release(i);
  }

  private stepFire(dt: number): void {
    if (this.phase === 'boss' && this.boss.phase === 'entering') {
      // hold volleys while the gate makes its entrance — a breath before the duel
      return;
    }
    this.fireT -= dt;
    const jitter = CONFIG.fire.beatJitterMs / 1000;
    if (this.fireT <= 0) {
      this.fireT += economy.fireInterval(this.ctx.save.data);
      this.fireArrow(this.heroX, HERO_Y - 22, economy.arrowDamage(this.ctx.save.data));
      this.ctx.audio.shoot();
      for (let i = 0; i < this.units.count; i++) {
        this.units.items[i].fireDelay = Math.random() * jitter;
      }
    }
    const dmg = economy.arrowDamage(this.ctx.save.data);
    for (let i = 0; i < this.units.count; i++) {
      const u = this.units.items[i];
      if (u.fireDelay >= 0) {
        u.fireDelay -= dt;
        if (u.fireDelay < 0) this.fireArrow(u.x, u.y - 14, dmg);
      }
    }
  }

  private fireArrow(x: number, y: number, dmg: number): void {
    const p = this.projs.obtain();
    if (!p) return;
    p.x = p.px = x + (Math.random() - 0.5) * 2;
    p.y = p.py = y;
    p.vx = (Math.random() - 0.5) * 2 * CONFIG.fire.spreadX;
    p.dmg = dmg;
    p.life = 0;
    p.trailT = Math.random() * CONFIG.fx.glyphTrailEvery;
    p.sp.visible = true;
  }

  private stepProjectiles(dt: number, scroll: number): void {
    const speed = CONFIG.fire.projSpeed;
    for (let i = this.projs.count - 1; i >= 0; i--) {
      const p = this.projs.items[i];
      p.px = p.x; p.py = p.y;
      p.x += p.vx * dt;
      p.y -= (speed - scroll * 0.2) * dt;
      p.life += dt;

      // cuneiform motes trail off the shaft
      p.trailT -= dt;
      if (p.trailT <= 0) {
        p.trailT += CONFIG.fx.glyphTrailEvery;
        this.particles.mote(p.x, p.y + 10, 'glyph' + ((i % 3) | 0), CONFIG.colors.goldBright, 40, 0.38, 0.8);
      }

      if (p.life > CONFIG.fire.projLifeSec || p.y < -80) {
        p.sp.visible = false;
        this.projs.release(i);
        continue;
      }

      // vs boss gate
      if (this.phase === 'boss') {
        const res = this.boss.tryHit(p.x, p.y, p.dmg);
        if (res !== 'miss') {
          p.sp.visible = false;
          this.projs.release(i);
          continue;
        }
      }

      // vs enemies (few enough for brute force at 120 Hz)
      for (let e = this.enemies.count - 1; e >= 0; e--) {
        const en = this.enemies.items[e];
        const r = CONFIG.enemies[en.kind].radius + CONFIG.fire.projRadius;
        const dx = en.x - p.x, dy = en.y - p.y;
        if (dx * dx + dy * dy <= r * r) {
          this.hitEnemy(e, p.dmg, p.x, p.y);
          p.sp.visible = false;
          this.projs.release(i);
          break;
        }
      }
    }
  }

  private hitEnemy(index: number, dmg: number, hx: number, hy: number): void {
    const en = this.enemies.items[index];
    en.hp -= dmg;
    en.flashT = CONFIG.enemies.hitFlashMs / 1000;
    this.ctx.audio.hit();
    this.particles.burst(hx, hy, {
      frame: 'shard', count: 2, tint: CONFIG.colors.ochre, speed: 110, ttl: 0.3, gravity: 400,
    });
    if (en.kind === 'golem') this.pops.spawn(hx, hy - 14, String(Math.max(1, Math.round(dmg))), CONFIG.colors.bone);
    if (en.hp <= 0) {
      const stats = CONFIG.enemies[en.kind];
      this.particles.burst(en.x, en.y, {
        frame: 'shard', count: CONFIG.fx.dieParticles, tint: CONFIG.colors.ochreDeep,
        speed: 160, speedVar: 80, gravity: 520, ttl: 0.55, spin: 8, s0: 1.3, s1: 0.5,
      });
      this.particles.burst(en.x, en.y, {
        frame: 'softDot', count: 4, tint: CONFIG.colors.goldBright, speed: 60, ttl: 0.4, additive: true, s0: 1.5, s1: 0.2,
      });
      this.ctx.audio.play('enemyDie', { throttleMs: 60, vol: 0.6 });
      this.bankCoins(Math.round(stats.coin * economy.incomeMult(this.def.chapter)), en.x, en.y);
      en.sp.visible = false;
      this.enemies.release(index);
    }
  }

  private bankCoins(n: number, x: number, y: number): void {
    if (n <= 0) return;
    this.runCoins += n;
    this.hud.setCoins(this.runCoins);
    this.particles.burst(x, y, {
      frame: 'coin', count: Math.min(3, n), speed: 60, vy0: -170, gravity: 260, ttl: 0.5, s0: 1, s1: 0.6,
    });
    this.ctx.audio.play('coin', { throttleMs: 90, vol: 0.5 });
  }

  private stepEnemies(dt: number, scroll: number): void {
    const speedScale = 1 + this.def.index * CONFIG.enemies.speedPerStage;
    for (let i = this.enemies.count - 1; i >= 0; i--) {
      const en = this.enemies.items[i];
      en.px = en.x; en.py = en.y;
      const stats = CONFIG.enemies[en.kind];
      if (en.kind === 'anzu') {
        const anzu = CONFIG.enemies.anzu;
        en.x += en.crossDir * anzu.crossSpeed * speedScale * dt;
        en.phase += anzu.waveHz * Math.PI * 2 * dt;
        en.y += (scroll * 0.25 + stats.speed * speedScale) * dt + Math.sin(en.phase) * anzu.waveAmp * dt;
        if ((en.crossDir > 0 && en.x > W + 70) || (en.crossDir < 0 && en.x < -70)) {
          en.sp.visible = false;
          this.enemies.release(i);
          continue;
        }
      } else {
        en.y += (scroll * 0.55 + stats.speed * speedScale) * dt;
        if (en.kind === 'scorpion') {
          const dx = this.heroX - en.x;
          en.x += Math.sign(dx) * Math.min(Math.abs(dx), 34 * dt);
        }
      }

      // reached the line?
      if (en.y >= HERO_Y - (CONFIG.hero.radius + stats.radius)) {
        if (Math.abs(en.x - this.heroX) < CONFIG.enemies.contactHalfWidth) {
          this.contact(i, stats.contactLoss, stats.score);
          continue;
        }
        if (en.y > CONFIG.design.height + 90) { // streamed past the formation
          en.sp.visible = false;
          this.enemies.release(i);
        }
      }
    }
  }

  private contact(index: number, loss: number, source: string): void {
    const en = this.enemies.items[index];
    this.particles.burst(en.x, en.y, {
      frame: 'softDot', count: 9, tint: CONFIG.colors.trapRed, speed: 120, ttl: 0.4, s0: 1.6, s1: 0.3,
    });
    this.ctx.audio.play('squadLoss');
    this.ctx.fx.shake(CONFIG.fx.shakeSquadLoss);
    this.ctx.haptics.trapHit();
    this.pops.spawn(en.x, en.y - 20, `−${Math.min(loss, this.squad)}`, CONFIG.colors.trapRed, true);
    en.sp.visible = false;
    this.enemies.release(index);
    this.addLoss(source, Math.min(loss, this.squad));
    this.setSquad(this.squad - loss, source);
  }

  private addLoss(source: string, n: number): void {
    this.losses.set(source, (this.losses.get(source) ?? 0) + n);
  }

  // ============================== ENDINGS ==============================

  private onBreach(): void {
    if (this.phase === 'ending') return;
    this.phase = 'ending';
    const save = this.ctx.save.data;
    const stars = economy.starsFor(this.def, this.squad);
    const bonus = economy.endBonus(this.def, this.squad, stars);
    const total = this.runCoins + bonus;
    const firstClear = save.stars[this.def.index] === 0;
    const newBest = this.squad > save.bestSquad[this.def.index];

    save.coins += total;
    save.stars[this.def.index] = Math.max(save.stars[this.def.index], stars);
    if (newBest) save.bestSquad[this.def.index] = this.squad;
    if (this.def.index + 1 < CONFIG.stages.count) {
      save.unlocked = Math.max(save.unlocked, this.def.index + 1);
    }
    save.totalRuns += 1;
    this.ctx.save.flush(); // survive an immediate force-quit

    const outcome: RunOutcome = {
      stage: this.def.index,
      win: true,
      squadAtEnd: this.squad,
      squadPeak: this.squadPeak,
      coinsEarned: total,
      stars,
      newBestSquad: newBest,
      firstClear,
      failReason: '',
      durationSec: this.playT,
    };
    this.endT = CONFIG.boss.breachDebrisMs / 1000;
    this.endGoto = () => this.ctx.router.goto('results', outcome);
  }

  private die(): void {
    if (this.phase === 'ending') return;
    this.phase = 'ending';
    // the whole line falls
    while (this.units.count > 0) this.killUnitVisual(this.units.count - 1);
    this.squad = 0;
    this.hud.setSquad(0);
    this.ctx.fx.shake(CONFIG.fx.shakeBossBreach * 0.7);
    this.ctx.fx.flash(0.35, 1.2);
    this.ctx.audio.play('failSting');
    this.ctx.audio.music(null);

    const save = this.ctx.save.data;
    const consolation = Math.round(this.runCoins * CONFIG.economy.failConsolationFrac);
    save.coins += consolation;
    save.totalRuns += 1;
    this.ctx.save.flush();

    if (!this.failLine) {
      let worst = '';
      let worstN = 0;
      for (const [src, n] of this.losses) if (n > worstN) { worst = src; worstN = n; }
      this.failLine = worstN > 0
        ? `You lost ${worstN} units to ${worst}.`
        : 'The line broke before the gate.';
    }
    const outcome: RunOutcome = {
      stage: this.def.index,
      win: false,
      squadAtEnd: 0,
      squadPeak: this.squadPeak,
      coinsEarned: consolation,
      stars: 0,
      newBestSquad: false,
      firstClear: false,
      failReason: this.failLine,
      durationSec: this.playT,
    };
    this.endT = 1.25;
    this.endGoto = () => this.ctx.router.goto('fail', outcome);
  }

  // ============================== RENDER ==============================

  frame(dtReal: number, alpha: number): void {
    const fxT = this.ctx.fx.timescale;
    const dtV = dtReal * fxT; // world visuals obey slow-mo / freeze

    // input → steering target (consumed every frame, applied by sim steps)
    const dx = this.ctx.input.consume();
    if (this.endT < 0 && !this.ctx.loop.paused) {
      this.heroTargetX = Math.min(
        CX + CONFIG.hero.laneHalfWidth,
        Math.max(CX - CONFIG.hero.laneHalfWidth, this.heroTargetX + dx),
      );
    }

    const distR = this.prevDist + (this.dist - this.prevDist) * alpha;
    this.laneTile.tilePosition.y = distR;
    this.nearTile.tilePosition.y = distR;
    this.farTile.tilePosition.y = distR * 0.35;

    // hero + interp
    const hx = this.heroPX + (this.heroX - this.heroPX) * alpha;
    this.heroSp.position.set(hx, HERO_Y);
    this.heroSp.rotation = (this.heroX - this.heroTargetX) * -0.0016; // lean into the steer

    for (let i = 0; i < this.units.count; i++) {
      const u = this.units.items[i];
      u.sp.position.set(u.px + (u.x - u.px) * alpha, u.py + (u.y - u.py) * alpha);
    }
    for (let i = 0; i < this.projs.count; i++) {
      const p = this.projs.items[i];
      p.sp.position.set(p.px + (p.x - p.px) * alpha, p.py + (p.y - p.py) * alpha);
      p.sp.rotation = p.vx * 0.0015;
    }
    for (let i = 0; i < this.enemies.count; i++) {
      const en = this.enemies.items[i];
      en.sp.position.set(en.px + (en.x - en.px) * alpha, en.py + (en.y - en.py) * alpha);
      if (en.flashT > 0) {
        en.flashT -= dtReal;
        en.sp.texture = this.ctx.atlas.get(en.kind === 'anzu' ? 'anzuW' : en.kind + 'W');
      } else if (en.kind === 'anzu') {
        en.flapT += dtV;
        en.sp.texture = this.ctx.atlas.get(Math.floor(en.flapT * 7) % 2 === 0 ? 'anzu0' : 'anzu1');
        en.sp.rotation = en.crossDir * 0.12;
      } else {
        en.sp.texture = this.ctx.atlas.get(en.kind);
      }
    }

    // gates ride the track
    for (const g of this.activeGates) {
      g.view.root.y = HERO_Y - (g.spawn.at - distR);
    }

    // corpses tumble in render time
    for (let i = this.corpses.count - 1; i >= 0; i--) {
      const c = this.corpses.items[i];
      c.life += dtV;
      if (c.life >= c.ttl) {
        c.sp.visible = false;
        this.corpses.release(i);
        continue;
      }
      c.x += c.vx * dtV;
      c.y += (c.vy + 320 * (c.life / c.ttl)) * dtV;
      c.sp.position.set(c.x, c.y);
      c.sp.rotation += c.vrot * dtV;
      c.sp.alpha = 1 - c.life / c.ttl;
    }

    this.particles.budgetScale = this.ctx.loop.thermalSoften() ? CONFIG.thermal.particleBudgetScale : 1;
    this.particles.update(dtV);
    this.pops.update(dtReal);
    this.boss.frame(dtReal);

    // camera pull-back breathes with squad size
    const pull = Math.min(CONFIG.run.camPullbackMax, this.squad * CONFIG.run.camPullbackPerSquad);
    const targetScale = 1 - pull;
    const cur = this.world.scale.x;
    this.world.scale.set(cur + (targetScale - cur) * Math.min(1, CONFIG.run.camLerp * dtReal));

    this.hud.setProgress(Math.min(1, this.dist / this.def.trackLength));

    this.updateTutorial(dtReal);

    if (this.endT >= 0) {
      this.endT -= dtReal;
      if (this.endT <= 0 && this.endGoto) {
        const go = this.endGoto;
        this.endGoto = null;
        go();
      }
    }
  }

  // ============================== TUTORIAL ==============================

  private buildTutorial(): void {
    const t = new Container();
    const hand = new Sprite(this.ctx.atlas.get('hand'));
    hand.anchor.set(0.5, 0.2);
    hand.position.set(CX, HERO_Y - 130);
    const hint = uiText('Drag anywhere to steer', 19, CONFIG.colors.bone, '600');
    hint.position.set(CX, HERO_Y - 210);
    const g = new Graphics();
    g.roundRect(CX - 150, HERO_Y - 232, 300, 44, 12).fill({ color: CONFIG.colors.bitumen, alpha: 0.72 });
    t.addChild(g, hint, hand);
    t.visible = false;
    this.tut = t;
    this.tutHand = hand;
    this.container.addChild(t);
  }

  private showTutorial(): void {
    if (!this.tut) return;
    this.tutActive = true;
    this.tut.visible = true;
    this.ctx.input.dragTotal = 0;
    if (!this.ctx.fx.reducedMotion()) this.ctx.fx.tutorialScale = CONFIG.tutorial.slowScale;
  }

  private updateTutorial(dtReal: number): void {
    if (!this.tutActive || !this.tut || !this.tutHand) return;
    this.tutT += dtReal * (1000 / CONFIG.tutorial.handLoopMs);
    this.tutHand.x = CX + Math.sin(this.tutT * Math.PI * 2) * 84;
    this.tutHand.rotation = Math.cos(this.tutT * Math.PI * 2) * 0.18;
    if (this.ctx.input.dragTotal > CONFIG.tutorial.dismissDragPx) this.dismissTutorial();
  }

  private dismissTutorial(): void {
    if (!this.tutActive || !this.tut) return;
    this.tutActive = false;
    this.tut.visible = false;
    this.ctx.fx.tutorialScale = 1;
    this.ctx.save.data.tutorialDone = true;
    this.ctx.save.mark();
  }

  // ============================== PAUSE ==============================

  private openPause(auto = false): void {
    if (this.ctx.loop.paused || this.endT >= 0) return;
    showPause(this.ctx, {
      onRestart: () => this.ctx.router.goto('run', { stage: this.def.index }),
      onQuit: () => this.ctx.router.goto('map'),
    });
    if (auto) this.ctx.audio.muteAll(true); // visibilitychange already mutes; belt and braces
  }
}

const cap = (s: string): string => (s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s);
