import './style.css';
import { blendScore } from '@shared/blend';
import { SPRITE, STAGE_H, STAGE_W } from '@shared/protocol';
import { STAGES } from '@shared/stages';
import { socket } from './net';
import { PaintEditor } from './paint';
import { drawScene } from './render';
import { store } from './state';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const panel = document.getElementById('panel') as HTMLElement;
const hud = document.getElementById('hud') as HTMLElement;
const overlay = document.getElementById('overlay') as HTMLElement;

let editor: PaintEditor | null = null;
let panelKey = '';
let crosshair: { x: number; y: number } | null = null;
const keys = new Set<string>();
const MOVE_SPEED = 240; // px/sec

// ---- socket wiring ----
socket.on('welcome', (id) => (store.youId = id));
socket.on('snapshot', (s) => {
  store.applySnapshot(s);
  if (s.phase !== 'results') hideOverlay();
});
socket.on('tick', (t) => store.applyTick(t));
socket.on('paint', (p) => store.applyPaint(p.id, p.grid, p.pose));
socket.on('roundEnd', (r) => showScoreboard(r.scores));
socket.on('errorMsg', (m) => toast(m));

store.onChange(syncPanel);

// ---- name entry ----
showNameModal();

function showNameModal(): void {
  overlay.className = 'show';
  overlay.innerHTML = `
    <div class="modal">
      <h1>🦎 MECCHA CHAMELEON</h1>
      <p>LAN hide &amp; seek — paint yourself to blend in, or hunt the hiders.</p>
      <input id="name-input" maxlength="16" placeholder="Your name" autofocus />
      <button id="join-btn">Join the game</button>
    </div>`;
  const input = document.getElementById('name-input') as HTMLInputElement;
  const join = () => {
    const name = input.value.trim() || 'Chameleon';
    socket.emit('join', name);
    hideOverlay();
  };
  document.getElementById('join-btn')!.addEventListener('click', join);
  input.addEventListener('keydown', (e) => e.key === 'Enter' && join());
  input.focus();
}

function hideOverlay(): void {
  overlay.className = '';
  overlay.innerHTML = '';
}

// ---- input ----
window.addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

canvas.addEventListener('mousemove', (e) => (crosshair = canvasPos(e)));
canvas.addEventListener('mousedown', (e) => {
  const pos = canvasPos(e);
  const me = store.me();
  if (!me) return;
  if (store.phase === 'hide' && me.role === 'hider' && editor) {
    editor.handleStageClick(pos.x, pos.y); // eyedropper sampling
  } else if (store.phase === 'seek' && me.role === 'seeker') {
    socket.emit('tag', pos);
  }
});

function canvasPos(e: MouseEvent): { x: number; y: number } {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * STAGE_W, y: ((e.clientY - r.top) / r.height) * STAGE_H };
}

