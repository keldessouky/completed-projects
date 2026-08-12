import { CONFIG } from '../config';
import { ACHIEVEMENT_TEXT, SYS } from '../flavour';
import type { SaveData } from '../types';
import type { RunState } from '../world/worldstate';
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
  coins: number;
}

const def = (id: AchievementId, coins: number = CONFIG.meta.achievementCoins): AchievementDef => ({
  id,
  name: ACHIEVEMENT_TEXT[id].name,
  desc: ACHIEVEMENT_TEXT[id].desc,
  coins,
});

export const ACHIEVEMENTS: AchievementDef[] = [
  def('firstBlood'),
  def('firstRecruit'),
  def('crowd', 40),
  def('campClearer', 45),
  def('rich', 30),
  def('captainKill', 50),
  def('breach', 90),
  def('untouched', 90),
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
  return a;
}

/** The System's phrasing for a freshly earned achievement. */
export const announce = (a: AchievementDef): string[] => SYS.achievement(a.name, a.coins);

/**
 * Everything checkable from run state. Called after kills, recruits and
 * breaches; cheap and idempotent. The caller banks the coins.
 */
export function checkAchievements(save: SaveData, run: RunState, squad: number): AchievementDef[] {
  const out: AchievementDef[] = [];
  const fire = (id: AchievementId): void => {
    const a = award(save, id);
    if (a) out.push(a);
  };

  if (save.kills > 0) fire('firstBlood');
  if (save.bestSquad > 0) fire('firstRecruit');
  if (squad >= 30) fire('crowd');
  if (run.coins >= 200) fire('rich');
  if (run.breached) {
    fire('breach');
    if (run.untouched) fire('untouched');
  }

  let camps = 0;
  for (const id of run.cleared) if (poiById(id)?.kind === 'camp') camps++;
  if (camps >= 3) fire('campClearer');

  return out;
}

/** Fired the moment a captain dies, since nothing in run state records it. */
export function onCaptainKill(save: SaveData): AchievementDef | null {
  return award(save, 'captainKill');
}
