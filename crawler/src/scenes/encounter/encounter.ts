import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js';
import { CONFIG, type DoorKind, type EnemyKind } from '../../config';
import type { Ctx } from '../../core/game';
import type { Stepper } from '../../core/loop';
import { Pool } from '../../core/pool';
import { MOB_BLAME, SYS, TIMEOUT_LINE } from '../../flavour';
import * as stats from '../../game/stats';
import type { DoorSpawn, EncounterDef, EncounterResult, FloorNode } from '../../types';
import { NumberDisplay } from '../../ui/digits';
import { showPause } from '../../ui/overlays';
import { uiText } from '../../ui/widgets';
import { Scene } from '../scene';
import { BossFight } from './boss';
import { EncounterHud } from './hud';
import { NumberPops, Particles } from './particles';

const W = CONFIG.design.width;
const CX = W / 2;
const HERO_Y = CONFIG.hero.screenY;

interface Unit {
  sp: Sprite;
  x: number; y: number; px: number; py: number;
  vx: number; vy: number;
  fireDelay: number;
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

/** visual chrome for one door pair; pooled — at most three exist */
class DoorPairView {
  root = new Container();
  private archL: Sprite;
  private archR: Sprite;
  private panelL: Sprite;
  private panelR: Sprite;
  private labelL: NumberDisplay;
  private labelR: NumberDisplay;
  private symL: Sprite;
  private symR: Sprite;
  spawn: DoorSpawn | null = null;
  done = false;
  symTexUp: import('pixi.js').Texture | null = null;
  symTexX: import('pixi.js').Texture | null = null;

