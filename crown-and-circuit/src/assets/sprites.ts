import { CONFIG } from '../config';
import { Px, ramp, shift, T, type Ramp } from './pixel';

/**
 * Every sprite in the game, authored on a pixel grid.
 *
 * The shared grammar: a 3/4 top-down view, one light source at the upper left,
 * three tones per material, and a hard outline tinted toward the material it
 * surrounds. Units are built by a parameterised generator rather than hand-drawn
 * per era, so twenty unit sprites stay consistent with each other.
 */

const SKIN = ramp(0xd8a06a, -0.3, 0.22);
const OUT = 0x14131a;

export interface UnitOpts {
  cloth: Ramp;
  metal: Ramp;
  accent: number;
  /** 0 none, 1 cap, 2 helm, 3 great-helm/visor */
  helm: number;
  /** which era's weapon to arm them with */
  era: number;
  /** taller, broader frame for the king */
  royal?: boolean;
  cape?: number;
  /** walk-cycle frame 0..3 (0 and 2 are the passing poses) */
  frame?: number;
}

/** A humanoid on a 14×18 grid (18×22 for the king). */
export function unitSprite(o: UnitOpts): Px {
  const royal = !!o.royal;
  const w = royal ? 18 : 14;
  const h = royal ? 22 : 18;
  const p = new Px(w, h);
  const cx = (w >> 1) - 1;          // left pixel of the 2-wide centre column
  const footY = h - 2;
  // 4-frame walk: legs alternate, and the whole body bobs on the passing poses
  const f = ((o.frame ?? 0) % 4 + 4) % 4;
  const bob = f === 1 || f === 3 ? -1 : 0;
  const legL = f === 1 ? 1 : f === 3 ? -1 : 0;
  const legR = -legL;

  // ---- cape behind everything (royalty and elite tiers)
  if (o.cape !== undefined) {
    const cr = ramp(o.cape);
    p.rect(cx - 3, 7, 8, footY - 8, cr.base);
    p.rect(cx - 3, 7, 1, footY - 8, cr.light);
    p.rect(cx + 4, 7, 1, footY - 8, cr.dark);
    p.rect(cx - 2, footY - 1, 6, 1, cr.dark);
  }

  // ---- legs (offset per walk frame)
  p.rect(cx - 1 + legL, footY - 4, 2, 4, o.cloth.dark);
  p.rect(cx + 2 + legR, footY - 4, 2, 4, o.cloth.dark);
  p.rect(cx - 1 + legL, footY, 2, 1, OUT);
  p.rect(cx + 2 + legR, footY, 2, 1, OUT);

  // ---- torso
  const ty = (royal ? 9 : 8) + bob;
  const th = footY - 3 - ty;
  p.rect(cx - 2, ty, 6, th, o.cloth.base);
  p.rect(cx - 2, ty, 1, th, o.cloth.light);      // lit left edge
  p.rect(cx + 3, ty, 1, th, o.cloth.dark);       // shaded right edge
  p.rect(cx - 2, ty, 6, 1, o.cloth.light);
  // belt
  p.rect(cx - 2, ty + th - 2, 6, 1, o.metal.dark);
  p.set(cx, ty + th - 2, o.accent);

  // ---- pauldrons / arms
  p.rect(cx - 4, ty + 1, 2, 3, o.metal.base);
  p.rect(cx + 4, ty + 1, 2, 3, o.metal.base);
  p.rect(cx - 4, ty + 1, 1, 1, o.metal.light);
  p.rect(cx + 5, ty + 3, 1, 1, o.metal.dark);
  p.rect(cx - 4, ty + 4, 2, 2, SKIN.base);       // hands
  p.rect(cx + 4, ty + 4, 2, 2, SKIN.base);

  // ---- head
  const hy = ty - 5;
  p.rect(cx - 2, hy, 6, 5, SKIN.base);
  p.rect(cx - 2, hy, 1, 5, SKIN.light);
  p.rect(cx + 3, hy, 1, 5, SKIN.dark);
  p.rect(cx - 1, hy + 3, 1, 1, OUT);             // eyes
  p.rect(cx + 2, hy + 3, 1, 1, OUT);

  // ---- headgear
  if (o.helm === 1) {                            // cloth cap
    p.rect(cx - 2, hy - 1, 6, 2, o.cloth.dark);
    p.rect(cx - 2, hy - 1, 6, 1, o.cloth.base);
  } else if (o.helm === 2) {                     // metal helm
    p.rect(cx - 3, hy - 2, 8, 3, o.metal.base);
    p.rect(cx - 3, hy - 2, 8, 1, o.metal.light);
    p.rect(cx - 3, hy + 1, 8, 1, o.metal.dark);
  } else if (o.helm === 3) {                     // visored helm
    p.rect(cx - 3, hy - 3, 8, 5, o.metal.base);
    p.rect(cx - 3, hy - 3, 8, 1, o.metal.light);
    p.rect(cx - 2, hy + 1, 6, 1, OUT);           // visor slit
    p.set(cx, hy + 1, o.accent);
    p.set(cx + 1, hy + 1, o.accent);
  }
  if (royal) {                                   // crown over whatever else
    const g = ramp(CONFIG.colors.gold);
    p.rect(cx - 3, hy - 4, 8, 2, g.base);
    p.rect(cx - 3, hy - 4, 8, 1, g.light);
    p.set(cx - 3, hy - 6, g.base); p.set(cx - 3, hy - 5, g.base);
    p.set(cx, hy - 6, g.light); p.set(cx, hy - 5, g.base);
    p.set(cx + 4, hy - 6, g.base); p.set(cx + 4, hy - 5, g.base);
  }

  // ---- weapon in the right hand, one silhouette per era
  weapon(p, cx + 5, ty + 4, o.era, o.metal, o.accent);

  p.outline(OUT);
  return p;
}

