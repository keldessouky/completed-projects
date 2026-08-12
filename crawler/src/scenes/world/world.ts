import { Container, Sprite } from 'pixi.js';
import { CONFIG, type EnemyKind } from '../../config';
import type { Stepper } from '../../core/loop';
import { CHUNK_SIZE, getChunk } from '../../assets/terrain';
import {
  BIOME_NAME, MOB_BLAME, MOB_NAME, POI_KIND_LABEL, SYS, UI,
} from '../../flavour';
import { announce, checkAchievements } from '../../game/achievements';
import { rollDrop } from '../../game/loot';
import * as stats from '../../game/stats';
import { Combat } from '../../world/combat';
import { Entities, campPositions } from '../../world/entities';
import { biomeAt, getWorld, npcPos, poiById } from '../../world/worldgen';
import { questById } from '../../world/quests';
import { Joystick } from '../../ui/joystick';
import { Minimap } from '../../ui/minimap';
import { showDialogue } from '../../ui/dialogue';
import { showPause } from '../../ui/overlays';
import { Scene } from '../scene';
import { WorldHud } from './hud';
import { NumberPops, Particles } from './particles';

const W = CONFIG.design.width;
const H = CONFIG.design.height;
const P = CONFIG.player;

type Interact =
  | { kind: 'npc'; id: string; label: string; x: number; y: number }
  | { kind: 'shrine'; id: string; label: string; x: number; y: number }
  | null;

/**
 * The open floor.
 *
 * One continuous plane, a camera window onto it, and everything else — terrain
 * chunks, enemy populations, loot — streamed in and out around the player. The
 * simulation runs at a fixed 120 Hz and the render interpolates, so movement is
 * identical on a 60 Hz phone and a ProMotion panel.
 */
export class WorldScene extends Scene implements Stepper {
  // ── layers ──
  private camera = new Container();
  private chunkLayer = new Container();
  private dropLayer = new Container();
  private actorLayer = new Container();
  private shotLayer = new Container();
  private hud!: WorldHud;
  private joystick!: Joystick;
  private minimap!: Minimap;
  private particles!: Particles;
  private pops!: NumberPops;

  // ── world plumbing ──
  private ents!: Entities;
  private combat!: Combat;
  private mounted = new Map<string, Sprite>();
  private npcSprites = new Map<string, Sprite>();
  /** POIs whose population is currently instantiated */
  private populated = new Set<string>();

  // ── player ──
  private hero!: Sprite;
  private donut!: Sprite;
  private px = 0; private py = 0;   // previous position, for interpolation
  private vx = 0; private vy = 0;
  private attackCd = 0;
  private iFrames = 0;
  private hasteT = 0;
  private dead = false;
  private deathT = 0;
  private cdBlast = 0;
  private cdSurge = 0;
  private lowWarned = false;

  // ── companion ──
  private dx = 0; private dy = 0;
  private dpx = 0; private dpy = 0;
  private donutCd = 0;

  // ── camera ──
  private camX = 0;
  private camY = 0;

  private interact: Interact = null;
  private autosaveT = 0;

