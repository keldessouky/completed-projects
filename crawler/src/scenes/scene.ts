import { Container, Graphics } from 'pixi.js';
import { Easing, Tween } from '@tweenjs/tween.js';
import { CONFIG } from '../config';
import type { Ctx, SceneRouter } from '../core/game';
import type { SceneId } from '../types';

export abstract class Scene {
  container = new Container();
  constructor(protected ctx: Ctx) {}
  abstract enter(data?: unknown): void;
  /** teardown beyond display-object destruction (listeners, loop steppers) */
  exit(): void { /* default: nothing */ }
}

type Factory = (ctx: Ctx) => Scene;

/**
 * Owns the active scene: build fresh on every goto (no stale state), destroy
 * the old wholesale, quick fade between. Scenes mount into ctx.root at z 0;
 * overlays (pause/settings/dev) sit above and are not scenes.
 */
export class SceneManager implements SceneRouter {
  current: SceneId = 'boot';
  private active: Scene | null = null;
  private factories = new Map<SceneId, Factory>();
  private fade: Graphics;

  constructor(private ctx: Ctx) {
    this.fade = new Graphics();
    this.fade.rect(-40, -40, CONFIG.design.width + 80, CONFIG.design.height + 80).fill(CONFIG.colors.pit);
    this.fade.zIndex = 500;
    this.fade.visible = false;
    this.fade.eventMode = 'none';
    ctx.root.addChild(this.fade);
    ctx.router = this;
  }

  register(id: SceneId, f: Factory): void {
    this.factories.set(id, f);
  }

  goto(id: SceneId, data?: unknown): void {
    const factory = this.factories.get(id);
    if (!factory) throw new Error('unknown scene ' + id);

    // Kill every in-flight tween BEFORE destroying the scene that owns the
    // display objects they mutate. A tween that outlives its sprite throws
    // inside the ticker, and a throw there permanently stops the render loop
    // (Pixi never re-requests the frame), which reads to the player as a hang.
    this.ctx.tweens.removeAll();

    if (this.active) {
      this.active.exit();
      this.active.container.destroy({ children: true });
      this.active = null;
    }
    // scene switches always drop transient feel state and steppers
    this.ctx.loop.stepper = null;
    this.ctx.loop.paused = false;
    this.ctx.fx.clear();
    this.ctx.onAutoPause = null;

    this.current = id;
    const scene = factory(this.ctx);
    scene.container.zIndex = 0;
    this.ctx.root.addChild(scene.container);
    this.active = scene;
    scene.enter(data);

    // fade-in from bitumen — skipped for boot (it *is* the first light)
    if (id !== 'boot') {
      this.fade.visible = true;
      this.fade.alpha = 1;
      const state = { a: 1 };
      const tw = new Tween(state)
        .to({ a: 0 }, 260)
        .easing(Easing.Quadratic.Out)
        .onUpdate(() => { this.fade.alpha = state.a; })
        .onComplete(() => { this.fade.visible = false; })
        .start(performance.now());
      this.ctx.tweens.add(tw);
    }
  }
}
