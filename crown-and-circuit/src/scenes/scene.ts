import { Container, Graphics } from 'pixi.js';
import { Easing, Tween } from '@tweenjs/tween.js';
import { CONFIG } from '../config';
import type { Ctx, SceneId, SceneRouter } from '../core/game';

/**
 * A scene owns two display roots: `world` (camera-transformed, world units)
 * and `ui` (screen space, UI-scaled). Menu scenes simply leave `world` empty.
 */
export abstract class Scene {
  world = new Container();
  ui = new Container();
  constructor(protected ctx: Ctx) {}
  abstract enter(data?: unknown): void;
  /** teardown beyond display-object destruction (steppers, listeners) */
  exit(): void { /* default: nothing */ }
  /** called on viewport resize so UI can re-anchor */
  layout(): void { /* default: nothing */ }
}

type Factory = (ctx: Ctx) => Scene;

/**
 * Builds each scene fresh on goto and destroys the old one wholesale, so no
 * stale state survives a transition. A short fade covers the swap.
 */
export class SceneManager implements SceneRouter {
  current: SceneId = 'boot';
  private active: Scene | null = null;
  private factories = new Map<SceneId, Factory>();
  private fade: Graphics;

  constructor(private ctx: Ctx) {
    this.fade = new Graphics();
    this.fade.rect(-4000, -4000, 12000, 12000).fill(CONFIG.colors.bg);
    this.fade.visible = false;
    this.fade.eventMode = 'none';
    this.fade.zIndex = 400;
    ctx.overlay.addChild(this.fade);
    ctx.router = this;
    ctx.camera.onLayout.push(() => this.active?.layout());
  }

  register(id: SceneId, f: Factory): void {
    this.factories.set(id, f);
  }

  goto(id: SceneId, data?: unknown): void {
    const factory = this.factories.get(id);
    if (!factory) throw new Error('unknown scene ' + id);

    // Kill in-flight tweens before destroying the objects they mutate: a tween
    // that outlives its sprite throws inside the ticker, and a throw there
    // permanently stops the render loop.
    this.ctx.tweens.removeAll();

    // any modal still up belongs to the scene we are leaving
    this.ctx.overlays.removeChildren().forEach((c) => c.destroy({ children: true }));

    if (this.active) {
      this.active.exit();
      this.active.world.destroy({ children: true });
      this.active.ui.destroy({ children: true });
      this.active = null;
    }
    this.ctx.loop.stepper = null;
    this.ctx.loop.paused = false;
    this.ctx.fx.clear();
    this.ctx.onAutoPause = null;
    this.ctx.runStats = null;

    this.current = id;
    const scene = factory(this.ctx);
    this.ctx.world.addChild(scene.world);
    this.ctx.ui.addChild(scene.ui);
    this.active = scene;
    scene.enter(data);
    scene.layout();

    if (id !== 'boot') {
      this.fade.visible = true;
      this.fade.alpha = 1;
      const state = { a: 1 };
      const tw = new Tween(state)
        .to({ a: 0 }, 280)
        .easing(Easing.Quadratic.Out)
        .onUpdate(() => { this.fade.alpha = state.a; })
        .onComplete(() => { this.fade.visible = false; })
        .start(performance.now());
      this.ctx.tweens.add(tw);
    }
  }
}
