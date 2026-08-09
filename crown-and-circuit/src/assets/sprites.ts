import { CONFIG } from '../config';
import { Px, ramp, shift, T, type Ramp } from './pixel';

/**
 * Every sprite in the game, authored on a pixel grid.
 *
 * The shared grammar: a 3/4 view facing right, one light source at the upper
 * left, three tones per material, and a hard outline. Units are built by a
 * parameterised generator rather than hand-drawn per era, so twenty unit
 * sprites stay consistent with each other.
 *
 * Three rules do most of the work of making these read as characters instead
 * of stacked boxes:
 *
 *  1. **Taper.** Nothing is a plain rectangle. Shoulders are wider than the
 *     waist, the skull is wider than the jaw, a brute's arms are wider than
 *     its hips. The silhouette carries the read at gameplay distance.
 *  2. **Negative space.** Limbs are drawn away from the body with real gaps
 *     between them. A solid mass reads as a blob no matter how it is shaded.
 *  3. **Corner light, not edge light.** Highlights sit on the top-left corner
 *     of a form, never as a full-height stripe down one side — a stripe reads
 *     as a cylinder and flattens everything it touches.
 */

const SKIN = ramp(0xd8a06a, -0.32, 0.24);
const OUT = 0x14131a;

/** Walk cycle: reach, load, stance, push, toe-off, swing. */
export const WALK = 6;
export const ATK = 3;

/**
 * One leg through the cycle: `[kneeDx, footDx, lift]`, measured from the hip.
 * The other leg reads the same table three frames out of phase. Because each
 * entry changes the leg's *shape* — knee ahead of or behind the foot, heel
 * up or planted — the gait reads as walking rather than sliding, which is what
 * a pure horizontal offset gives you.
 */
const LEG: readonly (readonly [number, number, number])[] = [
  [2, 4, 0],    // 0 reach — heel strike, leg extended forward
  [1, 2, 0],    // 1 load  — weight rolling onto it
  [0, 0, 0],    // 2 stance — straight under the hip
  [-1, -3, 0],  // 3 push  — extended behind, driving
  [-1, -3, 2],  // 4 toe-off — heel lifts off the ground
  [2, 1, 2],    // 5 swing — knee high and forward
];
/** A braced stance for attacks: feet planted, weight on the back foot. */
const LEG_BRACE: readonly [number, number, number] = [2, 3, 0];
const LEG_BRACE_BACK: readonly [number, number, number] = [-1, -3, 0];

/**
 * Body bob. Lowest during double support (both legs extended), highest at the
 * passing pose — two bounces per cycle, which is what a walk actually does.
 */
const BOB = [1, 0, -1, 1, 0, -1];
/** Hand swing for the leading arm; the trailing arm reads three frames out. */
const ARM = [-2, -1, 0, 2, 2, -1];

export interface UnitOpts {
  cloth: Ramp;
  metal: Ramp;
  accent: number;
  /** 0 none, 1 cap, 2 helm, 3 great-helm/visor */
  helm: number;
  era: number;
  royal?: boolean;
  cape?: number;
  /** hair colour, used when no helmet covers the head */
  hair?: number;
  /** walk frame 0..5 */
  frame?: number;
  /** attack pose 0 wind-up, 1 strike, 2 recover — overrides the walk pose */
  atk?: number;
}

/** A limb of `t` pixels' thickness, drawn from (x0,y0) to (x1,y1). */
function limb(p: Px, x0: number, y0: number, x1: number, y1: number, t: number, c: number): void {
  for (let i = 0; i < t; i++) p.line(x0 + i, y0, x1 + i, y1, c);
}

/** Push a ramp into shadow — used for limbs on the far side of the body. */
function far(r: Ramp): Ramp {
  return ramp(shift(r.base, -0.22), -0.3, 0.18);
}

/**
 * A horn: thick at the skull, tapering to a point. A one-pixel diagonal reads
 * as an antenna no matter how long you make it; the taper is what makes it
 * read as bone.
 */
function horn(p: Px, x0: number, y0: number, x1: number, y1: number, c: number, edge: number): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  const sx = x1 >= x0 ? -1 : 1;   // thicken back toward the skull, not past the tip
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = Math.round(x0 + (x1 - x0) * t);
    const y = Math.round(y0 + (y1 - y0) * t);
    const th = Math.max(1, Math.round(3 - t * 2));
    for (let a = 0; a < th; a++) {
      for (let b = 0; b < th; b++) p.set(x + a * sx, y + b, a === 0 && b === 0 ? c : edge);
    }
  }
}

