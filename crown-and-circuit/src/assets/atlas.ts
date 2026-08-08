import { CanvasSource, Rectangle, Texture } from 'pixi.js';
import { CONFIG } from '../config';
import { outlineOf, Px, ramp } from './pixel';
import {
  bossSprite, bruteSprite, coinSprite, enemyProjSprite, flashOf, flyerSprite,
  keepSprite, projSprite, runnerSprite, shardSprite, shooterSprite,
  towerSprite, unitSprite, wallSprite,
} from './sprites';

/**
 * The whole sprite sheet, painted with Canvas2D at boot onto ONE 2048×2048
 * canvas and carved into named frames.
 *
 * Frames are packed in canvas pixels but handed to Pixi divided by S, because
 * Pixi builds UVs as `frame.x / source.width` where source.width is the
 * resolution-divided logical width. Dividing keeps frames in design units, so
 * every texture's natural size is its world-unit size.
 */
const S = 2;
const PAD = 4;
const SIZE = 2048;
/** world units per art pixel — the chunk size of the whole game */
export const PX = 2;

type DrawFn = (c: CanvasRenderingContext2D, w: number, h: number) => void;
const hex = (n: number): string => '#' + n.toString(16).padStart(6, '0');

export class GameAtlas {
  canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private source!: CanvasSource;
  frames: Record<string, Texture> = {};
  readonly digitAdvance = 24;

  private shelfX = PAD;
  private shelfY = PAD;
  private shelfH = 0;
  private pending: [string, Rectangle][] = [];