  enter(): void {
    const ctx = this.ctx;
    const ws = ctx.world;
    if (!ws) { ctx.router.goto('title'); return; }

    const gear = ws.equipped;
    if (ws.hp <= 0) ws.hp = stats.maxHp(ctx.save.data, gear);

    this.camX = ws.x;
    this.camY = ws.y;
    this.px = ws.x; this.py = ws.y;
    this.dx = this.dpx = ws.x - 30;
    this.dy = this.dpy = ws.y + 20;

    // ── scene graph ──
    this.actorLayer.sortableChildren = true;
    this.camera.addChild(this.chunkLayer, this.dropLayer, this.actorLayer, this.shotLayer);
    this.container.addChild(this.camera);

    this.particles = new Particles(ctx.atlas);
    this.pops = new NumberPops(ctx.atlas);
    this.camera.addChild(this.particles, this.pops);
    this.particles.reducedMotion = ctx.fx.reducedMotion();

    this.ents = new Entities(ctx.atlas, this.actorLayer, this.shotLayer, this.dropLayer);

    // ── the cast ──
    this.hero = new Sprite(ctx.atlas.get('carl_s'));
    this.hero.anchor.set(0.5, 0.86);
    this.actorLayer.addChild(this.hero);
    this.donut = new Sprite(ctx.atlas.get('donut_s'));
    this.donut.anchor.set(0.5, 0.86);
    this.actorLayer.addChild(this.donut);

    // ── townsfolk ──
    for (const n of getWorld().npcs) {
      const sp = new Sprite(ctx.atlas.get(
        n.role === 'vendor' ? 'npc_vendor' : n.role === 'quests' ? 'npc_quests' : 'npc_guide',
      ));
      sp.anchor.set(0.5, 0.86);
      const p = npcPos(n);
      sp.position.set(p.x, p.y);
      sp.zIndex = p.y;
      this.actorLayer.addChild(sp);
      this.npcSprites.set(n.id, sp);
    }

    // ── HUD ──
    this.hud = new WorldHud(ctx, {
      onPause: () => this.openPause(),
      onBlast: () => this.fireBlast(),
      onSurge: () => this.fireSurge(),
      onInteract: () => this.doInteract(),
      onBag: () => ctx.router.goto('inventory'),
      onChar: () => ctx.router.goto('charsheet'),
      onJournal: () => ctx.router.goto('journal'),
    });
    this.joystick = new Joystick(ctx.input);
    this.minimap = new Minimap(ctx.atlas, ws);
    this.minimap.position.set(W - CONFIG.minimap.size / 2 - 14, Math.max(ctx.scaler.safeTop(), 12) + CONFIG.minimap.size / 2 + 62);
    this.container.addChild(this.hud, this.minimap, this.joystick);

    // ── combat ──
    this.combat = new Combat({
      entities: this.ents,
      atlas: ctx.atlas,
      fx: {
        hit: (x, y, dmg, crit, kind) => this.onHit(x, y, dmg, crit, kind),
        die: (x, y, kind) => this.onDie(x, y, kind),
        playerHurt: () => { /* routed through onPlayerHit */ },
        shot: (friendly) => ctx.audio.play(friendly ? 'shoot' : 'doorBad', {
          throttleMs: CONFIG.audio.shootThrottleMs, vol: friendly ? 0.4 : 0.45,
        }),
      },
      px: ws.x,
      py: ws.y,
      playerRadius: P.radius,
      playerInvulnerable: false,
      onPlayerHit: (dmg) => this.hurtPlayer(dmg),
      onEnemyDeath: (kind, x, y, poi) => this.rewardKill(kind, x, y, poi),
    });

    ctx.system.setTop(CONFIG.system.worldTopY);
    ctx.audio.music('musicRun');
    ctx.loop.stepper = this;
    ctx.onAutoPause = () => this.openPause(true);
    ctx.runStats = () => ({
      x: Math.round(ws.x), y: Math.round(ws.y),
      hp: Math.round(ws.hp),
      enemies: this.ents.enemies.count,
      shots: this.ents.shots.count,
      drops: this.ents.drops.count,
      chunks: this.mounted.size,
      discovered: ws.discovered.size,
    });
    ctx.worldProbe = () => this.probe();
    ctx.worldInteract = () => this.doInteract();

    if (!ctx.save.data.tutorialDone) {
      ctx.system.push(SYS.welcome(), 'info');
      ctx.save.data.tutorialDone = true;
      ctx.save.mark();
    }
    ws.revealAround(ws.x, ws.y);
    this.minimap.markFogDirty();
  }

  override exit(): void {
    const ctx = this.ctx;
    // the feed sits low to dodge the roaming HUD; menus want it back at the top
    ctx.system.setTop(Math.max(ctx.scaler.safeTop(), 12) + 8);
    ctx.loop.stepper = null;
    ctx.runStats = null;
    ctx.onAutoPause = null;
    ctx.worldProbe = null;
    ctx.worldInteract = null;
    this.persist();
  }

  private persist(): void {
    const ctx = this.ctx;
    if (!ctx.world) return;
    ctx.save.data.world = ctx.world.toSave();
    ctx.save.data.hp = Math.round(ctx.world.hp);
    ctx.save.mark();
  }

  // ============================== SIM ==============================

