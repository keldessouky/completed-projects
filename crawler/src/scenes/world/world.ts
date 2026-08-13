import { Container, Sprite } from 'pixi.js';
import { CONFIG, type EnemyKind } from '../../config';
import type { Stepper } from '../../core/loop';
import { BLOCK_SIZE, chunkBounds, chunkOrigin, getChunk, getStructure } from '../../assets/terrain';
import { BOSS, CAST, DONUT, GUIDE, KEEP_NAME, MOB_BLAME, PROMOTION, SQUAD_TIER, SYS, UI, UNIT_RANK } from '../../flavour';
import { checkAchievements, onCaptainKill, type AchievementDef } from '../../game/achievements';
import { Combat } from '../../world/combat';
import { Entities, campPositions } from '../../world/entities';
import { Squad } from '../../world/squad';
import { Boss, type BossEvents } from '../../world/boss';
import { coinSpots, getWorld, poiById } from '../../world/worldgen';
import { screenX, screenY, stickToWorld, toScreen } from '../../iso';
import { LOOK_S, STRIDE, frameFor, frameName, isFootfall, lookFrom, type Look } from '../../anim';
import { Joystick } from '../../ui/joystick';
import { showPause } from '../../ui/overlays';
import { Scene } from '../scene';
import { Compass, WorldHud } from './hud';
import { ChevronTrail, CoinStack, HealthBars, PadTag, SquadRing } from './marks';
import { NumberPops, Particles } from './particles';

const W = CONFIG.design.width;
const H = CONFIG.design.height;
const HERO = CONFIG.hero;

/**
 * The field.
 *
 * One continuous plane seen at a 2:1 dimetric angle, a camera window onto it,
 * and everything else — terrain chunks, camp populations, loose coins —
 * streamed in and out around the hero. The simulation runs at a fixed 120 Hz in
 * plain cartesian units and the render interpolates and projects, so movement
 * is identical on a 60 Hz phone and a ProMotion panel.
 *
 * The loop is: walk, pick up coins, spend them at a recruit pad, walk east with
 * more people than you had, and knock the gate down. Nothing else.
 */
export class WorldScene extends Scene implements Stepper {
  // ── layers ──
  private camera = new Container();
  private chunkLayer = new Container();
  private coinLayer = new Container();
  /** flat structures painted onto the ground: plazas, plates, scorch circles */
  private decalLayer = new Container();
  /** flat marks on the ground, under everything that stands on it */
  private groundLayer = new Container();
  private actorLayer = new Container();
  private shotLayer = new Container();
  /** bars and tags, above the world and never depth-sorted into it */
  private overlayLayer = new Container();
  private hud!: WorldHud;
  private compass!: Compass;
  private joystick!: Joystick;
  private particles!: Particles;
  private pops!: NumberPops;
  private squadRing!: SquadRing;
  private trail!: ChevronTrail;
  private bars!: HealthBars;
  private coinStack!: CoinStack;
  private padTags = new Map<string, PadTag>();

  // ── world plumbing ──
  private ents!: Entities;
  private squad!: Squad;
  private combat!: Combat;
  private boss!: Boss;
  private bossEvents: BossEvents = { phase: null, telegraphed: null, slamHit: 0, summon: [] };

  private mounted = new Map<string, Sprite>();
  /** camps whose population is currently instantiated */
  private populated = new Set<string>();
  /** coin table indices currently spawned into the field */
  private liveCoins = new Set<number>();
  private coinTable: { x: number; y: number }[] = [];

  // ── the hero ──
  private hero!: Sprite;
  private heroRing!: Sprite;
  private px = 0; private py = 0;   // previous position, for interpolation
  private vx = 0; private vy = 0;
  /** walk cycle, advanced by ground covered rather than by the clock */
  private walk = 0;
  private lastFrame = 0;
  private look: Look = LOOK_S;

  // ── the companion ──
  private donut!: Sprite;
  private dx = 0; private dy = 0;
  private dpx = 0; private dpy = 0;
  private donutCd = 0;
  private donutWalk = 0;
  private donutLook: Look = LOOK_S;
  private donutAttackT = 0;
  private quipCd = 0;
  /** spins the coins in the field; one clock for all of them is plenty */
  private coinSpin = 0;

  /** gold poured into recruits this run, for the spendthrift achievement */
  private spentOnRecruits = 0;
  /** one-shot guidance flags: Mordecai says each thing exactly once */
  private saidPad = false;
  private saidCamp = false;
  private dead = false;
  private deathT = 0;
  private lowWarned = false;
  private keepAnnounced = false;

  // ── camera, in SCREEN space ──
  private camX = 0;
  private camY = 0;

  // ── the pad you are standing on, if any ──
  private padId: string | null = null;
  private padDrain = 0;
  private autosaveT = 0;
  private lastBlame = '';

