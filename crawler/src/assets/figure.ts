import {
  INK, cel, circPath, contactShadow, ellPath, limbPath, polyPath, rrPath, tint,
} from './shade';

/**
 * The rig.
 *
 * Every person in this game — Carl, a levy, a redcloak, a Floor Captain — is
 * this one articulated figure with a different set of materials and a different
 * thing in its hands. That is not a shortcut; it is why they read as inhabiting
 * the same world. A game whose characters are each drawn from scratch looks
 * assembled, and at 40 px on a phone the thing that sells a character is its
 * silhouette and its gait, both of which live here.
 *
 * Poses are data. A frame is a set of joint angles, and the walk cycle is four
 * of them: two contacts with the body at its lowest, two passing positions with
 * it at its highest. That is the oldest walk in animation and it still works.
 */

/** The five painted facings. The other three are these, mirrored. */
export type Facing = 's' | 'se' | 'e' | 'ne' | 'n';
export const FACINGS: Facing[] = ['s', 'se', 'e', 'ne', 'n'];

/** Frames per character per facing: four walk, then one attack. */
export const WALK_FRAMES = 4;
export const ATTACK_FRAME = 4;
export const FRAMES_PER_FACING = 5;

export interface Pose {
  /** limb swing, −1 back to +1 forward */
  legL: number; legR: number;
  armL: number; armR: number;
  /** vertical body offset, design px (negative is up) */
  bob: number;
  /** forward lean, radians */
  lean: number;
  /** 0..1, how far into a swing the weapon arm is */
  swing: number;
}

/**
 * The cycle. Contacts sit low with the legs split; passing positions rise and
 * bring the legs together. The arms counter-swing against the legs, which is
 * what stops a walk reading as a shuffle.
 */
export const WALK: Pose[] = [
  { legL: 1.0, legR: -1.0, armL: -0.85, armR: 0.85, bob: 0.6, lean: 0.05, swing: 0 },
  { legL: 0.05, legR: 0.05, armL: 0, armR: 0, bob: -2.4, lean: 0.02, swing: 0 },
  { legL: -1.0, legR: 1.0, armL: 0.85, armR: -0.85, bob: 0.6, lean: 0.05, swing: 0 },
  { legL: 0.05, legR: 0.05, armL: 0, armR: 0, bob: -2.4, lean: 0.02, swing: 0 },
];

/** The attack pose: weight forward, weapon arm through the swing. */
export const ATTACK: Pose = {
  legL: 0.75, legR: -0.55, armL: -0.5, armR: 1.25, bob: 0.9, lean: 0.16, swing: 1,
};

export const poseFor = (frame: number): Pose =>
  frame >= WALK_FRAMES ? ATTACK : WALK[frame % WALK_FRAMES];

/** Materials for one character. Every colour the rig can reach for. */
export interface Materials {
  skin: string;
  hair: string;
  /** torso garment */
  cloth: string;
  /** legs */
  trouser: string;
  /** boots and belt */
  leather: string;
  /** metal: helmets, plate, blades */
  steel: string;
  /** optional accent stripe on the torso */
  accent?: string;
  /** optional cape hanging behind */
  cape?: string;
  /** optional helmet; when absent the hair is drawn instead */
  helm?: string;
}

export interface Build {
  /** total design height of the frame */
  h: number;
  /** shoulder width, design px */
  shoulder: number;
  /** head radius */
  head: number;
  /** leg and arm lengths */
  leg: number;
  arm: number;
  /** limb thickness */
  limb: number;
  /** torso box */
  torsoW: number;
  torsoH: number;
}

/** A normal person. Enemies and heavies scale off this. */
export const BUILD: Build = {
  h: 50, shoulder: 15, head: 8.6, leg: 13, arm: 12, limb: 5.4, torsoW: 18, torsoH: 17,
};

export const scaleBuild = (b: Build, k: number, headK = 1): Build => ({
  h: b.h * k,
  shoulder: b.shoulder * k,
  head: b.head * k * headK,
  leg: b.leg * k,
  arm: b.arm * k,
  limb: b.limb * k,
  torsoW: b.torsoW * k,
  torsoH: b.torsoH * k,
});

/**
 * How much of a facing is turned away from the camera, 0 (facing you) to 1
 * (facing away). Drives whether a face is drawn and how far the near shoulder
 * overlaps the far one.
 */
const AWAY: Record<Facing, number> = { s: 0, se: 0.25, e: 0.5, ne: 0.8, n: 1 };
/** How far the body is turned to the side, −1..1 (positive = toward screen-right). */
const SIDE: Record<Facing, number> = { s: 0, se: 0.5, e: 1, ne: 0.7, n: 0 };

