import { Container, Graphics } from 'pixi.js';
import { CONFIG } from '../config';
import type { Input } from '../core/input';

/**
 * The floating stick, drawn where the thumb actually is.
 *
 * It is feedback, not a control: `Input` owns the vector and would work with
 * nothing drawn at all. Rendering it matters anyway — without a visible centre
 * the player cannot tell a dead zone from a dropped touch.
 */
export class Joystick extends Container {
  private base = new Graphics();
  private knob = new Graphics();
  private shown = false;

  constructor(private input: Input) {
    super();
    this.eventMode = 'none';
    this.addChild(this.base, this.knob);
    this.visible = false;
  }

  update(dtReal: number): void {
    const on = this.input.active && this.input.mag > 0.001;
    // fade rather than pop, so a tap that turns out to be a button press does
    // not flash a stick at the player
    const target = on ? 1 : 0;
    this.alpha += (target - this.alpha) * Math.min(1, 16 * dtReal);
    this.visible = this.alpha > 0.02;
    if (!this.visible) { this.shown = false; return; }

    const J = CONFIG.joystick;
    if (!this.shown) {
      this.shown = true;
      this.base.clear();
      this.base.circle(0, 0, J.baseRadius)
        .fill({ color: CONFIG.colors.ink, alpha: 0.3 })
        .stroke({ color: CONFIG.colors.bone, width: 2, alpha: 0.35 });
      this.base.circle(0, 0, J.baseRadius * (J.deadZone + 0.06))
        .stroke({ color: CONFIG.colors.bone, width: 1, alpha: 0.2 });
      this.knob.clear();
      this.knob.circle(0, 0, J.knobRadius)
        .fill({ color: CONFIG.colors.bone, alpha: 0.5 })
        .stroke({ color: CONFIG.colors.bone, width: 2, alpha: 0.75 });
    }

    this.base.position.set(this.input.originX, this.input.originY);
    this.knob.position.set(
      this.input.originX + this.input.dx * J.baseRadius,
      this.input.originY + this.input.dy * J.baseRadius,
    );
  }
}