  constructor(ctx: Ctx) {
    const a = ctx.atlas;
    const half = CONFIG.doors.archWidth / 2 + CONFIG.doors.pairGapX / 2;
    this.archL = new Sprite(a.get('doorArch'));
    this.archR = new Sprite(a.get('doorArch'));
    this.panelL = new Sprite(a.get('doorPanel'));
    this.panelR = new Sprite(a.get('doorPanel'));
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

  assign(spawn: DoorSpawn): void {
    this.spawn = spawn;
    this.done = false;
    this.root.visible = true;
    this.root.alpha = 1;
    const E = CONFIG.doors.effects;
    for (const [side, panel, arch, sym, label] of [
      [spawn.left, this.panelL, this.archL, this.symL, this.labelL],
      [spawn.right, this.panelR, this.archR, this.symR, this.labelR],
    ] as [DoorKind, Sprite, Sprite, Sprite, NumberDisplay][]) {
      const eff = E[side];
      // color + SHAPE + text — never color alone (colorblind-safe)
      const tint = eff.trap ? CONFIG.colors.trapRed : CONFIG.colors.sys;
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
 * One room of a floor. Three shapes share this scene because they share
 * almost everything — pools, springs, volleys, collisions, contact, endings:
 *
 *  - corridor: the world scrolls; door pairs and mob waves are keyed to
 *    distance; reaching the far end is success.
 *  - arena:    nothing scrolls; waves arrive on a timer from the top edge and
 *    clearing every one of them is success.
 *  - boss:     nothing scrolls; the BossFight owns the win condition.
 *
 * What differs is only the spawn driver and the exit test, so both live behind
 * `this.def.kind` rather than in three near-identical scenes.
 *
 * Fixed-step simulation at 120 Hz; render-time interpolation for every moving
 * sprite; pooled everything, so no allocation happens during play.
 */
export class EncounterScene extends Scene implements Stepper {
  private node!: FloorNode;
  private def!: EncounterDef;
  private phase: 'fight' | 'boss' | 'ending' = 'fight';

  // world layers
  private sky = new Sprite();
  private world = new Container();
  private farTile!: TilingSprite;
  private laneTile!: TilingSprite;
  private nearTile!: TilingSprite;
  private doorLayer = new Container();
  private corpseLayer = new Container();
  private enemyLayer = new Container();
  private partyLayer = new Container();
  private projLayer = new Container();
  private particles!: Particles;
  private pops!: NumberPops;
  private hud!: EncounterHud;

  // sim state
  private dist = 0;
  private prevDist = 0;
  private heroX = CX;
  private heroPX = CX;
  private heroTargetX = CX;
  private heroSp!: Sprite;
  private party = 0;
  private tier = 0;
  private spawnBudget = 0;
  private fireT = 0.6;
  private playT = 0;
  private endT = -1;
  private endGoto: (() => void) | null = null;
  private failLine = '';
  /** arena: seconds since the room started, drives the wave script */
  private arenaT = 0;
  private cdBlast = 0;
  private cdRally = 0;

  // pools
  private units!: Pool<Unit>;
  private corpses!: Pool<Corpse>;
  private projs!: Pool<Proj>;
  private enemies!: Pool<Enemy>;
  private doorViews: DoorPairView[] = [];
  private activeDoors: { spawn: DoorSpawn; view: DoorPairView }[] = [];
  private nextDoor = 0;
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
    const ctx = this.ctx;
    const rs = ctx.run;
    if (!rs) { ctx.router.goto('title'); return; }

    const nodeId = (data as { node?: string })?.node ?? rs.at;
    this.node = rs.def.nodes[nodeId];
    if (!this.node?.enc) { ctx.router.goto('floormap'); return; }
    this.def = this.node.enc;
    this.party = rs.party;

    const art = ctx.backdrops[Math.min(ctx.backdrops.length - 1, rs.floor)];

    // --- scenery: full-bleed sky, parallax strips, the tunnel floor ---
    this.sky.texture = art.sky;
    this.sky.anchor.set(0.5, 0);
    this.sky.position.set(CX, -240);
    this.sky.width = W + 480;
    this.sky.height = CONFIG.design.height + 480;
    this.farTile = new TilingSprite({ texture: art.far, width: W + 240, height: CONFIG.design.height + 300 });
    this.farTile.position.set(-120, -150);
    this.farTile.alpha = 0.9;
    this.laneTile = new TilingSprite({ texture: art.lane, width: W, height: CONFIG.design.height + 300 });
    this.laneTile.position.set(0, -150);
    this.nearTile = new TilingSprite({ texture: art.near, width: W, height: CONFIG.design.height + 300 });
    this.nearTile.position.set(0, -150);

    this.world.addChild(this.farTile, this.laneTile, this.nearTile, this.doorLayer, this.corpseLayer,
      this.enemyLayer, this.partyLayer, this.projLayer);
    this.particles = new Particles(ctx.atlas);
    this.pops = new NumberPops(ctx.atlas);
    this.world.addChild(this.particles, this.pops);
    // camera pull-back pivots on the hero so growth reads as the world widening
    this.world.pivot.set(CX, HERO_Y);
    this.world.position.set(CX, HERO_Y);

    this.hud = new EncounterHud(
      ctx, this.def.kind,
      () => this.openPause(),
      () => this.fireBlast(),
      () => this.fireRally(),
    );
    this.container.addChild(this.sky, this.world, this.hud);

    // --- pools ---
    const a = ctx.atlas;
    this.heroSp = new Sprite(a.get('hero'));
    this.heroSp.anchor.set(0.5, 0.6);
    this.units = new Pool<Unit>(CONFIG.party.max, () => {
      const sp = new Sprite(a.get('unit0'));
      sp.anchor.set(0.5, 0.6);
      sp.visible = false;
      this.partyLayer.addChild(sp);
      return { sp, x: CX, y: HERO_Y, px: CX, py: HERO_Y, vx: 0, vy: 0, fireDelay: -1 };
    });
    this.partyLayer.addChild(this.heroSp);
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
      const sp = new Sprite(a.get('brute'));
      sp.anchor.set(0.5);
      sp.visible = false;
      this.enemyLayer.addChild(sp);
      return { sp, kind: 'brute', x: 0, y: 0, px: 0, py: 0, hp: 1, flashT: 0, crossDir: 1, phase: 0, flapT: 0 };
    });
    for (let i = 0; i < 3; i++) {
      const v = new DoorPairView(ctx);
      v.symTexUp = a.get('symUp');
      v.symTexX = a.get('symX');
      this.doorViews.push(v);
      this.doorLayer.addChild(v.root);
    }
    this.boss = new BossFight(ctx, this.world, this.def.bossHp || rs.def.bossHp, this.particles, this.pops);
    this.boss.onBreach = () => this.onBossDown();

    // --- formation slots: triangular V-wedge, rows compressed to the lane ---
    const SQ = CONFIG.party;
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

    // Drop the notification feed below the HUD band for the duration of the
    // room: the floor clock is the one thing that must never be covered.
    ctx.system.setTop(CONFIG.system.encounterTopY);

    this.hud.snapParty(this.party);
    this.hud.setGold(rs.goldThisRun);
    this.hud.setClock(rs.timeLeft);
    this.particles.reducedMotion = ctx.fx.reducedMotion();

    if (this.def.kind === 'boss') {
      this.phase = 'boss';
      this.boss.activate();
      this.hud.showBossBar();
      ctx.system.push(SYS.bossSpotted(), 'bad');
    }

    // tutorial: first door of the first tunnel, once, ever
    if (!ctx.save.data.tutorialDone && this.def.kind === 'corridor') this.buildTutorial();

    ctx.audio.music(this.def.kind === 'boss' ? 'musicBoss' : 'musicRun');
    ctx.loop.stepper = this;
    ctx.onAutoPause = () => this.openPause(true);
    ctx.runStats = () => ({
      party: this.party,
      arrows: this.projs.count,
      enemies: this.enemies.count,
      particles: this.particles.liveCount,
      pops: this.pops.liveCount,
      corpses: this.corpses.count,
      clock: Math.round(rs.timeLeft),
      bossHp: this.boss.phase === 'inactive' ? -1 : this.boss.hpFrac,
    });
  }

  override exit(): void {
    this.ctx.system.setTop(Math.max(this.ctx.scaler.safeTop(), 12) + 8);
    this.ctx.loop.stepper = null;
    this.ctx.runStats = null;
    this.ctx.onAutoPause = null;
  }

  // ============================== SIM ==============================

  step(dt: number): void {
    if (this.endT >= 0) return; // ending cinematic: sim frozen, visuals run
    const rs = this.ctx.run!;

    this.playT += dt;
    this.heroPX = this.heroX;
    this.prevDist = this.dist;
    this.cdBlast = Math.max(0, this.cdBlast - dt);
    this.cdRally = Math.max(0, this.cdRally - dt);

    // The floor clock only runs while you are actually in a room. Menus and
    // the map bill fixed costs instead, so nobody is punished for reading.
    if (!rs.spendTime(dt)) { this.timeout(); return; }
    if (!rs.warned && rs.timeLeft <= CONFIG.floors.warnAtSec) {
      rs.warned = true;
      this.ctx.system.push(SYS.timeWarn(CONFIG.floors.warnAtSec), 'bad');
    }

    // steering: exponential chase of the finger target — 1:1 with slight smoothing
    this.heroX += (this.heroTargetX - this.heroX) * Math.min(1, CONFIG.hero.steerLerp * dt);

    // scroll (corridors only)
    const speedMult = Math.min(CONFIG.run.speedMax, 1 + this.party * CONFIG.run.speedPerParty);
    const scroll = this.phase === 'fight' && this.def.kind === 'corridor'
      ? CONFIG.run.baseSpeed * speedMult : 0;
    if (scroll > 0) {
      this.dist += scroll * dt;
      if (this.dist >= this.def.length) { this.succeed(); return; }
    }

    this.spawnDue(dt);
    this.stepDoors();
    this.stepParty(dt);
    this.stepFire(dt);
    this.stepProjectiles(dt, scroll);
    this.stepEnemies(dt, scroll);

    if (this.phase === 'boss') {
      this.boss.step(dt);
      this.hud.setBossHp(this.boss.hpFrac);
      if (this.boss.phase === 'fighting' && this.boss.gateY >= HERO_Y - CONFIG.boss.crushLine) {
        const pct = Math.round(this.boss.hpFrac * 100);
        this.failLine = `It ground your line down with ${pct}% of its plating left.`;
        this.die();
      }
    }

    // arena: cleared once the script is exhausted and nothing is left standing
    if (this.def.kind === 'arena' && this.phase === 'fight'
      && this.nextWave >= this.def.waves.length && this.enemies.count === 0) {
      this.succeed();
    }
  }

  /** activate doors and mob waves whose cue has arrived */
  private spawnDue(dt: number): void {
    if (this.def.kind === 'corridor') {
      const ahead = this.dist + CONFIG.design.height + 160;
      while (this.nextDoor < this.def.doors.length && this.def.doors[this.nextDoor].at <= ahead) {
        const spawn = this.def.doors[this.nextDoor++];
        const view = this.doorViews.find((v) => v.spawn === null);
        if (view) {
          view.assign(spawn);
          this.activeDoors.push({ spawn, view });
        }
      }
      while (this.nextWave < this.def.waves.length && this.def.waves[this.nextWave].at <= ahead) {
        const wave = this.def.waves[this.nextWave++];
        this.spawnWave(wave.kind, wave.count, wave.x);
      }
      return;
    }
    // arena: the wave script is keyed to seconds, not distance
    if (this.def.kind === 'arena') {
      this.arenaT += dt;
      while (this.nextWave < this.def.waves.length && this.def.waves[this.nextWave].at <= this.arenaT) {
        const wave = this.def.waves[this.nextWave++];
        this.spawnWave(wave.kind, wave.count, wave.x);
      }
    }
  }

  private spawnWave(kind: EnemyKind, count: number, waveX: number): void {
    const rs = this.ctx.run!;
    const stat = CONFIG.enemies[kind];
    for (let i = 0; i < count; i++) {
      const e = this.enemies.obtain();
      if (!e) return;
      e.kind = kind;
      e.hp = stat.hp * (1 + rs.floor * CONFIG.enemies.hpPerFloor);
      e.flashT = 0;
      e.phase = Math.random() * Math.PI * 2;
      e.flapT = 0;
      if (kind === 'drone') {
        e.crossDir = i % 2 === 0 ? 1 : -1;
        e.x = CX - e.crossDir * (CONFIG.hero.laneHalfWidth + 70);
        e.y = -60 - i * 52;
      } else {
        e.crossDir = 0;
        e.x = CX + waveX + ((i % 3) - 1) * 40 + (Math.random() - 0.5) * 18;
        e.y = -50 - Math.floor(i / 3) * 48 - Math.random() * 24;
      }
      e.px = e.x; e.py = e.y;
      e.sp.texture = this.ctx.atlas.get(kind === 'drone' ? 'drone0' : kind);
      e.sp.visible = true;
      e.sp.alpha = 1;
    }
  }

  private stepDoors(): void {
    for (let i = this.activeDoors.length - 1; i >= 0; i--) {
      const g = this.activeDoors[i];
      const rel = g.spawn.at - this.dist;
      if (!g.view.done && rel <= CONFIG.doors.triggerBand) this.resolveDoor(g.spawn, g.view);
      if (rel < -(CONFIG.design.height - HERO_Y + 120)) {
        g.view.release();
        this.activeDoors.splice(i, 1);
      }
    }
    // tutorial trigger: hand appears as the first pair approaches the hero
    if (this.tut && !this.tutActive && this.activeDoors.length > 0) {
      const rel = this.activeDoors[0].spawn.at - this.dist;
      if (rel < 430) this.showTutorial();
    }
  }

  private resolveDoor(spawn: DoorSpawn, view: DoorPairView): void {
    const ctx = this.ctx;
    const rs = ctx.run!;
    const side: 'left' | 'right' = this.heroX < CX ? 'left' : 'right';
    const kind = side === 'left' ? spawn.left : spawn.right;
    const other = side === 'left' ? spawn.right : spawn.left;
    const eff = CONFIG.doors.effects[kind];
    const otherEff = CONFIG.doors.effects[other];
    view.markResolved(side);

    const before = this.party;
    let after: number;
    if (eff.trap) {
      const rawLoss = before - Math.floor(before * eff.mult + eff.add);
      const loss = Math.max(0, Math.round(rawLoss * (1 - stats.lossResist(ctx.save.data))));
      after = before - loss;
      if (loss > 0) {
        rs.addLoss('a hazard door', loss);
        ctx.system.push(SYS.trapHit(loss), 'bad');
      }
      rs.hitHazard = true;
    } else {
      after = Math.floor(before * eff.mult + eff.add);
    }
    const gx = CX + (side === 'left' ? -1 : 1) * (CONFIG.doors.archWidth / 2 + 2);
    const gy = HERO_Y - (spawn.at - this.dist);
    // The prompt has done its job once a pair is behind you: never let the hand
    // (or the slow-motion it holds) leak past the door it was teaching.
    this.dismissTutorial();

    if (eff.trap) {
      ctx.audio.play('doorBad');
      ctx.audio.play('partyLoss');
      ctx.haptics.trapHit();
      ctx.fx.shake(CONFIG.fx.shakeTrap);
      this.particles.burst(gx, gy, {
        frame: 'shard', count: CONFIG.fx.doorParticles, tint: CONFIG.colors.trapRed,
        speed: 150, gravity: 420, ttl: 0.5, s0: 1.2, s1: 0.4,
      });
      this.pops.spawn(gx, gy - 30, `−${before - after}`, CONFIG.colors.trapRed, true);
    } else {
      ctx.audio.play('doorGood');
      if (after - before > 4) ctx.audio.play('partyGain');
      ctx.haptics.doorTap();
      ctx.fx.shake(CONFIG.fx.shakeDoor);
      this.particles.burst(gx, gy, {
        frame: 'softDot', count: CONFIG.fx.doorParticles, tint: CONFIG.colors.amberBright,
        speed: 120, ttl: 0.55, additive: true, s0: 1.6, s1: 0.2,
      });
      this.particles.burst(gx, gy, {
        frame: 'star4', count: 6, tint: CONFIG.colors.bone, speed: 90, ttl: 0.5, additive: true, s0: 1, s1: 0.3,
      });
      this.pops.spawn(gx, gy - 30, `+${Math.max(0, after - before)}`, CONFIG.colors.goodTeal, true);
      // near-miss drama: skimmed past a hazard by a hair
      if (otherEff.trap && Math.abs(this.heroX - CX) < CONFIG.doors.nearMissPx) {
        ctx.fx.slowmo(CONFIG.doors.slowmoScale, CONFIG.doors.slowmoMs);
        ctx.audio.play('whoosh', { rate: 0.82 });
      }
    }

    this.setParty(after, eff.trap ? 'a hazard door' : null);
  }

  /** change party count, syncing HUD, tier, run state, overflow gold, and death */
  private setParty(n: number, wipeSource: string | null): void {
    const SQ = CONFIG.party;
    const rs = this.ctx.run!;
    let target = Math.max(0, n);
    if (target > SQ.max) {
      this.bankGold((target - SQ.max) * SQ.overflowGoldPer, CX, HERO_Y - 60);
      target = SQ.max;
    }
    this.party = target;
    rs.setParty(target);
    this.hud.setParty(target);
    const tiers = SQ.tierAt;
    const newTier = target >= tiers[3] ? 4 : target >= tiers[2] ? 3 : target >= tiers[1] ? 2 : target >= tiers[0] ? 1 : 0;
    if (newTier !== this.tier) {
      this.tier = newTier;
      const tex = this.ctx.atlas.get('unit' + newTier);
      for (let i = 0; i < this.units.count; i++) this.units.items[i].sp.texture = tex;
    }
    if (target <= 0 && this.endT < 0 && this.phase !== 'ending') {
      if (wipeSource) this.failLine = `${cap(wipeSource)} took the last of your party.`;
      this.die();
    }
  }

  private stepParty(dt: number): void {
    const SQ = CONFIG.party;
    // stagger visual reinforcements in (~250 ms for big gains)
    if (this.units.count < this.party) {
      this.spawnBudget += dt * Math.max(28, (this.party - this.units.count) * 4.2);
      while (this.spawnBudget >= 1 && this.units.count < this.party) {
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
    } else if (this.units.count > this.party) {
      while (this.units.count > this.party) this.killUnitVisual(this.units.count - 1);
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
      c.ttl = CONFIG.party.deathFlyMs / 1000;
      c.sp.rotation = 0;
    }
    u.sp.visible = false;
    this.units.release(i);
  }

  private stepFire(dt: number): void {
    // hold volleys while the boss makes its entrance — a breath before the duel
    if (this.phase === 'boss' && this.boss.phase === 'entering') return;
    const save = this.ctx.save.data;
    this.fireT -= dt;
    const jitter = CONFIG.fire.beatJitterMs / 1000;
    if (this.fireT <= 0) {
      this.fireT += stats.fireInterval(save);
      this.fireArrow(this.heroX, HERO_Y - 22, stats.arrowDamage(save));
      this.ctx.audio.shoot();
      for (let i = 0; i < this.units.count; i++) this.units.items[i].fireDelay = Math.random() * jitter;
    }
    const dmg = stats.arrowDamage(save);
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

      p.trailT -= dt;
      if (p.trailT <= 0) {
        p.trailT += CONFIG.fx.glyphTrailEvery;
        this.particles.mote(p.x, p.y + 10, 'glyph' + ((i % 3) | 0), CONFIG.colors.amberBright, 40, 0.38, 0.8);
      }

      if (p.life > CONFIG.fire.projLifeSec || p.y < -80) {
        p.sp.visible = false;
        this.projs.release(i);
        continue;
      }

      if (this.phase === 'boss') {
        const res = this.boss.tryHit(p.x, p.y, p.dmg);
        if (res !== 'miss') {
          p.sp.visible = false;
          this.projs.release(i);
          continue;
        }
      }

      // vs mobs (few enough for brute force at 120 Hz)
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
      frame: 'shard', count: 2, tint: CONFIG.colors.rust, speed: 110, ttl: 0.3, gravity: 400,
    });
    if (en.kind === 'brute') this.pops.spawn(hx, hy - 14, String(Math.max(1, Math.round(dmg))), CONFIG.colors.bone);
    if (en.hp <= 0) this.killEnemy(index);
  }

