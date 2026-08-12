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
  /** the hero's boxer shorts, because that is the whole joke */
  shorts: '#5f7fb8',
  shortsLit: '#8aa5d6',
  /** allied levy cloth — a paler wash of the ally blue so a crowd reads as one */
  levy: '#6f9ce8',
  levyDark: '#4166ac',
  leather: '#a2724a',
  leatherDark: '#75492a',
  steel: '#c3ccd6',
  steelDark: '#7d8794',
  /** shadow on grass: warm, not a grey hole */
  shadow: 'rgba(38,58,26,0.30)',
  shadowHard: 'rgba(38,58,26,0.42)',
};
