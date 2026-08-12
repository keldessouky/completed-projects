import { CONFIG, STAT_KEYS, type AbilityKey, type GearSlot, type StatKey } from '../config';
import type { GearItem, SaveData, Stats } from '../types';

/** What the player currently has equipped. */
export type Equipped = Partial<Record<GearSlot, GearItem>>;

/**
 * Every derived number the world reads, in one place.
 *
 * This is the seam the whole progression system hangs on: combat asks "how much
 * damage does a hit do" and never learns whether the answer came from a level,
 * an attribute, or the wrench you picked up ten minutes ago. Every function
 * takes the loadout explicitly rather than reaching for a global, so the
 * character sheet can preview a change without committing it.
 */

export function baseStats(): Stats {
  const s = {} as Stats;
  for (const k of STAT_KEYS) s[k] = CONFIG.stats.base;
  return s;
}

/**
 * A stat's effective value: what you spent, plus whatever a trinket is
 * pretending you spent.
 */
export function effStat(save: SaveData, gear: Equipped, k: StatKey): number {
  const trinket = gear.trinket;
  const bonus = trinket && trinket.stat === k ? trinket.budget * CONFIG.gear.trinketStatPerPoint : 0;
  return save.stats[k] + bonus;
}

/** points above the base — the part that actually does anything */
const over = (save: SaveData, gear: Equipped, k: StatKey): number =>
  Math.max(0, effStat(save, gear, k) - CONFIG.stats.base);

// ─────────────────────────── combat ───────────────────────────

export function maxHp(save: SaveData, gear: Equipped): number {
  const armour = gear.armour ? gear.armour.budget * CONFIG.gear.armourHpPerPoint : 0;
  return Math.round(
    CONFIG.stats.hpAtLevel(save.level) + over(save, gear, 'con') * CONFIG.stats.effects.con + armour,
  );
}

export function damage(save: SaveData, gear: Equipped): number {
  const weapon = gear.weapon ? gear.weapon.budget * CONFIG.gear.weaponDamagePerPoint : 0;
  return CONFIG.stats.baseDamage + over(save, gear, 'str') * CONFIG.stats.effects.str + weapon;
}

/** seconds between automatic attacks */
export function attackInterval(save: SaveData, gear: Equipped): number {
  return CONFIG.combat.attackInterval / (1 + over(save, gear, 'dex') * CONFIG.stats.effects.dex);
}

export function moveSpeed(save: SaveData, gear: Equipped): number {
  return CONFIG.player.speed * (1 + over(save, gear, 'dex') * CONFIG.player.speedPerDex);
}

export function critChance(save: SaveData, gear: Equipped): number {
  return Math.min(CONFIG.stats.luckMaxCrit, over(save, gear, 'luck') * CONFIG.stats.effects.luck);
}

export function abilityCooldown(save: SaveData, gear: Equipped, key: AbilityKey): number {
  const cdr = Math.min(CONFIG.stats.intMaxCdr, over(save, gear, 'int') * CONFIG.stats.effects.int);
  return CONFIG.abilities[key].cooldownSec * (1 - cdr);
}

export function abilityPotency(save: SaveData, gear: Equipped): number {
  return 1 + over(save, gear, 'wis') * CONFIG.stats.effects.wis;
}

/** multiplier on vendor asking prices, ≥ 1 − chaMaxDiscount */
export function priceMult(save: SaveData, gear: Equipped): number {
  return 1 - Math.min(CONFIG.stats.chaMaxDiscount, over(save, gear, 'cha') * CONFIG.stats.effects.cha);
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
