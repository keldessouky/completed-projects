import { Container, NineSliceSprite, Rectangle, Sprite, Text } from 'pixi.js';
import { CONFIG } from '../config';
import { FONT_UI } from '../assets/fonts';
import type { Ctx } from '../core/game';

export interface BtnOpts {
  w: number;
  h: number;
  kind?: 'gold' | 'blue' | 'dark';
  label?: string;
  labelSize?: number;
  labelColor?: number;
  icon?: string;       // atlas frame name
  iconTint?: number;
  iconScale?: number;
  onTap: () => void;
  silent?: boolean;
}

/**
 * The one tappable. 9-slice glazed-brick chrome, pressed-state squash,
 * uiTap sfx, and a hit area padded out to at least 52×52 design px so even
 * letterboxed-down phones keep ≥44 pt targets.
 */
export class Btn extends Container {
  private base: NineSliceSprite;
  private content = new Container();
  enabled = true;

  constructor(private ctx: Ctx, private opts: BtnOpts) {
    super();
    const frame = opts.kind === 'gold' ? 'btnGold' : opts.kind === 'blue' ? 'btnBlue' : 'panel';
    this.base = new NineSliceSprite({
      texture: ctx.atlas.get(frame),
      leftWidth: 16, rightWidth: 16, topHeight: 16, bottomHeight: 16,
    });
    this.base.width = opts.w;
    this.base.height = opts.h;
    this.base.position.set(-opts.w / 2, -opts.h / 2);
    this.addChild(this.base, this.content);

    if (opts.icon) {
      const ic = new Sprite(ctx.atlas.get(opts.icon));
      ic.anchor.set(0.5);
      ic.tint = opts.iconTint ?? CONFIG.colors.ink;
      ic.scale.set(opts.iconScale ?? 1);
      this.content.addChild(ic);
    }
    if (opts.label) {
      const t = new Text({
        text: opts.label,
        style: {
          fontFamily: FONT_UI,
          fontSize: opts.labelSize ?? 19,
          fontWeight: '600',
          fill: opts.labelColor ?? (opts.kind === 'gold' ? CONFIG.colors.bg : CONFIG.colors.ink),
          align: 'center',
        },
      });
      t.anchor.set(0.5);
      if (opts.icon) t.position.set(0, opts.h / 2 + 14);
      this.content.addChild(t);
    }

    // ≥52 design px hit target regardless of visual size
    const hw = Math.max(opts.w, 52) / 2;
    const hh = Math.max(opts.h, 52) / 2;
    this.hitArea = new Rectangle(-hw, -hh, hw * 2, hh * 2);
    this.eventMode = 'static';
    this.cursor = 'pointer';
    // a press on a button is never a world gesture as well
    this.on('pointerdown', () => {
      this.ctx.input.cancelTap();
      if (!this.enabled) return;
      this.scale.set(0.94);
    });
    this.on('pointerup', () => this.scale.set(1));
    this.on('pointerupoutside', () => this.scale.set(1));
    this.on('pointertap', (e) => {
      e.stopPropagation(); // container-level "tap anywhere" handlers must not double-fire
      if (!this.enabled) return;
      if (!this.opts.silent) this.ctx.audio.play('uiTap');
      this.opts.onTap();
    });
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.alpha = on ? 1 : 0.42;
    this.eventMode = on ? 'static' : 'none';
  }

  setLabel(text: string): void {
    for (const child of this.content.children) {
      if (child instanceof Text) { child.text = text; return; }
    }
  }
}
