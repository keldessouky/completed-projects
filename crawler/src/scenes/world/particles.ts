import { Container, Sprite, Texture } from 'pixi.js';
import { CONFIG } from '../../config';
import { Pool } from '../../core/pool';
import type { GameAtlas } from '../../assets/atlas';
import { NumberDisplay } from '../../ui/digits';

interface Particle {
  sp: Sprite;
  x: number; y: number;
  vx: number; vy: number;
  ax: number; ay: number;
  drag: number;
  rot: number; vrot: number;
  life: number; ttl: number;
  s0: number; s1: number;
  a0: number; a1: number;
}

export interface BurstOpts {
  frame: string;
  count: number;
  tint?: number;
  speed?: number;       // outward velocity
  speedVar?: number;
  gravity?: number;
  drag?: number;
  ttl?: number;
  ttlVar?: number;
  s0?: number; s1?: number;
  a0?: number; a1?: number;
  additive?: boolean;
  spreadX?: number; spreadY?: number;
  vx0?: number; vy0?: number; // base drift added to the radial burst
  spin?: number;
}

/**
 * One pooled sprite system for every burst, trail, and mote in the run.
 * Updates in render time (visuals only — never gameplay), honors the global
 * particle budget, the thermal −40 % rule, and reduced-motion (halved counts).
 */
export class Particles extends Container {
  private pool: Pool<Particle>;
  /** effective budget after thermal guard */
  budgetScale = 1;
  reducedMotion = false;

  constructor(atlas: GameAtlas) {
    super();
    const blank = atlas.get('softDot');
    this.pool = new Pool<Particle>(CONFIG.fx.particleBudget, () => {
      const sp = new Sprite(blank);
      sp.anchor.set(0.5);
      sp.visible = false;
      this.addChild(sp);
      return { sp, x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0, drag: 0, rot: 0, vrot: 0, life: 0, ttl: 1, s0: 1, s1: 1, a0: 1, a1: 0 };
    });
    this.atlasRef = atlas;
  }
  private atlasRef: GameAtlas;

  get liveCount(): number { return this.pool.count; }

  burst(x: number, y: number, o: BurstOpts): void {
    let n = Math.round(o.count * this.budgetScale * (this.reducedMotion ? 0.5 : 1));
    const tex: Texture = this.atlasRef.get(o.frame);
    while (n-- > 0) {
      if (this.pool.count >= this.pool.capacity * this.budgetScale) return; // budget wall
      const p = this.pool.obtain();
      if (!p) return;
      const ang = Math.random() * Math.PI * 2;
      const spd = (o.speed ?? 120) + (Math.random() - 0.5) * 2 * (o.speedVar ?? 60);
      p.x = x + (Math.random() - 0.5) * (o.spreadX ?? 0);
      p.y = y + (Math.random() - 0.5) * (o.spreadY ?? 0);
      p.vx = Math.cos(ang) * spd + (o.vx0 ?? 0);
      p.vy = Math.sin(ang) * spd + (o.vy0 ?? 0);
      p.ax = 0;
      p.ay = o.gravity ?? 0;
      p.drag = o.drag ?? 0;
      p.rot = Math.random() * Math.PI * 2;
      p.vrot = (Math.random() - 0.5) * (o.spin ?? 6);
      p.ttl = (o.ttl ?? 0.5) + Math.random() * (o.ttlVar ?? 0.2);
      p.life = 0;
      p.s0 = o.s0 ?? 1; p.s1 = o.s1 ?? 0.2;
      p.a0 = o.a0 ?? 1; p.a1 = o.a1 ?? 0;
      p.sp.texture = tex;
      p.sp.tint = o.tint ?? 0xffffff;
      p.sp.blendMode = o.additive ? 'add' : 'normal';
      p.sp.visible = true;
    }
  }

