import type { Application, Container } from 'pixi.js';
import { CONFIG } from '../config';

/**
 * Letterboxed scale-to-fit of the 440×956 design space, safe-area aware.
 * The design box centers in the window; scenes may paint bleed outside it,
 * but nothing gameplay-critical leaves the box, and HUD respects the
 * Dynamic Island band / home-indicator strip via safeTop()/safeBottom().
 */
export class Scaler {
  scale = 1;
  offsetX = 0;
  offsetY = 0;
  vw = 0;
  vh = 0;
  portrait = true;
  private satPx = 0;
  private sabPx = 0;
  onLayout: (() => void)[] = [];

  constructor(private app: Application, private root: Container) {
    window.addEventListener('resize', () => this.layout());
    window.visualViewport?.addEventListener('resize', () => this.layout());
    window.addEventListener('orientationchange', () => this.layout());
    this.layout();
  }

  layout(): void {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (vw === 0 || vh === 0) return;
    this.vw = vw; this.vh = vh;
    this.portrait = vh >= vw;

    const cs = getComputedStyle(document.documentElement);
    this.satPx = parseFloat(cs.getPropertyValue('--sat')) || 0;
    this.sabPx = parseFloat(cs.getPropertyValue('--sab')) || 0;

    const { width, height } = CONFIG.design;
    this.scale = Math.min(vw / width, vh / height);
    this.offsetX = (vw - width * this.scale) / 2;
    this.offsetY = (vh - height * this.scale) / 2;
    this.root.scale.set(this.scale);
    this.root.position.set(this.offsetX, this.offsetY);

    this.app.renderer.resize(vw, vh);
    for (const cb of this.onLayout) cb();
  }

  /** Unsafe band at the top of the design box, in design px (Dynamic Island). */
  safeTop(): number {
    return Math.max(0, (this.satPx - this.offsetY) / this.scale);
  }

  /** Unsafe band at the bottom (home indicator). */
  safeBottom(): number {
    return Math.max(0, (this.sabPx - this.offsetY) / this.scale);
  }

  /** screen px → design px (for DOM-level pointer work if ever needed) */
  toDesignX(clientX: number): number { return (clientX - this.offsetX) / this.scale; }
  toDesignY(clientY: number): number { return (clientY - this.offsetY) / this.scale; }
}
