import { CONFIG, type EnemyKind, type GearSlot } from '../config';
import { reserveIds } from '../game/loot';
import type { Equipped } from '../game/stats';
import type { GearItem, Poi, QuestState, SavedWorld, Vec } from '../types';
import { QUESTS, goalTarget, questById } from './quests';
import { getWorld, poiById } from './worldgen';

const FOG = CONFIG.minimap.fogCells;

/**
 * The live world.
 *
 * This deliberately does NOT live in a scene. `SceneManager.goto()` destroys
 * the outgoing scene wholesale, and roaming is punctuated by inventory, shop,
 * dialogue and character screens — so position, health, quest progress and the
 * fog of war all hang off the game context instead.
 *
 * It is also the unit of persistence. Terrain and POI layout are pure functions
 * of the seed, so nothing here stores the world itself: only what the player
 * did to it.
 */
export class WorldState {
  x: number;
  y: number;
  /** 0 means "not resolved yet"; the world scene fills it from the loadout */
  hp = 0;
  /** which way the sprite faces: −1 left, 1 right */
  face = 1;

  discovered = new Set<string>();
  /** poi id → the play-time second at which it was emptied */
  cleared = new Map<string, number>();
  shrines = new Set<string>();

  quests = new Map<string, QuestState>();
  progress = new Map<string, number>();

  inventory: GearItem[] = [];
  equipped: Equipped = {};

  /** one byte per fog cell: 0 unseen, 1 seen */
  fog = new Uint8Array(FOG * FOG);
  bossDown = false;
  home = 'town_a';

  /** seconds of roaming, used for camp respawn timers and the save clock */
  clock = 0;

  constructor() {
    const w = getWorld();
    this.x = w.spawn.x;
    this.y = w.spawn.y;
    for (const q of QUESTS) this.quests.set(q.id, q.requires.length === 0 ? 'offered' : 'locked');
    this.discover('town_a', true);
  }

  // ─────────────────────────── exploration ───────────────────────────

  /** Reveal the fog around a world position. */
  revealAround(x: number, y: number): void {
    const size = CONFIG.world.size;
    const cell = size / FOG;
    const r = Math.ceil(CONFIG.minimap.revealRadius / cell);
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    for (let j = cy - r; j <= cy + r; j++) {
      if (j < 0 || j >= FOG) continue;
      for (let i = cx - r; i <= cx + r; i++) {
        if (i < 0 || i >= FOG) continue;
        const dx = (i - cx) * cell, dy = (j - cy) * cell;
        if (dx * dx + dy * dy <= CONFIG.minimap.revealRadius ** 2) this.fog[j * FOG + i] = 1;
      }
    }
  }

  /** Returns the POI if this call is what discovered it, else null. */
  discover(id: string, silent = false): Poi | null {
    if (this.discovered.has(id)) return null;
    this.discovered.add(id);
    this.bumpProgress('discover');
    return silent ? null : (poiById(id) ?? null);
  }

  // ─────────────────────────── population ───────────────────────────

  /** A camp is live again once its respawn timer has run out. */
  isCleared(id: string): boolean {
    const at = this.cleared.get(id);
    if (at === undefined) return false;
    // the lair stays cleared forever — the boss does not come back
    if (poiById(id)?.kind === 'lair') return true;
    return this.clock - at < CONFIG.enemies.respawnSec;
  }

  markCleared(id: string): void {
    this.cleared.set(id, this.clock);
    const kind = poiById(id)?.kind;
    if (kind === 'camp') this.bumpProgress('clear');
  }

  useShrine(id: string): boolean {
    if (this.shrines.has(id)) return false;
    this.shrines.add(id);
    return true;
  }

  // ─────────────────────────── quests ───────────────────────────

  state(id: string): QuestState { return this.quests.get(id) ?? 'locked'; }
  getProgress(id: string): number { return this.progress.get(id) ?? 0; }

