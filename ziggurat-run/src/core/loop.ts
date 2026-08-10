import type { Ticker } from 'pixi.js';
import { CONFIG } from '../config';
import type { Fx } from './fx';

/** Minimal slice of Game the loop needs, kept narrow to avoid an import cycle. */
export interface Guarded {
  guard(label: string, fn: () => void): void;
}

export interface Stepper {
  /** fixed-rate simulation step, dt is always exactly 1/CONFIG.sim.hz */
  step(dt: number): void;
  /** render-time update (interpolation alpha in [0,1), real dt for visuals) */
  frame(dtReal: number, alpha: number): void;
}

/**
 * Fixed-timestep driver (120 Hz sim) decoupled from render, with
 * interpolation alpha, fx timescale (slow-mo/freeze), and the frame-rate
 * governor: if a 2 s rolling window of frame times misses the 120 fps
 * budget, lock the ticker to 60 for the rest of the session.
 */
export class Loop {
  paused = false;
  stepper: Stepper | null = null;
  /** dev/test fast-forward multiplier (dev overlay + smoke harness) */
  turbo = 1;
  alpha = 0;
  /** live diagnostics for the dev overlay */
  lastFrameMs = 0;
  avgFrameMs = 0;
  capped = false;

  private acc = 0;
  private samples: number[] = [];
  private samplesMs = 0;
  private governorDone = false;
  /** accumulated seconds of unpaused run time — thermal guard reads this */
  playTime = 0;

  constructor(private ticker: Ticker, private fx: Fx, private host: Guarded) {
    ticker.maxFPS = 0; // uncapped: ProMotion gives us 120
    ticker.add(this.tick);
  }

  private tick = (): void => {
    const rawMs = Math.min(this.ticker.deltaMS, CONFIG.sim.maxFrameMs);
    const dtReal = rawMs / 1000;
    this.lastFrameMs = this.ticker.deltaMS;
    this.governor(this.ticker.deltaMS);
    this.fx.update(dtReal);

    const dt = 1 / CONFIG.sim.hz;
    if (!this.paused && this.stepper) {
      this.playTime += dtReal;
      this.acc += dtReal * this.fx.timescale * this.turbo;
      let steps = 0;
      const maxSteps = CONFIG.sim.maxStepsPerFrame * (this.turbo > 1 ? this.turbo : 1);
      this.host.guard('sim', () => {
        while (this.acc >= dt && steps < maxSteps) {
          this.stepper!.step(dt);
          this.acc -= dt;
          steps++;
        }
      });
      if (steps >= maxSteps) this.acc = 0; // hitch: drop debt, never spiral
      this.alpha = this.acc / dt;
    }
    if (this.stepper) this.host.guard('render', () => this.stepper!.frame(dtReal, this.alpha));
  };

  /** rolling 2 s window; one-way degrade to a 60 fps cap */
  private governor(frameMs: number): void {
    if (this.governorDone) return;
    this.samples.push(frameMs);
    this.samplesMs += frameMs;
    while (this.samplesMs > CONFIG.fps.windowMs && this.samples.length > 1) {
      this.samplesMs -= this.samples.shift()!;
    }
    const avg = this.samplesMs / this.samples.length;
    this.avgFrameMs = avg;
    if (this.samplesMs >= CONFIG.fps.windowMs * 0.9 && avg > CONFIG.fps.degradeThresholdMs) {
      this.ticker.maxFPS = CONFIG.fps.fallbackCap;
      this.capped = true;
      this.governorDone = true; // sticky for the session; keeps thermals stable
    }
  }

  /** true once the thermal guard should shrink particle budgets */
  thermalSoften(): boolean {
    return this.playTime > CONFIG.thermal.softenAfterSec;
  }
}
