import { CanvasSource, Rectangle, Texture } from 'pixi.js';
import { P } from './palette';
import {
  FRAMES_PER_FACING, FACINGS, type Facing, type FigureOpts, type Materials,
  BUILD, blade, bow, drawFigure, drawHead, hafted, poseFor, scaleBuild, spearArm,
} from './figure';
import {
  INK, alpha, cel, circPath, contactShadow, ellPath, mix, polyPath, rrPath, tint,
} from './shade';

/**
 * The sprite sheets, painted procedurally at boot and carved into named
 * Texture frames. Canvas-backed sources survive WebGL context restore (Pixi
 * re-uploads them), and the art recolours from the single palette in
 * palette.ts.
 *
 * Two things changed to get the detail up:
 *
 *  - **3× supersampling.** Every design pixel is nine texels, so a 40 px
 *    character carries real interior shading rather than four flat blocks.
 *  - **Pages.** The packer opens another sheet when one fills, and crops the
 *    last one to the height actually used. A fixed single 2048² sheet is a hard
 *    ceiling on how much art the game is allowed to have, and it is the wrong
 *    thing to be rationing — a page costs VRAM in proportion to what is on it.
 *
 * Characters are animated: five painted facings (mirrored to eight) × four
 * walk frames and an attack frame. Frames are named `<kind>_<facing>_<n>`.
 */
const S = 3;               // atlas oversampling vs design px
const PAD = 4;             // atlas px between frames (bleed guard)
const PAGE = 2048;

type DrawFn = (c: CanvasRenderingContext2D, w: number, h: number) => void;

interface Page {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  shelfX: number;
  shelfY: number;
  shelfH: number;
  source?: CanvasSource;
}

export class GameAtlas {
  private pages: Page[] = [];
  frames: Record<string, Texture> = {};
  /** fixed advance of the tabular digit glyphs, design px */
  readonly digitAdvance = 26;
  readonly digitCell = { w: 34, h: 46 };

  private pending: { page: number; name: string; rect: Rectangle }[] = [];

