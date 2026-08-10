// Three real Google Fonts, all OFL, vendored locally through @fontsource
// (latin subsets only) so the game makes zero network requests after boot.
//  - Cinzel   : the medieval half of the arc — titles in the early eras
//  - Orbitron : the cyber half — titles once the run reaches Neon
//  - Inter    : UI and body text throughout, the constant between them
import '@fontsource/cinzel/latin-700.css';
import '@fontsource/cinzel/latin-900.css';
import '@fontsource/orbitron/latin-700.css';
import '@fontsource/orbitron/latin-900.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-800.css';

export const FONT_CROWN = 'Cinzel, Georgia, serif';
export const FONT_CIRCUIT = 'Orbitron, "Segoe UI", sans-serif';
export const FONT_UI = 'Inter, system-ui, sans-serif';

/** The display face swaps as the run advances — the title of the game, literally. */
export function displayFont(era: number): string {
  return era >= 3 ? FONT_CIRCUIT : FONT_CROWN;
}

export async function loadFonts(): Promise<void> {
  const wanted = [
    '700 20px Cinzel', '900 20px Cinzel',
    '700 20px Orbitron', '900 20px Orbitron',
    '400 16px Inter', '600 16px Inter', '800 16px Inter',
  ];
  try {
    await Promise.all(wanted.map((f) => document.fonts.load(f)));
    await document.fonts.ready;
  } catch {
    // fallback stacks keep everything legible if FontFace fails
  }
}
