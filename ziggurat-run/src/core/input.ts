import { CONFIG } from '../config';

/**
 * Raw pointer handling for steering (drag anywhere, 1:1 in design px) and
 * the 5-tap corner gesture that opens the dev overlay.
 * UI buttons use Pixi's own event system; this class never swallows them.
 */
export class Input {
  /** design-px horizontal drag accumulated since last consume() */
  private dx = 0;
  /** cumulative |dx| while a drag is held — tutorial dismissal metric */
  dragTotal = 0;
  down = false;

  private lastX = 0;
  private tapTimes: number[] = [];
  onDevGesture: (() => void) | null = null;

  constructor(private getScale: () => number) {
    const el = document.body;
    el.addEventListener('pointerdown', this.onDown, { passive: false });
    el.addEventListener('pointermove', this.onMove, { passive: false });
    el.addEventListener('pointerup', this.onUp, { passive: false });
    el.addEventListener('pointercancel', this.onUp, { passive: false });
    // Belt-and-braces iOS gesture suppression (double-tap zoom, pinch, scroll).
    el.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    el.addEventListener('dblclick', (e) => e.preventDefault());
  }

  private onDown = (e: PointerEvent): void => {
    this.down = true;
    this.lastX = e.clientX;
    this.dragTotal = 0;
    this.trackDevTap(e.clientX, e.clientY);
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.down) return;
    const scale = this.getScale();
    const d = ((e.clientX - this.lastX) / scale) * CONFIG.hero.dragGain;
    this.lastX = e.clientX;
    this.dx += d;
    this.dragTotal += Math.abs(d);
  };

  private onUp = (): void => {
    this.down = false;
  };

  /** Read-and-clear the pending steering delta (called once per render frame). */
  consume(): number {
    const d = this.dx;
    this.dx = 0;
    return d;
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