export interface FigureOpts {
  build: Build;
  mat: Materials;
  facing: Facing;
  pose: Pose;
  /** drawn behind the body, after the cape — a quiver, a pack */
  back?: (c: CanvasRenderingContext2D, cx: number, foot: number, o: FigureOpts) => void;
  /** drawn in the forward hand, in the hand's local space */
  weapon?: (
    c: CanvasRenderingContext2D, hx: number, hy: number, angle: number, o: FigureOpts,
  ) => void;
  /** replaces the default head entirely */
  head?: (c: CanvasRenderingContext2D, hx: number, hy: number, o: FigureOpts) => void;
  /** drawn last, over everything */
  overlay?: (c: CanvasRenderingContext2D, cx: number, foot: number, o: FigureOpts) => void;
  /** bare arms and legs (Carl) */
  bareArms?: boolean;
  bareLegs?: boolean;
}

/**
 * Draw one frame of one character.
 *
 * Order is back-to-front: shadow, cape, back item, far limbs, torso, head,
 * near limbs, weapon, overlay. Getting that order right is most of what makes
 * a flat sprite read as a body rather than a collage.
 */
export function drawFigure(c: CanvasRenderingContext2D, w: number, h: number, o: FigureOpts): void {
  const { build: b, mat, facing, pose } = o;
  const cx = w / 2;
  const foot = h - 3;
  const away = AWAY[facing];
  const side = SIDE[facing];

  // The gait's vertical bob moves the BODY, not the shadow: a shadow that
  // rises with the character is the single most common way to un-plant a
  // sprite. It shrinks instead, which is what a real one does.
  const bob = pose.bob;
  contactShadow(c, cx, foot - 1, b.shoulder * 0.95, 0.32 - bob * 0.012);

  const hipY = foot - b.leg + bob;
  const shoulderY = hipY - b.torsoH;
  const headY = shoulderY - b.head * 0.72;

  const legSpread = b.shoulder * 0.3;
  const armSpread = b.shoulder * 0.62;
  // limbs swing about the horizontal; a facing that is side-on swings visibly,
  // a facing that is head-on mostly lifts
  const swingScale = 0.45 + Math.abs(side) * 0.55;

  const leather = mat.leather;
  const legCol = o.bareLegs ? mat.skin : mat.trouser;

  const drawLeg = (dir: number, swing: number, far: boolean): void => {
    const x = cx + dir * legSpread + side * 1.2;
    const a = Math.PI / 2 + swing * 0.42 * swingScale;
    const col = far ? tint(legCol, -0.16) : legCol;
    cel(c, limbPath(c, x, hipY, b.leg, b.limb, a), col, { depth: 2.2, rim: 1, line: 1.7 });
    // boot
    const fx = x + Math.cos(a) * b.leg;
    const fy = hipY + Math.sin(a) * b.leg;
    cel(c, ellPath(c, fx + dir * 0.6, fy - 0.5, b.limb * 0.86, b.limb * 0.62),
      far ? tint(leather, -0.16) : leather, { depth: 1.6, rim: 0.8, line: 1.6 });
  };

  const drawArm = (dir: number, swing: number, far: boolean): { x: number; y: number; a: number } => {
    const x = cx + dir * armSpread + side * 1.6;
    const a = Math.PI / 2 + swing * 0.5 * swingScale + dir * side * 0.18;
    const col = o.bareArms ? mat.skin : mat.cloth;
    cel(c, limbPath(c, x, shoulderY + 2, b.arm, b.limb * 0.92, a),
      far ? tint(col, -0.16) : col, { depth: 2, rim: 1, line: 1.7 });
    const hx = x + Math.cos(a) * b.arm;
    const hy = shoulderY + 2 + Math.sin(a) * b.arm;
    cel(c, circPath(c, hx, hy, b.limb * 0.52),
      far ? tint(mat.skin, -0.16) : mat.skin, { depth: 1.4, rim: 0.7, line: 1.5 });
    return { x: hx, y: hy, a };
  };

  // ── cape, behind everything ──
  if (mat.cape) {
    const capeW = b.shoulder * 2.1;
    cel(c, () => {
      c.beginPath();
      c.moveTo(cx - capeW / 2, shoulderY + 1);
      c.lineTo(cx + capeW / 2, shoulderY + 1);
      c.quadraticCurveTo(cx + capeW * 0.62, hipY + b.leg * 0.7, cx + capeW * 0.34, foot - 1);
      c.quadraticCurveTo(cx, foot + 2, cx - capeW * 0.34, foot - 1);
      c.quadraticCurveTo(cx - capeW * 0.62, hipY + b.leg * 0.7, cx - capeW / 2, shoulderY + 1);
      c.closePath();
    }, mat.cape, { depth: 4, rim: 2 });
  }

  o.back?.(c, cx, foot, o);

  // ── far limbs ──
  // which side is far depends on which way the body is turned
  const farDir = side >= 0 ? -1 : 1;
  const nearDir = -farDir;
  drawLeg(farDir, farDir < 0 ? pose.legL : pose.legR, true);
  drawArm(farDir, farDir < 0 ? pose.armL : pose.armR, true);

  // ── torso ──
  const tw = b.torsoW * (1 - away * 0.14);
  cel(c, rrPath(c, cx - tw / 2 + side * 1.1, shoulderY, tw, b.torsoH + 2, b.torsoW * 0.3),
    mat.cloth, { depth: 3.4, rim: 1.6 });
  if (mat.accent) {
    // a stripe reads as tailoring at any size and costs one rect
    c.save();
    rrPath(c, cx - tw / 2 + side * 1.1, shoulderY, tw, b.torsoH + 2, b.torsoW * 0.3)();
    c.clip();
    c.fillStyle = mat.accent;
    c.fillRect(cx - tw / 2 + side * 1.1, shoulderY + b.torsoH * 0.42, tw, b.torsoH * 0.16);
    if (away < 0.7) c.fillRect(cx - tw * 0.09 + side * 1.1, shoulderY, tw * 0.18, b.torsoH + 2);
    c.restore();
  }
  // belt
  cel(c, rrPath(c, cx - tw / 2 - 0.6 + side * 1.1, hipY - 3.4, tw + 1.2, 4.2, 1.6),
    leather, { depth: 1.6, rim: 0.8, line: 1.5 });

  // ── head ──
  const hx = cx + side * 2.2;
  if (o.head) {
    o.head(c, hx, headY, o);
  } else {
    drawHead(c, hx, headY, o);
  }

  // ── near limbs ──
  drawLeg(nearDir, nearDir < 0 ? pose.legL : pose.legR, false);
  const hand = drawArm(nearDir, nearDir < 0 ? pose.armL : pose.armR, false);

  if (o.weapon) o.weapon(c, hand.x, hand.y, hand.a, o);
  o.overlay?.(c, cx, foot, o);
}

