// Sprite decoding and canvas draw helpers. Sprites arrive as base64 PNGs
// (generated into assets.js by tools/build_web.py from the shared pixel
// art); they're decoded once into offscreen canvases plus flipped variants.

import { SPRITE_DATA } from "./assets.js";

export const PALETTE = {
  sky: "#a6ccd8",
  ink: "#140f12",
  gold: "#c78d1d",
  cream: "#f3ece0",
  maroon: "#992f3e",
  night: "#1e1a24",
};

export const FONT_STACK =
  '"Segoe UI", "Geeza Pro", "Noto Naskh Arabic", "Noto Sans Arabic", "Arial", sans-serif';

export const SPRITES = {};
const FLIPPED = {};

export function loadSprites() {
  const jobs = Object.entries(SPRITE_DATA).map(
    ([name, b64]) =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement("canvas");
          c.width = img.width;
          c.height = img.height;
          c.getContext("2d").drawImage(img, 0, 0);
          SPRITES[name] = c;
          resolve();
        };
        img.onerror = () => reject(new Error(`sprite ${name} failed to decode`));
        img.src = "data:image/png;base64," + b64;
      }),
  );
  return Promise.all(jobs);
}

export function flipped(name) {
  if (!FLIPPED[name]) {
    const src = SPRITES[name];
    const c = document.createElement("canvas");
    c.width = src.width;
    c.height = src.height;
    const ctx = c.getContext("2d");
    ctx.translate(src.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(src, 0, 0);
    FLIPPED[name] = c;
  }
  return FLIPPED[name];
}

export function drawText(ctx, text, { x, y, size, align = "center", color, bold = false, alpha = 1 }) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.font = `${bold ? "bold " : ""}${size}px ${FONT_STACK}`;
  ctx.direction = "rtl";
  ctx.textAlign = align === "center" ? "center" : align === "right" ? "right" : "left";
  ctx.textBaseline = "top";
  ctx.fillText(text, x, y);
  ctx.restore();
}
