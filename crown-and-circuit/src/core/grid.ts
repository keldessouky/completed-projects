import { CONFIG } from '../config';

/**
 * Uniform spatial hash for broadphase queries.
 *
 * With ~240 enemies, ~48 soldiers, ~500 projectiles and ~400 coins live at
 * once, brute-force pair testing is ~10^5 checks per step and would dominate
 * the frame. Bucketing into cells the size of the largest query radius turns
 * every "what is near me" into a scan of 9 small cells.
 *
 * Rebuilt from scratch each step: clearing and refilling flat arrays is
 * cheaper (and allocation-free after warm-up) than incremental maintenance.
 */
export class SpatialGrid {
  private cells: number[][] = [];
  private cols: number;
  private rows: number;
  private cell: number;

  constructor(worldSize: number, cell = CONFIG.grid.cell) {
    this.cell = cell;
    this.cols = Math.ceil(worldSize / cell) + 1;
    this.rows = this.cols;
    for (let i = 0; i < this.cols * this.rows; i++) this.cells.push([]);
  }

  clear(): void {
    for (let i = 0; i < this.cells.length; i++) this.cells[i].length = 0;
  }

  private index(x: number, y: number): number {
    const cx = Math.max(0, Math.min(this.cols - 1, (x / this.cell) | 0));
    const cy = Math.max(0, Math.min(this.rows - 1, (y / this.cell) | 0));
    return cy * this.cols + cx;
  }

  /** Store an entity id at a world position. */
  insert(id: number, x: number, y: number): void {
    this.cells[this.index(x, y)].push(id);
  }

  /**
   * Collect ids within `radius` of (x, y) into `out`, returning the count.
   * `out` is caller-owned and reused, so this never allocates.
   */
  query(x: number, y: number, radius: number, out: number[]): number {
    const r = Math.max(1, Math.ceil(radius / this.cell));
    const cx = Math.max(0, Math.min(this.cols - 1, (x / this.cell) | 0));
    const cy = Math.max(0, Math.min(this.rows - 1, (y / this.cell) | 0));
    let n = 0;
    for (let gy = cy - r; gy <= cy + r; gy++) {
      if (gy < 0 || gy >= this.rows) continue;
      const row = gy * this.cols;
      for (let gx = cx - r; gx <= cx + r; gx++) {
        if (gx < 0 || gx >= this.cols) continue;
        const bucket = this.cells[row + gx];
        for (let i = 0; i < bucket.length; i++) {
          if (n < out.length) out[n++] = bucket[i];
        }
      }
    }
    return n;
  }
}
