import { CONFIG } from '../config';

/** Hex helpers so the Canvas2D atlas painter can use the one true palette. */
export const hex = (c: number): string => '#' + c.toString(16).padStart(6, '0');

export const P = {
  lapis: hex(CONFIG.colors.lapis),
  lapisBright: hex(CONFIG.colors.lapisBright),
  lapisDeep: hex(CONFIG.colors.lapisDeep),
  bitumen: hex(CONFIG.colors.bitumen),
  bitumenLift: hex(CONFIG.colors.bitumenLift),
  gold: hex(CONFIG.colors.gold),
  goldBright: hex(CONFIG.colors.goldBright),
  ochre: hex(CONFIG.colors.ochre),
  ochreDeep: hex(CONFIG.colors.ochreDeep),
  bone: hex(CONFIG.colors.bone),
  boneDim: hex(CONFIG.colors.boneDim),
  trapRed: hex(CONFIG.colors.trapRed),
  goodTeal: hex(CONFIG.colors.goodTeal),
  skin: '#c99a68', // sun-ochre lightened for faces/limbs — derived, used only in the painter
  stone: '#a89c88', // dormant lamassu stone — boneDim shifted cold
  stoneDark: '#7d7362',
};