/** Era weapon, drawn from the hand at (hx, hy) pointing up-right. */
function weapon(p: Px, hx: number, hy: number, era: number, metal: Ramp, accent: number): void {
  const wood = ramp(0x7a5533);
  if (era === 0) {                       // spear + blade
    p.line(hx, hy + 1, hx, hy - 9, wood.base);
    p.set(hx, hy - 9, metal.light);
    p.set(hx, hy - 10, metal.base);
    p.set(hx - 1, hy - 8, metal.base);
    p.set(hx + 1, hy - 8, metal.dark);
  } else if (era === 1) {                // musket: long barrel, thick stock
    p.line(hx, hy, hx + 2, hy - 8, metal.dark);
    p.line(hx - 1, hy + 1, hx + 1, hy - 7, metal.base);
    p.rect(hx - 2, hy + 1, 2, 3, wood.base);
    p.set(hx - 2, hy + 1, wood.light);
  } else if (era === 2) {                // bolt rifle: barrel + bolt nub
    p.line(hx, hy, hx + 2, hy - 9, metal.base);
    p.rect(hx - 2, hy, 3, 3, wood.base);
    p.set(hx - 2, hy, wood.light);
    p.set(hx + 1, hy - 4, metal.light);
  } else if (era === 3) {                // machine gun: heavy body, drum
    p.line(hx, hy, hx + 2, hy - 8, metal.dark);
    p.rect(hx - 2, hy - 1, 4, 4, metal.base);
    p.rect(hx - 2, hy - 1, 4, 1, metal.light);
    p.ellipse(hx - 1, hy + 3, 2, 1.4, metal.dark);
  } else {                               // laser lance: emitter glow
    p.line(hx, hy, hx + 2, hy - 9, metal.dark);
    p.rect(hx - 2, hy - 1, 4, 4, metal.base);
    p.rect(hx - 2, hy - 1, 4, 1, metal.light);
    p.set(hx + 2, hy - 9, accent);
    p.set(hx + 2, hy - 10, shift(accent, 0.4));
    p.set(hx + 1, hy - 9, accent);
  }
}

// ---------------------------------------------------------------- enemies

