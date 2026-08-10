import { Container, Sprite } from 'pixi.js';
import { CONFIG, enemyDmgScale, enemyHpScale, type EnemyKind, type EraId, type StructureKind } from '../config';
import type { Ctx } from '../core/game';
import { SpatialGrid } from '../core/grid';
import { Pool } from '../core/pool';
import { ATK_FRAMES, ENEMY_FRAMES, WALK_FRAMES } from '../assets/atlas';
import { ATK_N, CHAR_SCALE, WALK_N, facingFor } from '../assets/chars';
import { Fort, type Pad } from './fort';
import { NumberPops, Particles } from './particles';

const CX = CONFIG.world.fortCenter;
const CY = CONFIG.world.fortCenter;

/** Everything a run's upgrades can modify. Cards and meta levels write here. */
export interface RunStats {
  dmg: number;
  fireRate: number;   // multiplier on rate (higher = faster)
  range: number;
  moveSpeed: number;
  magnet: number;
  carry: number;
  coin: number;
  extraSoldiers: number;
}

interface Soldier {
  sp: Sprite;
  /** ground shadow, so the unit sits on the map instead of floating over it */
  sh: Sprite;
  x: number; y: number; px: number; py: number;
  cool: number;
  slot: number;
  flash: number;
  alive: boolean;
  /** walk-cycle phase, advanced by distance travelled */
  gait: number;
  /** seconds left in the attack animation */
  atk: number;
  /** −1 or 1; sticky, so a unit at a standstill does not flicker */
  face: number;
  /** last meaningful heading, used to choose a facing */
  hx: number; hy: number;
}

interface Enemy {
  sp: Sprite;
  sh: Sprite;
  kind: EnemyKind;
  x: number; y: number; px: number; py: number;
  vx: number; vy: number;
  hp: number; maxHp: number;
  speed: number; radius: number; dmg: number; coin: number; mass: number;
  flash: number;
  cool: number;          // attack / shot cooldown
  era: EraId;
  flying: boolean;
  /** walk phase, advanced by distance covered */
  gait: number;
  face: number;
  hx: number; hy: number;
  /** what it is currently chewing on, if anything */
  target: 'keep' | 'wall' | 'pad' | 'none';
  targetPad: Pad | null;
}

interface Proj {
  sp: Sprite;
  x: number; y: number; px: number; py: number;
  vx: number; vy: number;
  dmg: number;
  life: number;
  pierce: number;
  hostile: boolean;
  splash: number;
}

interface Coin {
  sp: Sprite;
  x: number; y: number; px: number; py: number;
  vx: number; vy: number;
  value: number;
  life: number;
  settling: number;
  homing: boolean;
}

/**
 * The simulation: king, soldiers, enemies, projectiles, coins and the fort,
 * stepped at a fixed 60 Hz and interpolated at render time.
 *
 * Everything hot is pooled and queried through a spatial hash, so a wave of
 * 240 enemies with 500 projectiles in flight costs a bounded, allocation-free
 * amount of work per step.
 */
export class World {
  fort: Fort;
  era: EraId = 0;
  stats: RunStats;

  // king
  kx: number = CX;
  ky: number = CY + 210;
  kpx: number = this.kx;
  kpy: number = this.ky;
  kvx = 0;
  kvy = 0;
  kingHp: number;
  kingMaxHp: number;
  kingCool = 0;
  kingIFrames = 0;
  kingDown = 0;
  facing = 1;
  private kingGait = 0;
  private kingAtk = 0;

  /** coins in hand, and the run's banked total */
  carry = 0;
  banked = 0;
  kills = 0;
  /** pad the king is currently standing on, if any */
  onPad: Pad | null = null;
  private depositTick = 0;

  soldiers: Pool<Soldier>;
  enemies: Pool<Enemy>;
  projs: Pool<Proj>;
  coins: Pool<Coin>;
  particles: Particles;
  pops: NumberPops;

  /** targets granted by barracks + cards + meta, before the cap */
  soldierTarget = 1;

  /** hand-drawn character page, when the LPC art loaded */
  private get chars() { return this.ctx.chars; }

  private grid = new SpatialGrid(CONFIG.world.size);
  private scratch: number[] = new Array(256).fill(0);
  private padSprites = new Map<Pad, { base: Sprite; glow: Sprite; body: Sprite }>();
  private wallLayer = new Container();
  private keepSp!: Sprite;

  /** hooks the run scene listens to */
  onKeepHit: (() => void) | null = null;
  onDeath: ((why: string) => void) | null = null;
  onBuilt: ((pad: Pad) => void) | null = null;
  onKill: ((e: { x: number; y: number; kind: EnemyKind }) => void) | null = null;

