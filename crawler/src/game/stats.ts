import { CONFIG, STAT_KEYS, type AbilityKey, type StatKey } from '../config';
import type { SaveData, Stats } from '../types';

/**
 * Every derived number the run reads, in one place.
 *
 * This module is the seam the whole progression system hangs on: the
 * encounter asks "how much damage does an arrow do" and never learns whether
 * the answer came from an upgrade track, an attribute, or a piece of gear.
 */

export function baseStats(): Stats {
  const s = {} as Stats;
  for (const k of STAT_KEYS) s[k] = CONFIG.stats.base;
  return s;
}

/** points in a stat ABOVE the base — the part that actually does anything */
const over = (save: SaveData, k: StatKey): number => Math.max(0, save.stats[k] - CONFIG.stats.base);

// ─────────────────────────── run-facing derived values ───────────────────────────

/** party you start a floor with */
export function startParty(save: SaveData): number {
  return 1 + over(save, 'cha') * CONFIG.stats.effects.cha;
}

/** seconds between volleys */
export function fireInterval(save: SaveData): number {
  return CONFIG.fire.interval / (1 + over(save, 'dex') * CONFIG.stats.effects.dex);
}

/** damage per arrow */
export function arrowDamage(save: SaveData): number {
  return CONFIG.fire.projDamage * (1 + over(save, 'str') * CONFIG.stats.effects.str);
}

/** fraction of hazard and contact losses forgiven, 0..conMaxResist */
export function lossResist(save: SaveData): number {
  return Math.min(CONFIG.stats.conMaxResist, over(save, 'con') * CONFIG.stats.effects.con);
}

/** ability cooldown after INT, in seconds */
export function abilityCooldown(save: SaveData, key: AbilityKey): number {
  const cdr = Math.min(CONFIG.stats.intMaxCdr, over(save, 'int') * CONFIG.stats.effects.int);
  return CONFIG.abilities[key].cooldownSec * (1 - cdr);
}

/** multiplier on ability damage / restore from WIS */
export function abilityPotency(save: SaveData): number {
  return 1 + over(save, 'wis') * CONFIG.stats.effects.wis;
}

/** chance a loot box rolls up a tier, 0..luckMaxUpgrade */
export function lootLuck(save: SaveData): number {
  return Math.min(CONFIG.stats.luckMaxUpgrade, over(save, 'luck') * CONFIG.stats.effects.luck);
}

// ─────────────────────────── levelling ───────────────────────────

export const xpToNext = (level: number): number => CONFIG.stats.xpToLevel(level);

/**
 * Bank XP and resolve any level-ups it triggers.
 * Returns how many levels were gained so the caller can announce them.
 */
export function grantXp(save: SaveData, amount: number): number {
  if (amount <= 0) return 0;
  save.xp += Math.round(amount);
  let gained = 0;
  // guard the loop as well as the maths: a huge XP grant must not hang a frame
  while (gained < 50 && save.xp >= xpToNext(save.level)) {
    save.xp -= xpToNext(save.level);
    save.level += 1;
    save.points += CONFIG.stats.pointsPerLevel;
    gained += 1;
  }
  return gained;
}

/** Spend one unspent point. Returns false when it can't be spent. */
export function spendPoint(save: SaveData, k: StatKey): boolean {
  if (save.points <= 0 || save.stats[k] >= CONFIG.stats.max) return false;
  save.points -= 1;
  save.stats[k] += 1;
  return true;
}

/** 0..1 progress through the current level, for the XP bar */
export function xpFrac(save: SaveData): number {
  const need = xpToNext(save.level);
  return need <= 0 ? 0 : Math.min(1, save.xp / need);
}