  enter(): void {
    const ctx = this.ctx;
    const run = ctx.run;
    if (!run) { ctx.router.goto('title'); return; }

    this.px = run.x; this.py = run.y;
    const s = toScreen(run.x, run.y);
    this.camX = s.x; this.camY = s.y;
    this.coinTable = coinSpots();

    // ── scene graph ──
    this.actorLayer.sortableChildren = true;
    this.coinLayer.sortableChildren = true;
    // chunks sort back-to-front too: a tree near a chunk's edge overhangs into
    // the chunk behind it, and unsorted insertion order would let that
    // neighbour's ground repaint over the tree as the player walks.
    this.chunkLayer.sortableChildren = true;
    this.camera.addChild(
      this.chunkLayer, this.decalLayer, this.groundLayer, this.coinLayer,
      this.actorLayer, this.shotLayer, this.overlayLayer,
    );
    this.container.addChild(this.camera);

    this.squadRing = new SquadRing();
    this.groundLayer.addChild(this.squadRing);
    this.trail = new ChevronTrail(ctx.atlas);
    this.groundLayer.addChild(this.trail);
    this.bars = new HealthBars(ctx.atlas);
    this.coinStack = new CoinStack(ctx.atlas);
    this.overlayLayer.addChild(this.bars, this.coinStack);

    this.particles = new Particles(ctx.atlas);
    this.pops = new NumberPops(ctx.atlas);
    this.camera.addChild(this.particles, this.pops);
    this.particles.reducedMotion = ctx.fx.reducedMotion();

    this.ents = new Entities(ctx.atlas, this.actorLayer, this.shotLayer, this.coinLayer);
    this.squad = new Squad(ctx.atlas, this.actorLayer);
    // ground marks go UNDER everything that stands on the field
    this.boss = new Boss(this.groundLayer);

    // ── structures: sprites, not terrain ──
    //
    // The castle is the only structure tall enough to stand behind, so it is
    // the only one that joins the depth-sorted actor layer. The rest are
    // effectively ground decals — a plaza, a plate, a scorch circle — and they
    // are anchored at their CENTRE, which means sorting them by that centre
    // paints them straight over anything standing on their near half. That is
    // not a subtle artifact: the muster plaza was erasing the companion.
    for (const p of getWorld().pois) {
      const st = getStructure(p.id);
      if (!st) continue;
      const sp = new Sprite(st.tex);
      sp.position.set(screenX(p.x, p.y) - st.ox, screenY(p.x, p.y) - st.oy);
      if (p.kind === 'castle') {
        sp.zIndex = p.x + p.y;
        this.actorLayer.addChild(sp);
      } else {
        this.decalLayer.addChild(sp);
      }

      if (p.kind === 'pad') {
        const tag = new PadTag(ctx.atlas);
        this.padTags.set(p.id, tag);
        this.overlayLayer.addChild(tag);
      }
    }

    // A small gold disc on the ground under the hero specifically. The white
    // squad ring says where the crowd is; this says which of the sixty bodies
    // inside it the stick is actually attached to.
    this.heroRing = new Sprite(ctx.atlas.get('ringFlat'));
    this.heroRing.anchor.set(0.5);
    this.heroRing.scale.set(0.34);
    this.heroRing.tint = CONFIG.colors.gold;
    this.heroRing.alpha = 0.75;
    this.actorLayer.addChild(this.heroRing);

    this.hero = new Sprite(ctx.atlas.get('hero_s_0'));
    this.hero.anchor.set(0.5, 1);
    this.actorLayer.addChild(this.hero);

    this.donut = new Sprite(ctx.atlas.get('donut_s_0'));
    this.donut.anchor.set(0.5, 1);
    this.actorLayer.addChild(this.donut);
    this.dx = this.dpx = run.x - 40;
    this.dy = this.dpy = run.y + 30;

    // The squad the run remembers walks back on; a fresh run is handed a small
    // one at the post. Starting at zero would mean the hero has no attack at
    // all and no way to lose, which makes "the squad is the health bar" a rule
    // with a hole in it on the very first screen.
    // run.squad is WORTH, not bodies — see Squad.addWorth
    this.squad.addWorth(run.squad > 0 ? run.squad : CONFIG.squad.start, run.x, run.y);
    run.squad = this.squad.headcount();

    // ── HUD ──
    this.hud = new WorldHud(ctx, { onPause: () => this.openPause() });
    this.compass = new Compass(ctx);
    this.joystick = new Joystick(ctx.input);
    this.container.addChild(this.hud, this.compass, this.joystick);

    // ── combat ──
    this.combat = new Combat({
      entities: this.ents,
      squad: this.squad,
      atlas: ctx.atlas,
      fx: {
        hit: (x, y, dmg, kind) => this.onHit(x, y, dmg, kind),
        die: (x, y, kind) => this.onDie(x, y, kind),
        shot: (friendly) => ctx.audio.play(friendly ? 'shoot' : 'doorBad', {
          throttleMs: CONFIG.audio.shootThrottleMs, vol: friendly ? 0.35 : 0.45,
        }),
      },
      px: run.x,
      py: run.y,
      heroRadius: HERO.radius,
      onSquadHit: (n, kind, x, y) => this.loseSquad(n, kind, x, y),
      onEnemyDeath: (kind, x, y, poi) => this.rewardKill(kind, x, y, poi),
    });

    ctx.system.setTop(CONFIG.system.worldTopY);
    ctx.audio.music('musicRun');
    ctx.loop.stepper = this;
    ctx.onAutoPause = () => this.openPause(true);
    ctx.worldBreach = () => {
      const k = poiById(getWorld().castle)!;
      if (!run.breached) { run.gateHp = 0; this.breach(k.x, k.y); }
    };
    ctx.runStats = () => ({
      x: Math.round(run.x), y: Math.round(run.y),
      squad: this.squad.headcount(),
      coins: run.coins,
      enemies: this.ents.enemies.count,
      shots: this.ents.shots.count,
      coinsLive: this.ents.coins.count,
      chunks: this.mounted.size,
    });
    ctx.worldProbe = () => this.probe();
    ctx.worldInteract = () => { /* there is no interact button; pads are automatic */ };
    ctx.worldLose = (n) => this.loseSquad(n, 'grunt', run.x, run.y);

    if (!ctx.save.data.tutorialDone) {
      ctx.system.push(SYS.welcome(), 'info');
      ctx.system.push(SYS.donutJoins(), 'good');
      ctx.save.data.tutorialDone = true;
      ctx.save.mark();
    }
  }

  override exit(): void {
    const ctx = this.ctx;
    // the feed sits low to dodge the HUD; menus want it back at the top
    ctx.system.setTop(Math.max(ctx.scaler.safeTop(), 12) + 8);
    ctx.loop.stepper = null;
    ctx.runStats = null;
    ctx.onAutoPause = null;
    ctx.worldProbe = null;
    ctx.worldInteract = null;
    ctx.worldLose = null;
    this.persist();
  }

  private persist(): void {
    const ctx = this.ctx;
    if (!ctx.run) return;
    ctx.run.squad = this.squad.headcount();
    ctx.save.data.run = ctx.run.toSave();
    ctx.save.data.bestSquad = Math.max(ctx.save.data.bestSquad, this.squad.peak);
    ctx.save.mark();
  }

  // ============================== SIM ==============================

