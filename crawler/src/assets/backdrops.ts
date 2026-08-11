import { Texture } from 'pixi.js';
import { CONFIG } from '../config';

/**
 * Per-floor parallax scenery, painted once at boot:
 *  - sky:  the vanishing point ahead of you (this is a tunnel, not a horizon)
 *  - far:  seamless 440×512 silhouette strip (slow scroll)
 *  - near: seamless 440×512 wall-detail strip (full scroll speed)
 *  - lane: 440×128 floor tile under the runner
 *
 * Only floor 1 is built. When floors 2+ land these must become LAZY — painting
 * eighteen themes at boot would blow the loading screen out, and the player
 * only ever needs the one they are standing on.
 */
export interface FloorArt {
  sky: Texture;
  far: Texture;
  near: Texture;
  lane: Texture;
  fogColor: number;
}

/** Kept as an alias so engine code that predates floors still compiles. */
export type ChapterArt = FloorArt;

const W = CONFIG.design.width;
const STRIP_H = 512;
const LANE_H = 128;

function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): Texture {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d')!;
  draw(c);
  return Texture.from(cv);
}

function sky(stops: [number, string][]): Texture {
  return canvasTex(16, 512, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 512);
    for (const [at, col] of stops) g.addColorStop(at, col);
    c.fillStyle = g;
    c.fillRect(0, 0, 16, 512);
  });
}

/** deterministic per-floor rng so strips tile identically every boot */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** A run of pipe with its brackets, along one wall. */
function pipeRun(
  c: CanvasRenderingContext2D, x: number, y0: number, len: number, w: number, col: string,
): void {
  c.fillStyle = col;
  c.fillRect(x, y0, w, len);
  c.fillStyle = 'rgba(255,255,255,0.10)';
  c.fillRect(x, y0, w * 0.34, len);
  c.fillStyle = 'rgba(0,0,0,0.35)';
  for (let y = y0 + 26; y < y0 + len; y += 78) c.fillRect(x - 2, y, w + 4, 5);
}

// Strips tile VERTICALLY (the scroll axis), so every painter below keeps its
// elements clear of the top/bottom edges — a crossing element would pop at the seam.

/**
 * Floor 1 — the basement. Poured concrete, sodium emergency lighting, and
 * service infrastructure that was never meant to be walked through.
 */
function buildBasement(): FloorArt {
  const r = rng(1101);

  const far = canvasTex(W, STRIP_H, (c) => {
    // support ribs receding down the tunnel
    for (let i = 0; i < 6; i++) {
      const y = 42 + i * 84;
      const inset = 40 + (i % 3) * 8;
      c.fillStyle = i % 2 ? 'rgba(36,36,42,0.75)' : 'rgba(28,28,34,0.68)';
      c.fillRect(inset, y, W - inset * 2, 22);
      // the rib legs
      c.fillRect(inset, y, 14, 60);
      c.fillRect(W - inset - 14, y, 14, 60);
    }
    // ductwork crossing the ceiling
    for (let i = 0; i < 4; i++) {
      const y = 96 + i * 128 + r() * 20;
      c.fillStyle = 'rgba(58,58,60,0.6)';
      c.fillRect(70, y, W - 140, 13);
      c.fillStyle = 'rgba(0,0,0,0.3)';
      for (let x = 74; x < W - 70; x += 17) c.fillRect(x, y, 2, 13);
    }
    // a caged bulb every so often: the only light down here
    for (let i = 0; i < 5; i++) {
      const x = 60 + r() * (W - 120);
      const y = 60 + i * 100 + r() * 30;
      const g = c.createRadialGradient(x, y, 1, x, y, 40);
      g.addColorStop(0, 'rgba(217,164,65,0.55)');
      g.addColorStop(1, 'rgba(217,164,65,0)');
      c.fillStyle = g;
      c.beginPath(); c.arc(x, y, 40, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(240,194,104,0.9)';
      c.beginPath(); c.arc(x, y, 4.5, 0, Math.PI * 2); c.fill();
    }
  });

  const near = canvasTex(W, STRIP_H, (c) => {
    // both walls, hugging the lane edges
    for (const side of [0, 1]) {
      const x0 = side === 0 ? 0 : W - 62;
      c.fillStyle = 'rgba(20,20,25,0.92)';
      c.fillRect(x0, 0, 62, STRIP_H);
      // concrete form-board lines
      c.fillStyle = 'rgba(255,255,255,0.045)';
      for (let y = 0; y < STRIP_H; y += 46) c.fillRect(x0, y, 62, 2);
      // conduit + pipe runs
      pipeRun(c, x0 + (side === 0 ? 40 : 8), 0, STRIP_H, 9, 'rgba(109,54,24,0.85)');
      pipeRun(c, x0 + (side === 0 ? 26 : 26), 0, STRIP_H, 5, 'rgba(92,97,103,0.8)');
    }
    // wall boxes and stencilled marks, alternating sides
    for (let i = 0; i < 9; i++) {
      const side = i % 2 === 0;
      const x = side ? 8 : W - 30;
      const y = 30 + i * 56 + r() * 14;
      c.fillStyle = 'rgba(92,97,103,0.9)';
      c.fillRect(x, y, 16, 20);
      c.fillStyle = 'rgba(47,122,217,0.75)';
      c.fillRect(x + 3, y + 4, 10, 4);
      if (i % 3 === 0) {
        c.fillStyle = 'rgba(230,227,221,0.16)';
        c.fillRect(x - 2, y + 28, 20, 3);
        c.fillRect(x - 2, y + 34, 13, 3);
      }
    }
  });

  const lane = canvasTex(W, LANE_H, (c) => {
    c.fillStyle = '#1a1a1f';
    c.fillRect(0, 0, W, LANE_H);
    // slab joints — the thing that actually sells the scroll
    c.fillStyle = 'rgba(0,0,0,0.45)';
    c.fillRect(0, 0, W, 4);
    c.fillStyle = 'rgba(230,227,221,0.05)';
    c.fillRect(0, 4, W, 2);
    // a drainage channel down the centre line
    c.fillStyle = 'rgba(0,0,0,0.5)';
    c.fillRect(W / 2 - 13, 0, 26, LANE_H);
    c.fillStyle = 'rgba(92,97,103,0.28)';
    for (let y = 8; y < LANE_H; y += 24) c.fillRect(W / 2 - 13, y, 26, 3);
    // aggregate speckle and old stains
    for (let i = 0; i < 60; i++) {
      c.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.3)';
      c.fillRect(r() * W, r() * LANE_H, 2 + r() * 3, 2);
    }
    c.fillStyle = 'rgba(109,54,24,0.10)';
    for (let i = 0; i < 5; i++) {
      c.beginPath();
      c.ellipse(r() * W, r() * LANE_H, 20 + r() * 26, 7, 0, 0, Math.PI * 2);
      c.fill();
    }
  });

  return {
    // dark ahead, with the sodium glow bleeding up from the lit stretch you are in
    sky: sky([[0, '#07080a'], [0.55, '#101116'], [1, '#241b12']]),
    far, near, lane,
    fogColor: 0x101116,
  };
}

export function buildBackdrops(): FloorArt[] {
  return [buildBasement()];
}