  private constructor() {
    this.newPage();
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

  /** True when the named frame exists — animation code asks before assuming. */
  has(name: string): boolean { return this.frames[name] !== undefined; }

  private newPage(): Page {
    const canvas = document.createElement('canvas');
    canvas.width = PAGE;
    canvas.height = PAGE;
    const ctx = canvas.getContext('2d')!;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const p: Page = { canvas, ctx, shelfX: PAD, shelfY: PAD, shelfH: 0 };
    this.pages.push(p);
    return p;
  }

  /** shelf-pack a wDesign×hDesign frame and draw it in design units */
  private place(name: string, wDesign: number, hDesign: number, draw: DrawFn): void {
    // Keep every packed rect a whole multiple of S so the ÷S back to logical
    // frame space in finalize() lands on exact pixel boundaries.
    const w = Math.ceil(wDesign) * S;
    const h = Math.ceil(hDesign) * S;
    if (w + PAD * 2 > PAGE || h + PAD * 2 > PAGE) {
      throw new Error(`atlas frame larger than a page: ${name}`);
    }

    let pi = this.pages.length - 1;
    let p = this.pages[pi];
    if (p.shelfX + w + PAD > PAGE) {
      p.shelfX = PAD;
      p.shelfY += p.shelfH + PAD;
      p.shelfH = 0;
    }
    if (p.shelfY + h + PAD > PAGE) {
      p = this.newPage();
      pi = this.pages.length - 1;
    }

    const x = p.shelfX, y = p.shelfY;
    p.shelfX += w + PAD;
    p.shelfH = Math.max(p.shelfH, h);

    const c = p.ctx;
    c.save();
    c.beginPath();
    c.rect(x, y, w, h);
    c.clip();
    c.setTransform(S, 0, 0, S, x, y);
    draw(c, wDesign, hDesign);
    c.restore();
    c.setTransform(1, 0, 0, 1, 0, 0);

    this.pending.push({ page: pi, name, rect: new Rectangle(x, y, w, h) });
  }

  private finalize(): void {
    for (const p of this.pages) {
      // Crop to the height actually used. A half-empty 2048² page is 8 MB of
      // VRAM holding nothing, and on a phone that is a real cost rather than a
      // rounding error.
      const used = Math.min(PAGE, p.shelfY + p.shelfH + PAD);
      const h = Math.max(64, Math.ceil(used / 64) * 64);
      if (h < PAGE) {
        const trimmed = document.createElement('canvas');
        trimmed.width = PAGE;
        trimmed.height = h;
        trimmed.getContext('2d')!.drawImage(p.canvas, 0, 0);
        p.canvas = trimmed;
      }
      // CanvasSource (not base TextureSource): it carries the canvas upload
      // path and survives WebGL context restoration by re-uploading the canvas.
      p.source = new CanvasSource({ resource: p.canvas, resolution: S, scaleMode: 'linear' });
    }
    // Frames are packed in canvas pixels, but Pixi builds UVs as
    // frame.x / source.width — and source.width is the resolution-divided
    // logical width (canvas px ÷ S). So divide: frames live in design units,
    // which also makes every texture's natural size its design size.
    for (const { page, name, rect } of this.pending) {
      const frame = new Rectangle(rect.x / S, rect.y / S, rect.width / S, rect.height / S);
      this.frames[name] = new Texture({ source: this.pages[page].source!, frame });
    }
  }

  // ================= painting =================

  private paintAll(): void {
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
   * Not a flat silhouette: at these sizes a solid white blob loses the shape
   * entirely, and with a crew of sixty firing constantly it is on screen often
   * enough that "what am I even hitting" becomes a real question.
   */
  private whiteVariant(name: string, w: number, h: number, draw: DrawFn): void {
    this.place(name, w, h, (c, ww, hh) => {
      draw(c, ww, hh);
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = 'rgba(255,255,255,0.78)';
      c.fillRect(-4, -4, ww + 8, hh + 8);
      c.globalCompositeOperation = 'source-over';
    });
  }

  /**
   * Bake a whole character: five facings × (four walk frames + an attack), plus
   * one flash frame. Everything in the game that walks goes through here, which
   * is what keeps the cast looking like one production.
   */
  private paintActor(
    kind: string, fw: number, fh: number,
    make: (facing: Facing, frame: number) => FigureOpts,
  ): void {
    for (const f of FACINGS) {
      for (let n = 0; n < FRAMES_PER_FACING; n++) {
        this.place(`${kind}_${f}_${n}`, fw, fh, (c, w, h) => drawFigure(c, w, h, make(f, n)));
      }
    }
    this.whiteVariant(`${kind}_flash`, fw, fh, (c, w, h) => drawFigure(c, w, h, make('s', 0)));
  }

  // ---------- the cast ----------
  private paintCast(): void {
    const carlBuild = scaleBuild(BUILD, 1.3, 1.06);
    const carlMat: Materials = {
      skin: P.skin, hair: P.hair, cloth: P.skin,
      trouser: P.shorts, leather: P.leatherDark, steel: P.steel,
    };

    /**
     * Carl. Barefoot, boxer shorts, no plan. Built a head taller and a shade
     * broader than a levy so that in a crowd of sixty the one the stick is
     * attached to is never in question.
     */
    this.paintActor('hero', 60, 76, (facing, frame) => ({
      build: carlBuild,
      mat: carlMat,
      facing,
      pose: poseFor(frame),
      bareArms: true,
      bareLegs: true,
      weapon: (c, hx, hy, a) => blade(c, hx, hy, a, 22, 4.4, P.steel, P.leatherDark),
      overlay: (c, cx, foot) => {
        // the checked waistband of the shorts, over the hips
        const b = carlBuild;
        const y = foot - b.leg - 2.6;
        c.save();
        rrPath(c, cx - b.torsoW * 0.56, y, b.torsoW * 1.12, 4.6, 1.6)();
        c.clip();
        c.fillStyle = tint(P.shorts, 0.24);
        for (let i = -6; i < 7; i++) c.fillRect(cx + i * 4.4, y, 2.1, 5);
        c.restore();
      },
    }));

    this.place('hero_dead', 62, 46, (c, w, h) => {
      const cx = w / 2, cy = h / 2;
      contactShadow(c, cx, cy + 12, 22, 0.4);
      c.save();
      c.translate(cx, cy + 4);
      c.rotate(Math.PI / 2);
      cel(c, rrPath(c, -11, -17, 22, 17, 7), P.skin, { depth: 3, rim: 1.5 });
      cel(c, rrPath(c, -11, 0, 22, 14, 4), P.shorts, { depth: 2.6, rim: 1.4 });
      cel(c, circPath(c, 0, -26, 10.4), P.skin, { depth: 3, rim: 1.6 });
      cel(c, () => {
        c.beginPath();
        c.arc(0, -26.6, 10.7, Math.PI * 0.99, Math.PI * 2.01);
        c.closePath();
      }, P.hair, { depth: 3, rim: 1.5 });
      c.restore();
      // the System does not acknowledge that a person has died, but the art can
      c.strokeStyle = INK;
      c.lineWidth = 1.6;
      for (const dx of [-6, 6]) {
        c.beginPath();
        c.moveTo(cx + dx - 3, cy - 16); c.lineTo(cx + dx + 3, cy - 10);
        c.moveTo(cx + dx + 3, cy - 16); c.lineTo(cx + dx - 3, cy - 10);
        c.stroke();
      }
    });

    // ── the crew ──
    const levyBuild = scaleBuild(BUILD, 0.94);
    const TIER: { cloth: string; trouser: string; helm?: string }[] = [
      { cloth: P.levy, trouser: P.leatherDark },
      { cloth: P.ally, trouser: P.leatherDark, helm: undefined },
      { cloth: P.allyDark, trouser: P.leatherDark, helm: P.steel },
    ];
    TIER.forEach((t, i) => {
      const mat: Materials = {
        skin: P.skin, hair: P.hair, cloth: t.cloth, trouser: t.trouser,
        leather: P.leatherDark, steel: P.steel,
        accent: i > 0 ? tint(t.cloth, -0.24) : undefined,
        helm: t.helm,
      };
      this.paintActor(`levy${i}`, 40, 52, (facing, frame) => ({
        build: levyBuild,
        mat,
        facing,
        pose: poseFor(frame),
        weapon: (c, hx, hy, a) => spearArm(c, hx, hy, a, 24, P.wood, P.steel),
      }));
    });

    this.paintDonut();
  }

  /**
   * Princess Donut. Not the rig — she is a cat, and forcing her onto a
   * humanoid skeleton to save a hundred lines would cost the one silhouette in
   * the game that has to be recognisable at a glance in a crowd of people.
   */
  private paintDonut(): void {
    const donut = (facing: Facing, frame: number): DrawFn => (c, w, h) => {
      const cx = w / 2, foot = h - 3;
      const away = facing === 'n' ? 1 : facing === 'ne' ? 0.8 : facing === 'e' ? 0.5 : facing === 'se' ? 0.25 : 0;
      const side = facing === 'e' ? 1 : facing === 'se' ? 0.5 : facing === 'ne' ? 0.7 : 0;
      const bob = frame === 1 || frame === 3 ? -2 : 0.4;
      const stride = frame === 0 ? 1 : frame === 2 ? -1 : 0;
      contactShadow(c, cx, foot - 1, 13, 0.32);

      const by = foot - 12 + bob;

      // tail, behind everything and never still
      const tx = cx - side * 11 + (side === 0 ? 10 : 0);
      cel(c, () => {
        c.beginPath();
        const sw = side >= 0 ? -1 : 1;
        c.moveTo(tx, by + 2);
        c.quadraticCurveTo(tx + sw * 11, by - 8, tx + sw * 5 + stride * 2, by - 20);
        c.quadraticCurveTo(tx + sw * 1, by - 10, tx - sw * 2, by + 3);
        c.closePath();
      }, P.fur, { depth: 2, rim: 1 });

      // legs
      for (const d of [-1, 1]) {
        const lx = cx + d * 6 + side * 2;
        cel(c, rrPath(c, lx - 2.4, by + 5 + (d * stride > 0 ? -1 : 0), 4.8, 9, 2.2),
          tint(P.fur, d < 0 ? -0.14 : 0), { depth: 1.4, rim: 0.7, line: 1.5 });
      }

      // body
      cel(c, ellPath(c, cx, by, 13, 9.4), P.fur, { depth: 3, rim: 1.6 });
      if (away < 0.7) {
        cel(c, ellPath(c, cx - side * 2, by + 2.4, 6.4, 5), P.furLight,
          { depth: 1.4, rim: 0.8, line: 0 });
      }

      // head
      const hx = cx + side * 5;
      const hy = by - 12 - (away > 0.6 ? 1 : 0);
      const r = 9.2;
      cel(c, polyPath(c, [hx - 8, hy - 3.6, hx - 5.8, hy - 13, hx - 2, hy - 4.8]), P.fur,
        { depth: 1.6, rim: 0.9, line: 1.6 });
      cel(c, polyPath(c, [hx + 2, hy - 4.8, hx + 5.8, hy - 13, hx + 8, hy - 3.6]), P.fur,
        { depth: 1.6, rim: 0.9, line: 1.6 });
      cel(c, circPath(c, hx, hy, r), P.fur, { depth: 3, rim: 1.6 });
      if (away < 0.72) {
        cel(c, ellPath(c, hx, hy + 3.2, 6.2, 4.6), P.furLight, { depth: 1.2, rim: 0.7, line: 0 });
        c.fillStyle = INK;
        const eo = side * 2.4;
        const farW = 2.1 * (1 - away * 0.9);
        c.beginPath(); c.ellipse(hx - 3.6 + eo, hy - 0.6, farW, 2.6, 0, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.ellipse(hx + 3.6 + eo, hy - 0.6, 2.1, 2.6, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.9)';
        c.beginPath(); c.arc(hx + 3 + eo, hy - 1.6, 0.8, 0, Math.PI * 2); c.fill();
        this.poly(c, [hx - 1.7 + eo, hy + 1.9, hx + 1.7 + eo, hy + 1.9, hx + eo, hy + 3.8], P.foe);
        c.strokeStyle = alpha(INK, 0.55);
        c.lineWidth = 0.7;
        c.beginPath();
        c.moveTo(hx - 5 + eo, hy + 3); c.lineTo(hx - 11 + eo, hy + 1.6);
        c.moveTo(hx + 5 + eo, hy + 3); c.lineTo(hx + 11 + eo, hy + 1.6);
        c.stroke();
      }

      // the tiara. she earned it. she will tell you about it.
      cel(c, rrPath(c, hx - 7, hy - r - 1.4, 14, 3.4, 1.2), P.gold, { depth: 1, rim: 0.6, line: 1.4 });
      cel(c, polyPath(c, [hx - 2.4, hy - r - 1.2, hx, hy - r - 7, hx + 2.4, hy - r - 1.2]), P.gold,
        { depth: 1, rim: 0.6, line: 1.4 });
      this.dot(c, hx, hy - r - 6.4, 1.5, '#fff6d0');
    };
    for (const f of FACINGS) {
      for (let n = 0; n < FRAMES_PER_FACING; n++) {
        this.place(`donut_${f}_${n}`, 44, 50, donut(f, n));
      }
    }
  }

  // ---------- the enemy roster ----------
  private paintEnemies(): void {
    // ── Redcloak: the number you fight, not the fight itself ──
    const gruntMat: Materials = {
      skin: P.skinShade, hair: P.hair, cloth: P.foe, trouser: P.ink,
      leather: P.leatherDark, steel: P.steel, accent: P.foeDark, cape: P.foeDark,
    };
    this.paintActor('grunt', 46, 54, (facing, frame) => ({
      build: scaleBuild(BUILD, 0.98),
      mat: gruntMat,
      facing,
      pose: poseFor(frame),
      weapon: (c, hx, hy, a) => blade(c, hx, hy, a, 14, 3.6, P.steel, P.leatherDark),
      head: (c, hx, hy, o) => {
        drawHead(c, hx, hy, { ...o, mat: { ...o.mat, helm: undefined } });
        // the hood is the identity: one loud red shape over the skull
        const r = o.build.head;
        cel(c, () => {
          c.beginPath();
          c.arc(hx, hy - r * 0.05, r * 1.12, Math.PI * 0.94, Math.PI * 2.06);
          c.lineTo(hx + r * 1.12, hy + r * 0.5);
          c.quadraticCurveTo(hx, hy - r * 0.1, hx - r * 1.12, hy + r * 0.5);
          c.closePath();
        }, P.foe, { depth: r * 0.3, rim: r * 0.16 });
      },
    }));

    // ── Slinger: thin, hangs back, and the reason you keep moving ──
    const archerMat: Materials = {
      skin: P.skinShade, hair: P.hairLight, cloth: P.leather, trouser: P.leatherDark,
      leather: P.leatherDark, steel: P.steel, accent: P.foe,
    };
    this.paintActor('archer', 48, 54, (facing, frame) => ({
      build: scaleBuild(BUILD, 0.95),
      mat: archerMat,
      facing,
      pose: poseFor(frame),
      weapon: (c, hx, hy, a, o) => bow(c, hx, hy, a, 13, P.wood, o.pose.swing > 0),
      back: (c, cx, foot, o) => {
        // quiver over the far shoulder, with arrows in it
        const b = o.build;
        const y = foot - b.leg - b.torsoH + 2;
        c.save();
        c.translate(cx - b.shoulder * 0.7, y);
        c.rotate(0.42);
        cel(c, rrPath(c, -3.4, 0, 6.8, 15, 2.4), P.leatherDark, { depth: 1.4, rim: 0.8, line: 1.5 });
        for (let i = -1; i <= 1; i++) {
          cel(c, rrPath(c, i * 2.1 - 0.5, -6, 1.4, 7, 0.6), P.bone, { depth: 0.5, rim: 0.3, line: 0.9 });
        }
        c.restore();
      },
    }));

    // ── Bruiser: wide, slow, and it takes two of you with it ──
    const heavyMat: Materials = {
      skin: P.skinShade, hair: P.hair, cloth: P.foeDark, trouser: P.ink,
      leather: P.leatherDark, steel: P.steelDark, accent: P.steelDark, helm: P.steelDark,
    };
    this.paintActor('heavy', 64, 68, (facing, frame) => ({
      build: scaleBuild(BUILD, 1.24, 0.92),
      mat: heavyMat,
      facing,
      pose: poseFor(frame),
      weapon: (c, hx, hy, a) => hafted(c, hx, hy, a, 24, P.wood, 17, 11, P.stoneDark),
      overlay: (c, cx, foot, o) => {
        // a slab of plate over the chest, so the silhouette is unmistakably
        // heavier than a redcloak's at the same distance
        const b = o.build;
        const y = foot - b.leg - b.torsoH;
        cel(c, rrPath(c, cx - b.torsoW * 0.46, y + 2, b.torsoW * 0.92, b.torsoH * 0.62, 3),
          P.steelDark, { depth: 2.6, rim: 1.4 });
        cel(c, rrPath(c, cx - b.torsoW * 0.62, y + 1, b.torsoW * 0.3, b.torsoH * 0.42, 3),
          P.steel, { depth: 1.8, rim: 1 });
        cel(c, rrPath(c, cx + b.torsoW * 0.32, y + 1, b.torsoW * 0.3, b.torsoH * 0.42, 3),
          P.steel, { depth: 1.8, rim: 1 });
      },
    }));

    // ── Floor Captain: a camp's worth of health with a plume on top ──
    const captainMat: Materials = {
      skin: P.skinShade, hair: P.hair, cloth: P.steelDark, trouser: P.ink,
      leather: P.leatherDark, steel: P.steel, accent: P.gold,
      cape: P.foeDark, helm: P.steelDark,
    };
    this.paintActor('captain', 78, 92, (facing, frame) => ({
      build: scaleBuild(BUILD, 1.5, 0.86),
      mat: captainMat,
      facing,
      pose: poseFor(frame),
      weapon: (c, hx, hy, a) => blade(c, hx, hy, a, 40, 6.4, P.steel, P.gold),
      overlay: (c, cx, foot, o) => {
        const b = o.build;
        const y = foot - b.leg - b.torsoH;
        // pauldrons
        for (const d of [-1, 1]) {
          cel(c, ellPath(c, cx + d * b.shoulder * 0.92, y + 3, b.shoulder * 0.42, b.shoulder * 0.34),
            P.steel, { depth: 2.2, rim: 1.2 });
        }
        // gilt sternum band
        cel(c, rrPath(c, cx - 2, y + 2, 4, b.torsoH - 2, 1.4), P.gold, { depth: 1.4, rim: 0.8, line: 1.4 });
        // the plume, above the helm
        const hy = y - b.head * 0.72;
        cel(c, () => {
          c.beginPath();
          c.moveTo(cx - 3, hy - b.head * 1.05);
          c.quadraticCurveTo(cx + 3, hy - b.head * 2.4, cx + 15, hy - b.head * 2.1);
          c.quadraticCurveTo(cx + 6, hy - b.head * 1.5, cx + 4, hy - b.head * 0.95);
          c.closePath();
        }, P.foe, { depth: 2.6, rim: 1.4 });
      },
    }));
  }

  // ---------- coins, projectiles, markers ----------
  private paintWorldBits(): void {
    /**
     * The coin, in four frames of a spin. The entire economy is these, and a
     * field of static discs reads as litter where a field of turning ones reads
     * as treasure — it is the cheapest life in the whole game.
     */
    for (let i = 0; i < 4; i++) {
      this.place(`coin_${i}`, 26, 30, (c, w) => {
        const cx = w / 2, cy = 14;
        // Width tracks the spin, but never all the way to edge-on: a coin one
        // and a half pixels wide reads as a twig stuck in the grass, and there
        // are two hundred of them on screen.
        const k = 0.38 + 0.62 * Math.abs(Math.cos((i / 4) * Math.PI));
        const rx = 9.6 * k;
        contactShadow(c, cx, 26, 8, 0.3);
        cel(c, ellPath(c, cx, cy, rx, 9.6), P.gold,
          { depth: 3, rim: 1.6, dark: P.goldDark, light: '#fff0b0' });
        if (k > 0.4) {
          // the crown stamp, squashed with the spin
          c.save();
          c.translate(cx, cy);
          c.scale(k, 1);
          c.fillStyle = P.goldDark;
          c.beginPath();
          c.moveTo(-4.6, 2.4); c.lineTo(-3.4, -3); c.lineTo(-1.2, 0.4);
          c.lineTo(0, -4); c.lineTo(1.2, 0.4); c.lineTo(3.4, -3); c.lineTo(4.6, 2.4);
          c.closePath(); c.fill();
          c.fillRect(-4.6, 3.2, 9.2, 1.8);
          c.restore();
        }
      });
    }
    // the frame everything that is not animating uses
    this.place('coin', 26, 30, (c, w) => {
      const cx = w / 2;
      contactShadow(c, cx, 26, 8, 0.3);
      cel(c, ellPath(c, cx, 14, 9.6, 9.6), P.gold,
        { depth: 3, rim: 1.6, dark: P.goldDark, light: '#fff0b0' });
      c.fillStyle = P.goldDark;
      c.beginPath();
      c.moveTo(cx - 4.6, 16.4); c.lineTo(cx - 3.4, 11); c.lineTo(cx - 1.2, 14.4);
      c.lineTo(cx, 10); c.lineTo(cx + 1.2, 14.4); c.lineTo(cx + 3.4, 11); c.lineTo(cx + 4.6, 16.4);
      c.closePath(); c.fill();
    });

    this.place('coinStack', 30, 30, (c, w) => {
      const cx = w / 2;
      contactShadow(c, cx, 26, 11, 0.32);
      for (let i = 2; i >= 0; i--) {
        cel(c, ellPath(c, cx - 3 + i * 3, 20 - i * 5, 8.6, 8.6), P.gold,
          { depth: 2.4, rim: 1.3, dark: P.goldDark, light: '#fff0b0' });
      }
    });

    // What the slingers send back, and what your line throws. Drawn pointing
    // up so the sprite can simply be rotated to its flight angle.
    this.place('arrow', 12, 30, (c, w) => {
      const cx = w / 2;
      cel(c, rrPath(c, cx - 1.3, 5, 2.6, 19, 1.2), P.wood, { depth: 1, rim: 0.5, line: 1.2 });
      cel(c, polyPath(c, [cx - 3.4, 7, cx + 3.4, 7, cx, 0]), P.steel, { depth: 1.4, rim: 0.8, line: 1.2 });
      cel(c, polyPath(c, [cx - 3.8, 30, cx, 21, cx, 27]), P.boneDim, { depth: 0.8, rim: 0.5, line: 1 });
      cel(c, polyPath(c, [cx + 3.8, 30, cx, 21, cx, 27]), P.boneDim, { depth: 0.8, rim: 0.5, line: 1 });
    });
    this.place('spear', 10, 26, (c, w) => {
      const cx = w / 2;
      cel(c, rrPath(c, cx - 1.2, 6, 2.4, 18, 1.1), P.wood, { depth: 1, rim: 0.5, line: 1.2 });
      cel(c, polyPath(c, [cx - 3.2, 8, cx + 3.2, 8, cx, 0]), P.steel, { depth: 1.4, rim: 0.8, line: 1.2 });
    });

    // ── floating markers, drawn white and tinted at use ──
    this.place('bar', 28, 8, (c, w, h) => this.rr(c, 0, 0, w, h, h / 2, '#ffffff'));

    this.place('pip', 20, 24, (c, w) => {
      const cx = w / 2;
      this.poly(c, [cx - 7, 12, cx + 7, 12, cx, 22], '#ffffff');
      this.rr(c, cx - 8, 0, 16, 13, 3, '#ffffff');
      c.globalCompositeOperation = 'destination-out';
      this.rr(c, cx - 5.5, 2.5, 11, 8, 2, '#000');
      c.globalCompositeOperation = 'source-over';
    });
    this.place('banner', 26, 40, (c, w, h) => {
      const cx = w / 2;
      c.strokeStyle = P.woodDark; c.lineWidth = 2.6;
      c.beginPath(); c.moveTo(cx, 4); c.lineTo(cx, h - 2); c.stroke();
      this.poly(c, [cx, 4, cx + 11, 8, cx, 12, cx, 4], '#ffffff');
      this.poly(c, [cx, 12, cx + 11, 8, cx + 11, 20, cx, 22], '#ffffff');
      this.dot(c, cx, 3, 2.6, P.gold);
    });
    this.place('chevron', 26, 26, (c, w, h) => {
      this.poly(c, [w / 2, 2, w - 3, h - 6, w / 2, h - 11, 3, h - 6], '#ffffff');
    });
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
        c.strokeStyle = 'rgba(0,0,0,0.92)';
        c.lineWidth = 7;
        c.strokeText(ch, w / 2, h / 2 + dy);
        c.fillStyle = '#ffffff';
        c.fillText(ch, w / 2, h / 2 + dy);
      });
    }
  }