  step(dt: number): void {
    const ctx = this.ctx;
    const run = ctx.run!;
    const save = ctx.save.data;

    run.clock += dt;
    save.playSec += dt;
    this.px = run.x; this.py = run.y;
    this.dpx = this.dx; this.dpy = this.dy;
    this.quipCd = Math.max(0, this.quipCd - dt);

    if (this.dead) {
      this.deathT -= dt;
      if (this.deathT <= 0) this.finishDeath();
      return;
    }
    // A wipe is a state of the world, not the return value of one code path:
    // anything that can empty the line — a contact hit, the gate, a debug seam
    // — has to end the same way, so the check lives here rather than in
    // loseSquad. An empty line is a wipe, however it got empty.
    if (this.squad.count <= 0) { this.beginDeath(); return; }

    // ── movement: the stick is a SCREEN direction, the world is not ──
    const v = ctx.input.vector();
    const dir = stickToWorld(v.x, v.y);
    const mag = Math.min(1, Math.hypot(v.x, v.y));
    this.vx = dir.x * HERO.speed * mag;
    this.vy = dir.y * HERO.speed * mag;
    run.x += this.vx * dt;
    run.y += this.vy * dt;
    const pad = CONFIG.world.edgePad;
    run.x = Math.max(pad, Math.min(CONFIG.world.size - pad, run.x));
    run.y = Math.max(pad, Math.min(CONFIG.world.size - pad, run.y));
    const lateral = screenX(this.vx, this.vy);
    if (Math.abs(lateral) > 6) run.face = lateral < 0 ? -1 : 1;
    this.walk = (this.walk + (Math.hypot(this.vx, this.vy) * dt) / STRIDE) % 1;

    this.squad.step(dt, run.x, run.y, run.clock);
    this.squad.peak = Math.max(this.squad.peak, this.squad.headcount());
    this.stepCompanion(dt);

    // ── the world around the hero ──
    this.combat.px = run.x;
    this.combat.py = run.y;
    this.streamCamps();
    this.streamCoins();
    this.combat.step(dt);
    this.stepBoss(dt);
    this.collectCoins(dt);
    this.stepPad(dt);
    this.stepGate(dt);
    this.checkCampsCleared();

    // ── autosave ──
    this.autosaveT += dt;
    if (this.autosaveT >= CONFIG.save.autosaveSec) {
      this.autosaveT = 0;
      this.persist();
    }
  }

  /**
   * The companion follows and fights on her own account.
   *
   * She is deliberately outside the squad: no formation slot, no contribution
   * to `strength()`, and nothing can take her off the board. A wipe therefore
   * leaves the player with a cat and a direction rather than with nothing,
   * which is the difference between a setback and a game over.
   */
  private stepCompanion(dt: number): void {
    const ctx = this.ctx;
    const run = ctx.run!;
    const C = CONFIG.companion;

    const dx = run.x - this.dx, dy = run.y - this.dy;
    const d = Math.hypot(dx, dy);
    let moved = 0;
    if (d > C.followDist) {
      const move = Math.min(C.speed * dt, d - C.followDist);
      this.dx += (dx / d) * move;
      this.dy += (dy / d) * move;
      moved = move;
      this.donutLook = lookFrom(dx, dy, this.donutLook);
    }
    this.donutWalk = (this.donutWalk + moved / (STRIDE * 0.7)) % 1;
    this.donutMoving = moved > 0.4;
    if (this.donutAttackT > 0) this.donutAttackT -= dt;

    this.donutCd -= dt;
    if (this.donutCd > 0) return;
    const t = this.ents.nearest(this.dx, this.dy, C.range);
    if (t < 0) return;
    const e = this.ents.enemies.items[t];
    const ex = e.x - this.dx, ey = e.y - this.dy;
    const len = Math.hypot(ex, ey) || 1;
    this.ents.spawnShot(
      ctx.atlas, this.dx, this.dy,
      (ex / len) * CONFIG.combat.spearSpeed, (ey / len) * CONFIG.combat.spearSpeed,
      C.damage, true,
    );
    this.donutCd = C.interval;
    this.donutAttackT = 0.2;
    this.donutLook = lookFrom(ex, ey, this.donutLook);
  }
  private donutMoving = false;

  /**
   * Instantiate the populations of nearby camps and refund distant ones.
   * This is what keeps a 3600² field the same cost as one busy screen.
   */
  private streamCamps(): void {
    const ctx = this.ctx;
    const run = ctx.run!;
    const near = CONFIG.enemies.despawnDist;

    for (const p of getWorld().pois) {
      if (!p.spawns) continue;
      const d = Math.hypot(p.x - run.x, p.y - run.y);
      const live = this.populated.has(p.id);

      if (!live && d < near * 0.8 && !run.isCleared(p.id)) {
        for (const s of campPositions(p)) {
          this.ents.spawnEnemy(ctx.atlas, s.kind, s.x, s.y, p.id);
        }
        this.populated.add(p.id);
        if (!this.saidCamp) {
          this.saidCamp = true;
          ctx.system.push(GUIDE.firstCamp, 'info');
        }
      } else if (live && d > near) {
        for (let i = this.ents.enemies.count - 1; i >= 0; i--) {
          if (this.ents.enemies.items[i].poi === p.id) this.ents.killEnemy(i);
        }
        this.populated.delete(p.id);
      }
    }
  }

  /** The same trick for the coin table: only nearby coins exist as objects. */
  private streamCoins(): void {
    const run = this.ctx.run!;
    const near = 900;
    for (let i = 0; i < this.coinTable.length; i++) {
      if (run.coinTaken(i) || this.liveCoins.has(i)) continue;
      const c = this.coinTable[i];
      if (Math.hypot(c.x - run.x, c.y - run.y) > near) continue;
      if (this.ents.spawnCoin(c.x, c.y, CONFIG.coins.value, i)) this.liveCoins.add(i);
    }
    // drop the far ones so the pool never saturates on a long walk
    for (let i = this.ents.coins.count - 1; i >= 0; i--) {
      const c = this.ents.coins.items[i];
      if (c.hooked || Math.hypot(c.x - run.x, c.y - run.y) < near * 1.4) continue;
      if (c.spot >= 0) this.liveCoins.delete(c.spot);
      this.ents.takeCoin(i);
    }
  }

