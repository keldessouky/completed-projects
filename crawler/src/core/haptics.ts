import { CONFIG } from '../config';

/**
 * Haptics via the Vibration API where available (feature-detected; iOS Safari
 * currently exposes no Vibration API, so this degrades to a silent no-op there,
 * per spec: "where available").
 */
export class Haptics {
  private supported = typeof navigator !== 'undefined' && 'vibrate' in navigator;
  enabled = true;

  private buzz(pattern: number | number[]): void {
    if (!this.supported || !this.enabled) return;
    try { navigator.vibrate(pattern); } catch { this.supported = false; }
  }

  doorTap(): void { this.buzz(CONFIG.fx.hapticDoorMs); }
  trapHit(): void { this.buzz(CONFIG.fx.hapticTrapMs); }
  bossBreach(): void { this.buzz(CONFIG.fx.hapticBreachMs); }
}