  // ---------- particles ----------
  private paintParticles(): void {
    this.place('softDot', 16, 16, (c, w, h) => {
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
    this.place('spark', 6, 18, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(w / 2 - 1.4, 0, 2.8, h);
    });
    // A four-pointed impact flash: the frame a hit actually lands on.
    this.place('impact', 34, 34, (c, w, h) => {
      const cx = w / 2, cy = h / 2;
      this.poly(c, [
        cx, 0, cx + 4, cy - 5, w, cy, cx + 4, cy + 5,
        cx, h, cx - 4, cy + 5, 0, cy, cx - 4, cy - 5,
      ], '#ffffff');
      const g = c.createRadialGradient(cx, cy, 0, cx, cy, 11);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.beginPath(); c.arc(cx, cy, 11, 0, Math.PI * 2); c.fill();
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
    // A puff of dust, kicked up on a footfall. Drawn flat, on the ground plane.
    this.place('puff', 26, 16, (c, w, h) => {
      for (const [x, y, r] of [[7, 9, 5], [14, 7, 6.4], [20, 10, 4.4]] as const) {
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(255,255,255,0.9)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g;
        c.beginPath(); c.ellipse(x, y, r, r * 0.62, 0, 0, Math.PI * 2); c.fill();
      }
      void w; void h;
    });
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
    this.place('panelDark', 48, 48, (c, w, h) => {
      this.rr(c, 1.4, 1.4, w - 2.8, h - 2.8, 5, 'rgba(24,28,20,0.93)');
      c.strokeStyle = P.stoneDark; c.lineWidth = 2;
      c.beginPath(); c.roundRect(1.4, 1.4, w - 2.8, h - 2.8, 5); c.stroke();
    });
    const button = (name: string, base: string, rim: string): void => {
      this.place(name, 48, 48, (c, w, h) => {
        this.rr(c, 1.4, 3, w - 2.8, h - 4.4, 5, tint(base, -0.3));
        const g = c.createLinearGradient(0, 1.4, 0, h - 4.4);
        g.addColorStop(0, tint(base, 0.2));
        g.addColorStop(0.5, base);
        g.addColorStop(1, tint(base, -0.1));
        c.beginPath(); c.roundRect(1.4, 1.4, w - 2.8, h - 5.8, 5); c.fillStyle = g; c.fill();
        c.strokeStyle = rim; c.lineWidth = 2;
        c.beginPath(); c.roundRect(2.6, 2.6, w - 5.2, h - 8.2, 4); c.stroke();
      });
    };
    button('btnGold', P.gold, '#fff0b4');
    button('btnBlue', P.ally, P.levy);
    button('btnRed', P.foe, '#f5847c');

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
    icon('iconSquad', (c, w) => {
      c.fillStyle = '#ffffff';
      this.dot(c, 10, 12, 5, '#ffffff');
      this.dot(c, w - 10, 12, 5, '#ffffff');
      this.dot(c, w / 2, 9, 6, '#ffffff');
      c.beginPath(); c.roundRect(2, 18, 12, 10, 4); c.fill();
      c.beginPath(); c.roundRect(w - 14, 18, 12, 10, 4); c.fill();
      c.beginPath(); c.roundRect(w / 2 - 8, 16, 16, 12, 5); c.fill();
    });
    icon('iconCamp', (c, w, h) => {
      c.strokeStyle = '#ffffff'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(6, 6); c.lineTo(w - 6, h - 6); c.moveTo(w - 6, 6); c.lineTo(6, h - 6); c.stroke();
      this.dot(c, w / 2, h / 2, 4.4, '#ffffff');
    });
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

    this.place('hand', 60, 72, (c, w) => {
      const cx = w / 2;
      c.fillStyle = '#ffffff';
      this.rr(c, cx - 9, 6, 15, 34, 7, '#ffffff');
      this.rr(c, cx - 15, 26, 34, 34, 14, '#ffffff');
      this.rr(c, cx + 8, 30, 12, 20, 6, '#ffffff');
      c.strokeStyle = 'rgba(0,0,0,0.28)'; c.lineWidth = 2.6;
      c.beginPath(); c.roundRect(cx - 9, 6, 15, 34, 7); c.stroke();
      c.beginPath(); c.roundRect(cx - 15, 26, 34, 34, 14); c.stroke();
    });

    // The title emblem: a keep on a hill, with a crowd walking at it.
    this.place('emblem', 132, 104, (c, w, h) => {
      const sky = c.createLinearGradient(0, 6, 0, h * 0.62);
      sky.addColorStop(0, '#a8e2f6');
      sky.addColorStop(1, '#d9f2ff');
      c.fillStyle = sky; c.fillRect(6, 6, w - 12, h - 12);
      cel(c, circPath(c, w - 28, 26, 13), '#ffe9a8', { depth: 3, rim: 2, line: 0 });

      cel(c, () => {
        c.beginPath();
        c.moveTo(6, h - 6); c.lineTo(6, h - 34);
        c.quadraticCurveTo(w / 2, h - 64, w - 6, h - 30);
        c.lineTo(w - 6, h - 6); c.closePath();
      }, P.grass, { depth: 6, rim: 3, line: 0 });

      // the keep on the crown of it
      cel(c, rrPath(c, w / 2 - 20, h - 78, 40, 28, 2), P.stone, { depth: 4, rim: 2 });
      cel(c, rrPath(c, w / 2 - 27, h - 70, 13, 22, 2), P.stoneDark, { depth: 3, rim: 1.6 });
      cel(c, rrPath(c, w / 2 + 14, h - 70, 13, 22, 2), P.stoneDark, { depth: 3, rim: 1.6 });
      c.fillStyle = tint(P.stone, -0.2);
      for (let i = 0; i < 5; i++) c.fillRect(w / 2 - 20 + i * 9, h - 82, 5, 5);
      cel(c, () => {
        c.beginPath(); c.roundRect(w / 2 - 6, h - 62, 12, 12, [6, 6, 0, 0]);
      }, '#2a2018', { depth: 2, rim: 1 });
      cel(c, polyPath(c, [w / 2 + 20, h - 90, w / 2 + 31, h - 86, w / 2 + 20, h - 80]), P.foe,
        { depth: 1.6, rim: 1, line: 1.4 });

      // the crowd, walking east
      for (let i = 0; i < 9; i++) {
        const x = 15 + i * 6 + (i % 3) * 2;
        const y = h - 12 - (i % 2) * 3;
        cel(c, circPath(c, x, y - 7, 2.6), P.levy, { depth: 1, rim: 0.6, line: 1 });
        cel(c, rrPath(c, x - 2.4, y - 5, 4.8, 6, 1.6), P.ally, { depth: 1, rim: 0.6, line: 1 });
      }
      c.strokeStyle = INK; c.lineWidth = 4;
      c.beginPath(); c.roundRect(6, 6, w - 12, h - 12, 8); c.stroke();
      void mix;
    });
  }
}
