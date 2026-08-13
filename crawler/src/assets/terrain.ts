import { CanvasSource, Texture } from 'pixi.js';
import { CONFIG } from '../config';
import { ISO_X, ISO_Y, blockBounds, toScreen } from '../iso';
import { biomeAt, clutterAt, fbm, getWorld, roadDist, type Biome } from '../world/worldgen';
import { hex } from './palette';
import { P } from './palette';
import { cel, contactShadow, ellPath, mix, polyPath, rrPath, tint } from './shade';

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

/**
 * The colour of the ground at a point, as a continuous field.
 *
 * This replaced a per-tile coin flip between two shades, and the difference is
 * the single biggest thing in this file. A coin flip gives every tile an
 * independent colour, and independent colours on a regular grid read as a
 * CHECKERBOARD — the eye finds the lattice immediately and the whole field
 * stops being ground and becomes a spreadsheet with grass on it.
 *
 * Three octaves of noise at different scales instead: a broad one that makes
 * meadows and darker hollows tens of tiles across, a medium one for patchiness,
 * and a fine one that keeps neighbouring tiles from ever being identical. The
 * lattice disappears because there is no longer anything aligned to it.
 */
function groundTone(wx: number, wy: number, g: { base: string; alt: string; speck: string }): string {
  const broad = fbm(wx * 0.0016, wy * 0.0016, 91);
  const mid = fbm(wx * 0.0075, wy * 0.0075, 137);
  const fine = fbm(wx * 0.031, wy * 0.031, 211);
  // weighted so the broad shape leads and the fine detail only ever nudges
  const t = broad * 0.5 + mid * 0.34 + fine * 0.16;
  // dry, sun-bleached in the high places; lush and dark in the hollows
  if (t > 0.56) return mix(g.base, g.alt, Math.min(1, (t - 0.56) * 3.4));
  if (t < 0.44) return mix(g.base, g.speck, Math.min(1, (0.44 - t) * 2.6));
  return g.base;
}

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
  tilePathSize(c, wx, wy, T, ox, oy);
}