/**
 * The default head: a skull, a hairline or a helmet, and a face when the
 * character is turned far enough toward the camera to have one.
 */
export function drawHead(
  c: CanvasRenderingContext2D, hx: number, hy: number, o: FigureOpts,
): void {
  const { build: b, mat, facing } = o;
  const away = AWAY[facing];
  const side = SIDE[facing];
  const r = b.head;

  cel(c, circPath(c, hx, hy, r), mat.skin, { depth: r * 0.34, rim: r * 0.17 });

  if (mat.helm) {
    // a helmet is a dome plus a brow band; the band is what makes it read as
    // worn rather than as a bald head in a different colour
    cel(c, () => {
      c.beginPath();
      c.arc(hx, hy - r * 0.1, r * 1.06, Math.PI * 1.02, Math.PI * 1.98);
      c.closePath();
    }, mat.helm, { depth: r * 0.3, rim: r * 0.16 });
    cel(c, rrPath(c, hx - r * 1.08, hy - r * 0.34, r * 2.16, r * 0.4, r * 0.18),
      tint(mat.helm, -0.14), { depth: 1.2, rim: 0.6, line: 1.5 });
    if (away < 0.55) {
      // nose guard
      cel(c, rrPath(c, hx - r * 0.13 + side * r * 0.3, hy - r * 0.3, r * 0.26, r * 0.72, r * 0.1),
        tint(mat.helm, -0.05), { depth: 0.8, rim: 0.5, line: 1.3 });
    }
  } else {
    cel(c, () => {
      c.beginPath();
      c.arc(hx, hy - r * 0.06, r * 1.03, Math.PI * 0.99, Math.PI * 2.01);
      c.lineTo(hx + r * 1.03, hy + r * 0.18);
      c.quadraticCurveTo(hx, hy - r * 0.16, hx - r * 1.03, hy + r * 0.18);
      c.closePath();
    }, mat.hair, { depth: r * 0.3, rim: r * 0.15 });
    // a couple of strands so the hairline is not a perfect arc
    c.save();
    c.fillStyle = tint(mat.hair, 0.18);
    c.beginPath();
    c.ellipse(hx - r * 0.42, hy - r * 0.58, r * 0.3, r * 0.16, -0.5, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  if (away < 0.72) {
    const ex = r * 0.36;
    const eo = side * r * 0.26;
    c.fillStyle = INK;
    // the far eye narrows as the head turns, which is the whole trick for
    // getting three-quarter views out of a flat circle
    const farW = r * 0.2 * (1 - away * 0.9);
    c.beginPath();
    c.ellipse(hx - ex + eo, hy + r * 0.14, farW, r * 0.22, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(hx + ex + eo, hy + r * 0.14, r * 0.2, r * 0.22, 0, 0, Math.PI * 2);
    c.fill();
    // catchlights
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.beginPath();
    c.arc(hx + ex + eo - r * 0.07, hy + r * 0.07, r * 0.07, 0, Math.PI * 2);
    c.fill();
    if (away < 0.3) {
      c.beginPath();
      c.arc(hx - ex + eo - r * 0.07, hy + r * 0.07, r * 0.07, 0, Math.PI * 2);
      c.fill();
    }
  }
}

// ─────────────────────────── weapons ───────────────────────────

/** A straight blade held in the hand, angled along the arm. */
export function blade(
  c: CanvasRenderingContext2D, hx: number, hy: number, angle: number,
  len: number, w: number, steel: string, guard: string,
): void {
  const a = angle - 0.55;
  const tipX = hx + Math.cos(a) * len;
  const tipY = hy + Math.sin(a) * len;
  const nx = Math.cos(a + Math.PI / 2) * (w / 2);
  const ny = Math.sin(a + Math.PI / 2) * (w / 2);
  cel(c, () => {
    c.beginPath();
    c.moveTo(hx + nx, hy + ny);
    c.lineTo(tipX + nx * 0.35, tipY + ny * 0.35);
    c.lineTo(tipX + Math.cos(a) * w * 0.7, tipY + Math.sin(a) * w * 0.7);
    c.lineTo(tipX - nx * 0.35, tipY - ny * 0.35);
    c.lineTo(hx - nx, hy - ny);
    c.closePath();
  }, steel, { depth: w * 0.5, rim: w * 0.3, line: 1.5 });
  cel(c, limbPath(c, hx - Math.cos(a) * 2, hy - Math.sin(a) * 2, w * 1.9, w * 0.9, a + Math.PI / 2),
    guard, { depth: 1.2, rim: 0.6, line: 1.4 });
}

/** A hafted weapon: shaft plus a head. Mauls, hammers, poleaxes. */
export function hafted(
  c: CanvasRenderingContext2D, hx: number, hy: number, angle: number,
  len: number, wood: string, headW: number, headH: number, steel: string,
): void {
  const a = angle - 0.75;
  const ex = hx + Math.cos(a) * len;
  const ey = hy + Math.sin(a) * len;
  cel(c, limbPath(c, hx - Math.cos(a) * len * 0.28, hy - Math.sin(a) * len * 0.28,
    len * 1.28, 3.2, a), wood, { depth: 1.4, rim: 0.7, line: 1.5 });
  c.save();
  c.translate(ex, ey);
  c.rotate(a + Math.PI / 2);
  cel(c, rrPath(c, -headW / 2, -headH / 2, headW, headH, headH * 0.22), steel,
    { depth: headH * 0.4, rim: headH * 0.22 });
  c.restore();
}

/** A spear, held level and pointing forward — the crew's whole armoury. */
export function spearArm(
  c: CanvasRenderingContext2D, hx: number, hy: number, angle: number,
  len: number, wood: string, steel: string,
): void {
  // held high and angled back over the shoulder, the way a levy actually
  // carries a spear on the march — pointed forward it reads as a rifle
  const a = angle - 2.0;
  cel(c, limbPath(c, hx - Math.cos(a) * len * 0.3, hy - Math.sin(a) * len * 0.3,
    len * 1.3, 2.8, a), wood, { depth: 1.2, rim: 0.6, line: 1.4 });
  const tx = hx + Math.cos(a) * len;
  const ty = hy + Math.sin(a) * len;
  const n = 3.1;
  cel(c, polyPath(c, [
    tx + Math.cos(a + Math.PI / 2) * n, ty + Math.sin(a + Math.PI / 2) * n,
    tx + Math.cos(a) * n * 2.6, ty + Math.sin(a) * n * 2.6,
    tx + Math.cos(a - Math.PI / 2) * n, ty + Math.sin(a - Math.PI / 2) * n,
  ]), steel, { depth: 1.4, rim: 0.8, line: 1.4 });
}

/** A bow, drawn side-on so the shape carries at distance. */
export function bow(
  c: CanvasRenderingContext2D, hx: number, hy: number, angle: number,
  r: number, wood: string, drawn: boolean,
): void {
  const a = angle - 1.2;
  c.save();
  c.translate(hx, hy);
  c.rotate(a);
  cel(c, () => {
    c.beginPath();
    c.arc(0, 0, r, -1.25, 1.25);
    c.arc(0, 0, r - 2.6, 1.25, -1.25, true);
    c.closePath();
  }, wood, { depth: 1.2, rim: 0.6, line: 1.4 });
  c.strokeStyle = 'rgba(255,246,226,0.9)';
  c.lineWidth = 1;
  c.beginPath();
  const t = drawn ? -r * 0.42 : 0;
  c.moveTo(Math.cos(-1.25) * r, Math.sin(-1.25) * r);
  c.lineTo(t, 0);
  c.lineTo(Math.cos(1.25) * r, Math.sin(1.25) * r);
  c.stroke();
  c.restore();
}