  private killEnemy(index: number): void {
    const en = this.enemies.items[index];
    const rs = this.ctx.run!;
    const stat = CONFIG.enemies[en.kind];
    this.particles.burst(en.x, en.y, {
      frame: 'shard', count: CONFIG.fx.dieParticles, tint: CONFIG.colors.rustDeep,
      speed: 160, speedVar: 80, gravity: 520, ttl: 0.55, spin: 8, s0: 1.3, s1: 0.5,
    });
    this.particles.burst(en.x, en.y, {
      frame: 'softDot', count: 4, tint: CONFIG.colors.amberBright, speed: 60, ttl: 0.4, additive: true, s0: 1.5, s1: 0.2,
    });
    this.ctx.audio.play('enemyDie', { throttleMs: 60, vol: 0.6 });
    this.bankGold(stat.gold, en.x, en.y);
    rs.xpThisRun += stat.xp;
    rs.kills += 1;
    en.sp.visible = false;
    this.enemies.release(index);
  }

  private bankGold(n: number, x: number, y: number): void {
    if (n <= 0) return;
    const rs = this.ctx.run!;
    rs.goldThisRun += n;
    this.hud.setGold(rs.goldThisRun);
    this.particles.burst(x, y, {
      frame: 'coin', count: Math.min(3, n), speed: 60, vy0: -170, gravity: 260, ttl: 0.5, s0: 1, s1: 0.6,
    });
    this.ctx.audio.play('coin', { throttleMs: 90, vol: 0.5 });
  }