/** The same, at an arbitrary edge length — used to quarter a tile. */
function tilePathSize(
  c: CanvasRenderingContext2D, wx: number, wy: number, T: number, ox: number, oy: number,
): void {
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
  c: CanvasRenderingContext2D, kind: PropKind, sx: number, sy: number, r: () => number,
): void {
  // Every leafy thing takes its own hue off the base green. A wood painted in
  // one colour reads as wallpaper however good the individual tree is; ±8% of
  // hue across a stand is the difference between "trees" and "a tree, copied".
  const leaf = mix(P.tree, r() < 0.5 ? '#5aa34a' : '#2f7a35', r() * 0.55);
  const leafDark = tint(leaf, -0.3);

  if (kind === 'tree') {
    const h = 44 + r() * 22;
    contactShadow(c, sx + 5, sy + 1, 17, 0.3);
    // trunk, with a visible flare at the base
    cel(c, () => {
      c.beginPath();
      c.moveTo(sx - 3.6, sy);
      c.lineTo(sx - 2.4, sy - h * 0.44);
      c.lineTo(sx + 2.4, sy - h * 0.44);
      c.lineTo(sx + 3.6, sy);
      c.closePath();
    }, P.wood, { depth: 2, rim: 1 });

    // Four overlapping canopy lobes rather than three flat cones. The lobes
    // are what give a tree a silhouette you can read at 30 px and a surface
    // the light can actually run across.
    const lobes: [number, number, number][] = [
      [-9, -h * 0.42, 13],
      [9, -h * 0.46, 12],
      [0, -h * 0.58, 15],
      [0, -h * 0.78, 11],
    ];
    for (let i = 0; i < lobes.length; i++) {
      const [ox, oy, rad] = lobes[i];
      const wob = 0.85 + r() * 0.3;
      cel(c, ellPath(c, sx + ox, sy + oy, rad * wob, rad * 0.86 * wob),
        i === lobes.length - 1 ? tint(leaf, 0.1) : leaf,
        { depth: rad * 0.42, rim: rad * 0.22, dark: leafDark });
    }
    // a couple of dapples on the lit side
    c.save();
    c.fillStyle = 'rgba(255,255,255,0.16)';
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.ellipse(sx - 7 + r() * 8, sy - h * (0.55 + r() * 0.24), 3.2, 2, -0.6, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  } else if (kind === 'rock') {
    const w = 11 + r() * 8;
    contactShadow(c, sx + 3, sy + 1, w * 1.05, 0.28);
    // A faceted boulder, not an ellipse: three planes catching different
    // amounts of light is the whole difference between a rock and a pebble
    // shaped hole in the grass.
    cel(c, polyPath(c, [
      sx - w, sy - 1, sx - w * 0.55, sy - w * 0.72, sx + w * 0.2, sy - w * 0.86,
      sx + w * 0.85, sy - w * 0.42, sx + w, sy + 1, sx - w * 0.3, sy + w * 0.28,
    ]), P.stone, { depth: w * 0.4, rim: w * 0.2, dark: P.stoneDark });
    c.save();
    c.fillStyle = 'rgba(255,255,255,0.2)';
    c.beginPath();
    c.moveTo(sx - w * 0.5, sy - w * 0.66);
    c.lineTo(sx + w * 0.16, sy - w * 0.8);
    c.lineTo(sx - w * 0.06, sy - w * 0.36);
    c.closePath();
    c.fill();
    // moss on the shaded side of most of them — a bare grey boulder in a
    // damp meadow is the one thing in this scene nothing has grown on
    if (r() < 0.7) {
      c.fillStyle = 'rgba(92,150,54,0.5)';
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.ellipse(sx + w * (0.1 + r() * 0.5), sy - w * (0.1 + r() * 0.3),
          w * 0.22, w * 0.13, r() * 2, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.restore();
  } else if (kind === 'conifer') {
    // A second species. One tree shape repeated across a whole map is the
    // clearest tell that a field was generated rather than made, and a spruce
    // is a different SILHOUETTE — a triangle among circles — so it reads as
    // variety even at thirty pixels.
    const h = 52 + r() * 26;
    contactShadow(c, sx + 4, sy + 1, 13, 0.3);
    cel(c, () => {
      c.beginPath();
      c.moveTo(sx - 2.6, sy);
      c.lineTo(sx - 1.8, sy - h * 0.3);
      c.lineTo(sx + 1.8, sy - h * 0.3);
      c.lineTo(sx + 2.6, sy);
      c.closePath();
    }, P.woodDark, { depth: 1.6, rim: 0.8 });
    const dark = mix(leaf, '#1f5c2e', 0.45);
    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      const w = 15 - t * 8.5;
      const yy = sy - h * (0.24 + t * 0.62);
      cel(c, polyPath(c, [
        sx - w, yy, sx, yy - h * 0.24, sx + w, yy, sx, yy + 3.6,
      ]), dark, { depth: w * 0.42, rim: w * 0.2, dark: tint(dark, -0.3) });
    }
  } else if (kind === 'bush') {
    contactShadow(c, sx + 3, sy + 1, 12, 0.26);
    const n = 3;
    for (let i = 0; i < n; i++) {
      const bx = sx + (i - 1) * 7 + (r() - 0.5) * 3;
      const by = sy - 5 - r() * 4;
      const rad = 7 + r() * 4;
      cel(c, ellPath(c, bx, by, rad, rad * 0.82), leaf,
        { depth: rad * 0.44, rim: rad * 0.22, dark: leafDark });
    }
    // a few berries, on half of them
    if (r() < 0.5) {
      c.fillStyle = '#c8384a';
      for (let i = 0; i < 4; i++) {
        c.beginPath();
        c.arc(sx + (r() - 0.5) * 18, sy - 4 - r() * 9, 1.5, 0, Math.PI * 2);
        c.fill();
      }
    }
  } else if (kind === 'log') {
    // A fallen trunk lying along one of the iso axes, with end grain showing.
    const dir = r() < 0.5 ? 1 : -1;
    const len = 12 + r() * 6;
    const ey = len * (ISO_Y / ISO_X) * 0.5 * dir;
    const th = 5.2;
    contactShadow(c, sx + 2, sy + 2, len * 0.9, 0.24);
    cel(c, () => {
      c.beginPath();
      c.moveTo(sx - dir * len, sy - ey - th);
      c.lineTo(sx + dir * len, sy + ey - th);
      c.lineTo(sx + dir * len, sy + ey + th * 0.5);
      c.lineTo(sx - dir * len, sy - ey + th * 0.5);
      c.closePath();
    }, P.wood, { depth: 2.6, rim: 1.3 });
    // bark: two strokes along the length, or it reads as a sawn plank
    c.save();
    c.strokeStyle = 'rgba(58,34,14,0.34)';
    c.lineWidth = 0.9;
    for (const o of [-1.6, 1.4]) {
      c.beginPath();
      c.moveTo(sx - dir * len * 0.8, sy - ey * 0.8 - th * 0.4 + o);
      c.lineTo(sx + dir * len * 0.8, sy + ey * 0.8 - th * 0.4 + o);
      c.stroke();
    }
    c.restore();
    cel(c, ellPath(c, sx + dir * len, sy + ey - th * 0.25, 2.2, th * 0.75),
      tint(P.wood, 0.24), { depth: 1, rim: 0.5, line: 1.3 });
  } else if (kind === 'stump') {
    contactShadow(c, sx + 2, sy + 1, 9, 0.26);
    cel(c, () => {
      c.beginPath();
      c.moveTo(sx - 6, sy);
      c.lineTo(sx - 5, sy - 9);
      c.lineTo(sx + 5, sy - 9);
      c.lineTo(sx + 6, sy);
      c.closePath();
    }, P.woodDark, { depth: 1.8, rim: 0.9 });
    cel(c, ellPath(c, sx, sy - 9, 5.4, 2.9), tint(P.wood, 0.16),
      { depth: 1.2, rim: 0.6 });
    // rings
    c.save();
    c.strokeStyle = 'rgba(60,38,18,0.45)';
    c.lineWidth = 0.8;
    for (const rr of [1.6, 3.2]) {
      c.beginPath();
      c.ellipse(sx, sy - 9, rr, rr * 0.54, 0, 0, Math.PI * 2);
      c.stroke();
    }
    c.restore();
  } else {
    // a short run of split-rail fence, angled along one of the iso axes
    const dir = r() < 0.5 ? 1 : -1;
    const dy = 20 * (ISO_Y / ISO_X) * 0.5 * dir;
    contactShadow(c, sx + 3, sy + 1, 22, 0.22);
    for (let i = 0; i < 3; i++) {
      const px = sx + dir * (i - 1) * 20;
      const py = sy + (i - 1) * dy;
      cel(c, rrPath(c, px - 2.2, py - 19, 4.4, 20, 1.4), P.wood,
        { depth: 1.4, rim: 0.8, line: 1.5 });
    }
    for (const off of [-13, -5]) {
      cel(c, () => {
        c.beginPath();
        c.moveTo(sx - dir * 22, sy + off - 11 * dir);
        c.lineTo(sx + dir * 22, sy + off + 11 * dir);
        c.lineTo(sx + dir * 22, sy + off + 3.4 + 11 * dir);
        c.lineTo(sx - dir * 22, sy + off + 3.4 - 11 * dir);
        c.closePath();
      }, tint(P.wood, 0.08), { depth: 1.2, rim: 0.6, line: 1.4 });
    }
  }
}

/**
 * A tuft of grass, scattered densely over the ground.
 *
 * The single biggest thing separating a flat green field from a lawn you would
 * believe is high-frequency detail at the scale of a footstep. These are cheap
 * — three strokes each — and there are thousands of them.
 */
function paintTuft(c: CanvasRenderingContext2D, sx: number, sy: number, r: () => number, base: string): void {
  const n = 2 + Math.floor(r() * 3);
  const lit = tint(base, 0.24);
  const dark = tint(base, -0.18);
  for (let i = 0; i < n; i++) {
    const x = sx + (r() - 0.5) * 15;
    const y = sy + (r() - 0.5) * 7;
    const h = 3.4 + r() * 4.2;
    const lean = (r() - 0.5) * 3.6;
    c.strokeStyle = i === 0 ? dark : lit;
    c.lineWidth = 1.5;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x, y);
    c.quadraticCurveTo(x + lean * 0.4, y - h * 0.6, x + lean, y - h);
    c.stroke();
  }
}

/**
 * Wildflowers — three or four dots of one colour on short stems.
 *
 * Cheap, and worth more than they cost. A green field with nothing but green
 * in it reads as a texture; the moment there are three white flowers and two
 * yellow ones in shot, the same field reads as a MEADOW. They cluster because
 * flowers do, and the cluster colour is picked once so a patch is one species
 * rather than a bag of confetti.
 */
const FLOWERS = ['#f4f1e4', '#f2d05a', '#e08bb8', '#cfd8f0'];

function paintFlowers(c: CanvasRenderingContext2D, sx: number, sy: number, r: () => number): void {
  const col = FLOWERS[(r() * FLOWERS.length) | 0];
  const n = 3 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const x = sx + (r() - 0.5) * 22;
    const y = sy + (r() - 0.5) * 11;
    const h = 3 + r() * 3;
    c.strokeStyle = 'rgba(78,112,48,0.9)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + (r() - 0.5) * 1.6, y - h);
    c.stroke();
    c.fillStyle = col;
    c.beginPath();
    c.arc(x + (r() - 0.5) * 1.6, y - h - 0.8, 1.5 + r() * 0.8, 0, Math.PI * 2);
    c.fill();
  }
}