  /**
   * Coins inside the pickup radius fly to the hero and land in the purse.
   *
   * The magnet is generous on purpose: bending the walk to hoover up a coin
   * would make the coin the decision, and the decision is supposed to be where
   * the crowd goes.
   */
  private collectCoins(dt: number): void {
    const ctx = this.ctx;
    const run = ctx.run!;
    const C = CONFIG.coins;
    for (let i = this.ents.coins.count - 1; i >= 0; i--) {
      const c = this.ents.coins.items[i];
      c.t = Math.min(1, c.t + dt * 3);
      const dx = run.x - c.x, dy = run.y - c.y;
      const d = Math.hypot(dx, dy) || 1;

      if (!c.hooked && d < HERO.pickupRadius) {
        c.hooked = true;
        c.mv = C.magnet;
        c.ht = 0;
        // a puff as it tears loose, so the hook reads as a moment and not a
        // coin that simply started moving
        this.particles.burst(screenX(c.x, c.y), screenY(c.x, c.y) - 6, {
          frame: 'softDot', count: 2, tint: CONFIG.colors.gold,
          speed: 42, ttl: 0.24, s0: 0.5, s1: 0, additive: true,
        });
      }
      if (!c.hooked) continue;

      // Accelerating, not constant. A coin that closes at one speed reads as
      // a coin sliding along the floor; one that starts slow and finishes fast
      // reads as being PULLED, and that difference is the whole feel of pickup.
      c.ht += dt;
      c.mv = Math.min(C.magnetMax, c.mv * (1 + (C.magnetAccel - 1) * dt));
      const step = c.mv * dt;

      if (d <= step) {
        run.addCoins(c.value);
        ctx.audio.play('coin', { throttleMs: 40, vol: 0.42 });
        if (c.spot >= 0) { run.takeCoinSpot(c.spot); this.liveCoins.delete(c.spot); }
        this.particles.burst(screenX(run.x, run.y), screenY(run.x, run.y) - 22, {
          frame: 'softDot', count: 3, tint: CONFIG.colors.gold,
          speed: 70, ttl: 0.2, s0: 0.42, s1: 0, additive: true,
        });
        this.ents.takeCoin(i);
        continue;
      }

      // Curve in rather than tracking dead straight. The sideways push decays
      // with the trip, so the path is a hook that ends pointing at the hero —
      // sixty coins converging on straight lines looks like a spreadsheet.
      const ux = dx / d, uy = dy / d;
      const swirl = C.magnetArc * Math.exp(-c.ht * 3.2);
      c.x += (ux * step) - uy * swirl * dt * 6;
      c.y += (uy * step) + ux * swirl * dt * 6;
    }
  }

  // ============================== RECRUIT PADS ==============================

  /**
   * Standing on a pad drains coins into people, continuously.
   *
   * There is no button and no shop screen: you walk onto the plate, the number
   * on the left goes down and the number above your head goes up, and you walk
   * off when you have had enough. The rate is per-second rather than per-tap so
   * that "how long do I stand here" is the actual decision.
   */
  private stepPad(dt: number): void {
    const ctx = this.ctx;
    const run = ctx.run!;

    let found: string | null = null;
    for (const p of getWorld().pois) {
      if (p.kind !== 'pad') continue;
      if (Math.hypot(p.x - run.x, p.y - run.y) < HERO.useRadius + 24) { found = p.id; break; }
    }
    if (found !== this.padId) {
      this.padId = found;
      this.padDrain = 0;
    }
    if (!found) return;
    if (!this.saidPad) {
      this.saidPad = true;
      this.ctx.system.push(GUIDE.firstPad, 'info');
    }

    const left = run.padLeft(found);
    if (left <= 0 || this.squad.count >= CONFIG.squad.max) return;

    this.padDrain += CONFIG.pad.drainPerSec * dt;
    const cost = run.padCost(found);
    while (this.padDrain >= 1 && run.coins > 0) {
      // one coin at a time, so a nearly-empty purse still buys something
      this.padDrain -= 1;
      run.spendCoins(1);
      this.padPaid += 1;
      if (this.padPaid < cost) continue;
      this.padPaid = 0;
      const p = poiById(found)!;
      if (this.squad.add(1, p.x + (Math.random() - 0.5) * 40, p.y + (Math.random() - 0.5) * 40) === 0) break;
      run.padTake(found);
      this.spentOnRecruits += cost;
      ctx.audio.play('partyGain', { throttleMs: 90, vol: 0.5 });
      this.quip(DONUT.recruit);
      ctx.haptics.hit();
      this.particles.burst(screenX(p.x, p.y), screenY(p.x, p.y), {
        frame: 'softDot', count: 4, tint: CONFIG.colors.ally,
        speed: 90, ttl: 0.35, additive: true, s0: 1.2, s1: 0.2,
      });
      this.runPromotions();
      if (run.padLeft(found) <= 0) {
        ctx.system.push(SYS.padEmpty(p.name), 'info');
        ctx.system.push(GUIDE.padDry, 'info');
        break;
      }
    }
  }
  private padPaid = 0;

  /**
   * Fuse full sets into higher ranks, and sell it.
   *
   * A merge deletes four bodies, so without something loud happening at the
   * same moment it reads as the crowd being culled. The flash, the ring of
   * sparks and the System line are all there to make five-into-one land as a
   * promotion rather than as a loss.
   */
  private runPromotions(): void {
    const ranks = this.squad.promote();
    if (!ranks.length) return;
    const ctx = this.ctx;
    const at = { x: 0, y: 0 };
    if (!this.squad.bestPosition(at)) return;
    const sx = screenX(at.x, at.y), sy = screenY(at.x, at.y);

    const top = Math.max(...ranks);
    this.particles.burst(sx, sy - 18, {
      frame: 'softDot', count: 14, tint: CONFIG.colors.gold,
      speed: 150, ttl: 0.5, additive: true, s0: 1.4, s1: 0,
    });
    this.particles.burst(sx, sy - 18, {
      frame: 'shard', count: 8, tint: CONFIG.colors.bone,
      speed: 190, ttl: 0.42, gravity: 180,
    });
    this.pops.spawn(sx, sy - 46, UNIT_RANK[top] ?? 'Promoted', CONFIG.colors.gold, true);
    ctx.audio.play('upgrade', { throttleMs: 200, vol: 0.62 });
    ctx.fx.shake(CONFIG.fx.shakeRecruit);
    ctx.haptics.hit();

    // Announce only the best rank reached, and only when it is a NEW high for
    // the run. A cascade can promote three ranks in one coin, and three toasts
    // for one event is the System being chatty rather than bureaucratic.
    if (top > this.bestRankSeen) {
      this.bestRankSeen = top;
      const n = this.squad.rankCount(top);
      ctx.system.push(PROMOTION(UNIT_RANK[top] ?? 'Unit', n), 'good');
    }
  }
  private bestRankSeen = 0;

  // ============================== THE GATE ==============================

  /**
   * The castle. Standing in range chips the gate down and costs you people —
   * the whole objective is a question of whether your crowd outlasts the door.
   */
  private stepGate(dt: number): void {
    const ctx = this.ctx;
    const run = ctx.run!;
    if (run.breached) return;
    const keep = poiById(getWorld().castle)!;
    const d = Math.hypot(keep.x - run.x, keep.y - run.y);

    if (d < CONFIG.castle.range * 3 && !this.keepAnnounced) {
      this.keepAnnounced = true;
      ctx.system.push(SYS.keepSpotted(), 'bad');
    }
    if (d > CONFIG.castle.range) return;

    run.gateHp -= CONFIG.squad.damage * this.squad.strength() * dt / CONFIG.squad.interval * 0.5;
    this.gateBleed += CONFIG.castle.gateDps * dt;
    while (this.gateBleed >= 1) {
      this.gateBleed -= 1;
      this.loseSquad(1, 'captain', run.x, run.y);
      if (this.dead) return;
    }
    if (run.gateHp <= 0) {
      run.gateHp = 0;
      this.breach(keep.x, keep.y);
    }
  }
  private gateBleed = 0;

