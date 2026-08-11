import { CONFIG } from '../config';

/** Hex helpers so the Canvas2D atlas painter can use the one true palette. */
export const hex = (c: number): string => '#' + c.toString(16).padStart(6, '0');

export const P = {
  concrete: hex(CONFIG.colors.concrete),
  concreteDim: hex(CONFIG.colors.concreteDim),
  pit: hex(CONFIG.colors.pit),
  pitLift: hex(CONFIG.colors.pitLift),
  rust: hex(CONFIG.colors.rust),
  rustDeep: hex(CONFIG.colors.rustDeep),
  sys: hex(CONFIG.colors.sys),
  sysBright: hex(CONFIG.colors.sysBright),
  sysDeep: hex(CONFIG.colors.sysDeep),
  amber: hex(CONFIG.colors.amber),
  amberBright: hex(CONFIG.colors.amberBright),
  bone: hex(CONFIG.colors.bone),
  boneDim: hex(CONFIG.colors.boneDim),
  trapRed: hex(CONFIG.colors.trapRed),
  goodTeal: hex(CONFIG.colors.goodTeal),
  // Derived shades used only inside the painter — never in gameplay code.
  skin: '#c99a68',      // bare arms and legs
  cloth: '#8f9ba8',     // washed-out fabric, the colour of things dragged into a basement
  steel: '#8d9299',     // drone plating and pipework
  steelDark: '#5c6167',
  fur: '#e8dcc4',       // a Persian cat, formerly immaculate
  furShade: '#c9b492',
};