  /** single mote drifting (arrow glyph trails) */
  mote(x: number, y: number, frame: string, tint: number, vy: number, ttl: number, scale: number): void {
    if (this.pool.count >= this.pool.capacity * this.budgetScale) return;
    const p = this.pool.obtain();
    if (!p) return;
    p.x = x; p.y = y;
    p.vx = (Math.random() - 0.5) * 14; p.vy = vy;
    p.ax = 0; p.ay = 0; p.drag = 0;
    p.rot = 0; p.vrot = (Math.random() - 0.5) * 2;
    p.ttl = ttl; p.life = 0;
    p.s0 = scale; p.s1 = scale * 0.4;
    p.a0 = 0.85; p.a1 = 0;
    p.sp.texture = this.atlasRef.get(frame);
    p.sp.tint = tint;
    p.sp.blendMode = 'add';
    p.sp.visible = true;
  }

  update(dt: number): void {
    const items = this.pool.items;
    for (let i = this.pool.count - 1; i >= 0; i--) {
      const p = items[i];
      p.life += dt;
      if (p.life >= p.ttl) {
        p.sp.visible = false;
        this.pool.release(i);
        continue;
      }
      const t = p.life / p.ttl;
      p.vx += p.ax * dt; p.vy += p.ay * dt;
      if (p.drag > 0) { const d = Math.max(0, 1 - p.drag * dt); p.vx *= d; p.vy *= d; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vrot * dt;
      p.sp.position.set(p.x, p.y);
      p.sp.rotation = p.rot;
      const s = p.s0 + (p.s1 - p.s0) * t;
      p.sp.scale.set(s);
      p.sp.alpha = p.a0 + (p.a1 - p.a0) * t;
    }
  }

  clear(): void {
    const items = this.pool.items;
    for (let i = 0; i < this.pool.count; i++) items[i].sp.visible = false;
    this.pool.releaseAll();
  }
}

interface Pop {
  view: NumberDisplay;
  x: number; y: number;
  vy: number;
  life: number; ttl: number;
  big: boolean;
}

/** Chunky pooled damage/gain numerals: pop in with overshoot, drift up, fade. */
export class NumberPops extends Container {
  private pool: Pool<Pop>;

  constructor(atlas: GameAtlas) {
    super();
    this.pool = new Pool<Pop>(CONFIG.fx.damageNumberCap, () => {
      const view = new NumberDisplay(atlas, 6, 1, 0xffffff);
      view.visible = false;
      this.addChild(view);
      return { view, x: 0, y: 0, vy: 0, life: 0, ttl: 1, big: false };
    });
  }

  spawn(x: number, y: number, text: string, tint: number, big = false): void {
    const p = this.pool.obtain();
    if (!p) return; // cap reached: the oldest keep playing; new hits skip cleanly
    p.view.set(text);
    p.view.tint = tint;
    p.view.visible = true;
    p.x = x; p.y = y;
    p.vy = big ? -66 : -46;
    p.life = 0;
    p.ttl = CONFIG.fx.damageNumberMs / 1000;
    p.big = big;
  }

  update(dt: number): void {
    const items = this.pool.items;
    for (let i = this.pool.count - 1; i >= 0; i--) {
      const p = items[i];
      p.life += dt;
      if (p.life >= p.ttl) {
        p.view.visible = false;
        this.pool.release(i);
        continue;
      }
      const t = p.life / p.ttl;
      p.y += p.vy * dt;
      p.vy *= 1 - 1.6 * dt;
      // overshoot pop: 0→1.15→settle, then shrink out
      // sized against a 44 px character, not a full-width HUD
      // Sized against the reference: damage numbers are one of the loudest
      // things on its screen, not a footnote beside a 44 px character.
      const base = p.big ? 0.72 : 0.5;
      const pop = t < 0.18 ? (t / 0.18) * 1.18 : t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1.18 - 0.18 * ((t - 0.18) / 0.52);
      p.view.position.set(p.x, p.y);
      p.view.scale.set(base * Math.max(0.01, pop));
      p.view.alpha = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
    }
  }

  get liveCount(): number { return this.pool.count; }

  clear(): void {
    const items = this.pool.items;
    for (let i = 0; i < this.pool.count; i++) items[i].view.visible = false;
    this.pool.releaseAll();
  }
}
