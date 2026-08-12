/**
 * Colour maths and the cel-shading primitive every painter in the game draws
 * through.
 *
 * The whole art style comes out of one idea: a shape is filled three times from
 * a single path — light, base and shade — each offset a little further away
 * from one fixed light direction, and then outlined. That gives a hard-edged
 * three-tone ramp with a consistent light source across every sprite, prop and
 * building without any painter having to think about where the sun is.
 *
 * Doing it from one path also means adding detail is cheap: describe the
 * silhouette once and the shading, the rim light and the keyline all follow.
 */

/** Screen-space light direction: up and to the left, normalised. */
export const LIGHT_X = -0.5145;
export const LIGHT_Y = -0.8575;

/** The one keyline colour. Everything is outlined in it. */
export const INK = '#241f18';

// ─────────────────────────── colour maths ───────────────────────────

function parse(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3
    ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
    : h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const clamp255 = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

const toHex = (r: number, g: number, b: number): string =>
  '#' + ((1 << 24) | (clamp255(r) << 16) | (clamp255(g) << 8) | clamp255(b)).toString(16).slice(1);

/**
 * Lighten (`amt` > 0) or darken (`amt` < 0) a colour.
 *
 * Lightening pulls toward a warm white and darkening toward a cool blue-black
 * rather than toward pure white and pure black. Neutral ramps read as plastic;
 * warm light and cool shade is what makes a flat fill look like a lit surface,
 * and it costs two constants.
 */
export function tint(hex: string, amt: number): string {
  const [r, g, b] = parse(hex);
  if (amt >= 0) {
    const t = Math.min(1, amt);
    return toHex(r + (255 - r) * t, g + (248 - g) * t, b + (226 - b) * t);
  }
  const t = Math.min(1, -amt);
  return toHex(r * (1 - t) + 18 * t, g * (1 - t) + 20 * t, b * (1 - t) + 34 * t);
}

/** Linear blend between two colours. */
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  return toHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/** `hex` with an alpha, as an rgba() string. */
export function alpha(hex: string, a: number): string {
  const [r, g, b] = parse(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// ─────────────────────────── the cel primitive ───────────────────────────

export type PathFn = () => void;

export interface CelOpts {
  /** how far the shade band reaches in from the away edge, design px */
  depth?: number;
  /** how far the rim light reaches in from the lit edge, design px */
  rim?: number;
  /** keyline width; 0 draws no outline */
  line?: number;
  /** override the derived shade and light tones */
  dark?: string;
  light?: string;
  /** skip the rim entirely — right for small or very dark shapes */
  flat?: boolean;
}

/**
 * Fill a path as a three-tone cel-shaded solid.
 *
 * The trick: clip to the shape, flood it with the LIGHT tone, then re-fill the
 * same path offset away from the light in the BASE tone — which leaves a lit
 * crescent along the edge facing the light — and once more, offset further, in
 * the SHADE tone, which leaves a base-toned band between the two. One path,
 * three tones, and the ramp always runs the same way.
 */
export function cel(
  c: CanvasRenderingContext2D, path: PathFn, base: string, opts: CelOpts = {},
): void {
  const depth = opts.depth ?? 2.6;
  const rim = opts.rim ?? 1.3;
  const dark = opts.dark ?? tint(base, -0.3);
  const light = opts.light ?? tint(base, 0.26);

  c.save();
  path();
  c.clip();

  if (opts.flat) {
    c.fillStyle = base;
    c.fillRect(-4000, -4000, 8000, 8000);
  } else {
    c.fillStyle = light;
    c.fillRect(-4000, -4000, 8000, 8000);

    c.save();
    c.translate(-LIGHT_X * rim, -LIGHT_Y * rim);
    path();
    c.fillStyle = base;
    c.fill();
    c.restore();

    c.save();
    c.translate(-LIGHT_X * (rim + depth), -LIGHT_Y * (rim + depth));
    path();
    c.fillStyle = dark;
    c.fill();
    c.restore();
  }
  c.restore();

  const line = opts.line ?? 1.9;
  if (line > 0) {
    c.save();
    path();
    c.strokeStyle = INK;
    c.lineWidth = line;
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.stroke();
    c.restore();
  }
}

// ─────────────────────────── path helpers ───────────────────────────

export const rrPath = (
  c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number,
): PathFn => () => { c.beginPath(); c.roundRect(x, y, w, h, r); };

export const circPath = (
  c: CanvasRenderingContext2D, x: number, y: number, r: number,
): PathFn => () => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); };

export const ellPath = (
  c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0,
): PathFn => () => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); };

export const polyPath = (
  c: CanvasRenderingContext2D, pts: number[],
): PathFn => () => {
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath();
};

/**
 * A capsule from (x, y) running `len` at `angle`, `w` wide. Limbs are all of
 * these, which is why they get their own helper rather than a rotated rect:
 * the round ends are what stop a walk cycle looking like scissors.
 */
export const limbPath = (
  c: CanvasRenderingContext2D, x: number, y: number, len: number, w: number, angle: number,
): PathFn => () => {
  const ex = x + Math.cos(angle) * len;
  const ey = y + Math.sin(angle) * len;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(ex, ey);
  // stroking a line with a round cap is the cheapest correct capsule there is,
  // but it cannot be filled — so trace it as a path instead
  const nx = Math.cos(angle + Math.PI / 2) * (w / 2);
  const ny = Math.sin(angle + Math.PI / 2) * (w / 2);
  c.beginPath();
  c.moveTo(x + nx, y + ny);
  c.lineTo(ex + nx, ey + ny);
  c.arc(ex, ey, w / 2, angle + Math.PI / 2, angle - Math.PI / 2, true);
  c.lineTo(x - nx, y - ny);
  c.arc(x, y, w / 2, angle - Math.PI / 2, angle + Math.PI / 2, true);
  c.closePath();
};

/**
 * The contact shadow. Squashed to the ground plane's own 2:1 and softened at
 * the edge, because a hard-edged ellipse under a character reads as a sticker
 * and a soft one reads as a body standing in sunlight.
 */
export function contactShadow(
  c: CanvasRenderingContext2D, cx: number, cy: number, rx: number, strength = 0.34,
): void {
  const ry = rx * 0.5;
  const g = c.createRadialGradient(cx, cy, 0, cx, cy, rx);
  g.addColorStop(0, `rgba(30,46,20,${strength})`);
  g.addColorStop(0.62, `rgba(30,46,20,${strength * 0.82})`);
  g.addColorStop(1, 'rgba(30,46,20,0)');
  c.save();
  c.translate(cx, cy);
  c.scale(1, ry / rx);
  c.translate(-cx, -cy);
  c.fillStyle = g;
  c.beginPath();
  c.arc(cx, cy, rx, 0, Math.PI * 2);
  c.fill();
  c.restore();
}