  private breach(x: number, y: number): void {
    const ctx = this.ctx;
    const run = ctx.run!;
    run.breached = true;
    ctx.fx.shake(CONFIG.fx.shakeBreach);
    ctx.fx.flash(0.8, 1.8);
    ctx.haptics.boss();
    ctx.audio.play('breach', { vol: 0.9 });
    this.particles.burst(screenX(x, y), screenY(x, y), {
      frame: 'brickChunk', count: 30, tint: CONFIG.colors.stone,
      speed: 260, speedVar: 140, gravity: 460, ttl: 1.1, spin: 8, s0: 1.4, s1: 0.6,
    });
    this.combat.blast(x, y, 320, 9999);
    ctx.system.push(SYS.keepBreached(), 'good');
    this.quip(DONUT.keep);
    this.awardAchievements();
    this.persist();
    this.wakeBoss(x, y);
  }

  // ============================== THE WARDEN ==============================

  /**
   * The gate coming down is not the end of the floor any more — it is the
   * door opening. He is placed a little back from the gate so he walks OUT of
   * it rather than appearing on top of you.
   */
  private wakeBoss(x: number, y: number): void {
    const ctx = this.ctx;
    const e = this.ents.spawnEnemy(ctx.atlas, 'boss', x, y + CONFIG.boss.offsetY, 'keep_boss');
    if (!e) return;
    this.boss.attach(e);
    ctx.audio.play('bossWake', { vol: 0.9 });
    ctx.fx.shake(CONFIG.fx.shakeBreach * 0.6);
    ctx.haptics.boss();
    ctx.system.push(BOSS.wake, 'bad');
    this.quip([BOSS.donutWake]);
  }

  /**
   * Drive the boss and turn what it reports into noise and consequences.
   *
   * The controller itself touches nothing but its own state and the enemy
   * record, so everything the player actually experiences — the shake, the
   * sound, the losses, the System lines — is assembled here where the rest of
   * the scene's effects already live.
   */
  private stepBoss(dt: number): void {
    if (!this.boss.alive) return;
    const ctx = this.ctx;
    const run = ctx.run!;
    const ev = this.bossEvents;
    this.boss.aim(run.x, run.y);
    this.boss.step(dt, run.x, run.y, ev);

    if (ev.phase === 2) {
      ctx.system.push(BOSS.phase2, 'bad');
      ctx.fx.shake(CONFIG.fx.shakeLoss);
      ctx.audio.play('bossWake', { vol: 0.6 });
    } else if (ev.phase === 3) {
      ctx.system.push(BOSS.phase3, 'bad');
      ctx.fx.shake(CONFIG.fx.shakeBreach * 0.5);
      ctx.fx.flash(0.5, 1.2);
      ctx.audio.play('bossWake', { vol: 0.8 });
      ctx.haptics.boss();
    }

    if (ev.telegraphed === 'charge') {
      ctx.audio.play('whoosh', { vol: 0.5 });
      this.quip([BOSS.charge]);
    } else if (ev.telegraphed === 'slam') {
      ctx.audio.play('bossWake', { vol: 0.45 });
      this.quip([BOSS.slam]);
    }

    if (ev.slamHit > 0) {
      this.loseSquad(ev.slamHit, 'boss', run.x, run.y);
      ctx.fx.shake(CONFIG.fx.shakeLoss);
      ctx.haptics.hurt();
      ctx.audio.play('shieldClang', { vol: 0.7 });
    }

    for (const s of ev.summon) {
      if (this.ents.enemies.count >= CONFIG.boss.summonCap + 6) break;
      const e = this.ents.spawnEnemy(ctx.atlas, 'grunt', s.x, s.y, 'keep_boss');
      if (!e) continue;
      this.particles.burst(screenX(s.x, s.y), screenY(s.x, s.y), {
        frame: 'softDot', count: 6, tint: CONFIG.colors.foe,
        speed: 120, ttl: 0.4, additive: true, s0: 1.2, s1: 0,
      });
    }
    if (ev.summon.length) ctx.audio.play('bossWake', { vol: 0.4 });

    // ── he died ──
    if (this.boss.e && this.boss.e.hp <= 0) {
      const bx = this.boss.e.x, by = this.boss.e.y;
      this.boss.clear();
      ctx.fx.shake(CONFIG.fx.shakeBreach);
      ctx.fx.flash(1, 2.2);
      ctx.haptics.boss();
      ctx.audio.play('winJingle', { vol: 0.9 });
      ctx.system.push(BOSS.dead, 'good');
      this.quip([BOSS.donutDead]);
      this.particles.burst(screenX(bx, by), screenY(bx, by) - 30, {
        frame: 'shard', count: 40, tint: CONFIG.colors.stone,
        speed: 300, speedVar: 160, gravity: 420, ttl: 1.2, spin: 9, s0: 1.5, s1: 0.5,
      });
      this.particles.burst(screenX(bx, by), screenY(bx, by) - 30, {
        frame: 'softDot', count: 20, tint: CONFIG.colors.gold,
        speed: 220, ttl: 0.9, additive: true, s0: 1.8, s1: 0,
      });
      this.awardAchievements();
      this.persist();
    }
  }

  // ============================== COMBAT HOOKS ==============================

  private onHit(x: number, y: number, dmg: number, kind: EnemyKind): void {
    const ctx = this.ctx;
    const sx = screenX(x, y), sy = screenY(x, y);
    this.particles.burst(sx, sy - 14, {
      frame: 'shard', count: CONFIG.fx.hitParticles, tint: CONFIG.colors.bone,
      speed: 110, ttl: 0.28, gravity: 260,
    });
    this.pops.spawn(sx, sy - 26, String(Math.max(1, Math.round(dmg))), CONFIG.colors.bone);
    ctx.audio.hit();
    if (kind === 'captain') ctx.fx.shake(CONFIG.fx.shakeHit);
  }

  private onDie(x: number, y: number, kind: EnemyKind): void {
    const ctx = this.ctx;
    const sx = screenX(x, y), sy = screenY(x, y);
    this.particles.burst(sx, sy - 14, {
      frame: 'shard', count: CONFIG.fx.dieParticles, tint: CONFIG.colors.foeDark,
      speed: 170, speedVar: 80, gravity: 420, ttl: 0.55, spin: 8, s0: 1.3, s1: 0.4,
    });
    ctx.audio.play('enemyDie', { throttleMs: 50, vol: 0.5 });
    if (kind === 'captain') {
      ctx.fx.shake(CONFIG.fx.shakeLoss);
      ctx.haptics.boss();
    } else {
      ctx.haptics.hit();
    }
  }