  private stepEnemies(dt: number, scroll: number): void {
    const rs = this.ctx.run!;
    const speedScale = 1 + rs.floor * CONFIG.enemies.speedPerFloor;
    for (let i = this.enemies.count - 1; i >= 0; i--) {
      const en = this.enemies.items[i];
      en.px = en.x; en.py = en.y;
      const stat = CONFIG.enemies[en.kind];
      if (en.kind === 'drone') {
        const d = CONFIG.enemies.drone;
        en.x += en.crossDir * d.crossSpeed * speedScale * dt;
        en.phase += d.waveHz * Math.PI * 2 * dt;
        en.y += (scroll * 0.25 + stat.speed * speedScale) * dt + Math.sin(en.phase) * d.waveAmp * dt;
        if ((en.crossDir > 0 && en.x > W + 70) || (en.crossDir < 0 && en.x < -70)) {
          // In a nest there is nowhere to fly off to — turn it around instead,
          // or the room could never be cleared.
          if (this.def.kind === 'arena') { en.crossDir *= -1; }
          else { en.sp.visible = false; this.enemies.release(i); continue; }
        }
      } else {
        en.y += (scroll * 0.55 + stat.speed * speedScale) * dt;
        if (en.kind === 'rat') {
          const dx = this.heroX - en.x;
          en.x += Math.sign(dx) * Math.min(Math.abs(dx), 34 * dt);
        }
      }

      // reached the line?
      if (en.y >= HERO_Y - (CONFIG.hero.radius + stat.radius)) {
        if (Math.abs(en.x - this.heroX) < CONFIG.enemies.contactHalfWidth) {
          this.contact(i, stat.contactLoss, MOB_BLAME[en.kind]);
          continue;
        }
        if (en.y > CONFIG.design.height + 90) {
          if (this.def.kind === 'arena') {
            // walked past the line in a closed room: send it round again
            en.y = -60;
          } else {
            en.sp.visible = false;
            this.enemies.release(i);
          }
        }
      }
    }
  }

