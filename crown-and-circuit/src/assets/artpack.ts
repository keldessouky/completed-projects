import { Rectangle, Texture } from 'pixi.js';
import type { GameAtlas } from './atlas';

/**
 * Optional external art packs.
 *
 * The game ships with its own procedural pixel art so it always runs, but any
 * frame can be overridden by dropping images into `public/art/` alongside a
 * `manifest.json`. Nothing is bundled and nothing is committed — the pack stays
 * on your machine, which also keeps you clear of licences that permit use but
 * forbid redistribution.
 *
 * manifest.json maps atlas frame names to either a standalone image:
 *
 *   { "king0": "king-iron.png", "e_runner": "runner.png" }
 *
 * …or a rectangle inside a sheet:
 *
 *   { "e_runner": { "src": "chars.png", "x": 0, "y": 0, "w": 32, "h": 32 } }
 *
 * Frame names are the ones in atlas.ts: king0..4, sol0_0..sol4_2, e_runner,
 * e_brute, e_shooter, e_flyer, e_boss, tower0..4, keep0..4, wall0..4,
 * barracks, forge, coin, shard, p0..p4.
 */
export interface PackEntry {
  src: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  /** world units per source pixel; defaults to keeping the art's own size */
  scale?: number;
}

type Manifest = Record<string, string | PackEntry>;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image failed: ' + url));
    img.src = url;
  });
}

/**
 * Apply `public/art/manifest.json` over the built-in atlas, if it exists.
 * Missing manifest, missing images and malformed entries are all non-fatal:
 * anything that fails simply keeps the procedural sprite.
 */
export async function applyArtPack(atlas: GameAtlas, base: string): Promise<number> {
  const root = `${base}art/`;
  let manifest: Manifest;
  try {
    const res = await fetch(root + 'manifest.json', { cache: 'no-cache' });
    if (!res.ok) return 0;
    manifest = (await res.json()) as Manifest;
  } catch {
    return 0;   // no pack installed — the normal case
  }

  const sheets = new Map<string, HTMLImageElement>();
  let applied = 0;

  for (const [frame, valueRaw] of Object.entries(manifest)) {
    const value: PackEntry = typeof valueRaw === 'string' ? { src: valueRaw } : valueRaw;
    if (!value || typeof value.src !== 'string') continue;
    try {
      let img = sheets.get(value.src);
      if (!img) {
        img = await loadImage(root + value.src);
        sheets.set(value.src, img);
      }
      const source = Texture.from(img).source;
      // pixel art must never be smoothed; packs are almost always pixel art
      source.scaleMode = 'nearest';
      const x = value.x ?? 0;
      const y = value.y ?? 0;
      const w = value.w ?? img.naturalWidth;
      const h = value.h ?? img.naturalHeight;
      atlas.frames[frame] = new Texture({ source, frame: new Rectangle(x, y, w, h) });
      applied++;
    } catch (err) {
      console.warn(`[art pack] skipped "${frame}":`, err);
    }
  }

  if (applied > 0) console.info(`[art pack] ${applied} frames overridden from ${root}`);
  return applied;
}
