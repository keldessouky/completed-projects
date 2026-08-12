import { CONFIG } from '../config';
import type { SaveData, SavedRun } from '../types';

/**
 * Versioned localStorage persistence with safe migration.
 * - Unknown/corrupt payloads are backed up (once) and replaced with defaults,
 *   never thrown away silently mid-parse.
 * - Writes are debounced; flush() is called on pagehide for force-quit safety.
 * - v5 carries a whole field of play. It stays small because the field itself
 *   is a pure function of the seed: only what the player *did* is stored.
 */

function defaults(): SaveData {
  return {
    v: 5,
    coins: 0,
    bestSquad: 0,
    achievements: [],
    totalRuns: 0,
    kills: 0,
    playSec: 0,
    tutorialDone: false,
    run: null,
    settings: { music: 1, sfx: 1, haptics: true, reducedMotion: false, shake: 1 },
  };
}

const clamp01 = (x: unknown, d: number) => (typeof x === 'number' && isFinite(x) ? Math.min(1, Math.max(0, x)) : d);
const int = (x: unknown, d: number, lo: number, hi: number) =>
  typeof x === 'number' && isFinite(x) ? Math.min(hi, Math.max(lo, Math.round(x))) : d;

/** Shallow only; RunState.fromSave re-validates every field itself. */
function sanitizeRun(raw: unknown): SavedRun | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.x !== 'number' || typeof o.y !== 'number') return null;
  return o as unknown as SavedRun;
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
 * Anything older than v5 → v5.
 *
 * v4 was the open-world RPG schema — levels, attributes, gear, quests and fog,
 * none of which has an equivalent in a game whose only stat is how many people
 * are behind you. Nothing about that character can be carried forward
 * honestly, so only the things that still mean the same thing survive:
 * lifetime kills, playtime, the settings, and the fact that the player has
 * seen the tutorial. Achievement ids are dropped too — they name different
 * achievements now.
 */
function migrateOld(raw: Record<string, unknown>): SaveData {
  const d = defaults();
  d.kills = int(raw.kills, 0, 0, 1e9);
  d.playSec = int(raw.playSec, 0, 0, 1e9);
  d.totalRuns = int(raw.totalDeaths, 0, 0, 1e9);
  d.tutorialDone = raw.tutorialDone === true;
  sanitizeSettings(d, raw.settings);
  return d;
}

/** Validate + clamp a parsed v5 payload field-by-field; junk fields fall back. */
function sanitize(raw: Record<string, unknown>): SaveData {
  const d = defaults();
  d.coins = int(raw.coins, 0, 0, 1e9);
  d.bestSquad = int(raw.bestSquad, 0, 0, CONFIG.squad.max);
  d.totalRuns = int(raw.totalRuns, 0, 0, 1e9);
  d.kills = int(raw.kills, 0, 0, 1e9);
  d.playSec = int(raw.playSec, 0, 0, 1e9);
  d.tutorialDone = raw.tutorialDone === true;
  d.run = sanitizeRun(raw.run);
  if (Array.isArray(raw.achievements)) {
    d.achievements = (raw.achievements as unknown[])
      .filter((a): a is string => typeof a === 'string')
      .slice(0, 200);
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
      if (raw.v === 5) return sanitize(raw);
      if (typeof raw.v === 'number' && raw.v >= 1 && raw.v <= 4) return migrateOld(raw);
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