export function runnerSprite(base: number): Px {
  const p = new Px(14, 15);
  const r = ramp(base);
  const cx = 6;
  p.rect(cx - 1, 11, 2, 3, r.dark);
  p.rect(cx + 2, 11, 2, 3, r.dark);
  p.rect(cx - 2, 6, 6, 6, r.base);      // hunched torso
  p.rect(cx - 2, 6, 1, 6, r.light);
  p.rect(cx + 3, 6, 1, 6, r.dark);
  p.rect(cx - 4, 7, 2, 4, r.base);      // long dangling arms
  p.rect(cx + 4, 7, 2, 4, r.base);
  p.ellipse(cx + 1, 3, 3, 3, r.base);   // head
  p.rect(cx - 1, 2, 1, 3, r.light);
  p.set(cx, 3, 0xffe08a);               // burning eyes
  p.set(cx + 2, 3, 0xffe08a);
  p.rect(cx - 1, 5, 4, 1, shift(base, -0.55));
  p.outline(OUT);
  return p;
}

export function bruteSprite(base: number): Px {
  const p = new Px(22, 21);
  const r = ramp(base);
  const cx = 10;
  p.rect(cx - 3, 16, 3, 4, r.dark);
  p.rect(cx + 2, 16, 3, 4, r.dark);
  p.rect(cx - 5, 7, 12, 10, r.base);    // slab of a torso
  p.rect(cx - 5, 7, 1, 10, r.light);
  p.rect(cx + 6, 7, 1, 10, r.dark);
  p.rect(cx - 5, 7, 12, 1, r.light);
  p.dither(cx - 4, 12, 10, 4, r.dark, 3);
  p.rect(cx - 8, 8, 3, 7, r.base);      // massive arms
  p.rect(cx + 7, 8, 3, 7, r.base);
  p.rect(cx - 8, 8, 1, 7, r.light);
  p.rect(cx - 2, 1, 6, 6, r.base);      // small sunken head
  p.rect(cx - 2, 1, 1, 6, r.light);
  p.rect(cx - 1, 4, 1, 1, 0xffb03a);
  p.rect(cx + 2, 4, 1, 1, 0xffb03a);
  p.rect(cx - 3, 6, 8, 1, shift(base, -0.6));
  p.outline(OUT);
  return p;
}

export function shooterSprite(base: number): Px {
  const p = new Px(16, 16);
  const r = ramp(base);
  const cx = 6;
  p.rect(cx - 1, 12, 2, 3, r.dark);
  p.rect(cx + 2, 12, 2, 3, r.dark);
  p.rect(cx - 2, 6, 6, 7, r.base);
  p.rect(cx - 2, 6, 1, 7, r.light);
  p.rect(cx + 3, 6, 1, 7, r.dark);
  p.ellipse(cx + 1, 3, 3, 3, r.base);
  p.set(cx, 3, 0x9ff0ff);
  p.set(cx + 2, 3, 0x9ff0ff);
  // levelled weapon, the tell that it shoots
  const m = ramp(0x8b8f96);
  p.line(cx + 4, 9, cx + 10, 7, m.base);
  p.set(cx + 10, 7, m.light);
  p.rect(cx + 3, 8, 2, 3, m.dark);
  p.outline(OUT);
  return p;
}

export function flyerSprite(base: number, wingUp: boolean): Px {
  const p = new Px(22, 14);
  const r = ramp(base);
  const cx = 10;
  const wy = wingUp ? 2 : 7;
  p.line(cx - 2, 6, cx - 9, wy, r.base);
  p.line(cx - 2, 7, cx - 9, wy + 1, r.dark);
  p.line(cx - 3, 6, cx - 8, wy + 1, r.light);
  p.line(cx + 3, 6, cx + 10, wy, r.base);
  p.line(cx + 3, 7, cx + 10, wy + 1, r.dark);
  p.ellipse(cx, 7, 3, 4, r.base);       // body
  p.rect(cx - 3, 4, 1, 5, r.light);
  p.ellipse(cx, 3, 2.4, 2.2, r.light);  // head
  p.set(cx - 1, 3, OUT);
  p.set(cx + 1, 3, OUT);
  p.rect(cx - 1, 11, 2, 2, r.dark);     // tail
  p.outline(OUT);
  return p;
}