  /** Quests this NPC can currently hand over or take back. */
  offeredBy(npcId: string): { offer: string[]; ready: string[] } {
    const offer: string[] = [];
    const ready: string[] = [];
    for (const q of QUESTS) {
      if (q.giver !== npcId) continue;
      const s = this.state(q.id);
      if (s === 'offered') offer.push(q.id);
      else if (s === 'ready') ready.push(q.id);
    }
    return { offer, ready };
  }

  accept(id: string): void {
    if (this.state(id) !== 'offered') return;
    this.quests.set(id, 'active');
    // a quest whose goal is already satisfied should not need busywork
    this.checkReady(id);
  }

  /** Mark complete. The caller pays the reward. */
  complete(id: string): void {
    if (this.state(id) !== 'ready') return;
    this.quests.set(id, 'done');
    for (const q of QUESTS) {
      if (this.state(q.id) === 'locked' && q.requires.every((r) => this.state(r) === 'done')) {
        this.quests.set(q.id, 'offered');
      }
    }
  }

  /**
   * Advance every active quest whose goal matches this event.
   * Returns the ids that just became turn-in-able, so the caller can announce
   * them once rather than every frame.
   */
  private bumpProgress(kind: 'kill' | 'discover' | 'clear' | 'boss', enemy?: EnemyKind): string[] {
    const nowReady: string[] = [];
    for (const q of QUESTS) {
      if (this.state(q.id) !== 'active') continue;
      const g = q.goal;
      const hit =
        (kind === 'kill' && g.type === 'kill' && g.kind === enemy) ||
        (kind === 'discover' && g.type === 'discover') ||
        (kind === 'clear' && g.type === 'clear') ||
        (kind === 'boss' && g.type === 'boss');
      if (!hit) continue;
      this.progress.set(q.id, this.getProgress(q.id) + 1);
      if (this.checkReady(q.id)) nowReady.push(q.id);
    }
    return nowReady;
  }

  private checkReady(id: string): boolean {
    const q = questById(id);
    if (!q || this.state(id) !== 'active') return false;
    if (this.getProgress(id) >= goalTarget(q)) {
      this.quests.set(id, 'ready');
      return true;
    }
    return false;
  }

  /** Call on every enemy death. Returns quests that just became ready. */
  onKill(kind: EnemyKind): string[] {
    const ready = this.bumpProgress('kill', kind);
    if (kind === 'boss') {
      this.bossDown = true;
      ready.push(...this.bumpProgress('boss'));
    }
    return ready;
  }

  /** Quests that became ready from discovery or clearing, drained by the scene. */
  drainReady(): string[] {
    const out: string[] = [];
    for (const q of QUESTS) if (this.state(q.id) === 'ready' && !this.announced.has(q.id)) {
      this.announced.add(q.id);
      out.push(q.id);
    }
    return out;
  }
  private announced = new Set<string>();

  // ─────────────────────────── inventory ───────────────────────────

  addGear(g: GearItem): void { this.inventory.push(g); }

  removeGear(id: string): GearItem | null {
    const i = this.inventory.findIndex((g) => g.id === id);
    return i < 0 ? null : this.inventory.splice(i, 1)[0];
  }

  /** Equip from the bag; whatever was in the slot goes back to the bag. */
  equip(id: string): boolean {
    const g = this.removeGear(id);
    if (!g) return false;
    const old = this.equipped[g.slot];
    if (old) this.inventory.push(old);
    this.equipped[g.slot] = g;
    return true;
  }

  unequip(slot: GearSlot): void {
    const g = this.equipped[slot];
    if (!g) return;
    delete this.equipped[slot];
    this.inventory.push(g);
  }

  // ─────────────────────────── persistence ───────────────────────────

  /** Fog is run-length encoded: it is 4096 mostly-identical bytes. */
  private encodeFog(): number[] {
    const out: number[] = [];
    let cur = 0, run = 0;
    for (let i = 0; i < this.fog.length; i++) {
      const v = this.fog[i];
      if (v === cur) run++;
      else { out.push(run); cur = v; run = 1; }
    }
    out.push(run);
    return out;
  }