  step(dt: number): void {
    const ctx = this.ctx;
    const ws = ctx.world!;
    const save = ctx.save.data;
    const gear = ws.equipped;

    ws.clock += dt;
    save.playSec += dt;
    this.px = ws.x; this.py = ws.y;
    this.dpx = this.dx; this.dpy = this.dy;

    this.attackCd -= dt;
    this.donutCd -= dt;
    this.cdBlast = Math.max(0, this.cdBlast - dt);
    this.cdSurge = Math.max(0, this.cdSurge - dt);
    this.iFrames = Math.max(0, this.iFrames - dt);
    this.hasteT = Math.max(0, this.hasteT - dt);

    if (this.dead) {
      this.deathT -= dt;
      if (this.deathT <= 0) this.finishDeath();
      return;
    }
    // Death is a state of the world, not a return value of one code path.
    // Anything that can zero health — a hit, a future hazard, a debug seam —
    // must end the same way, so the check lives here rather than in hurtPlayer.
    if (ws.hp <= 0) { this.beginDeath(); return; }

    // ── movement ──
    const v = ctx.input.vector();
    const speed = stats.moveSpeed(save, gear) * (this.hasteT > 0 ? CONFIG.abilities.surge.hasteMult : 1);
    this.vx = v.x * speed;
    this.vy = v.y * speed;
    ws.x += this.vx * dt;
    ws.y += this.vy * dt;
    const pad = CONFIG.world.edgePad;
    ws.x = Math.max(pad, Math.min(CONFIG.world.size - pad, ws.x));
    ws.y = Math.max(pad, Math.min(CONFIG.world.size - pad, ws.y));
    if (Math.abs(v.x) > 0.05) ws.face = v.x < 0 ? -1 : 1;

    // ── companion follows, then holds station ──
    const cdx = ws.x - this.dx, cdy = ws.y - this.dy;
    const cdist = Math.hypot(cdx, cdy);
    if (cdist > CONFIG.companion.followDist) {
      const move = Math.min(CONFIG.companion.speed * dt, cdist - CONFIG.companion.followDist);
      this.dx += (cdx / cdist) * move;
      this.dy += (cdy / cdist) * move;
    }

    // ── the world around the player ──
    this.combat.px = ws.x;
    this.combat.py = ws.y;
    this.combat.playerInvulnerable = this.iFrames > 0 || this.dead;
    this.streamPois();
    this.combat.step(dt);
    this.autoAttack(dt);
    this.checkPickups();
    this.checkDiscovery();
    this.checkCampsCleared();

    ws.revealAround(ws.x, ws.y);

    // ── autosave ──
    this.autosaveT += dt;
    if (this.autosaveT >= CONFIG.save.autosaveSec) {
      this.autosaveT = 0;
      this.persist();
    }
  }

  /** Automatic attacks for Carl and Donut, at the nearest thing in range. */
  private autoAttack(dt: number): void {
    void dt;
    const ctx = this.ctx;
    const ws = ctx.world!;
    const save = ctx.save.data;
    const gear = ws.equipped;

    if (this.attackCd <= 0) {
      const i = this.ents.nearest(ws.x, ws.y, CONFIG.combat.attackRange);
      if (i >= 0) {
        const e = this.ents.enemies.items[i];
        const a = Math.atan2(e.y - ws.y, e.x - ws.x);
        const crit = Math.random() < stats.critChance(save, gear);
        const dmg = stats.damage(save, gear) * (crit ? CONFIG.combat.critMult : 1);
        this.ents.spawnShot(
          ctx.atlas, ws.x, ws.y - 18,
          Math.cos(a) * CONFIG.combat.projSpeed, Math.sin(a) * CONFIG.combat.projSpeed,
          dmg, true, crit,
        );
        ctx.audio.play('shoot', { throttleMs: CONFIG.audio.shootThrottleMs, vol: 0.4 });
        this.attackCd = stats.attackInterval(save, gear);
        ws.face = e.x < ws.x ? -1 : 1;
      }
    }

    if (this.donutCd <= 0) {
      const i = this.ents.nearest(this.dx, this.dy, CONFIG.companion.attackRange);
      if (i >= 0) {
        const e = this.ents.enemies.items[i];
        const a = Math.atan2(e.y - this.dy, e.x - this.dx);
        this.ents.spawnShot(
          ctx.atlas, this.dx, this.dy - 10,
          Math.cos(a) * CONFIG.combat.projSpeed, Math.sin(a) * CONFIG.combat.projSpeed,
          stats.damage(save, gear) * CONFIG.companion.damageFrac, true, false,
        );
        this.donutCd = CONFIG.companion.attackInterval;
      }
    }
  }

