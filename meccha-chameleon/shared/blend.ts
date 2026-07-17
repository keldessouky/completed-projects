// Camouflage scoring — the heart of the game. Shared so the server scores
// authoritatively and the client can show the same live blend % as feedback.

import { CELL, Color, GRID, Grid, Pose, POSE_MASKS } from './protocol';
import { shadedColorAt, Stage } from './stages';

const MAX_DIST = Math.sqrt(255 * 255 * 3);

export function colorDistance(a: Color, b: Color): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/** Index helpers for the GRID*GRID cell arrays. */
export function cellIndex(col: number, row: number): number {
  return row * GRID + col;
}

/** World-space center of cell (col,row) for a sprite whose top-left is (x,y). */
export function cellCenter(x: number, y: number, col: number, row: number): { cx: number; cy: number } {
  return { cx: x + col * CELL + CELL / 2, cy: y + row * CELL + CELL / 2 };
}

/**
 * Blend quality in 0..1 (1 = perfect camouflage) for a chameleon at (x,y) with
 * the given paint grid and pose, against the stage behind it. Only solid body
 * cells (per the pose mask) count.
 */
export function blendScore(stage: Stage, x: number, y: number, grid: Grid, pose: Pose): number {
  const mask = POSE_MASKS[pose];
  let total = 0;
  let count = 0;
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const i = cellIndex(col, row);
      if (!mask[i]) continue;
      const paint = grid[i] ?? [255, 255, 255];
      const { cx, cy } = cellCenter(x, y, col, row);
      const target = shadedColorAt(stage, cx, cy);
      total += colorDistance(paint, target);
      count++;
    }
  }
  if (count === 0) return 0;
  const avg = total / count;
  return Math.max(0, 1 - avg / MAX_DIST);
}
