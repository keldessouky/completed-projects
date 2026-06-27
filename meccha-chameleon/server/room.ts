import type { Server, Socket } from 'socket.io';
import { blendScore, cellIndex } from '../shared/blend';
import {
  ClientToServer,
  FIND_POINTS,
  GRID,
  Grid,
  HIDE_MS,
  MISS_PENALTY,
  Phase,
  Pose,
  POSE_MASKS,
  PlayerView,
  RESULTS_MS,
  RISK_MULTIPLIER,
  SEEK_MS,
  SPRITE,
  STAGE_H,
  STAGE_W,
  ServerToClient,
  Snapshot,
  SURVIVE_BONUS,
  SURVIVE_TICK_POINTS,
  TICK_MS,
} from '../shared/protocol';
import { DEFAULT_STAGE_ID, exposureAt, STAGES } from '../shared/stages';

type IO = Server<ClientToServer, ServerToClient>;
type IOSocket = Socket<ClientToServer, ServerToClient>;

interface ServerPlayer {
  id: string;
  name: string;
  role: 'hider' | 'seeker';
  x: number;
  y: number;
  pose: Pose;
  grid: Grid;
  alive: boolean;
  score: number;
  ready: boolean;
}

function whiteGrid(): Grid {
  return Array.from({ length: GRID * GRID }, () => [255, 255, 255] as [number, number, number]);
}

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export class Room {
  private players = new Map<string, ServerPlayer>();
  private phase: Phase = 'lobby';
  private round = 0;
  private endsAt = 0;
  private hostId = '';
  private seekerRotation = 0;
  private stageId = DEFAULT_STAGE_ID;

  private phaseTimer?: NodeJS.Timeout;

  // Phase durations (env-overridable so tests can run fast).
  private readonly hideMs = Number(process.env.HIDE_MS ?? HIDE_MS);
  private readonly seekMs = Number(process.env.SEEK_MS ?? SEEK_MS);
  private readonly resultsMs = Number(process.env.RESULTS_MS ?? RESULTS_MS);

  constructor(private io: IO) {
    setInterval(() => this.broadcastTick(), TICK_MS);
  }

  // ---- connection lifecycle ----

  attach(socket: IOSocket): void {
    socket.emit('welcome', socket.id);

    socket.on('join', (name) => this.onJoin(socket, name));
    socket.on('startMatch', () => this.onStartMatch(socket));
    socket.on('nextRound', () => this.onNextRound(socket));
    socket.on('toggleReady', () => this.onToggleReady(socket));
    socket.on('move', (pos) => this.onMove(socket, pos));
    socket.on('setPose', (pose) => this.onSetPose(socket, pose));
    socket.on('paint', (grid) => this.onPaint(socket, grid));
    socket.on('tag', (pos) => this.onTag(socket, pos));
    socket.on('disconnect', () => this.onDisconnect(socket));
  }

  private onJoin(socket: IOSocket, rawName: string): void {
    const name = (rawName || 'Chameleon').slice(0, 16).trim() || 'Chameleon';
    if (this.players.has(socket.id)) return;
    const player: ServerPlayer = {
      id: socket.id,
      name,
      role: 'hider',
      x: STAGE_W / 2,
      y: STAGE_H / 2,
      pose: 'stand',
      grid: whiteGrid(),
      alive: true,
      score: 0,
      ready: false,
    };
    this.players.set(socket.id, player);
    if (!this.hostId || !this.players.has(this.hostId)) this.hostId = socket.id;
    this.broadcastSnapshot();
  }

  private onDisconnect(socket: IOSocket): void {
    if (!this.players.delete(socket.id)) return;
    if (this.hostId === socket.id) {
      this.hostId = this.players.keys().next().value ?? '';
    }
    if (this.players.size === 0) {
      this.toLobby();
    } else if (this.phase !== 'lobby' && this.countByRole().hiders === 0) {
      // No hiders left to find — wrap the round up.
      this.endRound();
    }
    this.broadcastSnapshot();
  }

  // ---- host actions ----

  private onStartMatch(socket: IOSocket): void {
    if (socket.id !== this.hostId) return;
    if (this.phase !== 'lobby') return;
    if (this.players.size < 2) {
      socket.emit('errorMsg', 'Need at least 2 players to start.');
      return;
    }
    this.round = 0;
    for (const p of this.players.values()) p.score = 0;
    this.beginHide();
  }

  private onNextRound(socket: IOSocket): void {
    if (socket.id !== this.hostId) return;
    if (this.phase !== 'results') return;
    this.beginHide();
  }

  private onToggleReady(socket: IOSocket): void {
    const p = this.players.get(socket.id);
    if (!p) return;
    p.ready = !p.ready;
    this.broadcastSnapshot();
  }

  // ---- gameplay inputs ----

  private onMove(socket: IOSocket, pos: { x: number; y: number }): void {
    const p = this.players.get(socket.id);
    if (!p || p.role !== 'hider' || this.phase !== 'hide') return;
    p.x = clamp(pos.x, 0, STAGE_W - SPRITE);
    p.y = clamp(pos.y, 0, STAGE_H - SPRITE);
  }

  private onSetPose(socket: IOSocket, pose: Pose): void {
    const p = this.players.get(socket.id);
    if (!p || p.role !== 'hider' || this.phase !== 'hide') return;
    if (!POSE_MASKS[pose]) return;
    p.pose = pose;
    this.io.emit('paint', { id: p.id, grid: p.grid, pose: p.pose });
  }

  private onPaint(socket: IOSocket, grid: Grid): void {
    const p = this.players.get(socket.id);
    if (!p || p.role !== 'hider' || this.phase !== 'hide') return;
    if (!Array.isArray(grid) || grid.length !== GRID * GRID) return;
    p.grid = grid.map((c) => [clamp(c[0], 0, 255), clamp(c[1], 0, 255), clamp(c[2], 0, 255)] as [number, number, number]);
    this.io.emit('paint', { id: p.id, grid: p.grid, pose: p.pose });
  }

  private onTag(socket: IOSocket, pos: { x: number; y: number }): void {
    const seeker = this.players.get(socket.id);
    if (!seeker || seeker.role !== 'seeker' || this.phase !== 'seek') return;

    const stage = STAGES[this.stageId];
    for (const p of this.players.values()) {
      if (p.role !== 'hider' || !p.alive) continue;
      const col = Math.floor((pos.x - p.x) / (SPRITE / GRID));
      const row = Math.floor((pos.y - p.y) / (SPRITE / GRID));
      if (col < 0 || col >= GRID || row < 0 || row >= GRID) continue;
      if (!POSE_MASKS[p.pose][cellIndex(col, row)]) continue;
      // Hit a solid body cell of a hider.
      p.alive = false;
      const blend = blendScore(stage, p.x, p.y, p.grid, p.pose);
      seeker.score += Math.round(FIND_POINTS * (0.5 + blend)); // tougher finds pay more
      this.broadcastSnapshot();
      if (this.countByRole().hidersAlive === 0) this.endRound();
      return;
    }
    // Miss.
    seeker.score = Math.max(0, seeker.score - MISS_PENALTY);
    this.broadcastSnapshot();
  }

  // ---- phase machine ----

  private beginHide(): void {
    this.round += 1;
    this.assignRoles();
    const spots = spreadSpots(this.players.size);
    let i = 0;
    for (const p of this.players.values()) {
      p.alive = true;
      p.pose = 'stand';
      p.grid = whiteGrid();
      p.ready = false;
      if (p.role === 'hider') {
        const s = spots[i++ % spots.length];
        p.x = s.x;
        p.y = s.y;
      }
    }
    this.phase = 'hide';
    this.endsAt = Date.now() + this.hideMs;
    this.broadcastSnapshot();
    this.setPhaseTimer(this.hideMs, () => this.beginSeek());
  }

  private beginSeek(): void {
    this.phase = 'seek';
    this.endsAt = Date.now() + this.seekMs;
    this.broadcastSnapshot();
    this.setPhaseTimer(this.seekMs, () => this.endRound());
  }

  private endRound(): void {
    if (this.phase === 'results' || this.phase === 'lobby') return;
    const stage = STAGES[this.stageId];
    for (const p of this.players.values()) {
      if (p.role === 'hider' && p.alive) {
        const blend = blendScore(stage, p.x, p.y, p.grid, p.pose);
        p.score += Math.round(SURVIVE_BONUS * blend);
      }
    }
    this.phase = 'results';
    this.endsAt = Date.now() + this.resultsMs;
    this.broadcastSnapshot();
    this.io.emit('roundEnd', {
      scores: [...this.players.values()]
        .map((p) => ({ id: p.id, name: p.name, score: p.score }))
        .sort((a, b) => b.score - a.score),
    });
    this.setPhaseTimer(this.resultsMs, () => {
      if (this.players.size >= 2) this.beginHide();
      else this.toLobby();
    });
  }

  private toLobby(): void {
    this.clearPhaseTimer();
    this.phase = 'lobby';
    this.endsAt = 0;
    this.round = 0;
    this.broadcastSnapshot();
  }

  /** Award survival points each tick to alive hiders, scaled by blend + exposure. */
  private accrueSurvival(): void {
    if (this.phase !== 'seek') return;
    const stage = STAGES[this.stageId];
    for (const p of this.players.values()) {
      if (p.role !== 'hider' || !p.alive) continue;
      const blend = blendScore(stage, p.x, p.y, p.grid, p.pose);
      const exposure = exposureAt(stage, p.x + SPRITE / 2, p.y + SPRITE / 2);
      p.score += SURVIVE_TICK_POINTS * blend * (1 + exposure * RISK_MULTIPLIER);
    }
  }

  private assignRoles(): void {
    const ids = [...this.players.keys()];
    if (ids.length === 0) return;
    const seekerId = ids[this.seekerRotation % ids.length];
    this.seekerRotation += 1;
    for (const p of this.players.values()) p.role = p.id === seekerId ? 'seeker' : 'hider';
  }

  private countByRole(): { hiders: number; hidersAlive: number; seekers: number } {
    let hiders = 0;
    let hidersAlive = 0;
    let seekers = 0;
    for (const p of this.players.values()) {
      if (p.role === 'hider') {
        hiders++;
        if (p.alive) hidersAlive++;
      } else seekers++;
    }
    return { hiders, hidersAlive, seekers };
  }

  // ---- timers + broadcasting ----

  private setPhaseTimer(ms: number, fn: () => void): void {
    this.clearPhaseTimer();
    this.phaseTimer = setTimeout(fn, ms);
  }

  private clearPhaseTimer(): void {
    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    this.phaseTimer = undefined;
  }

  private toView(p: ServerPlayer): PlayerView {
    return {
      id: p.id,
      name: p.name,
      role: p.role,
      x: p.x,
      y: p.y,
      pose: p.pose,
      alive: p.alive,
      score: Math.round(p.score),
      ready: p.ready,
      grid: p.grid,
    };
  }

  private snapshot(): Snapshot {
    return {
      phase: this.phase,
      round: this.round,
      stageId: this.stageId,
      endsAt: this.endsAt,
      hostId: this.hostId,
      players: [...this.players.values()].map((p) => this.toView(p)),
    };
  }

  private broadcastSnapshot(): void {
    this.io.emit('snapshot', this.snapshot());
  }

  private broadcastTick(): void {
    this.accrueSurvival();
    if (this.players.size === 0) return;
    this.io.emit('tick', {
      remainingMs: this.endsAt > 0 ? Math.max(0, this.endsAt - Date.now()) : 0,
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        alive: p.alive,
        score: Math.round(p.score),
      })),
    });
  }
}

/** Spread hider start positions across the stage. */
function spreadSpots(n: number): { x: number; y: number }[] {
  const spots: { x: number; y: number }[] = [];
  const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
  const rows = Math.ceil(n / cols);
  const padX = 120;
  const padY = 120;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      spots.push({
        x: padX + (c / Math.max(1, cols - 1 || 1)) * (STAGE_W - 2 * padX - SPRITE),
        y: padY + (r / Math.max(1, rows - 1 || 1)) * (STAGE_H - 2 * padY - SPRITE),
      });
    }
  }
  return spots;
}