export function bossSprite(base: number, accent: number): Px {
  const p = new Px(34, 30);
  const r = ramp(base);
  const cx = 16;
  p.rect(cx - 5, 24, 4, 5, r.dark);
  p.rect(cx + 2, 24, 4, 5, r.dark);
  p.rect(cx - 9, 10, 19, 15, r.base);          // huge chest
  p.rect(cx - 9, 10, 1, 15, r.light);
  p.rect(cx + 9, 10, 1, 15, r.dark);
  p.rect(cx - 9, 10, 19, 1, r.light);
  p.dither(cx - 8, 17, 17, 7, r.dark, 3);
  p.rect(cx - 13, 11, 4, 11, r.base);          // arms
  p.rect(cx + 10, 11, 4, 11, r.base);
  p.rect(cx - 13, 11, 1, 11, r.light);
  p.rect(cx - 5, 2, 10, 9, r.base);            // head
  p.rect(cx - 5, 2, 1, 9, r.light);
  p.rect(cx - 5, 2, 10, 1, r.light);
  // horns
  p.line(cx - 5, 2, cx - 9, -2, r.light);
  p.line(cx + 4, 2, cx + 8, -2, r.light);
  p.rect(cx - 3, 6, 2, 2, accent);             // glowing eyes
  p.rect(cx + 2, 6, 2, 2, accent);
  p.rect(cx - 4, 10, 8, 1, shift(base, -0.6));
  // banner plate on the chest
  p.rect(cx - 3, 13, 6, 5, shift(accent, -0.35));
  p.rect(cx - 3, 13, 6, 1, accent);
  p.outline(OUT);
  return p;
}

// ---------------------------------------------------------------- structures

/** Towers: one silhouette family per era, sharing a stone base. */
export function towerSprite(era: number): Px {
  const pal = CONFIG.palettes[era];
  const stone = ramp(pal.stone);
  const dark = ramp(pal.stoneDark);
  const accent = pal.accent;
  const p = new Px(20, 28);
  const cx = 9;

  // base + plinth, shared across eras so the fort reads as one structure
  p.rect(cx - 7, 18, 16, 9, dark.base);
  p.rect(cx - 7, 18, 16, 1, dark.light);
  p.rect(cx - 7, 26, 16, 1, shift(pal.stoneDark, -0.4));
  p.rect(cx - 5, 10, 12, 9, stone.base);
  p.rect(cx - 5, 10, 1, 9, stone.light);
  p.rect(cx + 6, 10, 1, 9, stone.dark);
  p.dither(cx - 4, 13, 10, 5, stone.dark, 3);

  if (era === 0) {                        // battlement + arrow slit
    for (let i = 0; i < 4; i++) p.rect(cx - 5 + i * 4, 7, 2, 3, stone.base);
    p.rect(cx - 5, 7, 12, 1, stone.light);
    p.rect(cx, 12, 1, 4, OUT);
    p.rect(cx - 1, 3, 3, 5, ramp(accent).base);   // pennant
    p.rect(cx - 1, 3, 1, 5, ramp(accent).light);
    p.line(cx + 2, 2, cx + 2, 8, dark.base);
  } else if (era === 1) {                 // cannon barrel out the top-right
    const m = ramp(0x4e4a44);
    p.rect(cx - 4, 6, 10, 4, stone.dark);
    p.line(cx + 1, 6, cx + 8, 1, m.base);
    p.line(cx + 1, 7, cx + 8, 2, m.dark);
    p.set(cx + 8, 1, m.light);
    p.ellipse(cx - 2, 8, 2, 2, m.base);
  } else if (era === 2) {                 // gatling: three barrels + hopper
    const m = ramp(0x6a6f76);
    p.rect(cx - 4, 5, 10, 5, m.base);
    p.rect(cx - 4, 5, 10, 1, m.light);
    for (let i = 0; i < 3; i++) p.line(cx + 3, 6 + i, cx + 9, 3 + i, m.dark);
    p.rect(cx - 6, 3, 4, 4, ramp(accent).base);
  } else if (era === 3) {                 // missile rack
    const m = ramp(0x5c6357);
    p.rect(cx - 6, 5, 13, 5, m.base);
    p.rect(cx - 6, 5, 13, 1, m.light);
    for (let i = 0; i < 3; i++) {
      const x = cx - 5 + i * 4;
      p.rect(x, 1, 3, 4, ramp(accent).base);
      p.set(x + 1, 0, ramp(accent).light);
      p.rect(x, 1, 1, 4, ramp(accent).light);
    }
  } else {                                // plasma emitter, glowing core
    const m = ramp(0x2b2740);
    p.rect(cx - 4, 4, 10, 6, m.base);
    p.rect(cx - 4, 4, 10, 1, m.light);
    p.ellipse(cx, 4, 3, 3, shift(accent, -0.2));
    p.ellipse(cx, 4, 1.6, 1.6, shift(accent, 0.5));
    p.rect(cx - 6, 11, 14, 1, accent);
    p.set(cx - 6, 2, accent);
    p.set(cx + 7, 2, accent);
  }

  p.outline(OUT);
  return p;
}

