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

  hit(): void { this.buzz(CONFIG.fx.hapticHitMs); }
  hurt(): void { this.buzz(CONFIG.fx.hapticHurtMs); }
  boss(): void { this.buzz(CONFIG.fx.hapticBossMs); }
}