/**
 * A humanoid, side-3/4 and facing right: 22×27 for a soldier, 26×32 for a king.
 *
 * Built from articulated limbs over a tapered torso, so the walk swings arms
 * and legs independently and armour reads as separate pieces — boots, greaves,
 * belt, cuirass, pauldrons, helm — instead of one block.
 */
export function unitSprite(o: UnitOpts): Px {
  const royal = !!o.royal;
  // the canvas is wider than the body: a weapon needs somewhere to be, and a
  // sword pinned against the cuirass is a sword nobody can see
  const w = royal ? 28 : 24;
  const h = royal ? 32 : 27;
  const p = new Px(w, h);
  const cx = royal ? 13 : 11;         // spine column; the face sits right of it
  const ground = h - 1;

  const legLen = royal ? 7 : 6;
  const torsoH = royal ? 11 : 9;
  const hipY = ground - legLen;
  const ty = hipY - torsoH;
  const headH = 7;
  const headY = ty - headH;

  const cloth = o.cloth;
  const metal = o.metal;
  const leather = ramp(0x5a4030, -0.35, 0.3);

  // ---- pose
  const f = (((o.frame ?? 0) % WALK) + WALK) % WALK;
  const atk = o.atk;
  const posed = atk !== undefined;
  const frontLeg = posed ? LEG_BRACE : LEG[f];
  const backLeg = posed ? LEG_BRACE_BACK : LEG[(f + 3) % WALK];
  const bob = posed ? 0 : BOB[f];
  // the strike drives the whole torso forward, not just the arm
  const lean = !posed ? 0 : atk === 0 ? -1 : atk === 1 ? 2 : 1;
  const frontArm = posed ? (atk === 0 ? -3 : atk === 1 ? 3 : 1) : ARM[f];
  const backArm = posed ? 1 : ARM[(f + 3) % WALK];

  // ---- cape, behind everything, ending at the hip so the legs stay readable
  if (o.cape !== undefined) {
    const cr = ramp(o.cape, -0.4, 0.24);
    const flare = posed && atk === 1 ? 2 : f === 2 || f === 5 ? 1 : 0;
    const top = ty + bob;
    const len = hipY - top + 1;
    for (let i = 0; i < len; i++) {
      const spread = 5 + Math.round((i / len) * (2 + flare));
      p.rect(cx - spread, top + i, spread * 2, 1, cr.base);
    }
    p.rect(cx - 5, top, 3, 2, cr.light);                  // lit shoulder of the cape
    p.rect(cx + 4, top + 2, 2, len - 3, cr.dark);
    p.rect(cx - 5 - (2 + flare), hipY, 2, 1, cr.dark);
  }

  // ---- legs: thigh, greave, boot. Back leg first so the front overlaps it.
  const drawLeg = (hipX: number, pose: readonly [number, number, number], front: boolean): void => {
    const [kdx, fdx, lift] = pose;
    const hy = hipY + bob;
    const footY = ground - 1 - lift;
    const kneeY = hy + Math.round((footY - hy) * 0.55);
    const c = front ? cloth : far(cloth);
    const m = front ? metal : far(metal);
    const lt = front ? leather : far(leather);
    limb(p, hipX - 1, hy, hipX + kdx - 1, kneeY, 3, c.dark);            // thigh
    limb(p, hipX + kdx - 1, kneeY, hipX + fdx - 1, footY, 3, m.base);   // greave
    p.line(hipX + kdx - 1, kneeY, hipX + fdx - 1, footY, m.light);      // greave edge
    p.rect(hipX + fdx - 2, footY, 4, 2, lt.base);                       // boot
    p.rect(hipX + fdx - 2, footY, 4, 1, lt.light);
    p.set(hipX + fdx + 1, footY + 1, lt.dark);                          // toe
  };
  drawLeg(cx - 1, backLeg, false);
  drawLeg(cx + 2, frontLeg, true);

  // ---- torso: a taper from broad shoulders to a narrow waist
  const tyb = ty + bob;
  for (let i = 0; i < torsoH; i++) {
    const t = i / (torsoH - 1);
    const rowW = Math.round(11 - t * 3);                                // 11 → 8
    p.rect(cx - (rowW >> 1) + lean, tyb + i, rowW, 1, cloth.base);
  }
  // cuirass over the tunic, stopping short of the belt
  const cuH = torsoH - 3;
  for (let i = 0; i < cuH; i++) {
    const t = i / (cuH - 1);
    const rowW = Math.round(10 - t * 2);
    const x = cx - (rowW >> 1) + lean;
    p.rect(x, tyb + i, rowW, 1, metal.base);
    if (i === 0) p.rect(x, tyb, rowW, 1, metal.light);
    p.set(x + rowW - 1, tyb + i, metal.dark);
  }
  p.rect(cx - 4 + lean, tyb + 1, 2, 2, metal.light);                    // corner light
  p.dither(cx - 2 + lean, tyb + cuH - 3, 6, 3, metal.dark, 3);          // lower-chest shade
  // belt
  p.rect(cx - 4 + lean, tyb + torsoH - 2, 9, 2, leather.base);
  p.rect(cx - 4 + lean, tyb + torsoH - 2, 9, 1, leather.light);
  p.rect(cx + lean, tyb + torsoH - 2, 2, 2, o.accent);                  // buckle

  // ---- arms. Upper arm to elbow, forearm to hand, pauldron capping the joint.
  const drawArm = (sx: number, swing: number, front: boolean): void => {
    const c = front ? cloth : far(cloth);
    const m = front ? metal : far(metal);
    const sy = tyb + 1;
    const ey = sy + Math.round(torsoH * 0.45);
    const hy = sy + torsoH - 2;
    const ex = sx + Math.round(swing * 0.5);
    limb(p, sx - 1, sy, ex - 1, ey, 3, c.base);
    limb(p, ex - 1, ey, sx + swing - 1, hy, 3, c.dark);
    p.rect(sx + swing - 1, hy, 3, 2, front ? SKIN.base : SKIN.dark);    // hand
    p.rect(sx - 2, sy - 1, 5, 3, m.base);                               // pauldron
    p.rect(sx - 2, sy - 1, 4, 1, m.light);
    p.rect(sx - 2, sy + 1, 5, 1, m.dark);
  };
  drawArm(cx - 5 + lean, backArm, false);

  // ---- head: skull wider than jaw, brow shadow, eyes near the leading edge
  const hx = cx + 1 + lean;
  const hyTop = headY + bob;
  const rows: [number, number][] = [
    [-2, 5], [-3, 7], [-3, 7], [-3, 7], [-3, 7], [-2, 6], [-1, 4],
  ];
  rows.forEach(([dx, rw], i) => p.rect(hx + dx, hyTop + i, rw, 1, SKIN.base));
  p.rect(hx - 3, hyTop + 1, 2, 2, SKIN.light);                          // temple catch-light
  p.set(hx - 2, hyTop, SKIN.light);
  p.rect(hx, hyTop + 2, 4, 1, SKIN.dark);                               // brow shadow
  p.set(hx + 1, hyTop + 3, OUT);                                        // eyes
  p.set(hx + 3, hyTop + 3, OUT);
  p.set(hx + 2, hyTop + 3, SKIN.light);
  p.set(hx + 4, hyTop + 4, SKIN.dark);                                  // nose
  p.rect(hx + 1, hyTop + 5, 3, 1, shift(SKIN.dark, -0.25));             // mouth / jaw line
  p.rect(hx - 1, hyTop + 6, 4, 1, SKIN.dark);

  // hair, so a bare head still has a silhouette
  if (o.helm === 0) {
    const hair = ramp(o.hair ?? 0x4a3122, -0.32, 0.32);
    p.rect(hx - 3, hyTop - 2, 8, 3, hair.base);
    p.rect(hx - 3, hyTop - 2, 6, 1, hair.light);
    p.rect(hx - 4, hyTop, 2, 5, hair.base);                             // sideburn
    p.set(hx - 4, hyTop + 5, hair.dark);
    p.set(hx + 4, hyTop, hair.dark);
    p.set(hx + 3, hyTop + 1, hair.dark);                                // fringe tip
  }

  // ---- headgear
  if (o.helm === 1) {                                                   // hood
    p.rect(hx - 4, hyTop - 2, 9, 4, cloth.dark);
    p.rect(hx - 4, hyTop - 2, 7, 1, cloth.base);
    p.rect(hx - 4, hyTop + 1, 2, 5, cloth.dark);
    p.set(hx - 4, hyTop + 6, cloth.dark);
  } else if (o.helm === 2) {                                            // kettle helm
    p.rect(hx - 3, hyTop - 4, 7, 3, metal.base);
    p.rect(hx - 2, hyTop - 5, 5, 1, metal.base);
    p.rect(hx - 5, hyTop - 1, 11, 2, metal.base);                       // brim
    p.rect(hx - 5, hyTop - 1, 8, 1, metal.light);
    p.rect(hx - 3, hyTop - 4, 4, 1, metal.light);
    p.rect(hx - 5, hyTop + 1, 11, 1, metal.dark);
  } else if (o.helm === 3) {                                            // visored helm
    p.rect(hx - 3, hyTop - 4, 8, 4, metal.base);
    p.rect(hx - 2, hyTop - 5, 6, 1, metal.base);
    p.rect(hx - 3, hyTop, 8, 5, metal.base);                            // face plate
    p.rect(hx - 3, hyTop - 4, 6, 1, metal.light);
    p.rect(hx - 3, hyTop - 3, 2, 3, metal.light);
    p.rect(hx + 4, hyTop - 4, 1, 9, metal.dark);
    p.rect(hx - 2, hyTop + 2, 6, 1, OUT);                               // visor slit
    p.set(hx, hyTop + 2, o.accent);
    p.set(hx + 2, hyTop + 2, o.accent);
    p.rect(hx - 1, hyTop + 4, 5, 1, metal.dark);                        // chin bevel
    const cr = ramp(o.accent, -0.35, 0.35);                             // crest
    p.rect(hx, hyTop - 8, 2, 4, cr.base);
    p.rect(hx, hyTop - 8, 1, 4, cr.light);
    p.set(hx + 1, hyTop - 9, cr.dark);
  }
  if (royal) {
    const gold = ramp(CONFIG.colors.gold, -0.35, 0.4);
    p.rect(hx - 4, hyTop - 7, 10, 3, gold.base);
    p.rect(hx - 4, hyTop - 7, 8, 1, gold.light);
    p.rect(hx - 4, hyTop - 5, 10, 1, gold.dark);
    for (const dx of [-4, -1, 2, 5]) {
      p.set(hx + dx, hyTop - 9, gold.base);
      p.set(hx + dx, hyTop - 8, gold.light);
    }
    p.set(hx + 1, hyTop - 6, 0xff6a8a);                                 // set stone
  }

  // ---- weapon arm drawn last: it passes in front of the body
  drawArm(cx + 5 + lean, frontArm, true);
  const handX = cx + 5 + lean + frontArm;
  const handY = tyb + 1 + torsoH - 2;
  const rise = posed ? (atk === 0 ? 3 : atk === 1 ? -4 : -1) : 0;
  weapon(p, handX + 2, handY + rise, o.era, metal, o.accent, posed && atk === 1);

  p.outline(OUT);
  return p;
}

