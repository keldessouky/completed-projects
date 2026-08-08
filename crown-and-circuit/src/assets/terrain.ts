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
const TILE = 64;                 // art pixels
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

function tileFor(era: number): Texture {
  const pal = CONFIG.palettes[era];
  const r = rng(9001 + era * 7717);
  const g = ramp(pal.ground, -0.18, 0.14);
  const alt = ramp(pal.groundAlt, -0.18, 0.14);
  const p = new Px(TILE, TILE);

  p.rect(0, 0, TILE, TILE, g.base);

  // soft patches of the alternate tone, wrapped
  for (let i = 0; i < 22; i++) {
    const cx = r() * TILE;
    const cy = r() * TILE;
    const rx = 3 + r() * 9;
    const ry = 3 + r() * 8;
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) wset(p, x, y, alt.base);
      }
    }
  }
  // dithered speckle to break up flat areas
  for (let i = 0; i < 260; i++) wset(p, r() * TILE, r() * TILE, g.dark);
  for (let i = 0; i < 120; i++) wset(p, r() * TILE, r() * TILE, g.light);

  if (era === 0) {                          // turf: grass blades
    const blade = shift(pal.accent2, -0.2);
    for (let i = 0; i < 90; i++) {
      const x = r() * TILE;
      const y = r() * TILE;
      wset(p, x, y, blade);
      wset(p, x, y - 1, shift(blade, 0.2));
      if (r() < 0.4) wset(p, x + 1, y - 1, blade);
    }
  } else if (era === 1) {                   // mud: cart ruts
    for (let i = 0; i < 5; i++) {
      const y0 = r() * TILE;
      for (let x = 0; x < TILE; x++) {
        const y = y0 + Math.sin((x / TILE) * Math.PI * 2 + i) * 3;
        wset(p, x, y, alt.dark);
        wset(p, x, y + 1, shift(pal.groundAlt, -0.34));
        wset(p, x, y + 4, alt.dark);
      }
    }
  } else if (era === 2) {                   // iron plate: seams and rivets
    const seam = shift(pal.ground, -0.45);
    const rivet = shift(pal.stone, -0.1);
    for (let k = 0; k <= 1; k++) {
      const v = k * 32;
      for (let i = 0; i < TILE; i++) { wset(p, v, i, seam); wset(p, i, v, seam); }
    }
    for (let gy = 0; gy < 2; gy++) {
      for (let gx = 0; gx < 2; gx++) {
        for (const [ox, oy] of [[4, 4], [27, 4], [4, 27], [27, 27]]) {
          wset(p, gx * 32 + ox, gy * 32 + oy, rivet);
        }
      }
    }
  } else if (era === 3) {                   // concrete: slabs and cracks
    const seam = shift(pal.ground, -0.4);
    for (let i = 0; i < TILE; i++) { wset(p, 0, i, seam); wset(p, i, 0, seam); wset(p, 32, i, seam); wset(p, i, 32, seam); }
    for (let i = 0; i < 7; i++) {
      let x = r() * TILE;
      let y = r() * TILE;
      for (let k = 0; k < 10; k++) {
        wset(p, x, y, seam);
        x += Math.round(r() * 2 - 1);
        y += Math.round(r() * 2 - 1);
      }
    }
  } else {                                  // neon: grid over black glass
    const grid = shift(pal.accent, -0.55);
    for (let i = 0; i < TILE; i++) {
      for (const v of [0, 16, 32, 48]) { wset(p, v, i, grid); wset(p, i, v, grid); }
    }
    for (let i = 0; i < 10; i++) {
      const gx = Math.floor(r() * 4) * 16;
      const gy = Math.floor(r() * 4) * 16;
      wset(p, gx, gy, pal.accent);
      wset(p, gx + 1, gy, shift(pal.accent, -0.3));
      wset(p, gx, gy + 1, shift(pal.accent, -0.3));
    }
    for (let i = 0; i < 6; i++) {
      const x = Math.floor(r() * 4) * 16;
      const y0 = r() * TILE;
      for (let k = 0; k < 6; k++) wset(p, x, y0 + k, shift(pal.accent2, -0.35));
    }
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
