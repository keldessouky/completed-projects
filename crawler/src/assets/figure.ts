import {
  INK, alpha, cel, celMetal, circPath, contactShadow, ellPath, occlude, polyPath, rrPath, tint,
} from './shade';

/**
 * The rig.
 *
 * Every person in this game — Carl, a levy, a redcloak, a Floor Captain — is
 * this one articulated figure with a different set of materials and a different
 * thing in its hands. That is not a shortcut; it is why they read as inhabiting
 * the same world.
 *
 * The rig is built out of the things that actually make a character look drawn
 * rather than assembled:
 *
 *  - **Two-segment limbs.** Thigh and shin, upper arm and forearm, with a knee
 *    and an elbow that bend. A single capsule per limb is what makes a figure
 *    read as a bean; a joint is what makes it read as a person.
 *  - **A shaped torso.** Shoulders wider than the waist, traced as a path, not
 *    a rounded rectangle.
 *  - **Separate kit.** Pauldrons, breastplate, faulds, bracers, greaves, belt,
 *    tabard, cape and hood are each their own piece, drawn in the order they
 *    would be worn, with occlusion where one overlaps another.
 *  - **A face.** Brow, nose, jaw and eyes, so a head is a head at 40 px.
 *
 * Poses are data. A frame is a set of joint angles, and the walk cycle is four
 * of them: two contacts with the body at its lowest, two passing positions with
 * it at its highest.
 */

/** The five painted facings. The other three are these, mirrored. */
export type Facing = 's' | 'se' | 'e' | 'ne' | 'n';
export const FACINGS: Facing[] = ['s', 'se', 'e', 'ne', 'n'];

/** Frames per character per facing: four walk, then one attack. */
export const WALK_FRAMES = 4;
export const ATTACK_FRAME = 4;
export const FRAMES_PER_FACING = 5;

export interface Pose {
  /** thigh swing, −1 back to +1 forward */
  hipL: number; hipR: number;
  /** knee bend, 0 straight to 1 fully tucked */
  kneeL: number; kneeR: number;
  /** shoulder swing, −1 back to +1 forward */
  shoulderL: number; shoulderR: number;
  /** elbow bend, 0 straight to 1 fully folded */
  elbowL: number; elbowR: number;
  /** vertical body offset, design px (negative is up) */
  bob: number;
  /** forward lean, radians */
  lean: number;
  /** 0..1, how far into a swing the weapon arm is */
  swing: number;
}

/**
 * The cycle. Contacts sit low with the legs split and the rear knee bending as
 * the foot leaves the ground; passing positions rise and tuck the trailing
 * knee right up. The arms counter-swing against the legs.
 */
export const WALK: Pose[] = [
  {
    hipL: 0.95, hipR: -0.85, kneeL: 0.1, kneeR: 0.5,
    shoulderL: -0.8, shoulderR: 0.8, elbowL: 0.35, elbowR: 0.55,
    bob: 0.7, lean: 0.05, swing: 0,
  },
  {
    hipL: 0.1, hipR: 0.05, kneeL: 0.05, kneeR: 0.95,
    shoulderL: -0.1, shoulderR: 0.1, elbowL: 0.45, elbowR: 0.45,
    bob: -2.6, lean: 0.02, swing: 0,
  },
  {
    hipL: -0.85, hipR: 0.95, kneeL: 0.5, kneeR: 0.1,
    shoulderL: 0.8, shoulderR: -0.8, elbowL: 0.55, elbowR: 0.35,
    bob: 0.7, lean: 0.05, swing: 0,
  },
  {
    hipL: 0.05, hipR: 0.1, kneeL: 0.95, kneeR: 0.05,
    shoulderL: 0.1, shoulderR: -0.1, elbowL: 0.45, elbowR: 0.45,
    bob: -2.6, lean: 0.02, swing: 0,
  },
];

/** The attack pose: weight forward, weapon arm through the swing. */
export const ATTACK: Pose = {
  hipL: 0.7, hipR: -0.6, kneeL: 0.2, kneeR: 0.35,
  shoulderL: -0.45, shoulderR: 1.15, elbowL: 0.5, elbowR: 0.15,
  bob: 0.9, lean: 0.16, swing: 1,
};

export const poseFor = (frame: number): Pose =>
  frame >= WALK_FRAMES ? ATTACK : WALK[frame % WALK_FRAMES];

/** Materials for one character. Every colour the rig can reach for. */
export interface Materials {
  skin: string;
  hair: string;
  /** the undershirt: sleeves and the strip visible at the neck */
  cloth: string;
  /** legs */
  trouser: string;
  /** boots, belt, straps */
  leather: string;
  /** the metal this character's kit is made of */
  steel: string;