/** The keep: castle → bunker → spire. */
export function keepSprite(era: number): Px {
  const pal = CONFIG.palettes[era];
  const stone = ramp(pal.stone);
  const dark = ramp(pal.stoneDark);
  const accent = pal.accent;
  const p = new Px(38, 38);
  const cx = 18;

  p.rect(cx - 15, 20, 32, 17, dark.base);          // main block
  p.rect(cx - 15, 20, 32, 1, dark.light);
  p.rect(cx - 15, 36, 32, 1, shift(pal.stoneDark, -0.45));
  p.rect(cx - 12, 12, 26, 9, stone.base);
  p.rect(cx - 12, 12, 1, 9, stone.light);
  p.rect(cx + 13, 12, 1, 9, stone.dark);
  p.dither(cx - 11, 24, 26, 10, shift(pal.stoneDark, -0.18), 3);

  // gate
  p.rect(cx - 4, 28, 9, 9, shift(pal.stoneDark, -0.6));
  p.ellipse(cx, 28, 4.5, 3, shift(pal.stoneDark, -0.6));
  p.rect(cx - 4, 28, 1, 9, dark.light);

  if (era <= 1) {
    for (let i = 0; i < 7; i++) p.rect(cx - 15 + i * 5, 17, 3, 3, stone.base);
    p.rect(cx - 5, 2, 11, 11, stone.base);         // central tower
    p.rect(cx - 5, 2, 1, 11, stone.light);
    p.line(cx - 7, 2, cx, -4, ramp(accent).base);  // banner roof
    p.line(cx + 6, 2, cx, -4, ramp(accent).dark);
    p.rect(cx - 6, 1, 13, 1, ramp(accent).light);
    p.rect(cx - 2, 6, 3, 5, OUT);
  } else if (era <= 3) {
    p.rect(cx - 17, 14, 36, 5, dark.base);         // wide bunker lip
    p.rect(cx - 17, 14, 36, 1, dark.light);
    p.rect(cx - 6, 4, 12, 10, stone.base);
    p.rect(cx - 6, 4, 1, 10, stone.light);
    p.rect(cx - 4, 7, 8, 2, OUT);                  // slit
    p.line(cx, 4, cx, -4, ramp(accent).base);      // antenna mast
    p.rect(cx - 4, -4, 9, 1, ramp(accent).base);
    p.set(cx, -6, ramp(accent).light);
  } else {
    p.rect(cx - 9, 6, 19, 15, ramp(pal.stoneDark).base);
    p.rect(cx - 9, 6, 1, 15, ramp(pal.stone).light);
    // tapering spire
    for (let i = 0; i < 6; i++) p.rect(cx - 6 + i, 4 - i, 13 - i * 2, 2, ramp(pal.stone).base);
    p.rect(cx - 1, -8, 3, 6, shift(accent, -0.2));
    p.set(cx, -10, shift(accent, 0.55));
    for (let i = 0; i < 3; i++) p.rect(cx - 12, 24 + i * 4, 26, 1, accent);
  }

  p.outline(OUT);
  return p;
}