  /** Coins for a kill, and the achievements a kill can trip. */
  private rewardKill(kind: EnemyKind, x: number, y: number, poi: string): void {
    void poi;
    const ctx = this.ctx;
    const save = ctx.save.data;
    const stat = CONFIG.enemies[kind];

    save.kills += 1;
    ctx.run!.kills += 1;
    const n = Math.max(1, Math.round(stat.coins / 2));
    for (let i = 0; i < n; i++) {
      this.ents.spawnCoin(
        x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 40,
        Math.max(1, Math.round(stat.coins / n)), -1,
      );
    }
    if (kind === 'captain') {
      const a = onCaptainKill(save);
      if (a) this.grantAchievement(a);
    }
    this.awardAchievements();
  }

  /**
   * Lose people off the line. This is the only damage in the game: there is no
   * health bar, and the hero cannot be hurt except by running out of crowd.
   */
  private loseSquad(n: number, kind: EnemyKind, x: number, y: number): void {
    const ctx = this.ctx;
    const run = ctx.run!;
    if (this.dead) return;

    const lost = this.squad.lose(n);
    this.lastBlame = MOB_BLAME[kind];
    if (lost === 0) return;   // already empty; step() owns the wipe
    run.squad = this.squad.headcount();
    if (this.squad.headcount() < 10) run.untouched = false;

    ctx.fx.shake(CONFIG.fx.shakeLoss * Math.min(1, lost / 2));
    ctx.haptics.hurt();
    ctx.audio.play('partyLoss', { throttleMs: 110, vol: 0.55 });
    this.pops.spawn(screenX(x, y), screenY(x, y) - 40, `−${lost}`, CONFIG.colors.hpRed, true);
    ctx.system.push(SYS.squadLost(lost, MOB_BLAME[kind]), 'bad');
    this.quip(DONUT.loss);

    if (this.squad.headcount() <= 5 && !this.lowWarned) {
      this.lowWarned = true;
      ctx.system.push(SYS.lowSquad(), 'bad');
    }
  }

  /** A camp with a population that is now empty counts as cleared. */
  private checkCampsCleared(): void {
    const ctx = this.ctx;
    const run = ctx.run!;
    for (const id of [...this.populated]) {
      let alive = 0;
      for (let i = 0; i < this.ents.enemies.count; i++) {
        if (this.ents.enemies.items[i].poi === id) alive++;
      }
      if (alive > 0) continue;
      this.populated.delete(id);
      if (run.isCleared(id)) continue;
      run.markCleared(id);
      const p = poiById(id);
      if (p) ctx.system.push(SYS.campCleared(p.name), 'good');
      this.quip(DONUT.camp);
      this.awardAchievements();
      this.persist();
    }
  }

  private awardAchievements(): void {
    const ctx = this.ctx;
    const earned = checkAchievements(ctx.save.data, ctx.run!, {
      squad: this.squad.headcount(),
      spent: this.spentOnRecruits,
    });
    for (const a of earned) this.grantAchievement(a);
  }

  private grantAchievement(a: AchievementDef): void {
    const ctx = this.ctx;
    ctx.run!.addCoins(a.coins);
    ctx.system.pushAchievement({ name: a.name, sting: a.sting, coins: a.coins });
    ctx.audio.play('starPop', { vol: 0.7 });
    ctx.haptics.hit();
  }

  /**
   * Donut, interjecting. She has an opinion about everything, so the only
   * interesting design question is how often — a cooldown, not a probability,
   * because a run of three bad rolls in a row would make her look absent.
   */
  private quip(lines: readonly string[]): void {
    if (this.quipCd > 0) return;
    this.quipCd = CONFIG.companion.quipCooldown;
    const line = lines[Math.floor(Math.random() * lines.length)];
    this.ctx.system.push([`${CAST.companion}:`, line], 'info');
  }

  // ============================== WIPE ==============================

  private beginDeath(): void {
    if (this.dead) return;
    const ctx = this.ctx;
    this.dead = true;
    this.deathT = 1.4;
    this.hero.texture = ctx.atlas.get('hero_dead');
    ctx.fx.shake(CONFIG.fx.shakeLoss * 2);
    ctx.fx.flash(0.4, 1.4);
    ctx.audio.play('failSting');
    ctx.audio.music(null);
    ctx.system.push(SYS.wiped(), 'bad');
    this.quipCd = 0;
    this.quip(DONUT.wipe);
  }

  private finishDeath(): void {
    const ctx = this.ctx;
    const run = ctx.run!;
    const save = ctx.save.data;
    save.totalRuns += 1;

    // the field keeps what you did to it; you go back to the muster point empty
    const home = run.restartPos();
    run.x = home.x; run.y = home.y;
    run.squad = 0;
    run.coins = Math.floor(run.coins / 2);
    run.untouched = false;
    this.persist();
    ctx.router.goto('death', { blame: this.lastBlame, squad: this.squad.peak });
  }

  // ============================== RENDER ==============================