  /**
   * Instantiate the populations of nearby POIs and refund distant ones.
   * This is what keeps a 5120² world the same cost as one busy screen.
   */
  private streamPois(): void {
    const ctx = this.ctx;
    const ws = ctx.world!;
    const near = CONFIG.enemies.despawnDist;

    for (const p of getWorld().pois) {
      if (!p.spawns) continue;
      const d = Math.hypot(p.x - ws.x, p.y - ws.y);
      const live = this.populated.has(p.id);

      if (!live && d < near * 0.8 && !ws.isCleared(p.id)) {
        for (const s of campPositions(p)) {
          this.ents.spawnEnemy(ctx.atlas, s.kind, s.x, s.y, p.id, enemyScale(ctx.save.data.level, s.kind));
        }
        this.populated.add(p.id);
        if (p.id === getWorld().lair) ctx.system.push(SYS.bossSpotted(), 'bad');
      } else if (live && d > near) {
        for (let i = this.ents.enemies.count - 1; i >= 0; i--) {
          if (this.ents.enemies.items[i].poi === p.id) this.ents.killEnemy(i);
        }
        this.populated.delete(p.id);
      }
    }
  }

  /** A POI with a population that is now empty counts as cleared. */
  private checkCampsCleared(): void {
    const ctx = this.ctx;
    const ws = ctx.world!;
    for (const id of [...this.populated]) {
      let alive = 0;
      for (let i = 0; i < this.ents.enemies.count; i++) {
        if (this.ents.enemies.items[i].poi === id) alive++;
      }
      if (alive > 0) continue;
      this.populated.delete(id);
      if (ws.isCleared(id)) continue;
      ws.markCleared(id);
      const p = poiById(id);
      if (p) ctx.system.push(SYS.cleared(p.name), 'good');
      this.drainQuestReady();
      this.awardAchievements();
      this.persist();
    }
  }

  private checkDiscovery(): void {
    const ctx = this.ctx;
    const ws = ctx.world!;
    for (const p of getWorld().pois) {
      if (ws.discovered.has(p.id)) continue;
      if (Math.hypot(p.x - ws.x, p.y - ws.y) > CONFIG.poi.discoverRadius) continue;
      const found = ws.discover(p.id);
      if (found) {
        ctx.system.push(SYS.discovered(`${found.name} (${POI_KIND_LABEL[found.kind]})`), 'info');
        this.minimap.markFogDirty();
        this.drainQuestReady();
        this.awardAchievements();
      }
    }
  }

  private checkPickups(): void {
    const ctx = this.ctx;
    const ws = ctx.world!;
    for (let i = this.ents.drops.count - 1; i >= 0; i--) {
      const d = this.ents.drops.items[i];
      if (Math.hypot(d.x - ws.x, d.y - ws.y) > P.pickupRadius) continue;
      if (d.gold > 0) {
        ctx.save.data.gold += d.gold;
        ctx.audio.play('coin', { throttleMs: 70, vol: 0.5 });
        this.pops.spawn(d.x, d.y - 16, `+${d.gold}`, CONFIG.colors.amberBright);
      } else if (d.gear) {
        ws.addGear(d.gear);
        ctx.system.push(SYS.gearFound(d.gear.name), 'good');
        ctx.audio.play('upgrade', { vol: 0.6 });
      }
      d.sp.visible = false;
      this.ents.drops.release(i);
      this.awardAchievements();
    }
  }

  // ============================== COMBAT HOOKS ==============================

  private onHit(x: number, y: number, dmg: number, crit: boolean, kind: EnemyKind): void {
    const ctx = this.ctx;
    this.particles.burst(x, y - 14, {
      frame: 'shard', count: CONFIG.fx.hitParticles, tint: CONFIG.colors.bone,
      speed: 110, ttl: 0.28, gravity: 260,
    });
    this.pops.spawn(
      x, y - 26, String(Math.max(1, Math.round(dmg))),
      crit ? CONFIG.colors.amberBright : CONFIG.colors.bone, crit,
    );
    ctx.audio.hit();
    if (crit || kind === 'boss') ctx.fx.shake(CONFIG.fx.shakeHit);
  }

