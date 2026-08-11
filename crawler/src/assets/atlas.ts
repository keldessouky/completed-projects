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
    this.paintBoss();
    this.paintGates();
    this.paintDigits();
    this.paintParticlesAndItems();
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
  /** draw fn again as a flat white silhouette (hit-flash frames) */
  private whiteVariant(name: string, w: number, h: number, draw: DrawFn): void {
    this.place(name, w, h, (c, ww, hh) => {
      draw(c, ww, hh);
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = '#ffffff';
      c.fillRect(-2, -2, ww + 4, hh + 4);
      c.globalCompositeOperation = 'source-over';
    });
  }

  // ---------- cast ----------
  private paintCast(): void {
    // Carl: seen from behind and slightly above. Bare back, boxer shorts, bare
    // feet, and a nail gun he did not own last week.
    this.place('hero', 48, 56, (c, w) => {
      const cx = w / 2;
      // the nail gun, held forward into the top of the frame
      this.rr(c, cx - 7, 6, 14, 13, 3, P.steelDark);
      this.rr(c, cx - 5, 4, 10, 6, 2, P.steel);
      c.fillStyle = P.amber; c.fillRect(cx - 2, 2, 4, 4);      // muzzle glow
      this.rr(c, cx - 3, 17, 6, 7, 2, P.steelDark);            // magazine
      // arms out to the grip
      this.poly(c, [cx - 10, 22, cx - 14, 13, cx - 10.6, 11.6, cx - 5, 20], P.skin);
      this.poly(c, [cx + 10, 22, cx + 14, 13, cx + 10.6, 11.6, cx + 5, 20], P.skin);
      // bare back and shoulders
      this.rr(c, cx - 11, 18, 22, 18, 7, P.skin);
      c.fillStyle = 'rgba(0,0,0,0.16)';
      c.fillRect(cx - 1, 20, 2, 14);                            // spine shadow
      // boxer shorts, checked, because that is the whole joke
      this.rr(c, cx - 12, 34, 24, 13, 3, P.cloth);
      c.fillStyle = 'rgba(255,255,255,0.16)';
      for (let i = 0; i < 3; i++) c.fillRect(cx - 12 + i * 8, 34, 3, 13);
      for (let i = 0; i < 2; i++) c.fillRect(cx - 12, 37 + i * 5, 24, 2);
      // legs and very bare feet
      this.rr(c, cx - 9, 46, 7, 8, 2, P.skin);
      this.rr(c, cx + 2, 46, 7, 8, 2, P.skin);
      this.rr(c, cx - 10, 52, 9, 4, 2, P.skin);
      this.rr(c, cx + 1, 52, 9, 4, 2, P.skin);
      // dark hair, from above
      this.dot(c, cx, 15, 6.2, '#2b2118');
      c.fillStyle = '#3a2d20';
      c.beginPath(); c.arc(cx, 14, 6.2, Math.PI, 0); c.fill();
    });

    // Princess Donut, trotting alongside. Small, fluffy, deeply unimpressed.
    this.place('donut', 30, 24, (c, w, h) => {
      const cx = w / 2, cy = h / 2 + 2;
      c.fillStyle = P.furShade;
      c.beginPath(); c.ellipse(cx, cy + 2, 11, 7.5, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = P.fur;
      c.beginPath(); c.ellipse(cx - 1, cy, 10, 6.5, 0, 0, Math.PI * 2); c.fill();
      // tail, up and outraged
      c.strokeStyle = P.fur; c.lineWidth = 3.4; c.lineCap = 'round';
      c.beginPath();
      c.moveTo(cx + 8, cy); c.quadraticCurveTo(cx + 15, cy - 4, cx + 12, cy - 10);
      c.stroke();
      // head and ears
      this.dot(c, cx - 8, cy - 3, 5.4, P.fur);
      this.poly(c, [cx - 12, cy - 6, cx - 10.4, cy - 11, cx - 8.6, cy - 6.4], P.fur);
      this.poly(c, [cx - 6.4, cy - 6.6, cx - 5, cy - 11, cx - 3.4, cy - 6.2], P.fur);
      // the tiara. she earned it. she will tell you about it.
      c.fillStyle = P.amberBright;
      c.fillRect(cx - 11.4, cy - 8.6, 6.6, 1.8);
      this.poly(c, [cx - 9.4, cy - 8.8, cx - 8.1, cy - 12, cx - 6.8, cy - 8.8], P.amberBright);
      c.fillStyle = '#2b2118';
      c.fillRect(cx - 10.2, cy - 4, 1.8, 1.8);
      c.fillRect(cx - 7, cy - 4, 1.8, 1.8);
    });

    // Party tiers: survivors who found progressively better things to wear.
    const unit = (tier: number): DrawFn => (c, w) => {
      const cx = w / 2;
      // whatever they are shooting with
      c.strokeStyle = tier >= 2 ? P.steel : P.steelDark;
      c.lineWidth = 2.2;
      c.beginPath(); c.moveTo(cx + 6, 24); c.lineTo(cx + 6, 6); c.stroke();
      this.rr(c, cx + 4, 4, 4.4, 5, 1.4, tier >= 2 ? P.amber : P.steel);
      // scavenged coat (T3+)
      if (tier >= 3) this.poly(c, [cx - 9, 15, cx + 7, 15, cx + 4, 32, cx - 6, 32], P.rustDeep);
      // torso
      this.rr(c, cx - 7, 13, 14, 15, 3, tier >= 1 ? P.cloth : P.concrete);
      // body armour (T2+): a plate that reads even at 30px
      if (tier >= 2) {
        this.rr(c, cx - 6, 15, 12, 9, 2, tier >= 4 ? P.steel : P.steelDark);
        c.fillStyle = P.amber; c.fillRect(cx - 1.4, 16.4, 2.8, 6);
      }
      // legs
      this.rr(c, cx - 6, 27, 5, 7, 1.6, P.concreteDim);
      this.rr(c, cx + 1, 27, 5, 7, 1.6, P.concreteDim);
      // head; helmet from T1
      this.dot(c, cx, 9.4, 4.4, P.skin);
      if (tier >= 1) {
        c.fillStyle = tier >= 4 ? P.amberBright : tier >= 3 ? P.steel : P.steelDark;
        c.beginPath(); c.arc(cx, 9, 4.7, Math.PI, 0); c.fill();
        c.fillRect(cx - 4.7, 8.6, 9.4, 1.6);
        if (tier >= 4) { c.fillStyle = P.sysBright; c.fillRect(cx - 4.7, 6.6, 3, 1.6); }
      }
    };
    for (let t = 0; t < 5; t++) this.place('unit' + t, 30, 34, unit(t));
    this.whiteVariant('unitW', 30, 34, unit(0));
  }

  // ---------- mobs ----------
  private paintEnemies(): void {
    // Rubble brute: a slab of collapsed building that stood back up.
    const brute: DrawFn = (c, w) => {
      const cx = w / 2;
      this.rr(c, cx - 18, 22, 36, 30, 3, P.concreteDim);
      this.rr(c, cx - 21, 26, 10, 22, 2, P.concrete);   // arms
      this.rr(c, cx + 11, 26, 10, 22, 2, P.concrete);
      this.rr(c, cx - 14, 18, 28, 22, 2, P.concrete);   // chest slab
      this.rr(c, cx - 9, 6, 18, 16, 2, P.concreteDim);  // head block
      // rebar bristling out of the shoulders
      c.strokeStyle = P.rust; c.lineWidth = 2;
      c.beginPath();
      c.moveTo(cx - 16, 22); c.lineTo(cx - 22, 12);
      c.moveTo(cx + 14, 20); c.lineTo(cx + 21, 11);
      c.moveTo(cx + 6, 18); c.lineTo(cx + 9, 8);
      c.stroke();
      // fracture lines
      c.strokeStyle = P.pit; c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(cx - 8, 30); c.lineTo(cx - 3, 36); c.lineTo(cx - 6, 43);
      c.moveTo(cx + 9, 24); c.lineTo(cx + 5, 31);
      c.stroke();
      // two dead sodium bulbs where eyes would be
      c.fillStyle = P.amberBright;
      c.fillRect(cx - 6, 11, 4, 3); c.fillRect(cx + 2, 11, 4, 3);
      c.fillStyle = P.concreteDim;
      c.fillRect(cx - 14, 52, 28, 4);
    };
    this.place('brute', 52, 56, brute);
    this.whiteVariant('bruteW', 52, 56, brute);

    // Sewer rat: low, fast, far too large, coming straight at you.
    const rat: DrawFn = (c, w, h) => {
      const cx = w / 2;
      // tail whipping out behind
      c.strokeStyle = P.rustDeep; c.lineWidth = 2.6; c.lineCap = 'round';
      c.beginPath();
      c.moveTo(cx, h - 12); c.quadraticCurveTo(cx + 14, h - 6, cx + 9, h - 1);
      c.stroke();
      // body, haunches first because we see it from above
      c.fillStyle = P.rustDeep;
      c.beginPath(); c.ellipse(cx, h - 15, 12, 10, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = P.rust;
      c.beginPath(); c.ellipse(cx, h - 18, 10, 8, 0, 0, Math.PI * 2); c.fill();
      // legs splayed out
      for (const sx of [-1, 1]) {
        this.rr(c, cx + sx * 11 - 2, h - 22, 4, 8, 1.6, P.rustDeep);
        this.rr(c, cx + sx * 9 - 2, h - 12, 4, 7, 1.6, P.rustDeep);
      }
      // head and ears
      this.dot(c, cx, 9, 6.4, P.rust);
      this.dot(c, cx - 5.6, 4.4, 3.2, P.rustDeep);
      this.dot(c, cx + 5.6, 4.4, 3.2, P.rustDeep);
      this.poly(c, [cx - 2.6, 12, cx + 2.6, 12, cx, 17], P.skin);   // snout
      c.fillStyle = P.trapRed;
      c.fillRect(cx - 4, 7.4, 2.6, 2.2); c.fillRect(cx + 1.4, 7.4, 2.6, 2.2);
    };
    this.place('rat', 40, 38, rat);
    this.whiteVariant('ratW', 40, 38, rat);

    // Maintenance drone: a municipal fan that was given opinions.
    const drone = (bladesUp: boolean): DrawFn => (c, w) => {
      const cx = w / 2, cy = 22;
      const spin = bladesUp ? 0 : Math.PI / 4;
      // rotor arms and blur discs
      for (const sx of [-1, 1]) {
        const ax = cx + sx * 17;
        this.rr(c, cx + (sx < 0 ? -17 : 3), cy - 3, 14, 5, 2, P.steelDark);
        c.save(); c.translate(ax, cy - 4); c.rotate(spin);
        c.fillStyle = 'rgba(141,146,153,0.55)';
        c.fillRect(-9, -1.6, 18, 3.2);
        c.fillRect(-1.6, -9, 3.2, 18);
        c.restore();
        this.dot(c, ax, cy - 4, 2.6, P.steel);
      }
      // chassis
      this.rr(c, cx - 9, cy - 8, 18, 18, 4, P.steel);
      this.rr(c, cx - 7, cy - 6, 14, 8, 2, P.steelDark);
      // camera lens, and the little red light that means it is filming
      this.dot(c, cx, cy + 4, 4.6, P.steelDark);
      this.dot(c, cx, cy + 4, 3, P.sys);
      this.dot(c, cx - 1, cy + 3, 1.2, P.sysBright);
      c.fillStyle = P.trapRed; c.fillRect(cx + 5, cy - 5, 2.6, 2.6);
      // undercarriage grabber
      this.poly(c, [cx - 4, cy + 10, cx + 4, cy + 10, cx, cy + 16], P.steelDark);
    };
    this.place('drone0', 52, 44, drone(true));
    this.place('drone1', 52, 44, drone(false));
    this.whiteVariant('droneW', 52, 44, drone(true));
  }

  // ---------- boss ----------
  private paintBoss(): void {
    // The hulk: a riveted bulkhead on legs, wearing municipal warning paint.
    this.place('bossHulk', 340, 250, (c, w, h) => {
      const cx = w / 2;
      // Main plate. Deliberately the lightest thing in the game: it fills the
      // top of a very dark screen, and at tunnel contrast a concrete-grey slab
      // simply disappears.
      c.fillStyle = '#4a4d53';
      c.fillRect(cx - 170, 40, 340, h - 40);
      const lit = c.createLinearGradient(0, 40, 0, h);
      lit.addColorStop(0, '#6e737b');
      lit.addColorStop(0.45, '#575b62');
      lit.addColorStop(1, '#3c3f45');
      c.fillStyle = lit;
      c.fillRect(cx - 160, 52, 320, h - 60);
      // panel seams
      c.strokeStyle = 'rgba(0,0,0,0.45)';
      c.lineWidth = 1.6;
      for (let y = 70; y < h; y += 22) {
        c.beginPath(); c.moveTo(cx - 160, y); c.lineTo(cx + 160, y); c.stroke();
      }
      for (let x = -120; x <= 120; x += 60) {
        c.beginPath(); c.moveTo(cx + x, 52); c.lineTo(cx + x, h); c.stroke();
      }
      // rivets along the top edge
      for (let i = 0; i < 17; i++) this.dot(c, cx - 152 + i * 19, 46, 3, '#9aa0a8');
      // hazard chevrons — the only saturated band on the whole sprite
      c.save();
      c.beginPath(); c.rect(cx - 160, 62, 320, 20); c.clip();
      c.fillStyle = P.amber; c.fillRect(cx - 160, 62, 320, 20);
      c.fillStyle = P.pit;
      for (let i = -9; i < 18; i++) {
        this.poly(c, [cx - 160 + i * 20, 82, cx - 148 + i * 20, 62, cx - 138 + i * 20, 62, cx - 150 + i * 20, 82], P.pit);
      }
      c.restore();
      // intake grille: the mouth, and the thing you are actually shooting
      c.fillStyle = '#141519';
      c.fillRect(cx - 66, 120, 132, h - 130);
      c.strokeStyle = '#6e737b'; c.lineWidth = 4;
      for (let y = 128; y < h - 16; y += 15) {
        c.beginPath(); c.moveTo(cx - 62, y); c.lineTo(cx + 62, y); c.stroke();
      }
      c.strokeStyle = '#a7adb5'; c.lineWidth = 5;
      c.strokeRect(cx - 66, 120, 132, h - 130);
      // two sodium eyes above the grille, with the haze they throw
      for (const sx of [-1, 1]) {
        const ex = cx + sx * 96;
        const g = c.createRadialGradient(ex, 104, 4, ex, 104, 34);
        g.addColorStop(0, 'rgba(240,194,104,0.55)');
        g.addColorStop(1, 'rgba(240,194,104,0)');
        c.fillStyle = g;
        c.beginPath(); c.arc(ex, 104, 34, 0, Math.PI * 2); c.fill();
        this.dot(c, ex, 104, 15, '#2b2d31');
        this.dot(c, ex, 104, 10, P.amberBright);
        this.dot(c, ex - 3, 101, 3.6, '#fff3d8');
      }
      // corporate asset plate
      this.rr(c, cx - 34, 96, 68, 18, 2, '#2b2d31');
      c.fillStyle = P.bone;
      c.font = '700 12px Inter, system-ui, sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('UNIT 07', cx, 106);
    });

    // Flanking hydraulic arm (left flank; the right one is mirrored).
    const arm = (awake: boolean): DrawFn => (c, w, h) => {
      const cx = w / 2;
      const plate = awake ? '#a7adb5' : '#7b8189';
      const dark = awake ? '#5c6167' : '#4a4e54';
      // shoulder housing
      this.rr(c, cx - 24, 44, 52, 34, 4, plate);
      this.rr(c, cx - 20, 50, 44, 10, 2, dark);
      // piston, extended and glowing when powered
      c.save();
      c.translate(cx - 6, 52);
      c.rotate(awake ? -0.55 : -0.12);
      this.rr(c, -6, -34, 12, 36, 3, dark);
      this.rr(c, -3.4, -40, 6.8, 12, 2, awake ? P.amberBright : plate);
      c.restore();
      // forearm and clamp
      this.rr(c, cx - 16, 76, 34, 30, 4, plate);
      for (let i = 0; i < 3; i++) this.rr(c, cx - 14 + i * 11, 104, 8, 12, 2, dark);
      c.fillStyle = dark; c.fillRect(cx - 26, h - 6, 56, 6);
      // hydraulic lines
      c.strokeStyle = awake ? P.rust : dark; c.lineWidth = 2.4;
      c.beginPath();
      c.moveTo(cx - 18, 60); c.quadraticCurveTo(cx - 28, 76, cx - 16, 92);
      c.stroke();
      // status lamp: dead when idle, hot when awake
      this.dot(c, cx + 14, 60, 4.4, awake ? P.amberBright : '#3a3d42');
      if (awake) {
        c.fillStyle = 'rgba(240,194,104,0.35)';
        c.beginPath(); c.arc(cx + 14, 60, 9, 0, Math.PI * 2); c.fill();
      }
    };
    this.place('armIdle', 96, 118, arm(false));
    this.place('armAwake', 96, 118, arm(true));
    this.whiteVariant('armW', 96, 118, arm(true));

    // shield aura ring (tinted System blue, additive)
    this.place('shieldRing', 140, 140, (c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, 68);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.72, 'rgba(255,255,255,0.85)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    });
  }

  // ---------- doors ----------
  private paintGates(): void {
    // Neutral concrete doorframe — tinted System-blue for a reward, red for a hazard.
    this.place('doorArch', 210, 128, (c, w, h) => {
      const cx = w / 2;
      // jambs
      for (const sx of [-1, 1]) {
        const px = cx + sx * (w / 2 - 16);
        this.rr(c, px - 12, 26, 24, h - 26, 2, '#cfc9bd');
        c.fillStyle = '#aca698';
        for (let y = 36; y < h - 8; y += 18) c.fillRect(px - 12, y, 24, 2);
        c.fillStyle = '#e8e2d6';
        c.fillRect(px - 12, 26, 24, 5);
      }
      // lintel
      c.fillStyle = '#d8d2c5';
      c.fillRect(16, 20, w - 32, 16);
      c.fillStyle = '#e8e2d6';
      c.fillRect(16, 20, w - 32, 4);
      // conduit running across the header, with a junction box
      c.strokeStyle = P.steelDark; c.lineWidth = 3.4;
      c.beginPath(); c.moveTo(20, 12); c.lineTo(w - 20, 12); c.stroke();
      this.rr(c, cx - 9, 5, 18, 14, 2, P.steel);
      this.dot(c, cx, 12, 3, P.amberBright);
      // two dangling cables, because nothing down here was finished properly
      c.strokeStyle = P.steelDark; c.lineWidth = 1.8;
      for (const sx of [-0.55, 0.55]) {
        c.beginPath();
        c.moveTo(cx + sx * 66, 12);
        c.quadraticCurveTo(cx + sx * 72, 26, cx + sx * 62, 34);
        c.stroke();
      }
    });

    // Sign panel that carries the big label (tinted per door kind).
    this.place('doorPanel', 128, 58, (c, w, h) => {
      this.rr(c, 0, 0, w, h, 3, 'rgba(255,255,255,0.96)');
      c.strokeStyle = 'rgba(0,0,0,0.35)';
      c.lineWidth = 3;
      c.beginPath(); c.roundRect(2, 2, w - 4, h - 4, 2); c.stroke();
      // two bolts, top corners — it is a sign, not a rune
      c.fillStyle = 'rgba(0,0,0,0.28)';
      this.dot(c, 9, 8, 2.4, 'rgba(0,0,0,0.28)');
      this.dot(c, w - 9, 8, 2.4, 'rgba(0,0,0,0.28)');
    });

    // Colorblind-safe shape marks: chevron-up = safe, X = hazard.
    this.place('symUp', 36, 24, (c, w, h) => {
      c.strokeStyle = '#ffffff'; c.lineWidth = 6.5;
      c.beginPath();
      c.moveTo(4, h - 4); c.lineTo(w / 2, 4); c.lineTo(w - 4, h - 4);
      c.stroke();
    });
    this.place('symX', 30, 30, (c, w, h) => {
      c.strokeStyle = '#ffffff'; c.lineWidth = 6.5;
      c.beginPath();
      c.moveTo(5, 5); c.lineTo(w - 5, h - 5);
      c.moveTo(w - 5, 5); c.lineTo(5, h - 5);
      c.stroke();
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

  // ---------- particles, projectiles, items ----------
  private paintParticlesAndItems(): void {
    // A nail. Fired from a nail gun. This is the whole armoury.
    this.place('arrow', 10, 28, (c, w) => {
      const cx = w / 2;
      c.strokeStyle = P.steel; c.lineWidth = 2.4;
      c.beginPath(); c.moveTo(cx, 4); c.lineTo(cx, 24); c.stroke();
      this.poly(c, [cx - 2.6, 6, cx + 2.6, 6, cx, 0], P.bone);
      c.fillStyle = P.steelDark; c.fillRect(cx - 3.4, 23, 6.8, 2.6);
    });

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
    // dust and grit shed by everything that moves down here
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

    this.place('coin', 22, 22, (c, w, h) => {
      this.dot(c, w / 2, h / 2, 10, P.rustDeep);
      this.dot(c, w / 2, h / 2, 8.4, P.amber);
      this.dot(c, w / 2 - 2, h / 2 - 2.4, 3.4, P.amberBright);
      c.fillStyle = P.rustDeep;
      c.fillRect(w / 2 - 1.4, h / 2 - 5, 2.8, 10);
      c.fillRect(w / 2 - 5, h / 2 - 1.4, 10, 2.8);
    });

    // A loot box: a crate with a lid, tinted per tier by the scene.
    this.place('lootBox', 120, 96, (c, w, h) => {
      const cx = w / 2;
      this.rr(c, cx - 44, 30, 88, h - 40, 3, '#ffffff');
      c.fillStyle = 'rgba(0,0,0,0.22)';
      c.fillRect(cx - 44, 30, 88, 8);
      c.fillRect(cx - 6, 38, 12, h - 48);
      // lid, cracked open
      c.save();
      c.translate(cx, 32);
      c.rotate(-0.24);
      this.rr(c, -46, -16, 92, 18, 3, '#ffffff');
      c.fillStyle = 'rgba(255,255,255,0.55)';
      c.fillRect(-46, -16, 92, 5);
      c.restore();
      // light escaping the seam
      const g = c.createLinearGradient(0, 20, 0, 40);
      g.addColorStop(0, 'rgba(255,255,255,0.85)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(cx - 40, 18, 80, 22);
      // corner brackets
      c.fillStyle = 'rgba(0,0,0,0.3)';
      for (const sx of [-1, 1]) c.fillRect(cx + sx * 40 - 3, 34, 6, h - 46);
    });
  }

  // ---------- UI ----------
  private paintUI(): void {
    // 9-slice bases (corner radius 14 design px → slice inset 16)
    this.place('panelDark', 48, 48, (c, w, h) => {
      this.rr(c, 1.4, 1.4, w - 2.8, h - 2.8, 5, 'rgba(13,14,17,0.94)');
      c.strokeStyle = P.concrete; c.lineWidth = 2;
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


    // ── floor-map node icons ──
    icon('iconEntry', (c, w, h) => {
      c.strokeStyle = '#ffffff'; c.lineWidth = 3.4;
      c.beginPath(); c.moveTo(w / 2, 5); c.lineTo(w / 2, h - 12); c.stroke();
      this.poly(c, [w / 2 - 7, h - 16, w / 2 + 7, h - 16, w / 2, h - 6], '#ffffff');
      c.fillRect(6, h - 5, w - 12, 3.4);
    });
    icon('iconTunnel', (c, w, h) => {
      // an arched mouth with the dark going back into it
      c.strokeStyle = '#ffffff'; c.lineWidth = 3.2;
      c.beginPath();
      c.moveTo(5, h - 5); c.lineTo(5, 15);
      c.arc(w / 2, 15, w / 2 - 5, Math.PI, 0);
      c.lineTo(w - 5, h - 5);
      c.stroke();
      c.globalAlpha = 0.45;
      c.beginPath();
      c.moveTo(11, h - 5); c.lineTo(11, 17);
      c.arc(w / 2, 17, w / 2 - 11, Math.PI, 0);
      c.lineTo(w - 11, h - 5);
      c.stroke();
      c.globalAlpha = 1;
    });
    icon('iconNest', (c, w, h) => {
      // a cluster: several small things, one bigger thing
      this.dot(c, w / 2, h / 2 - 3, 7, '#ffffff');
      this.dot(c, 8, h - 9, 4.4, '#ffffff');
      this.dot(c, w - 8, h - 9, 4.4, '#ffffff');
      this.dot(c, w / 2, h - 6, 4, '#ffffff');
      c.globalCompositeOperation = 'destination-out';
      this.dot(c, w / 2 - 2.6, h / 2 - 4, 1.8, '#000');
      this.dot(c, w / 2 + 2.6, h / 2 - 4, 1.8, '#000');
      c.globalCompositeOperation = 'source-over';
    });
    icon('iconBox', (c, w, h) => {
      this.rr(c, 5, 11, w - 10, h - 16, 2, '#ffffff');
      c.globalCompositeOperation = 'destination-out';
      c.fillRect(w / 2 - 2.6, 11, 5.2, h - 16);
      c.fillRect(5, 17, w - 10, 3);
      c.globalCompositeOperation = 'source-over';
      this.rr(c, 3, 6, w - 6, 8, 2, '#ffffff');
    });
    icon('iconSafe', (c, w, h) => {
      // a shield, because the only safe thing down here is a locked door
      c.beginPath();
      c.moveTo(w / 2, 4);
      c.lineTo(w - 6, 10);
      c.lineTo(w - 6, h / 2 + 2);
      c.quadraticCurveTo(w - 6, h - 5, w / 2, h - 3);
      c.quadraticCurveTo(6, h - 5, 6, h / 2 + 2);
      c.lineTo(6, 10);
      c.closePath();
      c.fillStyle = '#ffffff'; c.fill();
      c.globalCompositeOperation = 'destination-out';
      c.fillRect(w / 2 - 2.6, 11, 5.2, 13);
      c.fillRect(w / 2 - 6.4, 14.8, 12.8, 5.2);
      c.globalCompositeOperation = 'source-over';
    });
    icon('iconBoss', (c, w) => {
      // a skull, kept blocky so it survives being drawn at 25px
      this.rr(c, 6, 5, w - 12, 17, 4, '#ffffff');
      this.rr(c, 10, 21, w - 20, 6, 2, '#ffffff');
      c.globalCompositeOperation = 'destination-out';
      this.rr(c, 9.5, 10, 5.5, 6, 1.6, '#000');
      this.rr(c, w - 15, 10, 5.5, 6, 1.6, '#000');
      c.fillRect(w / 2 - 1.4, 22, 2.8, 5);
      c.globalCompositeOperation = 'source-over';
    });
    icon('iconStairs', (c, w, h) => {
      // three descending treads, read left-to-right as going down
      c.fillStyle = '#ffffff';
      for (let i = 0; i < 3; i++) {
        c.fillRect(5 + i * 7.5, 8 + i * 7, 8.5, 3.4);
        c.fillRect(5 + i * 7.5, 8 + i * 7, 3.4, 7 + (2 - i) * 0);
      }
      c.fillRect(5, h - 6, w - 10, 3.4);
    });
    icon('iconParty', (c, w, h) => {
      this.dot(c, w / 2, 9, 4.6, '#ffffff');
      this.rr(c, w / 2 - 5.4, 14, 10.8, 11, 3, '#ffffff');
      this.dot(c, 8, 13, 3.8, '#ffffff');
      this.rr(c, 3.6, 17, 8.8, 9, 3, '#ffffff');
      this.dot(c, w - 8, 13, 3.8, '#ffffff');
      this.rr(c, w - 12.4, 17, 8.8, 9, 3, '#ffffff');
      void h;
    });
    // ── ability icons ──
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
    icon('iconRally', (c, w, h) => {
      // two chevrons up plus a base line: pull them back into formation
      c.strokeStyle = '#ffffff'; c.lineWidth = 4;
      c.beginPath();
      c.moveTo(7, 15); c.lineTo(w / 2, 6); c.lineTo(w - 7, 15);
      c.moveTo(7, 24); c.lineTo(w / 2, 15); c.lineTo(w - 7, 24);
      c.stroke();
      c.fillStyle = '#ffffff';
      c.fillRect(6, h - 5, w - 12, 3.2);
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

    // The show's bug: a stair going down, framed like a broadcast logo.
    this.place('emblem', 120, 96, (c, w, h) => {
      // outer frame with clipped corners
      c.strokeStyle = P.sys; c.lineWidth = 3;
      c.beginPath();
      c.moveTo(14, 6); c.lineTo(w - 6, 6); c.lineTo(w - 6, h - 14);
      c.lineTo(w - 14, h - 6); c.lineTo(6, h - 6); c.lineTo(6, 14);
      c.closePath(); c.stroke();
      // descending treads
      c.fillStyle = P.bone;
      for (let i = 0; i < 4; i++) {
        c.fillRect(22 + i * 17, 24 + i * 13, 20, 5);
        c.fillRect(22 + i * 17, 24 + i * 13, 5, 13);
      }
      // the dark the stair goes into
      c.fillStyle = P.pit;
      this.poly(c, [w - 20, h - 20, w - 12, h - 20, w - 12, h - 12, w - 20, h - 12], P.pit);
      // a live dot, top-left, because it is always filming
      this.dot(c, 16, 16, 4.4, P.trapRed);
      c.fillStyle = 'rgba(181,64,46,0.35)';
      c.beginPath(); c.arc(16, 16, 8, 0, Math.PI * 2); c.fill();
      // signal ticks along the bottom edge
      c.fillStyle = P.sysBright;
      for (let i = 0; i < 5; i++) c.fillRect(20 + i * 7, h - 12, 3, 2 + i * 1.6);
    });
  }
}
