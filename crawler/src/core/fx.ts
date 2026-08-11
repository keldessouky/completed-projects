import { Container, Graphics } from 'pixi.js';
import { CONFIG } from '../config';

/**
 * Game-feel services: screen shake, slow-mo, freeze-frame, full-screen flash.
 * All of it respects reduced motion (OS media query OR user setting):
 * shake and slow-mo are killed outright, flashes soften.
 */
export class Fx {
  /** multiplier the fixed-step accumulator uses; 0 during freeze-frames */
  timescale = 1;
  /** extra factor held while the tutorial hand is up (1 = normal) */
  tutorialScale = 1;

  private shakeAmp = 0;
  shakeX = 0;
  shakeY = 0;

  private slowUntil = 0;   // performance.now() deadlines (real time)
  private slowScale = 1;
  private freezeUntil = 0;

  private flashG: Graphics;
  private flashAlpha = 0;
  private flashFade = 1;

  private osReduced: MediaQueryList | null = null;
  /** user setting hooks, wired by Game after save loads */
  getUserReduced: () => boolean = () => false;
  getShakeIntensity: () => number = () => 1;

  constructor(overlayLayer: Container) {
    this.flashG = new Graphics();
    // Oversized so shake/letterbox never reveal edges; overlay layer is unscaled screen space.
    this.flashG.rect(-4000, -4000, 8000, 8000).fill(CONFIG.colors.white);
    this.flashG.visible = false;
    this.flashG.eventMode = 'none';
    overlayLayer.addChild(this.flashG);
    if (typeof matchMedia === 'function') {
      this.osReduced = matchMedia('(prefers-reduced-motion: reduce)');
    }
  }

  reducedMotion(): boolean {
    return (this.osReduced?.matches ?? false) || this.getUserReduced();
  }

  shake(amplitude: number): void {
    if (this.reducedMotion()) return;
    this.shakeAmp = Math.max(this.shakeAmp, amplitude * this.getShakeIntensity());
  }

  slowmo(scale: number, ms: number): void {
    if (this.reducedMotion()) return; // spec: reduced motion kills slow-mo
    this.slowScale = scale;
    this.slowUntil = performance.now() + ms;
  }

  freeze(ms: number): void {
    // Freeze-frame is a gameplay beat (boss breach), kept even under reduced
    // motion but shortened so it reads as a pause, not an effect.
    const dur = this.reducedMotion() ? Math.min(ms, 120) : ms;
    this.freezeUntil = performance.now() + dur;
  }

  flash(alpha: number, fadePerSec: number): void {
    this.flashAlpha = Math.max(this.flashAlpha, this.reducedMotion() ? Math.min(alpha, 0.35) : alpha);
    this.flashFade = fadePerSec;
  }

  /** Per-render-frame update; dtReal in seconds of wall-clock time. */
  update(dtReal: number): void {
    const now = performance.now();
    const base = now < this.freezeUntil ? 0 : now < this.slowUntil ? this.slowScale : 1;
    this.timescale = base * this.tutorialScale;

    if (this.shakeAmp > 0.15) {
      this.shakeX = (Math.random() * 2 - 1) * this.shakeAmp;
      this.shakeY = (Math.random() * 2 - 1) * this.shakeAmp;
      // frame-rate independent decay tuned around 120fps
      this.shakeAmp *= Math.pow(CONFIG.fx.shakeDecay, dtReal * 120);
    } else {
      this.shakeAmp = 0; this.shakeX = 0; this.shakeY = 0;
    }

    if (this.flashAlpha > 0.004) {
      this.flashAlpha = Math.max(0, this.flashAlpha - this.flashFade * dtReal);
      this.flashG.visible = true;
      this.flashG.alpha = this.flashAlpha;
    } else if (this.flashG.visible) {
      this.flashG.visible = false;
    }
  }

  /** Drop transient state (scene switches). */
  clear(): void {
    this.shakeAmp = 0; this.shakeX = 0; this.shakeY = 0;
    this.slowUntil = 0; this.freezeUntil = 0; this.timescale = 1; this.tutorialScale = 1;
    this.flashAlpha = 0; this.flashG.visible = false;
  }
}
