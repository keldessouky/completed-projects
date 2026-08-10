import { CanvasSource, Rectangle, Texture } from 'pixi.js';
import { CONFIG } from '../config';
import {
  ATTACK_BAKED, BAKED_DIRS, CELL, LPC_WALK, SHEETS, attackFrameAt,
  drawCell, enemyLayers, hasSheet, loadLpc, unitLayers,
  type Anim, type DirName, type Layer,
} from './lpc';
import { eraWeapon } from './weapons';

/**
 * The character sheet: every animated unit and monster, on its own texture.
 *
 * This is a second page rather than part of the main atlas because the two hold
 * different kinds of art. The main atlas stores procedural pixel art
 * supersampled 2×, which is right for shapes generated at a chunky grid. LPC
 * frames are already finished art at their final resolution, and storing them
 * 2× would quadruple the memory to show exactly the same pixels. One extra draw
 * call is a much better trade.
 *
 * Layout is a plain grid — every cell is 64×64, so there is nothing to pack.
 */

const COLS = 32;
const PAGE_W = COLS * CELL;          // 2048
const MAX_ROWS = 64;                 // 4096 tall; the cap is what "atlas full" means

/** Walk frames baked per facing. */
export const WALK_N = LPC_WALK;
/** Attack frames baked per facing. */
export const ATK_N = ATTACK_BAKED;

export class CharAtlas {
  canvas: HTMLCanvasElement;
  frames: Record<string, Texture> = {};
  private ctx: CanvasRenderingContext2D;
  private source!: CanvasSource;
  private cell = 0;
  private pending: [string, number][] = [];

  private constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = PAGE_W;
    this.canvas.height = MAX_ROWS * CELL;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
  }

  /**
   * Load the vendored layers and bake every character. Resolves to null if the
   * art is not present, so a build without `public/lpc/` still boots — it just
   * falls back to the procedural sprites.
   */
  static async build(base: string): Promise<CharAtlas | null> {
    await loadLpc(base, SHEETS, ['walk', 'thrust', 'shoot']);
    if (!hasSheet('body_male', 'walk')) return null;
    const a = new CharAtlas();
    a.paint();
    a.finalize();
    return a;
  }

  get(name: string): Texture | undefined { return this.frames[name]; }
  has(name: string): boolean { return !!this.frames[name]; }

  /** Reserve the next grid cell and hand back where it landed. */
  private slot(name: string): { x: number; y: number } {
    if (this.cell >= COLS * MAX_ROWS) throw new Error('character sheet full at ' + name);
    const x = (this.cell % COLS) * CELL;
    const y = Math.floor(this.cell / COLS) * CELL;
    this.pending.push([name, this.cell]);
    this.cell++;
    return { x, y };
  }

  /**
   * Bake one animation of one character: every baked facing × frame.
   *
   * `era` is passed through so the weapon overlay knows which firearm to draw;
   * LPC has no guns at all, so eras 1–3 get theirs painted on top here, at the
   * hand position for that facing and frame.
   */
  private bakeAnim(prefix: string, layers: Layer[], anim: Anim, n: number, era: number, armed: boolean): void {
    for (const dir of BAKED_DIRS) {
      for (let i = 0; i < n; i++) {
        const src = anim === 'walk' ? i : attackFrameAt(anim, i);
        const { x, y } = this.slot(`${prefix}_${anim}_${dir}_${i}`);
        drawCell(this.ctx, layers, anim, dir, src, x, y);
        if (armed) eraWeapon(this.ctx, era, anim, dir, i, n, x, y);
      }
    }
  }

  private paint(): void {
    // ---- players: king plus three soldier tiers, in five eras
    for (let e = 0; e < 5; e++) {
      // eras 1-3 have no LPC weapon, so their soldiers aim rather than stab
      const atk: Anim = e === 0 || e === 4 ? 'thrust' : 'shoot';
      const drawn = e >= 1 && e <= 3;
      this.bakeAnim(`king${e}`, unitLayers(e, 2, true), 'walk', WALK_N, e, drawn);
      this.bakeAnim(`king${e}`, unitLayers(e, 2, true), atk, ATK_N, e, drawn);
      for (let t = 0; t < 3; t++) {
        const l = unitLayers(e, t, false);
        this.bakeAnim(`sol${e}_${t}`, l, 'walk', WALK_N, e, drawn);
        this.bakeAnim(`sol${e}_${t}`, l, atk, ATK_N, e, drawn);
      }
    }
    // ---- the horde. One set, tinted per era at draw time like before.
    for (const kind of ['runner', 'brute', 'shooter', 'boss'] as const) {
      const l = enemyLayers(kind);
      this.bakeAnim(`e_${kind}`, l, 'walk', WALK_N, 0, false);
      this.bakeAnim(`e_${kind}`, l, 'thrust', ATK_N, 0, false);
    }
  }

  private finalize(): void {
    // trim the page to the rows actually used, so the texture upload is not
    // mostly empty pixels
    const rows = Math.ceil(this.cell / COLS);
    const used = document.createElement('canvas');
    used.width = PAGE_W;
    used.height = Math.max(CELL, rows * CELL);
    const c = used.getContext('2d')!;
    c.imageSmoothingEnabled = false;
    c.drawImage(this.canvas, 0, 0);
    this.canvas = used;

    this.source = new CanvasSource({ resource: this.canvas, resolution: 1, scaleMode: 'nearest' });
    for (const [name, cell] of this.pending) {
      const x = (cell % COLS) * CELL;
      const y = Math.floor(cell / COLS) * CELL;
      this.frames[name] = new Texture({ source: this.source, frame: new Rectangle(x, y, CELL, CELL) });
    }
  }

  /** Frames baked, and how much of the page they used — for the dev overlay. */
  get usage(): { frames: number; rows: number } {
    return { frames: this.cell, rows: Math.ceil(this.cell / COLS) };
  }
}

/**
 * Which baked facing to draw for a movement vector, and whether to mirror it.
 *
 * `left` is not baked: it is `right` flipped. The diagonal thresholds favour
 * the side view, because a character seen from the side reads far better than
 * one seen from behind and most movement in this game is lateral.
 */
export function facingFor(dx: number, dy: number): { dir: DirName; flip: boolean } {
  if (Math.abs(dx) >= Math.abs(dy) * 0.7) {
    return dx >= 0 ? { dir: 'right', flip: false } : { dir: 'right', flip: true };
  }
  return dy < 0 ? { dir: 'up', flip: false } : { dir: 'down', flip: false };
}

/** World units a 64px LPC cell covers. */
export const CHAR_SCALE = CONFIG.view.charScale;
