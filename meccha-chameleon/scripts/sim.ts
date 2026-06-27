/**
 * Headless end-to-end check: spawns the server (with fast phases), connects
 * three socket clients, plays one full round, and asserts the core loop —
 * role assignment, painting/blend scoring, seeker tagging, and round results.
 *
 * Run: npm run test:sim
 */
import { spawn } from 'node:child_process';
import { io, Socket } from 'socket.io-client';
import { cellCenter } from '../shared/blend';
import { GRID, Grid, SPRITE, Snapshot } from '../shared/protocol';
import { shadedColorAt, STAGES } from '../shared/stages';

const PORT = 3100;
const URL = `http://localhost:${PORT}`;

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function until(label: string, cond: () => boolean, timeoutMs = 8000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error(`timeout waiting for: ${label}`);
    await wait(40);
  }
}

class Client {
  socket: Socket;
  id = '';
  snap?: Snapshot;
  constructor(public name: string) {
    this.socket = io(URL, { forceNew: true });
    this.socket.on('welcome', (id: string) => (this.id = id));
    this.socket.on('snapshot', (s: Snapshot) => (this.snap = s));
  }
  me() {
    return this.snap?.players.find((p) => p.id === this.id);
  }
  paintToBlend(): void {
    const me = this.me();
    if (!me) return;
    const stage = STAGES[this.snap!.stageId] ?? STAGES.workshop;
    const grid: Grid = [];
    for (let row = 0; row < GRID; row++) {
      for (let col = 0; col < GRID; col++) {
        const { cx, cy } = cellCenter(me.x, me.y, col, row);
        grid.push(shadedColorAt(stage, cx, cy));
      }
    }
    this.socket.emit('paint', grid);
  }
}

let failed = false;
function check(label: string, ok: boolean): void {
  console.log(`  ${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failed = true;
}

async function main(): Promise<void> {
  const server = spawn('node_modules/.bin/tsx', ['server/index.ts'], {
    env: { ...process.env, PORT: String(PORT), HIDE_MS: '1200', SEEK_MS: '1600', RESULTS_MS: '600' },
    stdio: ['ignore', 'ignore', 'inherit'],
  });

  try {
    const a = new Client('Ana');
    const b = new Client('Bo');
    const c = new Client('Cy');
    const clients = [a, b, c];

    await until('all clients connected', () => clients.every((cl) => cl.id !== ''));
    for (const cl of clients) cl.socket.emit('join', cl.name);
    await until('lobby shows 3 players', () => (a.snap?.players.length ?? 0) === 3);
    check('all players joined the lobby', a.snap!.players.length === 3);

    const host = clients.find((cl) => cl.id === a.snap!.hostId)!;
    host.socket.emit('startMatch');

    await until('hide phase started', () => a.snap?.phase === 'hide');
    const roles = a.snap!.players;
    const seekers = roles.filter((p) => p.role === 'seeker');
    const hiders = roles.filter((p) => p.role === 'hider');
    check('exactly one seeker assigned', seekers.length === 1);
    check('the rest are hiders', hiders.length === 2);

    // Hiders paint themselves to match the surface (near-perfect camouflage).
    for (const cl of clients) if (cl.me()?.role === 'hider') cl.paintToBlend();

    const seeker = clients.find((cl) => cl.me()?.role === 'seeker')!;

    await until('seek phase started', () => a.snap?.phase === 'seek');

    // Seeker tags the first alive hider at its body center.
    const target = seeker.snap!.players.find((p) => p.role === 'hider' && p.alive)!;
    seeker.socket.emit('tag', { x: target.x + SPRITE / 2, y: target.y + SPRITE / 2 });

    await until('tagged hider eliminated', () => {
      const t = a.snap?.players.find((p) => p.id === target.id);
      return t ? !t.alive : false;
    });
    check('seeker tag eliminated a hider', true);
    const seekerView = a.snap!.players.find((p) => p.id === seeker.id)!;
    check('seeker scored from the tag', seekerView.score > 0);

    let ended: { scores: { id: string; name: string; score: number }[] } | null = null;
    a.socket.on('roundEnd', (r) => (ended = r));

    await until('round ended', () => ended !== null, 6000);
    await until('results phase', () => a.snap?.phase === 'results');
    const scores = ended!.scores;
    check('round produced a scoreboard', scores.length === 3);
    const survivingHider = hiders.find((h) => h.id !== target.id)!;
    const hiderScore = scores.find((s) => s.id === survivingHider.id)!.score;
    check('a well-camouflaged hider earned points', hiderScore > 0);

    for (const cl of clients) cl.socket.disconnect();
  } finally {
    server.kill('SIGTERM');
  }

  await wait(150);
  console.log(failed ? '\nSIM FAILED\n' : '\nSIM PASSED\n');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
