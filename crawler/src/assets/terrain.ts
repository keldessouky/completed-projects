import { Texture } from 'pixi.js';
import { CONFIG } from '../config';
import { ISO_X, ISO_Y, blockBounds, toScreen } from '../iso';
import { biomeAt, clutterAt, getWorld, roadDist, type Biome } from '../world/worldgen';
import { hex } from './palette';

/**
 * Terrain is baked one chunk at a time, already in SCREEN space.
 *
 * A square block of world projects to a diamond, and a diamond is not something
 * a plain Sprite can be. So rather than baking an axis-aligned tile sheet and
 * shearing it at draw time, each chunk paints its tiles as diamonds directly
 * onto a canvas sized to the block's projected bounding box. The result is one
 * ordinary Sprite per chunk, no per-frame matrix work, and no seams.
 *
 * Chunks are pure functions of their coordinates and the world seed, so they
 * can be thrown away and rebuilt identically — which is what makes an LRU
 * around the player the whole of the memory story.
 */

const T = CONFIG.world.tile;
const N = CONFIG.world.chunkTiles;
const BLOCK = T * N;          // world units per chunk edge
const C = CONFIG.colors;

/** three shades of one field, plus what speckles it */
const GROUND: Record<Biome, { base: string; alt: string; speck: string }> = {
  grass: { base: hex(C.grass),    alt: hex(C.grassAlt),  speck: hex(C.grassDark) },
  field: { base: hex(C.grassAlt), alt: hex(C.grass),     speck: hex(C.sandDark) },
  scrub: { base: hex(C.grassDark), alt: hex(C.grassAlt), speck: hex(C.sandDark) },
};

