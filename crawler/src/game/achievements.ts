import { CONFIG } from '../config';
import { ACHIEVEMENT_TEXT, SYS } from '../flavour';
import type { SaveData } from '../types';
import type { WorldState } from '../world/worldstate';
import { poiById } from '../world/worldgen';

export type AchievementId = keyof typeof ACHIEVEMENT_TEXT;

/**
 * Achievements are pure data plus a predicate. They are checked at a handful of
 * explicit moments rather than every frame — cheap, and it keeps the "unlocked"
 * toast tied to the thing that actually caused it.
 */
export interface AchievementDef {
  id: AchievementId;
  name: string;
  desc: string;
  gold: number;
}

const def = (id: AchievementId, gold: number = CONFIG.economy.achievementGold): AchievementDef => ({
  id,
  name: ACHIEVEMENT_TEXT[id].name,
  desc: ACHIEVEMENT_TEXT[id].desc,
  gold,
});

export const ACHIEVEMENTS: AchievementDef[] = [
  def('firstBlood'),
  def('firstGear'),
  def('cartographer', 120),
  def('campClearer', 150),
  def('wealthy', 100),
  def('primeFind', 180),
  def('bossKill', 400),
  def('survivor', 250),
];

const byId = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

export const has = (save: SaveData, id: AchievementId): boolean => save.achievements.includes(id);

/**
 * Award an achievement if it isn't already held.
 * Returns the definition when it fires, so the caller can announce it, or
 * null when it was already earned.
 */
export function award(save: SaveData, id: AchievementId): AchievementDef | null {
  if (has(save, id)) return null;
  const a = byId.get(id);
  if (!a) return null;
  save.achievements.push(id);
  save.gold += a.gold;
  return a;
}

/** The System's phrasing for a freshly earned achievement. */
export const announce = (a: AchievementDef): string[] => SYS.achievement(a.name, a.gold);

/**
 * Everything checkable from world and character state. Called after kills,
 * pickups and discoveries; cheap and idempotent.
 */
export function checkAchievements(save: SaveData, ws: WorldState): AchievementDef[] {
  const out: AchievementDef[] = [];
  const fire = (id: AchievementId): void => {
    const a = award(save, id);
    if (a) out.push(a);
  };

  if (save.kills > 0) fire('firstBlood');
  if (Object.keys(ws.equipped).length > 0) fire('firstGear');
  if (ws.discovered.size >= 10) fire('cartographer');
  if (save.gold >= 1000) fire('wealthy');
  if (ws.bossDown) fire('bossKill');
  if (save.level >= 8 && save.totalDeaths === 0) fire('survivor');

  let camps = 0;
  for (const id of ws.cleared.keys()) if (poiById(id)?.kind === 'camp') camps++;
  if (camps >= 3) fire('campClearer');

  const anyPrime = [...ws.inventory, ...Object.values(ws.equipped)].some((g) => g?.tier === 'prime');
  if (anyPrime) fire('primeFind');

  return out;
}
