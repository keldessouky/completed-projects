import { ImageSource, Rectangle, Texture } from 'pixi.js';
import { CanvasSource } from 'pixi.js';
import { FACINGS, FRAMES_PER_FACING } from './figure';
import type { GameAtlas } from './atlas';

/**
 * Drop-in replacement art.
 *
 * The game's sprites are painted in code, which is why it ships as one file
 * with no assets — but "painted in code" must not mean "impossible to
 * replace". This module loads PNG sheets from `public/art/` at boot and swaps
 * them into the atlas over the procedural frames, keyed by the same names the
 * rest of the game already asks for.
 *
 * Nothing else in the codebase knows this exists. `atlas.get('hero_se_2')`
 * returns whatever is installed under that name, so a replaced character
 * animates, faces, mirrors, sorts and flashes exactly as the painted one did.
 *
 * Absence is not an error. No manifest, an unreachable manifest, a missing
 * file or a malformed sheet all leave the procedural art in place and log a
 * line — a broken drawing must never be a black screen.
 */

/** Where the sheets live, relative to the page. */
const ART_DIR = 'art/';
const MANIFEST = ART_DIR + 'manifest.json';

export interface ActorEntry {
  /** file name inside public/art/ */
  file: string;
  /** ONE frame's size in design pixels: [width, height] */
  cell: [number, number];
  /** pixels per design pixel in this sheet; overrides the manifest default */
  scale?: number;
}

export interface SpriteEntry {
  file: string;
  /** the frame's size in design pixels: [width, height] */
  size: [number, number];
  scale?: number;
}

export interface ArtManifest {
  /** default pixels per design pixel for every sheet in this manifest */
  scale?: number;
  /** animated cast, keyed by the atlas kind: hero, donut, levy0…2, grunt… */
  actors?: Record<string, ActorEntry>;
  /** anything else, keyed by the exact atlas frame name */
  sprites?: Record<string, SpriteEntry>;
}

/** The row order every actor sheet must use, top to bottom. */
export const SHEET_ROWS = FACINGS;
/** The column order every actor sheet must use, left to right. */
export const SHEET_COLS = FRAMES_PER_FACING;

/**
 * The single-file build has no files to fetch, so it inlines the manifest and
 * every sheet as data URLs on this global. Custom art therefore survives into
 * the one-file bundle, which would otherwise be the one build that silently
 * loses it.
 */
interface InlineArt { manifest: ArtManifest; files: Record<string, string>; }
const inlined = (): InlineArt | null =>
  (window as unknown as { __CR_ART__?: InlineArt }).__CR_ART__ ?? null;

/** Where to actually load a sheet from: the inlined copy, or the folder. */
const artUrl = (file: string): string => inlined()?.files[file] ?? ART_DIR + file;

const load = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('could not load ' + url));
    img.src = url;
  });

/**
 * The hit-flash frame, washed toward white.
 *
 * Generated rather than authored: asking someone replacing the art to hand-
 * paint a flash frame for every character would be a chore with one correct
 * answer, and this is that answer.
 */
function flashFrom(
  img: HTMLImageElement, sx: number, sy: number, sw: number, sh: number, scale: number,
): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const c = canvas.getContext('2d')!;
  c.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  c.globalCompositeOperation = 'source-atop';
  c.fillStyle = 'rgba(255,255,255,0.78)';
  c.fillRect(0, 0, sw, sh);
  const source = new CanvasSource({ resource: canvas, resolution: scale, scaleMode: 'linear' });
  return new Texture({ source });
}

/**
 * Install one actor sheet.
 *
 * A sheet is a grid: five columns (walk 0-3, then the attack pose) by five
 * rows (facing south, south-east, east, north-east, north). Short sheets are
 * tolerated and repeated — a one-row sheet gives every facing the same art,
 * which is a perfectly reasonable way to start.
 */
async function installActor(
  atlas: GameAtlas, kind: string, entry: ActorEntry, defScale: number, notes: string[],
): Promise<void> {
  const scale = entry.scale ?? defScale;
  const [cw, ch] = entry.cell;
  const pw = Math.round(cw * scale);
  const ph = Math.round(ch * scale);
  const img = await load(artUrl(entry.file));

  const cols = Math.max(1, Math.floor(img.width / pw));
  const rows = Math.max(1, Math.floor(img.height / ph));
  if (cols < SHEET_COLS || rows < SHEET_ROWS.length) {
    notes.push(
      `${kind}: sheet is ${cols}×${rows} cells, expected ${SHEET_COLS}×${SHEET_ROWS.length}`
      + ` — missing cells reuse the last one that exists`,
    );
  }

  const source = new ImageSource({ resource: img, resolution: scale, scaleMode: 'linear' });
  for (let r = 0; r < SHEET_ROWS.length; r++) {
    const row = Math.min(r, rows - 1);
    for (let n = 0; n < SHEET_COLS; n++) {
      const col = Math.min(n, cols - 1);
      // Frames are in logical units — pixels ÷ resolution — exactly as the
      // procedural atlas builds them, so a replaced sprite lands at the design
      // size the layout expects rather than at its pixel size.
      const frame = new Rectangle((col * pw) / scale, (row * ph) / scale, pw / scale, ph / scale);
      atlas.frames[`${kind}_${SHEET_ROWS[r]}_${n}`] = new Texture({ source, frame });
    }
  }
  atlas.frames[`${kind}_flash`] = flashFrom(img, 0, 0, pw, ph, scale);
}

/** Install one still frame, by its exact atlas name. */
async function installSprite(
  atlas: GameAtlas, name: string, entry: SpriteEntry, defScale: number,
): Promise<void> {
  const scale = entry.scale ?? defScale;
  const img = await load(artUrl(entry.file));
  const source = new ImageSource({ resource: img, resolution: scale, scaleMode: 'linear' });
  atlas.frames[name] = new Texture({ source });
  void entry.size;
}

/**
 * Load and install every override the manifest names.
 *
 * Returns a human-readable list of what happened, which the boot scene logs.
 * Every failure is per-entry: one bad sheet does not take the others down, and
 * nothing here can stop the game from starting.
 */
export async function loadArtOverrides(atlas: GameAtlas): Promise<string[]> {
  const notes: string[] = [];
  let manifest: ArtManifest;
  const bundled = inlined();
  if (bundled) {
    manifest = bundled.manifest;
  } else {
    try {
      const res = await fetch(MANIFEST, { cache: 'no-cache' });
      if (!res.ok) return notes;        // no custom art: the normal case
      manifest = (await res.json()) as ArtManifest;
    } catch {
      return notes;                      // not served, or offline
    }
  }

  const defScale = manifest.scale ?? 3;
  for (const [kind, entry] of Object.entries(manifest.actors ?? {})) {
    try {
      await installActor(atlas, kind, entry, defScale, notes);
      notes.push(`${kind}: replaced from ${entry.file}`);
    } catch (err) {
      notes.push(`${kind}: FAILED (${String(err)}) — keeping the painted art`);
    }
  }
  for (const [name, entry] of Object.entries(manifest.sprites ?? {})) {
    try {
      await installSprite(atlas, name, entry, defScale);
      notes.push(`${name}: replaced from ${entry.file}`);
    } catch (err) {
      notes.push(`${name}: FAILED (${String(err)}) — keeping the painted art`);
    }
  }
  return notes;
}