function tileRng(tx: number, ty: number, salt = 0): () => number {
  let a = (tx * 73856093) ^ (ty * 19349663) ^ (CONFIG.world.seed + salt);
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Trace the diamond of one world tile whose top corner is (wx, wy). */
function tilePath(c: CanvasRenderingContext2D, wx: number, wy: number, ox: number, oy: number): void {
  const a = toScreen(wx, wy);
  const b = toScreen(wx + T, wy);
  const d = toScreen(wx + T, wy + T);
  const e = toScreen(wx, wy + T);
  c.beginPath();
  c.moveTo(a.x - ox, a.y - oy);
  c.lineTo(b.x - ox, b.y - oy);
  c.lineTo(d.x - ox, d.y - oy);
  c.lineTo(e.x - ox, e.y - oy);
  c.closePath();
}

// ─────────────────────────── props ───────────────────────────

/**
 * Props are drawn in 3/4 view: a footprint ellipse on the ground plane and a
 * body standing up from it. Height is pure screen-space — nothing in the
 * simulation knows these exist.
 */
function paintProp(
  c: CanvasRenderingContext2D, kind: 'tree' | 'rock' | 'fence', sx: number, sy: number, r: () => number,
): void {
  c.fillStyle = 'rgba(0,0,0,0.18)';
  c.beginPath();
  c.ellipse(sx, sy, kind === 'tree' ? 16 : 11, (kind === 'tree' ? 16 : 11) * 0.5, 0, 0, Math.PI * 2);
  c.fill();

  if (kind === 'tree') {
    const h = 40 + r() * 16;
    c.fillStyle = hex(C.woodDark);
    c.fillRect(sx - 3.5, sy - h * 0.42, 7, h * 0.42);
    // three stacked cones, darkest at the base
    for (let i = 0; i < 3; i++) {
      const t = i / 2;
      const w = 22 - i * 5;
      const cy = sy - h * (0.36 + t * 0.42);
      c.fillStyle = i === 2 ? hex(C.tree) : i === 1 ? '#379a34' : hex(C.treeDark);
      c.beginPath();
      c.moveTo(sx, cy - 22);
      c.lineTo(sx + w, cy + 6);
      c.lineTo(sx - w, cy + 6);
      c.closePath();
      c.fill();
    }
  } else if (kind === 'rock') {
    const w = 10 + r() * 7;
    c.fillStyle = hex(C.stoneDark);
    c.beginPath(); c.ellipse(sx, sy - 3, w, w * 0.62, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = hex(C.stone);
    c.beginPath(); c.ellipse(sx - 1, sy - 6, w * 0.82, w * 0.5, 0, 0, Math.PI * 2); c.fill();
  } else {
    // a short run of fence, angled along one of the iso axes
    const dir = r() < 0.5 ? 1 : -1;
    c.strokeStyle = hex(C.wood);
    c.lineWidth = 3.4;
    for (let i = 0; i < 3; i++) {
      const px = sx + dir * (i - 1) * 20;
      const py = sy + (i - 1) * 20 * (ISO_Y / ISO_X) * 0.5 * dir;
      c.beginPath(); c.moveTo(px, py); c.lineTo(px, py - 18); c.stroke();
    }
    c.lineWidth = 2.6;
    c.beginPath();
    c.moveTo(sx - dir * 22, sy - 12 - 11 * dir);
    c.lineTo(sx + dir * 22, sy - 12 + 11 * dir);
    c.stroke();
  }
}

// ─────────────────────────── structures ───────────────────────────

/** A recruit pad: a flat plate on the ground with a hut behind it. */
function paintPad(c: CanvasRenderingContext2D, sx: number, sy: number): void {
  // The plate is a diamond so it sits flat in the world, and it is painted
  // OLIVE rather than green: a bright green plate on a bright green field is
  // invisible, which is exactly the mistake the first pass made.
  const diamond = (w: number): void => {
    const h = w * (ISO_Y / ISO_X);
    c.beginPath();
    c.moveTo(sx, sy - h / 2);
    c.lineTo(sx + w / 2, sy);
    c.lineTo(sx, sy + h / 2);
    c.lineTo(sx - w / 2, sy);
    c.closePath();
  };
  diamond(158);
  c.fillStyle = 'rgba(0,0,0,0.16)';
  c.fill();
  diamond(150);
  c.fillStyle = '#8a8f4e';
  c.fill();
  // the bright inner plate: the thing you are meant to stand on
  diamond(112);
  c.fillStyle = '#7fd23f';
  c.fill();
  diamond(150);
  c.strokeStyle = hex(C.bone);
  c.lineWidth = 3;
  c.setLineDash([12, 9]);
  c.stroke();
  c.setLineDash([]);

  // the hut, up and behind
  const hx = sx - 96, hy = sy - 44;
  c.fillStyle = 'rgba(0,0,0,0.2)';
  c.beginPath(); c.ellipse(hx, hy + 26, 40, 18, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = hex(C.woodDark);
  c.fillRect(hx - 32, hy - 10, 64, 36);
  c.fillStyle = hex(C.wood);
  c.beginPath();
  c.moveTo(hx - 42, hy - 8);
  c.lineTo(hx, hy - 44);
  c.lineTo(hx + 42, hy - 8);
  c.closePath();
  c.fill();
  c.fillStyle = '#a06a3a';
  for (let i = -36; i < 36; i += 9) c.fillRect(hx + i, hy - 8, 4, 34);
  // crossed weapons on the gable, the universal sign for "recruit here"
  c.strokeStyle = hex(C.bone);
  c.lineWidth = 3.2;
  c.beginPath();
  c.moveTo(hx - 15, hy - 6); c.lineTo(hx + 15, hy - 30);
  c.moveTo(hx + 15, hy - 6); c.lineTo(hx - 15, hy - 30);
  c.stroke();
}

/** A camp: a scorched circle, a firepit and some junk. */
function paintCamp(c: CanvasRenderingContext2D, sx: number, sy: number, r: () => number): void {
  const w = 300, h = w * (ISO_Y / ISO_X);
  c.fillStyle = 'rgba(120,86,44,0.5)';
  c.beginPath(); c.ellipse(sx, sy, w / 2, h / 2, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#3a2d1c';
  c.beginPath(); c.ellipse(sx, sy, 22, 12, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = hex(C.foeDark);
  c.beginPath(); c.ellipse(sx, sy - 2, 12, 7, 0, 0, Math.PI * 2); c.fill();
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2, d = 50 + r() * 90;
    const px = sx + Math.cos(a) * d, py = sy + Math.sin(a) * d * (ISO_Y / ISO_X);
    c.fillStyle = 'rgba(0,0,0,0.22)';
    c.beginPath(); c.ellipse(px, py + 3, 11, 5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = i % 2 ? hex(C.woodDark) : hex(C.stoneDark);
    c.fillRect(px - 9, py - 8, 18, 11);
  }
}

/** The keep: a wall of blocks with a gate, filling the back of the map. */
function paintCastle(c: CanvasRenderingContext2D, sx: number, sy: number): void {
  const wallW = 620;
  c.fillStyle = 'rgba(0,0,0,0.22)';
  c.beginPath(); c.ellipse(sx, sy + 20, wallW / 2, 90, 0, 0, Math.PI * 2); c.fill();

  // three stepped blocks receding, so the wall reads as mass not a flat card
  for (let i = 2; i >= 0; i--) {
    const w = wallW - i * 90;
    const top = sy - 150 - i * 74;
    c.fillStyle = i === 0 ? hex(C.stone) : i === 1 ? '#7c7e85' : hex(C.stoneDark);
    c.fillRect(sx - w / 2, top, w, 130 + i * 40);
    c.fillStyle = 'rgba(255,255,255,0.1)';
    c.fillRect(sx - w / 2, top, w, 12);
    // crenellations
    c.fillStyle = i === 0 ? hex(C.stone) : hex(C.stoneDark);
    for (let x = -w / 2; x < w / 2 - 20; x += 46) c.fillRect(sx + x, top - 22, 26, 24);
  }
  // block seams
  c.strokeStyle = 'rgba(0,0,0,0.2)';
  c.lineWidth = 2;
  for (let y = sy - 140; y < sy + 6; y += 26) {
    c.beginPath(); c.moveTo(sx - wallW / 2, y); c.lineTo(sx + wallW / 2, y); c.stroke();
  }
  // the gate
  c.fillStyle = '#241a12';
  c.beginPath();
  c.moveTo(sx - 74, sy + 10);
  c.lineTo(sx - 74, sy - 74);
  c.arc(sx, sy - 74, 74, Math.PI, 0);
  c.lineTo(sx + 74, sy + 10);
  c.closePath();
  c.fill();
  c.fillStyle = hex(C.wood);
  c.fillRect(sx - 66, sy - 78, 132, 88);
  c.fillStyle = hex(C.woodDark);
  for (let x = -60; x < 62; x += 22) c.fillRect(sx + x, sy - 78, 8, 88);
  c.strokeStyle = hex(C.goldDark);
  c.lineWidth = 6;
  c.strokeRect(sx - 66, sy - 78, 132, 88);
  // banners either side
  for (const dx of [-150, 150]) {
    c.fillStyle = hex(C.foe);
    c.beginPath();
    c.moveTo(sx + dx - 18, sy - 150);
    c.lineTo(sx + dx + 18, sy - 150);
    c.lineTo(sx + dx + 18, sy - 60);
    c.lineTo(sx + dx, sy - 78);
    c.lineTo(sx + dx - 18, sy - 60);
    c.closePath();
    c.fill();
  }
}

/** The muster point you start on: a friendly plaza. */
function paintStart(c: CanvasRenderingContext2D, sx: number, sy: number): void {
  const w = 340, h = w * (ISO_Y / ISO_X);
  c.fillStyle = 'rgba(216,180,119,0.85)';
  c.beginPath(); c.ellipse(sx, sy, w / 2, h / 2, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(255,246,226,0.5)';
  c.lineWidth = 4;
  c.beginPath(); c.ellipse(sx, sy, w / 2, h / 2, 0, 0, Math.PI * 2); c.stroke();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.5;
    const px = sx + Math.cos(a) * 132, py = sy + Math.sin(a) * 132 * (ISO_Y / ISO_X);
    c.fillStyle = 'rgba(0,0,0,0.2)';
    c.beginPath(); c.ellipse(px, py + 12, 26, 12, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = hex(C.wood);
    c.fillRect(px - 20, py - 20, 40, 32);
    c.fillStyle = hex(C.woodDark);
    c.beginPath();
    c.moveTo(px - 26, py - 18); c.lineTo(px, py - 44); c.lineTo(px + 26, py - 18);
    c.closePath(); c.fill();
  }
}

// ─────────────────────────── chunk baking ───────────────────────────

interface Baked { tex: Texture; used: number; }
const cache = new Map<string, Baked>();
let clock = 0;

export const BLOCK_SIZE = BLOCK;

/** Screen-space bounds of a chunk, used both for baking and for placement. */
export function chunkBounds(cx: number, cy: number): { x: number; y: number; w: number; h: number } {
  return blockBounds(cx * BLOCK, cy * BLOCK, BLOCK);
}

/**
 * Screen-space padding baked around every chunk.
 *
 * Only props and the one-tile road bleed need it — structures are their own
 * sprites (see getStructure) precisely so a 620-px castle does not have to be
 * paid for by every chunk on the map in canvas memory.
 */
const PAD = 110;

export function getChunk(cx: number, cy: number): Texture {
  const key = `${cx},${cy}`;
  const hit = cache.get(key);
  if (hit) { hit.used = ++clock; return hit.tex; }

  const b = chunkBounds(cx, cy);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(b.w + PAD * 2);
  canvas.height = Math.ceil(b.h + PAD * 2);
  const c = canvas.getContext('2d')!;
  const ox = b.x - PAD, oy = b.y - PAD;

  const wx0 = cx * BLOCK, wy0 = cy * BLOCK;

  // ── ground ──
  for (let ty = 0; ty < N; ty++) {
    for (let tx = 0; tx < N; tx++) {
      const wx = wx0 + tx * T, wy = wy0 + ty * T;
      const r = tileRng(Math.round(wx / T), Math.round(wy / T));
      // jitter the biome sample so shade borders are ragged, not gridded
      const g = GROUND[biomeAt(wx + (r() - 0.5) * T * 1.4, wy + (r() - 0.5) * T * 1.4)];
      tilePath(c, wx, wy, ox, oy);
      c.fillStyle = r() < 0.76 ? g.base : g.alt;
      c.fill();
      if (r() < 0.34) {
        c.fillStyle = g.speck;
        c.globalAlpha = 0.2 + r() * 0.2;
        c.fill();
        c.globalAlpha = 1;
      }
    }
  }

  // ── road, painted per tile so it follows the diamonds ──
  for (let ty = -1; ty <= N; ty++) {
    for (let tx = -1; tx <= N; tx++) {
      const wx = wx0 + tx * T, wy = wy0 + ty * T;
      const d = roadDist(wx + T / 2, wy + T / 2);
      if (d > 90) continue;
      tilePath(c, wx, wy, ox, oy);
      const a = d < 52 ? 0.95 : 0.95 * (1 - (d - 52) / 38);
      c.fillStyle = `rgba(216,180,119,${a.toFixed(3)})`;
      c.fill();
    }
  }

  // ── props last: they sit on top of everything on the ground plane ──
  for (let ty = 0; ty < N; ty++) {
    for (let tx = 0; tx < N; tx++) {
      const wx = wx0 + tx * T + T / 2, wy = wy0 + ty * T + T / 2;
      const r = tileRng(Math.round(wx / T) + 7777, Math.round(wy / T) + 31);
      if (r() > clutterAt(wx, wy) * 0.55) continue;
      if (roadDist(wx, wy) < 70) continue;
      // keep props out of every structure's footprint — this skips the TILE,
      // not the chunk, which an early return here would quietly do instead
      let blocked = false;
      for (const p of getWorld().pois) {
        const rad = p.kind === 'castle' ? 420 : p.kind === 'start' ? 230 : 190;
        if (Math.hypot(p.x - wx, p.y - wy) < rad) { blocked = true; break; }
      }
      if (blocked) continue;
      const s = toScreen(wx, wy);
      const roll = r();
      paintProp(c, roll < 0.6 ? 'tree' : roll < 0.85 ? 'rock' : 'fence', s.x - ox, s.y - oy, r);
    }
  }

  const tex = Texture.from(canvas);
  cache.set(key, { tex, used: ++clock });

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

/** Where a chunk sprite goes, accounting for the overhang padding. */
export function chunkOrigin(cx: number, cy: number): { x: number; y: number } {
  const b = chunkBounds(cx, cy);
  return { x: b.x - PAD, y: b.y - PAD };
}

// ─────────────────────────── structures ───────────────────────────

/**
 * A structure's art, baked once into its own texture.
 *
 * Structures are NOT part of the terrain bake. A castle is 620 px wide and
 * 440 px tall; folding that into the chunk grid would mean every chunk on the
 * map carrying enough canvas padding to hold one, and it would also put the
 * castle's silhouette on the wrong side of the depth sort — a wall you can
 * stand behind has to sort against the actors, not under all of them.
 *
 * The returned offsets are where the POI's own world position sits inside the
 * texture, so the caller can place it by anchor.
 */
export interface Structure { tex: Texture; ox: number; oy: number; }

const STRUCT_BOX: Record<string, { x: number; y: number; w: number; h: number }> = {
  // x/y are the origin's position inside the box
  pad: { x: 160, y: 100, w: 250, h: 150 },
  camp: { x: 175, y: 110, w: 350, h: 220 },
  castle: { x: 340, y: 340, w: 680, h: 470 },
  start: { x: 195, y: 135, w: 390, h: 235 },
};

const structs = new Map<string, Structure>();

export function getStructure(id: string): Structure | null {
  const hit = structs.get(id);
  if (hit) return hit;
  const p = getWorld().pois.find((q) => q.id === id);
  if (!p) return null;
  const box = STRUCT_BOX[p.kind];
  if (!box) return null;

  const canvas = document.createElement('canvas');
  canvas.width = box.w;
  canvas.height = box.h;
  const c = canvas.getContext('2d')!;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  const r = tileRng(Math.round(p.x), Math.round(p.y), 99);
  if (p.kind === 'pad') paintPad(c, box.x, box.y);
  else if (p.kind === 'camp') paintCamp(c, box.x, box.y, r);
  else if (p.kind === 'castle') paintCastle(c, box.x, box.y);
  else if (p.kind === 'start') paintStart(c, box.x, box.y);

  const made = { tex: Texture.from(canvas), ox: box.x, oy: box.y };
  structs.set(id, made);
  return made;
}

export function clearChunks(): void {
  for (const v of cache.values()) v.tex.destroy(true);
  cache.clear();
}

// ─────────────────────────── field overview ───────────────────────────

let overview: Texture | null = null;

/**
 * A small painting of the whole field, baked once.
 *
 * The title card wants to show the place you are about to walk across, and a
 * live camera over a 3600-unit world would cost a frame budget to render a
 * still. This is 320 px of the same diamond grid with the structures marked —
 * cheap, and it is the same layout the game generates, not a decoration.
 */
export function getFieldTexture(): Texture {
  if (overview) return overview;
  const size = CONFIG.world.size;
  const b = blockBounds(0, 0, size);
  const SW = 320;
  const s = SW / b.w;

  const canvas = document.createElement('canvas');
  canvas.width = SW;
  canvas.height = Math.ceil(b.h * s);
  const c = canvas.getContext('2d')!;
  c.scale(s, s);
  c.translate(-b.x, -b.y);

  // the ground: one diamond, three shades of scattered field
  const step = size / 26;
  for (let wy = 0; wy < size; wy += step) {
    for (let wx = 0; wx < size; wx += step) {
      const r = tileRng(Math.round(wx), Math.round(wy), 5150);
      const g = GROUND[biomeAt(wx + step / 2, wy + step / 2)];
      const a = toScreen(wx, wy), q = toScreen(wx + step, wy);
      const d = toScreen(wx + step, wy + step), e = toScreen(wx, wy + step);
      c.beginPath();
      c.moveTo(a.x, a.y); c.lineTo(q.x, q.y); c.lineTo(d.x, d.y); c.lineTo(e.x, e.y);
      c.closePath();
      c.fillStyle = r() < 0.7 ? g.base : g.alt;
      c.fill();
    }
  }

  // the road, as a thick line through its waypoints
  c.strokeStyle = hex(C.path);
  c.lineWidth = size / 44;
  c.lineJoin = 'round';
  for (const line of getWorld().roads) {
    c.beginPath();
    line.forEach((p, i) => {
      const q = toScreen(p.x, p.y);
      i === 0 ? c.moveTo(q.x, q.y) : c.lineTo(q.x, q.y);
    });
    c.stroke();
  }

  // and what is on it
  for (const p of getWorld().pois) {
    const q = toScreen(p.x, p.y);
    const r = p.kind === 'castle' ? size / 26 : size / 46;
    c.fillStyle = p.kind === 'castle' ? hex(C.stone)
      : p.kind === 'camp' ? hex(C.foe)
      : p.kind === 'pad' ? hex(C.ally)
      : hex(C.gold);
    c.beginPath();
    c.ellipse(q.x, q.y, r, r * 0.55, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = hex(C.ink);
    c.lineWidth = size / 300;
    c.stroke();
  }

  overview = Texture.from(canvas);
  return overview;
}
