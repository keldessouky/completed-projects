import { Container, Graphics, NineSliceSprite, Rectangle, Sprite, Text } from 'pixi.js';
import { CONFIG } from '../config';
import { FONT_DISPLAY, FONT_UI } from '../assets/fonts';
import type { Ctx } from '../core/game';

/** Cinzel display text (headers, titles). */
export function displayText(text: string, size: number, color: number = CONFIG.colors.bone, weight: '700' | '900' = '700'): Text {
  const t = new Text({
    text,
    style: {
      fontFamily: FONT_DISPLAY, fontSize: size, fontWeight: weight, fill: color,
      align: 'center', letterSpacing: size > 30 ? 2 : 1,
    },
  });
  t.anchor.set(0.5);
  return t;
}

/** Inter body/UI text. */
export function uiText(text: string, size: number, color: number = CONFIG.colors.bone, weight: '400' | '600' | '800' = '400', wrap = 0): Text {
  const t = new Text({
    text,
    style: {
      fontFamily: FONT_UI, fontSize: size, fontWeight: weight, fill: color, align: 'center',
      ...(wrap > 0 ? { wordWrap: true, wordWrapWidth: wrap } : {}),
    },
  });
  t.anchor.set(0.5);
  return t;
}

export function panel(ctx: Ctx, w: number, h: number): NineSliceSprite {
  const p = new NineSliceSprite({
    texture: ctx.atlas.get('panelDark'),
    leftWidth: 16, rightWidth: 16, topHeight: 16, bottomHeight: 16,
  });
  p.width = w; p.height = h;
  p.position.set(-w / 2, -h / 2);
  return p;
}

/** Horizontal meter (boss HP, progress). Redraws only when the value moves. */
export class Bar extends Container {
  private fill = new Graphics();
  private frac = -1;

  constructor(private w: number, private h: number, private color: number, backAlpha = 0.55) {
    super();
    const back = new Graphics();
    back.roundRect(-w / 2, -h / 2, w, h, h / 2).fill({ color: CONFIG.colors.pit, alpha: backAlpha });
    back.roundRect(-w / 2, -h / 2, w, h, h / 2).stroke({ color: CONFIG.colors.boneDim, width: 1.5, alpha: 0.8 });
    this.addChild(back, this.fill);
    this.set(1);
  }

  set(frac: number): void {
    const f = Math.max(0, Math.min(1, frac));
    if (Math.abs(f - this.frac) < 0.003) return;
    this.frac = f;
    this.fill.clear();
    if (f <= 0.004) return;
    const pad = 2.5;
    const w = (this.w - pad * 2) * f;
    this.fill.roundRect(-this.w / 2 + pad, -this.h / 2 + pad, Math.max(this.h - pad * 2, w), this.h - pad * 2, (this.h - pad * 2) / 2)
      .fill(this.color);
  }
}

/** 0-3 stars, filled vs hollow — used on map nodes and results. */
export class StarsRow extends Container {
  constructor(ctx: Ctx, earned: number, size: number, gap = 6) {
    super();
    for (let i = 0; i < 3; i++) {
      const s = new Sprite(ctx.atlas.get('iconStar'));
      s.anchor.set(0.5);
      s.width = size; s.height = size;
      s.x = (i - 1) * (size + gap);
      // middle star sits proud, shrine-pediment style
      s.y = i === 1 ? -size * 0.14 : 0;
      s.tint = i < earned ? CONFIG.colors.amber : CONFIG.colors.starEmpty;
      this.addChild(s);
    }
  }
}

/** Settings toggle: a labelled pill that flips state. */
export class Toggle extends Container {
  private knob = new Graphics();
  private track = new Graphics();

  constructor(ctx: Ctx, public value: boolean, private onChange: (v: boolean) => void) {
    super();
    const w = 64, h = 34;
    this.track.roundRect(-w / 2, -h / 2, w, h, h / 2).fill(CONFIG.colors.pitLift)
      .stroke({ color: CONFIG.colors.boneDim, width: 2 });
    this.addChild(this.track, this.knob);
    this.hitArea = new Rectangle(-w / 2 - 8, -30, w + 16, 60);
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointertap', () => {
      this.value = !this.value;
      ctx.audio.play('uiTap');
      this.draw();
      this.onChange(this.value);
    });
    this.draw();
  }

  private draw(): void {
    this.knob.clear();
    this.knob.circle(this.value ? 15 : -15, 0, 12.5)
      .fill(this.value ? CONFIG.colors.amber : CONFIG.colors.boneDim);
    this.track.tint = this.value ? 0xffffff : 0x888888;
  }
}

/** Settings slider 0..1 with a wide grab area (volume, shake intensity). */
export class HSlider extends Container {
  private knob = new Graphics();
  private fill = new Graphics();
  private dragging = false;

  constructor(
    private ctx: Ctx,
    private w: number,
    public value: number,
    private onChange: (v: number) => void,
    private onCommit?: () => void,
  ) {
    super();
    const track = new Graphics();
    track.roundRect(-w / 2, -5, w, 10, 5).fill(CONFIG.colors.pitLift)
      .stroke({ color: CONFIG.colors.boneDim, width: 2 });
    this.addChild(track, this.fill, this.knob);
    this.knob.circle(0, 0, 15).fill(CONFIG.colors.bone).stroke({ color: CONFIG.colors.rustDeep, width: 3 });
    this.hitArea = new Rectangle(-w / 2 - 18, -30, w + 36, 60);
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointerdown', (e) => { this.dragging = true; this.seek(e.global.x); });
    this.on('globalpointermove', (e) => { if (this.dragging) this.seek(e.global.x); });
    const stop = (): void => {
      if (!this.dragging) return;
      this.dragging = false;
      this.ctx.audio.play('uiTap');
      this.onCommit?.();
    };
    this.on('pointerup', stop);
    this.on('pointerupoutside', stop);
    this.draw();
  }

  private seek(globalX: number): void {
    const local = this.toLocal({ x: globalX, y: 0 });
    this.value = Math.max(0, Math.min(1, (local.x + this.w / 2) / this.w));
    this.draw();
    this.onChange(this.value);
  }

  private draw(): void {
    const x = -this.w / 2 + this.value * this.w;
    this.knob.position.set(x, 0);
    this.fill.clear();
    if (this.value > 0.02) {
      this.fill.roundRect(-this.w / 2 + 2, -3, (this.w - 4) * this.value, 6, 3).fill(CONFIG.colors.amber);
    }
  }
}