  private contact(index: number, rawLoss: number, source: string): void {
    const ctx = this.ctx;
    const rs = ctx.run!;
    const en = this.enemies.items[index];
    const loss = Math.max(1, Math.round(rawLoss * (1 - stats.lossResist(ctx.save.data))));
    this.particles.burst(en.x, en.y, {
      frame: 'softDot', count: 9, tint: CONFIG.colors.trapRed, speed: 120, ttl: 0.4, s0: 1.6, s1: 0.3,
    });
    ctx.audio.play('partyLoss');
    ctx.fx.shake(CONFIG.fx.shakePartyLoss);
    ctx.haptics.trapHit();
    this.pops.spawn(en.x, en.y - 20, `−${Math.min(loss, this.party)}`, CONFIG.colors.trapRed, true);
    en.sp.visible = false;
    this.enemies.release(index);
    rs.addLoss(source, Math.min(loss, this.party));
    this.setParty(this.party - loss, source);
  }

  // ============================== ABILITIES ==============================

  private fireBlast(): void {
    if (this.cdBlast > 0 || this.endT >= 0 || this.ctx.loop.paused) return;
    const save = this.ctx.save.data;
    this.cdBlast = stats.abilityCooldown(save, 'blast');
    const dmg = CONFIG.abilities.blast.damage * stats.abilityPotency(save);

    this.ctx.audio.play('breach', { vol: 0.55, rate: 1.3 });
    this.ctx.fx.shake(CONFIG.fx.shakeBossHit);
    this.ctx.fx.flash(0.3, 3.2);
    this.ctx.haptics.trapHit();
    this.particles.burst(this.heroX, HERO_Y - 40, {
      frame: 'softDot', count: 26, tint: CONFIG.colors.amberBright,
      speed: 260, speedVar: 140, ttl: 0.55, additive: true, s0: 2.2, s1: 0.2,
    });

    // everything on screen takes it, including the boss
    for (let i = this.enemies.count - 1; i >= 0; i--) {
      const en = this.enemies.items[i];
      en.hp -= dmg;
      en.flashT = CONFIG.enemies.hitFlashMs / 1000;
      if (en.hp <= 0) this.killEnemy(i);
    }
    if (this.phase === 'boss') this.boss.tryHit(CX, this.boss.gateY - 40, dmg);
  }