/** Era weapon in the hand at (hx, hy). `swing` adds the arc of a strike. */
function weapon(p: Px, hx: number, hy: number, era: number, metal: Ramp, accent: number, swing: boolean): void {
  const wood = ramp(0x7a5533);
  if (era === 0) {                        // sword, carried angled away from the body
    for (let i = 0; i < 13; i++) {
      const bx = hx + Math.round(i * 0.34);
      const by = hy - 2 - i;
      p.set(bx, by, i > 10 ? metal.light : metal.base);
      p.set(bx + 1, by, metal.dark);
    }
    p.set(hx + 5, hy - 15, metal.light);                            // point
    p.rect(hx - 2, hy - 2, 6, 1, ramp(CONFIG.colors.gold).base);    // crossguard
    p.rect(hx - 2, hy - 2, 3, 1, ramp(CONFIG.colors.gold).light);
    p.rect(hx, hy - 1, 2, 3, wood.base);                            // grip
    p.set(hx, hy + 2, ramp(CONFIG.colors.gold).dark);               // pommel
    if (swing) { p.set(hx + 6, hy - 12, metal.light); p.set(hx + 7, hy - 10, metal.light); }
  } else if (era === 1) {                 // musket
    for (let i = 0; i < 13; i++) p.set(hx + Math.floor(i * 0.3), hy - 1 - i, metal.dark);
    p.rect(hx - 1, hy - 1, 3, 5, wood.base);
    p.rect(hx - 1, hy - 1, 1, 5, wood.light);
    p.set(hx + 2, hy - 6, metal.base);
    if (swing) { p.set(hx + 4, hy - 14, 0xffe4a8); p.set(hx + 5, hy - 15, 0xfff0c8); }
  } else if (era === 2) {                 // bolt rifle
    for (let i = 0; i < 15; i++) p.set(hx + Math.floor(i * 0.28), hy - 1 - i, metal.base);
    p.rect(hx - 2, hy - 1, 4, 5, wood.base);
    p.rect(hx - 2, hy - 1, 1, 5, wood.light);
    p.rect(hx + 1, hy - 7, 2, 1, metal.light);
    if (swing) { p.set(hx + 5, hy - 16, 0xfff0c0); p.set(hx + 6, hy - 17, 0xffffff); }
  } else if (era === 3) {                 // machine gun
    for (let i = 0; i < 14; i++) p.set(hx + Math.floor(i * 0.3), hy - 2 - i, metal.dark);
    p.rect(hx - 3, hy - 3, 6, 6, metal.base);
    p.rect(hx - 3, hy - 3, 6, 1, metal.light);
    p.ellipse(hx - 1, hy + 3, 2.4, 1.8, metal.dark);      // drum
    p.rect(hx + 1, hy - 9, 2, 3, metal.dark);             // fore grip
    if (swing) { p.set(hx + 5, hy - 16, 0xffffff); p.set(hx + 6, hy - 17, 0xffd36b); }
  } else {                                // laser lance
    for (let i = 0; i < 15; i++) p.set(hx + Math.floor(i * 0.28), hy - 2 - i, i > 10 ? accent : metal.dark);
    p.rect(hx - 3, hy - 3, 6, 6, metal.base);
    p.rect(hx - 3, hy - 3, 6, 1, metal.light);
    p.rect(hx - 2, hy - 1, 4, 1, accent);                 // power cell
    p.set(hx + 5, hy - 18, shift(accent, 0.5));
    if (swing) {
      p.set(hx + 6, hy - 19, 0xffffff);
      p.set(hx + 5, hy - 20, shift(accent, 0.4));
    }
  }
}