  frame(dtReal: number, alpha: number): void {
    const ctx = this.ctx;
    const run = ctx.run;
    if (!run) return;
    const dtV = dtReal * ctx.fx.timescale;

    // ── camera: dead zone, then ease, all in screen space ──
    const ix = this.px + (run.x - this.px) * alpha;
    const iy = this.py + (run.y - this.py) * alpha;
    const hx = screenX(ix, iy);
    const hy = screenY(ix, iy) + CONFIG.camera.biasY;
    const dzx = hx - this.camX, dzy = hy - this.camY;
    if (Math.abs(dzx) > CONFIG.camera.deadZoneX) {
      this.camX += dzx - Math.sign(dzx) * CONFIG.camera.deadZoneX;
    }
    if (Math.abs(dzy) > CONFIG.camera.deadZoneY) {
      this.camY += dzy - Math.sign(dzy) * CONFIG.camera.deadZoneY;
    }
    const ease = Math.min(1, CONFIG.camera.lerp * dtReal);
    this.camX += (hx - this.camX) * ease * 0.35;
    this.camY += (hy - this.camY) * ease * 0.35;
    this.camera.position.set(Math.round(W / 2 - this.camX), Math.round(H / 2 - this.camY));

    this.mountChunks();

    // ── the hero ──
    const moving = Math.hypot(this.vx, this.vy) > 8;
    if (!this.dead) {
      if (moving) this.look = lookFrom(this.vx, this.vy, this.look);
      const frame = frameFor(this.walk, moving, 0);
      this.hero.texture = ctx.atlas.get(frameName('hero', this.look, frame));
      this.hero.scale.x = this.look.flip ? -1 : 1;
      // dust on the two frames where a foot actually plants
      if (isFootfall(this.lastFrame, frame) && moving) {
        this.particles.burst(screenX(ix, iy), screenY(ix, iy), {
          frame: 'puff', count: 1, tint: CONFIG.colors.sandDark,
          speed: 12, ttl: 0.34, s0: 0.5, s1: 1.1, a0: 0.5, a1: 0,
        });
      }
      this.lastFrame = frame;
    }
    this.hero.position.set(screenX(ix, iy), screenY(ix, iy));
    this.hero.zIndex = ix + iy;
    this.heroRing.position.set(screenX(ix, iy), screenY(ix, iy));
    // just behind the hero in the same sort, so it reads as under his feet
    this.heroRing.zIndex = ix + iy - 0.5;

    // ── the companion ──
    const dix = this.dpx + (this.dx - this.dpx) * alpha;
    const diy = this.dpy + (this.dy - this.dpy) * alpha;
    this.donut.texture = ctx.atlas.get(frameName(
      'donut', this.donutLook, frameFor(this.donutWalk, this.donutMoving, this.donutAttackT),
    ));
    this.donut.scale.x = this.donutLook.flip ? -1 : 1;
    this.donut.position.set(screenX(dix, diy), screenY(dix, diy));
    this.donut.zIndex = dix + diy;

    // the squad draws itself; it owns sixty sprites and their gait
    this.squad.draw(0, 0);

    // ── enemies ──
    for (let i = 0; i < this.ents.enemies.count; i++) {
      const e = this.ents.enemies.items[i];
      const ex = e.px + (e.x - e.px) * alpha;
      const ey = e.py + (e.y - e.py) * alpha;
      const stepX = e.x - e.px, stepY = e.y - e.py;
      const speed = Math.hypot(stepX, stepY) / Math.max(1e-4, dtReal);
      const eMoving = speed > 12;
      if (eMoving) {
        e.look = lookFrom(stepX, stepY, e.look);
        e.walk = (e.walk + Math.hypot(stepX, stepY) / STRIDE) % 1;
      } else if (e.aggro) {
        // a stopped enemy is one that has arrived and is swinging
        e.look = lookFrom(run.x - e.x, run.y - e.y, e.look);
        e.attackT = 0.3;
      }
      if (e.attackT > 0) e.attackT -= dtReal;
      const eKind = ctx.atlas.variantKind(e.kind, e.variant);
      if (e.flashT > 0) {
        e.flashT -= dtReal;
        e.sp.texture = ctx.atlas.get(eKind + '_flash');
        e.sp.scale.x = 1;
      } else {
        e.sp.texture = ctx.atlas.get(
          frameName(eKind, e.look, frameFor(e.walk, eMoving, e.attackT)),
        );
        e.sp.scale.x = e.look.flip ? -1 : 1;
      }
      e.sp.position.set(screenX(ex, ey), screenY(ex, ey));
      e.sp.zIndex = ex + ey;
    }

    // ── projectiles ──
    for (let i = 0; i < this.ents.shots.count; i++) {
      const s = this.ents.shots.items[i];
      const sx = s.px + (s.x - s.px) * alpha;
      const sy = s.py + (s.y - s.py) * alpha;
      // shots fly a little above the ground plane, or they read as skidding
      this.ents.shots.items[i].sp.position.set(screenX(sx, sy), screenY(sx, sy) - 18);
    }

    // ── coins, turning ──
    // A field of static discs reads as litter; a field of turning ones reads as
    // treasure. The spin is one clock offset per coin, not one clock each.
    this.coinSpin += dtReal * 3.2;
    for (let i = 0; i < this.ents.coins.count; i++) {
      const c = this.ents.coins.items[i];
      const hop = c.t < 1 ? Math.sin(c.t * Math.PI) * 16 : 0;
      const idle = Math.abs(Math.sin(performance.now() / 300 + c.x)) * 3;
      c.sp.texture = ctx.atlas.get('coin_' + (Math.floor(this.coinSpin + c.x * 0.07) & 3));
      c.sp.position.set(screenX(c.x, c.y), screenY(c.x, c.y) - hop - idle);
      c.sp.zIndex = c.x + c.y;
    }

    // ── the read-at-a-glance layer ──
    this.squadRing.update(ix, iy, this.crowdRadius());
    this.bars.fromEnemies(this.ents.enemies.items, this.ents.enemies.count, alpha);
    this.coinStack.update(screenX(ix, iy) + 13, screenY(ix, iy) - 34, run.coins);
    for (const [id, tag] of this.padTags) {
      const p = poiById(id)!;
      const left = run.padLeft(id);
      tag.set(screenX(p.x, p.y), screenY(p.x, p.y) - 34, run.padCost(id), left <= 0);
    }
    this.updateTrail(dtReal, ix, iy, run.breached);

    this.particles.budgetScale = ctx.loop.thermalSoften() ? CONFIG.thermal.particleBudgetScale : 1;
    this.particles.update(dtV);
    this.pops.update(dtReal);

    // ── HUD ──
    this.hud.setSquad(this.squad.headcount(), this.squadTierName());
    this.boss.draw(this.camX, this.camY);
    this.hud.setCoins(run.coins);
    const keep = poiById(getWorld().castle)!;
    const keepD = Math.hypot(keep.x - run.x, keep.y - run.y);
    // The Warden takes the bar over the moment he is on his feet; before that
    // it belongs to the gate. They can never both be live — he comes out of it.
    if (this.boss.alive) {
      this.hud.setBoss(this.boss.hpFrac, BOSS.name);
    } else {
      this.hud.resetGateLabel();
      this.hud.setGate(
        run.breached || keepD > CONFIG.castle.range * 3 ? -1 : run.gateHp / CONFIG.castle.hp,
      );
    }
    this.hud.setPad(this.padId ? this.padText(this.padId) : null, this.padFrac());
    this.hud.setHint(this.hintText(keepD));
    this.compass.aim(
      screenX(keep.x - run.x, keep.y - run.y),
      screenY(keep.x - run.x, keep.y - run.y),
      !run.breached && keepD > 500,
    );
    this.joystick.update(dtReal);
  }