  private fireRally(): void {
    if (this.cdRally > 0 || this.endT >= 0 || this.ctx.loop.paused) return;
    const save = this.ctx.save.data;
    this.cdRally = stats.abilityCooldown(save, 'rally');
    const gain = Math.round(CONFIG.abilities.rally.restore * stats.abilityPotency(save));

    this.ctx.audio.play('partyGain');
    this.ctx.haptics.doorTap();
    this.particles.burst(this.heroX, HERO_Y + 20, {
      frame: 'star4', count: 14, tint: CONFIG.colors.goodTeal,
      speed: 140, ttl: 0.6, additive: true, s0: 1.4, s1: 0.2,
    });
    this.pops.spawn(this.heroX, HERO_Y - 50, `+${gain}`, CONFIG.colors.goodTeal, true);
    this.setParty(this.party + gain, null);
  }

  // ============================== ENDINGS ==============================

  /** Room cleared. Hand control back to the floor map. */
  private succeed(): void {
    if (this.phase === 'ending') return;
    this.phase = 'ending';
    const rs = this.ctx.run!;
    rs.markVisited(this.node.id);
    this.ctx.audio.play('doorGood', { vol: 0.7 });
    const result: EncounterResult = {
      nodeId: this.node.id, survived: true, elapsedSec: this.playT, failReason: '',
    };
    this.endT = 0.5;
    this.endGoto = () => this.ctx.router.goto('floormap', { result });
  }

