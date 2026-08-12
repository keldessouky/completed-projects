import { CONFIG, STAT_KEYS } from '../config';
import type { SaveData, SavedWorld, Stats } from '../types';
import { baseStats } from '../game/stats';

/**
 * Versioned localStorage persistence with safe migration.
 * - Unknown/corrupt payloads are backed up (once) and replaced with defaults,
 *   never thrown away silently mid-parse.
 * - Writes are debounced; flush() is called on pagehide for force-quit safety.
 * - v4 carries a whole open world. It stays small because the world itself is
 *   a pure function of the seed: only what the player *did* is stored.
 */

function defaults(): SaveData {
  return {
    v: 4,
    gold: 0,
    level: 1,
    xp: 0,
    points: 0,
    stats: baseStats(),
    hp: 0,               // 0 means "full"; resolved once the loadout is known
    achievements: [],
    totalDeaths: 0,
    kills: 0,
    playSec: 0,
    tutorialDone: false,
    world: null,
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

/** Shallow only; WorldState.fromSave re-validates every field itself. */
function sanitizeWorld(raw: unknown): SavedWorld | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.x !== 'number' || typeof o.y !== 'number') return null;
  return o as unknown as SavedWorld;
}

function sanitizeSettings(d: SaveData, raw: unknown): void {
  if (!raw || typeof raw !== 'object') return;
  const s = raw as Record<string, unknown>;
  d.settings.music = clamp01(s.music, 1);
  d.settings.sfx = clamp01(s.sfx, 1);
  d.settings.haptics = s.haptics !== false;
  d.settings.reducedMotion = s.reducedMotion === true;
  d.settings.shake = clamp01(s.shake, 1);
}

/**
 * v3 → v4: v3 was the floor-crawl schema — per-floor clears, best times and a
 * mid-floor resume blob, none of which has an open-world equivalent. The
 * character survives intact (level, XP, attributes, gold, achievements); the
 * floor progress is dropped and the player starts the open floor at the gate.
 */
function migrateV3(raw: Record<string, unknown>): SaveData {
  const d = defaults();
  d.gold = int(raw.gold, 0, 0, 1e9);
  d.level = int(raw.level, 1, 1, 999);
  d.xp = int(raw.xp, 0, 0, 1e9);
  d.points = int(raw.points, 0, 0, 9999);
  d.stats = sanitizeStats(raw.stats);
  d.totalDeaths = int(raw.totalDeaths, 0, 0, 1e9);
  d.tutorialDone = raw.tutorialDone === true;
  if (Array.isArray(raw.achievements)) {
    d.achievements = (raw.achievements as unknown[]).filter((a): a is string => typeof a === 'string');
  }
  sanitizeSettings(d, raw.settings);
  return d;
}

/** Validate + clamp a parsed v4 payload field-by-field; junk fields fall back. */
function sanitize(raw: Record<string, unknown>): SaveData {
  const d = defaults();
  d.gold = int(raw.gold, 0, 0, 1e9);
  d.level = int(raw.level, 1, 1, 999);
  d.xp = int(raw.xp, 0, 0, 1e9);
  d.points = int(raw.points, 0, 0, 9999);
  d.hp = int(raw.hp, 0, 0, 1e6);
  d.totalDeaths = int(raw.totalDeaths, 0, 0, 1e9);
  d.kills = int(raw.kills, 0, 0, 1e9);
  d.playSec = int(raw.playSec, 0, 0, 1e9);
  d.tutorialDone = raw.tutorialDone === true;
  d.stats = sanitizeStats(raw.stats);
  d.world = sanitizeWorld(raw.world);
  if (Array.isArray(raw.achievements)) {
    d.achievements = (raw.achievements as unknown[]).filter((a): a is string => typeof a === 'string').slice(0, 200);
  }
  sanitizeSettings(d, raw.settings);
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
      if (raw.v === 4) return sanitize(raw);
      if (raw.v === 3 || raw.v === 2 || raw.v === 1) return migrateV3(raw);
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
