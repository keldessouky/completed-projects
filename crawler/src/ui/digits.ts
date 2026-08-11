import { Container, Sprite } from 'pixi.js';
import { Easing, Group as TweenGroup, Tween } from '@tweenjs/tween.js';
import type { GameAtlas } from '../assets/atlas';

/**
 * HUD numerals rendered from the atlas digit glyphs. Every glyph advances by
 * the same fixed width, so numbers are tabular by construction — counts and
 * coins never jitter as digits change. Zero allocation after warm-up: slots
 * are pre-created sprites toggled by visibility.
 */
export class NumberDisplay extends Container {
  private slots: Sprite[] = [];
  private advance: number;
  private text = '';

  constructor(
    private atlas: GameAtlas,
    maxChars: number,
    size = 1,
    tint = 0xffffff,
    private align: 'center' | 'left' | 'right' = 'center',
  ) {
    super();
    this.advance = atlas.digitAdvance;
    for (let i = 0; i < maxChars; i++) {
      const s = new Sprite(atlas.get('d_0'));
      s.anchor.set(0.5);
      s.visible = false;
      this.slots.push(s);
      this.addChild(s);
    }
    this.scale.set(size);
    this.tint = tint;
  }

  /** chars limited to 0-9 × ÷ + − % (minus normalizes to −) */
  set(text: string): void {
    if (this.destroyed || text === this.text) return;
    this.text = text;
    const n = Math.min(text.length, this.slots.length);
    const originX =
      this.align === 'center' ? -((n - 1) * this.advance) / 2 :
      this.align === 'left' ? 0 : -(n - 1) * this.advance;
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (i >= n) { s.visible = false; continue; }
      const ch = text[i] === '-' ? '−' : text[i] === 'x' ? '×' : text[i] === '/' ? '÷' : text[i];
      const frame = this.atlas.frames['d_' + ch];
      if (!frame) { s.visible = false; continue; }
      s.texture = frame;
      s.visible = true;
      s.position.set(originX + i * this.advance, 0);
    }
  }

  setValue(v: number): void {
    this.set(String(Math.round(v)));
  }
}

/** A NumberDisplay that never snaps: it rolls to new values with an
 *  ease-out over CONFIG.party.countRollMs (or a caller-set duration). */
export class RollingNumber extends NumberDisplay {
  private shown = 0;
  private tween: Tween | null = null;

  constructor(
    atlas: GameAtlas,
    private tweens: TweenGroup,
    maxChars: number,
    size = 1,
    tint = 0xffffff,
    private rollMs = 250,
    align: 'center' | 'left' | 'right' = 'center',
  ) {
    super(atlas, maxChars, size, tint, align);
    this.setValue(0);
  }

  snap(v: number): void {
    this.tween?.stop();
    this.shown = v;
    this.setValue(v);
  }

  roll(v: number): void {
    if (this.destroyed) return;
    this.tween?.stop();
    const state = { x: this.shown };
    this.tween = new Tween(state)
      .to({ x: v }, this.rollMs)
      .easing(Easing.Quadratic.Out)
      .onUpdate(() => {
        this.shown = state.x;
        this.setValue(state.x);
      })
      .onComplete(() => { this.shown = v; this.setValue(v); })
      .start(performance.now());
    this.tweens.add(this.tween);
  }
}
