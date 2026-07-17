import type { Phase, PlayerView, Pose, Snapshot, Tick } from '@shared/protocol';

// Client-side authoritative-mirror of the game, patched by snapshot/tick/paint.
export class Store {
  youId = '';
  phase: Phase = 'lobby';
  round = 0;
  hostId = '';
  stageId = 'workshop';
  endsAt = 0;
  remainingMs = 0;
  players = new Map<string, PlayerView>();

  // Local client-side prediction of our own position during the hide phase.
  selfPos = { x: 0, y: 0 };

  private listeners = new Set<() => void>();

  onChange(fn: () => void): void {
    this.listeners.add(fn);
  }
  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  me(): PlayerView | undefined {
    return this.players.get(this.youId);
  }
  isHost(): boolean {
    return this.youId === this.hostId;
  }

  applySnapshot(s: Snapshot): void {
    const prevPhase = this.phase;
    this.phase = s.phase;
    this.round = s.round;
    this.hostId = s.hostId;
    this.stageId = s.stageId;
    this.endsAt = s.endsAt;
    this.players = new Map(s.players.map((p) => [p.id, { ...p }]));
    const me = this.me();
    // Re-sync local position on (re)spawn or phase change — the server places us.
    if (me && (prevPhase !== s.phase || s.phase === 'hide')) {
      this.selfPos = { x: me.x, y: me.y };
    }
    this.emit();
  }

  applyTick(t: Tick): void {
    this.remainingMs = t.remainingMs;
    for (const pt of t.players) {
      const p = this.players.get(pt.id);
      if (!p) continue;
      p.alive = pt.alive;
      p.score = pt.score;
      if (pt.id !== this.youId) {
        p.x = pt.x;
        p.y = pt.y;
      }
    }
    this.emit();
  }

  applyPaint(id: string, grid: PlayerView['grid'], pose: Pose): void {
    const p = this.players.get(id);
    if (!p) return;
    p.grid = grid;
    p.pose = pose;
    this.emit();
  }
}

export const store = new Store();