  constructor(private ctx: Ctx, layer: Container, stats: RunStats) {
    this.stats = stats;
    this.fort = new Fort(1 + 0);
    this.kingMaxHp = CONFIG.king.hp;
    this.kingHp = this.kingMaxHp;

    const a = ctx.atlas;
    const ground = new Container();
    const mid = new Container();
    const air = new Container();
    // units live in `mid` and are painted back-to-front by their y, so a soldier
    // in front of another overlaps it rather than punching through
    mid.sortableChildren = true;
    layer.addChild(ground, this.wallLayer, mid, air);

    // keep at the centre
    this.keepSp = new Sprite(a.get('keep0'));
    this.keepSp.anchor.set(0.5, 0.82);
    this.keepSp.position.set(CX, CY);
    mid.addChild(this.keepSp);

    // build pads
    for (const pad of this.fort.pads) {
      const base = new Sprite(a.get('pad'));
      base.anchor.set(0.5);
      base.position.set(pad.x, pad.y);
      base.alpha = 0.5;
      const glow = new Sprite(a.get('padGlow'));
      glow.anchor.set(0.5);
      glow.position.set(pad.x, pad.y);
      glow.blendMode = 'add';
      glow.alpha = 0;
      const body = new Sprite(a.get('tower0'));
      body.anchor.set(0.5, 0.86);
      body.position.set(pad.x, pad.y);
      body.visible = false;
      ground.addChild(base, glow);
      mid.addChild(body);
      this.padSprites.set(pad, { base, glow, body });
    }

    this.particles = new Particles(a);
    this.pops = new NumberPops(a);

    /** a squashed dark ellipse pinned to the unit's feet */
    const shadow = (frame: string): Sprite => {
      const sh = new Sprite(a.get(frame));
      sh.anchor.set(0.5, 0.5);
      sh.alpha = 0.32;
      sh.visible = false;
      ground.addChild(sh);
      return sh;
    };

    this.soldiers = new Pool<Soldier>(CONFIG.squad.max, () => {
      const sp = new Sprite(a.get('sol0_0_0'));
      sp.anchor.set(0.5, 0.95);   // feet at the entity position, so the shadow lines up
      sp.visible = false;
      mid.addChild(sp);
      return {
        sp, sh: shadow('shadow14'), x: CX, y: CY, px: CX, py: CY, cool: 0, slot: 0,
        flash: 0, alive: true, gait: Math.random() * 4, atk: 0, face: 1, hx: 1, hy: 0,
      };
    });
    this.enemies = new Pool<Enemy>(CONFIG.enemies.max, () => {
      const sp = new Sprite(a.get('e_runner_0'));
      sp.anchor.set(0.5, 0.95);   // feet at the entity position, so the shadow lines up
      sp.visible = false;
      mid.addChild(sp);
      return {
        sp, sh: shadow('shadow14'), kind: 'runner', x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0,
        hp: 1, maxHp: 1, speed: 0, radius: 10, dmg: 0, coin: 0, mass: 1,
        flash: 0, cool: 0, era: 0, flying: false, gait: 0, face: 1, hx: 1, hy: 0, target: 'none', targetPad: null,
      };
    });
    this.projs = new Pool<Proj>(CONFIG.proj.max, () => {
      const sp = new Sprite(a.get('p0'));
      sp.anchor.set(0.5);
      sp.visible = false;
      air.addChild(sp);
      return { sp, x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, dmg: 0, life: 0, pierce: 0, hostile: false, splash: 0 };
    });
    this.coins = new Pool<Coin>(CONFIG.coins.max, () => {
      const sp = new Sprite(a.get('coin'));
      sp.anchor.set(0.5);
      sp.visible = false;
      ground.addChild(sp);
      return { sp, x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, value: 1, life: 0, settling: 0, homing: false };
    });

    layer.addChild(this.particles, this.pops);
    // king sprite lives above the crowd
    this.kingShadow = shadow('shadow18');
    this.kingShadow.visible = true;
    this.kingSp = new Sprite(a.get('king0_0'));
    this.kingSp.anchor.set(0.5, 0.95);
    air.addChild(this.kingSp);
    this.setEra(0);
  }
  kingSp!: Sprite;
  private kingShadow!: Sprite;

  // ---------------------------------------------------------------- era

  setEra(era: EraId): void {
    this.era = era;
    const a = this.ctx.atlas;
    this.keepSp.texture = a.get('keep' + era);
    this.kingSp.texture = a.get(`king${era}_0`);
    const pal = CONFIG.palettes[era];
    for (const [pad, spr] of this.padSprites) {
      spr.base.tint = pal.accent;
      spr.glow.tint = pal.accent;
      if (pad.kind) this.dressPad(pad);
    }
    for (let i = 0; i < this.soldiers.count; i++) this.dressSoldier(this.soldiers.items[i]);
  }

  private eraDef() { return CONFIG.eras[this.era]; }

  /** Attack frame from remaining time: wind-up first, strike as it lands. */
  private atkFrame(left: number): number {
    const total = CONFIG.squad.attackAnimSec;
    const t = 1 - Math.max(0, left) / total;
    return Math.min(ATK_FRAMES - 1, Math.floor(t * ATK_FRAMES));
  }

  private dressPad(pad: Pad): void {
    const spr = this.padSprites.get(pad)!;
    const a = this.ctx.atlas;
    if (!pad.kind) { spr.body.visible = false; return; }
    spr.body.visible = true;
    if (pad.rubble > 0) {
      spr.body.texture = a.get('rubble');
      spr.body.tint = CONFIG.palettes[pad.era].stoneDark;
      return;
    }
    spr.body.texture = pad.kind === 'tower' ? a.get('tower' + pad.era) : a.get(pad.kind);
    spr.body.tint = pad.kind === 'tower' ? 0xffffff : CONFIG.palettes[pad.era].stone;
  }

  /** Current squad tier — the whole army upgrades together as it grows. */
  private get tier(): number {
    return Math.min(2, Math.floor(this.soldiers.count / CONFIG.squad.tierEvery));
  }

  private dressSoldier(s: Soldier): void {
    s.sp.texture = this.ctx.atlas.get(`sol${this.era}_${this.tier}_${(s.gait | 0) % WALK_FRAMES}`);
  }

  // ---------------------------------------------------------------- spawning

  /** Grant/remove soldiers so the live count matches the target. */
  syncSquad(): void {
    const want = Math.min(
      CONFIG.squad.max,
      Math.max(1, Math.round(this.soldierTarget + this.fort.barracksSoldiers + this.stats.extraSoldiers)),
    );
    while (this.soldiers.count < want) {
      const s = this.soldiers.obtain();
      if (!s) break;
      s.x = s.px = this.kx + (Math.random() - 0.5) * 40;
      s.y = s.py = this.ky + (Math.random() - 0.5) * 40;
      s.cool = Math.random() * 0.6;
      s.flash = 0;
      s.alive = true;
      s.sp.visible = true;
      s.sh.visible = true;
    }
    while (this.soldiers.count > want) {
      const i = this.soldiers.count - 1;
      this.soldiers.items[i].sp.visible = false;
      this.soldiers.items[i].sh.visible = false;
      this.soldiers.release(i);
    }
    for (let i = 0; i < this.soldiers.count; i++) {
      this.soldiers.items[i].slot = i;
      this.dressSoldier(this.soldiers.items[i]);
    }
  }