/** A soft ground shadow, drawn under every unit so nothing floats. */
export function shadowSprite(w: number): Px {
  const p = new Px(w, Math.max(3, Math.round(w * 0.4)));
  p.ellipse((w - 1) / 2, (p.h - 1) / 2, w / 2 - 0.5, p.h / 2 - 0.5, 0x000000);
  return p;
}

// ---------------------------------------------------------------- enemies

/** Enemy gait: a 4-frame lurch, deliberately less even than the soldiers'. */
export const EWALK = 4;
/** `[kneeDx, footDx, lift]`, same grammar as LEG but coarser and heavier. */
const ELEG: readonly (readonly [number, number, number])[] = [
  [2, 4, 0],
  [0, 0, 0],
  [-1, -4, 0],
  [1, -1, 2],
];
const EBOB = [1, -1, 1, 0];

/** Draw a lurching enemy leg. Shared by every ground archetype. */
function enemyLeg(
  p: Px, hipX: number, hipY: number, ground: number,
  pose: readonly [number, number, number], r: Ramp, thick: number, foot: number,
): void {
  const [kdx, fdx, lift] = pose;
  const footY = ground - 1 - lift;
  const kneeY = hipY + Math.round((footY - hipY) * 0.55);
  limb(p, hipX, hipY, hipX + kdx, kneeY, thick, r.dark);
  limb(p, hipX + kdx, kneeY, hipX + fdx, footY, thick, r.base);
  p.line(hipX + kdx, kneeY, hipX + fdx, footY, r.light);
  p.rect(hipX + fdx - 1, footY, foot, 2, shift(r.dark, -0.35));
}