  private decodeFog(runs: number[]): void {
    this.fog.fill(0);
    let i = 0, v = 0;
    for (const run of runs) {
      const n = Math.max(0, Math.min(this.fog.length - i, Math.round(run) || 0));
      if (v === 1) this.fog.fill(1, i, i + n);
      i += n;
      v = v === 0 ? 1 : 0;
      if (i >= this.fog.length) break;
    }
  }

  toSave(): SavedWorld {
    return {
      x: this.x,
      y: this.y,
      discovered: [...this.discovered],
      cleared: [...this.cleared],
      shrines: [...this.shrines],
      quests: [...this.quests],
      progress: [...this.progress],
      inventory: this.inventory,
      equipped: this.equipped,
      fog: this.encodeFog(),
      bossDown: this.bossDown,
      home: this.home,
    };
  }

  /**
   * Rebuild from a save. Every field is re-clamped rather than trusted — a
   * hand-edited localStorage entry should produce a boring world, not a crash.
   */
  static fromSave(s: SavedWorld): WorldState {
    const w = new WorldState();
    const size = CONFIG.world.size;
    const clamp = (v: unknown, lo: number, hi: number, d: number): number =>
      typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;

    w.x = clamp(s?.x, 0, size, w.x);
    w.y = clamp(s?.y, 0, size, w.y);
    const known = new Set(getWorld().pois.map((p) => p.id));
    const okId = (id: unknown): id is string => typeof id === 'string' && known.has(id);

    if (Array.isArray(s?.discovered)) w.discovered = new Set(s.discovered.filter(okId));
    w.discovered.add('town_a');
    if (Array.isArray(s?.cleared)) {
      w.cleared = new Map(
        s.cleared.filter((e): e is [string, number] =>
          Array.isArray(e) && okId(e[0]) && typeof e[1] === 'number'),
      );
    }
    if (Array.isArray(s?.shrines)) w.shrines = new Set(s.shrines.filter(okId));

    const validState = (v: unknown): v is QuestState =>
      v === 'locked' || v === 'offered' || v === 'active' || v === 'ready' || v === 'done';
    if (Array.isArray(s?.quests)) {
      for (const e of s.quests) {
        if (Array.isArray(e) && questById(e[0]) && validState(e[1])) w.quests.set(e[0], e[1]);
      }
    }
    if (Array.isArray(s?.progress)) {
      for (const e of s.progress) {
        if (Array.isArray(e) && questById(e[0]) && typeof e[1] === 'number') {
          w.progress.set(e[0], Math.max(0, Math.round(e[1])));
        }
      }
    }
    // anything already turned in should not re-announce itself
    for (const [id, st] of w.quests) if (st === 'ready' || st === 'done') w.announced.add(id);

    const okGear = (g: unknown): g is GearItem => {
      const o = g as GearItem;
      return !!o && typeof o.id === 'string' && typeof o.budget === 'number'
        && CONFIG.gear.slots.includes(o.slot) && CONFIG.loot.tiers.includes(o.tier);
    };
    w.inventory = Array.isArray(s?.inventory) ? s.inventory.filter(okGear).slice(0, 64) : [];
    w.equipped = {};
    if (s?.equipped && typeof s.equipped === 'object') {
      for (const slot of CONFIG.gear.slots) {
        const g = (s.equipped as Equipped)[slot];
        if (okGear(g) && g.slot === slot) w.equipped[slot] = g;
      }
    }
    reserveIds([...w.inventory, ...Object.values(w.equipped)]);

    if (Array.isArray(s?.fog)) w.decodeFog(s.fog);
    w.bossDown = s?.bossDown === true;
    w.home = okId(s?.home) ? s.home : 'town_a';
    return w;
  }

  /** The town the player wakes up in after dying. */
  homePos(): Vec {
    const p = poiById(this.home) ?? poiById('town_a')!;
    return { x: p.x, y: p.y + 96 };
  }
}
