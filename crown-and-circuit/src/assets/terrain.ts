import { Texture } from 'pixi.js';
import { CONFIG } from '../config';
import { Px, ramp, shift } from './pixel';
import { PX } from './atlas';

/**
 * One seamless pixel-art ground tile per era, authored on the same art grid as
 * the sprites so the world reads as a single style. The tile carries the era's
 * mood — turf, churned mud, riveted iron, cracked concrete, black glass under a
 * neon grid — and wraps cleanly because every feature is drawn modulo the tile.
 */
// 128 art pixels = 256 world units per tile. The old tile was half this and
// its repeat was plainly visible as wallpaper; doubling the period, plus
// large-scale patches that cross the whole tile, is what stops the eye locking
// onto the grid.
const TILE = 128;                // art pixels
const WORLD_TILE = TILE * PX;    // world units per tile

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** wrap-safe plot */
function wset(p: Px, x: number, y: number, c: number): void {
  p.set(((x % TILE) + TILE) % TILE, ((y % TILE) + TILE) % TILE, c);
}

/** wrap-safe filled ellipse */
function wblob(p: Px, cx: number, cy: number, rx: number, ry: number, c: number, jitter = 0): void {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const d = dx * dx + dy * dy;
      if (d <= 1 - jitter || (d <= 1 + jitter && ((x + y) & 1) === 0)) wset(p, x, y, c);
    }
  }
}

/**
 * Seamless value noise on the tile's own torus. Sampling a lattice that wraps
 * modulo `period` means the noise is continuous across the tile edge, so the
 * large-scale variation can cross the seam instead of stopping at it.
 */
function wrapNoise(seed: number, period: number): (x: number, y: number) => number {
  const r = rng(seed);
  const lat: number[] = [];
  for (let i = 0; i < period * period; i++) lat.push(r());
  const at = (i: number, j: number): number =>
    lat[(((j % period) + period) % period) * period + (((i % period) + period) % period)];
  const smooth = (t: number): number => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = (x / TILE) * period;
    const fy = (y / TILE) * period;
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const sx = smooth(fx - i);
    const sy = smooth(fy - j);
    const a = at(i, j) + (at(i + 1, j) - at(i, j)) * sx;
    const b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * sx;
    return a + (b - a) * sy;
  };
}

/** A tuft of grass: a few blades of different heights from one root. */
function tuft(p: Px, x: number, y: number, base: number, r: () => number): void {
  const lit = shift(base, 0.26);
  const dk = shift(base, -0.22);
  const n = 2 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const bx = x + i - (n >> 1);
    const h = 2 + Math.floor(r() * 3);
    for (let k = 0; k < h; k++) wset(p, bx, y - k, k === h - 1 ? lit : base);
    wset(p, bx, y + 1, dk);
  }
}

/** A pebble: lit crown, dark underside, so it sits on the ground not in it. */
function pebble(p: Px, x: number, y: number, c: number, big: boolean): void {
  const w = big ? 4 : 2;
  const h = big ? 3 : 2;
  wblob(p, x, y, w / 2, h / 2, c);
  wset(p, x - 1, y - 1, shift(c, 0.3));
  if (big) wset(p, x, y - 1, shift(c, 0.22));
  for (let i = -w / 2; i <= w / 2; i++) wset(p, x + i, y + Math.ceil(h / 2), shift(c, -0.5));
}