  private onDie(x: number, y: number, kind: EnemyKind): void {
    const ctx = this.ctx;
    this.particles.burst(x, y - 14, {
      frame: 'shard', count: CONFIG.fx.dieParticles, tint: CONFIG.colors.rustDeep,
      speed: 170, speedVar: 80, gravity: 420, ttl: 0.55, spin: 8, s0: 1.3, s1: 0.4,
    });
    this.particles.burst(x, y - 14, {
      frame: 'softDot', count: 5, tint: CONFIG.colors.amberBright,
      speed: 70, ttl: 0.4, additive: true, s0: 1.5, s1: 0.2,
    });
    ctx.audio.play('enemyDie', { throttleMs: 50, vol: 0.55 });
    if (kind === 'boss') {
      ctx.fx.shake(CONFIG.fx.shakeBossDeath);
      ctx.fx.flash(0.75, 2.4);
      ctx.haptics.boss();
    } else {
      ctx.haptics.hit();
    }
  }

  /** Loot, XP and quest progress for a kill. */
  private rewardKill(kind: EnemyKind, x: number, y: number, poi: string): void {
    void poi;
    const ctx = this.ctx;
    const ws = ctx.world!;
    const save = ctx.save.data;
    const stat = CONFIG.enemies[kind];

    save.kills += 1;
    const levels = stats.grantXp(save, stat.xp);
    if (levels > 0) {
      ctx.system.push(SYS.levelUp(save.level, save.points), 'good');
      ctx.audio.play('upgrade', { vol: 0.7 });
      // levelling raises max HP; hand the difference over so it feels like one
      ws.hp = Math.min(stats.maxHp(save, ws.equipped), ws.hp + levels * 24);
    }

    this.ents.spawnDrop(ctx.atlas, x, y, Math.round(stat.gold * CONFIG.loot.goldPileFrac), null);
    const dropChance = kind === 'elite' || kind === 'boss'
      ? CONFIG.loot.eliteDropChance : CONFIG.loot.dropChance;
    if (Math.random() < dropChance) {
      this.ents.spawnDrop(ctx.atlas, x + 18, y + 8, 0, rollDrop(save, ws.equipped));
    }

    for (const id of ws.onKill(kind)) this.announceReady(id);
    this.awardAchievements();
  }

  private hurtPlayer(dmg: number): boolean {
    const ctx = this.ctx;
    const ws = ctx.world!;
    if (this.dead || this.iFrames > 0) return false;
    ws.hp -= dmg;
    this.iFrames = P.iFrames;
    ctx.fx.shake(CONFIG.fx.shakePlayerHurt);
    ctx.haptics.hurt();
    ctx.audio.play('partyLoss', { throttleMs: 120, vol: 0.6 });
    this.pops.spawn(ws.x, ws.y - 52, `−${Math.round(dmg)}`, CONFIG.colors.hpRedBright, true);

    const max = stats.maxHp(ctx.save.data, ws.equipped);
    if (ws.hp / max < 0.25 && !this.lowWarned && ws.hp > 0) {
      this.lowWarned = true;
      ctx.system.push(SYS.lowHp(), 'bad');
    }
    if (ws.hp <= 0) {
      ws.hp = 0;
      this.beginDeath();
    }
    return true;
  }

  // ============================== ABILITIES ==============================

  private fireBlast(): void {
    const ctx = this.ctx;
    const ws = ctx.world!;
    if (this.cdBlast > 0 || this.dead || ctx.loop.paused) return;
    const save = ctx.save.data;
    this.cdBlast = stats.abilityCooldown(save, ws.equipped, 'blast');
    const dmg = CONFIG.abilities.blast.damage * stats.abilityPotency(save, ws.equipped);

    ctx.audio.play('breach', { vol: 0.6, rate: 1.25 });
    ctx.fx.shake(CONFIG.fx.shakeBlast);
    ctx.fx.flash(0.26, 3.4);
    ctx.haptics.hurt();
    this.particles.burst(ws.x, ws.y - 20, {
      frame: 'softDot', count: 30, tint: CONFIG.colors.amberBright,
      speed: 300, speedVar: 150, ttl: 0.5, additive: true, s0: 2.4, s1: 0.2,
    });
    this.combat.blast(ws.x, ws.y, CONFIG.abilities.blast.radius, dmg);
  }

