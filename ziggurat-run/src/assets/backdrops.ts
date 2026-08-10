import { Texture } from 'pixi.js';
import { CONFIG } from '../config';

/**
 * Per-chapter parallax scenery, painted once at boot:
 *  - sky: small vertical gradient, stretched full-bleed
 *  - far: seamless 440×512 silhouette strip (slow scroll)
 *  - near: seamless 440×512 flank detail strip (full scroll speed)
 *  - lane: 440×128 paving tile under the runner
 * Chapters: alluvial marsh → open steppe → the city of walls.
 */
export interface ChapterArt {
  sky: Texture;
  far: Texture;
  near: Texture;
  lane: Texture;
  fogColor: number;
}

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

/** deterministic per-chapter rng so strips tile identically every boot */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function reeds(c: CanvasRenderingContext2D, r: () => number, y0: number, n: number, hMin: number, hMax: number, col: string): void {
  c.strokeStyle = col;
  for (let i = 0; i < n; i++) {
    const x = r() * W;
    const h = hMin + r() * (hMax - hMin);
    const lean = (r() - 0.5) * 14;
    c.lineWidth = 1.6 + r() * 1.4;
    c.beginPath();
    c.moveTo(x, y0);
    c.quadraticCurveTo(x + lean * 0.4, y0 - h * 0.6, x + lean, y0 - h);
    c.stroke();
    // seed head
    c.beginPath();
    c.moveTo(x + lean, y0 - h);
    c.lineTo(x + lean + (lean >= 0 ? 5 : -5), y0 - h - 7);
    c.lineWidth = 3;
    c.stroke();
  }
}

// Strips tile VERTICALLY (the scroll axis), so every painter below keeps its
// elements clear of the top/bottom edges — a crossing element would pop at the seam.

function buildMarsh(): ChapterArt {
  const r = rng(101);
  const far = canvasTex(W, STRIP_H, (c) => {
    // slack water bands
    for (let i = 0; i < 7; i++) {
      const y = 30 + i * 70 + r() * 22;
      c.fillStyle = i % 2 ? 'rgba(31,59,86,0.5)' : 'rgba(24,74,80,0.42)';
      c.beginPath();
      c.ellipse(r() * W, y, 90 + r() * 130, 10 + r() * 8, 0, 0, Math.PI * 2);
      c.fill();
    }
    for (let i = 0; i < 5; i++) reeds(c, r, 80 + i * 90, 9, 26, 54, 'rgba(16,42,46,0.85)');
  });
  const near = canvasTex(W, STRIP_H, (c) => {
    // tall reed clusters hugging both banks
    for (let band = 0; band < 4; band++) {
      const y = 130 + band * 96;
      c.save(); c.translate(-6, 0);
      reeds(c, r, y, 5, 60, 110, 'rgba(12,34,36,0.95)');
      c.restore();
      c.save(); c.translate(W * 0.82, 0);
      reeds(c, r, y + 40, 5, 60, 110, 'rgba(12,34,36,0.95)');
      c.restore();
    }
  });
  const lane = canvasTex(W, LANE_H, (c) => {
    c.fillStyle = '#1c2f33';
    c.fillRect(0, 0, W, LANE_H);
    c.fillStyle = 'rgba(237,227,210,0.05)';
    for (let i = 0; i < 5; i++) c.fillRect(30 + i * 85, 0, 2, LANE_H);
    c.fillStyle = 'rgba(0,0,0,0.22)';
    c.fillRect(0, 0, W, 3); // course line so scroll reads
    c.fillStyle = 'rgba(47,143,131,0.12)';
    for (let i = 0; i < 8; i++) {
      c.beginPath();
      c.ellipse(r() * W, r() * LANE_H, 26, 5, 0, 0, Math.PI * 2);
      c.fill();
    }
  });
  return { sky: sky([[0, '#0c1c3d'], [0.55, '#123452'], [1, '#1d5a5a']]), far, near, lane, fogColor: 0x123452 };
}

