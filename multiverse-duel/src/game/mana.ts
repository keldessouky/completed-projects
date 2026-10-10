// Mana costs and paying them from untapped sources.
import type { Color } from '../data/cards';

export type ManaKind = Color | 'C';

export interface ManaCost {
  generic: number;
  /** Each pip is paid by one mana of any of its options (hybrid pips have two). */
  pips: Color[][];
  hasX: boolean;
}

const COLOR_SET = new Set(['W', 'U', 'B', 'R', 'G']);

/**
 * Parse "{2}{R}{R}". Simplifications: {C} and snow are paid like generic mana,
 * Phyrexian mana must be paid with its colour, and {2/W} is paid with W.
 */
export function parseCost(cost: string): ManaCost {
  const out: ManaCost = { generic: 0, pips: [], hasX: false };
  for (const [, raw] of cost.matchAll(/\{([^}]+)\}/g)) {
    const sym = raw.toUpperCase();
    if (/^\d+$/.test(sym)) out.generic += Number(sym);
    else if (sym === 'X' || sym === 'Y' || sym === 'Z') out.hasX = true;
    else if (sym === 'C' || sym === 'S') out.generic += 1;
    else {
      const colors = sym.split('/').filter((s) => COLOR_SET.has(s)) as Color[];
      if (colors.length) out.pips.push(colors);
      else out.generic += 1;
    }
  }
  return out;
}

export const costValue = (c: ManaCost) => c.generic + c.pips.length;

/** Something that can be tapped for mana: a land, a mana creature, a mana rock. */
export interface ManaSource {
  iid: number;
  /** Kinds it can make; each activation makes `amount` mana of ONE kind. */
  options: ManaKind[];
  amount: number;
  /** Higher = tap it later (creatures after lands). */
  penalty?: number;
}

/**
 * Choose which sources to tap to pay `cost`. Returns their iids, or null if it
 * can't be paid. Coloured pips are matched first by backtracking (tightest
 * pips first, least flexible sources first), then generic from what's left,
 * spending leftover mana from sources already tapped before tapping new ones.
 */
export function planPayment(cost: ManaCost, sources: ManaSource[]): number[] | null {
  const total = sources.reduce((n, s) => n + s.amount, 0);
  if (total < costValue(cost)) return null;
  const sorted = [...sources].sort((a, b) => (a.penalty ?? 0) - (b.penalty ?? 0) || a.options.length - b.options.length || a.amount - b.amount);
  const pips = [...cost.pips].sort(
    (a, b) => sorted.filter((s) => s.options.some((o) => a.includes(o as Color))).length -
      sorted.filter((s) => s.options.some((o) => b.includes(o as Color))).length,
  );
  // remaining[i] = mana left in source i once chosen; chosenKind[i] = the kind it was tapped for.
  const remaining = new Map<number, number>();
  const chosenKind = new Map<number, ManaKind>();

  const assign = (k: number): boolean => {
    if (k === pips.length) return true;
    const pip = pips[k];
    for (let i = 0; i < sorted.length; i++) {
      const s = sorted[i];
      const left = remaining.get(i);
      if (left !== undefined) {
        // Already tapped: reuse only if it was tapped for a colour this pip accepts.
        const kind = chosenKind.get(i)!;
        if (left > 0 && pip.includes(kind as Color)) {
          remaining.set(i, left - 1);
          if (assign(k + 1)) return true;
          remaining.set(i, left);
        }
        continue;
      }
      for (const kind of s.options) {
        if (!pip.includes(kind as Color)) continue;
        remaining.set(i, s.amount - 1);
        chosenKind.set(i, kind);
        if (assign(k + 1)) return true;
        remaining.delete(i);
        chosenKind.delete(i);
      }
    }
    return false;
  };
  if (!assign(0)) return null;

  let generic = cost.generic;
  for (const [i, left] of remaining) {
    const use = Math.min(left, generic);
    generic -= use;
    remaining.set(i, left - use);
  }
  for (let i = 0; i < sorted.length && generic > 0; i++) {
    if (remaining.has(i)) continue;
    remaining.set(i, Math.max(0, sorted[i].amount - generic));
    generic -= Math.min(generic, sorted[i].amount);
  }
  if (generic > 0) return null;
  return [...remaining.keys()].map((i) => sorted[i].iid);
}

/** Total mana these sources can make, and which colours are reachable at all. */
export function manaSummary(sources: ManaSource[]) {
  const colors = new Set<ManaKind>();
  for (const s of sources) for (const o of s.options) colors.add(o);
  return { total: sources.reduce((n, s) => n + s.amount, 0), colors };
}