  private onBossDown(): void {
    if (this.phase === 'ending') return;
    this.phase = 'ending';
    const rs = this.ctx.run!;
    rs.markVisited(this.node.id);
    this.ctx.system.push(SYS.bossDown(), 'good');
    const result: EncounterResult = {
      nodeId: this.node.id, survived: true, elapsedSec: this.playT, failReason: '',
    };
    this.endT = CONFIG.boss.breachDebrisMs / 1000;
    this.endGoto = () => this.ctx.router.goto('floormap', { result });
  }

  private timeout(): void {
    if (this.phase === 'ending') return;
    this.failLine = TIMEOUT_LINE;
    this.die();
  }

  private die(): void {
    if (this.phase === 'ending') return;
    this.phase = 'ending';
    while (this.units.count > 0) this.killUnitVisual(this.units.count - 1);
    this.party = 0;
    this.ctx.run!.setParty(0);
    this.hud.setParty(0);
    this.ctx.fx.shake(CONFIG.fx.shakeBossBreach * 0.7);
    this.ctx.fx.flash(0.35, 1.2);
    this.ctx.audio.play('failSting');
    this.ctx.audio.music(null);

    const rs = this.ctx.run!;
    if (!this.failLine) {
      const worst = rs.worstLoss();
      this.failLine = worst.n > 0
        ? `You lost ${worst.n} to ${worst.source}.`
        : 'The line broke.';
    }
    rs.failLine = this.failLine;
    // The floor map owns ending a floor — win or lose — so payouts, saves and
    // achievement checks all happen in exactly one place.
    const result: EncounterResult = {
      nodeId: this.node.id, survived: false, elapsedSec: this.playT, failReason: this.failLine,
    };
    this.endT = 1.25;
    this.endGoto = () => this.ctx.router.goto('floormap', { result });
  }

