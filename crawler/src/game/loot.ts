import { CONFIG, GEAR_SLOTS, STAT_KEYS, type GearSlot, type GearTier, type StatKey } from '../config';
import { GEAR_NOUNS, TIER_NAME } from '../flavour';
import type { Equipped } from './stats';
import { critChance } from './stats';
import type { GearItem, SaveData } from '../types';

/**
 * Gear generation.
 *
 * Every item is one number — its stat budget — plus a slot and a tier. Damage,
 * health and attribute bonuses are all read off that budget by `stats.ts`,
 * which means a new slot or a rebalance is a single edit rather than a sweep
 * through item tables. Tier is cosmetic *and* a budget band, so "Prime" always
 * means something.
 */

let nextId = 1;

const TIERS = CONFIG.loot.tiers;

/** Weighted tier roll, shifted upward by LUCK. */
export function rollTier(save: SaveData, gear: Equipped, rand: () => number = Math.random): GearTier {
  // LUCK is already capped as crit chance; reuse it as the shift so a single
  // stat does not need two independent caps
  const shift = critChance(save, gear) * (CONFIG.loot.luckTierShift / CONFIG.stats.effects.luck);
  const weights = TIERS.map((t) => CONFIG.loot.tierWeight[t]);
  // move weight from the bottom tier toward the top as luck rises
  const move = Math.min(weights[0] * 0.8, shift * 4);
  weights[0] -= move;
  weights[weights.length - 1] += move * 0.45;
  weights[weights.length - 2] += move * 0.55;

  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rand() * total;
  for (let i = 0; i < TIERS.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return TIERS[i];
  }
  return TIERS[0];
}

export function makeGear(
  slot: GearSlot, tier: GearTier, level: number, rand: () => number = Math.random,
): GearItem {
  // budget scales with the tier band and drifts up with character level, so a
  // Worn item found at level 12 is still worth glancing at
  const band = CONFIG.loot.tierBudget[tier];
  const budget = Math.max(1, Math.round(band + level * 0.45 + rand() * 2));
  const nouns = GEAR_NOUNS[slot];
  const noun = nouns[Math.floor(rand() * nouns.length) % nouns.length];
  const stat: StatKey | undefined =
    slot === 'trinket' ? STAT_KEYS[Math.floor(rand() * STAT_KEYS.length) % STAT_KEYS.length] : undefined;
  return {
    id: `g${nextId++}`,
    slot,
    tier,
    budget,
    stat,
    name: `${TIER_NAME[tier]} ${noun}`,
  };
}

/** A random drop for a kill at the given character level. */
export function rollDrop(
  save: SaveData, gear: Equipped, rand: () => number = Math.random,
): GearItem {
  const slot = GEAR_SLOTS[Math.floor(rand() * GEAR_SLOTS.length) % GEAR_SLOTS.length];
  return makeGear(slot, rollTier(save, gear, rand), save.level, rand);
}

/** What a vendor asks for an item, before CHA. */
export const gearValue = (g: GearItem): number => Math.round(g.budget * CONFIG.economy.goldPerBudget);

/** What a vendor pays for one. */
export const sellValue = (g: GearItem): number =>
  Math.max(1, Math.round(gearValue(g) * CONFIG.economy.sellFrac));

/** One line describing what an item actually does, for the UI. */
export function gearEffect(g: GearItem): string {
  switch (g.slot) {
    case 'weapon': return `+${(g.budget * CONFIG.gear.weaponDamagePerPoint).toFixed(1)} damage`;
    case 'armour': return `+${g.budget * CONFIG.gear.armourHpPerPoint} max health`;
    case 'trinket': return `+${g.budget * CONFIG.gear.trinketStatPerPoint} ${g.stat ?? 'luck'}`;
  }
}

/** Restore ids after a load so freshly generated gear can't collide. */
export function reserveIds(items: GearItem[]): void {
  for (const g of items) {
    const n = Number(String(g.id).replace(/^g/, ''));
    if (Number.isFinite(n) && n >= nextId) nextId = n + 1;
  }
}
