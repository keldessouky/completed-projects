/**
 * Haptics via the Vibration API where available (feature-detected). iOS Safari
 * exposes no Vibration API today, so this degrades to a silent no-op there.
 */
export class Haptics {
  private supported = typeof navigator !== 'undefined' && 'vibrate' in navigator;
  enabled = true;

  /** One buzz, or a pattern for bigger moments. */
  tap(pattern: number | number[]): void {
    if (!this.supported || !this.enabled) return;
    try { navigator.vibrate(pattern); } catch { this.supported = false; }
  }
}
