import { CanvasSource, Rectangle, Texture } from 'pixi.js';
import { P } from './palette';

/**
 * The whole sprite sheet, painted procedurally at boot onto ONE canvas
 * (max 2048×2048) and carved into named Texture frames. Canvas-backed
 * sources survive WebGL context restore (Pixi re-uploads them), and the
 * art recolors from the single palette in palette.ts.
 *
 * Everything draws at 2× design resolution; TextureSource.resolution = 2
 * maps it back so a frame's design size is what gameplay code sees.
 */
const S = 2;               // atlas oversampling vs design px
const PAD = 4;             // atlas px between frames (bleed guard)
const SIZE = 2048;

type DrawFn = (c: CanvasRenderingContext2D, w: number, h: number) => void;

export class GameAtlas {
  canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private source!: CanvasSource;
  frames: Record<string, Texture> = {};
  /** fixed advance of the tabular digit glyphs, design px */
  readonly digitAdvance = 26;
  readonly digitCell = { w: 34, h: 46 };

  private shelfX = PAD;
  private shelfY = PAD;
  private shelfH = 0;

  private constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
    this.ctx = this.canvas.getContext('2d')!;
  }

  /** Build after fonts are ready — the digit glyphs bake the loaded webfont. */
  static build(): GameAtlas {
    const a = new GameAtlas();
    a.paintAll();
    return a;
  }

  get(name: string): Texture {
    const t = this.frames[name];
    if (!t) throw new Error(`atlas frame missing: ${name}`);
    return t;
  }

  /** shelf-pack a wDesign×hDesign frame and draw it in design units */
  private place(name: string, wDesign: number, hDesign: number, draw: DrawFn): void {
    // Keep every packed rect a whole multiple of S so the ÷S back to logical
    // frame space in finalize() lands on exact pixel boundaries.
    const w = Math.ceil(wDesign) * S;
    const h = Math.ceil(hDesign) * S;
    if (this.shelfX + w + PAD > SIZE) {
      this.shelfX = PAD;
      this.shelfY += this.shelfH + PAD;
      this.shelfH = 0;
    }
    if (this.shelfY + h + PAD > SIZE) throw new Error('atlas overflow: ' + name);
    const x = this.shelfX, y = this.shelfY;
    this.shelfX += w + PAD;
    this.shelfH = Math.max(this.shelfH, h);

    const c = this.ctx;
    c.save();
    c.beginPath();
    c.rect(x, y, w, h);
    c.clip();
    c.setTransform(S, 0, 0, S, x, y);
    draw(c, wDesign, hDesign);
    c.restore();
    c.setTransform(1, 0, 0, 1, 0, 0);

    // frame textures are created lazily after source exists — stash rects now
    this.pending.push([name, new Rectangle(x, y, w, h)]);
  }
  private pending: [string, Rectangle][] = [];

  private finalize(): void {
    // CanvasSource (not base TextureSource): it carries the canvas upload path
    // and survives WebGL context restoration by re-uploading the canvas.
    this.source = new CanvasSource({ resource: this.canvas, resolution: S, scaleMode: 'linear' });
    // Frames are packed in canvas pixels, but Pixi builds UVs as
    // frame.x / source.width — and source.width is the resolution-divided
    // logical width (canvas px ÷ S). So divide: frames live in design units,
    // which also makes every texture's natural size its design size.
    for (const [name, rect] of this.pending) {
      const frame = new Rectangle(rect.x / S, rect.y / S, rect.width / S, rect.height / S);
      this.frames[name] = new Texture({ source: this.source, frame });
    }
  }

  // ================= painting =================

  private paintAll(): void {
    const c = this.ctx;
    c.clearRect(0, 0, SIZE, SIZE);
    c.lineJoin = 'round';
    c.lineCap = 'round';

    this.paintCast();
    this.paintEnemies();
    this.paintWorldBits();
    this.paintDigits();
    this.paintParticles();
    this.paintUI();
    this.finalize();
  }

  // ---------- small helpers (design units) ----------
  private rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string): void {
    c.beginPath();
    c.roundRect(x, y, w, h, r);
    c.fillStyle = fill;
    c.fill();
  }
  private poly(c: CanvasRenderingContext2D, pts: number[], fill: string): void {
    c.beginPath();
    c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.closePath();
    c.fillStyle = fill;
    c.fill();
  }
  private dot(c: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string): void {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = fill;
    c.fill();
  }
  /**
   * The same drawing, washed toward white — the hit-flash frame.
   *
   * Not a flat silhouette: at these sprite sizes a solid white blob loses the
   * shape entirely, and with a fast auto-attack it is on screen often enough
   * that "what am I even shooting" becomes a real question. Keeping a quarter
   * of the original through preserves the read.
   */
  private whiteVariant(name: string, w: number, h: number, draw: DrawFn): void {
    this.place(name, w, h, (c, ww, hh) => {
      draw(c, ww, hh);
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = 'rgba(255,255,255,0.76)';
      c.fillRect(-2, -2, ww + 4, hh + 4);
      c.globalCompositeOperation = 'source-over';
    });
  }

  // ---------- characters (three facings; east is mirrored for west) ----------
  private paintCast(): void {
    // A contact shadow under every character: at this camera angle it is the
    // only thing that says "standing on ground" rather than "floating".
    const shadow = (c: CanvasRenderingContext2D, cx: number, cy: number, rx: number): void => {
      c.fillStyle = P.shadow;
      c.beginPath(); c.ellipse(cx, cy, rx, rx * 0.42, 0, 0, Math.PI * 2); c.fill();
    };

    /**
     * Carl. Seen from above and slightly behind — head and shoulders carry the
     * read at this size, so they get most of the frame and the legs are a hint.
     */
    const carl = (facing: 's' | 'n' | 'e'): DrawFn => (c, w, h) => {
      const cx = w / 2, foot = h - 5;
      shadow(c, cx, foot, 12);

      // legs and very bare feet
      this.rr(c, cx - 8, foot - 15, 7, 13, 3, P.skinShade);
      this.rr(c, cx + 1, foot - 15, 7, 13, 3, P.skin);

      // boxer shorts, checked, because that is the whole joke
      this.rr(c, cx - 10, foot - 24, 20, 12, 3, P.cloth);
      c.fillStyle = P.clothLit;
      c.fillRect(cx - 10, foot - 21, 20, 2);
      c.fillRect(cx - 4, foot - 24, 3, 12);
      c.fillRect(cx + 4, foot - 24, 3, 12);

      // bare torso
      this.rr(c, cx - 10, foot - 36, 20, 14, 5, P.skin);
      c.fillStyle = P.skinShade;
      if (facing === 'n') c.fillRect(cx - 1, foot - 35, 2, 12);   // spine
      else if (facing === 'e') c.fillRect(cx + 5, foot - 36, 5, 14);

      // arms holding the nail gun forward
      if (facing === 'e') {
        this.rr(c, cx + 4, foot - 33, 12, 6, 3, P.skin);
        this.rr(c, cx + 14, foot - 36, 11, 9, 2, P.steelDark);
        this.rr(c, cx + 22, foot - 34, 5, 5, 1.5, P.steel);
        c.fillStyle = P.amberBright; c.fillRect(cx + 26, foot - 33, 3, 3);
      } else if (facing === 's') {
        this.rr(c, cx - 15, foot - 32, 7, 8, 3, P.skin);
        this.rr(c, cx + 8, foot - 32, 7, 8, 3, P.skin);
        this.rr(c, cx - 7, foot - 28, 14, 10, 2, P.steelDark);
        this.rr(c, cx - 4, foot - 20, 8, 5, 1.5, P.steel);
        c.fillStyle = P.amberBright; c.fillRect(cx - 2, foot - 16, 4, 3);
      } else {
        this.rr(c, cx - 15, foot - 32, 7, 8, 3, P.skinShade);
        this.rr(c, cx + 8, foot - 32, 7, 8, 3, P.skinShade);
      }

      // head: hair cap from above, face only when looking at the camera
      const hy = foot - 43;
      this.dot(c, cx, hy, 9, P.hair);
      if (facing === 's') {
        this.dot(c, cx, hy + 2.5, 7, P.skin);
        c.fillStyle = P.hair;
        c.beginPath(); c.arc(cx, hy, 8.6, Math.PI, 0); c.fill();
        c.fillRect(cx - 8.6, hy - 1, 17.2, 2.6);
        c.fillStyle = P.ink;
        c.fillRect(cx - 4, hy + 1.6, 2.4, 2.4);
        c.fillRect(cx + 1.6, hy + 1.6, 2.4, 2.4);
      } else if (facing === 'e') {
        this.dot(c, cx + 3, hy + 2, 6.4, P.skin);
        c.fillStyle = P.hair;
        c.beginPath(); c.arc(cx, hy, 8.6, Math.PI * 0.7, Math.PI * 1.9); c.fill();
        c.fillStyle = P.ink; c.fillRect(cx + 5, hy + 1, 2.4, 2.4);
      }
    };
    for (const f of ['s', 'n', 'e'] as const) this.place('carl_' + f, 44, 56, carl(f));
    this.place('carl_dead', 52, 40, (c, w, h) => {
      const cx = w / 2, cy = h / 2;
      shadow(c, cx, cy + 10, 18);
      c.save(); c.translate(cx, cy); c.rotate(Math.PI / 2);
      this.rr(c, -10, -14, 20, 14, 5, P.skin);
      this.rr(c, -10, 0, 20, 12, 3, P.cloth);
      this.dot(c, 0, -21, 9, P.hair);
      c.restore();
    });

    /** Princess Donut. Small, fluffy, deeply unimpressed. */
    const donut = (facing: 's' | 'n' | 'e'): DrawFn => (c, w, h) => {
      const cx = w / 2, foot = h - 4;
      shadow(c, cx, foot, 9);
      // body
      c.fillStyle = P.furShade;
      c.beginPath(); c.ellipse(cx, foot - 8, 10, 7, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = P.fur;
      c.beginPath(); c.ellipse(cx, foot - 10, 9, 6, 0, 0, Math.PI * 2); c.fill();
      // tail, up and outraged
      c.strokeStyle = P.fur; c.lineWidth = 3.2; c.lineCap = 'round';
      c.beginPath();
      const tx = facing === 'e' ? cx - 9 : cx + 8;
      c.moveTo(tx, foot - 9);
      c.quadraticCurveTo(tx + (facing === 'e' ? -7 : 7), foot - 16, tx + (facing === 'e' ? -3 : 3), foot - 24);
      c.stroke();
      // head
      const hx = facing === 'e' ? cx + 5 : cx;
      const hy = foot - (facing === 'n' ? 17 : 19);
      this.dot(c, hx, hy, 7, P.fur);
      this.poly(c, [hx - 6, hy - 4, hx - 4.6, hy - 10, hx - 2, hy - 4.6], P.fur);
      this.poly(c, [hx + 2, hy - 4.6, hx + 4.6, hy - 10, hx + 6, hy - 4], P.fur);
      // the tiara. she earned it. she will tell you about it.
      c.fillStyle = P.amberBright;
      c.fillRect(hx - 5.4, hy - 6.6, 10.8, 2);
      this.poly(c, [hx - 1.6, hy - 6.8, hx, hy - 11, hx + 1.6, hy - 6.8], P.amberBright);
      if (facing !== 'n') {
        c.fillStyle = P.ink;
        c.fillRect(hx - 3.4, hy - 1.4, 2, 2.4);
        c.fillRect(hx + 1.4, hy - 1.4, 2, 2.4);
        c.fillStyle = P.hpRed;
        c.fillRect(hx - 1, hy + 2.4, 2, 1.4);
      }
    };
    for (const f of ['s', 'n', 'e'] as const) this.place('donut_' + f, 32, 34, donut(f));

    /** Townsfolk. Role reads from the colour of the coat, not a label. */
    const npc = (coat: string, accent: string): DrawFn => (c, w, h) => {
      const cx = w / 2, foot = h - 5;
      shadow(c, cx, foot, 11);
      this.rr(c, cx - 8, foot - 14, 6, 12, 2.5, P.inkLift);
      this.rr(c, cx + 2, foot - 14, 6, 12, 2.5, P.inkLift);
      this.rr(c, cx - 11, foot - 34, 22, 22, 5, coat);
      c.fillStyle = accent;
      c.fillRect(cx - 11, foot - 27, 22, 3.4);
      c.fillRect(cx - 2, foot - 34, 4, 22);
      this.rr(c, cx - 15, foot - 31, 6, 12, 3, coat);
      this.rr(c, cx + 9, foot - 31, 6, 12, 3, coat);
      this.dot(c, cx, foot - 41, 8.4, P.skin);
      c.fillStyle = P.hair;
      c.beginPath(); c.arc(cx, foot - 42, 8.4, Math.PI, 0); c.fill();
      c.fillStyle = P.ink;
      c.fillRect(cx - 3.6, foot - 41, 2.2, 2.2);
      c.fillRect(cx + 1.4, foot - 41, 2.2, 2.2);
    };
    this.place('npc_vendor', 40, 52, npc(P.rustDeep, P.amber));
    this.place('npc_quests', 40, 52, npc(P.sysDeep, P.sysBright));
    this.place('npc_guide', 40, 52, npc('#3d3548', P.goodTeal));
  }

  // ---------- mobs ----------
  private paintEnemies(): void {
    const shadow = (c: CanvasRenderingContext2D, cx: number, cy: number, rx: number): void => {
      c.fillStyle = P.shadow;
      c.beginPath(); c.ellipse(cx, cy, rx, rx * 0.42, 0, 0, Math.PI * 2); c.fill();
    };

    /** Sewer rat: low, fast, and much too large. */
    const rat = (facing: 's' | 'n' | 'e'): DrawFn => (c, w, h) => {
      const cx = w / 2, foot = h - 4;
      shadow(c, cx, foot, 12);
      // tail
      c.strokeStyle = P.rustDeep; c.lineWidth = 2.6; c.lineCap = 'round';
      c.beginPath();
      const tx = facing === 'e' ? cx - 10 : cx;
      c.moveTo(tx, foot - 7);
      c.quadraticCurveTo(tx - 12, foot - 3, tx - 8, foot + 2);
      c.stroke();
      // body
      c.fillStyle = P.rustDeep;
      c.beginPath(); c.ellipse(cx, foot - 8, 13, 8, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = P.rust;
      c.beginPath(); c.ellipse(cx, foot - 10, 11, 6.4, 0, 0, Math.PI * 2); c.fill();
      // head + ears
      const hx = facing === 'e' ? cx + 10 : cx;
      const hy = foot - (facing === 'n' ? 13 : 15);
      this.dot(c, hx, hy, 7, P.rust);
      this.dot(c, hx - 5.4, hy - 4.6, 3.4, P.rustDeep);
      this.dot(c, hx + 5.4, hy - 4.6, 3.4, P.rustDeep);
      if (facing !== 'n') {
        this.poly(c, [hx - 2.6, hy + 2, hx + 2.6, hy + 2, hx, hy + 8], P.skinShade);
        c.fillStyle = P.hpRed;
        c.fillRect(hx - 4, hy - 1, 2.4, 2.2);
        c.fillRect(hx + 1.6, hy - 1, 2.4, 2.2);
      }
    };

    /** Rubble brute: a slab of collapsed building that stood back up. */
    const brute = (facing: 's' | 'n' | 'e'): DrawFn => (c, w, h) => {
      const cx = w / 2, foot = h - 5;
      shadow(c, cx, foot, 19);
      this.rr(c, cx - 15, foot - 16, 11, 15, 2, P.stoneDim);
      this.rr(c, cx + 4, foot - 16, 11, 15, 2, P.stoneDim);
      this.rr(c, cx - 19, foot - 44, 38, 30, 3, P.stone);
      c.fillStyle = P.stoneDim;
      c.fillRect(cx - 19, foot - 32, 38, 3);
      // rebar bristling out of the shoulders
      c.strokeStyle = P.rust; c.lineWidth = 2.4;
      c.beginPath();
      c.moveTo(cx - 15, foot - 42); c.lineTo(cx - 23, foot - 54);
      c.moveTo(cx + 13, foot - 43); c.lineTo(cx + 22, foot - 53);
      c.stroke();
      // head block
      this.rr(c, cx - 10, foot - 58, 20, 16, 2, P.stoneDim);
      if (facing !== 'n') {
        c.fillStyle = P.amberBright;
        c.fillRect(cx - 6, foot - 52, 4.6, 3.4);
        c.fillRect(cx + 1.4, foot - 52, 4.6, 3.4);
      }
      // fracture lines
      c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(cx - 8, foot - 40); c.lineTo(cx - 2, foot - 32); c.lineTo(cx - 6, foot - 22);
      c.stroke();
      if (facing === 'e') { c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(cx + 8, foot - 44, 11, 30); }
    };

    /** Maintenance drone: a municipal fan that was given opinions. */
    const drone = (facing: 's' | 'n' | 'e'): DrawFn => (c, w, h) => {
      const cx = w / 2, base = h - 6;
      shadow(c, cx, base + 2, 13);
      // it hovers: the body sits well above its shadow
      const by = base - 22;
      for (const sx of [-1, 1]) {
        const ax = cx + sx * 17;
        this.rr(c, cx + (sx < 0 ? -18 : 4), by - 2, 14, 5, 2, P.steelDark);
        c.fillStyle = 'rgba(141,146,153,0.5)';
        c.beginPath(); c.ellipse(ax, by - 4, 11, 4, 0, 0, Math.PI * 2); c.fill();
        this.dot(c, ax, by - 4, 2.6, P.steel);
      }
      this.rr(c, cx - 10, by - 10, 20, 20, 5, P.steel);
      this.rr(c, cx - 8, by - 8, 16, 8, 2, P.steelDark);
      if (facing !== 'n') {
        this.dot(c, cx, by + 4, 5, P.steelDark);
        this.dot(c, cx, by + 4, 3.2, P.sys);
        this.dot(c, cx - 1, by + 3, 1.3, P.sysBright);
      }
      c.fillStyle = P.hpRed; c.fillRect(cx + 5, by - 7, 2.8, 2.8);
      this.poly(c, [cx - 4, by + 10, cx + 4, by + 10, cx, by + 17], P.steelDark);
    };

    /** Foreman: an elite in a hard hat who thinks this is a job. */
    const elite = (facing: 's' | 'n' | 'e'): DrawFn => (c, w, h) => {
      const cx = w / 2, foot = h - 5;
      shadow(c, cx, foot, 15);
      this.rr(c, cx - 9, foot - 16, 7, 14, 3, P.inkLift);
      this.rr(c, cx + 2, foot - 16, 7, 14, 3, P.inkLift);
      this.rr(c, cx - 13, foot - 40, 26, 26, 5, P.hiVisDark);
      c.fillStyle = P.hiVis;
      c.fillRect(cx - 13, foot - 33, 26, 5);
      c.fillRect(cx - 13, foot - 24, 26, 4);
      this.rr(c, cx - 18, foot - 37, 7, 15, 3, P.hiVisDark);
      this.rr(c, cx + 11, foot - 37, 7, 15, 3, P.hiVisDark);
      // the clipboard, held like a weapon
      if (facing !== 'n') {
        this.rr(c, cx + 13, foot - 30, 10, 13, 2, P.dirtDim);
        c.fillStyle = P.bone; c.fillRect(cx + 15, foot - 28, 6, 9);
      }
      this.dot(c, cx, foot - 47, 9, P.skin);
      // hard hat
      c.fillStyle = P.amberBright;
      c.beginPath(); c.arc(cx, foot - 48, 9.6, Math.PI, 0); c.fill();
      c.fillRect(cx - 11, foot - 49, 22, 3.4);
      if (facing !== 'n') {
        c.fillStyle = P.ink;
        c.fillRect(cx - 4, foot - 46, 2.4, 2.4);
        c.fillRect(cx + 1.6, foot - 46, 2.4, 2.4);
      }
    };

    /** The Chief Inspector: middle management with a firing solution. */
    const boss = (facing: 's' | 'n' | 'e'): DrawFn => (c, w, h) => {
      const cx = w / 2, foot = h - 6;
      shadow(c, cx, foot, 30);
      // heavy boots
      this.rr(c, cx - 18, foot - 22, 15, 20, 3, P.ink);
      this.rr(c, cx + 3, foot - 22, 15, 20, 3, P.ink);
      // longcoat
      this.rr(c, cx - 26, foot - 62, 52, 44, 7, P.hiVisDark);
      c.fillStyle = P.hiVis;
      c.fillRect(cx - 26, foot - 50, 52, 7);
      c.fillRect(cx - 26, foot - 34, 52, 6);
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.fillRect(cx - 2, foot - 62, 4, 44);
      // shoulder plates and the arm cannon
      this.rr(c, cx - 34, foot - 60, 12, 20, 4, P.steel);
      this.rr(c, cx + 22, foot - 60, 12, 20, 4, P.steel);
      if (facing !== 'n') {
        this.rr(c, cx + 24, foot - 44, 20, 13, 3, P.steelDark);
        this.rr(c, cx + 40, foot - 41, 8, 7, 2, P.steel);
        c.fillStyle = P.amberBright; c.fillRect(cx + 46, foot - 40, 4, 5);
      }
      // head, hard hat, and the shoulder lamp that finds you in the dark
      this.dot(c, cx, foot - 72, 12, P.skin);
      c.fillStyle = P.bone;
      c.beginPath(); c.arc(cx, foot - 74, 13, Math.PI, 0); c.fill();
      c.fillRect(cx - 15, foot - 75, 30, 4.4);
      if (facing !== 'n') {
        c.fillStyle = P.ink;
        c.fillRect(cx - 6, foot - 71, 3.4, 3.4);
        c.fillRect(cx + 2.6, foot - 71, 3.4, 3.4);
        c.fillStyle = P.steelDark;
        c.fillRect(cx - 8, foot - 64, 16, 3.4);
      }
      const lamp = c.createRadialGradient(cx - 30, foot - 62, 2, cx - 30, foot - 62, 16);
      lamp.addColorStop(0, 'rgba(240,194,104,0.9)');
      lamp.addColorStop(1, 'rgba(240,194,104,0)');
      c.fillStyle = lamp;
      c.beginPath(); c.arc(cx - 30, foot - 62, 16, 0, Math.PI * 2); c.fill();
    };

    const mobs = [
      ['rat', rat, 42, 34], ['brute', brute, 48, 66], ['drone', drone, 46, 50],
      ['elite', elite, 46, 58], ['boss', boss, 108, 92],
    ] as const;
    for (const [name, fn, fw, fh] of mobs) {
      for (const f of ['s', 'n', 'e'] as const) {
        this.place(`${name}_${f}`, fw, fh, (fn as (f: 's' | 'n' | 'e') => DrawFn)(f));
      }
      // One flash frame per kind rather than per facing: it is on screen for
      // 80 ms, and nobody has ever noticed a sprite turn to face them in that.
      this.whiteVariant(`${name}_flash`, fw, fh, (fn as (f: 's' | 'n' | 'e') => DrawFn)('s'));
    }
  }

  // ---------- projectiles, drops, markers ----------
  private paintWorldBits(): void {
    // A nail. Fired from a nail gun. This is the whole armoury.
    this.place('nail', 10, 24, (c, w) => {
      const cx = w / 2;
      c.strokeStyle = P.steel; c.lineWidth = 2.4;
      c.beginPath(); c.moveTo(cx, 4); c.lineTo(cx, 20); c.stroke();
      this.poly(c, [cx - 2.6, 6, cx + 2.6, 6, cx, 0], P.bone);
      c.fillStyle = P.steelDark; c.fillRect(cx - 3.4, 19, 6.8, 2.6);
    });
    // What shoots back.
    this.place('bolt', 12, 20, (c, w, h) => {
      const cx = w / 2;
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(224,101,75,1)');
      g.addColorStop(1, 'rgba(181,64,46,0)');
      c.fillStyle = g;
      c.beginPath(); c.ellipse(cx, h / 2, 4, h / 2, 0, 0, Math.PI * 2); c.fill();
      this.dot(c, cx, h / 2 - 3, 3, '#ffd9c8');
    });

    this.place('coinDrop', 22, 22, (c, w, h) => {
      this.dot(c, w / 2, h / 2 + 3, 9, P.shadow);
      this.dot(c, w / 2, h / 2, 9, P.rustDeep);
      this.dot(c, w / 2, h / 2, 7.4, P.amber);
      this.dot(c, w / 2 - 2, h / 2 - 2.2, 3, P.amberBright);
    });
    // Gear on the ground: a satchel silhouette, tinted by tier at spawn time.
    this.place('gearDrop', 26, 26, (c, w, h) => {
      this.dot(c, w / 2, h - 4, 8, P.shadow);
      this.rr(c, 4, 8, w - 8, h - 12, 3, '#ffffff');
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.fillRect(4, 13, w - 8, 3);
      c.fillRect(w / 2 - 2, 8, 4, h - 12);
      this.rr(c, w / 2 - 6, 3, 12, 7, 2, '#ffffff');
    });

    // Minimap and world markers. Flat shapes: they are drawn at 12 px.
    const mark = (name: string, draw: DrawFn) => this.place(name, 22, 22, draw);
    mark('markTown', (c, w, h) => {
      this.poly(c, [w / 2, 2, w - 3, 9, w - 6, h - 3, 6, h - 3, 3, 9], '#ffffff');
    });
    mark('markCamp', (c, w, h) => {
      this.poly(c, [w / 2, 3, w - 3, h - 4, 3, h - 4], '#ffffff');
    });
    mark('markRuin', (c, w, h) => {
      c.fillStyle = '#ffffff';
      c.fillRect(3, 6, 5, h - 9);
      c.fillRect(w - 8, 3, 5, h - 6);
      c.fillRect(3, h - 6, w - 6, 3);
    });
    mark('markShrine', (c, w, h) => {
      this.dot(c, w / 2, h / 2, 7, '#ffffff');
      c.globalCompositeOperation = 'destination-out';
      this.dot(c, w / 2, h / 2, 3.2, '#000');
      c.globalCompositeOperation = 'source-over';
    });
    mark('markLair', (c, w, h) => {
      c.fillStyle = '#ffffff';
      for (let i = 0; i < 8; i++) {
        c.save(); c.translate(w / 2, h / 2); c.rotate((i * Math.PI) / 4);
        c.fillRect(-1.8, -10, 3.6, 5); c.restore();
      }
      this.dot(c, w / 2, h / 2, 5, '#ffffff');
    });
    mark('markPlayer', (c, w, h) => {
      this.poly(c, [w / 2, 2, w - 4, h - 3, w / 2, h - 7, 4, h - 3], '#ffffff');
    });

    // An interact pip that floats over whatever you are standing next to.
    this.place('pip', 20, 24, (c, w) => {
      const cx = w / 2;
      this.poly(c, [cx - 7, 12, cx + 7, 12, cx, 22], '#ffffff');
      this.rr(c, cx - 8, 0, 16, 13, 3, '#ffffff');
      c.globalCompositeOperation = 'destination-out';
      this.rr(c, cx - 5.5, 2.5, 11, 8, 2, '#000');
      c.globalCompositeOperation = 'source-over';
    });
  }

  // ---------- digits (tabular by construction: fixed advance) ----------
  private paintDigits(): void {
    const { w, h } = { w: this.digitCell.w, h: this.digitCell.h };
    const glyphs = '0123456789×÷+−%:';
    for (const ch of glyphs) {
      this.place('d_' + ch, w, h, (c) => {
        c.font = `800 ${ch === '%' ? 30 : 38}px Inter, system-ui, sans-serif`;
        // the colon sits high on its own; nudge it onto the numerals' optical centre
        const dy = ch === ':' ? 0 : 2;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.lineJoin = 'round';
        c.strokeStyle = 'rgba(0,0,0,0.9)';
        c.lineWidth = 7;
        c.strokeText(ch, w / 2, h / 2 + dy);
        c.fillStyle = '#ffffff';
        c.fillText(ch, w / 2, h / 2 + dy);
      });
    }
  }

  // ---------- particles ----------
  private paintParticles(): void {
    this.place('softDot', 14, 14, (c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, 0.5, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.55, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    });
    this.place('shard', 12, 12, (c) => this.poly(c, [1, 2, 11, 5, 4, 11], '#ffffff'));
    this.place('brickChunk', 16, 12, (c) => {
      this.rr(c, 0, 1, 15, 10, 2, '#ffffff');
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, 8, 15, 3);
    });
    this.place('spark', 6, 16, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(w / 2 - 1.4, 0, 2.8, h);
    });
    // dust and grit shed by everything that moves
    for (let i = 0; i < 3; i++) {
      this.place('glyph' + i, 12, 12, (c, w, h) => {
        const cx = w / 2, cy = h / 2;
        if (i === 0) this.dot(c, cx, cy, 2.6, '#ffffff');
        else if (i === 1) this.rr(c, cx - 3, cy - 1.4, 6, 2.8, 1, '#ffffff');
        else this.poly(c, [cx - 2.6, cy + 2.4, cx, cy - 3, cx + 2.6, cy + 2.4], '#ffffff');
      });
    }
    this.place('star4', 20, 20, (c, w, h) => {
      const cx = w / 2, cy = h / 2;
      this.poly(c, [cx, 0, cx + 3, cy - 3, w, cy, cx + 3, cy + 3, cx, h, cx - 3, cy + 3, 0, cy, cx - 3, cy - 3], '#ffffff');
    });
  }

  // ---------- UI ----------
  private paintUI(): void {
    // 9-slice bases (corner radius 14 design px → slice inset 16)
    this.place('panelDark', 48, 48, (c, w, h) => {
      this.rr(c, 1.4, 1.4, w - 2.8, h - 2.8, 5, 'rgba(20,17,25,0.94)');
      c.strokeStyle = P.stoneDim; c.lineWidth = 2;
      c.beginPath(); c.roundRect(1.4, 1.4, w - 2.8, h - 2.8, 5); c.stroke();
    });
    this.place('btnGold', 48, 48, (c, w, h) => {
      this.rr(c, 1.4, 3, w - 2.8, h - 4.4, 5, P.rustDeep);
      this.rr(c, 1.4, 1.4, w - 2.8, h - 5.8, 5, P.amber);
      c.strokeStyle = P.amberBright; c.lineWidth = 2;
      c.beginPath(); c.roundRect(2.6, 2.6, w - 5.2, h - 8.2, 4); c.stroke();
    });
    this.place('btnBlue', 48, 48, (c, w, h) => {
      this.rr(c, 1.4, 3, w - 2.8, h - 4.4, 5, P.sysDeep);
      this.rr(c, 1.4, 1.4, w - 2.8, h - 5.8, 5, P.sys);
      c.strokeStyle = P.sysBright; c.lineWidth = 2;
      c.beginPath(); c.roundRect(2.6, 2.6, w - 5.2, h - 8.2, 4); c.stroke();
    });

    const icon = (name: string, draw: DrawFn) => this.place(name, 32, 32, draw);
    icon('iconPause', (c, w, h) => {
      c.fillStyle = '#ffffff';
      this.rr(c, 7, 6, 6.5, h - 12, 2.4, '#ffffff');
      this.rr(c, w - 13.5, 6, 6.5, h - 12, 2.4, '#ffffff');
    });
    icon('iconPlay', (c, w, h) => this.poly(c, [9, 5, w - 6, h / 2, 9, h - 5], '#ffffff'));
    icon('iconRestart', (c, w, h) => {
      c.strokeStyle = '#ffffff'; c.lineWidth = 4;
      c.beginPath(); c.arc(w / 2, h / 2, 9.5, -0.4, Math.PI * 1.5); c.stroke();
      this.poly(c, [w / 2 + 6, 4.4, w / 2 + 14, 8.4, w / 2 + 6.6, 13.4], '#ffffff');
    });
    icon('iconHome', (c, w, h) => {
      this.poly(c, [w / 2, 4, w - 5, 14, 5, 14], '#ffffff');
      this.rr(c, 8, 14, w - 16, h - 20, 2, '#ffffff');
      c.clearRect(w / 2 - 3, 18, 6, 8);
    });
    icon('iconGear', (c, w, h) => {
      const cx = w / 2, cy = h / 2;
      c.fillStyle = '#ffffff';
      for (let i = 0; i < 8; i++) {
        c.save(); c.translate(cx, cy); c.rotate((i * Math.PI) / 4);
        c.fillRect(-2.6, -13.4, 5.2, 7); c.restore();
      }
      this.dot(c, cx, cy, 8.6, '#ffffff');
      this.dot(c, cx, cy, 4, 'rgba(0,0,0,1)');
      // punch the center hole
      c.save(); c.globalCompositeOperation = 'destination-out';
      this.dot(c, cx, cy, 4, '#000'); c.restore();
    });
    icon('iconClose', (c, w, h) => {
      c.strokeStyle = '#ffffff'; c.lineWidth = 4.6;
      c.beginPath(); c.moveTo(7, 7); c.lineTo(w - 7, h - 7); c.moveTo(w - 7, 7); c.lineTo(7, h - 7); c.stroke();
    });
    icon('iconLock', (c, w, h) => {
      c.strokeStyle = '#ffffff'; c.lineWidth = 3.6;
      c.beginPath(); c.arc(w / 2, 12, 6.4, Math.PI, 0); c.stroke();
      this.rr(c, 6.5, 12, w - 13, h - 18, 3.4, '#ffffff');
    });
    icon('iconNext', (c, w, h) => {
      c.strokeStyle = '#ffffff'; c.lineWidth = 4.6;
      c.beginPath(); c.moveTo(8, 6); c.lineTo(w - 10, h / 2); c.lineTo(8, h - 6); c.stroke();
    });


    // ── HUD and screen icons ──
    icon('iconBlast', (c, w, h) => {
      const cx = w / 2, cy = h / 2;
      c.fillStyle = '#ffffff';
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        c.save(); c.translate(cx, cy); c.rotate(a);
        this.poly(c, [-2.4, -6, 2.4, -6, 0, -14], '#ffffff');
        c.restore();
      }
      this.dot(c, cx, cy, 6.4, '#ffffff');
      c.globalCompositeOperation = 'destination-out';
      this.dot(c, cx, cy, 2.6, '#000');
      c.globalCompositeOperation = 'source-over';
    });
    icon('iconSurge', (c, w, h) => {
      // a cross over a rising chevron: heal, and then move
      c.fillStyle = '#ffffff';
      c.fillRect(w / 2 - 3, 4, 6, 15);
      c.fillRect(w / 2 - 7.5, 8.5, 15, 6);
      c.strokeStyle = '#ffffff'; c.lineWidth = 3.4;
      c.beginPath();
      c.moveTo(6, h - 4); c.lineTo(w / 2, h - 11); c.lineTo(w - 6, h - 4);
      c.stroke();
    });
    icon('iconBag', (c, w, h) => {
      this.rr(c, 4, 10, w - 8, h - 13, 3, '#ffffff');
      c.strokeStyle = '#ffffff'; c.lineWidth = 3;
      c.beginPath(); c.arc(w / 2, 11, 6.4, Math.PI, 0); c.stroke();
      c.globalCompositeOperation = 'destination-out';
      c.fillRect(w / 2 - 2.4, 15, 4.8, 7);
      c.globalCompositeOperation = 'source-over';
    });
    icon('iconQuest', (c, w, h) => {
      this.rr(c, 6, 3, w - 12, h - 6, 2, '#ffffff');
      c.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 3; i++) c.fillRect(10, 9 + i * 6, w - 20, 3);
      c.globalCompositeOperation = 'source-over';
      this.poly(c, [w - 10, h - 12, w - 3, h - 5, w - 10, h - 3], '#ffffff');
    });
    icon('iconChar', (c, w) => {
      this.dot(c, w / 2, 10, 6.4, '#ffffff');
      this.rr(c, w / 2 - 8, 18, 16, 12, 4, '#ffffff');
      c.fillRect(4, 20, w - 8, 3.4);
    });
    icon('iconMap', (c, w, h) => {
      const a = w / 3;
      this.poly(c, [3, 6, a, 3, a * 2, 7, w - 3, 4, w - 3, h - 4, a * 2, h - 1, a, h - 5, 3, h - 2], '#ffffff');
      c.globalCompositeOperation = 'destination-out';
      c.fillRect(a - 1.2, 4, 2.4, h - 8);
      c.fillRect(a * 2 - 1.2, 6, 2.4, h - 8);
      c.globalCompositeOperation = 'source-over';
    });
    icon('iconTalk', (c, w, h) => {
      this.rr(c, 3, 4, w - 6, h - 12, 4, '#ffffff');
      this.poly(c, [9, h - 8, 19, h - 8, 10, h - 2], '#ffffff');
      c.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 2; i++) c.fillRect(8, 10 + i * 5, w - 16, 2.6);
      c.globalCompositeOperation = 'source-over';
    });
    icon('iconCoin', (c, w, h) => {
      this.dot(c, w / 2, h / 2, 11, '#ffffff');
      c.globalCompositeOperation = 'destination-out';
      c.fillRect(w / 2 - 1.6, h / 2 - 6, 3.2, 12);
      c.fillRect(w / 2 - 6, h / 2 - 1.6, 12, 3.2);
      c.globalCompositeOperation = 'source-over';
    });

    this.place('iconStar', 40, 40, (c, w, h) => {
      const cx = w / 2, cy = h / 2 + 2;
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 18 : 8.4;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
      }
      c.closePath();
      c.fillStyle = '#ffffff'; c.fill();
    });

    // Tutorial hand (points up-left, swipes side to side)
    this.place('hand', 60, 72, (c, w) => {
      const cx = w / 2;
      c.fillStyle = '#ffffff';
      this.rr(c, cx - 9, 6, 15, 34, 7, '#ffffff');            // index finger
      this.rr(c, cx - 15, 26, 34, 34, 14, '#ffffff');         // palm
      this.rr(c, cx + 8, 30, 12, 20, 6, '#ffffff');           // thumb
      c.strokeStyle = 'rgba(0,0,0,0.28)'; c.lineWidth = 2.6;
      c.beginPath(); c.roundRect(cx - 9, 6, 15, 34, 7); c.stroke();
      c.beginPath(); c.roundRect(cx - 15, 26, 34, 34, 14); c.stroke();
    });

    // The show's bug: a horizon inside a broadcast frame.
    this.place('emblem', 120, 96, (c, w, h) => {
      c.strokeStyle = P.sys; c.lineWidth = 3;
      c.beginPath();
      c.moveTo(14, 6); c.lineTo(w - 6, 6); c.lineTo(w - 6, h - 14);
      c.lineTo(w - 14, h - 6); c.lineTo(6, h - 6); c.lineTo(6, 14);
      c.closePath(); c.stroke();
      // a road running to a vanishing point
      c.fillStyle = P.grass; c.fillRect(12, 44, w - 24, h - 56);
      this.poly(c, [w / 2 - 4, 44, w / 2 + 4, 44, w / 2 + 26, h - 12, w / 2 - 26, h - 12], P.dirt);
      c.fillStyle = P.forest;
      for (let i = 0; i < 4; i++) {
        this.dot(c, 20 + i * 9, 48 + (i % 2) * 5, 5, P.forest);
        this.dot(c, w - 20 - i * 9, 48 + (i % 2) * 5, 5, P.forest);
      }
      // sky band and a low sun
      c.fillStyle = P.sysDeep; c.fillRect(12, 18, w - 24, 26);
      this.dot(c, w / 2, 44, 11, P.amberBright);
      // a live dot, because it is always filming
      this.dot(c, 16, 16, 4.4, P.hpRed);
      c.fillStyle = 'rgba(181,64,46,0.35)';
      c.beginPath(); c.arc(16, 16, 8, 0, Math.PI * 2); c.fill();
    });
  }
}
