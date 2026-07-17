import { blendScore } from '@shared/blend';
import { Color, GRID, Grid, Pose, POSE_MASKS, POSES } from '@shared/protocol';
import { shadedColorAt, STAGES } from '@shared/stages';
import { socket } from './net';
import { store } from './state';

const PALETTE: Color[] = [
  [120, 96, 72], [150, 110, 60], [86, 94, 104], [70, 78, 92],
  [70, 120, 80], [180, 70, 70], [44, 46, 52], [200, 180, 150],
  [40, 40, 40], [255, 255, 255], [110, 80, 50], [60, 90, 70],
];

const white = (): Color => [255, 255, 255];

/** Hide-phase editor for a hider: paint grid, palette, eyedropper, poses. */
export class PaintEditor {
  working: Grid;
  pose: Pose;
  brush: Color = [120, 96, 72];
  eyedropper = false;
  private sendTimer?: number;

  constructor(private root: HTMLElement) {
    const me = store.me();
    this.working = me ? me.grid.map((c) => [...c] as Color) : Array.from({ length: GRID * GRID }, white);
    this.pose = me?.pose ?? 'stand';
    this.render();
  }

  /** Returns true if the click was consumed by the eyedropper. */
  handleStageClick(x: number, y: number): boolean {
    if (!this.eyedropper) return false;
    this.brush = shadedColorAt(STAGES[store.stageId] ?? STAGES.workshop, x, y);
    this.eyedropper = false;
    this.render();
    return true;
  }

  liveBlend(): number {
    return blendScore(STAGES[store.stageId] ?? STAGES.workshop, store.selfPos.x, store.selfPos.y, this.working, this.pose);
  }

  private queueSend(): void {
    if (this.sendTimer) return;
    this.sendTimer = window.setTimeout(() => {
      this.sendTimer = undefined;
      socket.emit('paint', this.working);
    }, 80);
  }

  private setPose(pose: Pose): void {
    this.pose = pose;
    socket.emit('setPose', pose);
    this.render();
  }

  private render(): void {
    const mask = POSE_MASKS[this.pose];
    this.root.innerHTML = '';

    const h = document.createElement('h2');
    h.textContent = '🎨 Paint your camouflage';
    this.root.append(h);

    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.innerHTML =
      'Move with <b>WASD / arrows</b>. Use the <b>eyedropper</b> to sample the surface, paint your body to match — add lighter/darker shades, never one flat color.';
    this.root.append(hint);

    // blend readout
    const blend = document.createElement('div');
    blend.className = 'blend';
    blend.id = 'blend-readout';
    this.root.append(blend);

    // paint grid
    const grid = document.createElement('div');
    grid.className = 'paint-grid';
    for (let i = 0; i < GRID * GRID; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell' + (mask[i] ? '' : ' off');
      const c = this.working[i];
      cell.style.background = `rgb(${c[0]},${c[1]},${c[2]})`;
      cell.addEventListener('mousedown', () => this.paintCell(i, grid));
      cell.addEventListener('mouseenter', (e) => {
        if ((e as MouseEvent).buttons === 1) this.paintCell(i, grid);
      });
      grid.append(cell);
    }
    this.root.append(grid);

    // palette + tools
    const palette = document.createElement('div');
    palette.className = 'palette';
    for (const c of PALETTE) {
      const sw = document.createElement('div');
      sw.className = 'swatch' + (sameColor(c, this.brush) ? ' active' : '');
      sw.style.background = `rgb(${c[0]},${c[1]},${c[2]})`;
      sw.addEventListener('click', () => {
        this.brush = [...c] as Color;
        this.eyedropper = false;
        this.render();
      });
      palette.append(sw);
    }
    this.root.append(palette);

    const tools = document.createElement('div');
    tools.className = 'tools';
    const brushPreview = document.createElement('div');
    brushPreview.className = 'brush';
    brushPreview.style.background = `rgb(${this.brush[0]},${this.brush[1]},${this.brush[2]})`;
    tools.append(brushPreview);

    const eye = document.createElement('button');
    eye.className = 'secondary';
    eye.textContent = this.eyedropper ? '💧 Click the stage…' : '💧 Eyedropper';
    eye.addEventListener('click', () => {
      this.eyedropper = !this.eyedropper;
      this.render();
    });
    tools.append(eye);

    const fill = document.createElement('button');
    fill.className = 'secondary';
    fill.textContent = 'Fill body';
    fill.addEventListener('click', () => {
      for (let i = 0; i < this.working.length; i++) if (mask[i]) this.working[i] = [...this.brush] as Color;
      this.queueSend();
      this.render();
    });
    tools.append(fill);
    this.root.append(tools);

    // poses
    const posesLabel = document.createElement('div');
    posesLabel.className = 'hint';
    posesLabel.textContent = 'Pose (changes your silhouette):';
    this.root.append(posesLabel);

    const poses = document.createElement('div');
    poses.className = 'poses';
    for (const pose of POSES) {
      const b = document.createElement('button');
      b.className = 'secondary' + (pose === this.pose ? ' active' : '');
      b.textContent = pose;
      b.addEventListener('click', () => this.setPose(pose));
      poses.append(b);
    }
    this.root.append(poses);

    this.updateBlend();
  }

  private paintCell(i: number, gridEl: HTMLElement): void {
    if (!POSE_MASKS[this.pose][i]) return;
    this.working[i] = [...this.brush] as Color;
    const cell = gridEl.children[i] as HTMLElement;
    cell.style.background = `rgb(${this.brush[0]},${this.brush[1]},${this.brush[2]})`;
    this.queueSend();
    this.updateBlend();
  }

  updateBlend(): void {
    const el = document.getElementById('blend-readout');
    if (!el) return;
    const pct = Math.round(this.liveBlend() * 100);
    el.innerHTML = `Camouflage: ${pct}% <small>(higher = harder to spot)</small>`;
    el.style.color = pct > 80 ? 'var(--accent)' : pct > 55 ? '#f3c969' : 'var(--danger)';
  }
}

function sameColor(a: Color, b: Color): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}
