/**
 * The isometric projection.
 *
 * The simulation stays in plain cartesian world units — movement, distances,
 * collision and the spatial hash all work exactly as they would top-down. Only
 * *drawing* is isometric, and it happens through this one file. Keeping the
 * projection at the edge rather than in the physics is what stops "which space
 * is this number in" from becoming a question you have to ask on every line.
 *
 * The transform is a 2:1 dimetric — 30° off horizontal — which is what makes a
 * square world tile read as the familiar diamond.
 */

/** projection basis: screen = (wx − wy)·X , (wx + wy)·Y */
export const ISO_X = 0.7071;
export const ISO_Y = 0.4082;

export interface Vec { x: number; y: number; }

/** World position → screen position (before the camera offset). */
export function toScreen(wx: number, wy: number): Vec {
  return { x: (wx - wy) * ISO_X, y: (wx + wy) * ISO_Y };
}

export const screenX = (wx: number, wy: number): number => (wx - wy) * ISO_X;
export const screenY = (wx: number, wy: number): number => (wx + wy) * ISO_Y;

/** Screen position → world position. Exact inverse of `toScreen`. */
export function toWorld(sx: number, sy: number): Vec {
  return {
    x: sx / (2 * ISO_X) + sy / (2 * ISO_Y),
    y: -sx / (2 * ISO_X) + sy / (2 * ISO_Y),
  };
}

/**
 * A stick direction is given in screen space — up on the thumb has to be up on
 * the screen. This maps it into the world direction that produces that motion,
 * renormalised so diagonal input is not faster than cardinal.
 */
export function stickToWorld(sx: number, sy: number): Vec {
  if (sx === 0 && sy === 0) return { x: 0, y: 0 };
  const w = toWorld(sx, sy);
  const len = Math.hypot(w.x, w.y) || 1;
  return { x: w.x / len, y: w.y / len };
}

/**
 * Depth key. Anything further "back" in the world draws first; in this
 * projection that is simply the sum of the two world axes, which is the same
 * ordering as screen y.
 */
export const depth = (wx: number, wy: number): number => wx + wy;

/**
 * Screen-space size of one world tile's diamond. A tile `t` units square spans
 * `2·t·ISO_X` across and `2·t·ISO_Y` down.
 */
export const tileScreenWidth = (tile: number): number => 2 * tile * ISO_X;
export const tileScreenHeight = (tile: number): number => 2 * tile * ISO_Y;

/**
 * Bounding box, in screen space, of an axis-aligned square block of world
 * starting at (ox, oy) and `size` units on a side. The block projects to a
 * diamond, so its box is wider and shorter than the block itself.
 */
export function blockBounds(ox: number, oy: number, size: number): {
  x: number; y: number; w: number; h: number;
} {
  const corners = [
    toScreen(ox, oy),
    toScreen(ox + size, oy),
    toScreen(ox, oy + size),
    toScreen(ox + size, oy + size),
  ];
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