  spawnEnemy(kind: EnemyKind, x: number, y: number, waveIndex: number): void {
    const e = this.enemies.obtain();
    if (!e) return;
    const base = CONFIG.enemies[kind];
    const eraDef = this.eraDef();
    const hpScale = enemyHpScale(waveIndex);
    e.kind = kind;
    e.era = this.era;
    e.maxHp = e.hp = Math.round(base.hp * hpScale);
    e.speed = base.speed * eraDef.enemySpeed;
    e.radius = base.radius;
    e.dmg = base.dmg * enemyDmgScale(waveIndex);
    e.coin = base.coin;
    e.mass = base.mass;
    e.flying = kind === 'flyer';
    e.gait = Math.random() * ENEMY_FRAMES;
    e.x = e.px = x;
    e.y = e.py = y;
    e.vx = e.vy = 0;
    e.flash = 0;
    e.cool = Math.random();
    e.target = 'none';
    e.targetPad = null;
    e.sp.texture = this.ctx.atlas.get(`e_${kind}_0`);
    e.sp.tint = CONFIG.palettes[this.era].enemy;
    e.sp.visible = true;
    e.sp.scale.set(1);
    e.face = 1;
    e.hx = CX - x;
    e.hy = CY - y;
    // shadow sized to the archetype's footprint; flyers cast one on the ground
    // far below them, which is how you read their altitude from directly above
    e.sh.texture = this.ctx.atlas.get(
      kind === 'boss' ? 'shadow26' : kind === 'brute' ? 'shadow18' : kind === 'flyer' ? 'shadow10' : 'shadow14',
    );
    e.sh.visible = true;
  }

  private fire(x: number, y: number, tx: number, ty: number, dmg: number, opts: {
    speed: number; pierce: number; hostile?: boolean; splash?: number; spread?: number; tint: number; frame: string;
  }): void {
    const p = this.projs.obtain();
    if (!p) return;
    let ang = Math.atan2(ty - y, tx - x);
    if (opts.spread) ang += (Math.random() - 0.5) * opts.spread;
    p.x = p.px = x;
    p.y = p.py = y;
    p.vx = Math.cos(ang) * opts.speed;
    p.vy = Math.sin(ang) * opts.speed;
    p.dmg = dmg;
    p.life = 0;
    p.pierce = opts.pierce;
    p.hostile = opts.hostile ?? false;
    p.splash = opts.splash ?? 0;
    p.sp.texture = this.ctx.atlas.get(opts.frame);
    p.sp.tint = opts.tint;
    p.sp.rotation = ang;
    p.sp.visible = true;
  }