/**
 * Shambling husk — the bread and butter of every horde.
 *
 * Hunched hard forward with the skull thrust off the shoulders and a gap you
 * can see daylight through between the legs: at horde density the silhouette
 * is all you get, so it has to be a shape and not a lump.
 */
export function runnerSprite(base: number, frame = 0): Px {
  const p = new Px(20, 22);
  const r = ramp(base, -0.34, 0.26);
  const f = frame % EWALK;
  const bob = EBOB[f];
  const cx = 8;
  const ground = 21;
  const hipY = 14 + bob;

  enemyLeg(p, cx - 3, hipY, ground, ELEG[(f + 2) % EWALK], r, 3, 4);
  enemyLeg(p, cx + 2, hipY, ground, ELEG[f], r, 3, 4);

  // ribcage: a broad hunched chest carried forward over narrow hips
  const ty = hipY - 8;
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    const rowW = Math.round(8 - t * 4);
    p.rect(cx - 2 + Math.round((1 - t) * 2), ty + i, rowW, 1, r.base);
  }
  p.rect(cx, ty, 4, 2, r.light);                       // lit crest of the hunch
  p.rect(cx + 1, ty + 3, 4, 1, r.dark);                // ribs
  p.rect(cx, ty + 5, 4, 1, r.dark);
  p.rect(cx - 1, ty + 6, 4, 2, shift(base, -0.42));    // belly in shadow
  p.rect(cx - 2, ty + 1, 3, 4, shift(base, -0.45));    // spine ridge, behind
  p.set(cx - 3, ty + 2, shift(base, -0.5));

  // arms hang clear of the torso — the gap is the whole point
  const swing = [2, 0, -2, 0][f];
  limb(p, cx - 5, ty + 2, cx - 6, ty + 6 + swing, 2, r.dark);
  limb(p, cx - 6, ty + 6 + swing, cx - 6, ty + 10 + swing, 2, r.base);
  p.rect(cx - 7, ty + 10 + swing, 3, 2, r.dark);       // claws
  limb(p, cx + 4, ty + 2, cx + 6, ty + 6 - swing, 2, r.base);
  limb(p, cx + 6, ty + 6 - swing, cx + 7, ty + 10 - swing, 2, r.light);
  p.rect(cx + 6, ty + 10 - swing, 3, 2, r.dark);

  // skull thrust forward and low — reads as "charging" even at one pixel wide
  const hy = ty - 3;
  p.rect(cx + 2, hy, 5, 4, r.base);
  p.rect(cx + 2, hy, 3, 1, r.light);
  p.rect(cx + 6, hy + 1, 3, 3, r.base);                // snout
  p.rect(cx + 8, hy + 2, 2, 1, r.dark);
  p.set(cx + 4, hy + 2, 0xffd76a);                     // eyes
  p.set(cx + 6, hy + 2, 0xffd76a);
  p.rect(cx + 4, hy + 4, 5, 1, shift(base, -0.6));     // jaw
  p.set(cx + 7, hy + 4, shift(base, 0.55));            // tusk
  p.set(cx + 5, hy + 5, shift(base, 0.5));
  p.line(cx + 1, hy + 3, cx - 1, ty + 1, r.dark);      // neck into the hunch

  p.outline(OUT);
  return p;
}

