import { Texture } from 'pixi.js';
import { CONFIG } from '../config';
import type { Biome } from '../types';
import { biomeAt, clutterAt, getWorld, roadDist } from '../world/worldgen';
import { hex } from './palette';

/**
 * Terrain is baked one chunk at a time onto a Canvas2D surface and handed to
 * Pixi as a texture.
 *
 * Chunks are the right unit because terrain is static and pure: a chunk's
 * pixels are a function of its coordinates and the world seed, so it can be
 * thrown away and rebuilt identically. That turns a 5120² world into a small
 * LRU of textures around the player rather than anything that has to be stored
 * or streamed.
 */

const T = CONFIG.world.tile;
const N = CONFIG.world.chunkTiles;
const CHUNK = T * N;

const C = CONFIG.colors;

/** base ground colour per biome, plus the speckle it gets */
const GROUND: Record<Biome, { base: string; speck: string; alt: string }> = {
  grass:  { base: hex(C.grass),    speck: hex(C.grassDim), alt: '#50713f' },
  forest: { base: hex(C.forest),   speck: '#25391f',       alt: '#334f30' },
  ruins:  { base: hex(C.stoneDim), speck: hex(C.stone),    alt: '#51515a' },
  swamp:  { base: '#3c4b3a',       speck: hex(C.water),    alt: '#38493c' },
  waste:  { base: hex(C.waste),    speck: '#584a3a',       alt: '#655444' },
};