  private fireSurge(): void {
    const ctx = this.ctx;
    const ws = ctx.world!;
    if (this.cdSurge > 0 || this.dead || ctx.loop.paused) return;
    const save = ctx.save.data;
    this.cdSurge = stats.abilityCooldown(save, ws.equipped, 'surge');
    const heal = Math.round(CONFIG.abilities.surge.heal * stats.abilityPotency(save, ws.equipped));
    const max = stats.maxHp(save, ws.equipped);
    const before = ws.hp;
    ws.hp = Math.min(max, ws.hp + heal);
    this.hasteT = CONFIG.abilities.surge.hasteSec;
    this.lowWarned = false;

    ctx.audio.play('partyGain', { vol: 0.7 });
    ctx.haptics.hit();
    this.particles.burst(ws.x, ws.y - 20, {
      frame: 'star4', count: 16, tint: CONFIG.colors.goodTeal,
      speed: 130, ttl: 0.6, additive: true, s0: 1.4, s1: 0.2,
    });
    this.pops.spawn(ws.x, ws.y - 56, `+${Math.round(ws.hp - before)}`, CONFIG.colors.hpGreen, true);
  }

  // ============================== INTERACTION ==============================

  /** The nearest thing worth a button press, or null. */
  private findInteract(): Interact {
    const ws = this.ctx.world!;
    let best: Interact = null;
    let bestD: number = P.interactRadius;

    for (const n of getWorld().npcs) {
      const p = npcPos(n);
      const d = Math.hypot(p.x - ws.x, p.y - ws.y);
      if (d < bestD) { bestD = d; best = { kind: 'npc', id: n.id, label: UI.talkPrompt, x: p.x, y: p.y }; }
    }
    for (const p of getWorld().pois) {
      if (p.kind !== 'shrine' || ws.shrines.has(p.id)) continue;
      const d = Math.hypot(p.x - ws.x, p.y - ws.y);
      if (d < bestD) { bestD = d; best = { kind: 'shrine', id: p.id, label: UI.usePrompt, x: p.x, y: p.y }; }
    }
    return best;
  }

  private doInteract(): void {
    const ctx = this.ctx;
    const ws = ctx.world!;
    const target = this.interact;
    if (!target || this.dead) return;
    ctx.audio.play('uiTap');

    if (target.kind === 'shrine') {
      if (!ws.useShrine(target.id)) return;
      ctx.save.data.points += CONFIG.poi.shrineStatPoints;
      ctx.system.push(SYS.shrine(), 'good');
      ctx.audio.play('upgrade', { vol: 0.8 });
      this.particles.burst(target.x, target.y - 10, {
        frame: 'star4', count: 20, tint: CONFIG.colors.sysBright,
        speed: 150, ttl: 0.8, additive: true, s0: 1.6, s1: 0.2,
      });
      this.persist();
      return;
    }
    showDialogue(ctx, target.id);
  }

  // ============================== QUESTS / AWARDS ==============================

  private announceReady(id: string): void {
    const q = questById(id);
    if (q) this.ctx.system.push(SYS.questReady(q.title), 'good');
  }

  private drainQuestReady(): void {
    for (const id of this.ctx.world!.drainReady()) this.announceReady(id);
  }

  private awardAchievements(): void {
    const ctx = this.ctx;
    for (const a of checkAchievements(ctx.save.data, ctx.world!)) {
      ctx.system.push(announce(a), 'good');
    }
  }

  // ============================== DEATH ==============================

  private beginDeath(): void {
    if (this.dead) return;
    const ctx = this.ctx;
    this.dead = true;
    this.deathT = P.deathDelay;
    this.hero.texture = ctx.atlas.get('carl_dead');
    ctx.fx.shake(CONFIG.fx.shakeBossDeath * 0.6);
    ctx.fx.flash(0.4, 1.4);
    ctx.audio.play('failSting');
    ctx.audio.music(null);
  }

  private finishDeath(): void {
    const ctx = this.ctx;
    const ws = ctx.world!;
    const save = ctx.save.data;
    const lost = Math.round(save.gold * P.deathGoldPenalty);
    save.gold = Math.max(0, save.gold - lost);
    save.totalDeaths += 1;

    // wake up at home, whole, and considerably poorer
    const home = ws.homePos();
    ws.x = home.x; ws.y = home.y;
    ws.hp = stats.maxHp(save, ws.equipped);
    this.persist();
    ctx.router.goto('death', { lost, blame: this.lastBlame });
  }

