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

    this.paintHeroAndSquad();
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
  /** one row of kaunakes scallops */
  private scallops(c: CanvasRenderingContext2D, x: number, y: number, w: number, n: number, r: number, fill: string): void {
    c.beginPath();
    const step = w / n;
    for (let i = 0; i < n; i++) c.arc(x + step * (i + 0.5), y, r, 0, Math.PI);
    c.fillStyle = fill;
    c.fill();
  }
  /** cuneiform wedge: dir 0=down,1=right,2=diag */
  private wedge(c: CanvasRenderingContext2D, x: number, y: number, s: number, dir: number, fill: string): void {
    c.save();
    c.translate(x, y);
    c.rotate(dir === 0 ? 0 : dir === 1 ? -Math.PI / 2 : Math.PI / 4);
    this.poly(c, [-s * 0.42, 0, s * 0.42, 0, 0, s], fill);
    c.fillRect(-s * 0.1, -s * 0.55, s * 0.2, s * 0.6);
    c.restore();
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

  // ---------- hero + squad ----------
  private paintHeroAndSquad(): void {
    // Hero: bow-armed en-priest in tiered kaunakes, seen from behind-above.
    this.place('hero', 48, 56, (c, w) => {
      const cx = w / 2;
      // bow arc held forward (top of frame)
      c.strokeStyle = P.gold;
      c.lineWidth = 2.6;
      c.beginPath();
      c.arc(cx, 15, 16, Math.PI * 1.12, Math.PI * 1.88);
      c.stroke();
      c.strokeStyle = P.bone;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(cx - 14.8, 9.6); c.lineTo(cx + 14.8, 9.6);
      c.stroke();
      // kaunakes skirt: three scallop tiers, widening downward
      this.rr(c, cx - 13, 26, 26, 24, 6, P.boneDim);
      this.scallops(c, cx - 12, 34, 24, 6, 2.6, P.bone);
      this.scallops(c, cx - 13, 41, 26, 6, 3, P.boneDim);
      this.scallops(c, cx - 14, 49, 28, 7, 3, P.bone);
      c.fillStyle = P.gold; c.fillRect(cx - 13, 26, 26, 2.4); // gold hem
      // shoulders + arms reaching to the bow
      this.rr(c, cx - 12, 16, 24, 12, 5, P.ochre);
      this.poly(c, [cx - 10, 18, cx - 15, 10, cx - 11.4, 8.6, cx - 6, 17], P.skin);
      this.poly(c, [cx + 10, 18, cx + 15, 10, cx + 11.4, 8.6, cx + 6, 17], P.skin);
      // quiver across the back
      c.save(); c.translate(cx + 8, 24); c.rotate(0.5);
      this.rr(c, -3, -8, 6, 16, 2, P.ochreDeep);
      c.fillStyle = P.gold; c.fillRect(-3, -8, 6, 2); c.restore();
      // head with the horned cap of office
      this.dot(c, cx, 12, 6.4, P.skin);
      c.fillStyle = P.gold;
      c.beginPath(); c.arc(cx, 11.4, 6.6, Math.PI, 0); c.fill();
      c.fillRect(cx - 7.6, 9.6, 15.2, 2.2);
      this.dot(c, cx - 7.4, 9.4, 1.6, P.goldBright);
      this.dot(c, cx + 7.4, 9.4, 1.6, P.goldBright);
    });

    // Squad tiers: reed-spear militia. Silhouette constant; regalia climbs.
    const unit = (tier: number): DrawFn => (c, w) => {
      const cx = w / 2;
      // spear
      c.strokeStyle = tier >= 2 ? P.gold : P.bone;
      c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(cx + 6, 30); c.lineTo(cx + 6, 3); c.stroke();
      this.poly(c, [cx + 6 - 2.2, 5, cx + 6 + 2.2, 5, cx + 6, 0], tier >= 2 ? P.goldBright : P.boneDim);
      // cloak (T4) reads as a lapis wedge behind the body
      if (tier >= 3) this.poly(c, [cx - 9, 16, cx + 7, 16, cx + 4, 32, cx - 6, 32], P.lapis);
      // tunic
      this.rr(c, cx - 7, 14, 14, 14, 4, tier >= 1 ? P.ochre : P.boneDim);
      this.scallops(c, cx - 6.4, 26, 12.8, 4, 1.9, P.bone);
      // shield (T1+)
      if (tier >= 1) this.dot(c, cx - 7, 20, 4.6, tier >= 3 ? P.gold : P.ochreDeep);
      if (tier >= 1) this.dot(c, cx - 7, 20, 2, P.bone);
      // head; helmet from T2
      this.dot(c, cx, 9.6, 4.6, P.skin);
      if (tier >= 2) {
        c.fillStyle = tier >= 3 ? P.goldBright : P.gold;
        c.beginPath(); c.arc(cx, 9.2, 4.8, Math.PI, 0); c.fill();
        if (tier >= 3) this.poly(c, [cx - 1.4, 4.6, cx + 1.4, 4.6, cx, 1.2], P.goldBright);
      }
    };
    for (let t = 0; t < 5; t++) this.place('unit' + t, 30, 34, unit(t));
    this.whiteVariant('unitW', 30, 34, unit(0));
  }

  // ---------- enemies ----------
  private paintEnemies(): void {
    const golem: DrawFn = (c, w) => {
      const cx = w / 2;
      // hulking clay mass with crack lines and ember eyes
      this.rr(c, cx - 18, 22, 36, 30, 9, P.ochreDeep);
      this.rr(c, cx - 21, 26, 10, 22, 4, P.ochre);   // arms
      this.rr(c, cx + 11, 26, 10, 22, 4, P.ochre);
      this.rr(c, cx - 14, 18, 28, 22, 8, P.ochre);   // chest
      this.rr(c, cx - 9, 6, 18, 16, 6, P.ochreDeep); // head
      c.strokeStyle = P.bitumen; c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(cx - 8, 30); c.lineTo(cx - 3, 36); c.lineTo(cx - 6, 43);
      c.moveTo(cx + 9, 24); c.lineTo(cx + 5, 31);
      c.stroke();
      c.fillStyle = P.goldBright;
      c.fillRect(cx - 6, 11, 4, 3); c.fillRect(cx + 2, 11, 4, 3);
      this.scallops(c, cx - 14, 52, 28, 5, 3, P.ochreDeep); // dragging feet
    };
    this.place('golem', 52, 56, golem);
    this.whiteVariant('golemW', 52, 56, golem);

    const scorpion: DrawFn = (c, w, h) => {
      const cx = w / 2;
      // scorpion-man: human torso rising from a wide segmented body
      this.poly(c, [cx - 19, h - 8, cx + 19, h - 8, cx + 12, h - 18, cx - 12, h - 18], P.ochreDeep);
      this.dot(c, cx - 13, h - 8, 3.4, P.ochre); this.dot(c, cx + 13, h - 8, 3.4, P.ochre);
      this.dot(c, cx - 6, h - 8, 3.4, P.ochre); this.dot(c, cx + 6, h - 8, 3.4, P.ochre);
      // tail curling over the left shoulder, stinger gold
      c.strokeStyle = P.ochreDeep; c.lineWidth = 3.4;
      c.beginPath(); c.moveTo(cx - 12, h - 14); c.quadraticCurveTo(cx - 22, h - 26, cx - 13, h - 30); c.stroke();
      this.poly(c, [cx - 15, h - 33, cx - 10, h - 31, cx - 13, h - 26], P.gold);
      // torso + head + raised claws
      this.rr(c, cx - 6, 8, 12, 12, 4, P.skin);
      this.dot(c, cx, 5.6, 4.2, P.skin);
      c.fillStyle = P.bitumen; c.fillRect(cx - 3, 4, 6, 1.6);
      this.poly(c, [cx + 7, 12, cx + 14, 6, cx + 15.4, 9.4, cx + 9, 15], P.ochre);
    };
    this.place('scorpion', 40, 38, scorpion);
    this.whiteVariant('scorpionW', 40, 38, scorpion);

    const anzu = (wingUp: boolean): DrawFn => (c, w) => {
      const cx = w / 2, cy = 22;
      const wy = wingUp ? -10 : 6;
      // storm-bird: lapis wings, lion-gold head — Anzu of the tablets
      this.poly(c, [cx - 4, cy, cx - 25, cy + wy, cx - 22, cy + wy + 7, cx - 3, cy + 6], P.lapis);
      this.poly(c, [cx + 4, cy, cx + 25, cy + wy, cx + 22, cy + wy + 7, cx + 3, cy + 6], P.lapis);
      this.poly(c, [cx - 4, cy, cx - 20, cy + wy + 2, cx - 3, cy + 3], P.lapisBright);
      this.poly(c, [cx + 4, cy, cx + 20, cy + wy + 2, cx + 3, cy + 3], P.lapisBright);
      this.rr(c, cx - 5, cy - 4, 10, 16, 4, P.ochre); // body
      this.poly(c, [cx - 3, cy + 12, cx + 3, cy + 12, cx, cy + 19], P.boneDim); // tail
      this.dot(c, cx, cy - 6, 5, P.gold);           // head
      this.poly(c, [cx - 2.4, cy - 3.4, cx + 2.4, cy - 3.4, cx, cy + 1.4], P.goldBright); // beak
      c.fillStyle = P.bitumen; c.fillRect(cx - 3.2, cy - 8.4, 2.2, 2.2); c.fillRect(cx + 1, cy - 8.4, 2.2, 2.2);
    };
    this.place('anzu0', 52, 44, anzu(true));
    this.place('anzu1', 52, 44, anzu(false));
    this.whiteVariant('anzuW', 52, 44, anzu(true));
  }

  // ---------- boss ----------
  private paintBoss(): void {
    // Ziggurat gate: stepped crown, lapis brick face, black arch mouth.
    this.place('bossGate', 340, 250, (c, w, h) => {
      const cx = w / 2;
      // stepped crown
      c.fillStyle = P.lapisDeep;
      c.fillRect(cx - 170, 54, 340, h - 54);
      c.fillRect(cx - 130, 28, 260, 30);
      c.fillRect(cx - 84, 6, 168, 26);
      // brick courses
      c.strokeStyle = 'rgba(0,0,0,0.28)';
      c.lineWidth = 1.4;
      for (let y = 60; y < h; y += 16) {
        c.beginPath(); c.moveTo(cx - 170, y); c.lineTo(cx + 170, y); c.stroke();
      }
      c.fillStyle = P.lapis;
      c.fillRect(cx - 170, 54, 340, 8);
      c.fillRect(cx - 130, 28, 260, 6);
      c.fillRect(cx - 84, 6, 168, 6);
      // gold frieze with wedges
      c.fillStyle = P.gold;
      c.fillRect(cx - 170, 66, 340, 14);
      for (let i = 0; i < 12; i++) this.wedge(c, cx - 154 + i * 28, 69, 7, i % 3, P.bitumen);
      // gate mouth
      c.beginPath();
      c.moveTo(cx - 62, h);
      c.lineTo(cx - 62, 140);
      c.arc(cx, 140, 62, Math.PI, 0);
      c.lineTo(cx + 62, h);
      c.closePath();
      c.fillStyle = P.bitumen; c.fill();
      c.strokeStyle = P.gold; c.lineWidth = 5; c.stroke();
      // flanking pilasters
      for (const sx of [-1, 1]) {
        c.fillStyle = P.ochre;
        c.fillRect(cx + sx * 150 - 14, 80, 28, h - 80);
        c.fillStyle = P.gold;
        c.fillRect(cx + sx * 150 - 14, 80, 28, 6);
        for (let y = 96; y < h - 8; y += 26) this.wedge(c, cx + sx * 150, y, 8, 0, P.ochreDeep);
      }
    });

    // Lamassu, facing right (left flank; mirror for the right one).
    const lamassu = (awake: boolean): DrawFn => (c, w, h) => {
      const body = awake ? P.boneDim : P.stone;
      const dark = awake ? '#9a8c72' : P.stoneDark;
      const cx = w / 2;
      // wing: folded when stone, lifted when awake
      c.save();
      c.translate(cx - 8, 52);
      c.rotate(awake ? -0.5 : -0.12);
      this.poly(c, [0, 0, -26, -34, -12, -40, 8, -6], awake ? P.lapis : dark);
      this.poly(c, [0, 0, -20, -26, -8, -30, 7, -4], awake ? P.lapisBright : body);
      c.restore();
      // bull body + four legs
      this.rr(c, cx - 26, 52, 56, 34, 10, body);
      for (let i = 0; i < 4; i++) this.rr(c, cx - 24 + i * 14, 80, 9, 32, 3, i % 2 ? dark : body);
      c.fillStyle = dark; c.fillRect(cx - 26, 108, 56, 6); // plinth line
      this.poly(c, [cx + 28, 56, cx + 36, 64, cx + 30, 70], dark); // tail
      // bearded head with horned crown, gazing outward
      this.dot(c, cx + 22, 38, 14, body);
      this.scallops(c, cx + 12, 48, 22, 4, 3.2, dark);            // beard rows
      this.scallops(c, cx + 12, 42, 22, 4, 3.2, awake ? P.bone : body);
      c.fillStyle = awake ? P.gold : dark;
      c.fillRect(cx + 8, 24, 30, 5);                               // crown band
      this.poly(c, [cx + 10, 24, cx + 14, 14, cx + 18, 24], awake ? P.gold : dark);
      this.poly(c, [cx + 26, 24, cx + 30, 14, cx + 34, 24], awake ? P.gold : dark);
      // eyes: dark sockets asleep, burning gold awake
      c.fillStyle = awake ? P.goldBright : P.bitumen;
      c.fillRect(cx + 16, 33, 4.6, 3.2); c.fillRect(cx + 25, 33, 4.6, 3.2);
      if (awake) { c.fillStyle = 'rgba(240,194,104,0.5)'; c.fillRect(cx + 14, 31, 18, 7); }
      void h;
    };
    this.place('lamassuIdle', 96, 118, lamassu(false));
    this.place('lamassuAwake', 96, 118, lamassu(true));
    this.whiteVariant('lamassuW', 96, 118, lamassu(true));

    // shield aura ring (tinted lapis-bright, additive)
    this.place('shieldRing', 140, 140, (c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, 68);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.72, 'rgba(255,255,255,0.85)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    });
  }

  // ---------- gates ----------
  private paintGates(): void {
    // Neutral glazed-brick arch — tinted lapis for buffs, trap-red for traps.
    this.place('gateArch', 210, 128, (c, w, h) => {
      const cx = w / 2;
      // pillars
      for (const sx of [-1, 1]) {
        const px = cx + sx * (w / 2 - 16);
        this.rr(c, px - 12, 26, 24, h - 26, 5, '#cfc4b0');
        c.fillStyle = '#b4a890';
        for (let y = 34; y < h - 8; y += 14) c.fillRect(px - 12, y, 24, 1.6);
        c.fillStyle = '#efe8da';
        c.fillRect(px - 12, 26, 24, 5);
      }
      // arch band
      c.strokeStyle = '#d8cdb9';
      c.lineWidth = 13;
      c.beginPath();
      c.moveTo(16, 34);
      c.quadraticCurveTo(cx, -16, w - 16, 34);
      c.stroke();
      c.strokeStyle = '#efe8da';
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(16, 28);
      c.quadraticCurveTo(cx, -22, w - 16, 28);
      c.stroke();
      // hanging glyph tassels
      for (const sx of [-0.5, 0, 0.5]) this.wedge(c, cx + sx * 60, 16 + Math.abs(sx) * 14, 7, 0, '#efe8da');
    });

    // Inscribed panel that carries the big label (tinted per gate kind).
    this.place('gatePanel', 128, 58, (c, w, h) => {
      this.rr(c, 0, 0, w, h, 10, 'rgba(255,255,255,0.96)');
      c.strokeStyle = 'rgba(0,0,0,0.35)';
      c.lineWidth = 3;
      c.beginPath(); c.roundRect(2, 2, w - 4, h - 4, 8); c.stroke();
    });

    // Colorblind-safe shape marks: chevron-up = blessing, X = trap.
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
    const glyphs = '0123456789×÷+−%';
    for (const ch of glyphs) {
      this.place('d_' + ch, w, h, (c) => {
        c.font = `800 ${ch === '%' ? 30 : 38}px Inter, system-ui, sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.lineJoin = 'round';
        c.strokeStyle = 'rgba(0,0,0,0.9)';
        c.lineWidth = 7;
        c.strokeText(ch, w / 2, h / 2 + 2);
        c.fillStyle = '#ffffff';
        c.fillText(ch, w / 2, h / 2 + 2);
      });
    }
  }

  // ---------- particles, projectiles, items ----------
  private paintParticlesAndItems(): void {
    this.place('arrow', 10, 28, (c, w) => {
      const cx = w / 2;
      c.strokeStyle = P.bone; c.lineWidth = 2.2;
      c.beginPath(); c.moveTo(cx, 6); c.lineTo(cx, 24); c.stroke();
      this.poly(c, [cx - 3.4, 7, cx + 3.4, 7, cx, 0], P.goldBright);
      this.poly(c, [cx - 3.2, 22, cx, 26, cx, 22], P.ochre);
      this.poly(c, [cx + 3.2, 22, cx, 26, cx, 22], P.ochre);
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
    for (let i = 0; i < 3; i++) {
      this.place('glyph' + i, 12, 12, (c, w, h) => this.wedge(c, w / 2, h / 2 - 3, 7, i, '#ffffff'));
    }
    this.place('star4', 20, 20, (c, w, h) => {
      const cx = w / 2, cy = h / 2;
      this.poly(c, [cx, 0, cx + 3, cy - 3, w, cy, cx + 3, cy + 3, cx, h, cx - 3, cy + 3, 0, cy, cx - 3, cy - 3], '#ffffff');
    });

    this.place('coin', 22, 22, (c, w, h) => {
      this.dot(c, w / 2, h / 2, 10, P.ochreDeep);
      this.dot(c, w / 2, h / 2, 8.4, P.gold);
      this.dot(c, w / 2 - 2, h / 2 - 2.4, 3.4, P.goldBright);
      this.wedge(c, w / 2, h / 2 - 3.4, 6, 0, P.ochreDeep);
    });
  }

  // ---------- UI ----------
  private paintUI(): void {
    // 9-slice bases (corner radius 14 design px → slice inset 16)
    this.place('panelDark', 48, 48, (c, w, h) => {
      this.rr(c, 1.4, 1.4, w - 2.8, h - 2.8, 13, 'rgba(24,19,15,0.93)');
      c.strokeStyle = P.boneDim; c.lineWidth = 2;
      c.beginPath(); c.roundRect(1.4, 1.4, w - 2.8, h - 2.8, 13); c.stroke();
    });
    this.place('btnGold', 48, 48, (c, w, h) => {
      this.rr(c, 1.4, 3, w - 2.8, h - 4.4, 13, P.ochreDeep);
      this.rr(c, 1.4, 1.4, w - 2.8, h - 5.8, 13, P.gold);
      c.strokeStyle = P.goldBright; c.lineWidth = 2;
      c.beginPath(); c.roundRect(2.6, 2.6, w - 5.2, h - 8.2, 12); c.stroke();
    });
    this.place('btnBlue', 48, 48, (c, w, h) => {
      this.rr(c, 1.4, 3, w - 2.8, h - 4.4, 13, P.lapisDeep);
      this.rr(c, 1.4, 1.4, w - 2.8, h - 5.8, 13, P.lapis);
      c.strokeStyle = P.lapisBright; c.lineWidth = 2;
      c.beginPath(); c.roundRect(2.6, 2.6, w - 5.2, h - 8.2, 12); c.stroke();
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

    // small ziggurat emblem (title / map)
    this.place('emblem', 120, 96, (c, w, h) => {
      const cx = w / 2;
      c.fillStyle = P.lapis; c.fillRect(cx - 56, h - 26, 112, 26);
      c.fillStyle = P.lapisBright; c.fillRect(cx - 56, h - 26, 112, 5);
      c.fillStyle = P.ochre; c.fillRect(cx - 40, h - 48, 80, 22);
      c.fillStyle = P.gold; c.fillRect(cx - 40, h - 48, 80, 5);
      c.fillStyle = P.goldBright; c.fillRect(cx - 22, h - 66, 44, 18);
      this.rr(c, cx - 7, h - 82, 14, 16, 3, P.bone);           // shrine
      this.poly(c, [cx - 10, h - 82, cx + 10, h - 82, cx, h - 92], P.goldBright);
      // stairway
      c.fillStyle = P.boneDim; c.fillRect(cx - 4, h - 26, 8, 26);
      c.fillStyle = P.bone; c.fillRect(cx - 3, h - 48, 6, 22);
    });
  }
}
