import { Application, Container } from 'pixi.js';
import { Group as TweenGroup } from '@tweenjs/tween.js';
import { CONFIG } from '../config';
import type { GameAtlas } from '../assets/atlas';
import type { Texture } from 'pixi.js';
import { AudioBus } from './audio';
import { Camera } from './camera';
import { Fx } from './fx';
import { Haptics } from './haptics';
import { Input } from './input';
import { Loop } from './loop';
import { Save } from './save';

export type SceneId = 'boot' | 'title' | 'run' | 'results' | 'shop';

export interface SceneRouter {
  goto(id: SceneId, data?: unknown): void;
  current: SceneId;
}

/**
 * The single context every scene receives: renderer, layers, and services.
 * Also owns app lifecycle — visibility pause/mute, WebGL context-loss
 * recovery, and the debug surface shared by the dev overlay and smoke tests.
 */
export class Game {
  app!: Application;
  /** camera-transformed world space */
  world = new Container();
  /** screen space, UI-scaled */
  ui = new Container();
  /** modal overlays (pause, settings, cards) — cleared on every scene change
   *  so one can never outlive the scene that opened it and eat input */
  overlays = new Container();
  /** unscaled overlay for full-screen flashes */
  overlay = new Container();

  save!: Save;
  audio = new AudioBus();
  haptics = new Haptics();
  fx!: Fx;
  input!: Input;
  camera!: Camera;
  loop!: Loop;
  router!: SceneRouter;
  tweens = new TweenGroup();
  atlas!: GameAtlas;
  /** one ground tile per era, built at boot */
  terrain!: Texture[];

  onAutoPause: (() => void) | null = null;
  runStats: (() => Record<string, number>) | null = null;

  private contextLost = false;
  private reported = new Set<string>();

  static async create(): Promise<Game> {
    const g = new Game();
    const app = new Application();
    const params = new URLSearchParams(location.search);
    const preference = params.get('gl') === 'webgl' ? 'webgl' : 'webgpu';
    await app.init({
      preference,
      background: CONFIG.colors.bg,
      resolution: Math.min(window.devicePixelRatio || 1, CONFIG.view.maxResolution),
      autoDensity: true,
      antialias: false,
      powerPreference: 'high-performance',
      hello: false,
    });
    g.app = app;
    document.getElementById('app')!.appendChild(app.canvas);

    g.world.sortableChildren = true;
    g.ui.sortableChildren = true;
    g.ui.addChild(g.overlays);
    g.overlays.zIndex = 500;
    g.overlays.sortableChildren = true;
    app.stage.addChild(g.world, g.ui, g.overlay);

    g.save = new Save();
    g.fx = new Fx(g.overlay);
    g.camera = new Camera(app, g.world, g.ui);
    g.input = new Input();
    g.loop = new Loop(app.ticker, g.fx, g);

    const s = g.save.data.settings;
    g.fx.getUserReduced = () => g.save.data.settings.reducedMotion;
    g.fx.getShakeIntensity = () => g.save.data.settings.shake;
    g.haptics.enabled = s.haptics;
    g.audio.applyVolumes(s.music, s.sfx);

    app.ticker.add(() => {
      g.guard('tweens', () => g.tweens.update(performance.now()));
      g.camera.setShake(g.fx.shakeX, g.fx.shakeY);
      g.camera.apply();
    });

    g.wireLifecycle();
    g.exposeDebug();
    return g;
  }

  /**
   * Run per-frame work so one exception cannot kill the game for good: Pixi
   * requests the next animation frame only after `Ticker.update()` returns, so
   * a throw inside a listener freezes everything permanently.
   */
  guard(label: string, fn: () => void): void {
    try {
      fn();
    } catch (err) {
      if (!this.reported.has(label)) {
        this.reported.add(label);
        console.error(`[crown] recovered from an error in ${label}:`, err);
      }
    }
  }

  applySettings(): void {
    const s = this.save.data.settings;
    this.haptics.enabled = s.haptics;
    this.audio.applyVolumes(s.music, s.sfx);
    this.save.mark();
  }

  private wireLifecycle(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.audio.muteAll(true);
        this.onAutoPause?.();
      } else {
        this.audio.muteAll(false);
      }
    });

    const lostEl = document.getElementById('gl-lost')!;
    this.app.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.contextLost = true;
      this.onAutoPause?.();
      lostEl.style.display = 'flex';
    });
    this.app.canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      lostEl.style.display = 'none';
    });
    lostEl.addEventListener('pointerdown', () => {
      if (this.contextLost) {
        this.save.flush();
        location.reload();
      } else {
        lostEl.style.display = 'none';
      }
    });
  }

  private exposeDebug(): void {
    const dbg = {
      game: this,
      scene: () => this.router?.current,
      goto: (id: SceneId, data?: unknown) => this.router?.goto(id, data),
      startRun: (opts?: unknown) => this.router?.goto('run', opts),
      turbo: (x: number) => { this.loop.turbo = Math.max(1, x); },
      stats: () => ({ ...(this.runStats?.() ?? {}), fps: 1000 / Math.max(0.01, this.loop.avgFrameMs) }),
      save: () => this.save.data,
      grantShards: (n: number) => { this.save.data.shards += n; this.save.mark(); },
      errors: [] as string[],
    };
    window.addEventListener('error', (e) => dbg.errors.push(String(e.message)));
    window.addEventListener('unhandledrejection', (e) => dbg.errors.push(String(e.reason)));
    (window as unknown as Record<string, unknown>).__cc = dbg;
  }
}

export type Ctx = Game;