  private lastBlame = '';

  // ============================== RENDER ==============================

  frame(dtReal: number, alpha: number): void {
    const ctx = this.ctx;
    const ws = ctx.world;
    if (!ws) return;
    const dtV = dtReal * ctx.fx.timescale;

    // ── camera: dead zone, then ease, plus a little look-ahead ──
    const ix = this.px + (ws.x - this.px) * alpha;
    const iy = this.py + (ws.y - this.py) * alpha;
    const aheadX = ix + this.vx * CONFIG.camera.lookAhead;
    const aheadY = iy + this.vy * CONFIG.camera.lookAhead;
    const dzx = aheadX - this.camX, dzy = aheadY - this.camY;
    if (Math.abs(dzx) > CONFIG.camera.deadZoneX) {
      this.camX += dzx - Math.sign(dzx) * CONFIG.camera.deadZoneX;
    }
    if (Math.abs(dzy) > CONFIG.camera.deadZoneY) {
      this.camY += dzy - Math.sign(dzy) * CONFIG.camera.deadZoneY;
    }
    const ease = Math.min(1, CONFIG.camera.lerp * dtReal);
    this.camX += (aheadX - this.camX) * ease * 0.35;
    this.camY += (aheadY - this.camY) * ease * 0.35;
    this.camera.position.set(Math.round(W / 2 - this.camX), Math.round(H / 2 - this.camY));

    this.mountChunks();

    // ── the cast ──
    const facing = this.heroFacing();
    if (!this.dead) this.hero.texture = ctx.atlas.get('carl_' + facing);
    this.hero.scale.x = ws.face < 0 && facing === 'e' ? -1 : 1;
    this.hero.position.set(ix, iy);
    this.hero.zIndex = iy;
    // a bob while moving, so walking reads without a second frame of art
    const moving = Math.hypot(this.vx, this.vy) > 8;
    this.hero.y = iy - (moving ? Math.abs(Math.sin(performance.now() / 90)) * 2.4 : 0);
    this.hero.alpha = this.iFrames > 0 ? 0.55 + Math.sin(performance.now() / 45) * 0.3 : 1;

    const dix = this.dpx + (this.dx - this.dpx) * alpha;
    const diy = this.dpy + (this.dy - this.dpy) * alpha;
    const dFace = Math.abs(dix - ix) > Math.abs(diy - iy) ? 'e' : diy > iy ? 's' : 'n';
    this.donut.texture = ctx.atlas.get('donut_' + dFace);
    this.donut.scale.x = dix > ix ? -1 : 1;
    this.donut.position.set(dix, diy);
    this.donut.zIndex = diy;

    // ── enemies ──
    for (let i = 0; i < this.ents.enemies.count; i++) {
      const e = this.ents.enemies.items[i];
      const ex = e.px + (e.x - e.px) * alpha;
      const ey = e.py + (e.y - e.py) * alpha;
      const face: 's' | 'n' | 'e' = this.enemyFacing(e.x - ws.x, e.y - ws.y);
      if (e.flashT > 0) {
        e.flashT -= dtReal;
        e.sp.texture = ctx.atlas.get(e.kind + '_flash');
      } else {
        e.sp.texture = ctx.atlas.get(`${e.kind}_${face}`);
      }
      e.sp.scale.x = face === 'e' && e.face < 0 ? -1 : 1;
      e.sp.position.set(ex, ey - (e.aggro ? Math.abs(Math.sin(e.phase)) * 2 : 0));
      e.sp.zIndex = ey;
    }

    // ── projectiles and drops ──
    for (let i = 0; i < this.ents.shots.count; i++) {
      const s = this.ents.shots.items[i];
      s.sp.position.set(s.px + (s.x - s.px) * alpha, s.py + (s.y - s.py) * alpha);
    }
    for (let i = this.ents.drops.count - 1; i >= 0; i--) {
      const d = this.ents.drops.items[i];
      d.t += dtV;
      d.life += dtV;
      if (d.life > CONFIG.loot.lifeSec) {
        d.sp.visible = false;
        this.ents.drops.release(i);
        continue;
      }
      d.sp.position.set(d.x, d.y - 6 - Math.abs(Math.sin(d.t * 3)) * 5);
      d.sp.zIndex = d.y;
      // fade the last few seconds so a vanishing item is never a surprise
      const left = CONFIG.loot.lifeSec - d.life;
      d.sp.alpha = left < 6 ? Math.max(0.15, left / 6) : 1;
    }

    this.particles.budgetScale = ctx.loop.thermalSoften() ? CONFIG.thermal.particleBudgetScale : 1;
    this.particles.update(dtV);
    this.pops.update(dtReal);

    // ── HUD ──
    this.interact = this.findInteract();
    const save = ctx.save.data;
    this.hud.setHp(ws.hp, stats.maxHp(save, ws.equipped));
    this.hud.setXp(save.level, stats.xpFrac(save));
    this.hud.setGold(save.gold);
    this.hud.setRegion(BIOME_NAME[biomeAt(ws.x, ws.y)]);
    this.hud.setInteract(this.interact?.label ?? null);
    this.hud.setBadges(save.points > 0, this.readyQuestCount() > 0);
    this.hud.setCooldowns(
      1 - this.cdBlast / Math.max(0.001, stats.abilityCooldown(save, ws.equipped, 'blast')),
      1 - this.cdSurge / Math.max(0.001, stats.abilityCooldown(save, ws.equipped, 'surge')),
    );
    this.joystick.update(dtReal);
    this.minimap.update();
  }