  /**
   * The crowd's radius in world units — the outermost occupied formation ring
   * plus a margin. The white ring is drawn to this, so it grows with the crew
   * and a glance at its size tells you roughly how many you have.
   */
  private crowdRadius(): number {
    const SQ = CONFIG.squad;
    let ring = 0, base = 0;
    const n = Math.max(1, this.squad.headcount());
    for (;;) {
      const cap = SQ.perRing * (ring + 1);
      if (n <= base + cap) break;
      base += cap;
      ring++;
    }
    return Math.max(46, SQ.ringGap * (ring + 1) + 26);
  }

  /**
   * Where the trail points.
   *
   * Not always the keep: a player with no gold and no crew needs a pad far more
   * than they need the objective, and a trail that only ever pointed at the
   * gate would be pointing them at a wipe.
   */
  private updateTrail(dt: number, ix: number, iy: number, breached: boolean): void {
    const run = this.ctx.run!;
    const world = getWorld();
    const wantPad = !breached && (run.coins >= CONFIG.pad.costBase * 6 || this.squad.headcount() < 6);

    let target: { x: number; y: number } | null = null;
    let tint: number = CONFIG.colors.gold;
    if (wantPad) {
      let best = Infinity;
      for (const p of world.pois) {
        if (p.kind !== 'pad' || run.padLeft(p.id) <= 0) continue;
        const d = Math.hypot(p.x - ix, p.y - iy);
        if (d < best) { best = d; target = p; }
      }
      tint = CONFIG.colors.ally;
    }
    if (!target && !breached) {
      target = poiById(world.castle)!;
      tint = CONFIG.colors.gold;
    }
    if (!target) { this.trail.hide(); return; }
    this.trail.update(dt, ix, iy, target.x, target.y, tint, 34, this.crowdRadius() + 18);
  }

  private squadTierName(): string {
    const n = this.squad.headcount();
    const i = n < 1 ? 0 : n < 12 ? 1 : n < 30 ? 2 : 3;
    return SQUAD_TIER[i];
  }

  private padText(id: string): string {
    const run = this.ctx.run!;
    const p = poiById(id);
    if (!p) return '';
    if (run.padLeft(id) <= 0) return `${p.name} — ${UI.recruitSpent}`;
    if (this.squad.count >= CONFIG.squad.max) return `${p.name} — ${UI.recruitFull}`;
    if (run.coins <= 0) return `${p.name} — ${UI.recruitBroke}`;
    return `${p.name} — ${UI.recruit}`;
  }

  private padFrac(): number {
    const run = this.ctx.run!;
    if (!this.padId) return 0;
    return run.padLeft(this.padId) / CONFIG.pad.capacity;
  }

  private hintText(keepD: number): string | null {
    const run = this.ctx.run!;
    if (this.padId) return null;
    if (run.breached) return null;
    if (keepD <= CONFIG.castle.range) return UI.attack;
    if (this.squad.headcount() === 0) return `${UI.recruit} — ${KEEP_NAME} is east`;
    return null;
  }

  /**
   * Add chunks that have come into view, drop the ones that have left.
   *
   * Chunks are baked in screen space, so the visibility test is a screen-space
   * rectangle overlap against each chunk's projected bounds — a world-space
   * box test would be wrong by exactly the projection's shear.
   */
  private mountChunks(): void {
    const pad = CONFIG.world.chunkPadding;
    const vx0 = this.camX - W / 2 - pad, vx1 = this.camX + W / 2 + pad;
    const vy0 = this.camY - H / 2 - pad, vy1 = this.camY + H / 2 + pad;
    const want = new Set<string>();

    const maxC = Math.ceil(CONFIG.world.size / BLOCK_SIZE);
    for (let cy = 0; cy < maxC; cy++) {
      for (let cx = 0; cx < maxC; cx++) {
        const b = chunkBounds(cx, cy);
        if (b.x > vx1 || b.x + b.w < vx0 || b.y > vy1 || b.y + b.h < vy0) continue;
        const key = `${cx},${cy}`;
        want.add(key);
        // Call getChunk for EVERY visible chunk, not only new ones. The call is
        // a map lookup on a hit, and it is what marks the chunk as recently
        // used — without it the LRU happily evicts and destroys a texture that
        // a mounted sprite is still drawing, and the renderer dies on a null
        // texture source the moment the player walks far enough.
        const tex = getChunk(cx, cy);
        const existing = this.mounted.get(key);
        if (existing) { existing.texture = tex; continue; }
        const o = chunkOrigin(cx, cy);
        const sp = new Sprite(tex);
        sp.position.set(o.x, o.y);
        sp.zIndex = cx + cy;
        this.chunkLayer.addChild(sp);
        this.mounted.set(key, sp);
      }
    }
    for (const [key, sp] of this.mounted) {
      if (want.has(key)) continue;
      // the texture stays in the terrain LRU; only the sprite goes
      this.chunkLayer.removeChild(sp);
      sp.destroy({ texture: false });
      this.mounted.delete(key);
    }
  }

  // ============================== MISC ==============================

  private openPause(auto = false): void {
    const ctx = this.ctx;
    if (ctx.loop.paused || this.dead) return;
    this.persist();
    showPause(ctx, {
      onRestart: () => ctx.router.goto('world'),
      onQuit: () => { this.persist(); ctx.router.goto('title'); },
    });
    if (auto) ctx.audio.muteAll(true);
  }

  /** Everything the headless harness needs to drive the real game. */
  private probe(): Record<string, unknown> {
    const run = this.ctx.run!;
    const save = this.ctx.save.data;
    return {
      x: Math.round(run.x), y: Math.round(run.y),
      squad: this.squad.headcount(),
      bodies: this.squad.count,
      ranks: this.squad.rankTally(),
      peak: this.squad.peak,
      donut: { x: Math.round(this.dx), y: Math.round(this.dy), vis: this.donut.visible },
      coins: run.coins,
      kills: save.kills,
      enemies: this.ents.enemies.count,
      coinsLive: this.ents.coins.count,
      cleared: [...run.cleared],
      pad: this.padId,
      padLeft: this.padId ? run.padLeft(this.padId) : 0,
      gateHp: Math.round(run.gateHp),
      breached: run.breached,
      boss: this.boss.alive
        ? { alive: true, hp: this.boss.hpFrac, phase: this.boss.phase, act: this.boss.act }
        : { alive: false, hp: 0, phase: 0, act: 'none' },
      dead: this.dead,
      chunks: this.mounted.size,
      achievements: [...save.achievements],
    };
  }
}

/** Blame text for the wipe screen. */
export const blameFor = (kind: EnemyKind): string => MOB_BLAME[kind];
