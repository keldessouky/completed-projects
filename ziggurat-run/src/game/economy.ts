import { CONFIG, type UpgradeKey } from '../config';
import type { SaveData } from '../types';
import type { StageDef } from '../types';

/** All coin math and upgrade effects in one place — the CONFIG curves applied. */

export function upgradeCost(key: UpgradeKey, currentLevel: number): number | null {
  const track = CONFIG.economy.upgrades[key];
  return currentLevel >= CONFIG.economy.maxLevel ? null : track.costs[currentLevel];
}

/** starting squad size for a run */
export function startSquad(save: SaveData): number {
  return 1 + save.upgrades.squad * CONFIG.economy.upgrades.squad.per;
}

/** seconds between volleys after the Quickdraw upgrade */
export function fireInterval(save: SaveData): number {
  return CONFIG.fire.interval / (1 + save.upgrades.rate * CONFIG.economy.upgrades.rate.per);
}

/** damage per arrow after Bronze Tips */
export function arrowDamage(save: SaveData): number {
  return CONFIG.fire.projDamage * (1 + save.upgrades.dmg * CONFIG.economy.upgrades.dmg.per);
}

/** fraction of trap losses that Ward Seals forgive (0..0.4) */
export function trapResist(save: SaveData): number {
  return save.upgrades.resist * CONFIG.economy.upgrades.resist.per;
}

/** chapter income multiplier applied to kill coins and end-of-run bonuses */
export function incomeMult(chapter: number): number {
  return 1 + chapter * CONFIG.economy.chapterIncomeMult;
}

export function starsFor(def: StageDef, squadAtBossDeath: number): number {
  if (squadAtBossDeath >= def.star3At) return 3;
  if (squadAtBossDeath >= def.star2At) return 2;
  return 1;
}

/** end-of-run bonus (kill coins are already banked live during the run) */
export function endBonus(def: StageDef, squadAtEnd: number, stars: number): number {
  const raw = squadAtEnd * CONFIG.economy.coinPerEndSquad + CONFIG.economy.starBonus[stars];
  return Math.round(raw * incomeMult(def.chapter));
}