// ---- main loop ----
let last = performance.now();
function loop(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  stepMovement(dt);
  drawScene(ctx, crosshair);
  updateHud();
  editor?.updateBlend();
  updateSeekPanels();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

let moveAccum = 0;
function stepMovement(dt: number): void {
  const me = store.me();
  if (!me || me.role !== 'hider' || store.phase !== 'hide') return;
  let dx = 0;
  let dy = 0;
  if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
  if (keys.has('d') || keys.has('arrowright')) dx += 1;
  if (keys.has('w') || keys.has('arrowup')) dy -= 1;
  if (keys.has('s') || keys.has('arrowdown')) dy += 1;
  if (dx === 0 && dy === 0) return;
  const len = Math.hypot(dx, dy) || 1;
  store.selfPos.x = clamp(store.selfPos.x + (dx / len) * MOVE_SPEED * dt, 0, STAGE_W - SPRITE);
  store.selfPos.y = clamp(store.selfPos.y + (dy / len) * MOVE_SPEED * dt, 0, STAGE_H - SPRITE);
  moveAccum += dt;
  if (moveAccum > 0.06) {
    moveAccum = 0;
    socket.emit('move', { x: store.selfPos.x, y: store.selfPos.y });
  }
}

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

function updateHud(): void {
  const secs = Math.ceil(store.remainingMs / 1000);
  const phaseText =
    store.phase === 'lobby'
      ? 'Lobby'
      : store.phase === 'hide'
        ? 'Hide!'
        : store.phase === 'seek'
          ? 'Seek!'
          : 'Results';
  hud.innerHTML = `<span class="phase">${phaseText}${store.round ? ` · Round ${store.round}` : ''}</span>${
    store.phase === 'hide' || store.phase === 'seek' ? `<span class="timer">${secs}s</span>` : ''
  }`;
}

// ---- panels ----
function syncPanel(): void {
  const me = store.me();
  const role = me?.role ?? 'hider';
  // In the lobby the panel must refresh as players join/leave, so fold the
  // roster + host into the key; elsewhere phase/role/alive/round is enough.
  const key =
    store.phase === 'lobby'
      ? `lobby:${store.hostId}:${[...store.players.keys()].sort().join(',')}`
      : `${store.phase}:${role}:${me?.alive ?? true}:${store.round}`;
  if (key === panelKey) return;
  panelKey = key;
  editor = null;

  if (store.phase === 'lobby') return renderLobby();
  if (store.phase === 'hide' && role === 'hider' && me?.alive) {
    editor = new PaintEditor(panel);
    return;
  }
  if (store.phase === 'hide') return renderInfo('Get ready, Seeker 🔦', 'The hiders are painting themselves into the scene. Study the room — the hunt begins when the timer ends.');
  if (store.phase === 'seek' && role === 'seeker') return renderSeekerSeek();
  if (store.phase === 'seek') return renderHiderSeek();
  renderInfo('Round over', 'Tallying scores…');
}

function renderLobby(): void {
  panel.innerHTML = '';
  const h = document.createElement('h2');
  h.textContent = 'Lobby';
  panel.append(h);

  const ul = document.createElement('ul');
  ul.className = 'players';
  for (const p of store.players.values()) {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = p.name;
    if (p.id === store.hostId) name.className = 'host';
    li.append(name);
    li.append(Object.assign(document.createElement('span'), { className: 'role', textContent: p.id === store.youId ? 'you' : '' }));
    ul.append(li);
  }
  panel.append(ul);

  if (store.isHost()) {
    const btn = document.createElement('button');
    btn.textContent = 'Start match';
    btn.disabled = store.players.size < 2;
    btn.addEventListener('click', () => socket.emit('startMatch'));
    panel.append(btn);
    if (store.players.size < 2) {
      panel.append(hintEl('Waiting for at least one more player to join…'));
    }
  } else {
    panel.append(hintEl('Waiting for the host to start the match.'));
  }
  panel.append(hintEl('Everyone on this network can join at the URL the host is sharing.'));
}

function renderHiderSeek(): void {
  panel.innerHTML = '';
  const me = store.me()!;
  const caught = !me.alive;
  panel.append(Object.assign(document.createElement('h2'), { textContent: caught ? 'Caught! 💥' : 'Hold still! 🦎' }));
  const blend = Math.round(blendScore(STAGES[store.stageId] ?? STAGES.workshop, me.x, me.y, me.grid, me.pose) * 100);
  if (!caught) {
    const b = document.createElement('div');
    b.className = 'blend';
    b.innerHTML = `Camouflage: ${blend}%`;
    b.style.color = blend > 80 ? 'var(--accent)' : blend > 55 ? '#f3c969' : 'var(--danger)';
    panel.append(b);
  }
  panel.append(hintEl(caught ? 'The seeker found you. Watch the rest of the round play out.' : 'Stay still. You earn points every moment you stay hidden — and a bonus for hiding out in the open.'));
  panel.append(Object.assign(document.createElement('div'), { className: 'blend', id: 'live-score', innerHTML: `Score: ${me.score}` }));
}

function renderSeekerSeek(): void {
  panel.innerHTML = '';
  panel.append(Object.assign(document.createElement('h2'), { textContent: 'You are the SEEKER 🔦' }));
  panel.append(hintEl('Click the hiders you can spot. A correct tag eliminates them; a miss costs you points. Find them all before time runs out.'));
  panel.append(Object.assign(document.createElement('div'), { className: 'blend', id: 'seeker-progress', innerHTML: '' }));
}

/** Patch live numbers into the seek-phase panels without rebuilding them. */
function updateSeekPanels(): void {
  if (store.phase !== 'seek') return;
  const me = store.me();
  if (!me) return;
  if (me.role === 'hider') {
    const el = document.getElementById('live-score');
    if (el) el.innerHTML = `Score: ${me.score}`;
  } else {
    const el = document.getElementById('seeker-progress');
    if (!el) return;
    const hiders = [...store.players.values()].filter((p) => p.role === 'hider');
    const found = hiders.filter((p) => !p.alive).length;
    el.innerHTML = `Found ${found} / ${hiders.length} · Score: ${me.score}`;
  }
}

function renderInfo(title: string, hint: string): void {
  panel.innerHTML = '';
  panel.append(Object.assign(document.createElement('h2'), { textContent: title }));
  panel.append(hintEl(hint));
}

function hintEl(text: string): HTMLElement {
  return Object.assign(document.createElement('p'), { className: 'hint', innerHTML: text });
}

// ---- results overlay ----
function showScoreboard(scores: { id: string; name: string; score: number }[]): void {
  overlay.className = 'show';
  const rows = scores
    .map((s, i) => `<li class="${i === 0 ? 'first' : ''}"><span>${i + 1}. ${escapeHtml(s.name)}${s.id === store.youId ? ' (you)' : ''}</span><b>${s.score}</b></li>`)
    .join('');
  const control = store.isHost()
    ? '<button id="next-btn">Next round</button>'
    : '<p class="hint">Waiting for the host to start the next round…</p>';
  overlay.innerHTML = `
    <div class="modal">
      <h1>Round ${store.round} results</h1>
      <ol class="scoreboard">${rows}</ol>
      ${control}
    </div>`;
  document.getElementById('next-btn')?.addEventListener('click', () => {
    socket.emit('nextRound');
    hideOverlay();
  });
}

function toast(msg: string): void {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText =
    'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#e06464;color:#fff;padding:10px 18px;border-radius:8px;z-index:20;font-weight:bold';
  document.body.append(t);
  setTimeout(() => t.remove(), 2600);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
}