  /** chest plate over the shirt */
  plate?: string;
  /** shoulder caps */
  pauldron?: string;
  /** hanging skirt plates over the hips */
  fauld?: string;
  /** forearm guards */
  bracer?: string;
  /** shin guards */
  greave?: string;
  /** a coloured surcoat over the chest */
  tabard?: string;
  /** trim on the tabard and belt */
  trim?: string;
  /** hangs behind */
  cape?: string;
  /** a hood instead of a helmet */
  hood?: string;
  /** a helmet instead of hair */
  helm?: string;
  /** facial hair */
  beard?: string;
}

export interface Build {
  h: number;
  /** half the shoulder span */
  shoulder: number;
  /** half the hip span */
  hip: number;
  head: number;
  /** thigh, shin, upper arm, forearm */
  thigh: number;
  shin: number;
  upper: number;
  fore: number;
  /** limb thickness at the top of each segment */
  limb: number;
  torsoH: number;
}

/**
 * A normal person, at roughly four and a half heads — squat enough to read as a
 * game character, tall enough to have a waist.
 */
export const BUILD: Build = {
  h: 54, shoulder: 9.2, hip: 6.6, head: 7.4,
  thigh: 9, shin: 8.4, upper: 8, fore: 7.4, limb: 5, torsoH: 17,
};

export const scaleBuild = (b: Build, k: number, headK = 1): Build => ({
  h: b.h * k,
  shoulder: b.shoulder * k,
  hip: b.hip * k,
  head: b.head * k * headK,
  thigh: b.thigh * k,
  shin: b.shin * k,
  upper: b.upper * k,
  fore: b.fore * k,
  limb: b.limb * k,
  torsoH: b.torsoH * k,
});

/** How far a facing is turned away from the camera, 0 (at you) to 1 (away). */
const AWAY: Record<Facing, number> = { s: 0, se: 0.25, e: 0.5, ne: 0.8, n: 1 };
/** How far the body is turned to the side, 0..1 (toward screen-right). */
const SIDE: Record<Facing, number> = { s: 0, se: 0.5, e: 1, ne: 0.7, n: 0 };

export interface FigureOpts {
  build: Build;
  mat: Materials;
  facing: Facing;
  pose: Pose;
  back?: (c: CanvasRenderingContext2D, cx: number, foot: number, o: FigureOpts) => void;
  weapon?: (
    c: CanvasRenderingContext2D, hx: number, hy: number, angle: number, o: FigureOpts,
  ) => void;
  /** drawn in the OFF hand — a shield, a torch */
  offhand?: (
    c: CanvasRenderingContext2D, hx: number, hy: number, angle: number, o: FigureOpts,
  ) => void;
  head?: (c: CanvasRenderingContext2D, hx: number, hy: number, o: FigureOpts) => void;
  overlay?: (c: CanvasRenderingContext2D, cx: number, foot: number, o: FigureOpts) => void;
  bareArms?: boolean;
  bareLegs?: boolean;
}

/** A tapered capsule from (x,y) at `angle`, `w0` wide at the root, `w1` at the tip. */
function segPath(
  c: CanvasRenderingContext2D, x: number, y: number, len: number,
  w0: number, w1: number, angle: number,
): () => void {
  return () => {
    const ex = x + Math.cos(angle) * len;
    const ey = y + Math.sin(angle) * len;
    const n = angle + Math.PI / 2;
    const n0x = Math.cos(n) * (w0 / 2), n0y = Math.sin(n) * (w0 / 2);
    const n1x = Math.cos(n) * (w1 / 2), n1y = Math.sin(n) * (w1 / 2);
    c.beginPath();
    c.moveTo(x + n0x, y + n0y);
    c.lineTo(ex + n1x, ey + n1y);
    c.arc(ex, ey, w1 / 2, n, n - Math.PI, true);
    c.lineTo(x - n0x, y - n0y);
    c.arc(x, y, w0 / 2, n - Math.PI, n, true);
    c.closePath();
  };
}

/**
 * Draw one frame of one character.
 *
 * Order is back-to-front and follows how the kit would actually be put on:
 * shadow, cape, back item, far leg, far arm, shirt, plate, tabard, faulds,
 * belt, pauldrons, head, near leg, near arm, weapon, overlay.
 */