function buildSteppe(): ChapterArt {
  const r = rng(202);
  const far = canvasTex(W, STRIP_H, (c) => {
    for (let i = 0; i < 6; i++) {
      const y = 50 + i * 82;
      c.fillStyle = i % 2 ? 'rgba(156,90,40,0.30)' : 'rgba(201,123,60,0.24)';
      c.beginPath();
      c.moveTo(-20, y + 26);
      for (let x = 0; x <= W + 20; x += 40) c.quadraticCurveTo(x + 20, y - 12 + r() * 22, x + 40, y + 10 + r() * 10);
      c.lineTo(W + 20, y + 44);
      c.lineTo(-20, y + 44);
      c.fill();
    }
    // lone terebinth trees
    for (let i = 0; i < 6; i++) {
      const x = r() * W, y = 60 + r() * 400;
      c.strokeStyle = 'rgba(60,34,18,0.8)'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + 3, y - 18); c.stroke();
      c.fillStyle = 'rgba(87,84,40,0.75)';
      c.beginPath(); c.ellipse(x + 4, y - 24, 14, 7, 0, 0, Math.PI * 2); c.fill();
    }
  });
  const near = canvasTex(W, STRIP_H, (c) => {
    for (let i = 0; i < 26; i++) {
      const side = r() < 0.5;
      const x = side ? r() * 74 : W - 74 + r() * 74;
      const y = 26 + r() * (STRIP_H - 60);
      c.fillStyle = 'rgba(64,40,22,0.85)';
      c.beginPath();
      c.ellipse(x, y, 7 + r() * 14, 5 + r() * 8, r(), 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(120,120,60,0.5)';
      for (let t = 0; t < 4; t++) c.fillRect(x - 8 + r() * 16, y - 10 - r() * 6, 1.6, 8);
    }
  });
  const lane = canvasTex(W, LANE_H, (c) => {
    c.fillStyle = '#33251a';
    c.fillRect(0, 0, W, LANE_H);
    c.fillStyle = 'rgba(237,227,210,0.06)';
    for (let i = 0; i < 5; i++) c.fillRect(30 + i * 85, 0, 2, LANE_H);
    c.fillStyle = 'rgba(0,0,0,0.2)';
    c.fillRect(0, 0, W, 3);
    c.fillStyle = 'rgba(217,164,65,0.07)';
    for (let i = 0; i < 10; i++) c.fillRect(r() * W, r() * LANE_H, 14 + r() * 20, 3);
  });
  return { sky: sky([[0, '#301d3f'], [0.5, '#7c3f2c'], [1, '#c97b3c']]), far, near, lane, fogColor: 0x7c3f2c };
}

function buildCity(): ChapterArt {
  const r = rng(303);
  const far = canvasTex(W, STRIP_H, (c) => {
    // processional walls with crenellations, stacked ziggurat silhouettes
    for (let row = 0; row < 3; row++) {
      const y = 90 + row * 150;
      c.fillStyle = row % 2 ? 'rgba(18,42,102,0.55)' : 'rgba(27,59,143,0.42)';
      c.fillRect(0, y, W, 44);
      for (let x = 0; x < W; x += 26) c.fillRect(x, y - 9, 14, 9);
      // gate notches
      for (let g = 0; g < 3; g++) {
        const gx = 40 + g * 150 + r() * 60;
        c.clearRect(gx, y + 16, 22, 28);
      }
    }
    for (let i = 0; i < 4; i++) {
      const x = r() * W, y = 60 + r() * 400, s = 0.5 + r() * 0.7;
      c.fillStyle = 'rgba(20,16,14,0.8)';
      c.fillRect(x - 40 * s, y, 80 * s, 18 * s);
      c.fillRect(x - 28 * s, y - 14 * s, 56 * s, 15 * s);
      c.fillRect(x - 15 * s, y - 26 * s, 30 * s, 13 * s);
      c.fillStyle = 'rgba(217,164,65,0.7)';
      c.fillRect(x - 4 * s, y - 33 * s, 8 * s, 7 * s); // shrine light
    }
  });
  const near = canvasTex(W, STRIP_H, (c) => {
    // banner poles + glazed column stubs along the processional way
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0;
      const x = side ? 26 + r() * 30 : W - 56 + r() * 30;
      const y = 30 + i * 50 + r() * 16;
      c.fillStyle = 'rgba(237,227,210,0.5)';
      c.fillRect(x, y, 3, 74);
      c.fillStyle = i % 3 === 0 ? 'rgba(217,164,65,0.85)' : 'rgba(46,86,196,0.85)';
      c.beginPath();
      c.moveTo(x + 3, y + 2);
      c.lineTo(x + 26, y + 8);
      c.lineTo(x + 3, y + 18);
      c.fill();
    }
  });
  const lane = canvasTex(W, LANE_H, (c) => {
    c.fillStyle = '#241a2e';
    c.fillRect(0, 0, W, LANE_H);
    // fired-brick paving grid
    c.strokeStyle = 'rgba(237,227,210,0.07)';
    c.lineWidth = 2;
    for (let y = 0; y < LANE_H; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    for (let x = 20; x < W; x += 64) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, LANE_H); c.stroke(); }
    c.fillStyle = 'rgba(217,164,65,0.1)';
    for (let i = 0; i < 6; i++) c.fillRect(r() * W, r() * LANE_H, 30, 3);
  });
  return { sky: sky([[0, '#0d0d2b'], [0.45, '#1b3b8f'], [1, '#8f5a2c']]), far, near, lane, fogColor: 0x1b3b8f };
}

export function buildBackdrops(): ChapterArt[] {
  return [buildMarsh(), buildSteppe(), buildCity()];
}