  private constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
    this.ctx = this.canvas.getContext('2d')!;
  }

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
  has(name: string): boolean { return !!this.frames[name]; }

  private place(name: string, wDesign: number, hDesign: number, draw: DrawFn): void {
    const w = Math.ceil(wDesign) * S;
    const h = Math.ceil(hDesign) * S;
    if (this.shelfX + w + PAD > SIZE) {
      this.shelfX = PAD;
      this.shelfY += this.shelfH + PAD;
      this.shelfH = 0;
    }
    if (this.shelfY + h + PAD > SIZE) throw new Error('atlas overflow: ' + name);
    const x = this.shelfX;
    const y = this.shelfY;
    this.shelfX += w + PAD;
    this.shelfH = Math.max(this.shelfH, h);

    const c = this.ctx;
    c.save();
    c.beginPath();
    c.rect(x, y, w, h);
    c.clip();
    c.setTransform(S, 0, 0, S, x, y);
    draw(c, Math.ceil(wDesign), Math.ceil(hDesign));
    c.restore();
    c.setTransform(1, 0, 0, 1, 0, 0);
    this.pending.push([name, new Rectangle(x, y, w, h)]);
  }

  /**
   * Place a pixel-art sprite. The art grid is blown up by PX world units per
   * art pixel, so the sprite's world size is (artW*PX) × (artH*PX).
   */
  private placePx(name: string, px: Px): void {
    this.place(name, px.w * PX, px.h * PX, (c) => {
      c.imageSmoothingEnabled = false;
      px.blit(c, PX);
    });
  }

  private finalize(): void {
    // nearest: pixel art must not be smoothed, or the whole style collapses
    this.source = new CanvasSource({ resource: this.canvas, resolution: S, scaleMode: 'nearest' });
    for (const [name, r] of this.pending) {
      this.frames[name] = new Texture({
        source: this.source,
        frame: new Rectangle(r.x / S, r.y / S, r.width / S, r.height / S),
      });
    }
  }

  // ---------- drawing helpers (design units) ----------
  private rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string): void {
    c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = fill; c.fill();
  }
  private poly(c: CanvasRenderingContext2D, pts: number[], fill: string): void {
    c.beginPath(); c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.closePath(); c.fillStyle = fill; c.fill();
  }
  private dot(c: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string): void {
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = fill; c.fill();
  }
  // ================= painting =================
  private paintAll(): void {
    this.ctx.clearRect(0, 0, SIZE, SIZE);
    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';
    this.paintUnits();
    this.paintCreatures();
    this.paintFort();
    this.paintShots();
    this.paintLoot();
    this.paintParticles();
    this.paintDigits();
    this.paintIcons();
    this.finalize();
  }

  /** Kings and soldiers: one generator, re-dressed per era and tier. */
  private paintUnits(): void {
    for (let e = 0; e < 5; e++) {
      const pal = CONFIG.palettes[e];
      this.placePx('king' + e, unitSprite({
        cloth: ramp(pal.accent2),
        metal: ramp(pal.stone),
        accent: pal.accent,
        helm: e >= 2 ? 3 : 0,
        era: e,
        royal: true,
        cape: pal.accent,
      }));
      // three tiers: levy, drilled, elite
      for (let t = 0; t < 3; t++) {
        this.placePx(`sol${e}_${t}`, unitSprite({
          cloth: ramp(t === 0 ? pal.wood : t === 1 ? pal.stoneDark : pal.accent2),
          metal: ramp(pal.stone),
          accent: pal.accent,
          helm: t === 0 ? 1 : t === 1 ? 2 : 3,
          era: e,
          cape: t >= 2 ? pal.accent : undefined,
        }));
      }
    }
    this.placePx('solW', flashOf(unitSprite({
      cloth: ramp(0x888888), metal: ramp(0xaaaaaa), accent: 0xffffff, helm: 2, era: 0,
    })));
  }

  /** The horde. One silhouette per archetype, tinted to the era at runtime. */
  private paintCreatures(): void {
    // Drawn in neutral grey, not white: tinting is multiplicative, so a white
    // base would leave the highlight ramp with no headroom and the shading
    // would flatten out the moment an era colour was applied.
    const white = 0xd2d2d2;
    const mk = (name: string, px: Px): void => {
      this.placePx(name, px);
      this.placePx(name + 'W', flashOf(px));
    };
    mk('e_runner', runnerSprite(white));
    mk('e_brute', bruteSprite(white));
    mk('e_shooter', shooterSprite(white));
    mk('e_flyer', flyerSprite(white, true));
    this.placePx('e_flyer1', flyerSprite(white, false));
    this.placePx('e_flyerW', flashOf(flyerSprite(white, true)));
    mk('e_boss', bossSprite(white, 0xffd06a));
  }

  /** Keep, towers, walls, pads. */
  private paintFort(): void {
    for (let e = 0; e < 5; e++) {
      this.placePx('keep' + e, keepSprite(e));
      this.placePx('tower' + e, towerSprite(e));
      this.placePx('wall' + e, wallSprite(e));
    }

    // barracks and forge share a footprint, tinted per era at runtime
    const barracks = new Px(20, 18);
    {
      const st = ramp(0xb8b0a0);
      const wd = ramp(0x7a5533);
      barracks.rect(1, 6, 18, 11, wd.base);
      barracks.rect(1, 6, 18, 1, wd.light);
      barracks.rect(1, 16, 18, 1, wd.dark);
      for (let i = 0; i < 5; i++) barracks.rect(2 + i * 4, 7, 1, 9, wd.dark);
      barracks.rect(0, 2, 20, 5, st.base);        // roof
      barracks.rect(0, 2, 20, 1, st.light);
      barracks.rect(8, 11, 4, 6, ramp(0x3a3128).base);   // door
      barracks.outline(0x14131a);
    }
    this.placePx('barracks', barracks);

    const forge = new Px(20, 18);
    {
      const st = ramp(0x9a938a);
      forge.rect(1, 6, 18, 11, st.base);
      forge.rect(1, 6, 18, 1, st.light);
      forge.rect(1, 16, 18, 1, st.dark);
      forge.rect(13, 0, 5, 7, st.dark);           // chimney
      forge.rect(13, 0, 5, 1, st.light);
      forge.ellipse(7, 13, 4, 3.4, 0x2a2320);     // forge mouth
      forge.ellipse(7, 14, 3, 2.2, 0xff9a3c);
      forge.ellipse(7, 14, 1.6, 1.2, 0xffe08a);
      forge.outline(0x14131a);
    }
    this.placePx('forge', forge);

    const rubble = new Px(16, 10);
    {
      const st = ramp(0x8b857c);
      for (let i = 0; i < 8; i++) {
        const x = 1 + ((i * 5) % 12);
        const y = 4 + ((i * 3) % 5);
        rubble.rect(x, y, 2 + (i % 2), 2, i % 2 ? st.base : st.dark);
      }
      rubble.outline(0x14131a);
    }
    this.placePx('rubble', rubble);

    // build pad: a dashed ring, drawn as pixels so it matches everything else
    const pad = new Px(30, 30);
    for (let a = 0; a < 64; a++) {
      if ((a >> 2) % 2 === 0) continue;
      const th = (a / 64) * Math.PI * 2;
      pad.set(15 + Math.cos(th) * 12.5, 15 + Math.sin(th) * 12.5, 0xffffff);
      pad.set(15 + Math.cos(th) * 11.5, 15 + Math.sin(th) * 11.5, 0xffffff);
    }
    this.placePx('pad', pad);

    this.place('padGlow', 90, 90, (c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, 6, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,0.5)');
      g.addColorStop(0.6, 'rgba(255,255,255,0.14)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    });
  }

  private paintShots(): void {
    for (let e = 0; e < 5; e++) this.placePx('p' + e, projSprite(e, 0xffffff));
    this.placePx('pEnemy', enemyProjSprite(0xffffff));
  }

  private paintLoot(): void {
    this.placePx('coin', coinSprite());
    this.placePx('shard', shardSprite());
  }

  private paintParticles(): void {
    this.place('dot', 14, 14, (c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, 0.5, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.55, 'rgba(255,255,255,0.5)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    });
    {
      const chip = new Px(4, 4);
      chip.rect(0, 1, 3, 2, 0xffffff);
      chip.set(1, 0, 0xffffff);
      chip.outline(outlineOf(0x888888));
      this.placePx('chip', chip);
    }
    this.place('smoke', 24, 24, (c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,0.75)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    });
    this.place('ring', 64, 64, (c, w, h) => {
      c.strokeStyle = '#ffffff'; c.lineWidth = 4;
      c.beginPath(); c.arc(w / 2, h / 2, 27, 0, Math.PI * 2); c.stroke();
    });
    this.place('spark', 5, 16, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(w / 2 - 1.2, 0, 2.4, h);
    });
  }

  private paintDigits(): void {
    const w = 30;
    const h = 42;
    for (const ch of '0123456789/+-%x.') {
      this.place('d_' + ch, w, h, (c) => {
        c.font = `800 ${34}px Inter, system-ui, sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.lineJoin = 'round';
        c.strokeStyle = 'rgba(0,0,0,0.85)';
        c.lineWidth = 6;
        c.strokeText(ch, w / 2, h / 2 + 1);
        c.fillStyle = '#ffffff';
        c.fillText(ch, w / 2, h / 2 + 1);
      });
    }
  }

  private paintIcons(): void {
    const icon = (name: string, d: DrawFn): void => this.place(name, 32, 32, d);
    icon('iPause', (c, w, h) => {
      this.rr(c, 7, 6, 6.5, h - 12, 2.4, '#ffffff');
      this.rr(c, w - 13.5, 6, 6.5, h - 12, 2.4, '#ffffff');
    });
    icon('iPlay', (c, w, h) => this.poly(c, [9, 5, w - 6, h / 2, 9, h - 5], '#ffffff'));
    icon('iRestart', (c, w, h) => {
      c.strokeStyle = '#ffffff'; c.lineWidth = 4;
      c.beginPath(); c.arc(w / 2, h / 2, 9.5, -0.4, Math.PI * 1.5); c.stroke();
      this.poly(c, [w / 2 + 6, 4.4, w / 2 + 14, 8.4, w / 2 + 6.6, 13.4], '#ffffff');
    });
    icon('iHome', (c, w, h) => {
      this.poly(c, [w / 2, 4, w - 5, 14, 5, 14], '#ffffff');
      this.rr(c, 8, 14, w - 16, h - 20, 2, '#ffffff');
      c.save(); c.globalCompositeOperation = 'destination-out';
      c.fillStyle = '#000'; c.fillRect(w / 2 - 3, 18, 6, 8); c.restore();
    });
    icon('iGear', (c, w, h) => {
      const cx = w / 2;
      const cy = h / 2;
      c.fillStyle = '#ffffff';
      for (let i = 0; i < 8; i++) {
        c.save(); c.translate(cx, cy); c.rotate((i * Math.PI) / 4);
        c.fillRect(-2.6, -13.4, 5.2, 7); c.restore();
      }
      this.dot(c, cx, cy, 8.6, '#ffffff');
      c.save(); c.globalCompositeOperation = 'destination-out';
      this.dot(c, cx, cy, 4, '#000'); c.restore();
    });
    icon('iClose', (c, w, h) => {
      c.strokeStyle = '#ffffff'; c.lineWidth = 4.6;
      c.beginPath(); c.moveTo(7, 7); c.lineTo(w - 7, h - 7);
      c.moveTo(w - 7, 7); c.lineTo(7, h - 7); c.stroke();
    });
    icon('iLock', (c, w, h) => {
      c.strokeStyle = '#ffffff'; c.lineWidth = 3.6;
      c.beginPath(); c.arc(w / 2, 12, 6.4, Math.PI, 0); c.stroke();
      this.rr(c, 6.5, 12, w - 13, h - 18, 3.4, '#ffffff');
    });
    icon('iCheck', (c, w, h) => {
      c.strokeStyle = '#ffffff'; c.lineWidth = 5;
      c.beginPath(); c.moveTo(6, h / 2); c.lineTo(w / 2 - 2, h - 8); c.lineTo(w - 6, 8); c.stroke();
    });
    icon('iSword', (c, w, h) => {
      c.fillStyle = '#ffffff';
      c.fillRect(w / 2 - 2.4, 4, 4.8, h - 12);
      c.fillRect(w / 2 - 8, h - 12, 16, 3.4);
      c.fillRect(w / 2 - 3.4, h - 8, 6.8, 5);
    });
    icon('iTower', (c, w, h) => {
      this.rr(c, w / 2 - 9, 12, 18, h - 14, 2, '#ffffff');
      for (let i = 0; i < 3; i++) c.fillStyle = '#ffffff', c.fillRect(w / 2 - 9 + i * 7, 6, 5, 7);
    });
    icon('iHeart', (c, w, h) => {
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.moveTo(w / 2, h - 6);
      c.bezierCurveTo(-2, h / 2, 6, 2, w / 2, 10);
      c.bezierCurveTo(w - 6, 2, w + 2, h / 2, w / 2, h - 6);
      c.fill();
    });
    icon('iBolt', (c, w, h) => this.poly(c, [w / 2 + 4, 3, 8, h / 2 + 2, w / 2 - 1, h / 2 + 2, w / 2 - 4, h - 3, w - 8, h / 2 - 2, w / 2 + 1, h / 2 - 2], '#ffffff'));
    icon('iWave', (c, w, h) => {
      c.strokeStyle = '#ffffff'; c.lineWidth = 3;
      for (let k = 0; k < 3; k++) {
        c.beginPath();
        c.arc(w / 2, h - 4, 7 + k * 7, Math.PI * 1.15, Math.PI * 1.85);
        c.stroke();
      }
    });
    this.place('iStar', 40, 40, (c, w, h) => {
      const cx = w / 2;
      const cy = h / 2 + 2;
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 18 : 8.4;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
      }
      c.closePath(); c.fillStyle = '#ffffff'; c.fill();
    });
    // floating joystick chrome
    this.place('stickBase', 120, 120, (c, w, h) => {
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 3;
      c.beginPath(); c.arc(w / 2, h / 2, 52, 0, Math.PI * 2); c.stroke();
    });
    this.place('stickKnob', 60, 60, (c, w, h) => {
      c.fillStyle = 'rgba(255,255,255,0.5)';
      c.beginPath(); c.arc(w / 2, h / 2, 24, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 3;
      c.beginPath(); c.arc(w / 2, h / 2, 24, 0, Math.PI * 2); c.stroke();
    });
    // 9-slice UI chrome
    this.place('panel', 48, 48, (c, w, h) => {
      this.rr(c, 1.4, 1.4, w - 2.8, h - 2.8, 12, 'rgba(22,24,29,0.95)');
      c.strokeStyle = 'rgba(154,160,168,0.75)'; c.lineWidth = 2;
      c.beginPath(); c.roundRect(1.4, 1.4, w - 2.8, h - 2.8, 12); c.stroke();
    });
    this.place('btnGold', 48, 48, (c, w, h) => {
      this.rr(c, 1.4, 3, w - 2.8, h - 4.4, 12, hex(CONFIG.colors.warn));
      this.rr(c, 1.4, 1.4, w - 2.8, h - 5.8, 12, hex(CONFIG.colors.gold));
    });
    this.place('btnBlue', 48, 48, (c, w, h) => {
      this.rr(c, 1.4, 3, w - 2.8, h - 4.4, 12, '#1d3a52');
      this.rr(c, 1.4, 1.4, w - 2.8, h - 5.8, 12, '#2c5a7d');
    });
  }
}