function tileFor(era: number): Texture {
  const pal = CONFIG.palettes[era];
  const r = rng(9001 + era * 7717);
  // Low contrast on purpose. Ground is backdrop: every extra tone it spends is
  // one the characters standing on it have to fight, and the first pass of this
  // tile lost units in the noise.
  const g = ramp(pal.ground, -0.10, 0.08);
  const alt = ramp(pal.groundAlt, -0.09, 0.07);
  const p = new Px(TILE, TILE);

  // ---- base: two octaves of wrapped noise rather than a flat fill, so the
  // ground already has slow variation before anything is scattered on it
  const n1 = wrapNoise(era * 131 + 7, 4);
  const n2 = wrapNoise(era * 131 + 23, 11);
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const v = n1(x, y) * 0.68 + n2(x, y) * 0.32;
      p.set(x, y, v > 0.70 ? g.light : v < 0.30 ? g.dark : g.base);
    }
  }

  // ---- broad patches of the alternate material, edges dithered so they read
  // as worn ground rather than as stickers
  // three, large and soft. Six smaller ones read as a field of discrete pods,
  // which is the repetition the bigger tile was meant to hide
  for (let i = 0; i < 3; i++) {
    const cx = r() * TILE;
    const cy = r() * TILE;
    const rx = 26 + r() * 30;
    const ry = 22 + r() * 26;
    wblob(p, cx, cy, rx, ry, alt.base, 0.34);
    wblob(p, cx - rx * 0.22, cy - ry * 0.22, rx * 0.5, ry * 0.45, alt.light, 0.4);
  }

  if (era === 0) {                          // meadow: tufts, clover, stones
    for (let i = 0; i < 46; i++) tuft(p, r() * TILE, r() * TILE, shift(pal.accent2, -0.3 - r() * 0.24), r);
    for (let i = 0; i < 9; i++) {           // flower clusters
      const cx = r() * TILE;
      const cy = r() * TILE;
      const petal = r() < 0.5 ? 0xe8d8a0 : 0xd8a0b8;
      for (let k = 0; k < 3 + r() * 3; k++) {
        const x = cx + (r() - 0.5) * 7;
        const y = cy + (r() - 0.5) * 6;
        wset(p, x, y, petal);
        wset(p, x, y + 1, shift(petal, -0.4));
      }
    }
    for (let i = 0; i < 11; i++) pebble(p, r() * TILE, r() * TILE, shift(pal.stone, -0.26), r() < 0.3);
  } else if (era === 1) {                   // churned mud: ruts, puddles, splash
    for (let i = 0; i < 7; i++) {
      const y0 = r() * TILE;
      const amp = 3 + r() * 5;
      for (let x = 0; x < TILE; x++) {
        const y = y0 + Math.sin((x / TILE) * Math.PI * 2 * (1 + (i & 1)) + i) * amp;
        wset(p, x, y, alt.dark);
        wset(p, x, y + 1, shift(pal.groundAlt, -0.4));
        wset(p, x, y + 2, alt.base);
        wset(p, x, y + 6, alt.dark);
      }
    }
    for (let i = 0; i < 12; i++) {          // standing water
      const cx = r() * TILE;
      const cy = r() * TILE;
      wblob(p, cx, cy, 3 + r() * 6, 2 + r() * 4, shift(pal.groundAlt, -0.55), 0.25);
      wset(p, cx - 1, cy - 1, shift(pal.ground, 0.34));
    }
    for (let i = 0; i < 14; i++) pebble(p, r() * TILE, r() * TILE, shift(pal.stone, -0.34), r() < 0.28);
  } else if (era === 2) {                   // iron plate: seams, rivets, rust
    const seam = shift(pal.ground, -0.5);
    for (const v of [0, 42, 85]) {
      for (let i = 0; i < TILE; i++) {
        wset(p, v, i, seam); wset(p, v + 1, i, shift(pal.ground, 0.14));
        wset(p, i, v, seam); wset(p, i, v + 1, shift(pal.ground, 0.14));
      }
    }
    for (let gy = 0; gy < 3; gy++) {
      for (let gx = 0; gx < 3; gx++) {
        for (const [ox, oy] of [[5, 5], [37, 5], [5, 37], [37, 37]]) {
          const x = gx * 42 + ox;
          const y = gy * 42 + oy;
          wset(p, x, y, shift(pal.stone, 0.1));
          wset(p, x + 1, y + 1, shift(pal.stone, -0.45));
        }
      }
    }
    for (let i = 0; i < 9; i++) {           // rust blooms
      const cx = r() * TILE;
      const cy = r() * TILE;
      wblob(p, cx, cy, 2 + r() * 5, 2 + r() * 4, 0x6d3c22, 0.45);
      wblob(p, cx, cy, 1 + r() * 2, 1 + r() * 2, 0x83492a, 0.45);
    }
  } else if (era === 3) {                   // concrete: slabs, cracks, stains
    const seam = shift(pal.ground, -0.42);
    for (const v of [0, 64]) {
      for (let i = 0; i < TILE; i++) { wset(p, v, i, seam); wset(p, i, v, seam); }
    }
    for (let i = 0; i < 9; i++) {           // branching cracks
      let x = r() * TILE;
      let y = r() * TILE;
      let a = r() * Math.PI * 2;
      for (let k = 0; k < 22; k++) {
        wset(p, x, y, seam);
        if (r() < 0.25) wset(p, x + 1, y, shift(pal.ground, 0.1));
        a += (r() - 0.5) * 0.9;
        x += Math.cos(a) * 1.4;
        y += Math.sin(a) * 1.4;
      }
    }
    for (let i = 0; i < 10; i++) wblob(p, r() * TILE, r() * TILE, 4 + r() * 9, 3 + r() * 7, shift(pal.ground, -0.16), 0.35);
    for (let i = 0; i < 12; i++) pebble(p, r() * TILE, r() * TILE, shift(pal.stone, -0.38), false);
  } else {                                  // neon: black glass, grid, glow
    const grid = shift(pal.accent, -0.62);
    for (let i = 0; i < TILE; i++) {
      for (const v of [0, 32, 64, 96]) { wset(p, v, i, grid); wset(p, i, v, grid); }
    }
    for (let i = 0; i < 14; i++) {          // lit nodes at grid intersections
      const gx = Math.floor(r() * 4) * 32;
      const gy = Math.floor(r() * 4) * 32;
      wset(p, gx, gy, shift(pal.accent, 0.5));
      wset(p, gx + 1, gy, pal.accent);
      wset(p, gx - 1, gy, pal.accent);
      wset(p, gx, gy + 1, pal.accent);
      wset(p, gx, gy - 1, pal.accent);
    }
    for (let i = 0; i < 14; i++) {          // data runs along the grid lines
      const along = r() < 0.5;
      const v = Math.floor(r() * 4) * 32;
      const t0 = r() * TILE;
      const len = 8 + r() * 22;
      for (let k = 0; k < len; k++) {
        const c = shift(pal.accent2, k < 3 || k > len - 4 ? -0.5 : -0.15);
        if (along) wset(p, t0 + k, v, c); else wset(p, v, t0 + k, c);
      }
    }
    for (let i = 0; i < 10; i++) wblob(p, r() * TILE, r() * TILE, 3 + r() * 7, 2 + r() * 5, shift(pal.ground, 0.1), 0.4);
  }

  const cv = document.createElement('canvas');
  cv.width = cv.height = WORLD_TILE;
  const c = cv.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  p.blit(c, PX);
  const tex = Texture.from(cv);
  tex.source.scaleMode = 'nearest';
  return tex;
}

export function buildTerrain(): Texture[] {
  const out: Texture[] = [];
  for (let e = 0; e < CONFIG.palettes.length; e++) out.push(tileFor(e));
  return out;
}