/**
 * Slow, heavy, and wide enough to block a gap on its own. The whole read is
 * the taper: shoulders nearly three times the width of the hips.
 */
export function bruteSprite(base: number, frame = 0): Px {
  const p = new Px(30, 30);
  const r = ramp(base, -0.34, 0.24);
  const f = frame % EWALK;
  const bob = EBOB[f];
  const cx = 14;
  const ground = 29;
  const hipY = 20 + bob;

  enemyLeg(p, cx - 6, hipY, ground, ELEG[(f + 2) % EWALK], r, 5, 7);
  enemyLeg(p, cx + 2, hipY, ground, ELEG[f], r, 5, 7);

  // torso: 19 across the shoulders down to 9 at the waist
  const ty = hipY - 13;
  for (let i = 0; i < 13; i++) {
    const t = i / 12;
    const rowW = Math.round(19 - t * 10);
    p.rect(cx - (rowW >> 1), ty + i, rowW, 1, r.base);
  }
  p.rect(cx - 9, ty, 6, 2, r.light);                   // corner light
  p.rect(cx + 6, ty + 2, 2, 6, r.dark);
  p.dither(cx - 5, ty + 7, 11, 5, r.dark, 3);
  p.rect(cx - 6, ty + 2, 13, 2, shift(base, 0.35));    // bone plate
  p.rect(cx - 6, ty + 2, 13, 1, shift(base, 0.5));

  // arms swing well clear of that taper, which is what sells the mass
  const swing = [2, 0, -2, 0][f];
  const arm = (sx: number, dir: number, lit: boolean): void => {
    limb(p, sx, ty + 1, sx + dir, ty + 6 + swing * dir, 4, lit ? r.base : r.dark);
    limb(p, sx + dir, ty + 6 + swing * dir, sx + dir * 2, ty + 12 + swing * dir, 4, lit ? r.light : r.base);
    p.rect(sx + dir * 2 - 1, ty + 12 + swing * dir, 6, 4, r.dark);   // fist
    p.rect(sx + dir * 2 - 1, ty + 12 + swing * dir, 6, 1, r.base);
  };
  arm(cx - 13, -1, false);
  arm(cx + 9, 1, true);

  // head sunk between the shoulders, small on purpose
  const hy = ty - 4;
  p.rect(cx - 4, hy, 9, 6, r.base);
  p.rect(cx - 4, hy, 5, 1, r.light);
  p.rect(cx - 4, hy + 5, 9, 1, shift(base, -0.55));
  p.rect(cx - 2, hy + 2, 2, 2, 0xff9a3a);              // furnace eyes
  p.rect(cx + 2, hy + 2, 2, 2, 0xff9a3a);
  p.rect(cx - 1, hy + 5, 7, 1, shift(base, 0.5));      // teeth
  p.set(cx, hy + 6, shift(base, 0.5));
  p.set(cx + 4, hy + 6, shift(base, 0.5));
  // asymmetric horns, one snapped short
  horn(p, cx - 4, hy + 1, cx - 8, hy - 3, shift(base, 0.5), shift(base, 0.15));
  horn(p, cx + 5, hy + 1, cx + 7, hy - 1, shift(base, 0.45), shift(base, 0.1));

  p.outline(OUT);
  return p;
}