/** deterministic per-tile randomness, so a rebuilt chunk is pixel-identical */
function tileRng(tx: number, ty: number): () => number {
  let a = (tx * 73856093) ^ (ty * 19349663) ^ CONFIG.world.seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─────────────────────────── tile painters ───────────────────────────

function paintTile(c: CanvasRenderingContext2D, px: number, py: number, wx: number, wy: number): void {
  const r = tileRng(Math.floor(wx / T), Math.floor(wy / T));

  // Sample the biome with a per-tile jitter. Without it, two regions meet along
  // a dead-straight tile boundary and the whole map reads as graph paper; a
  // few tiles of noise on the seam is the difference between a border and a
  // coastline.
  const j = T * 1.3;
  const b = biomeAt(wx + (r() - 0.5) * j, wy + (r() - 0.5) * j);
  const g = GROUND[b];

  // base, with a light weave of two nearby values — mostly the base colour, so
  // it reads as texture rather than as a chequerboard
  c.fillStyle = r() < 0.72 ? g.base : g.alt;
  c.fillRect(px, py, T, T);

  // speckle
  const n = 3 + Math.floor(r() * 4);
  c.fillStyle = g.speck;
  for (let i = 0; i < n; i++) {
    c.globalAlpha = 0.25 + r() * 0.3;
    c.fillRect(px + r() * T, py + r() * T, 1 + r() * 3, 1 + r() * 2);
  }
  c.globalAlpha = 1;
}

/** Clutter that sits on the ground: tufts, rubble, stumps, reeds. */
function paintClutter(c: CanvasRenderingContext2D, px: number, py: number, wx: number, wy: number): void {
  const b = biomeAt(wx, wy);
  const density = clutterAt(wx, wy);
  const r = tileRng(Math.floor(wx / T) + 7777, Math.floor(wy / T) + 31);
  if (r() > density * 0.9) return;

  const x = px + 4 + r() * (T - 8);
  const y = py + 4 + r() * (T - 8);

  switch (b) {
    case 'grass': {
      c.strokeStyle = 'rgba(120,152,92,0.75)';
      c.lineWidth = 1.4;
      for (let i = 0; i < 3; i++) {
        const bx = x + (i - 1) * 3;
        c.beginPath(); c.moveTo(bx, y + 5); c.lineTo(bx + (r() - 0.5) * 4, y - 3 - r() * 4); c.stroke();
      }
      break;
    }
    case 'forest': {
      // a canopy blob with a trunk shadow — trees read as mass, not outline
      c.fillStyle = 'rgba(18,30,16,0.55)';
      c.beginPath(); c.ellipse(x + 2, y + 4, 9, 5, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = r() < 0.5 ? '#2c4526' : '#365331';
      c.beginPath(); c.arc(x, y, 8 + r() * 3, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#1f2f1b';
      c.beginPath(); c.arc(x - 2, y - 2, 4, 0, Math.PI * 2); c.fill();
      break;
    }
    case 'ruins': {
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.fillRect(x - 5, y - 3, 12, 9);
      c.fillStyle = r() < 0.5 ? '#7c7c86' : '#63636c';
      c.fillRect(x - 6, y - 5, 12, 9);
      c.fillStyle = 'rgba(162,84,43,0.7)';
      c.fillRect(x - 6, y - 5, 12, 2);
      break;
    }
    case 'swamp': {
      c.fillStyle = 'rgba(47,93,120,0.55)';
      c.beginPath(); c.ellipse(x, y, 8 + r() * 6, 4 + r() * 3, r(), 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(90,110,70,0.7)';
      c.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) {
        c.beginPath(); c.moveTo(x - 4 + i * 4, y + 2); c.lineTo(x - 5 + i * 4, y - 8 - r() * 5); c.stroke();
      }
      break;
    }
    case 'waste': {
      c.fillStyle = 'rgba(109,54,24,0.5)';
      c.fillRect(x - 4, y - 1, 9, 3);
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.fillRect(x - 4, y + 2, 9, 2);
      break;
    }
  }
}

// ─────────────────────────── overlays ───────────────────────────

/** Roads are painted per pixel-ish band rather than per tile so they curve. */
function paintRoads(c: CanvasRenderingContext2D, ox: number, oy: number): void {
  const step = 8;
  for (let y = 0; y < CHUNK; y += step) {
    for (let x = 0; x < CHUNK; x += step) {
      const d = roadDist(ox + x + step / 2, oy + y + step / 2);
      if (d > 46) continue;
      const t = 1 - d / 46;
      c.fillStyle = `rgba(122,92,58,${(0.18 + t * 0.62).toFixed(3)})`;
      c.fillRect(x, y, step, step);
      if (d < 16) {
        c.fillStyle = `rgba(150,120,80,${(0.2 * t).toFixed(3)})`;
        c.fillRect(x, y, step, step);
      }
    }
  }
}

/** Structures: town plazas, ruin slabs, camp scars, shrine pads, the Depot. */
function paintPois(c: CanvasRenderingContext2D, ox: number, oy: number): void {
  for (const p of getWorld().pois) {
    const x = p.x - ox, y = p.y - oy;
    const reach = p.kind === 'town' ? 230 : p.kind === 'lair' ? 300 : 180;
    if (x < -reach || y < -reach || x > CHUNK + reach || y > CHUNK + reach) continue;

    if (p.kind === 'town') {
      // flagstone plaza with a rim
      c.fillStyle = 'rgba(111,111,120,0.92)';
      c.beginPath(); c.arc(x, y, 168, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(230,227,221,0.35)'; c.lineWidth = 4;
      c.beginPath(); c.arc(x, y, 168, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = 'rgba(0,0,0,0.22)'; c.lineWidth = 2;
      for (let i = -160; i <= 160; i += 40) {
        c.beginPath(); c.moveTo(x - 160, y + i); c.lineTo(x + 160, y + i); c.stroke();
        c.beginPath(); c.moveTo(x + i, y - 160); c.lineTo(x + i, y + 160); c.stroke();
      }
      // a few shack footprints around the rim
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.4;
        const sx = x + Math.cos(a) * 126, sy = y + Math.sin(a) * 126;
        c.fillStyle = 'rgba(20,17,25,0.5)';
        c.fillRect(sx - 22, sy - 16, 46, 36);
        c.fillStyle = i % 2 ? '#6d3618' : '#5c4429';
        c.fillRect(sx - 24, sy - 20, 46, 36);
        c.fillStyle = 'rgba(230,227,221,0.18)';
        c.fillRect(sx - 24, sy - 20, 46, 6);
      }
    } else if (p.kind === 'lair') {
      // a loading yard: slab, bay doors, hazard paint
      c.fillStyle = 'rgba(74,74,82,0.95)';
      c.fillRect(x - 230, y - 180, 460, 360);
      c.fillStyle = 'rgba(0,0,0,0.3)';
      for (let i = -220; i < 230; i += 46) c.fillRect(x + i, y - 180, 3, 360);
      c.fillStyle = '#2b2d31';
      c.fillRect(x - 150, y - 168, 300, 66);
      for (let i = 0; i < 5; i++) {
        c.fillStyle = i % 2 ? '#d9a441' : '#141119';
        c.fillRect(x - 150 + i * 60, y - 108, 60, 12);
      }
      c.strokeStyle = 'rgba(217,164,65,0.8)'; c.lineWidth = 5;
      c.strokeRect(x - 230, y - 180, 460, 360);
    } else if (p.kind === 'camp') {
      c.fillStyle = 'rgba(92,68,41,0.65)';
      c.beginPath(); c.arc(x, y, 128, 0, Math.PI * 2); c.fill();
      // firepit
      c.fillStyle = '#2b2118';
      c.beginPath(); c.arc(x, y, 20, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#a2542b';
      c.beginPath(); c.arc(x, y, 11, 0, Math.PI * 2); c.fill();
      // a ring of junk
      const r = tileRng(Math.round(p.x), Math.round(p.y));
      for (let i = 0; i < 9; i++) {
        const a = r() * Math.PI * 2, d = 46 + r() * 74;
        c.fillStyle = 'rgba(20,17,25,0.55)';
        c.fillRect(x + Math.cos(a) * d - 9, y + Math.sin(a) * d - 5, 20, 12);
      }
    } else if (p.kind === 'ruin') {
      const r = tileRng(Math.round(p.x) + 5, Math.round(p.y) + 5);
      c.fillStyle = 'rgba(74,74,82,0.85)';
      c.fillRect(x - 132, y - 108, 264, 216);
      // broken interior walls
      c.fillStyle = '#7c7c86';
      for (let i = 0; i < 7; i++) {
        const wx = x - 120 + r() * 210, wy = y - 96 + r() * 180;
        if (r() < 0.5) c.fillRect(wx, wy, 12, 40 + r() * 60);
        else c.fillRect(wx, wy, 40 + r() * 70, 12);
      }
      c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 3;
      c.strokeRect(x - 132, y - 108, 264, 216);
    } else if (p.kind === 'shrine') {
      c.fillStyle = 'rgba(47,122,217,0.22)';
      c.beginPath(); c.arc(x, y, 76, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(111,111,120,0.95)';
      c.beginPath(); c.arc(x, y, 44, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#63a8f0'; c.lineWidth = 3;
      c.beginPath(); c.arc(x, y, 44, 0, Math.PI * 2); c.stroke();
    }
  }
}

// ─────────────────────────── chunk cache ───────────────────────────

interface Baked { tex: Texture; canvas: HTMLCanvasElement; used: number; }

const cache = new Map<string, Baked>();
let clock = 0;

export const chunkKey = (cx: number, cy: number): string => `${cx},${cy}`;
export const CHUNK_SIZE = CHUNK;

/** Bake (or fetch) the chunk at chunk-coordinates cx,cy. */
export function getChunk(cx: number, cy: number): Texture {
  const key = chunkKey(cx, cy);
  const hit = cache.get(key);
  if (hit) { hit.used = ++clock; return hit.tex; }

  const canvas = document.createElement('canvas');
  canvas.width = CHUNK;
  canvas.height = CHUNK;
  const c = canvas.getContext('2d')!;
  const ox = cx * CHUNK, oy = cy * CHUNK;

  for (let ty = 0; ty < N; ty++) {
    for (let tx = 0; tx < N; tx++) {
      paintTile(c, tx * T, ty * T, ox + tx * T, oy + ty * T);
    }
  }
  paintRoads(c, ox, oy);
  for (let ty = 0; ty < N; ty++) {
    for (let tx = 0; tx < N; tx++) {
      paintClutter(c, tx * T, ty * T, ox + tx * T, oy + ty * T);
    }
  }
  paintPois(c, ox, oy);

  const tex = Texture.from(canvas);
  cache.set(key, { tex, canvas, used: ++clock });

  // evict the least recently used chunk once the cache is over budget
  while (cache.size > CONFIG.world.chunkCache) {
    let oldestKey = '';
    let oldest = Infinity;
    for (const [k, v] of cache) if (v.used < oldest) { oldest = v.used; oldestKey = k; }
    const dead = cache.get(oldestKey);
    if (!dead) break;
    dead.tex.destroy(true);
    cache.delete(oldestKey);
  }
  return tex;
}

/** Drop everything — used when the renderer context is lost. */
export function clearChunks(): void {
  for (const v of cache.values()) v.tex.destroy(true);
  cache.clear();
}

/** A single small texture of the whole world, for the minimap backdrop. */
let miniTex: Texture | null = null;
export function getMinimapTexture(): Texture {
  if (miniTex) return miniTex;
  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width = S; canvas.height = S;
  const c = canvas.getContext('2d')!;
  const step = CONFIG.world.size / S;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const wx = x * step, wy = y * step;
      c.fillStyle = GROUND[biomeAt(wx, wy)].base;
      c.fillRect(x, y, 1, 1);
      if (roadDist(wx, wy) < 60) {
        c.fillStyle = 'rgba(150,120,80,0.85)';
        c.fillRect(x, y, 1, 1);
      }
    }
  }
  miniTex = Texture.from(canvas);
  return miniTex;
}
