import { CONFIG } from '../config';
import { TIMEOUT_LINE } from '../flavour';
import type { FloorDef, SavedRun } from '../types';
import { clearableNodes, getFloor } from './floors';

/**
 * The live state of a floor in progress.
 *
 * This deliberately does NOT live in a scene. `SceneManager.goto()` destroys
 * the outgoing scene wholesale, so anything that has to survive walking from
 * the map into a tunnel and back — the clock, the party, where you are
 * standing — has to hang off the game context instead. It is also the unit of
 * mid-floor persistence: `toSave()`/`fromSave()` are what let a crawl survive
 * a force-quit, which matters when a floor takes eight minutes and a phone
 * call takes one.
 */
export class RunState {
  def: FloorDef;
  timeLeft: number;
  visited = new Set<string>();
  at: string;
  party = 0;
  partyPeak = 0;
  goldThisRun = 0;
  xpThisRun = 0;
  kills = 0;
  /** blame tallies, for the death broadcast */
  losses = new Map<string, number>();
  /** cleared a tunnel without taking a hazard door — for the achievement */
  hitHazard = false;
  /** true once the boss is down and the stairs are live */
  get bossDown(): boolean { return this.visited.has(this.def.boss); }
  /** set when the clock expired; the map reads it to end the floor */
  timedOut = false;
  /** the one-line diagnostic the death broadcast reads out */
  failLine = '';
  /** fired once, when the clock first drops under the warning threshold */
  warned = false;

  constructor(floor: number, startParty: number) {
    this.def = getFloor(floor);
    this.timeLeft = this.def.timeLimitSec;
    this.at = this.def.entry;
    this.visited.add(this.def.entry);
    this.setParty(startParty);
  }

  get floor(): number { return this.def.index; }
  get elapsed(): number { return this.def.timeLimitSec - this.timeLeft; }

  setParty(n: number): void {
    this.party = Math.max(0, Math.min(CONFIG.party.max, Math.round(n)));
    this.partyPeak = Math.max(this.partyPeak, this.party);
  }

  addLoss(source: string, n: number): void {
    if (n <= 0) return;
    this.losses.set(source, (this.losses.get(source) ?? 0) + n);
  }

  /** The single blame line for the death broadcast. */
  worstLoss(): { source: string; n: number } {
    let source = '', n = 0;
    for (const [s, v] of this.losses) if (v > n) { source = s; n = v; }
    return { source, n };
  }

  /** Burn clock. Returns false once the floor has sealed. */
  spendTime(sec: number): boolean {
    this.timeLeft -= sec;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.timedOut = true;
      // Set here rather than at each call site: the clock can run out while
      // walking the map or opening a box, not only mid-encounter.
      this.failLine = TIMEOUT_LINE;
      return false;
    }
    return true;
  }

  /**
   * Can you step from where you stand to `id` right now?
   *
   * Any linked node counts, cleared or not. That matters: rooms are one-shot,
   * so if walking back through a cleared one were illegal a player could strand
   * themselves in a dead end with a full clock and no legal move. Backtracking
   * still costs travel time, which is the real price.
   */
  canReach(id: string): boolean {
    if (id === this.at) return false;
    if (id === this.def.stairs && !this.bossDown) return false;
    return this.def.nodes[this.at].links.includes(id);
  }

  /** True when the room has nothing left to give — you may still walk through it. */
  isSpent(id: string): boolean {
    const kind = this.def.nodes[id].kind;
    if (kind === 'entry' || kind === 'stairs') return true;
    // Safe rooms keep working; every other room is one-shot.
    if (kind === 'safe') return false;
    return this.visited.has(id);
  }

  /** Walk an edge. Returns false if the clock ran out getting there. */
  travelTo(id: string): boolean {
    this.at = id;
    return this.spendTime(CONFIG.floors.travelCostSec);
  }

  markVisited(id: string): void { this.visited.add(id); }

  /** How much of the floor has been cleared out, for the results screen. */
  progress(): { visited: number; total: number } {
    const all = clearableNodes(this.def);
    return { visited: all.filter((id) => this.visited.has(id)).length, total: all.length };
  }

  // ─────────────────────────── persistence ───────────────────────────

  toSave(): SavedRun {
    return {
      floor: this.def.index,
      timeLeft: this.timeLeft,
      visited: [...this.visited],
      at: this.at,
      party: this.party,
      partyPeak: this.partyPeak,
      goldThisRun: this.goldThisRun,
      xpThisRun: this.xpThisRun,
      kills: this.kills,
      losses: [...this.losses],
      hitHazard: this.hitHazard,
    };
  }

  /**
   * Rebuild from a save. Every field is re-clamped rather than trusted — a
   * hand-edited localStorage entry should produce a boring floor, not a crash.
   */
  static fromSave(s: SavedRun): RunState | null {
    if (typeof s?.floor !== 'number' || s.floor < 0 || s.floor >= CONFIG.floors.built) return null;
    const rs = new RunState(s.floor, 1);
    const valid = (id: unknown): id is string => typeof id === 'string' && id in rs.def.nodes;
    if (!valid(s.at)) return null;
    rs.timeLeft = Math.max(0, Math.min(rs.def.timeLimitSec, Number(s.timeLeft) || 0));
    if (rs.timeLeft <= 0) return null;
    rs.at = s.at;
    rs.visited = new Set((Array.isArray(s.visited) ? s.visited : []).filter(valid));
    rs.visited.add(rs.def.entry);
    rs.party = Math.max(0, Math.min(CONFIG.party.max, Math.round(Number(s.party) || 0)));
    if (rs.party <= 0) return null;
    rs.partyPeak = Math.max(rs.party, Math.round(Number(s.partyPeak) || 0));
    rs.goldThisRun = Math.max(0, Math.round(Number(s.goldThisRun) || 0));
    rs.xpThisRun = Math.max(0, Math.round(Number(s.xpThisRun) || 0));
    rs.kills = Math.max(0, Math.round(Number(s.kills) || 0));
    rs.losses = new Map(
      (Array.isArray(s.losses) ? s.losses : []).filter(
        (e): e is [string, number] => Array.isArray(e) && typeof e[0] === 'string' && typeof e[1] === 'number',
      ),
    );
    rs.hitHazard = s.hitHazard === true;
    return rs;
  }
}
