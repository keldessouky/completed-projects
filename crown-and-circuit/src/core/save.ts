import { CONFIG } from '../config';
import type { SaveData } from '../types';
import type { EraId } from '../config';

/**
 * Versioned localStorage persistence with field-by-field validation.
 * Corrupt or future payloads are backed up once and replaced with defaults
 * rather than crashing the boot; storage denial (private mode, sandboxed
 * iframe) degrades to playing stateless.
 */
function defaults(): SaveData {
  return {
    v: 1,
    shards: 0,
    bestWave: 0,
    bestEra: 0,
    runs: 0,
    wins: 0,
    tutorialDone: false,
    meta: { squad: 0, carry: 0, magnet: 0, speed: 0, keep: 0, purse: 0 },
    settings: { music: 1, sfx: 1, haptics: true, reducedMotion: false, shake: 1 },
  };
}

const clamp01 = (x: unknown, d: number): number =>
  typeof x === 'number' && isFinite(x) ? Math.min(1, Math.max(0, x)) : d;
const int = (x: unknown, d: number, lo: number, hi: number): number =>
  typeof x === 'number' && isFinite(x) ? Math.min(hi, Math.max(lo, Math.round(x))) : d;

function sanitize(raw: Record<string, unknown>): SaveData {
  const d = defaults();
  d.shards = int(raw.shards, 0, 0, 1e9);
  d.bestWave = int(raw.bestWave, 0, 0, CONFIG.waves.total);
  d.bestEra = int(raw.bestEra, 0, 0, CONFIG.eras.length - 1) as EraId;
  d.runs = int(raw.runs, 0, 0, 1e9);
  d.wins = int(raw.wins, 0, 0, 1e9);
  d.tutorialDone = raw.tutorialDone === true;
  const m = raw.meta as Record<string, unknown> | undefined;
  if (m && typeof m === 'object') {
    for (const k of Object.keys(d.meta) as (keyof SaveData['meta'])[]) {
      d.meta[k] = int(m[k], 0, 0, CONFIG.meta.maxLevel);
    }
  }
  const s = raw.settings as Record<string, unknown> | undefined;
  if (s && typeof s === 'object') {
    d.settings.music = clamp01(s.music, 1);
    d.settings.sfx = clamp01(s.sfx, 1);
    d.settings.haptics = s.haptics !== false;
    d.settings.reducedMotion = s.reducedMotion === true;
    d.settings.shake = clamp01(s.shake, 1);
  }
  return d;
}

export class Save {
  data: SaveData;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private ok = true;

  constructor() {
    this.data = this.load();
    window.addEventListener('pagehide', () => this.flush());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush();
    });
  }

  private load(): SaveData {
    let text: string | null = null;
    try {
      text = localStorage.getItem(CONFIG.save.key);
    } catch {
      this.ok = false;
      return defaults();
    }
    if (!text) return defaults();
    try {
      const raw = JSON.parse(text) as Record<string, unknown>;
      if (raw.v === 1) return sanitize(raw);
      localStorage.setItem(CONFIG.save.key + '.backup', text);
      return defaults();
    } catch {
      try { localStorage.setItem(CONFIG.save.key + '.corrupt', text); } catch { /* full */ }
      return defaults();
    }
  }

  mark(): void {
    if (!this.ok) return;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), CONFIG.save.debounceMs);
  }

  flush(): void {
    if (!this.ok) return;
    if (this.timer !== null) { clearTimeout(this.timer); this.timer = null; }
    try {
      localStorage.setItem(CONFIG.save.key, JSON.stringify(this.data));
    } catch { this.ok = false; }
  }

  /** Wipe progress but keep audio/motion preferences. */
  reset(): void {
    const settings = this.data.settings;
    this.data = defaults();
    this.data.settings = settings;
    this.flush();
  }
}
