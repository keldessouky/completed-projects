import type { Application, Container } from 'pixi.js';
import { CONFIG } from '../config';

/**
 * Viewport + camera for a free-roam world.
 *
 * Unlike a fixed-lane game, letterboxing here would waste most of a desktop
 * screen. Instead a constant *vertical* slice of world is always visible and
 * the horizontal extent follows the device aspect: phones see a tall column,
 * desktops see a wide field, and neither is cropped.
 *
 * The UI lives in its own screen-space layer with a scale derived from the
 * viewport height, so buttons stay thumb-sized on a phone and don't balloon
 * on a monitor.
 */
export class Camera {
  /** world units per screen pixel */
  scale = 1;
  /** camera centre in world units */
  x: number = CONFIG.world.fortCenter;
  y: number = CONFIG.world.fortCenter;
  /** viewport size in CSS px */
  vw = 0;
  vh = 0;
  /** visible world extent */
  viewW = 0;
  viewH: number = CONFIG.view.worldViewHeight;
  /** UI scale factor and safe-area insets, in UI px */
  uiScale = 1;
  safeTop = 0;
  safeBottom = 0;

  private shakeX = 0;
  private shakeY = 0;
  onLayout: (() => void)[] = [];

  constructor(private app: Application, private world: Container, private ui: Container) {
    window.addEventListener('resize', () => this.layout());
    window.visualViewport?.addEventListener('resize', () => this.layout());
    window.addEventListener('orientationchange', () => this.layout());
    this.layout();
  }

  layout(): void {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (vw === 0 || vh === 0) return;
    this.vw = vw;
    this.vh = vh;

    const aspect = Math.max(CONFIG.view.minAspect, Math.min(CONFIG.view.maxAspect, vw / vh));
    this.viewH = CONFIG.view.worldViewHeight;
    this.viewW = this.viewH * aspect;
    this.scale = vh / this.viewH;

    const cs = getComputedStyle(document.documentElement);
    const sat = parseFloat(cs.getPropertyValue('--sat')) || 0;
    const sab = parseFloat(cs.getPropertyValue('--sab')) || 0;

    this.uiScale = Math.max(
      CONFIG.view.uiScaleMin,
      Math.min(CONFIG.view.uiScaleMax, vh / CONFIG.view.uiRefHeight),
    );
    this.ui.scale.set(this.uiScale);
    this.safeTop = sat / this.uiScale;
    this.safeBottom = sab / this.uiScale;

    this.app.renderer.resize(vw, vh);
    for (const cb of this.onLayout) cb();
  }

  /** UI-space dimensions (what UI code should lay out against). */
  get uiW(): number { return this.vw / this.uiScale; }
  get uiH(): number { return this.vh / this.uiScale; }

  /** Follow a target with lead and easing; clamped to the world bounds. */
  follow(tx: number, ty: number, vx: number, vy: number, dt: number): void {
    const lead = CONFIG.fx.camLead;
    const desiredX = tx + vx * lead;
    const desiredY = ty + vy * lead;
    const k = Math.min(1, CONFIG.fx.camLerp * dt);
    this.x += (desiredX - this.x) * k;
    this.y += (desiredY - this.y) * k;

    // keep the view inside the map unless the map is smaller than the view
    const halfW = this.viewW / 2;
    const halfH = this.viewH / 2;
    const size = CONFIG.world.size;
    this.x = halfW * 2 >= size ? size / 2 : Math.max(halfW, Math.min(size - halfW, this.x));
    this.y = halfH * 2 >= size ? size / 2 : Math.max(halfH, Math.min(size - halfH, this.y));
  }

  snap(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  setShake(sx: number, sy: number): void {
    this.shakeX = sx;
    this.shakeY = sy;
  }

  /** Push the camera transform onto the world container. Called every frame. */
  apply(): void {
    this.world.scale.set(this.scale);
    this.world.position.set(
      this.vw / 2 - (this.x + this.shakeX) * this.scale,
      this.vh / 2 - (this.y + this.shakeY) * this.scale,
    );
  }

  /** screen px → world units */
  toWorldX(clientX: number): number { return (clientX - this.world.x) / this.scale; }
  toWorldY(clientY: number): number { return (clientY - this.world.y) / this.scale; }
}
