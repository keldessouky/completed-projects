import { screenX, screenY } from './iso';
import { ATTACK_FRAME, WALK_FRAMES, type Facing } from './assets/figure';

/**
 * How a moving thing in the world picks which frame of art to draw.
 *
 * Two decisions live here, and both are the kind that look trivial and are not:
 *
 *  - **Which way it faces** is decided in SCREEN space, not world space. The
 *    player reads a sprite against the screen, so a character walking toward
 *    the bottom-right of the display has to look like it is walking toward the
 *    bottom-right of the display, whatever that direction is called in world
 *    coordinates.
 *  - **Which frame of the walk** is decided by DISTANCE TRAVELLED, not by wall
 *    time. A cycle driven by a clock keeps stepping while the character stands
 *    still and slides its feet when it slows down. Driven by distance, the feet
 *    stay planted at a stop and the cadence rises and falls with speed for
 *    free — which is most of what makes a walk look like walking.
 */

export interface Look {
  /** the painted facing to draw */
  facing: Facing;
  /** true when that facing must be mirrored to point the right way */
  flip: boolean;
}

const OCT: { facing: Facing; flip: boolean }[] = [
  { facing: 'e', flip: false },     //   0° — screen right
  { facing: 'se', flip: false },    //  45° — down-right
  { facing: 's', flip: false },     //  90° — toward the camera
  { facing: 'se', flip: true },     // 135° — down-left
  { facing: 'e', flip: true },      // 180° — screen left
  { facing: 'ne', flip: true },     // 225° — up-left
  { facing: 'n', flip: false },     // 270° — away from the camera
  { facing: 'ne', flip: false },    // 315° — up-right
];

/**
 * Facing from a world-space velocity. The vector is projected first, so the
 * octant it lands in is the octant the player sees.
 */
export function lookFrom(vx: number, vy: number, fallback: Look): Look {
  const sx = screenX(vx, vy);
  const sy = screenY(vx, vy);
  if (Math.abs(sx) + Math.abs(sy) < 0.001) return fallback;
  const a = Math.atan2(sy, sx);
  // +22.5° so each octant is centred on its cardinal rather than starting there
  const i = Math.floor(((a + Math.PI * 2 + Math.PI / 8) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
  return OCT[i];
}

export const LOOK_S: Look = { facing: 's', flip: false };

/** World units of travel per full four-frame walk cycle. */
export const STRIDE = 46;

/**
 * Advance a walk phase by a distance travelled and return the frame index.
 * `phase` is carried by the caller in cycles, so it survives across frames.
 */
export function walkFrame(phase: number): number {
  return Math.floor(phase * WALK_FRAMES) % WALK_FRAMES;
}

/**
 * The frame to draw: the attack pose while an attack is playing out, otherwise
 * the walk cycle, otherwise the settled stance.
 *
 * `attackT` counts DOWN, so a caller that never sets it never sees an attack —
 * which is what lets the same helper drive a levy that throws and a coin that
 * does not.
 */
export function frameFor(phase: number, moving: boolean, attackT: number): number {
  if (attackT > 0) return ATTACK_FRAME;
  // frame 1 is a passing position: a still character standing on one leg looks
  // caught mid-step, so a stopped one settles on a contact frame instead
  return moving ? walkFrame(phase) : 0;
}

/** True on the two frames where a foot plants — when to kick up dust. */
export const isFootfall = (prev: number, next: number): boolean =>
  next !== prev && (next === 0 || next === 2);

/** Compose the frame name the atlas knows this sprite by. */
export const frameName = (kind: string, look: Look, frame: number): string =>
  `${kind}_${look.facing}_${frame}`;
