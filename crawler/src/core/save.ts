import { CONFIG, STAT_KEYS } from '../config';
import type { SaveData, SavedRun, Stats } from '../types';
import { baseStats } from '../game/stats';

/**
 * Versioned localStorage persistence with safe migration.
 * - Unknown/corrupt payloads are backed up (once) and replaced with defaults,
 *   never thrown away silently mid-parse.
 * - Writes are debounced; flush() is called on pagehide for force-quit safety.
 * - v3 additionally carries an in-progress floor, because a crawl is long
 *   enough that losing one to a phone call would be unforgivable.
 */

function defaults(): SaveData {
  return {
    v: 3,
    gold: 0,
    unlocked: 0,
    bestTime: new Array(CONFIG.floors.count).fill(0),
    cleared: new Array(CONFIG.floors.count).fill(false),
    level: 1,
    xp: 0,
    points: 0,
    stats: baseStats(),
    achievements: [],
    totalRuns: 0,
    totalDeaths: 0,
    tutorialDone: false,
    inProgress: null,
    settings: { music: 1, sfx: 1, haptics: true, reducedMotion: false, shake: 1 },
  };
}

const clamp01 = (x: unknown, d: number) => (typeof x === 'number' && isFinite(x) ? Math.min(1, Math.max(0, x)) : d);
const int = (x: unknown, d: number, lo: number, hi: number) =>
  typeof x === 'number' && isFinite(x) ? Math.min(hi, Math.max(lo, Math.round(x))) : d;

function sanitizeStats(raw: unknown): Stats {
  const s = baseStats();
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    for (const k of STAT_KEYS) s[k] = int(o[k], CONFIG.stats.base, CONFIG.stats.base, CONFIG.stats.max);
  }
  return s;
}

/** Trusted shallowly here; RunState.fromSave re-validates every field itself. */
function sanitizeRun(raw: unknown): SavedRun | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.floor !== 'number' || typeof o.at !== 'string') return null;
  return o as unknown as SavedRun;
}

/**
 * v2 → v3: v2 was the auto-runner's schema — coins, per-stage stars, and four
 * upgrade tracks. Stars and best-squad have no v3 equivalent and are dropped;
 * coins carry over as gold, and every upgrade level already bought is refunded
 * as an attribute point so nobody loses progress across the genre change.
 */
function migrateV2(raw: Record<string, unknown>): SaveData {
  const d = defaults();
  d.gold = int(raw.coins, 0, 0, 1e9);
  d.totalRuns = int(raw.totalRuns, 0, 0, 1e9);
  d.tutorialDone = raw.tutorialDone === true;

  const up = raw.upgrades as Record<string, unknown> | undefined;
  if (up && typeof up === 'object') {
    let refunded = 0;
    for (const k of ['squad', 'rate', 'dmg', 'resist'] as const) {
      refunded += int(up[k], 0, 0, CONFIG.stats.max);
    }
    d.points = refunded;
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

/** Validate + clamp a parsed v3 payload field-by-field; junk fields fall back. */
function sanitize(raw: Record<string, unknown>): SaveData {
  const d = defaults();
  d.gold = int(raw.gold, 0, 0, 1e9);
  d.unlocked = int(raw.unlocked, 0, 0, CONFIG.floors.count - 1);
  d.level = int(raw.level, 1, 1, 999);
  d.xp = int(raw.xp, 0, 0, 1e9);
  d.points = int(raw.points, 0, 0, 9999);
  d.totalRuns = int(raw.totalRuns, 0, 0, 1e9);
  d.totalDeaths = int(raw.totalDeaths, 0, 0, 1e9);
  d.tutorialDone = raw.tutorialDone === true;
  d.stats = sanitizeStats(raw.stats);
  d.inProgress = sanitizeRun(raw.inProgress);

  const best = raw.bestTime, cleared = raw.cleared;
  if (Array.isArray(best)) for (let i = 0; i < d.bestTime.length; i++) d.bestTime[i] = int(best[i], 0, 0, 1e6);
  if (Array.isArray(cleared)) for (let i = 0; i < d.cleared.length; i++) d.cleared[i] = cleared[i] === true;
  if (Array.isArray(raw.achievements)) {
    d.achievements = (raw.achievements as unknown[]).filter((a): a is string => typeof a === 'string').slice(0, 200);
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
      // A v2 save lives under the old game's key; adopt it once.
      if (!text) text = localStorage.getItem('ziggurat-run.save');
    } catch {
      this.storageOk = false; // private mode with storage denied — play stateless
      return defaults();
    }
    if (!text) return defaults();
    try {
      const raw = JSON.parse(text) as Record<string, unknown>;
      if (raw.v === 3) return sanitize(raw);
      if (raw.v === 2 || raw.v === 1) return migrateV2(raw);
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
