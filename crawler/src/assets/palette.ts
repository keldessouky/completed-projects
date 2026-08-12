import { CONFIG } from '../config';

/** Hex helpers so the Canvas2D painters can use the one true palette. */
export const hex = (c: number): string => '#' + c.toString(16).padStart(6, '0');

export const P = {
  ink: hex(CONFIG.colors.ink),
  inkLift: hex(CONFIG.colors.inkLift),
  grass: hex(CONFIG.colors.grass),
  grassDim: hex(CONFIG.colors.grassDim),
  dirt: hex(CONFIG.colors.dirt),
  dirtDim: hex(CONFIG.colors.dirtDim),
  stone: hex(CONFIG.colors.stone),
  stoneDim: hex(CONFIG.colors.stoneDim),
  water: hex(CONFIG.colors.water),
  forest: hex(CONFIG.colors.forest),
  waste: hex(CONFIG.colors.waste),
  rust: hex(CONFIG.colors.rust),
  rustDeep: hex(CONFIG.colors.rustDeep),
  sys: hex(CONFIG.colors.sys),
  sysBright: hex(CONFIG.colors.sysBright),
  sysDeep: hex(CONFIG.colors.sysDeep),
  amber: hex(CONFIG.colors.amber),
  amberBright: hex(CONFIG.colors.amberBright),
  bone: hex(CONFIG.colors.bone),
  boneDim: hex(CONFIG.colors.boneDim),
  hpRed: hex(CONFIG.colors.hpRed),
  goodTeal: hex(CONFIG.colors.goodTeal),
  // Derived shades used only inside the painters — never in gameplay code.
  skin: '#c99a68',
  skinShade: '#a87a4c',
  hair: '#2b2118',
  cloth: '#5f7799',      // Carl's shorts
  clothLit: '#7b93b5',
  steel: '#8d9299',
  steelDark: '#5c6167',
  hiVis: '#d8e04a',      // foreman and inspector high-visibility
  hiVisDark: '#a8b02c',
  fur: '#e8dcc4',
  furShade: '#c9b492',
  shadow: 'rgba(0,0,0,0.32)',
};
