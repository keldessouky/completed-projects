import { CanvasSource, Texture } from 'pixi.js';
import { CONFIG } from '../config';
import { ISO_X, ISO_Y, blockBounds, toScreen } from '../iso';
import { biomeAt, clutterAt, getWorld, roadDist, type Biome } from '../world/worldgen';
import { hex } from './palette';
import { P } from './palette';
import { cel, contactShadow, ellPath, polyPath, rrPath, tint } from './shade';

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
  if (kind === 'tree') {
    const h = 44 + r() * 20;
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
        i === lobes.length - 1 ? tint(P.tree, 0.1) : P.tree,
        { depth: rad * 0.42, rim: rad * 0.22, dark: P.treeDark });
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
  const n = 2 + Math.floor(r() * 2);
  const lit = tint(base, 0.2);
  const dark = tint(base, -0.16);
  for (let i = 0; i < n; i++) {
    const x = sx + (r() - 0.5) * 14;
    const y = sy + (r() - 0.5) * 7;
    const h = 3.4 + r() * 3.4;
    const lean = (r() - 0.5) * 3.2;
    c.strokeStyle = i === 0 ? dark : lit;
    c.lineWidth = 1.5;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x, y);
    c.quadraticCurveTo(x + lean * 0.4, y - h * 0.6, x + lean, y - h);
    c.stroke();
  }
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
      tilePath(c, wx, wy, ox, oy);
      c.fillStyle = r() < 0.76 ? g.base : g.alt;
      c.fill();
      if (r() < 0.34) {
        c.fillStyle = g.speck;
        c.globalAlpha = 0.2 + r() * 0.2;
        c.fill();
        c.globalAlpha = 1;
      }
      // a soft dark edge along the two far sides of each diamond, so the
      // ground has grain instead of being a field of solid lozenges
      if (r() < 0.5) {
        const a = toScreen(wx, wy), b2 = toScreen(wx + T, wy), d2 = toScreen(wx + T, wy + T);
        c.strokeStyle = 'rgba(40,64,26,0.09)';
        c.lineWidth = 1.6;
        c.beginPath();
        c.moveTo(a.x - ox, a.y - oy);
        c.lineTo(b2.x - ox, b2.y - oy);
        c.lineTo(d2.x - ox, d2.y - oy);
        c.stroke();
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
      // ruts and stones, only on the packed middle of the track
      if (d < 46) {
        const r = tileRng(Math.round(wx), Math.round(wy), 707);
        if (r() < 0.4) {
          const s2 = toScreen(wx + T / 2, wy + T / 2);
          c.fillStyle = r() < 0.5 ? 'rgba(176,142,88,0.5)' : 'rgba(238,212,164,0.45)';
          c.beginPath();
          c.ellipse(s2.x - ox + (r() - 0.5) * 20, s2.y - oy + (r() - 0.5) * 10,
            3 + r() * 4, 1.6 + r() * 2, 0, 0, Math.PI * 2);
          c.fill();
        }
      }
    }
  }

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
