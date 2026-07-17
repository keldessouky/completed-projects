// Stage definitions shared by server (scoring) and client (rendering), so the
// camouflage maths and the visuals are guaranteed to agree.

import { Color, STAGE_H, STAGE_W } from './protocol';

export interface Surface {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: Color;
  /** 0 = well hidden (corner/behind prop), 1 = fully in the open. Drives risk bonus. */
  exposure: number;
}

export interface Stage {
  id: string;
  background: Color;
  /** Painted in order; later surfaces sit on top. */
  surfaces: Surface[];
}

export const STAGES: Record<string, Stage> = {
  workshop: {
    id: 'workshop',
    background: [54, 57, 64],
    surfaces: [
      // floor
      { name: 'floor', x: 0, y: 380, w: STAGE_W, h: STAGE_H - 380, color: [120, 96, 72], exposure: 0.9 },
      // back wall panels
      { name: 'wall-a', x: 0, y: 0, w: STAGE_W, h: 200, color: [70, 78, 92], exposure: 0.7 },
      { name: 'wall-b', x: 0, y: 200, w: STAGE_W, h: 180, color: [86, 94, 104], exposure: 0.7 },
      // crates (good hiding props)
      { name: 'crate-1', x: 120, y: 250, w: 150, h: 150, color: [150, 110, 60], exposure: 0.35 },
      { name: 'crate-2', x: 300, y: 300, w: 110, h: 110, color: [134, 98, 52], exposure: 0.3 },
      // green barrels
      { name: 'barrel', x: 690, y: 270, w: 120, h: 130, color: [70, 120, 80], exposure: 0.4 },
      // bright rug — high exposure, high reward
      { name: 'rug', x: 470, y: 430, w: 220, h: 120, color: [180, 70, 70], exposure: 1.0 },
      // shadowy corner
      { name: 'corner', x: 840, y: 430, w: 120, h: 120, color: [44, 46, 52], exposure: 0.15 },
    ],
  },
};

export const DEFAULT_STAGE_ID = 'workshop';

/** Topmost surface color at a world point (falls back to background). */
export function surfaceAt(stage: Stage, x: number, y: number): Surface | null {
  for (let i = stage.surfaces.length - 1; i >= 0; i--) {
    const s = stage.surfaces[i];
    if (x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h) return s;
  }
  return null;
}

const GRADIENT = 46; // top-to-bottom brightness swing within a surface

function clampChannel(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

/**
 * Surface color at a point, with a vertical light→shadow gradient applied
 * (lighter near the top, darker near the bottom). This is what the eye sees and
 * what the eyedropper samples, so matching it well rewards painting real
 * shadows rather than a single flat color. Shared by scoring and rendering.
 */
export function shadedColorAt(stage: Stage, x: number, y: number): Color {
  const s = surfaceAt(stage, x, y);
  if (!s) return stage.background;
  const t = (y - s.y) / s.h; // 0 at top, 1 at bottom
  const delta = (0.5 - t) * GRADIENT;
  return [clampChannel(s.color[0] + delta), clampChannel(s.color[1] + delta), clampChannel(s.color[2] + delta)];
}

export function colorAt(stage: Stage, x: number, y: number): Color {
  return surfaceAt(stage, x, y)?.color ?? stage.background;
}

export function exposureAt(stage: Stage, x: number, y: number): number {
  return surfaceAt(stage, x, y)?.exposure ?? 0.8;
}

/**
 * Deterministic subtle per-pixel noise so surfaces are never perfectly flat —
 * this is what makes a flat-painted chameleon read as a "clean anomaly". Both
 * sides use the same function so scoring and rendering agree.
 */
export function noiseAt(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return (n - Math.floor(n) - 0.5) * 22; // ~ +/- 11 brightness
}
