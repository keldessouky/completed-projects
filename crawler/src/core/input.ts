import { CONFIG } from '../config';

/**
 * Raw pointer handling.
 *
 * Movement is a *floating* joystick: the stick is born wherever the thumb
 * lands in the lower part of the screen and dies when it lifts. A fixed stick
 * would need the player to look at their hand; a floating one means wherever
 * you grab is centre, which is the only version that works one-handed on a
 * 6.9" phone.
 *
 * UI buttons use Pixi's own event system; this class never swallows them —
 * taps that begin above the stick zone are ignored entirely.
 */
export class Input {
  /** true while a stick is being held */
  active = false;
  /** where the stick was born, in design space */
  originX = 0;
  originY = 0;
  /** where the thumb is now, in design space */
  curX = 0;
  curY = 0;
  /** normalised direction, magnitude 0..1 after dead zone */
  dx = 0;
  dy = 0;
  mag = 0;

  /** desktop convenience: WASD / arrows feed the same vector */
  private keys = new Set<string>();

  private pointerId = -1;
  private tapTimes: number[] = [];
  onDevGesture: (() => void) | null = null;

  constructor(
    private getScale: () => number,
    private getOffset: () => { x: number; y: number },
  ) {
    const el = document.body;
    el.addEventListener('pointerdown', this.onDown, { passive: false });
    el.addEventListener('pointermove', this.onMove, { passive: false });
    el.addEventListener('pointerup', this.onUp, { passive: false });
    el.addEventListener('pointercancel', this.onUp, { passive: false });
    // Belt-and-braces iOS gesture suppression (double-tap zoom, pinch, scroll).
    el.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    el.addEventListener('dblclick', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.keys.add(e.key.toLowerCase()));
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => { this.keys.clear(); this.release(); });
  }

  /** screen px → design space */
  private toDesign(cx: number, cy: number): { x: number; y: number } {
    const s = this.getScale();
    const o = this.getOffset();
    return { x: (cx - o.x) / s, y: (cy - o.y) / s };
  }

  private onDown = (e: PointerEvent): void => {
    this.trackDevTap(e.clientX, e.clientY);
    if (this.active) return;
    const p = this.toDesign(e.clientX, e.clientY);
    // only the lower part of the screen grows a stick; the top is HUD
    if (p.y < CONFIG.design.height * CONFIG.joystick.zoneTopFrac) return;
    this.active = true;
    this.pointerId = e.pointerId;
    this.originX = this.curX = p.x;
    this.originY = this.curY = p.y;
    this.dx = this.dy = this.mag = 0;
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.active || e.pointerId !== this.pointerId) return;
    const p = this.toDesign(e.clientX, e.clientY);
    this.curX = p.x;
    this.curY = p.y;
    const vx = p.x - this.originX, vy = p.y - this.originY;
    const len = Math.hypot(vx, vy);
    const J = CONFIG.joystick;
    if (len < 0.001) { this.dx = this.dy = this.mag = 0; return; }
    const throwFrac = Math.min(1, len / J.fullThrowPx);
    this.mag = throwFrac < J.deadZone ? 0 : (throwFrac - J.deadZone) / (1 - J.deadZone);
    this.dx = (vx / len) * this.mag;
    this.dy = (vy / len) * this.mag;
    // Drag past full throw and the origin follows, so a long swipe never runs
    // out of stick — the thumb can wander and still be steering.
    if (len > J.fullThrowPx * 1.6) {
      this.originX = p.x - (vx / len) * J.fullThrowPx * 1.6;
      this.originY = p.y - (vy / len) * J.fullThrowPx * 1.6;
    }
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId && this.pointerId !== -1) return;
    this.release();
  };

  private release(): void {
    this.active = false;
    this.pointerId = -1;
    this.dx = this.dy = this.mag = 0;
  }

  /** Movement vector for this frame, keyboard folded in. */
  vector(): { x: number; y: number } {
    let x = this.dx, y = this.dy;
    const k = this.keys;
    let kx = 0, ky = 0;
    if (k.has('a') || k.has('arrowleft')) kx -= 1;
    if (k.has('d') || k.has('arrowright')) kx += 1;
    if (k.has('w') || k.has('arrowup')) ky -= 1;
    if (k.has('s') || k.has('arrowdown')) ky += 1;
    if (kx !== 0 || ky !== 0) {
      const len = Math.hypot(kx, ky);
      x = kx / len; y = ky / len;
    }
    const len = Math.hypot(x, y);
    return len > 1 ? { x: x / len, y: y / len } : { x, y };
  }

  private trackDevTap(x: number, y: number): void {
    const g = CONFIG.devGesture;
    if (x > g.cornerPx || y > g.cornerPx) { this.tapTimes.length = 0; return; }
    const now = performance.now();
    this.tapTimes.push(now);
    while (this.tapTimes.length > 0 && now - this.tapTimes[0] > g.withinMs) this.tapTimes.shift();
    if (this.tapTimes.length >= g.taps) {
      this.tapTimes.length = 0;
      this.onDevGesture?.();
    }
  }
}