export function drawFigure(c: CanvasRenderingContext2D, w: number, h: number, o: FigureOpts): void {
  const { build: b, mat, facing, pose } = o;
  const cx = w / 2;
  const foot = h - 3;
  const away = AWAY[facing];
  const side = SIDE[facing];

  // The gait's bob moves the BODY, not the shadow: a shadow that rises with
  // the character is the fastest way to un-plant a sprite. It shrinks instead.
  const bob = pose.bob;
  contactShadow(c, cx, foot - 1, b.shoulder * 1.7, 0.32 - bob * 0.012);

  const hipY = foot - b.thigh - b.shin + bob;
  const shoulderY = hipY - b.torsoH;
  const headY = shoulderY - b.head * 0.86;
  const turn = 1 - away * 0.22;              // limbs narrow as the body turns
  const swingScale = 0.5 + side * 0.5;

  const legCol = o.bareLegs ? mat.skin : mat.trouser;
  const armCol = o.bareArms ? mat.skin : mat.cloth;

  /** thigh → knee → shin → boot */
  const drawLeg = (dir: number, hip: number, knee: number, far: boolean): void => {
    const shade = far ? -0.18 : 0;
    const x = cx + dir * b.hip * turn + side * 1.4;
    const a1 = Math.PI / 2 + hip * 0.42 * swingScale;
    const kx = x + Math.cos(a1) * b.thigh;
    const ky = hipY + Math.sin(a1) * b.thigh;
    // the shin trails the thigh by the knee bend, always folding backward
    const a2 = a1 - knee * 0.95 * (0.4 + side * 0.6) * (hip < 0 ? 1 : 0.55);
    const fx = kx + Math.cos(a2) * b.shin;
    const fy = ky + Math.sin(a2) * b.shin;

    cel(c, segPath(c, x, hipY, b.thigh, b.limb * 1.06, b.limb * 0.86, a1),
      tint(legCol, shade), { depth: 2.2, rim: 1, line: 1.6 });
    cel(c, segPath(c, kx, ky, b.shin, b.limb * 0.86, b.limb * 0.66, a2),
      tint(mat.greave ?? legCol, shade), { depth: 2, rim: 0.9, line: 1.6 });
    if (mat.greave) {
      // a plate strapped over the shin, not the whole shin
      celMetal(c, segPath(c, kx + Math.cos(a2) * 1.5, ky + Math.sin(a2) * 1.5,
        b.shin * 0.62, b.limb * 0.8, b.limb * 0.62, a2), tint(mat.greave, shade),
        { line: 1.4 });
    }
    // boot: a wedge, longer toward the way the body faces
    const toe = dir * 0.4 + side * 1.5;
    cel(c, polyPath(c, [
      fx - b.limb * 0.5, fy - b.limb * 0.34,
      fx + b.limb * 0.5, fy - b.limb * 0.34,
      fx + b.limb * 0.62 + toe, fy + b.limb * 0.2,
      fx + b.limb * 0.34 + toe, fy + b.limb * 0.46,
      fx - b.limb * 0.62, fy + b.limb * 0.46,
    ]), tint(mat.leather, shade), { depth: 1.6, rim: 0.8, line: 1.5 });
  };

  /** upper arm → elbow → forearm → hand */
  const drawArm = (
    dir: number, shoulder: number, elbow: number, far: boolean,
  ): { x: number; y: number; a: number } => {
    const shade = far ? -0.18 : 0;
    const x = cx + dir * b.shoulder * turn * 0.86 + side * 1.8;
    const y = shoulderY + b.head * 0.16;
    const a1 = Math.PI / 2 + shoulder * 0.55 * swingScale + dir * side * 0.2;
    const ex = x + Math.cos(a1) * b.upper;
    const ey = y + Math.sin(a1) * b.upper;
    const a2 = a1 + elbow * 0.85 * (0.35 + side * 0.65);
    const hx = ex + Math.cos(a2) * b.fore;
    const hy = ey + Math.sin(a2) * b.fore;

    cel(c, segPath(c, x, y, b.upper, b.limb * 0.98, b.limb * 0.78, a1),
      tint(armCol, shade), { depth: 2, rim: 0.9, line: 1.6 });
    cel(c, segPath(c, ex, ey, b.fore, b.limb * 0.8, b.limb * 0.6, a2),
      tint(mat.bracer ?? armCol, shade), { depth: 1.8, rim: 0.9, line: 1.6 });
    if (mat.bracer) {
      celMetal(c, segPath(c, ex + Math.cos(a2) * 1.2, ey + Math.sin(a2) * 1.2,
        b.fore * 0.66, b.limb * 0.74, b.limb * 0.58, a2), tint(mat.bracer, shade),
        { line: 1.3 });
    }
    // glove
    cel(c, ellPath(c, hx, hy, b.limb * 0.46, b.limb * 0.4, a2),
      tint(mat.bracer ? mat.leather : mat.skin, shade), { depth: 1.2, rim: 0.6, line: 1.4 });
    return { x: hx, y: hy, a: a2 };
  };

  // ── cape ──
  if (mat.cape) {
    // A cape hangs BEHIND a person; it does not wrap around them. Sized off
    // the shoulders and tapered inward, or it becomes a coloured oval with a
    // head on top — which is exactly what a first pass at 2.3× produced.
    const capeW = b.shoulder * 1.15;
    cel(c, () => {
      c.beginPath();
      c.moveTo(cx - capeW, shoulderY + 2);
      c.lineTo(cx + capeW, shoulderY + 2);
      c.quadraticCurveTo(cx + capeW * 1.15, hipY + b.thigh * 0.4, cx + capeW * 0.78, foot - 2);
      c.quadraticCurveTo(cx, foot + 1, cx - capeW * 0.78, foot - 2);
      c.quadraticCurveTo(cx - capeW * 1.15, hipY + b.thigh * 0.4, cx - capeW, shoulderY + 2);
      c.closePath();
    }, mat.cape, { depth: 4, rim: 2 });
    // two folds, so the cloth has a direction
    c.save();
    c.strokeStyle = alpha(INK, 0.24);
    c.lineWidth = 1.3;
    for (const d of [-0.42, 0.38]) {
      c.beginPath();
      c.moveTo(cx + capeW * d, shoulderY + 4);
      c.quadraticCurveTo(cx + capeW * d * 1.2, hipY + b.thigh * 0.4, cx + capeW * d * 1.35, foot - 4);
      c.stroke();
    }
    c.restore();
  }

  o.back?.(c, cx, foot, o);

  // ── far limbs ──
  const farDir = side >= 0 ? -1 : 1;
  const nearDir = -farDir;
  drawLeg(farDir, farDir < 0 ? pose.hipL : pose.hipR, farDir < 0 ? pose.kneeL : pose.kneeR, true);
  const farHand = drawArm(
    farDir, farDir < 0 ? pose.shoulderL : pose.shoulderR,
    farDir < 0 ? pose.elbowL : pose.elbowR, true,
  );

  // ── the shirt: shoulders wider than the waist ──
  const sw = b.shoulder * turn;
  const hw = b.hip * turn;
  const torsoPath = () => {
    c.beginPath();
    c.moveTo(cx - sw + side * 1.2, shoulderY + 1);
    c.quadraticCurveTo(cx + side * 1.2, shoulderY - 1.6, cx + sw + side * 1.2, shoulderY + 1);
    c.quadraticCurveTo(cx + sw * 0.9 + side * 1.2, hipY - b.torsoH * 0.4, cx + hw + side * 1.2, hipY + 1);
    c.quadraticCurveTo(cx + side * 1.2, hipY + 3, cx - hw + side * 1.2, hipY + 1);
    c.quadraticCurveTo(cx - sw * 0.9 + side * 1.2, hipY - b.torsoH * 0.4, cx - sw + side * 1.2, shoulderY + 1);
    c.closePath();
  };
  cel(c, torsoPath, armCol, { depth: 3.2, rim: 1.5 });

  // ── plate over the shirt ──
  if (mat.plate) {
    const pw = sw * 0.9;
    const platePath = () => {
      c.beginPath();
      c.moveTo(cx - pw + side * 1.2, shoulderY + 2.4);
      c.quadraticCurveTo(cx + side * 1.2, shoulderY + 0.4, cx + pw + side * 1.2, shoulderY + 2.4);
      c.quadraticCurveTo(cx + pw * 0.94 + side * 1.2, hipY - b.torsoH * 0.3,
        cx + hw * 0.86 + side * 1.2, hipY - 2);
      c.quadraticCurveTo(cx + side * 1.2, hipY + 1, cx - hw * 0.86 + side * 1.2, hipY - 2);
      c.quadraticCurveTo(cx - pw * 0.94 + side * 1.2, hipY - b.torsoH * 0.3,
        cx - pw + side * 1.2, shoulderY + 2.4);
      c.closePath();
    };
    celMetal(c, platePath, mat.plate);
    occlude(c, platePath, torsoPath, 2, 0.26);
    // the sternum ridge
    c.save();
    platePath();
    c.clip();
    c.strokeStyle = alpha(INK, 0.26);
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(cx + side * 1.2, shoulderY + 3);
    c.lineTo(cx + side * 1.2, hipY - 2);
    c.stroke();
    c.strokeStyle = 'rgba(255,252,240,0.3)';
    c.beginPath();
    c.moveTo(cx - 1 + side * 1.2, shoulderY + 3);
    c.lineTo(cx - 1 + side * 1.2, hipY - 2);
    c.stroke();
    c.restore();
  }

  // ── tabard ──
  if (mat.tabard) {
    const tw = hw * 1.15;
    cel(c, () => {
      c.beginPath();
      c.moveTo(cx - tw + side * 1.2, shoulderY + 3);
      c.lineTo(cx + tw + side * 1.2, shoulderY + 3);
      c.lineTo(cx + tw * 0.92 + side * 1.2, hipY + b.thigh * 0.55);
      c.lineTo(cx + side * 1.2, hipY + b.thigh * 0.75);
      c.lineTo(cx - tw * 0.92 + side * 1.2, hipY + b.thigh * 0.55);
      c.closePath();
    }, mat.tabard, { depth: 2.6, rim: 1.3 });
    if (mat.trim) {
      c.save();
      c.strokeStyle = mat.trim;
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(cx - tw * 0.98 + side * 1.2, shoulderY + 4.4);
      c.lineTo(cx - tw * 0.9 + side * 1.2, hipY + b.thigh * 0.5);
      c.moveTo(cx + tw * 0.98 + side * 1.2, shoulderY + 4.4);
      c.lineTo(cx + tw * 0.9 + side * 1.2, hipY + b.thigh * 0.5);
      c.stroke();
      c.restore();
    }
  }

  // ── faulds: the skirt of plates over the hips ──
  if (mat.fauld) {
    for (let i = -1; i <= 1; i++) {
      const fx = cx + i * hw * 0.82 + side * 1.2;
      celMetal(c, rrPath(c, fx - hw * 0.46, hipY - 1.5, hw * 0.92, b.thigh * 0.62, 1.4),
        mat.fauld, { line: 1.4 });
    }
  }

  // ── belt ──
  cel(c, rrPath(c, cx - hw * 1.18 + side * 1.2, hipY - 2.6, hw * 2.36, 3.6, 1.3),
    mat.leather, { depth: 1.4, rim: 0.7, line: 1.4 });
  const buckle = Math.min(4.6, hw * 0.5);
  celMetal(c, rrPath(c, cx - buckle / 2 + side * 1.2, hipY - 3, buckle, 4.4, 1),
    mat.trim ?? mat.steel, { line: 1.2 });

  // ── pauldrons ──
  if (mat.pauldron) {
    for (const d of [-1, 1]) {
      const px = cx + d * sw * 0.98 + side * 1.2;
      celMetal(c, () => {
        c.beginPath();
        c.ellipse(px, shoulderY + 2.6, b.shoulder * 0.5, b.shoulder * 0.42, d * 0.25, 0, Math.PI * 2);
      }, mat.pauldron);
      c.save();
      c.strokeStyle = alpha(INK, 0.22);
      c.lineWidth = 1.1;
      c.beginPath();
      c.ellipse(px, shoulderY + 3.6, b.shoulder * 0.34, b.shoulder * 0.26, d * 0.25, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }
  }

  // ── head ──
  const hx = cx + side * 2.4;
  if (o.head) o.head(c, hx, headY, o);
  else drawHead(c, hx, headY, o);

  // ── near limbs ──
  drawLeg(nearDir, nearDir < 0 ? pose.hipL : pose.hipR, nearDir < 0 ? pose.kneeL : pose.kneeR, false);
  const hand = drawArm(
    nearDir, nearDir < 0 ? pose.shoulderL : pose.shoulderR,
    nearDir < 0 ? pose.elbowL : pose.elbowR, false,
  );

  if (o.offhand) o.offhand(c, farHand.x, farHand.y, farHand.a, o);
  if (o.weapon) o.weapon(c, hand.x, hand.y, hand.a, o);
  o.overlay?.(c, cx, foot, o);
}

/**
 * The head: a skull with a jaw, a brow, a nose and eyes, then hair or a helmet
 * over it. The brow shadow is what stops a face reading as two dots on an egg.
 */
export function drawHead(
  c: CanvasRenderingContext2D, hx: number, hy: number, o: FigureOpts,
): void {
  const { build: b, mat, facing } = o;
  const away = AWAY[facing];
  const side = SIDE[facing];
  const r = b.head;

  // neck
  cel(c, rrPath(c, hx - r * 0.28 - side * 0.6, hy + r * 0.5, r * 0.56, r * 0.6, r * 0.2),
    tint(mat.skin, -0.22), { depth: 1, rim: 0.5, line: 1.3 });

  // skull: an egg with a jaw, narrowed as it turns away
  const fw = r * (1 - away * 0.12);
  const skull = () => {
    c.beginPath();
    c.moveTo(hx - fw, hy - r * 0.1);
    c.quadraticCurveTo(hx - fw, hy - r * 1.02, hx + side * r * 0.1, hy - r * 1.02);
    c.quadraticCurveTo(hx + fw, hy - r * 1.02, hx + fw, hy - r * 0.1);
    c.quadraticCurveTo(hx + fw * 0.92, hy + r * 0.66, hx + side * r * 0.12, hy + r * 0.8);
    c.quadraticCurveTo(hx - fw * 0.92, hy + r * 0.66, hx - fw, hy - r * 0.1);
    c.closePath();
  };
  cel(c, skull, mat.skin, { depth: r * 0.3, rim: r * 0.16 });

  if (away < 0.78) {
    const eo = side * r * 0.22;
    // brow shadow: one soft band is most of what makes a face a face
    c.save();
    skull();
    c.clip();
    c.fillStyle = alpha(INK, 0.16);
    c.beginPath();
    c.ellipse(hx + eo, hy - r * 0.16, fw * 0.86, r * 0.3, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();

    const ex = fw * 0.4;
    const eyeW = r * 0.19;
    const farW = eyeW * (1 - away * 0.85);
    c.fillStyle = '#fdf6ea';
    if (farW > 0.6) {
      c.beginPath(); c.ellipse(hx - ex + eo, hy + r * 0.06, farW, r * 0.2, 0, 0, Math.PI * 2); c.fill();
    }
    c.beginPath(); c.ellipse(hx + ex + eo, hy + r * 0.06, eyeW, r * 0.2, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = INK;
    if (farW > 0.6) {
      c.beginPath(); c.ellipse(hx - ex + eo + side * 0.5, hy + r * 0.08, farW * 0.62, r * 0.15, 0, 0, Math.PI * 2); c.fill();
    }
    c.beginPath(); c.ellipse(hx + ex + eo + side * 0.5, hy + r * 0.08, eyeW * 0.62, r * 0.15, 0, 0, Math.PI * 2); c.fill();

    // nose and mouth
    c.strokeStyle = alpha(INK, 0.4);
    c.lineWidth = 1.1;
    c.beginPath();
    c.moveTo(hx + eo + side * r * 0.1, hy + r * 0.16);
    c.lineTo(hx + eo + side * r * 0.16, hy + r * 0.36);
    c.stroke();
    c.beginPath();
    c.moveTo(hx + eo - r * 0.16, hy + r * 0.5);
    c.lineTo(hx + eo + r * 0.16, hy + r * 0.5);
    c.stroke();
  }

  if (mat.beard && away < 0.8) {
    cel(c, () => {
      c.beginPath();
      c.moveTo(hx - fw * 0.9, hy + r * 0.1);
      c.quadraticCurveTo(hx + side * r * 0.1, hy + r * 1.5, hx + fw * 0.9, hy + r * 0.1);
      c.quadraticCurveTo(hx + side * r * 0.1, hy + r * 0.62, hx - fw * 0.9, hy + r * 0.1);
      c.closePath();
    }, mat.beard, { depth: r * 0.24, rim: r * 0.12, line: 1.4 });
  }

  if (mat.helm) {
    // dome, brow band, nasal, cheek plates
    celMetal(c, () => {
      c.beginPath();
      c.moveTo(hx - fw * 1.08, hy - r * 0.02);
      c.quadraticCurveTo(hx - fw * 1.08, hy - r * 1.3, hx + side * r * 0.1, hy - r * 1.3);
      c.quadraticCurveTo(hx + fw * 1.08, hy - r * 1.3, hx + fw * 1.08, hy - r * 0.02);
      c.closePath();
    }, mat.helm);
    celMetal(c, rrPath(c, hx - fw * 1.12, hy - r * 0.26, fw * 2.24, r * 0.36, r * 0.14),
      tint(mat.helm, -0.12), { line: 1.4 });
    if (away < 0.6) {
      celMetal(c, rrPath(c, hx - r * 0.11 + side * r * 0.16, hy - r * 0.2, r * 0.22, r * 0.76, r * 0.08),
        mat.helm, { line: 1.2 });
      for (const d of [-1, 1]) {
        celMetal(c, rrPath(c, hx + d * fw * 0.82 - r * 0.13 + side * r * 0.1, hy - r * 0.2,
          r * 0.26, r * 0.66, r * 0.1), tint(mat.helm, -0.06), { line: 1.2 });
      }
    }
  } else if (mat.hood) {
    cel(c, () => {
      c.beginPath();
      c.moveTo(hx - fw * 1.1, hy + r * 0.08);
      c.quadraticCurveTo(hx - fw * 1.1, hy - r * 1.3, hx + side * r * 0.1, hy - r * 1.3);
      c.quadraticCurveTo(hx + fw * 1.1, hy - r * 1.3, hx + fw * 1.1, hy + r * 0.08);
      c.quadraticCurveTo(hx + fw * 0.7, hy - r * 0.5, hx + side * r * 0.1, hy - r * 0.54);
      c.quadraticCurveTo(hx - fw * 0.7, hy - r * 0.5, hx - fw * 1.1, hy + r * 0.08);
      c.closePath();
    }, mat.hood, { depth: r * 0.34, rim: r * 0.16 });
    // the shadow the hood casts on the face
    c.save();
    skull();
    c.clip();
    c.fillStyle = alpha(INK, 0.22);
    c.fillRect(hx - r * 2, hy - r * 2, r * 4, r * 1.62);
    c.restore();
  } else {
    // hair as three overlapping locks, so the hairline is not a perfect arc
    cel(c, () => {
      c.beginPath();
      c.moveTo(hx - fw * 1.04, hy + r * 0.16);
      c.quadraticCurveTo(hx - fw * 1.06, hy - r * 1.16, hx + side * r * 0.1, hy - r * 1.16);
      c.quadraticCurveTo(hx + fw * 1.06, hy - r * 1.16, hx + fw * 1.04, hy + r * 0.16);
      c.quadraticCurveTo(hx + fw * 0.66, hy - r * 0.42, hx + fw * 0.2, hy - r * 0.3);
      c.quadraticCurveTo(hx - fw * 0.3, hy - r * 0.14, hx - fw * 1.04, hy + r * 0.16);
      c.closePath();
    }, mat.hair, { depth: r * 0.3, rim: r * 0.15 });
    c.save();
    c.fillStyle = tint(mat.hair, 0.2);
    for (const [dx, dy, w2, h2, rot] of [
      [-0.42, -0.66, 0.34, 0.16, -0.5],
      [0.1, -0.86, 0.28, 0.13, -0.2],
    ] as const) {
      c.beginPath();
      c.ellipse(hx + fw * dx, hy + r * dy, r * w2, r * h2, rot, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }
}

// ─────────────────────────── weapons ───────────────────────────

/** A straight blade: fuller, crossguard, grip and pommel. */
export function blade(
  c: CanvasRenderingContext2D, hx: number, hy: number, angle: number,
  len: number, w: number, steel: string, guard: string, lean = 0.5,
): void {
  // `lean` swings the blade away from the body. A short machete can hang close;
  // a greatsword at the same angle goes straight through its owner's legs.
  const a = angle - lean;
  const ux = Math.cos(a), uy = Math.sin(a);
  const nx = Math.cos(a + Math.PI / 2), ny = Math.sin(a + Math.PI / 2);
  const rootX = hx + ux * w * 0.9, rootY = hy + uy * w * 0.9;
  const tipX = hx + ux * len, tipY = hy + uy * len;

  celMetal(c, () => {
    c.beginPath();
    c.moveTo(rootX + nx * w * 0.5, rootY + ny * w * 0.5);
    c.lineTo(tipX + nx * w * 0.22, tipY + ny * w * 0.22);
    c.lineTo(tipX + ux * w * 0.9, tipY + uy * w * 0.9);
    c.lineTo(tipX - nx * w * 0.22, tipY - ny * w * 0.22);
    c.lineTo(rootX - nx * w * 0.5, rootY - ny * w * 0.5);
    c.closePath();
  }, steel, { line: 1.4 });
  // fuller: the groove down the middle
  c.save();
  c.strokeStyle = alpha(INK, 0.28);
  c.lineWidth = Math.max(0.8, w * 0.16);
  c.beginPath();
  c.moveTo(rootX + ux * w * 0.4, rootY + uy * w * 0.4);
  c.lineTo(tipX - ux * w * 0.6, tipY - uy * w * 0.6);
  c.stroke();
  c.restore();
  // crossguard, grip, pommel
  celMetal(c, () => {
    c.beginPath();
    c.roundRect(-w * 1.5, -w * 0.34, w * 3, w * 0.68, w * 0.2);
  }, guard, { line: 1.3 });
  c.save();
  c.translate(hx, hy);
  c.rotate(a + Math.PI / 2);
  cel(c, rrPath(c, -w * 0.32, -w * 0.4, w * 0.64, w * 1.7, w * 0.2), '#3a2a1c',
    { depth: 1, rim: 0.5, line: 1.2 });
  cel(c, circPath(c, 0, w * 1.5, w * 0.42), guard, { depth: 1, rim: 0.5, line: 1.2 });
  c.restore();
}

/** A hafted weapon: shaft, langets and a head. */
export function hafted(
  c: CanvasRenderingContext2D, hx: number, hy: number, angle: number,
  len: number, wood: string, headW: number, headH: number, steel: string,
): void {
  const a = angle - 0.75;
  const ex = hx + Math.cos(a) * len;
  const ey = hy + Math.sin(a) * len;
  cel(c, segPath(c, hx - Math.cos(a) * len * 0.3, hy - Math.sin(a) * len * 0.3,
    len * 1.3, 3.4, 2.8, a), wood, { depth: 1.4, rim: 0.7, line: 1.5 });
  c.save();
  c.translate(ex, ey);
  c.rotate(a + Math.PI / 2);
  celMetal(c, rrPath(c, -headW / 2, -headH / 2, headW, headH, headH * 0.2), steel);
  c.strokeStyle = alpha(INK, 0.3);
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(-headW / 2 + 2, -headH / 2 + 2);
  c.lineTo(-headW / 2 + 2, headH / 2 - 2);
  c.stroke();
  c.restore();
}

/** A spear, carried high and angled back over the shoulder. */
export function spearArm(
  c: CanvasRenderingContext2D, hx: number, hy: number, angle: number,
  len: number, wood: string, steel: string,
): void {
  const a = angle - Math.PI - 0.22;
  cel(c, segPath(c, hx - Math.cos(a) * len * 0.3, hy - Math.sin(a) * len * 0.3,
    len * 1.3, 2.9, 2.4, a), wood, { depth: 1.2, rim: 0.6, line: 1.4 });
  const tx = hx + Math.cos(a) * len;
  const ty = hy + Math.sin(a) * len;
  const n = 3.2;
  celMetal(c, polyPath(c, [
    tx + Math.cos(a + Math.PI / 2) * n, ty + Math.sin(a + Math.PI / 2) * n,
    tx + Math.cos(a) * n * 2.8, ty + Math.sin(a) * n * 2.8,
    tx + Math.cos(a - Math.PI / 2) * n, ty + Math.sin(a - Math.PI / 2) * n,
  ]), steel, { line: 1.3 });
  // the collar where the head meets the shaft
  celMetal(c, ellPath(c, tx, ty, n * 0.8, n * 0.55, a), tint(steel, -0.16), { line: 1.1 });
}

/** A bow with recurved limbs and a nocked arrow when drawn. */
export function bow(
  c: CanvasRenderingContext2D, hx: number, hy: number, angle: number,
  r: number, wood: string, drawn: boolean,
): void {
  // The bow is held at arm's length in front, not worn around the torso: at a
  // radius near the body's own height it stops being a weapon and becomes a
  // hoop the character is standing inside.
  const a = angle - 1.25;
  c.save();
  c.translate(hx + Math.cos(a) * r * 0.55, hy + Math.sin(a) * r * 0.55);
  c.rotate(a);
  cel(c, () => {
    c.beginPath();
    c.arc(0, 0, r, -1.3, 1.3);
    c.arc(0, 0, r - 2.8, 1.3, -1.3, true);
    c.closePath();
  }, wood, { depth: 1.3, rim: 0.7, line: 1.4 });
  for (const s of [-1, 1]) {
    cel(c, ellPath(c, Math.cos(1.3 * s) * (r - 1.4), Math.sin(1.3 * s) * (r - 1.4), 1.5, 1.1),
      tint(wood, -0.25), { depth: 0.6, rim: 0.3, line: 1 });
  }
  c.strokeStyle = 'rgba(250,244,228,0.92)';
  c.lineWidth = 1;
  const t = drawn ? -r * 0.5 : 0;
  c.beginPath();
  c.moveTo(Math.cos(-1.3) * r, Math.sin(-1.3) * r);
  c.lineTo(t, 0);
  c.lineTo(Math.cos(1.3) * r, Math.sin(1.3) * r);
  c.stroke();
  if (drawn) {
    c.strokeStyle = '#8a5a30';
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(t, 0);
    c.lineTo(r * 1.25, 0);
    c.stroke();
  }
  c.restore();
}

/** A round shield with a boss and a rim. */
export function shield(
  c: CanvasRenderingContext2D, hx: number, hy: number, angle: number,
  r: number, face: string, rim: string,
): void {
  void angle;
  cel(c, ellPath(c, hx, hy, r, r * 0.94), face, { depth: r * 0.4, rim: r * 0.2 });
  c.save();
  c.strokeStyle = rim;
  c.lineWidth = r * 0.2;
  c.beginPath();
  c.ellipse(hx, hy, r * 0.9, r * 0.85, 0, 0, Math.PI * 2);
  c.stroke();
  c.restore();
  celMetal(c, ellPath(c, hx, hy, r * 0.3, r * 0.28), rim, { line: 1.2 });
}
