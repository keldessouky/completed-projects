import { CONFIG, STAT_KEYS, type LootTier, type StatKey } from '../config';
import type { SaveData } from '../types';
import { lootLuck } from './stats';

export interface LootRoll {
  tier: LootTier;
  /** true when LUCK bumped the box up a grade */
  upgraded: boolean;
  gold: number;
  xp: number;
  party: number;
  /** a permanent attribute point, and which stat it was pre-rolled into */
  statPoint: StatKey | null;
}

const TIER_ORDER: LootTier[] = ['bronze', 'silver', 'gold'];

export const tierLabel = (t: LootTier): string => t[0].toUpperCase() + t.slice(1);

const range = (r: () => number, [lo, hi]: [number, number]): number =>
  Math.round(lo + r() * (hi - lo));

/**
 * Open a box.
 *
 * LUCK does not add a separate "rare drop" roll — it upgrades the box itself,
 * so a lucky crawler feels the difference in every single line of the payout
 * rather than in an occasional jackpot they might never see.
 */
export function rollLoot(save: SaveData, tier: LootTier, rand: () => number = Math.random): LootRoll {
  let final = tier;
  let upgraded = false;
  const idx = TIER_ORDER.indexOf(tier);
  if (idx >= 0 && idx < TIER_ORDER.length - 1 && rand() < lootLuck(save)) {
    final = TIER_ORDER[idx + 1];
    upgraded = true;
  }

  const L = CONFIG.loot;
  const gold = range(rand, L.goldRange[final]);
  const xp = range(rand, L.xpRange[final]);
  const party = rand() < L.partyChance[final] ? range(rand, L.partyRange[final]) : 0;
  const statPoint = rand() < L.statPointChance[final]
    ? STAT_KEYS[Math.floor(rand() * STAT_KEYS.length) % STAT_KEYS.length]
    : null;

  return { tier: final, upgraded, gold, xp, party, statPoint };
}

/** Human-readable contents, one line each, for the System notification. */
export function describe(roll: LootRoll): string[] {
  const out: string[] = [`${roll.gold} gold`, `${roll.xp} XP`];
  if (roll.party > 0) out.push(`${roll.party} survivors`);
  if (roll.statPoint) out.push('1 attribute point');
  return out;
}