// ─────────────────────────── props ───────────────────────────

/** What can stand on a tile, and how often relative to each other. */
export type PropKind = 'tree' | 'conifer' | 'rock' | 'fence' | 'bush' | 'log' | 'stump';

/**
 * Pick a prop for one tile.
 *
 * Weighted rather than uniform, and deliberately lopsided: broadleaf trees are
 * the field's signature and everything else is seasoning. A field with equal
 * numbers of seven prop types reads as a sample sheet, not a place.
 */
function pickProp(roll: number): PropKind {
  if (roll < 0.32) return 'tree';
  if (roll < 0.50) return 'conifer';
  if (roll < 0.74) return 'bush';
  if (roll < 0.88) return 'rock';
  if (roll < 0.93) return 'log';
  if (roll < 0.97) return 'stump';
  return 'fence';
}

/**
 * The light pass: broad cloud shadows over the whole chunk.
 *
 * Everything under this is lit identically everywhere, and uniform light is
 * the thing that keeps reading as "computer graphics" no matter how good the
 * texture underneath is — real ground outdoors is never one brightness across
 * fifty metres. Two octaves of very slow noise, sampled on a coarse grid and
 * painted as soft overlapping discs, put slow bands of shade across the field
 * that a player walks in and out of.
 *
 * Drawn on the ground plane only, UNDER the props, so a tree is never dimmed
 * by a cloud its own trunk is standing in the sun of. Cheap: a few dozen
 * gradient discs per chunk, baked once.
 */
