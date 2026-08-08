/**
 * A tiny pixel-art toolkit.
 *
 * Everything in the game is authored on an integer pixel grid with a limited
 * palette, hard 1px outlines and top-left lighting — the GBA sprite grammar —
 * then blitted into the atlas with nearest-neighbour scaling so it stays crisp
 * instead of turning to mush.
 */

/** transparent sentinel */
export const T = -1;

export class Px {
  buf: Int32Array;

  constructor(readonly w: number, readonly h: number) {
    this.buf = new Int32Array(w * h).fill(T);
  }

  set(x: number, y: number, c: number): void {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || c === T) return;
    this.buf[y * this.w + x] = c;
  }

  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return T;
    return this.buf[y * this.w + x];
  }

  rect(x: number, y: number, w: number, h: number, c: number): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }

  /** filled ellipse, pixel-exact */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: number): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / Math.max(0.001, rx);
        const dy = (y - cy) / Math.max(0.001, ry);
        if (dx * dx + dy * dy <= 1.02) this.set(x, y, c);
      }
    }
  }

  /** Bresenham line */
  line(x0: number, y0: number, x1: number, y1: number, c: number): void {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  /** Replace one colour with another (era recolours, flash frames). */
  swap(from: number, to: number): void {
    for (let i = 0; i < this.buf.length; i++) if (this.buf[i] === from) this.buf[i] = to;
  }

  /**
   * Dilate a 1px outline around every opaque region. The single biggest
   * contributor to sprites reading as sprites rather than shapes.
   */
  outline(c: number): void {
    const copy = this.buf.slice();
    const solid = (x: number, y: number): boolean =>
      x >= 0 && y >= 0 && x < this.w && y < this.h && copy[y * this.w + x] !== T;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (copy[y * this.w + x] !== T) continue;
        if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
          this.buf[y * this.w + x] = c;
        }
      }
    }
  }

  /**
   * Add a lit rim on top and a shadow underneath within each column, which is
   * what sells volume on a flat palette.
   */
  shade(light: number, dark: number, body: number): void {
    for (let x = 0; x < this.w; x++) {
      let first = -1;
      let last = -1;
      for (let y = 0; y < this.h; y++) {
        if (this.get(x, y) === body) { if (first < 0) first = y; last = y; }
      }
      if (first >= 0 && last > first) {
        this.set(x, first, light);
        this.set(x, last, dark);
      }
    }
  }

  /** ordered dither between two colours over a rect — cheap texture */
  dither(x: number, y: number, w: number, h: number, c: number, density = 2): void {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        if (((i + j) % density) === 0) this.set(x + i, y + j, c);
      }
    }
  }

  /** Paint into a 2D context at an integer scale, no smoothing. */
  blit(ctx: CanvasRenderingContext2D, scale: number): void {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const c = this.buf[y * this.w + x];
        if (c === T) continue;
        ctx.fillStyle = '#' + (c >>> 0).toString(16).padStart(6, '0');
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }
}

// ---------------------------------------------------------------- colour

const clamp255 = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));

export function shift(hex: number, amount: number): number {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  const f = amount >= 0 ? amount : amount;
  const mix = (v: number): number =>
    f >= 0 ? clamp255(v + (255 - v) * f) : clamp255(v * (1 + f));
  return (mix(r) << 16) | (mix(g) << 8) | mix(b);
}

/** A three-tone material ramp: shadow, base, highlight. */
export interface Ramp { dark: number; base: number; light: number }

export function ramp(hex: number, dark = -0.34, light = 0.28): Ramp {
  return { dark: shift(hex, dark), base: hex, light: shift(hex, light) };
}

/** Near-black outline tinted toward the material, which reads warmer than pure black. */
export function outlineOf(hex: number): number {
  return shift(hex, -0.72);
}
