import { describe, expect, test } from 'vitest';
import { DEFAULT_THEME, THEMES, themeVars, type Theme } from '../src/ui/themes';

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const distance = (a: string, b: string) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));

const profiles = THEMES.filter((t) => t.id !== DEFAULT_THEME);

describe('colour profiles', () => {
  test('sixteen profiles, plus the original Reactor look as the default', () => {
    expect(THEMES[0].id).toBe(DEFAULT_THEME);
    expect(profiles).toHaveLength(16);
    expect(profiles.every((t) => t.from !== 'Reactor')).toBe(true);
  });

  test('ids and names are unique', () => {
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
    expect(new Set(THEMES.map((t) => t.name)).size).toBe(THEMES.length);
  });

  test('every value is a #rrggbb colour', () => {
    for (const t of THEMES) for (const [k, v] of Object.entries(themeVars(t))) expect(v, `${t.id} ${k}`).toMatch(/^#[0-9a-f]{6}$/);
  });

  test('no two profiles look alike', () => {
    // A profile's look is its page, its panels, its signature colour and its keywords.
    const look = (t: Theme) => [t.palette.bg, t.palette.panel, t.palette.accent, t.palette.syntax.keyword, t.palette.syntax.string];
    for (const a of THEMES)
      for (const b of THEMES) {
        if (a.id >= b.id) continue;
        const d = look(a).reduce((n, c, i) => n + distance(c, look(b)[i]), 0);
        expect(d, `${a.name} vs ${b.name}`).toBeGreaterThan(150);
      }
  });

  test.each(THEMES.map((t) => [t.name, t] as const))('%s is readable', (_, t) => {
    const p = t.palette;
    for (const surface of [p.bg, p.panel, p.panel2, p.bg2]) {
      expect(contrast(p.text, surface), `text on ${surface}`).toBeGreaterThanOrEqual(5.5);
      expect(contrast(p.muted, surface), `muted on ${surface}`).toBeGreaterThanOrEqual(3.8);
    }
    for (const c of [p.accent, p.gold, p.green, p.red]) expect(contrast(c, p.panel), `${c} on panel`).toBeGreaterThanOrEqual(3.4);
    expect(contrast(p.onAccent, p.accent), 'button text').toBeGreaterThanOrEqual(4.5);
    for (const [k, c] of Object.entries(p.syntax)) {
      expect(contrast(c, p.editor), `syntax ${k}`).toBeGreaterThanOrEqual(k === 'comment' ? 3 : 3.8);
    }
    expect(t.scheme === 'light').toBe(luminance(p.bg) > 0.5);
  });
});