function paintCloudShade(
  c: CanvasRenderingContext2D, wx0: number, wy0: number, ox: number, oy: number,
): void {
  const STEP = BLOCK / 4;
  c.save();
  for (let gy = -1; gy <= 4; gy++) {
    for (let gx = -1; gx <= 4; gx++) {
      const wx = wx0 + gx * STEP + STEP / 2;
      const wy = wy0 + gy * STEP + STEP / 2;
      const n = fbm(wx * 0.00085, wy * 0.00085, 1301);
      if (n > 0.47) continue;
      const strength = Math.min(0.16, (0.47 - n) * 0.55);
      const s = toScreen(wx, wy);
      const rad = STEP * 1.5;
      const g = c.createRadialGradient(s.x - ox, s.y - oy, 0, s.x - ox, s.y - oy, rad);
      g.addColorStop(0, `rgba(30,54,26,${strength.toFixed(3)})`);
      g.addColorStop(1, 'rgba(30,54,26,0)');
      c.fillStyle = g;
      c.save();
      // squashed to the ground plane, so the shadow lies ON the field rather
      // than hanging in front of it as a circle
      c.translate(s.x - ox, s.y - oy);
      c.scale(1, ISO_Y / ISO_X);
      c.translate(-(s.x - ox), -(s.y - oy));
      c.beginPath();
      c.arc(s.x - ox, s.y - oy, rad, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
  }
  c.restore();
}

// ─────────────────────────── structures ───────────────────────────

/** A diamond on the ground plane, `w` wide in screen px. */
function groundDiamond(c: CanvasRenderingContext2D, sx: number, sy: number, w: number): void {
  const h = w * (ISO_Y / ISO_X);
  c.beginPath();
  c.moveTo(sx, sy - h / 2);
  c.lineTo(sx + w / 2, sy);
  c.lineTo(sx, sy + h / 2);
  c.lineTo(sx - w / 2, sy);
  c.closePath();
}

/**
 * A timber-framed hut in 3/4 view: a shaded gable roof with courses of tile, a
 * plank wall with a beam frame, and a lit face on the side the sun is on.
 * Every building in the game is a variation of this.
 */
function paintHut(
  c: CanvasRenderingContext2D, hx: number, hy: number, w: number, h: number, roof: string,
): void {
  contactShadow(c, hx + w * 0.14, hy + h * 0.14, w * 0.78, 0.3);

  // wall
  cel(c, rrPath(c, hx - w / 2, hy - h * 0.34, w, h * 0.34, 1.5), P.wood, { depth: 3.4, rim: 1.8 });
  // planking
  c.save();
  rrPath(c, hx - w / 2, hy - h * 0.34, w, h * 0.34, 1.5)();
  c.clip();
  c.strokeStyle = 'rgba(0,0,0,0.16)';
  c.lineWidth = 1.1;
  for (let x = hx - w / 2 + 6; x < hx + w / 2; x += 7) {
    c.beginPath(); c.moveTo(x, hy - h * 0.34); c.lineTo(x, hy); c.stroke();
  }
  c.restore();
  // corner posts
  for (const d of [-1, 1]) {
    cel(c, rrPath(c, hx + d * (w / 2 - 3.5) - 2, hy - h * 0.36, 4, h * 0.36, 1),
      P.woodDark, { depth: 1.4, rim: 0.8, line: 1.4 });
  }
  // a door, so it reads as somewhere people live
  cel(c, () => {
    c.beginPath();
    c.roundRect(hx - w * 0.11, hy - h * 0.26, w * 0.22, h * 0.26, [w * 0.11, w * 0.11, 0, 0]);
  }, '#3a2a1c', { depth: 1.4, rim: 0.8, line: 1.4 });

  // roof: two slopes meeting at a ridge, with courses of tile
  const eaves = w * 0.62;
  const peak = hy - h;
  cel(c, polyPath(c, [
    hx - eaves, hy - h * 0.3, hx, peak, hx + eaves, hy - h * 0.3, hx + eaves * 0.86, hy - h * 0.22,
    hx, peak + h * 0.08, hx - eaves * 0.86, hy - h * 0.22,
  ]), roof, { depth: 4, rim: 2 });
  c.save();
  polyPath(c, [hx - eaves, hy - h * 0.3, hx, peak, hx + eaves, hy - h * 0.3])();
  c.clip();
  c.strokeStyle = 'rgba(0,0,0,0.18)';
  c.lineWidth = 1.3;
  for (let i = 1; i < 5; i++) {
    const y = peak + (hy - h * 0.3 - peak) * (i / 5);
    c.beginPath(); c.moveTo(hx - eaves, y); c.lineTo(hx + eaves, y); c.stroke();
  }
  // the lit slope
  c.fillStyle = 'rgba(255,255,255,0.13)';
  c.beginPath();
  c.moveTo(hx, peak); c.lineTo(hx - eaves, hy - h * 0.3); c.lineTo(hx, hy - h * 0.3);
  c.closePath(); c.fill();
  c.restore();
  // ridge beam
  cel(c, rrPath(c, hx - 2, peak - 1, 4, h * 0.1, 1.4), P.woodDark, { depth: 1, rim: 0.6, line: 1.3 });
}

/** A recruit pad: a flat plate on the ground with a barracks hut behind it. */
function paintPad(c: CanvasRenderingContext2D, sx: number, sy: number): void {
  // The plate is painted OLIVE rather than green: a bright green plate on a
  // bright green field is invisible, which is exactly the mistake a first pass
  // makes. The bright inner diamond is the part you stand on.
  groundDiamond(c, sx, sy, 158);
  c.fillStyle = 'rgba(0,0,0,0.16)';
  c.fill();
  groundDiamond(c, sx, sy, 150);
  c.fillStyle = '#8a8f4e';
  c.fill();
  groundDiamond(c, sx, sy, 118);
  const g = c.createLinearGradient(sx - 60, sy - 30, sx + 60, sy + 30);
  g.addColorStop(0, '#96e055');
  g.addColorStop(1, '#63b52f');
  c.fillStyle = g;
  c.fill();
  // paving joints across the plate, following the iso axes
  c.save();
  groundDiamond(c, sx, sy, 118);
  c.clip();
  c.strokeStyle = 'rgba(0,0,0,0.1)';
  c.lineWidth = 1.4;
  for (let i = -3; i <= 3; i++) {
    c.beginPath();
    c.moveTo(sx + i * 18, sy - 40); c.lineTo(sx + i * 18 + 60, sy - 40 + 34);
    c.moveTo(sx + i * 18, sy + 40); c.lineTo(sx + i * 18 + 60, sy + 40 - 34);
    c.stroke();
  }
  c.restore();
  groundDiamond(c, sx, sy, 150);
  c.strokeStyle = hex(C.bone);
  c.lineWidth = 3;
  c.setLineDash([12, 9]);
  c.stroke();
  c.setLineDash([]);

  paintHut(c, sx - 96, sy - 30, 66, 56, '#8a4f34');
  // crossed weapons on the gable, the universal sign for "recruit here"
  const gx = sx - 96, gy = sy - 62;
  for (const d of [-1, 1]) {
    cel(c, rrPath(c, gx - 1.6, gy - 12, 3.2, 24, 1.4), P.bone, { depth: 1, rim: 0.6, line: 1.3 });
    c.save();
    c.translate(gx, gy);
    c.rotate(d * 0.66);
    c.translate(-gx, -gy);
    cel(c, rrPath(c, gx - 1.6, gy - 12, 3.2, 24, 1.4), P.steel, { depth: 1, rim: 0.6, line: 1.3 });
    c.restore();
  }
}

/** A camp: a scorched circle, a firepit, tents and junk. */
function paintCamp(c: CanvasRenderingContext2D, sx: number, sy: number, r: () => number): void {
  groundDiamond(c, sx, sy, 300);
  c.save();
  c.beginPath();
  c.ellipse(sx, sy, 150, 150 * (ISO_Y / ISO_X), 0, 0, Math.PI * 2);
  c.fillStyle = 'rgba(122,88,46,0.55)';
  c.fill();
  c.clip();
  // trodden ground: patches of bare earth inside the ring
  for (let i = 0; i < 14; i++) {
    c.fillStyle = i % 2 ? 'rgba(96,68,36,0.4)' : 'rgba(150,116,66,0.35)';
    c.beginPath();
    c.ellipse(sx + (r() - 0.5) * 250, sy + (r() - 0.5) * 130,
      12 + r() * 26, (6 + r() * 12), 0, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();

  // firepit: a ring of stones and a lit fire
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    cel(c, ellPath(c, sx + Math.cos(a) * 22, sy + Math.sin(a) * 12, 5.4, 4),
      P.stone, { depth: 1.6, rim: 0.9, line: 1.4, dark: P.stoneDark });
  }
  cel(c, ellPath(c, sx, sy, 15, 8), '#3a2d1c', { depth: 1.4, rim: 0.7 });
  for (const d of [-1, 1]) {
    cel(c, rrPath(c, sx - 9 * d, sy - 5, 18, 3.4, 1.4), P.woodDark,
      { depth: 1, rim: 0.5, line: 1.3 });
  }
  cel(c, polyPath(c, [sx - 7, sy - 3, sx - 2, sy - 16, sx + 1, sy - 8, sx + 5, sy - 20, sx + 8, sy - 2]),
    '#f7a53a', { depth: 2, rim: 1, line: 0 });

  // tents, ringing the fire
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.6;
    const tx = sx + Math.cos(a) * 96;
    const ty = sy + Math.sin(a) * 52;
    contactShadow(c, tx + 4, ty + 2, 26, 0.28);
    cel(c, polyPath(c, [tx - 24, ty, tx, ty - 34, tx + 24, ty]), '#7d4a3a',
      { depth: 3, rim: 1.6 });
    cel(c, polyPath(c, [tx - 6, ty, tx, ty - 20, tx + 6, ty]), '#2e1f18',
      { depth: 1.4, rim: 0.7, line: 1.4 });
  }

  // junk: crates and barrels
  for (let i = 0; i < 5; i++) {
    const a = r() * Math.PI * 2, d = 60 + r() * 80;
    const px = sx + Math.cos(a) * d, py = sy + Math.sin(a) * d * (ISO_Y / ISO_X);
    contactShadow(c, px + 2, py + 1, 12, 0.24);
    if (i % 2) {
      cel(c, rrPath(c, px - 9, py - 15, 18, 15, 2), P.wood, { depth: 2.4, rim: 1.2 });
      cel(c, rrPath(c, px - 9, py - 10, 18, 3, 1), P.woodDark, { depth: 1, rim: 0.5, line: 1.3 });
    } else {
      cel(c, rrPath(c, px - 7, py - 17, 14, 17, 5), P.stoneDark, { depth: 2.4, rim: 1.2 });
    }
  }
}

/** The keep: a wall of blocks with a gate, filling the back of the map. */
function paintCastle(c: CanvasRenderingContext2D, sx: number, sy: number): void {
  const wallW = 620;
  contactShadow(c, sx + 20, sy + 16, wallW * 0.44, 0.3);

  // three stepped blocks receding, so the wall reads as mass not a flat card
  for (let i = 2; i >= 0; i--) {
    const w = wallW - i * 90;
    const top = sy - 150 - i * 74;
    const bh = 130 + i * 40;
    const base = i === 0 ? P.stone : i === 1 ? tint(P.stone, -0.12) : P.stoneDark;
    cel(c, rrPath(c, sx - w / 2, top, w, bh, 3), base, { depth: 10, rim: 5 });
    // crenellations
    for (let x = -w / 2; x < w / 2 - 20; x += 46) {
      cel(c, rrPath(c, sx + x, top - 24, 28, 26, 2), base, { depth: 4, rim: 2 });
    }
    // courses of block, and a scatter of darker stones so the wall has texture
    c.save();
    rrPath(c, sx - w / 2, top, w, bh, 3)();
    c.clip();
    c.strokeStyle = 'rgba(0,0,0,0.17)';
    c.lineWidth = 1.6;
    for (let y = top + 22; y < top + bh; y += 24) {
      c.beginPath(); c.moveTo(sx - w / 2, y); c.lineTo(sx + w / 2, y); c.stroke();
    }
    const rr2 = tileRng(Math.round(sx) + i, Math.round(sy), 313);
    for (let k = 0; k < 26; k++) {
      const bx = sx - w / 2 + rr2() * w;
      const by = top + 22 + Math.floor(rr2() * ((bh - 22) / 24)) * 24;
      c.fillStyle = rr2() < 0.5 ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.09)';
      c.fillRect(bx, by + 2, 22 + rr2() * 18, 20);
    }
    c.restore();
  }

  // the gate: an arch, a portcullis and iron banding
  cel(c, () => {
    c.beginPath();
    c.moveTo(sx - 82, sy + 12);
    c.lineTo(sx - 82, sy - 76);
    c.arc(sx, sy - 76, 82, Math.PI, 0);
    c.lineTo(sx + 82, sy + 12);
    c.closePath();
  }, tint(P.stone, -0.2), { depth: 6, rim: 3 });
  cel(c, () => {
    c.beginPath();
    c.moveTo(sx - 66, sy + 10);
    c.lineTo(sx - 66, sy - 74);
    c.arc(sx, sy - 74, 66, Math.PI, 0);
    c.lineTo(sx + 66, sy + 10);
    c.closePath();
  }, P.wood, { depth: 5, rim: 2.6 });
  c.save();
  c.beginPath();
  c.moveTo(sx - 66, sy + 10);
  c.lineTo(sx - 66, sy - 74);
  c.arc(sx, sy - 74, 66, Math.PI, 0);
  c.lineTo(sx + 66, sy + 10);
  c.closePath();
  c.clip();
  c.fillStyle = 'rgba(0,0,0,0.28)';
  for (let x = -60; x < 62; x += 22) c.fillRect(sx + x, sy - 150, 7, 200);
  c.restore();
  // iron bands and studs
  for (const y of [sy - 62, sy - 20]) {
    cel(c, rrPath(c, sx - 68, y, 136, 9, 2), P.steelDark, { depth: 1.6, rim: 0.9, line: 1.4 });
    for (let x = -58; x < 60; x += 20) {
      cel(c, ellPath(c, sx + x, y + 4.5, 3, 3), P.steel, { depth: 1, rim: 0.6, line: 1 });
    }
  }

  // banners either side, with a device on them
  for (const dx of [-160, 160]) {
    cel(c, polyPath(c, [
      sx + dx - 20, sy - 156, sx + dx + 20, sy - 156,
      sx + dx + 20, sy - 62, sx + dx, sy - 82, sx + dx - 20, sy - 62,
    ]), P.foe, { depth: 5, rim: 2.4 });
    cel(c, ellPath(c, sx + dx, sy - 122, 11, 11), P.gold, { depth: 3, rim: 1.6 });
  }
}

/** The muster point you start on: a friendly plaza with a few huts. */
function paintStart(c: CanvasRenderingContext2D, sx: number, sy: number): void {
  const w = 340;
  c.save();
  c.beginPath();
  c.ellipse(sx, sy, w / 2, (w / 2) * (ISO_Y / ISO_X), 0, 0, Math.PI * 2);
  c.fillStyle = 'rgba(216,180,119,0.9)';
  c.fill();
  c.clip();
  // cobbles
  const r = tileRng(Math.round(sx), Math.round(sy), 55);
  for (let i = 0; i < 90; i++) {
    c.fillStyle = r() < 0.5 ? 'rgba(196,160,102,0.55)' : 'rgba(238,212,164,0.5)';
    c.beginPath();
    c.ellipse(sx + (r() - 0.5) * w, sy + (r() - 0.5) * w * 0.58,
      5 + r() * 6, 3 + r() * 3, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
  c.strokeStyle = 'rgba(255,246,226,0.55)';
  c.lineWidth = 4;
  c.beginPath();
  c.ellipse(sx, sy, w / 2, (w / 2) * (ISO_Y / ISO_X), 0, 0, Math.PI * 2);
  c.stroke();

  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.5;
    paintHut(c, sx + Math.cos(a) * 138, sy + Math.sin(a) * 138 * (ISO_Y / ISO_X),
      54, 46, i % 2 ? '#8a4f34' : '#6f5a3a');
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
  // Two passes. The first lays the diamonds; the second scatters grass over
  // the seams. A single flat pass is what makes procedural ground look like a
  // spreadsheet, and the tufts cost a few strokes per tile.
  for (let ty = 0; ty < N; ty++) {
    for (let tx = 0; tx < N; tx++) {
      const wx = wx0 + tx * T, wy = wy0 + ty * T;
      const r = tileRng(Math.round(wx / T), Math.round(wy / T));
      // jitter the biome sample so shade borders are ragged, not gridded
      const g = GROUND[biomeAt(wx + (r() - 0.5) * T * 1.4, wy + (r() - 0.5) * T * 1.4)];

      // Each tile is quartered and each quarter takes its own sample of the
      // continuous field. Sampling once per TILE would still leave a lattice —
      // finer than before, but a lattice. Quartering costs four fills instead
      // of one and puts the colour steps at half the frequency the eye is
      // looking for, which is what finally kills the grid.
      const half = T / 2;
      for (let qy = 0; qy < 2; qy++) {
        for (let qx = 0; qx < 2; qx++) {
          const sx0 = wx + qx * half, sy0 = wy + qy * half;
          tilePathSize(c, sx0, sy0, half, ox, oy);
          c.fillStyle = groundTone(sx0 + half * 0.5, sy0 + half * 0.5, g);
          c.fill();
        }
      }
    }
  }

  // grass, scattered on a finer grid than the tiles
  for (let ty = 0; ty < N * 2; ty++) {
    for (let tx = 0; tx < N * 2; tx++) {
      const wx = wx0 + tx * (T / 2) + T / 4, wy = wy0 + ty * (T / 2) + T / 4;
      const r = tileRng(Math.round(wx), Math.round(wy), 4242);
      if (r() > 0.42) continue;
      if (roadDist(wx, wy) < 60) continue;
      const g = GROUND[biomeAt(wx, wy)];
      const sp = toScreen(wx, wy);
      paintTuft(c, sp.x - ox, sp.y - oy, r, g.speck);
      // Flowers come in patches, not evenly. Gating them on a slow noise field
      // rather than on the per-tile roll means a meadow has flowery corners
      // and bare corners, which is what a meadow has.
      if (fbm(wx * 0.006, wy * 0.006, 55) > 0.62 && r() < 0.22) {
        paintFlowers(c, sp.x - ox, sp.y - oy, r);
      }
    }
  }

  // ── road, painted per tile so it follows the diamonds ──
  for (let ty = -1; ty <= N; ty++) {
    for (let tx = -1; tx <= N; tx++) {
      const wx = wx0 + tx * T, wy = wy0 + ty * T;
      const d = roadDist(wx + T / 2, wy + T / 2);
      if (d > 90) continue;
      const r = tileRng(Math.round(wx), Math.round(wy), 707);
      // A ragged edge, not a clean one. The road is a track worn by feet, and
      // the give-away that it was drawn by a distance function is a border of
      // perfectly constant width — so the fade threshold itself gets noise.
      const edge = 52 + fbm(wx * 0.02, wy * 0.02, 909) * 26 - 13;
      const a = d < edge ? 0.95 : 0.95 * (1 - (d - edge) / 38);
      if (a <= 0) continue;
      tilePath(c, wx, wy, ox, oy);
      // Dust in the middle, damp packed earth at the margins, because the
      // middle is where boots keep the grass off.
      c.fillStyle = d < edge * 0.55
        ? `rgba(222,188,128,${a.toFixed(3)})`
        : `rgba(198,163,106,${a.toFixed(3)})`;
      c.fill();

      if (d < edge * 0.9) {
        // Ruts run ALONG the track. Two parallel wheel lines drawn on the
        // screen's axes would cross the road diagonally and read as scratches;
        // stepping along the road's own gradient keeps them where cart wheels
        // would actually have cut them.
        const g = 6;
        const gx = (roadDist(wx + g, wy) - roadDist(wx - g, wy));
        const gy = (roadDist(wx, wy + g) - roadDist(wx, wy - g));
        const gl = Math.hypot(gx, gy) || 1;
        // along the road = perpendicular to the distance gradient
        const ax = -gy / gl, ay = gx / gl;
        for (const side of [-1, 1]) {
          if (r() > 0.5) continue;
          const cx = wx + T / 2 + (gx / gl) * side * 15;
          const cy = wy + T / 2 + (gy / gl) * side * 15;
          const p0 = toScreen(cx - ax * T * 0.4, cy - ay * T * 0.4);
          const p1 = toScreen(cx + ax * T * 0.4, cy + ay * T * 0.4);
          c.strokeStyle = 'rgba(168,133,80,0.32)';
          c.lineWidth = 2.4;
          c.lineCap = 'round';
          c.beginPath();
          c.moveTo(p0.x - ox, p0.y - oy);
          c.lineTo(p1.x - ox, p1.y - oy);
          c.stroke();
        }
        // loose stones
        if (r() < 0.45) {
          const s2 = toScreen(wx + T / 2, wy + T / 2);
          c.fillStyle = r() < 0.5 ? 'rgba(150,140,128,0.55)' : 'rgba(238,212,164,0.5)';
          c.beginPath();
          c.ellipse(s2.x - ox + (r() - 0.5) * 22, s2.y - oy + (r() - 0.5) * 11,
            1.6 + r() * 2.6, 1 + r() * 1.4, 0, 0, Math.PI * 2);
          c.fill();
        }
      }
    }
  }

  // ── light, before anything that stands up off the ground ──
  paintCloudShade(c, wx0, wy0, ox, oy);

  // ── props last: they sit on top of everything on the ground plane ──
  for (let ty = 0; ty < N; ty++) {
    for (let tx = 0; tx < N; tx++) {
      const wx = wx0 + tx * T + T / 2, wy = wy0 + ty * T + T / 2;
      const r = tileRng(Math.round(wx / T) + 7777, Math.round(wy / T) + 31);
      // props are denser and larger than they were, so fewer of them: a field
      // you cannot see the enemies across is not a nicer field
      if (r() > clutterAt(wx, wy) * 0.36) continue;
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
      paintProp(c, pickProp(r()), s.x - ox, s.y - oy, r);
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
  castle: { x: 340, y: 348, w: 680, h: 520 },
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

  // Structures are supersampled 2×. There are sixteen of them in the whole
  // field and they are the things a player actually looks at, so the memory is
  // well spent — unlike on terrain chunks, where the same trick would cost
  // tens of megabytes for ground the eye slides over.
  const SS = 2;
  const canvas = document.createElement('canvas');
  canvas.width = box.w * SS;
  canvas.height = box.h * SS;
  const c = canvas.getContext('2d')!;
  c.scale(SS, SS);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  const r = tileRng(Math.round(p.x), Math.round(p.y), 99);
  if (p.kind === 'pad') paintPad(c, box.x, box.y);
  else if (p.kind === 'camp') paintCamp(c, box.x, box.y, r);
  else if (p.kind === 'castle') paintCastle(c, box.x, box.y);
  else if (p.kind === 'start') paintStart(c, box.x, box.y);

  const source = new CanvasSource({ resource: canvas, resolution: SS, scaleMode: 'linear' });
  const made = { tex: new Texture({ source }), ox: box.x, oy: box.y };
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
