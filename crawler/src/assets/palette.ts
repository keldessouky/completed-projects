import { CONFIG } from '../config';

/** Hex helpers so the Canvas2D painters can use the one true palette. */
export const hex = (c: number): string => '#' + c.toString(16).padStart(6, '0');

/**
 * Every colour a painter is allowed to reach for.
 *
 * The named gameplay colours come from CONFIG.colors; the handful below them
 * are *drawing* shades — cloth, skin, leather — that exist only inside a sprite
 * and never mean anything to gameplay, so putting them in config would be a lie
 * about what config is for.
 */
export const P = {
  ink: hex(CONFIG.colors.ink),
  inkLift: hex(CONFIG.colors.inkLift),
  grass: hex(CONFIG.colors.grass),
  grassAlt: hex(CONFIG.colors.grassAlt),
  grassDark: hex(CONFIG.colors.grassDark),
  path: hex(CONFIG.colors.path),
  sand: hex(CONFIG.colors.sand),
  sandDark: hex(CONFIG.colors.sandDark),
  stone: hex(CONFIG.colors.stone),
  stoneDark: hex(CONFIG.colors.stoneDark),
  wood: hex(CONFIG.colors.wood),
  woodDark: hex(CONFIG.colors.woodDark),
  water: hex(CONFIG.colors.water),
  tree: hex(CONFIG.colors.tree),
  treeDark: hex(CONFIG.colors.treeDark),
  foe: hex(CONFIG.colors.foe),
  foeDark: hex(CONFIG.colors.foeDark),
  ally: hex(CONFIG.colors.ally),
  allyDark: hex(CONFIG.colors.allyDark),
  gold: hex(CONFIG.colors.gold),
  goldDark: hex(CONFIG.colors.goldDark),
  bone: hex(CONFIG.colors.bone),
  boneDim: hex(CONFIG.colors.boneDim),
  hpRed: hex(CONFIG.colors.hpRed),
  hpGreen: hex(CONFIG.colors.hpGreen),
  white: hex(CONFIG.colors.white),

  // ── shades used only inside the painters ──
  skin: '#f0c092',
  skinShade: '#cf9a6c',
  hair: '#3a2a1c',
  hairLight: '#6b4a2c',
  /** the hero's boxer shorts, because that is the whole joke */
  shorts: '#4f6ea8',
  shortsLit: '#7e9bd0',
  /** allied levy cloth — a paler wash of the ally blue so a crowd reads as one */
  levy: '#6b8fd6',
  levyDark: '#3a5596',
  leather: '#96683f',
  leatherDark: '#5f3a20',
  steel: '#c6ccd4',
  steelDark: '#6e7783',
  /**
   * Donut. Magenta, following the reference sheets, and still a cat: nothing
   * else in the game is either of those things, so she reads instantly against
   * grass, path and a blue crowd. A cream cat on a sand path is invisible,
   * which an earlier pass proved.
   */
  fur: '#d95a9a',
  furShade: '#a63b74',
  furLight: '#ffd9ec',
  /** shadow on grass: warm, not a grey hole */
  shadow: 'rgba(38,58,26,0.30)',
  shadowHard: 'rgba(38,58,26,0.42)',
};