/** Hangs back and shoots. Thin, stooped, and the levelled weapon is the tell. */
export function shooterSprite(base: number, frame = 0): Px {
  const p = new Px(24, 24);
  const r = ramp(base, -0.34, 0.26);
  const f = frame % EWALK;
  const bob = EBOB[f];
  const cx = 8;
  const ground = 23;
  const hipY = 16 + bob;

  enemyLeg(p, cx - 3, hipY, ground, ELEG[(f + 2) % EWALK], r, 3, 4);
  enemyLeg(p, cx + 1, hipY, ground, ELEG[f], r, 3, 4);

  // narrow torso under a heavy ragged mantle — top-heavy on purpose
  const ty = hipY - 9;
  for (let i = 0; i < 9; i++) {
    const rowW = Math.round(7 - (i / 8) * 2);
    p.rect(cx - (rowW >> 1), ty + i, rowW, 1, r.base);
  }
  p.rect(cx - 5, ty - 1, 11, 4, r.dark);               // mantle
  p.rect(cx - 5, ty - 1, 7, 1, r.base);
  p.rect(cx - 5, ty + 3, 2, 3, r.dark);                // torn hem
  p.set(cx + 5, ty + 3, r.dark);
  p.set(cx + 4, ty + 4, r.dark);

  const hy = ty - 7;
  p.rect(cx - 3, hy + 1, 7, 5, r.base);                // cowled head
  p.rect(cx - 3, hy + 1, 4, 1, r.light);
  p.rect(cx - 2, hy, 5, 1, r.base);
  p.rect(cx - 2, hy + 5, 6, 1, shift(base, -0.5));
  p.set(cx - 1, hy + 3, 0x9ff0ff);                     // cold eyes
  p.set(cx + 2, hy + 3, 0x9ff0ff);

  // long weapon held level across the body
  const m = ramp(0x7d838c, -0.35, 0.3);
  const wy = ty + 3;
  for (let i = 0; i < 13; i++) p.set(cx + 5 + i, wy - Math.floor(i * 0.2), m.base);
  for (let i = 0; i < 13; i++) p.set(cx + 5 + i, wy + 1 - Math.floor(i * 0.2), m.dark);
  p.set(cx + 17, wy - 2, m.light);
  p.rect(cx + 2, wy - 1, 4, 5, m.dark);                // stock
  p.rect(cx + 2, wy - 1, 4, 1, m.base);
  limb(p, cx + 3, ty + 1, cx + 6, wy + 2, 2, r.base);  // supporting arm
  p.rect(cx + 6, wy + 1, 3, 2, r.light);

  p.outline(OUT);
  return p;
}

