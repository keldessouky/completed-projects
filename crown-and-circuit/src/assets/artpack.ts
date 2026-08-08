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
 * Units are animated, so their frames are numbered: king<era>_<0..3> and
 * sol<era>_<tier>_<0..3>. Static frames keep plain names: e_runner, e_brute,
 * e_shooter, e_flyer, e_boss, tower0..4, keep0..4, wall0..4, barracks, forge,
 * coin, shard, p0..p4, pEnemy.
 */
export interface PackEntry {
  src: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

/**
 * An animation strip: a row of equal-sized frames inside a sheet. Sliced into
 * the numbered frames the game already animates (`king0_0`…`king0_3`), looping
 * or clamping the source strip to fit however many frames it has.
 */
export interface PackStrip {
  src: string;
  /**
   * Frame size in source pixels. Both are optional: for a single-row strip,
   * leaving them out derives them from the image (width / frames, full height),
   * so you never have to measure a sheet by hand.
   */
  frameW?: number;
  frameH?: number;
  /** how many frames the strip actually has */
  frames: number;
  /** which row of the sheet (defaults to 0) */
  row?: number;
  /** first frame's column (defaults to 0) */
  col?: number;
  /** target frame names get this suffix range: name_0 … name_(count-1) */
  count?: number;
}

type ManifestValue = string | PackEntry | PackStrip;
type Manifest = Record<string, ManifestValue>;

const isStrip = (v: ManifestValue): v is PackStrip =>
  typeof v === 'object' && v !== null && 'frames' in v;

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

  const imageFor = async (src: string): Promise<HTMLImageElement> => {
    let img = sheets.get(src);
    if (!img) {
      img = await loadImage(root + src);
      sheets.set(src, img);
    }
    return img;
  };

  for (const [name, valueRaw] of Object.entries(manifest)) {
    const value: ManifestValue = typeof valueRaw === 'string' ? { src: valueRaw } : valueRaw;
    if (!value || typeof (value as PackEntry).src !== 'string') continue;
    try {
      const img = await imageFor((value as PackEntry).src);
      const source = Texture.from(img).source;
      // pixel art must never be smoothed; packs are almost always pixel art
      source.scaleMode = 'nearest';

      if (isStrip(value)) {
        const row = value.row ?? 0;
        const col = value.col ?? 0;
        const count = value.count ?? value.frames;
        // derive the grid from the image when it wasn't given
        const fw = value.frameW ?? Math.floor(img.naturalWidth / Math.max(1, value.frames));
        const fh = value.frameH ?? img.naturalHeight;
        for (let i = 0; i < count; i++) {
          // loop the source strip if the game wants more frames than it has
          const f = value.frames > 0 ? i % value.frames : 0;
          atlas.frames[`${name}_${i}`] = new Texture({
            source,
            frame: new Rectangle((col + f) * fw, row * fh, fw, fh),
          });
          applied++;
        }
        continue;
      }

      const e = value as PackEntry;
      atlas.frames[name] = new Texture({
        source,
        frame: new Rectangle(e.x ?? 0, e.y ?? 0, e.w ?? img.naturalWidth, e.h ?? img.naturalHeight),
      });
      applied++;
    } catch (err) {
      console.warn(`[art pack] skipped "${name}":`, err);
    }
  }

  if (applied > 0) console.info(`[art pack] ${applied} frames overridden from ${root}`);
  return applied;
}
