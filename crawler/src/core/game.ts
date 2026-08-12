import { Application, Container } from 'pixi.js';
import { Group as TweenGroup } from '@tweenjs/tween.js';
import { CONFIG } from '../config';
import type { SceneId } from '../types';
import type { GameAtlas } from '../assets/atlas';
import { AudioBus } from './audio';
import { Fx } from './fx';
import { Haptics } from './haptics';
import { Input } from './input';
import { Loop } from './loop';
import { Save } from './save';
import { Scaler } from './scaler';
import { SystemFeed } from '../game/system';
import { WorldState } from '../world/worldstate';
import { getWorld, npcPos } from '../world/worldgen';
import { grantXp, maxHp, spendPoint, xpToNext } from '../game/stats';
import type { StatKey } from '../config';

/** Implemented by the scene manager; kept as an interface to avoid import cycles. */
export interface SceneRouter {
  goto(id: SceneId, data?: unknown): void;
  current: SceneId;
}

/**
 * The one context object every scene receives: renderer, layers, and all
 * core services. Also owns app-level lifecycle — visibility pause/mute,
 * WebGL context-loss recovery, portrait lock, and the debug hooks that the
 * dev overlay and the headless smoke harness share.
 */
export class Game {
  app!: Application;
  /** scaled 440×956 design space — scenes live here */
  root = new Container();
  /** unscaled screen space — flash, rotate prompt, dev overlay */
  screen = new Container();

  save!: Save;
  audio = new AudioBus();
  haptics = new Haptics();
  fx!: Fx;
  input!: Input;
  scaler!: Scaler;
  loop!: Loop;
  router!: SceneRouter;
  /** UI tween group, updated on real time every frame (menus keep animating in pause) */
  tweens = new TweenGroup();
  /** loaded by the boot scene before any other scene runs */
  atlas!: GameAtlas;

  /**
   * The live world, or null before it has been entered.
   *
   * This lives here rather than in a scene because scenes are destroyed on
   * every transition, and roaming is punctuated by inventory, shop, dialogue
   * and character screens. It is also what gets serialised on every autosave.
   */
  world: WorldState | null = null;

  /** The System's notification feed — outlives the scene that raised it. */
  system = new SystemFeed();

  /** run scene registers these so app-level events can reach it */
  onAutoPause: (() => void) | null = null;
  /** live entity counters for the dev overlay (the world scene provides) */
  runStats: (() => Record<string, number>) | null = null;

  /**
   * Hooks the world scene publishes so the headless harness can drive the real
   * game rather than reimplementing it: what the world currently looks like,
   * and the same interact call the on-screen button makes.
   */
  worldProbe: (() => Record<string, unknown>) | null = null;
  worldInteract: (() => void) | null = null;
  /**
   * Live node positions on the floor map, in design space. The floor map
   * publishes them so the headless harness can tap the real buttons rather
   * than reimplementing the graph layout — the test drives the UI, it does
   * not bypass it.
   */
  mapNodes: (() => {
    id: string; kind: string; layer: number; x: number; y: number; walkable: boolean; spent: boolean;
  }[]) | null = null;

  private contextLost = false;

  static async create(): Promise<Game> {
    const g = new Game();
    const app = new Application();
    const params = new URLSearchParams(location.search);
    const preference = params.get('gl') === 'webgl' ? 'webgl' : 'webgpu';
    await app.init({
      preference,
      background: CONFIG.colors.ink,
      resolution: Math.min(window.devicePixelRatio || 1, CONFIG.design.maxResolution),
      autoDensity: true,
      antialias: false, // chunky art; the fill-rate is better spent on 120 fps
      powerPreference: 'high-performance',
      hello: false,
    });
    g.app = app;
    document.getElementById('app')!.appendChild(app.canvas);

    g.root.sortableChildren = true;
    g.screen.sortableChildren = true;
    app.stage.addChild(g.root, g.screen);

    g.save = new Save();
    g.fx = new Fx(g.screen);
    g.scaler = new Scaler(app, g.root);
    g.input = new Input(
      () => g.scaler.scale,
      () => ({ x: g.scaler.offsetX, y: g.scaler.offsetY }),
    );
    g.loop = new Loop(app.ticker, g.fx, g);

    // Notifications sit above scenes but inside the letterboxed design box,
    // so they respect the safe-area inset like everything else.
    g.root.addChild(g.system.root);
    g.system.setTop(Math.max(g.scaler.safeTop(), 12) + 8);

    // settings → services
    const s = g.save.data.settings;
    g.fx.getUserReduced = () => g.save.data.settings.reducedMotion;
    g.fx.getShakeIntensity = () => g.save.data.settings.shake;
    g.haptics.enabled = s.haptics;
    g.audio.applyVolumes(s.music, s.sfx);

    // shake rides on top of the letterbox offset, in screen px
    app.ticker.add(() => {
      g.guard('tweens', () => g.tweens.update(performance.now()));
      g.guard('system', () => g.system.update(Math.min(0.1, app.ticker.deltaMS / 1000)));
      g.root.position.set(
        g.scaler.offsetX + g.fx.shakeX * g.scaler.scale,
        g.scaler.offsetY + g.fx.shakeY * g.scaler.scale,
      );
    });

    g.wireLifecycle();
    g.exposeDebug();
    return g;
  }

