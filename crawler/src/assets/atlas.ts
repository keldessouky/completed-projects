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
 *
 * The art is 3/4 view to sit on the isometric ground plane: characters stand
 * upright and billboard toward the camera, and their contact shadow — an
 * ellipse squashed to the same 2:1 the ground uses — is what actually plants
 * them on it. Sprite anchors are (0.5, 1): the bottom edge is the feet.
 */
const S = 2;               // atlas oversampling vs design px
const PAD = 4;             // atlas px between frames (bleed guard)
const SIZE = 2048;

type DrawFn = (c: CanvasRenderingContext2D, w: number, h: number) => void;
type Facing = 's' | 'n' | 'e';
const FACINGS: Facing[] = ['s', 'n', 'e'];

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

    this.paintHero();
    this.paintSquad();
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
   * The contact shadow. Squashed to the ground plane's own 2:1, which is the
   * single cheapest thing that makes a billboarded sprite look like it is
   * standing on an isometric field rather than floating in front of one.
   */
  private ground(c: CanvasRenderingContext2D, cx: number, cy: number, rx: number, hard = false): void {
    c.fillStyle = hard ? P.shadowHard : P.shadow;
    c.beginPath();
    c.ellipse(cx, cy, rx, rx * 0.5, 0, 0, Math.PI * 2);
    c.fill();
  }
  /**
   * The same drawing, washed toward white — the hit-flash frame.
   *
   * Not a flat silhouette: at these sprite sizes a solid white blob loses the
   * shape entirely, and with a squad of sixty firing constantly it is on screen
   * often enough that "what am I even shooting" becomes a real question.
   * Keeping a quarter of the original through preserves the read.
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

  // ---------- the hero ----------
  private paintHero(): void {
    /**
     * Carl. Barefoot, boxer shorts, no plan. Bigger-headed and bolder than the
     * levies behind him so that in a crowd of sixty the one you steer is never
     * in question.
     */
    const hero = (facing: Facing): DrawFn => (c, w, h) => {
      const cx = w / 2, foot = h - 4;
      this.ground(c, cx, foot - 2, 14, true);

      // bare legs and very bare feet
      this.rr(c, cx - 8, foot - 16, 7, 14, 3, P.skinShade);
      this.rr(c, cx + 1, foot - 16, 7, 14, 3, P.skin);

      // the shorts
      this.rr(c, cx - 11, foot - 26, 22, 13, 4, P.shorts);
      c.fillStyle = P.shortsLit;
      c.fillRect(cx - 11, foot - 22, 22, 2.4);
      c.fillRect(cx - 4, foot - 26, 3, 13);
      c.fillRect(cx + 4, foot - 26, 3, 13);

      // bare torso
      this.rr(c, cx - 11, foot - 39, 22, 15, 6, P.skin);
      c.fillStyle = P.skinShade;
      if (facing === 'n') c.fillRect(cx - 1, foot - 38, 2.4, 13);      // spine
      else if (facing === 'e') c.fillRect(cx + 5, foot - 39, 6, 15);

      // arms, and the machete that started as a bit of scaffold
      if (facing === 'e') {
        this.rr(c, cx + 4, foot - 36, 13, 6.5, 3, P.skin);
        c.save();
        c.translate(cx + 16, foot - 34); c.rotate(-0.5);
        this.rr(c, 0, -2.6, 22, 5.2, 2, P.steel);
        c.fillStyle = P.leatherDark; c.fillRect(-5, -3.4, 6, 6.8);
        c.restore();
      } else if (facing === 's') {
        this.rr(c, cx - 16, foot - 35, 7, 9, 3, P.skin);
        this.rr(c, cx + 9, foot - 35, 7, 9, 3, P.skin);
        c.save();
        c.translate(cx + 12, foot - 30); c.rotate(-1.15);
        this.rr(c, 0, -2.6, 21, 5.2, 2, P.steel);
        c.fillStyle = P.leatherDark; c.fillRect(-5, -3.4, 6, 6.8);
        c.restore();
      } else {
        this.rr(c, cx - 16, foot - 35, 7, 9, 3, P.skinShade);
        this.rr(c, cx + 9, foot - 35, 7, 9, 3, P.skinShade);
      }

      // head: hair cap from this angle, face only when looking at the camera
      const hy = foot - 47;
      this.dot(c, cx, hy, 10, P.hair);
      if (facing === 's') {
        this.dot(c, cx, hy + 2.8, 8, P.skin);
        c.fillStyle = P.hair;
        c.beginPath(); c.arc(cx, hy, 9.6, Math.PI, 0); c.fill();
        c.fillRect(cx - 9.6, hy - 1, 19.2, 2.8);
        c.fillStyle = P.ink;
        c.fillRect(cx - 4.4, hy + 1.8, 2.6, 2.6);
        c.fillRect(cx + 1.8, hy + 1.8, 2.6, 2.6);
      } else if (facing === 'e') {
        this.dot(c, cx + 3.4, hy + 2.2, 7.2, P.skin);
        c.fillStyle = P.hair;
        c.beginPath(); c.arc(cx, hy, 9.6, Math.PI * 0.7, Math.PI * 1.9); c.fill();
        c.fillStyle = P.ink; c.fillRect(cx + 5.6, hy + 1, 2.6, 2.6);
      }
    };
    for (const f of FACINGS) this.place('hero_' + f, 48, 60, hero(f));
    this.whiteVariant('hero_flash', 48, 60, hero('s'));

    this.place('hero_dead', 56, 44, (c, w, h) => {
      const cx = w / 2, cy = h / 2;
      this.ground(c, cx, cy + 12, 20, true);
      c.save(); c.translate(cx, cy + 2); c.rotate(Math.PI / 2);
      this.rr(c, -11, -15, 22, 15, 6, P.skin);
      this.rr(c, -11, 0, 22, 13, 4, P.shorts);
      this.dot(c, 0, -23, 10, P.hair);
      c.restore();
    });
  }

  // ---------- the squad ----------
  private paintSquad(): void {
    /**
     * One levy. Sixty of these are on screen at once, so the whole design brief
     * is "reads as a person at 22 px, costs nothing, and is unmistakably not an
     * enemy" — hence flat ally blue with no interior detail beyond a belt.
     *
     * `tier` only deepens the cloth and adds a helmet: the crowd should look
     * like it is getting better equipped without any of them becoming
     * individuals you might mourn.
     */
    const levy = (tier: 0 | 1 | 2, facing: Facing): DrawFn => (c, w, h) => {
      const cx = w / 2, foot = h - 3;
      const cloth = tier === 0 ? P.levy : tier === 1 ? P.ally : P.allyDark;
      const trim = tier === 0 ? P.levyDark : tier === 1 ? P.allyDark : P.ally;
      this.ground(c, cx, foot - 1, 9);

      // legs
      this.rr(c, cx - 6, foot - 11, 5, 10, 2, P.leatherDark);
      this.rr(c, cx + 1, foot - 11, 5, 10, 2, P.leatherDark);
      // tunic
      this.rr(c, cx - 8, foot - 25, 16, 16, 4, cloth);
      c.fillStyle = trim;
      c.fillRect(cx - 8, foot - 16, 16, 2.6);
      // arms — the near one carries a spear, angled by facing
      this.rr(c, cx - 11, foot - 23, 5, 10, 2.4, cloth);
      this.rr(c, cx + 6, foot - 23, 5, 10, 2.4, cloth);
      if (facing !== 'n') {
        c.strokeStyle = P.wood; c.lineWidth = 2.2;
        c.beginPath(); c.moveTo(cx + 9, foot - 4); c.lineTo(cx + 12, foot - 30); c.stroke();
        this.poly(c, [cx + 10.4, foot - 29, cx + 14, foot - 29, cx + 12.2, foot - 36], P.steel);
      }
      // head
      const hy = foot - 30;
      this.dot(c, cx, hy, 6.4, P.skin);
      if (tier === 2) {
        // helmet: the only thing that changes silhouette as the squad grows
        c.fillStyle = P.steel;
        c.beginPath(); c.arc(cx, hy, 7, Math.PI, 0); c.fill();
        c.fillRect(cx - 7, hy - 1, 14, 2.4);
      } else {
        c.fillStyle = P.hair;
        c.beginPath(); c.arc(cx, hy - 0.6, 6.6, Math.PI, 0); c.fill();
      }
      if (facing !== 'n') {
        c.fillStyle = P.ink;
        c.fillRect(cx - 3, hy + 1.4, 2, 2);
        c.fillRect(cx + 1, hy + 1.4, 2, 2);
      }
    };
    for (const t of [0, 1, 2] as const) {
      for (const f of FACINGS) this.place(`levy${t}_${f}`, 32, 42, levy(t, f));
    }
    this.whiteVariant('levy_flash', 32, 42, levy(0, 's'));
  }

  // ---------- the enemy roster ----------
  private paintEnemies(): void {
    /** Redcloak. The number you fight, not the fight itself. */
    const grunt = (facing: Facing): DrawFn => (c, w, h) => {
      const cx = w / 2, foot = h - 3;
      this.ground(c, cx, foot - 1, 10);
      this.rr(c, cx - 6, foot - 12, 5, 11, 2, P.ink);
      this.rr(c, cx + 1, foot - 12, 5, 11, 2, P.ink);
      // the cloak is the whole identity: one loud red shape
      this.rr(c, cx - 9, foot - 28, 18, 18, 4, P.foe);
      c.fillStyle = P.foeDark;
      c.fillRect(cx - 9, foot - 18, 18, 3);
      this.rr(c, cx - 12, foot - 26, 5, 11, 2.4, P.foeDark);
      this.rr(c, cx + 7, foot - 26, 5, 11, 2.4, P.foeDark);
      if (facing !== 'n') {
        // a short blade held low
        c.save(); c.translate(cx + 10, foot - 17); c.rotate(-0.35);
        this.rr(c, 0, -1.8, 13, 3.6, 1.5, P.steel); c.restore();
      }
      const hy = foot - 33;
      this.dot(c, cx, hy, 6.8, P.skinShade);
      c.fillStyle = P.foeDark;
      c.beginPath(); c.arc(cx, hy - 0.6, 7.2, Math.PI, 0); c.fill();
      c.fillRect(cx - 7.2, hy - 1.4, 14.4, 2.6);
      if (facing !== 'n') {
        c.fillStyle = P.ink;
        c.fillRect(cx - 3.2, hy + 1.4, 2.2, 2.2);
        c.fillRect(cx + 1, hy + 1.4, 2.2, 2.2);
      }
    };

    /** Bruiser. Wide, slow, and it takes two of you with it. */
    const heavy = (facing: Facing): DrawFn => (c, w, h) => {
      const cx = w / 2, foot = h - 4;
      this.ground(c, cx, foot - 2, 16, true);
      this.rr(c, cx - 11, foot - 15, 9, 14, 3, P.ink);
      this.rr(c, cx + 2, foot - 15, 9, 14, 3, P.ink);
      // slab of a torso, iron over red
      this.rr(c, cx - 16, foot - 40, 32, 27, 6, P.foeDark);
      this.rr(c, cx - 13, foot - 36, 26, 13, 4, P.steelDark);
      c.fillStyle = P.steel;
      c.fillRect(cx - 13, foot - 34, 26, 2.6);
      this.rr(c, cx - 21, foot - 38, 7, 16, 3.4, P.foeDark);
      this.rr(c, cx + 14, foot - 38, 7, 16, 3.4, P.foeDark);
      if (facing !== 'n') {
        // a maul, because the contact hit costs two people
        c.save(); c.translate(cx + 18, foot - 26); c.rotate(-0.5);
        c.strokeStyle = P.wood; c.lineWidth = 3.4;
        c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -20); c.stroke();
        this.rr(c, -7, -27, 14, 9, 2, P.stoneDark);
        c.restore();
      }
      const hy = foot - 47;
      this.dot(c, cx, hy, 8, P.skinShade);
      c.fillStyle = P.steelDark;
      c.beginPath(); c.arc(cx, hy - 1, 8.6, Math.PI, 0); c.fill();
      c.fillRect(cx - 8.6, hy - 2, 17.2, 4.4);
      if (facing !== 'n') {
        c.fillStyle = P.hpRed;
        c.fillRect(cx - 4.4, hy + 2, 3, 2.4);
        c.fillRect(cx + 1.4, hy + 2, 3, 2.4);
      }
    };

    /** Slinger. Thin, hangs back, and is the reason you keep moving. */
    const archer = (facing: Facing): DrawFn => (c, w, h) => {
      const cx = w / 2, foot = h - 3;
      this.ground(c, cx, foot - 1, 10);
      this.rr(c, cx - 6, foot - 12, 5, 11, 2, P.leatherDark);
      this.rr(c, cx + 1, foot - 12, 5, 11, 2, P.leatherDark);
      this.rr(c, cx - 8, foot - 28, 16, 17, 4, P.leather);
      c.fillStyle = P.foe;
      c.fillRect(cx - 8, foot - 24, 16, 3);              // a red sash: still theirs
      this.rr(c, cx - 11, foot - 26, 5, 11, 2.4, P.leather);
      this.rr(c, cx + 6, foot - 26, 5, 11, 2.4, P.leather);
      // the bow, drawn side-on so the shape carries at distance
      if (facing !== 'n') {
        c.strokeStyle = P.wood; c.lineWidth = 2.6;
        c.beginPath(); c.arc(cx + 8, foot - 22, 12, -1.15, 1.15); c.stroke();
        c.strokeStyle = P.boneDim; c.lineWidth = 1.2;
        c.beginPath();
        c.moveTo(cx + 8 + Math.cos(-1.15) * 12, foot - 22 + Math.sin(-1.15) * 12);
        c.lineTo(cx + 8 + Math.cos(1.15) * 12, foot - 22 + Math.sin(1.15) * 12);
        c.stroke();
      }
      // quiver over the far shoulder
      c.save(); c.translate(cx - 9, foot - 28); c.rotate(0.4);
      this.rr(c, -3, 0, 6, 14, 2, P.leatherDark);
      c.fillStyle = P.bone; c.fillRect(-2, -4, 1.6, 5); c.fillRect(0.6, -5, 1.6, 6);
      c.restore();
      const hy = foot - 33;
      this.dot(c, cx, hy, 6.4, P.skinShade);
      c.fillStyle = P.foeDark;
      c.beginPath(); c.arc(cx, hy - 0.6, 6.8, Math.PI, 0); c.fill();
      if (facing !== 'n') {
        c.fillStyle = P.ink;
        c.fillRect(cx - 3, hy + 1.4, 2, 2);
        c.fillRect(cx + 1, hy + 1.4, 2, 2);
      }
    };

    /** Captain. A camp's worth of health with a plume on top. */
    const captain = (facing: Facing): DrawFn => (c, w, h) => {
      const cx = w / 2, foot = h - 5;
      this.ground(c, cx, foot - 2, 22, true);
      this.rr(c, cx - 14, foot - 20, 11, 19, 3, P.ink);
      this.rr(c, cx + 3, foot - 20, 11, 19, 3, P.ink);
      // the cloak behind, then plate over it
      this.poly(c, [cx - 19, foot - 50, cx + 19, foot - 50, cx + 25, foot - 8, cx - 25, foot - 8], P.foeDark);
      this.rr(c, cx - 17, foot - 52, 34, 34, 6, P.steelDark);
      c.fillStyle = P.steel;
      c.fillRect(cx - 17, foot - 42, 34, 3.4);
      c.fillStyle = P.gold;
      c.fillRect(cx - 2.4, foot - 52, 4.8, 34);           // gilt sternum band
      // pauldrons
      this.rr(c, cx - 25, foot - 52, 11, 17, 5, P.steel);
      this.rr(c, cx + 14, foot - 52, 11, 17, 5, P.steel);
      if (facing !== 'n') {
        // greatsword, point down, both hands
        c.save(); c.translate(cx + 22, foot - 34); c.rotate(0.35);
        this.rr(c, -3, -6, 6, 40, 2, P.steel);
        c.fillStyle = P.gold; c.fillRect(-9, -8, 18, 5);
        c.restore();
      }
      const hy = foot - 60;
      this.dot(c, cx, hy, 9, P.skinShade);
      // helm and plume
      c.fillStyle = P.steelDark;
      c.beginPath(); c.arc(cx, hy - 1, 9.8, Math.PI, 0); c.fill();
      c.fillRect(cx - 9.8, hy - 2, 19.6, 5);
      c.fillStyle = P.foe;
      c.beginPath();
      c.moveTo(cx - 2.6, hy - 10);
      c.quadraticCurveTo(cx + 2, hy - 24, cx + 12, hy - 22);
      c.quadraticCurveTo(cx + 5, hy - 16, cx + 3, hy - 9);
      c.closePath(); c.fill();
      if (facing !== 'n') {
        c.fillStyle = P.hpRed;
        c.fillRect(cx - 5, hy + 2, 3.4, 2.6);
        c.fillRect(cx + 1.6, hy + 2, 3.4, 2.6);
      }
    };

    const mobs = [
      ['grunt', grunt, 36, 44], ['heavy', heavy, 52, 56],
      ['archer', archer, 40, 44], ['captain', captain, 64, 76],
    ] as const;
    for (const [name, fn, fw, fh] of mobs) {
      for (const f of FACINGS) {
        this.place(`${name}_${f}`, fw, fh, (fn as (f: Facing) => DrawFn)(f));
      }
      // One flash frame per kind rather than per facing: it is on screen for
      // 70 ms, and nobody has ever noticed a sprite turn to face them in that.
      this.whiteVariant(`${name}_flash`, fw, fh, (fn as (f: Facing) => DrawFn)('s'));
    }
  }

  // ---------- coins, projectiles, markers ----------
  private paintWorldBits(): void {
    // The coin. The entire economy, and it has to read at 14 px on grass.
    this.place('coin', 24, 26, (c, w) => {
      const cx = w / 2;
      this.ground(c, cx, 23, 7);
      this.dot(c, cx, 12, 9.6, P.goldDark);
      this.dot(c, cx, 11, 8, P.gold);
      c.fillStyle = P.goldDark;
      c.fillRect(cx - 1.4, 6, 2.8, 10);
      c.fillRect(cx - 5, 9.6, 10, 2.8);
      this.dot(c, cx - 3, 7.6, 2.2, '#fff2b8');
    });
    // A stack, for the HUD and for what a captain drops.
    this.place('coinStack', 28, 26, (c, w) => {
      const cx = w / 2;
      this.ground(c, cx, 23, 10);
      for (let i = 2; i >= 0; i--) {
        this.dot(c, cx - 3 + i * 3, 18 - i * 5, 8.4, P.goldDark);
        this.dot(c, cx - 3 + i * 3, 17 - i * 5, 7, P.gold);
      }
    });

    // What the slingers send back. Long, thin, and drawn pointing up so the
    // sprite can simply be rotated to its flight angle.
    this.place('arrow', 10, 26, (c, w) => {
      const cx = w / 2;
      c.strokeStyle = P.wood; c.lineWidth = 2.2;
      c.beginPath(); c.moveTo(cx, 5); c.lineTo(cx, 22); c.stroke();
      this.poly(c, [cx - 3, 6, cx + 3, 6, cx, 0], P.steel);
      c.fillStyle = P.boneDim;
      this.poly(c, [cx - 3.4, 26, cx, 19, cx, 24], P.boneDim);
      this.poly(c, [cx + 3.4, 26, cx, 19, cx, 24], P.boneDim);
    });
    // A thrown spear from your own line — the squad's attack made visible.
    this.place('spear', 8, 22, (c, w) => {
      const cx = w / 2;
      c.strokeStyle = P.wood; c.lineWidth = 2;
      c.beginPath(); c.moveTo(cx, 6); c.lineTo(cx, 21); c.stroke();
      this.poly(c, [cx - 3.2, 7, cx + 3.2, 7, cx, 0], P.steel);
    });

    // ── floating markers, drawn white and tinted at use ──
    this.place('pip', 20, 24, (c, w) => {
      const cx = w / 2;
      this.poly(c, [cx - 7, 12, cx + 7, 12, cx, 22], '#ffffff');
      this.rr(c, cx - 8, 0, 16, 13, 3, '#ffffff');
      c.globalCompositeOperation = 'destination-out';
      this.rr(c, cx - 5.5, 2.5, 11, 8, 2, '#000');
      c.globalCompositeOperation = 'source-over';
    });
    // The banner that hangs over a live recruit pad.
    this.place('banner', 26, 40, (c, w, h) => {
      const cx = w / 2;
      c.strokeStyle = P.woodDark; c.lineWidth = 2.6;
      c.beginPath(); c.moveTo(cx, 4); c.lineTo(cx, h - 2); c.stroke();
      this.poly(c, [cx, 4, cx + 11, 8, cx, 12, cx, 4], '#ffffff');
      this.poly(c, [cx, 12, cx + 11, 8, cx + 11, 20, cx, 22], '#ffffff');
      this.dot(c, cx, 3, 2.6, P.gold);
    });
    // An off-screen objective chevron, drawn pointing up.
    this.place('chevron', 26, 26, (c, w, h) => {
      this.poly(c, [w / 2, 2, w - 3, h - 6, w / 2, h - 11, 3, h - 6], '#ffffff');
    });
    // The castle's gate health chrome, and the ram icon on the breach prompt.
    this.place('iconGate', 32, 32, (c, w, h) => {
      this.rr(c, 5, 8, w - 10, h - 11, 2, '#ffffff');
      c.globalCompositeOperation = 'destination-out';
      c.beginPath(); c.roundRect(9, 13, w - 18, h - 13, [7, 7, 0, 0]); c.fill();
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = '#ffffff';
      for (let i = 0; i < 4; i++) c.fillRect(4 + i * 7, 3, 4, 6);
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
    // A flat ring on the ground plane — recruit pulses and breach shockwaves.
    this.place('ringFlat', 96, 56, (c, w, h) => {
      c.strokeStyle = '#ffffff'; c.lineWidth = 5;
      c.beginPath(); c.ellipse(w / 2, h / 2, w / 2 - 4, h / 2 - 4, 0, 0, Math.PI * 2); c.stroke();
    });
    this.place('star4', 20, 20, (c, w, h) => {
      const cx = w / 2, cy = h / 2;
      this.poly(c, [cx, 0, cx + 3, cy - 3, w, cy, cx + 3, cy + 3, cx, h, cx - 3, cy + 3, 0, cy, cx - 3, cy - 3], '#ffffff');
    });
  }

  // ---------- UI ----------
  private paintUI(): void {
    // 9-slice bases (corner radius 14 design px → slice inset 16)
    this.place('panelDark', 48, 48, (c, w, h) => {
      this.rr(c, 1.4, 1.4, w - 2.8, h - 2.8, 5, 'rgba(24,28,20,0.92)');
      c.strokeStyle = P.stoneDark; c.lineWidth = 2;
      c.beginPath(); c.roundRect(1.4, 1.4, w - 2.8, h - 2.8, 5); c.stroke();
    });
    this.place('btnGold', 48, 48, (c, w, h) => {
      this.rr(c, 1.4, 3, w - 2.8, h - 4.4, 5, P.goldDark);
      this.rr(c, 1.4, 1.4, w - 2.8, h - 5.8, 5, P.gold);
      c.strokeStyle = '#fff0b4'; c.lineWidth = 2;
      c.beginPath(); c.roundRect(2.6, 2.6, w - 5.2, h - 8.2, 4); c.stroke();
    });
    this.place('btnBlue', 48, 48, (c, w, h) => {
      this.rr(c, 1.4, 3, w - 2.8, h - 4.4, 5, P.allyDark);
      this.rr(c, 1.4, 1.4, w - 2.8, h - 5.8, 5, P.ally);
      c.strokeStyle = P.levy; c.lineWidth = 2;
      c.beginPath(); c.roundRect(2.6, 2.6, w - 5.2, h - 8.2, 4); c.stroke();
    });
    this.place('btnRed', 48, 48, (c, w, h) => {
      this.rr(c, 1.4, 3, w - 2.8, h - 4.4, 5, P.foeDark);
      this.rr(c, 1.4, 1.4, w - 2.8, h - 5.8, 5, P.foe);
      c.strokeStyle = '#f5847c'; c.lineWidth = 2;
      c.beginPath(); c.roundRect(2.6, 2.6, w - 5.2, h - 8.2, 4); c.stroke();
    });

    const icon = (name: string, draw: DrawFn) => this.place(name, 32, 32, draw);
    icon('iconPause', (c, w, h) => {
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
      c.save(); c.globalCompositeOperation = 'destination-out';
      this.dot(c, cx, cy, 4, '#000'); c.restore();
    });
    icon('iconClose', (c, w, h) => {
      c.strokeStyle = '#ffffff'; c.lineWidth = 4.6;
      c.beginPath(); c.moveTo(7, 7); c.lineTo(w - 7, h - 7); c.moveTo(w - 7, 7); c.lineTo(7, h - 7); c.stroke();
    });
    icon('iconNext', (c, w, h) => {
      c.strokeStyle = '#ffffff'; c.lineWidth = 4.6;
      c.beginPath(); c.moveTo(8, 6); c.lineTo(w - 10, h / 2); c.lineTo(8, h - 6); c.stroke();
    });
    icon('iconCoin', (c, w, h) => {
      this.dot(c, w / 2, h / 2, 11, '#ffffff');
      c.globalCompositeOperation = 'destination-out';
      c.fillRect(w / 2 - 1.6, h / 2 - 6, 3.2, 12);
      c.fillRect(w / 2 - 6, h / 2 - 1.6, 12, 3.2);
      c.globalCompositeOperation = 'source-over';
    });
    /** The squad counter's icon: three heads, because that is what it counts. */
    icon('iconSquad', (c, w) => {
      c.fillStyle = '#ffffff';
      this.dot(c, 10, 12, 5, '#ffffff');
      this.dot(c, w - 10, 12, 5, '#ffffff');
      this.dot(c, w / 2, 9, 6, '#ffffff');
      c.beginPath(); c.roundRect(2, 18, 12, 10, 4); c.fill();
      c.beginPath(); c.roundRect(w - 14, 18, 12, 10, 4); c.fill();
      c.beginPath(); c.roundRect(w / 2 - 8, 16, 16, 12, 5); c.fill();
    });
    /** Crossed blades: a live camp. */
    icon('iconCamp', (c, w, h) => {
      c.strokeStyle = '#ffffff'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(6, 6); c.lineTo(w - 6, h - 6); c.moveTo(w - 6, 6); c.lineTo(6, h - 6); c.stroke();
      this.dot(c, w / 2, h / 2, 4.4, '#ffffff');
    });
    /** A tent over a standard: a recruit pad. */
    icon('iconPad', (c, w, h) => {
      this.poly(c, [w / 2, 4, w - 4, h - 5, 4, h - 5], '#ffffff');
      c.globalCompositeOperation = 'destination-out';
      this.poly(c, [w / 2, 14, w / 2 + 6, h - 5, w / 2 - 6, h - 5], '#000');
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

    // The title emblem: a keep on a hill, with a crowd walking at it.
    this.place('emblem', 132, 104, (c, w, h) => {
      // sky
      c.fillStyle = '#8fd0f0'; c.fillRect(6, 6, w - 12, h - 12);
      // sun
      this.dot(c, w - 28, 26, 13, '#fff0b4');
      // hill
      c.fillStyle = P.grass;
      c.beginPath();
      c.moveTo(6, h - 6); c.lineTo(6, h - 34);
      c.quadraticCurveTo(w / 2, h - 62, w - 6, h - 30);
      c.lineTo(w - 6, h - 6); c.closePath(); c.fill();
      c.fillStyle = P.grassDark;
      c.beginPath();
      c.moveTo(6, h - 6); c.lineTo(6, h - 18);
      c.quadraticCurveTo(w / 2, h - 30, w - 6, h - 14);
      c.lineTo(w - 6, h - 6); c.closePath(); c.fill();
      // the keep on the crown of it
      this.rr(c, w / 2 - 20, h - 76, 40, 26, 2, P.stone);
      this.rr(c, w / 2 - 26, h - 68, 12, 20, 2, P.stoneDark);
      this.rr(c, w / 2 + 14, h - 68, 12, 20, 2, P.stoneDark);
      c.fillStyle = P.stoneDark;
      for (let i = 0; i < 5; i++) c.fillRect(w / 2 - 20 + i * 9, h - 80, 5, 5);
      c.fillStyle = P.ink;
      c.beginPath(); c.roundRect(w / 2 - 6, h - 62, 12, 12, [6, 6, 0, 0]); c.fill();
      // a red banner on the tower — whoever holds it is not you
      c.fillStyle = P.foe;
      c.fillRect(w / 2 + 18, h - 90, 2, 14);
      this.poly(c, [w / 2 + 20, h - 90, w / 2 + 31, h - 86, w / 2 + 20, h - 81], P.foe);
      // the crowd, walking east
      for (let i = 0; i < 9; i++) {
        const x = 14 + i * 6 + (i % 3) * 2;
        const y = h - 12 - (i % 2) * 3;
        this.dot(c, x, y - 7, 2.4, P.levy);
        c.fillStyle = P.ally; c.fillRect(x - 2.2, y - 5, 4.4, 6);
      }
      // frame
      c.strokeStyle = P.ink; c.lineWidth = 4;
      c.beginPath(); c.roundRect(6, 6, w - 12, h - 12, 8); c.stroke();
    });
  }
}