/** Ignores walls, so it always arrives where you are not. */
export function flyerSprite(base: number, frame = 0): Px {
  const p = new Px(28, 20);
  const r = ramp(base, -0.32, 0.3);
  const cx = 13;
  // wings sweep through the 4 frames rather than snapping up and down. The
  // down-beat stops level with the body: tips below it read as spider legs.
  const sweep = [-6, -2, 2, -2][frame % EWALK];
  const cy = 10 + [0, 1, 0, -1][frame % EWALK];

  for (const dir of [-1, 1]) {
    const tipX = cx + dir * 12;
    const tipY = cy + sweep;
    const midX = cx + dir * 7;
    const midY = cy + Math.round(sweep * 0.35) - 1;
    // membrane between two fingers, so the wing has area instead of being a line
    for (let t = 0; t <= 6; t++) {
      const ax = cx + dir * 3 + Math.round(((midX - (cx + dir * 3)) * t) / 6);
      const ay = cy - 1 + Math.round(((midY - (cy - 1)) * t) / 6);
      p.line(ax, ay, ax, ay + 2 + Math.round(t * 0.3), t < 3 ? r.base : r.dark);
    }
    p.line(cx + dir * 3, cy - 1, midX, midY, r.light);
    p.line(midX, midY, tipX, tipY, r.base);
    p.line(midX, midY + 1, tipX, tipY + 1, r.dark);
    p.line(midX, midY + 2, tipX - dir * 3, tipY + 3, r.dark);
  }
  p.ellipse(cx, cy, 3.2, 4.4, r.base);                  // body
  p.rect(cx - 3, cy - 2, 2, 3, r.light);
  p.ellipse(cx, cy - 5, 2.8, 2.4, r.base);              // head
  p.rect(cx - 2, cy - 6, 3, 1, r.light);
  p.set(cx - 1, cy - 5, OUT);
  p.set(cx + 1, cy - 5, OUT);
  p.rect(cx - 1, cy - 3, 3, 1, shift(base, -0.55));     // beak line
  p.rect(cx - 1, cy + 4, 2, 4, r.dark);                 // tail
  p.rect(cx - 2, cy + 7, 4, 1, r.dark);
  p.outline(OUT);
  return p;
}

/** Era boss: the wave that closes an age. */
export function bossSprite(base: number, accent: number, frame = 0): Px {
  const p = new Px(48, 46);
  const r = ramp(base, -0.34, 0.24);
  const f = frame % EWALK;
  const bob = EBOB[f];
  const cx = 23;
  const ground = 45;
  const hipY = 31 + bob;

  enemyLeg(p, cx - 9, hipY, ground, ELEG[(f + 2) % EWALK], r, 7, 10);
  enemyLeg(p, cx + 3, hipY, ground, ELEG[f], r, 7, 10);

  const ty = hipY - 19;
  for (let i = 0; i < 19; i++) {
    const t = i / 18;
    const rowW = Math.round(25 - t * 12);
    p.rect(cx - (rowW >> 1), ty + i, rowW, 1, r.base);
  }
  p.rect(cx - 12, ty, 8, 2, r.light);
  p.rect(cx + 9, ty + 3, 2, 9, r.dark);
  p.dither(cx - 7, ty + 11, 15, 7, r.dark, 3);
  // chest sigil
  p.rect(cx - 5, ty + 4, 11, 8, shift(accent, -0.45));
  p.rect(cx - 5, ty + 4, 11, 1, accent);
  p.rect(cx - 3, ty + 6, 7, 4, accent);
  p.rect(cx - 2, ty + 7, 5, 2, shift(accent, 0.5));

  const swing = [3, 0, -3, 0][f];
  const arm = (sx: number, dir: number, lit: boolean): void => {
    limb(p, sx, ty + 1, sx + dir * 2, ty + 9 + swing * dir, 6, lit ? r.base : r.dark);
    limb(p, sx + dir * 2, ty + 9 + swing * dir, sx + dir * 3, ty + 17 + swing * dir, 6, lit ? r.light : r.base);
    p.rect(sx + dir * 3 - 1, ty + 17 + swing * dir, 8, 5, r.dark);
    p.rect(sx + dir * 3 - 1, ty + 17 + swing * dir, 8, 1, r.base);
  };
  arm(cx - 18, -1, false);
  arm(cx + 12, 1, true);

  const hy = ty - 9;
  p.rect(cx - 6, hy, 13, 10, r.base);
  p.rect(cx - 6, hy, 7, 2, r.light);
  p.rect(cx - 6, hy + 9, 13, 1, shift(base, -0.6));
  p.rect(cx - 4, hy + 4, 3, 3, accent);                 // burning eyes
  p.rect(cx + 3, hy + 4, 3, 3, accent);
  p.rect(cx - 4, hy + 8, 11, 1, shift(base, -0.6));     // maw
  for (let i = 0; i < 5; i++) p.set(cx - 3 + i * 2, hy + 9, shift(base, 0.5));
  // crown of horns
  for (const [ox, oy] of [[-7, -1], [-3, -3], [3, -3], [7, -1]]) {
    horn(p, cx + ox, hy, cx + ox + (ox < 0 ? -3 : 3), hy + oy - 3, shift(base, 0.45), shift(base, 0.12));
  }
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