  // ============================== RENDER ==============================

  frame(dtReal: number, alpha: number): void {
    const fxT = this.ctx.fx.timescale;
    const dtV = dtReal * fxT;
    const rs = this.ctx.run!;

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
        en.sp.texture = this.ctx.atlas.get(en.kind === 'drone' ? 'droneW' : en.kind + 'W');
      } else if (en.kind === 'drone') {
        en.flapT += dtV;
        en.sp.texture = this.ctx.atlas.get(Math.floor(en.flapT * 7) % 2 === 0 ? 'drone0' : 'drone1');
        en.sp.rotation = en.crossDir * 0.12;
      } else {
        en.sp.texture = this.ctx.atlas.get(en.kind);
      }
    }

    for (const g of this.activeDoors) g.view.root.y = HERO_Y - (g.spawn.at - distR);

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

    // camera pull-back breathes with party size
    const pull = Math.min(CONFIG.run.camPullbackMax, this.party * CONFIG.run.camPullbackPerParty);
    const cur = this.world.scale.x;
    this.world.scale.set(cur + ((1 - pull) - cur) * Math.min(1, CONFIG.run.camLerp * dtReal));

    this.hud.setClock(rs.timeLeft);
    this.hud.setCooldowns(
      1 - this.cdBlast / Math.max(0.001, stats.abilityCooldown(this.ctx.save.data, 'blast')),
      1 - this.cdRally / Math.max(0.001, stats.abilityCooldown(this.ctx.save.data, 'rally')),
    );
    this.hud.setProgress(
      this.def.kind === 'corridor' ? Math.min(1, this.dist / this.def.length)
        : this.def.waves.length === 0 ? 1
        : this.nextWave / this.def.waves.length,
    );

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
    g.roundRect(CX - 150, HERO_Y - 232, 300, 44, 6).fill({ color: CONFIG.colors.pit, alpha: 0.78 });
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
      onRestart: () => this.ctx.router.goto('encounter', { node: this.node.id }),
      onQuit: () => this.ctx.router.goto('floormap'),
    });
    if (auto) this.ctx.audio.muteAll(true);
  }
}

const cap = (s: string): string => (s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s);