  private readyQuestCount(): number {
    const ws = this.ctx.world!;
    let n = 0;
    for (const [, s] of ws.quests) if (s === 'ready') n++;
    return n;
  }

  private heroFacing(): 's' | 'n' | 'e' {
    if (Math.abs(this.vx) > Math.abs(this.vy) * 1.2 && Math.abs(this.vx) > 8) return 'e';
    if (this.vy < -8) return 'n';
    return 's';
  }

  private enemyFacing(dx: number, dy: number): 's' | 'n' | 'e' {
    if (Math.abs(dx) > Math.abs(dy) * 1.2) return 'e';
    return dy > 0 ? 'n' : 's';
  }

  /** Add chunks that have come into view, drop the ones that have left. */
  private mountChunks(): void {
    const pad = CONFIG.world.chunkPadding;
    const x0 = Math.floor((this.camX - W / 2 - pad) / CHUNK_SIZE);
    const x1 = Math.floor((this.camX + W / 2 + pad) / CHUNK_SIZE);
    const y0 = Math.floor((this.camY - H / 2 - pad) / CHUNK_SIZE);
    const y1 = Math.floor((this.camY + H / 2 + pad) / CHUNK_SIZE);
    const want = new Set<string>();

    const maxC = Math.ceil(CONFIG.world.size / CHUNK_SIZE);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (cx < 0 || cy < 0 || cx >= maxC || cy >= maxC) continue;
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
        const sp = new Sprite(tex);
        sp.position.set(cx * CHUNK_SIZE, cy * CHUNK_SIZE);
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
    const ws = this.ctx.world!;
    const save = this.ctx.save.data;
    return {
      x: Math.round(ws.x), y: Math.round(ws.y),
      hp: Math.round(ws.hp), maxHp: stats.maxHp(save, ws.equipped),
      level: save.level, gold: save.gold, kills: save.kills,
      enemies: this.ents.enemies.count,
      drops: this.ents.drops.count,
      bag: ws.inventory.length,
      equipped: Object.keys(ws.equipped).length,
      discovered: ws.discovered.size,
      cleared: [...ws.cleared.keys()],
      bossDown: ws.bossDown,
      dead: this.dead,
      interact: this.interact ? { kind: this.interact.kind, id: this.interact.id } : null,
      quests: [...ws.quests],
      chunks: this.mounted.size,
    };
  }
}

/** Blame text for the death screen. */
export const blameFor = (kind: EnemyKind): string => `${MOB_BLAME[kind]} (${MOB_NAME[kind]})`;

/**
 * How much health a spawn gets for the player's level.
 *
 * Ordinary mobs scale, and are capped, so a camp you walk to at level 12 is
 * still worth the walk. The boss does NOT scale at all: it is the floor's
 * wall, and a wall that grows with you means levelling buys nothing and the
 * fight is exactly as hard at 20 as it was at 5.
 */
function enemyScale(level: number, kind: EnemyKind): number {
  if (kind === 'boss') return 1;
  return Math.min(CONFIG.enemies.maxScale, 1 + (level - 1) * CONFIG.enemies.scalePerLevel);
}