  dropCoins(x: number, y: number, value: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const c = this.coins.obtain();
      if (!c) return;
      const ang = Math.random() * Math.PI * 2;
      const spd = CONFIG.coins.popSpeed + Math.random() * CONFIG.coins.popSpeedVar;
      c.x = c.px = x;
      c.y = c.py = y;
      c.vx = Math.cos(ang) * spd;
      c.vy = Math.sin(ang) * spd;
      c.value = value;
      c.life = 0;
      c.settling = CONFIG.coins.settleSec;
      c.homing = false;
      c.sp.visible = true;
      c.sp.alpha = 1;
    }
  }

  // ---------------------------------------------------------------- step

  step(dt: number): void {
    if (this.kingDown > 0) {
      this.kingDown -= dt;
      if (this.kingDown <= 0) {
        this.kingHp = this.kingMaxHp;
        this.kx = CX; this.ky = CY + 120;   // revive at the keep
        this.kpx = this.kx; this.kpy = this.ky;
      }
    } else {
      this.stepKing(dt);
    }
    this.rebuildGrid();
    this.stepSoldiers(dt);
    this.stepEnemies(dt);
    this.stepTowers(dt);
    this.stepProjectiles(dt);
    this.stepCoins(dt);
    this.fort.step(dt, this.era);
    if (this.kingIFrames > 0) this.kingIFrames -= dt;
  }

  private rebuildGrid(): void {
    this.grid.clear();
    for (let i = 0; i < this.enemies.count; i++) {
      const e = this.enemies.items[i];
      this.grid.insert(i, e.x, e.y);
    }
  }

  private stepKing(dt: number): void {
    this.kpx = this.kx;
    this.kpy = this.ky;
    const inp = this.ctx.input;
    const speed = CONFIG.king.speed * this.stats.moveSpeed;
    const tvx = inp.dx * speed;
    const tvy = inp.dy * speed;
    const acc = CONFIG.king.accel * dt;
    this.kvx += Math.max(-acc, Math.min(acc, tvx - this.kvx));
    this.kvy += Math.max(-acc, Math.min(acc, tvy - this.kvy));
    this.kx += this.kvx * dt;
    this.ky += this.kvy * dt;
    if (Math.abs(this.kvx) > 6) this.facing = this.kvx > 0 ? 1 : -1;

    const pad = CONFIG.world.edgePad * 0.4;
    this.kx = Math.max(pad, Math.min(CONFIG.world.size - pad, this.kx));
    this.ky = Math.max(pad, Math.min(CONFIG.world.size - pad, this.ky));

    // the king fights too, on a slow cadence
    this.kingCool -= dt;
    if (this.kingCool <= 0) {
      const target = this.nearestEnemy(this.kx, this.ky, this.eraDef().range * this.stats.range * 1.15);
      if (target) {
        const d = this.eraDef();
        this.kingCool = (CONFIG.king.fireInterval) / this.stats.fireRate;
        this.kingAtk = CONFIG.squad.attackAnimSec;
        this.fire(this.kx, this.ky - 16, target.x, target.y, d.dmg * this.stats.dmg * 1.6, {
          speed: d.projSpeed, pierce: d.pierce, spread: d.spread, tint: d.tracer, frame: 'p' + this.era,
        });
        this.ctx.audio.play(d.shootSfx, { throttleMs: CONFIG.audio.shootThrottleMs, vol: 0.55 });
        this.particles.burst(this.kx + this.facing * 12, this.ky - 16, {
          frame: 'dot', count: 1, tint: d.muzzle, speed: 30, ttl: 0.12, additive: true, s0: 0.8, s1: 0.1,
        });
      } else {
        this.kingCool = 0.12;
      }
    }

    this.stepDeposit(dt);
  }

  /** Standing on a pad with a pending build drains the carry stack into it. */
  private stepDeposit(dt: number): void {
    let found: Pad | null = null;
    for (const pad of this.fort.pads) {
      if (pad.ring >= this.fort.unlockedRings) continue;
      const dx = pad.x - this.kx;
      const dy = pad.y - this.ky;
      if (dx * dx + dy * dy <= CONFIG.fort.padRadius * CONFIG.fort.padRadius) { found = pad; break; }
    }
    this.onPad = found;
    if (!found || found.goal <= 0 || this.carry <= 0 || found.rubble > 0) return;

    const rate = CONFIG.fort.depositRate * dt;
    const move = Math.min(rate, this.carry, found.goal - found.progress);
    if (move <= 0) return;
    this.carry -= move;
    found.progress += move;

    this.depositTick += dt;
    if (this.depositTick >= CONFIG.fx.depositCoinEvery) {
      this.depositTick = 0;
      this.particles.burst(this.kx, this.ky - 26, {
        frame: 'coin', count: 1, speed: 40, vy0: -120, gravity: 420, ttl: 0.34, s0: 0.9, s1: 0.5,
      });
      // rising pitch as the bar fills — the sound of progress
      const t = found.progress / Math.max(1, found.goal);
      this.ctx.audio.play('sfxCoin', { rate: 0.9 + t * 0.85, vol: 0.4 });
    }

    if (found.progress >= found.goal) {
      this.fort.finish(found, this.era);
      this.dressPad(found);
      this.syncSquad();
      this.ctx.audio.play('sfxBuild');
      this.ctx.fx.shake(CONFIG.fx.shakeBuild);
      this.ctx.haptics.tap(CONFIG.fx.hapticBuild);
      this.particles.burst(found.x, found.y - 10, {
        frame: 'dot', count: CONFIG.fx.buildParticles, tint: CONFIG.palettes[this.era].accent,
        speed: 130, ttl: 0.6, additive: true, s0: 1.4, s1: 0.2,
      });
      this.onBuilt?.(found);
      for (const p of this.fort.pads) this.dressPad(p);
    }
  }

  /** Queue a build/upgrade on a pad. */
  requestBuild(pad: Pad, kind: StructureKind): void {
    if (pad.ring >= this.fort.unlockedRings || pad.rubble > 0) return;
    if (pad.kind === kind && pad.level >= CONFIG.fort.upgradeMaxLevel) return;
    // re-asking for the build already under way must not restart it, and
    // switching to a different structure hands back the coins ferried in so far
    // rather than silently eating them
    if (pad.pending === kind) return;
    if (pad.pending) this.carry += pad.progress;
    pad.pending = kind;
    pad.goal = this.fort.cost(pad, kind, this.era);
    pad.progress = 0;
  }

  cancelBuild(pad: Pad): void {
    // banked back to the king so a misclick never eats coins
    this.carry += pad.progress;
    pad.progress = 0;
    pad.goal = 0;
    pad.pending = null;
  }

  private nearestEnemy(x: number, y: number, range: number): Enemy | null {
    const n = this.grid.query(x, y, range, this.scratch);
    let best: Enemy | null = null;
    let bestD = range * range;
    for (let i = 0; i < n; i++) {
      const e = this.enemies.items[this.scratch[i]];
      if (!e || e.hp <= 0) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  private stepSoldiers(dt: number): void {
    const d = this.eraDef();
    const range = d.range * this.stats.range * CONFIG.squad.engageRange;
    const dmg = d.dmg * this.stats.dmg * (1 + this.fort.forgeBonus);
    const interval = d.interval / this.stats.fireRate;
    const n = this.soldiers.count;

    for (let i = 0; i < n; i++) {
      const s = this.soldiers.items[i];
      s.px = s.x;
      s.py = s.y;
      if (s.flash > 0) s.flash -= dt;

      // formation slot: concentric rings behind the king
      const ring = Math.floor((Math.sqrt(8 * i / CONFIG.squad.perRing + 1) - 1) / 2);
      const inRing = i - (ring * (ring + 1) / 2) * CONFIG.squad.perRing;
      const per = CONFIG.squad.perRing * (ring + 1);
      const ang = (inRing / per) * Math.PI * 2 + ring * 0.6;
      const rad = CONFIG.squad.ringSpacing * (ring + 1);
      const tx = this.kx + Math.cos(ang) * rad;
      const ty = this.ky + Math.sin(ang) * rad * 0.8;

      const k = Math.min(1, CONFIG.squad.followLerp * dt);
      s.x += (tx - s.x) * k;
      s.y += (ty - s.y) * k;

      if (s.atk > 0) s.atk -= dt;
      s.cool -= dt;
      if (s.cool <= 0) {
        const target = this.nearestEnemy(s.x, s.y, range);
        if (target) {
          s.cool = interval * (1 + (Math.random() - 0.5) * CONFIG.squad.fireJitter);
          s.atk = CONFIG.squad.attackAnimSec;
          this.fire(s.x, s.y - 12, target.x, target.y, dmg, {
            speed: d.projSpeed, pierce: d.pierce, spread: d.spread, tint: d.tracer, frame: 'p' + this.era,
          });
          this.ctx.audio.play(d.shootSfx, { throttleMs: CONFIG.audio.shootThrottleMs, vol: 0.3 });
        } else {
          s.cool = 0.15;
        }
      }
    }
  }

  private stepEnemies(dt: number): void {
    const attackR = CONFIG.enemies.attackRange;
    for (let i = this.enemies.count - 1; i >= 0; i--) {
      const e = this.enemies.items[i];
      e.px = e.x;
      e.py = e.y;
      if (e.flash > 0) e.flash -= dt;

      // pick a goal: the king if he is close and exposed, else the keep
      const dkx = this.kx - e.x;
      const dky = this.ky - e.y;
      const dKing = Math.hypot(dkx, dky);
      const goKing = this.kingDown <= 0 && dKing < 260;
      const gx = goKing ? this.kx : CX;
      const gy = goKing ? this.ky : CY;

      let dx = gx - e.x;
      let dy = gy - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      dx /= dist;
      dy /= dist;

      // shooters hold at standoff range and fire
      const base = CONFIG.enemies[e.kind] as { standoff?: number; shotInterval?: number; projSpeed?: number };
      if (e.kind === 'shooter' && base.standoff && dist < base.standoff) {
        dx = -dx * 0.35;
        dy = -dy * 0.35;
        e.cool -= dt;
        if (e.cool <= 0) {
          e.cool = base.shotInterval!;
          this.fire(e.x, e.y - 10, gx, gy, e.dmg, {
            speed: base.projSpeed!, pierce: 0, hostile: true,
            tint: CONFIG.palettes[e.era].enemy, frame: 'pEnemy',
          });
        }
      }

      // separation so the horde spreads instead of stacking into one pixel
      const cnt = this.grid.query(e.x, e.y, CONFIG.enemies.separation, this.scratch);
      let sx = 0;
      let sy = 0;
      for (let j = 0; j < cnt; j++) {
        const o = this.enemies.items[this.scratch[j]];
        if (!o || o === e) continue;
        const ox = e.x - o.x;
        const oy = e.y - o.y;
        const d2 = ox * ox + oy * oy;
        if (d2 > 0.01 && d2 < CONFIG.enemies.separation * CONFIG.enemies.separation) {
          const d = Math.sqrt(d2);
          sx += (ox / d) * (1 - d / CONFIG.enemies.separation);
          sy += (oy / d) * (1 - d / CONFIG.enemies.separation);
        }
      }

      const sep = CONFIG.enemies.separationForce / Math.max(1, e.mass);
      let nx = e.x + (dx * e.speed + sx * sep) * dt;
      let ny = e.y + (dy * e.speed + sy * sep) * dt;

      // walls: block inward crossings unless flying
      e.target = 'none';
      e.targetPad = null;
      if (!e.flying) {
        const rFrom = Math.hypot(e.x - CX, e.y - CY);
        const rTo = Math.hypot(nx - CX, ny - CY);
        const ang = Math.atan2(e.y - CY, e.x - CX);
        const wall = this.fort.blockingWall(ang, rFrom, rTo);
        if (wall) {
          const R = CONFIG.fort.ringRadius[wall.ring] + e.radius * 0.7;
          nx = CX + Math.cos(ang) * R;
          ny = CY + Math.sin(ang) * R;
          e.target = 'wall';
          e.cool -= dt;
          if (e.cool <= 0) {
            e.cool = CONFIG.enemies.attackInterval;
            if (this.fort.hurtWall(wall, e.dmg, this.era)) {
              this.ctx.audio.play('sfxCrumble', { throttleMs: 200, vol: 0.6 });
              this.particles.burst(nx, ny, {
                frame: 'chip', count: 14, tint: CONFIG.palettes[this.era].stone,
                speed: 140, ttl: 0.6, gravity: 300,
              });
            }
            this.ctx.fx.shake(CONFIG.fx.shakeHit * 0.4);
          }
        }
      }

      e.x = nx;
      e.y = ny;

      // structures in reach get chewed
      if (e.target === 'none') {
        for (const pad of this.fort.pads) {
          if (!pad.kind || pad.rubble > 0) continue;
          const px = pad.x - e.x;
          const py = pad.y - e.y;
          if (px * px + py * py < (attackR + e.radius) * (attackR + e.radius)) {
            e.target = 'pad';
            e.targetPad = pad;
            e.cool -= dt;
            if (e.cool <= 0) {
              e.cool = CONFIG.enemies.attackInterval;
              if (this.fort.hurtPad(pad, e.dmg, this.era)) {
                this.dressPad(pad);
                this.particles.burst(pad.x, pad.y, {
                  frame: 'chip', count: 18, tint: CONFIG.palettes[this.era].stone,
                  speed: 160, ttl: 0.7, gravity: 320,
                });
                this.ctx.audio.play('sfxCrumble', { vol: 0.7 });
                this.syncSquad();
              }
            }
            break;
          }
        }
      }

      // the keep itself
      const dcx = CX - e.x;
      const dcy = CY - e.y;
      if (dcx * dcx + dcy * dcy < (CONFIG.fort.keepRadius + e.radius) * (CONFIG.fort.keepRadius + e.radius)) {
        e.target = 'keep';
        e.cool -= dt;
        if (e.cool <= 0) {
          e.cool = CONFIG.enemies.attackInterval;
          this.fort.keepHp -= e.dmg;
          this.ctx.fx.shake(CONFIG.fx.shakeKeepHit);
          this.ctx.audio.play('sfxKeepHit', { throttleMs: 220 });
          this.onKeepHit?.();
          if (this.fort.keepHp <= 0) {
            this.fort.keepHp = 0;
            this.onDeath?.('The keep fell.');
          }
        }
      }

      // contact damage to the king
      if (this.kingDown <= 0 && this.kingIFrames <= 0) {
        const r = e.radius + CONFIG.king.radius;
        if (dkx * dkx + dky * dky < r * r) {
          this.kingHp -= e.dmg;
          this.kingIFrames = CONFIG.king.contactIFrames;
          this.ctx.fx.shake(CONFIG.fx.shakeHit);
          this.ctx.audio.play('sfxHurt');
          if (this.kingHp <= 0) this.downKing();
        }
      }
    }
  }

  private downKing(): void {
    this.kingDown = CONFIG.king.downSec;
    this.kingHp = 0;
    const lost = Math.floor(this.carry * CONFIG.coins.dropOnDownFrac);
    if (lost > 0) {
      this.carry -= lost;
      this.dropCoins(this.kx, this.ky, 1, Math.min(24, lost));
    }
    this.ctx.fx.shake(CONFIG.fx.shakeDown);
    this.ctx.fx.flash(0.4, 2.2);
    this.ctx.audio.play('sfxDown');
    this.ctx.haptics.tap(CONFIG.fx.hapticDown);
    this.particles.burst(this.kx, this.ky, {
      frame: 'dot', count: 20, tint: CONFIG.colors.bad, speed: 180, ttl: 0.6, additive: true, s0: 1.6, s1: 0.2,
    });
  }

  private stepTowers(dt: number): void {
    const d = this.eraDef();
    for (const pad of this.fort.pads) {
      if (pad.kind !== 'tower' || pad.rubble > 0) continue;
      const era = pad.era;
      const def = CONFIG.eras[era];
      pad.cool -= dt;
      if (pad.cool > 0) continue;
      const range = def.towerRange * this.stats.range;
      const target = this.nearestEnemy(pad.x, pad.y, range);
      if (!target) { pad.cool = 0.1; continue; }
      pad.cool = def.towerInterval / this.stats.fireRate;
      const dmg = def.towerDmg * this.stats.dmg
        * (1 + pad.level * CONFIG.fort.upgradeDamageMult)
        * (1 + this.fort.forgeBonus);
      const splash = (def as { towerSplash?: number }).towerSplash ?? 0;
      this.fire(pad.x, pad.y - 34, target.x, target.y, dmg, {
        speed: def.towerProjSpeed, pierce: def.towerPierce, splash,
        tint: def.tracer, frame: 'p' + era,
      });
      pad.flash = 0.08;
      this.ctx.audio.play(def.shootSfx, { throttleMs: CONFIG.audio.shootThrottleMs, vol: 0.34, rate: 0.85 });
      this.particles.burst(pad.x, pad.y - 36, {
        frame: 'dot', count: 1, tint: def.muzzle, speed: 20, ttl: 0.1, additive: true, s0: 1, s1: 0.2,
      });
      void d;
    }
  }

  private stepProjectiles(dt: number): void {
    for (let i = this.projs.count - 1; i >= 0; i--) {
      const p = this.projs.items[i];
      p.px = p.x;
      p.py = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life += dt;

      if (p.life > CONFIG.proj.lifeSec) {
        p.sp.visible = false;
        this.projs.release(i);
        continue;
      }

      if (p.hostile) {
        // only the king can be hit by enemy fire — soldiers would be unfair
        if (this.kingDown <= 0 && this.kingIFrames <= 0) {
          const dx = this.kx - p.x;
          const dy = this.ky - p.y;
          const r = CONFIG.king.radius + CONFIG.proj.radius;
          if (dx * dx + dy * dy < r * r) {
            this.kingHp -= p.dmg;
            this.kingIFrames = CONFIG.king.contactIFrames * 0.6;
            this.ctx.fx.shake(CONFIG.fx.shakeHit);
            this.ctx.audio.play('sfxHurt');
            if (this.kingHp <= 0) this.downKing();
            p.sp.visible = false;
            this.projs.release(i);
          }
        }
        continue;
      }

      const cnt = this.grid.query(p.x, p.y, 34, this.scratch);
      let consumed = false;
      for (let j = 0; j < cnt; j++) {
        const e = this.enemies.items[this.scratch[j]];
        if (!e || e.hp <= 0) continue;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const r = e.radius + CONFIG.proj.radius;
        if (dx * dx + dy * dy > r * r) continue;

        this.hurt(e, p.dmg, p.x, p.y);
        if (p.splash > 0) {
          const sc = this.grid.query(p.x, p.y, p.splash, this.scratch);
          for (let k = 0; k < sc; k++) {
            const o = this.enemies.items[this.scratch[k]];
            if (!o || o === e || o.hp <= 0) continue;
            const ox = o.x - p.x;
            const oy = o.y - p.y;
            if (ox * ox + oy * oy <= p.splash * p.splash) this.hurt(o, p.dmg * 0.6, o.x, o.y);
          }
          this.particles.burst(p.x, p.y, {
            frame: 'dot', count: 10, tint: CONFIG.eras[this.era].muzzle,
            speed: 200, ttl: 0.34, additive: true, s0: 2, s1: 0.3,
          });
          this.ctx.fx.shake(CONFIG.fx.shakeHit * 0.6);
        }
        if (p.pierce > 0) { p.pierce--; } else { consumed = true; }
        break;
      }
      if (consumed) {
        p.sp.visible = false;
        this.projs.release(i);
      }
    }
  }

  private hurt(e: Enemy, dmg: number, hx: number, hy: number): void {
    e.hp -= dmg;
    e.flash = CONFIG.enemies.hitFlashMs / 1000;
    this.ctx.audio.play('sfxHit', { throttleMs: CONFIG.audio.hitThrottleMs, vol: 0.3 });
    this.particles.burst(hx, hy, {
      frame: 'chip', count: CONFIG.fx.hitParticles, tint: CONFIG.palettes[e.era].enemyDark,
      speed: 110, ttl: 0.3, gravity: 260,
    });
    if (e.kind === 'brute' || e.kind === 'boss') {
      this.pops.spawn(e.x, e.y - e.radius, String(Math.max(1, Math.round(dmg))), CONFIG.colors.ink);
    }
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: Enemy): void {
    const idx = this.enemies.items.indexOf(e);
    if (idx < 0 || idx >= this.enemies.count) return;
    this.kills++;
    const value = Math.max(1, Math.round(e.coin * this.eraDef().coinMult * this.stats.coin));
    const drops = e.kind === 'boss' ? 14 : e.kind === 'brute' ? 4 : 1;
    this.dropCoins(e.x, e.y, Math.max(1, Math.round(value / drops)), drops);
    this.particles.burst(e.x, e.y, {
      frame: 'chip', count: CONFIG.fx.dieParticles, tint: CONFIG.palettes[e.era].enemyDark,
      speed: 170, speedVar: 80, ttl: 0.5, gravity: 340, spin: 8,
    });
    this.ctx.audio.play('sfxKill', { throttleMs: 55, vol: 0.4 });
    this.onKill?.({ x: e.x, y: e.y, kind: e.kind });
    e.sp.visible = false;
    e.sh.visible = false;
    this.enemies.release(idx);
  }

  private stepCoins(dt: number): void {
    const magnet = CONFIG.coins.magnet * this.stats.magnet;
    const cap = CONFIG.coins.carryCap * this.stats.carry;
    const m2 = magnet * magnet;
    for (let i = this.coins.count - 1; i >= 0; i--) {
      const c = this.coins.items[i];
      c.px = c.x;
      c.py = c.y;
      c.life += dt;

      if (c.settling > 0) {
        c.settling -= dt;
        const drag = Math.max(0, 1 - CONFIG.coins.drag * dt);
        c.vx *= drag;
        c.vy *= drag;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
      }

      const dx = this.kx - c.x;
      const dy = this.ky - c.y;
      const d2 = dx * dx + dy * dy;

      if (!c.homing && this.carry < cap && this.kingDown <= 0 && d2 < m2) c.homing = true;

      if (c.homing) {
        const d = Math.sqrt(d2) || 1;
        const sp = CONFIG.coins.magnetSpeed;
        c.vx += ((dx / d) * sp - c.vx) * Math.min(1, CONFIG.coins.magnetAccel * dt / sp);
        c.vy += ((dy / d) * sp - c.vy) * Math.min(1, CONFIG.coins.magnetAccel * dt / sp);
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        if (d < 20) {
          this.carry = Math.min(cap, this.carry + c.value);
          this.ctx.audio.play('sfxCoin', {
            throttleMs: CONFIG.audio.coinThrottleMs,
            rate: 1 + Math.min(0.6, this.carry / Math.max(1, cap)) * 0.5,
            vol: 0.3,
          });
          c.sp.visible = false;
          this.coins.release(i);
          continue;
        }
      }

      if (c.life > CONFIG.coins.lifeSec) {
        c.sp.visible = false;
        this.coins.release(i);
      }
    }
  }

  // ---------------------------------------------------------------- render

  /**
   * Point a sprite at the right hand-drawn character frame.
   *
   * Picks the facing from the unit's heading, the animation from whether it is
   * mid-attack, and the frame from the walk phase. `left` is not baked, so a
   * unit heading left draws the `right` frames mirrored.
   *
   * `era` selects the attack cycle: the iron and neon ages swing a blade, the
   * powder, industry and steel ages level a gun. Pass −1 for monsters, which
   * always swing.
   */
  private dressChar(
    sp: Sprite, prefix: string, era: number, gait: number, atk: number, hx: number, hy: number,
  ): void {
    const chars = this.chars!;
    const { dir, flip } = facingFor(hx, hy);
    const attacking = atk > 0;
    const anim = !attacking ? 'walk' : era === -1 || era === 0 || era === 4 ? 'thrust' : 'shoot';
    const n = attacking ? ATK_N : WALK_N;
    // an attack plays forward once over its window; walking loops with the gait
    const i = attacking
      ? Math.min(n - 1, Math.floor((1 - atk / CONFIG.squad.attackAnimSec) * n))
      : (gait | 0) % n;
    const t = chars.get(`${prefix}_${anim}_${dir}_${Math.max(0, i)}`)
      ?? chars.get(`${prefix}_walk_${dir}_0`);
    if (t) sp.texture = t;
    const k = CHAR_SCALE / 64;
    sp.scale.set(flip ? -k : k, k);
  }

  frame(dtReal: number, alpha: number): void {
    const lerp = (p: number, n: number): number => p + (n - p) * alpha;
    const a = this.ctx.atlas;

    // gait advances with distance covered, so walking looks like walking and
    // standing still settles on the neutral pose
    const kingSpeed = Math.hypot(this.kvx, this.kvy);
    this.kingGait = kingSpeed > 12 ? this.kingGait + dtReal * (kingSpeed / 26) : 0;
    if (this.kingAtk > 0) this.kingAtk -= dtReal;
    const kingAtkName = `king${this.era}_atk${this.atkFrame(this.kingAtk)}`;
    this.kingSp.texture = this.kingAtk > 0 && a.has(kingAtkName)
      ? a.get(kingAtkName)
      : a.get(`king${this.era}_${(this.kingGait | 0) % WALK_FRAMES}`);
    this.kingSp.visible = this.kingDown <= 0;
    const kingX = lerp(this.kpx, this.kx);
    const kingY = lerp(this.kpy, this.ky);
    this.kingSp.position.set(kingX, kingY);
    if (this.chars) {
      this.dressChar(this.kingSp, `king${this.era}`, this.era, this.kingGait, this.kingAtk, this.kvx, this.kvy);
    } else {
      this.kingSp.scale.x = this.facing;
    }
    this.kingSp.alpha = this.kingIFrames > 0 ? 0.55 + Math.sin(performance.now() / 40) * 0.25 : 1;
    this.kingShadow.visible = this.kingDown <= 0;
    this.kingShadow.position.set(kingX, kingY);

    const tier = this.tier;
    for (let i = 0; i < this.soldiers.count; i++) {
      const s = this.soldiers.items[i];
      const nx = lerp(s.px, s.x);
      const ny = lerp(s.py, s.y);
      const dx = s.x - s.px;
      const dy = s.y - s.py;
      const moved = Math.hypot(dx, dy) / Math.max(0.0001, dtReal);
      s.gait = moved > 12 ? s.gait + dtReal * (moved / 26) : 0;
      // hold the last meaningful heading, so a unit shuffling in formation does
      // not spin on the spot
      if (Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3) { s.hx = dx; s.hy = dy; }
      if (this.chars) {
        this.dressChar(s.sp, `sol${this.era}_${tier}`, this.era, s.gait, s.atk, s.hx, s.hy);
      } else {
        if (Math.abs(dx) > 0.35) s.face = dx > 0 ? 1 : -1;
        const atkName = `sol${this.era}_${tier}_atk${this.atkFrame(s.atk)}`;
        s.sp.texture = s.atk > 0 && a.has(atkName)
          ? a.get(atkName)
          : a.get(`sol${this.era}_${tier}_${(s.gait | 0) % WALK_FRAMES}`);
        s.sp.scale.x = s.face;
      }
      s.sp.position.set(nx, ny);
      s.sp.zIndex = s.y;
      s.sh.position.set(nx, ny);
    }
    for (let i = 0; i < this.enemies.count; i++) {
      const e = this.enemies.items[i];
      const ex = lerp(e.px, e.x);
      const ey = lerp(e.py, e.y);
      e.sp.position.set(ex, ey);
      const dx = e.x - e.px;
      const dy = e.y - e.py;
      const moved = Math.hypot(dx, dy) / Math.max(0.0001, dtReal);
      // flyers beat their wings whether or not they are moving
      e.gait += dtReal * (e.flying ? 7 : moved / 22);
      if (Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3) { e.hx = dx; e.hy = dy; }
      // the flyer has no hand-drawn counterpart in the library, so it keeps its
      // procedural sprite whether or not the character page loaded
      const drawn = this.chars?.has(`e_${e.kind}_walk_down_0`) ?? false;
      if (drawn) {
        this.dressChar(e.sp, `e_${e.kind}`, -1, e.gait, e.cool > 0 && e.target !== 'none' ? 0.1 : 0, e.hx, e.hy);
        // tint cannot brighten, so a hit reads as a red wash rather than a
        // white silhouette frame
        e.sp.tint = e.flash > 0 ? 0xff7a6a : CONFIG.palettes[e.era].enemy;
      } else {
        if (Math.abs(dx) > 0.35) e.face = dx > 0 ? 1 : -1;
        if (e.flash > 0) {
          e.sp.texture = a.get(`e_${e.kind}W`);
          e.sp.tint = 0xffffff;
        } else {
          e.sp.texture = a.get(`e_${e.kind}_${(e.gait | 0) % ENEMY_FRAMES}`);
          e.sp.tint = CONFIG.palettes[e.era].enemy;
        }
        e.sp.scale.x = e.face;
      }
      e.sp.zIndex = e.y;
      // the shadow stays on the ground; only the body lifts
      e.sh.position.set(ex, ey);
      if (e.flying) {
        e.sp.y -= 16 + Math.sin(performance.now() / 180 + e.x) * 4;
        e.sh.alpha = 0.2;
      }
    }
    for (let i = 0; i < this.projs.count; i++) {
      const p = this.projs.items[i];
      p.sp.position.set(lerp(p.px, p.x), lerp(p.py, p.y));
    }
    for (let i = 0; i < this.coins.count; i++) {
      const c = this.coins.items[i];
      c.sp.position.set(lerp(c.px, c.x), lerp(c.py, c.y));
      c.sp.alpha = c.life > CONFIG.coins.lifeSec - 3 ? Math.max(0, (CONFIG.coins.lifeSec - c.life) / 3) : 1;
    }

    // pads: glow when affordable / pending
    for (const [pad, spr] of this.padSprites) {
      const locked = pad.ring >= this.fort.unlockedRings;
      spr.base.visible = !locked && (!pad.kind || pad.level < CONFIG.fort.upgradeMaxLevel);
      const near = this.onPad === pad;
      const want = pad.goal > 0 ? 0.85 : near ? 0.6 : locked ? 0 : 0.22;
      spr.glow.alpha += (want - spr.glow.alpha) * Math.min(1, 8 * dtReal);
      if (pad.kind) {
        spr.body.zIndex = pad.y;
        spr.body.tint = pad.flash > 0 ? 0xffffff
          : pad.kind === 'tower' ? 0xffffff : CONFIG.palettes[pad.era].stone;
        spr.body.scale.set(1 + (pad.flash > 0 ? 0.05 : 0));
      }
    }

    this.particles.budgetScale = this.ctx.loop.thermalSoften() ? CONFIG.thermal.particleBudgetScale : 1;
    this.particles.reducedMotion = this.ctx.fx.reducedMotion();
    this.particles.update(dtReal * this.ctx.fx.timescale);
    this.pops.update(dtReal);
    this.drawWalls();
  }

  /** Walls are drawn as tiled sprites along each built arc. */
  private wallSprites: Sprite[] = [];
  private drawWalls(): void {
    let used = 0;
    const a = this.ctx.atlas;
    for (const w of this.fort.walls) {
      if (w.hp <= 0) continue;
      const R = CONFIG.fort.ringRadius[w.ring];
      const arc = w.a1 - w.a0;
      const steps = Math.max(2, Math.ceil((arc * R) / 26));
      for (let i = 0; i <= steps; i++) {
        const ang = w.a0 + (arc * i) / steps;
        let sp = this.wallSprites[used];
        if (!sp) {
          sp = new Sprite(a.get('wall0'));
          sp.anchor.set(0.5, 0.75);
          this.wallLayer.addChild(sp);
          this.wallSprites.push(sp);
        }
        sp.texture = a.get('wall' + this.era);
        sp.visible = true;
        sp.position.set(CX + Math.cos(ang) * R, CY + Math.sin(ang) * R);
        sp.rotation = ang + Math.PI / 2;
        sp.zIndex = sp.y;
        const hurt = w.hp / w.maxHp;
        sp.tint = w.flash > 0 ? 0xffffff : hurt < 0.4 ? 0xb08a80 : 0xffffff;
        sp.alpha = 0.55 + hurt * 0.45;
        used++;
      }
    }
    for (let i = used; i < this.wallSprites.length; i++) this.wallSprites[i].visible = false;
  }

  stats0(): Record<string, number> {
    return {
      enemies: this.enemies.count,
      soldiers: this.soldiers.count,
      projs: this.projs.count,
      coins: this.coins.count,
      particles: this.particles.liveCount,
      carry: Math.floor(this.carry),
      keep: Math.round(this.fort.keepHp),
      built: this.fort.builtCount,
      era: this.era,
    };
  }
}
