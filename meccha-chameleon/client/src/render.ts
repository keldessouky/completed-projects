import { cellIndex } from '@shared/blend';
import { CELL, Color, GRID, POSE_MASKS, SPRITE, STAGE_H, STAGE_W } from '@shared/protocol';
import { noiseAt, shadedColorAt, STAGES } from '@shared/stages';
import { store } from './state';

const stageCache = new Map<string, HTMLCanvasElement>();

/** Pre-render a stage (gradient + subtle noise) once, then blit each frame. */
function stageBitmap(stageId: string): HTMLCanvasElement {
  const cached = stageCache.get(stageId);
  if (cached) return cached;

  const stage = STAGES[stageId] ?? STAGES.workshop;
  const c = document.createElement('canvas');
  c.width = STAGE_W;
  c.height = STAGE_H;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(STAGE_W, STAGE_H);
  const d = img.data;
  for (let y = 0; y < STAGE_H; y++) {
    for (let x = 0; x < STAGE_W; x++) {
      const base = shadedColorAt(stage, x, y);
      const n = noiseAt(x, y);
      const o = (y * STAGE_W + x) * 4;
      d[o] = clamp(base[0] + n);
      d[o + 1] = clamp(base[1] + n);
      d[o + 2] = clamp(base[2] + n);
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  stageCache.set(stageId, c);
  return c;
}

const clamp = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : v);
const rgb = (c: Color): string => `rgb(${c[0]},${c[1]},${c[2]})`;

export function drawScene(ctx: CanvasRenderingContext2D, crosshair: { x: number; y: number } | null): void {
  ctx.clearRect(0, 0, STAGE_W, STAGE_H);
  ctx.drawImage(stageBitmap(store.stageId), 0, 0);

  const me = store.me();
  const myId = store.youId;

  for (const p of store.players.values()) {
    if (p.role === 'seeker') continue; // seeker has no body on the stage
    const isSelf = p.id === myId;
    const px = isSelf ? store.selfPos.x : p.x;
    const py = isSelf ? store.selfPos.y : p.y;
    const mask = POSE_MASKS[p.pose];

    for (let row = 0; row < GRID; row++) {
      for (let col = 0; col < GRID; col++) {
        if (!mask[cellIndex(col, row)]) continue;
        const color = p.grid[cellIndex(col, row)] ?? [255, 255, 255];
        ctx.fillStyle = rgb(color);
        ctx.fillRect(px + col * CELL, py + row * CELL, CELL, CELL);
      }
    }

    if (!p.alive) {
      // Caught — mark with a red cross so everyone can see.
      ctx.strokeStyle = 'rgba(224,100,100,0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + SPRITE, py + SPRITE);
      ctx.moveTo(px + SPRITE, py);
      ctx.lineTo(px, py + SPRITE);
      ctx.stroke();
    }

    // During the hide phase, outline yourself so you can find your own body.
    if (isSelf && store.phase === 'hide') {
      ctx.strokeStyle = 'rgba(91,214,160,0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(px - 2, py - 2, SPRITE + 4, SPRITE + 4);
      ctx.setLineDash([]);
    }
  }

  // Seeker crosshair while seeking.
  if (me?.role === 'seeker' && store.phase === 'seek' && crosshair) {
    ctx.strokeStyle = 'rgba(243,201,105,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(crosshair.x, crosshair.y, 16, 0, Math.PI * 2);
    ctx.moveTo(crosshair.x - 22, crosshair.y);
    ctx.lineTo(crosshair.x + 22, crosshair.y);
    ctx.moveTo(crosshair.x, crosshair.y - 22);
    ctx.lineTo(crosshair.x, crosshair.y + 22);
    ctx.stroke();
  }
}
