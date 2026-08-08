import { CONFIG } from '../config';

/**
 * Movement input for a free-roam hero, unified into one direction vector.
 *
 * Touch/mouse: press anywhere and drag; the stick origin is where you pressed,
 * and pulling further from it pushes the analog magnitude to 1. That reads as
 * a floating joystick without drawing one, and it never fights UI buttons
 * because those swallow their own pointer events.
 *
 * Desktop also gets WASD / arrows, because dragging a mouse to walk is
 * miserable on a keyboard machine.
 */
export class Input {
  /** normalised direction, magnitude 0..1 */
  dx = 0;
  dy = 0;
  active = false;
  /** where the current drag started, in screen px — the UI draws the stick here */
  originX = 0;
  originY = 0;
  curX = 0;
  curY = 0;
  /** world units travelled while dragging, for the tutorial */
  travelled = 0;

  private pointerId = -1;
  private keys = new Set<string>();
  private tapTimes: number[] = [];
  onDevGesture: (() => void) | null = null;
  /** the stick reaches full tilt at this screen-px distance */
  private readonly maxRadius = 96;

  constructor() {
    const el = document.body;
    el.addEventListener('pointerdown', this.onDown, { passive: false });
    el.addEventListener('pointermove', this.onMove, { passive: false });
    el.addEventListener('pointerup', this.onUp, { passive: false });
    el.addEventListener('pointercancel', this.onUp, { passive: false });
    el.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    el.addEventListener('dblclick', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key.toLowerCase());
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => { this.keys.clear(); this.release(); });
  }

  private onDown = (e: PointerEvent): void => {
    if (this.pointerId !== -1) return;
    this.pointerId = e.pointerId;
    this.active = true;
    this.originX = this.curX = e.clientX;
    this.originY = this.curY = e.clientY;
    this.travelled = 0;
    this.trackDevTap(e.clientX, e.clientY);
  };

  private onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    this.curX = e.clientX;
    this.curY = e.clientY;
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    this.release();
  };

  private release(): void {
    this.pointerId = -1;
    this.active = false;
    this.dx = 0;
    this.dy = 0;
  }

  /** Recompute the direction vector; call once per frame before stepping. */
  update(dtWorldPerPx: number): void {
    let x = 0;
    let y = 0;

    if (this.active) {
      const px = this.curX - this.originX;
      const py = this.curY - this.originY;
      const len = Math.hypot(px, py);
      if (len > 4) {
        const mag = Math.min(1, len / this.maxRadius);
        x = (px / len) * mag;
        y = (py / len) * mag;
      }
    }

    // keyboard overrides/adds — normalised so diagonals aren't faster
    let kx = 0;
    let ky = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) kx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) kx += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) ky -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) ky += 1;
    if (kx !== 0 || ky !== 0) {
      const kl = Math.hypot(kx, ky);
      x = kx / kl;
      y = ky / kl;
    }

    this.dx = x;
    this.dy = y;
    this.travelled += Math.hypot(x, y) * dtWorldPerPx;
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
