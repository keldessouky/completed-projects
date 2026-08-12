import { CONFIG } from '../config';
import type { SavedRun } from '../types';
import { coinSpots, getWorld, poiById } from './worldgen';

/**
 * The live run.
 *
 * This deliberately does NOT live in a scene: `SceneManager.goto()` destroys
 * the outgoing scene wholesale, and a run survives the death screen and the
 * pause menu, so position, squad size, the coin purse and the gate's health
 * hang off the game context instead.
 *
 * It is also the unit of persistence. Terrain, camps, pads and the coin table
 * are all pure functions of the seed, so nothing here stores the world — only
 * what the player did to it.
 */
export class RunState {
  x: number;
  y: number;
  /** squad size is owned by the Squad object while a scene is live; this is the
   *  authoritative value across scene changes and saves */
  squad = 0;
  coins = 0;

  /** camp ids whose population is dead */
  cleared = new Set<string>();
  /** pad id → recruits already taken from it */
  padsUsed = new Map<string, number>();
  /** indices into the coin table that are gone */
  coinsTaken = new Set<number>();

  gateHp: number = CONFIG.castle.hp;
  breached = false;
  /** false as soon as the squad has ever dropped below ten */
  untouched = true;

  /** which way the hero's sprite faces: −1 screen-left, 1 screen-right */
  face = 1;
  /** seconds of play, used for pad refill timers and the save clock */
  clock = 0;
  kills = 0;
  /** pad id → the clock time it was drained dry */
  padEmptiedAt = new Map<string, number>();

  constructor() {
    const w = getWorld();
    this.x = w.spawn.x;
    this.y = w.spawn.y;
  }

  // ─────────────────────────── camps ───────────────────────────

  isCleared(id: string): boolean { return this.cleared.has(id); }

  markCleared(id: string): void { this.cleared.add(id); }

  // ─────────────────────────── pads ───────────────────────────

  /** How many recruits a pad still has in it. */
  padLeft(id: string): number {
    const used = this.padsUsed.get(id) ?? 0;
    const emptied = this.padEmptiedAt.get(id);
    // a drained pad comes back after a while — the map should not run out of
    // people just because you cleared it out early
    if (used >= CONFIG.pad.capacity && emptied !== undefined
      && this.clock - emptied >= CONFIG.pad.refillSec) {
      this.padsUsed.set(id, 0);
      this.padEmptiedAt.delete(id);
      return CONFIG.pad.capacity;
    }
    return Math.max(0, CONFIG.pad.capacity - used);
  }

  /** What the next recruit from this pad costs. Rises as the pad is used. */
  padCost(id: string): number {
    const used = this.padsUsed.get(id) ?? 0;
    return CONFIG.pad.costBase + used * CONFIG.pad.costStep;
  }

  /** Record one recruit taken. */
  padTake(id: string): void {
    const used = (this.padsUsed.get(id) ?? 0) + 1;
    this.padsUsed.set(id, used);
    if (used >= CONFIG.pad.capacity) this.padEmptiedAt.set(id, this.clock);
  }

  // ─────────────────────────── coins ───────────────────────────

  coinTaken(i: number): boolean { return this.coinsTaken.has(i); }
  takeCoinSpot(i: number): void { this.coinsTaken.add(i); }

  addCoins(n: number): void { this.coins = Math.min(999_999, this.coins + n); }

  spendCoins(n: number): boolean {
    if (this.coins < n) return false;
    this.coins -= n;
    return true;
  }

  // ─────────────────────────── persistence ───────────────────────────

  toSave(): SavedRun {
    return {
      x: this.x,
      y: this.y,
      squad: this.squad,
      coins: this.coins,
      cleared: [...this.cleared],
      padsUsed: [...this.padsUsed],
      coinsTaken: [...this.coinsTaken],
      gateHp: this.gateHp,
      breached: this.breached,
      untouched: this.untouched,
    };
  }

  /**
   * Rebuild from a save. Every field is re-clamped rather than trusted — a
   * hand-edited localStorage entry should produce a boring run, not a crash.
   */
  static fromSave(s: SavedRun): RunState {
    const r = new RunState();
    const size = CONFIG.world.size;
    const clamp = (v: unknown, lo: number, hi: number, d: number): number =>
      typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;

    r.x = clamp(s?.x, 0, size, r.x);
    r.y = clamp(s?.y, 0, size, r.y);
    r.squad = Math.round(clamp(s?.squad, 0, CONFIG.squad.max, 0));
    r.coins = Math.round(clamp(s?.coins, 0, 999_999, 0));
    r.gateHp = Math.round(clamp(s?.gateHp, 0, CONFIG.castle.hp, CONFIG.castle.hp));
    r.breached = s?.breached === true;
    r.untouched = s?.untouched !== false;

    const known = new Set(getWorld().pois.map((p) => p.id));
    const okId = (id: unknown): id is string => typeof id === 'string' && known.has(id);
    if (Array.isArray(s?.cleared)) r.cleared = new Set(s.cleared.filter(okId));
    if (Array.isArray(s?.padsUsed)) {
      for (const e of s.padsUsed) {
        if (Array.isArray(e) && okId(e[0]) && typeof e[1] === 'number') {
          r.padsUsed.set(e[0], Math.round(Math.min(CONFIG.pad.capacity, Math.max(0, e[1]))));
        }
      }
    }
    const spots = coinSpots().length;
    if (Array.isArray(s?.coinsTaken)) {
      for (const i of s.coinsTaken) {
        if (typeof i === 'number' && i >= 0 && i < spots) r.coinsTaken.add(Math.round(i));
      }
    }
    return r;
  }

  /** Where the hero wakes up after a wipe: back at the muster point. */
  restartPos(): { x: number; y: number } {
    const p = poiById('start') ?? getWorld().pois[0];
    return { x: p.x, y: p.y + 60 };
  }
}
