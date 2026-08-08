import { CONFIG } from '../config';
import type { SaveData } from '../types';

/**
 * Versioned localStorage persistence with safe migration.
 * - Unknown/corrupt payloads are backed up (once) and replaced with defaults,
 *   never thrown away silently mid-parse.
 * - Writes are debounced; flush() is called on pagehide for force-quit safety.
 */

function defaults(): SaveData {
  return {
    v: 2,
    coins: 0,
    unlocked: 0,
    stars: new Array(CONFIG.stages.count).fill(0),
    bestSquad: new Array(CONFIG.stages.count).fill(0),
    totalRuns: 0,
    tutorialDone: false,
    upgrades: { squad: 0, rate: 0, dmg: 0, resist: 0 },
    settings: { music: 1, sfx: 1, haptics: true, reducedMotion: false, shake: 1 },
  };
}

const clamp01 = (x: unknown, d: number) => (typeof x === 'number' && isFinite(x) ? Math.min(1, Math.max(0, x)) : d);
const int = (x: unknown, d: number, lo: number, hi: number) =>
  typeof x === 'number' && isFinite(x) ? Math.min(hi, Math.max(lo, Math.round(x))) : d;

/** v1 → v2: v1 stored a flat `stars` object keyed by stage id and no bestSquad. */
function migrateV1(raw: Record<string, unknown>): SaveData {
  const d = defaults();
  d.coins = int(raw.coins, 0, 0, 1e9);
  d.unlocked = int(raw.unlocked, 0, 0, CONFIG.stages.count - 1);
  d.totalRuns = int(raw.totalRuns, 0, 0, 1e9);
  d.tutorialDone = raw.tutorialDone === true;
  const oldStars = raw.stars as Record<string, number> | undefined;
  if (oldStars && typeof oldStars === 'object') {
    for (let i = 0; i < CONFIG.stages.count; i++) d.stars[i] = int(oldStars[String(i)], 0, 0, 3);
  }
  return d;
}

/** Validate + clamp a parsed v2 payload field-by-field; junk fields fall back. */
function sanitize(raw: Record<string, unknown>): SaveData {
  const d = defaults();
  d.coins = int(raw.coins, 0, 0, 1e9);
  d.unlocked = int(raw.unlocked, 0, 0, CONFIG.stages.count - 1);
  d.totalRuns = int(raw.totalRuns, 0, 0, 1e9);
  d.tutorialDone = raw.tutorialDone === true;
  const stars = raw.stars, best = raw.bestSquad;
  if (Array.isArray(stars)) for (let i = 0; i < d.stars.length; i++) d.stars[i] = int(stars[i], 0, 0, 3);
  if (Array.isArray(best)) for (let i = 0; i < d.bestSquad.length; i++) d.bestSquad[i] = int(best[i], 0, 0, CONFIG.squad.max);
  const up = raw.upgrades as Record<string, unknown> | undefined;
  if (up && typeof up === 'object') {
    for (const k of ['squad', 'rate', 'dmg', 'resist'] as const) {
      d.upgrades[k] = int(up[k], 0, 0, CONFIG.economy.maxLevel);
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
  private storageOk = true;

  constructor() {
    this.data = this.load();
    // Force-quit safety: pagehide fires on iOS Safari where beforeunload does not.
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
      this.storageOk = false; // private mode with storage denied — play stateless
      return defaults();
    }
    if (!text) return defaults();
    try {
      const raw = JSON.parse(text) as Record<string, unknown>;
      if (raw.v === 2) return sanitize(raw);
      if (raw.v === 1) return migrateV1(raw);
      // future or unknown version: keep a backup, start clean rather than corrupt
      localStorage.setItem(CONFIG.save.key + '.backup', text);
      return defaults();
    } catch {
      try { localStorage.setItem(CONFIG.save.key + '.corrupt', text); } catch { /* full */ }
      return defaults();
    }
  }

  /** Queue a debounced write. */
  mark(): void {
    if (!this.storageOk) return;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), CONFIG.save.debounceMs);
  }

  flush(): void {
    if (!this.storageOk) return;
    if (this.timer !== null) { clearTimeout(this.timer); this.timer = null; }
    try {
      localStorage.setItem(CONFIG.save.key, JSON.stringify(this.data));
    } catch { this.storageOk = false; }
  }

  /** Full reset (settings survive — resetting audio prefs punishes nobody). */
  resetProgress(): void {
    const settings = this.data.settings;
    this.data = defaults();
    this.data.settings = settings;
    this.flush();
  }
}
