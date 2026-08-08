// Real Google Fonts, both OFL, bundled locally through @fontsource (no CDN,
// zero network requests after boot):
//  - Cinzel: high-contrast display serif for headers
//  - Inter: clean geometric sans for UI text. HUD numerals do NOT use it —
//    they render from the atlas digit glyphs, which have a fixed advance and
//    are therefore tabular by construction.
import '@fontsource/cinzel/700.css';
import '@fontsource/cinzel/900.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/800.css';

export const FONT_DISPLAY = 'Cinzel, Georgia, serif';
export const FONT_UI = 'Inter, system-ui, sans-serif';

/** Await the faces the game uses so Pixi Text and the atlas digits never
 *  rasterize a fallback font. */
export async function loadFonts(): Promise<void> {
  const wanted = [
    '700 20px Cinzel',
    '900 20px Cinzel',
    '400 16px Inter',
    '600 16px Inter',
    '800 16px Inter',
  ];
  try {
    await Promise.all(wanted.map((f) => document.fonts.load(f)));
    await document.fonts.ready;
  } catch {
    // Fallback stacks in FONT_* keep text legible even if FontFace fails.
  }
}