  /**
   * Run per-frame work so one exception can't take the game down for good.
   * Pixi requests the next animation frame only after `Ticker.update()`
   * returns, so anything that throws inside a listener freezes the whole
   * game permanently. Reporting once and continuing beats a black screen.
   */
  guard(label: string, fn: () => void): void {
    try {
      fn();
    } catch (err) {
      if (!this.reported.has(label)) {
        this.reported.add(label);
        console.error(`[crawler] recovered from an error in ${label}:`, err);
      }
    }
  }
  private reported = new Set<string>();

  /** Enter the world, resuming the saved one when there is one. */
  enterWorld(fresh = false): void {
    this.system.clear();
    const saved = this.save.data.world;
    this.world = !fresh && saved ? WorldState.fromSave(saved) : new WorldState();
    this.save.data.world = this.world.toSave();
    this.router?.goto('world');
  }

  applySettings(): void {
    const s = this.save.data.settings;
    this.haptics.enabled = s.haptics;
    this.audio.applyVolumes(s.music, s.sfx);
    this.save.mark();
  }

  private wireLifecycle(): void {
    // Calls, app switches, tab hides: pause gameplay and mute everything.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.audio.muteAll(true);
        this.onAutoPause?.();
      } else {
        this.audio.muteAll(false);
      }
    });

    // WebGL context loss: recoverable message, restore on next touch.
    const lostEl = document.getElementById('gl-lost')!;
    this.app.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.contextLost = true;
      this.onAutoPause?.();
      lostEl.style.display = 'flex';
    });
    this.app.canvas.addEventListener('webglcontextrestored', () => {
      // Atlas + backdrops are canvas-backed textures; Pixi re-uploads them.
      this.contextLost = false;
      lostEl.style.display = 'none';
    });
    lostEl.addEventListener('pointerdown', () => {
      if (this.contextLost) {
        // Context did not come back on its own — a clean reload restores
        // (save is already flushed on every meaningful change).
        this.save.flush();
        location.reload();
      } else {
        lostEl.style.display = 'none';
      }
    });
  }

  /** Shared by the dev overlay and the headless smoke harness. */
  private exposeDebug(): void {
    const dbg = {
      game: this,
      scene: () => this.router?.current,
      enterWorld: (fresh = false) => this.enterWorld(fresh),
      probe: () => this.worldProbe?.() ?? null,
      interact: () => this.worldInteract?.(),
      /** teleport — the only way a test can cross 5,000 units in finite time */
      warp: (x: number, y: number) => { if (this.world) { this.world.x = x; this.world.y = y; } },
      /** the POI and NPC layout, so a test can navigate without hard-coding it */
      worldDef: () => ({
        pois: getWorld().pois.map((p) => ({ id: p.id, kind: p.kind, x: p.x, y: p.y, name: p.name })),
        npcs: getWorld().npcs.map((n) => ({ id: n.id, ...npcPos(n) })),
      }),
      /**
       * Level up and actually spend the points, the way a player would. A
       * character carrying forty unspent attribute points is not "level 15",
       * it is level 1 with a big number over its head — and a test that skips
       * the spending would be measuring the wrong character entirely.
       */
      grantLevels: (n: number) => {
        const save = this.save.data;
        for (let i = 0; i < n; i++) grantXp(save, xpToNext(save.level));
        const spread: StatKey[] = ['str', 'con', 'dex', 'str', 'con', 'luck', 'wis'];
        for (let i = 0; save.points > 0 && i < 500; i++) spendPoint(save, spread[i % spread.length]);
        if (this.world) this.world.hp = maxHp(save, this.world.equipped);
        this.save.mark();
      },
      goto: (id: SceneId) => this.router?.goto(id),
      turbo: (x: number) => { this.loop.turbo = Math.max(1, x); },
      hurt: (n: number) => { if (this.world) this.world.hp = Math.max(0, this.world.hp - n); },
      stats: () => ({ ...(this.runStats?.() ?? {}), fps: 1000 / Math.max(0.01, this.loop.avgFrameMs) }),
      save: () => this.save.data,
      grantGold: (n: number) => { this.save.data.gold += n; this.save.mark(); },
      grantPoints: (n: number) => { this.save.data.points += n; this.save.mark(); },
      errors: [] as string[],
    };
    window.addEventListener('error', (e) => dbg.errors.push(String(e.message)));
    window.addEventListener('unhandledrejection', (e) => dbg.errors.push(String(e.reason)));
    (window as unknown as Record<string, unknown>).__cr = dbg;
  }
}

export type Ctx = Game;