/** A wall block, tiled along ring arcs. */
export function wallSprite(era: number): Px {
  const pal = CONFIG.palettes[era];
  const stone = ramp(pal.stone);
  const p = new Px(14, 14);
  p.rect(1, 4, 12, 9, stone.base);
  p.rect(1, 4, 12, 1, stone.light);
  p.rect(1, 12, 12, 1, stone.dark);
  // course joints
  p.rect(1, 8, 12, 1, stone.dark);
  p.set(4, 6, stone.dark); p.set(9, 6, stone.dark);
  p.set(6, 11, stone.dark); p.set(11, 11, stone.dark);
  if (era >= 4) {
    p.rect(1, 4, 12, 1, pal.accent);
  } else {
    p.rect(2, 1, 3, 3, stone.base);   // crenellations
    p.rect(9, 1, 3, 3, stone.base);
    p.rect(2, 1, 3, 1, stone.light);
    p.rect(9, 1, 3, 1, stone.light);
  }
  p.outline(OUT);
  return p;
}

export function coinSprite(): Px {
  const p = new Px(8, 8);
  const g = ramp(CONFIG.colors.gold, -0.35, 0.35);
  p.ellipse(3.5, 3.5, 3.4, 3.4, g.base);
  p.ellipse(3.5, 3.5, 3.4, 3.4, T);   // clear then re-fill for a crisp rim
  p.ellipse(3.5, 3.5, 3.3, 3.3, g.base);
  p.ellipse(2.6, 2.6, 1.4, 1.4, g.light);
  p.set(5, 5, g.dark);
  p.set(4, 6, g.dark);
  p.outline(shift(CONFIG.colors.warn, -0.45));
  return p;
}

export function shardSprite(): Px {
  const p = new Px(9, 11);
  const c = ramp(0x6fd8ff, -0.4, 0.4);
  for (let y = 0; y < 11; y++) {
    const half = Math.round(3.5 * (1 - Math.abs(y - 5) / 5.5));
    for (let x = 4 - half; x <= 4 + half; x++) p.set(x, y, c.base);
  }
  for (let y = 1; y < 10; y++) p.set(3, y, c.light);
  p.set(4, 2, c.light);
  for (let y = 3; y < 9; y++) p.set(5, y, c.dark);
  p.outline(shift(0x6fd8ff, -0.62));
  return p;
}

/** Projectile per era: arrow, ball, bullet, tracer, bolt. */
export function projSprite(era: number, tint: number): Px {
  const c = ramp(tint, -0.3, 0.45);
  if (era === 0) {
    const p = new Px(11, 5);
    p.rect(1, 2, 7, 1, ramp(0x7a5533).base);
    p.set(8, 2, c.light); p.set(7, 1, c.base); p.set(7, 3, c.base);
    p.set(1, 1, c.dark); p.set(1, 3, c.dark);
    p.outline(OUT);
    return p;
  }
  if (era === 1) {
    const p = new Px(6, 6);
    p.ellipse(2.5, 2.5, 2.4, 2.4, c.base);
    p.set(2, 2, c.light);
    p.outline(OUT);
    return p;
  }
  if (era === 2) {
    const p = new Px(8, 4);
    p.rect(0, 1, 7, 2, c.base);
    p.rect(0, 1, 7, 1, c.light);
    p.outline(OUT);
    return p;
  }
  if (era === 3) {
    const p = new Px(12, 4);
    p.rect(0, 1, 11, 2, c.base);
    p.rect(6, 1, 5, 1, c.light);
    p.rect(0, 2, 5, 1, shift(tint, -0.5));
    return p;
  }
  const p = new Px(16, 5);
  p.rect(0, 2, 15, 1, c.light);
  p.rect(3, 1, 10, 3, c.base);
  p.rect(5, 2, 6, 1, 0xffffff);
  return p;
}

export function enemyProjSprite(tint: number): Px {
  const p = new Px(7, 7);
  const c = ramp(tint, -0.35, 0.4);
  p.ellipse(3, 3, 2.8, 2.8, c.base);
  p.ellipse(3, 3, 1.4, 1.4, c.light);
  p.outline(OUT);
  return p;
}

/** Flat white silhouette of any sprite — the hit-flash frame. */
export function flashOf(src: Px): Px {
  const p = new Px(src.w, src.h);
  p.buf.set(src.buf);
  for (let i = 0; i < p.buf.length; i++) {
    if (p.buf[i] !== T) p.buf[i] = p.buf[i] === OUT ? OUT : 0xffffff;
  }
  return p;
}
