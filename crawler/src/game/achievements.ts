import { CONFIG } from '../config';
import { ACHIEVEMENT_TEXT, SYS } from '../flavour';
import type { SaveData } from '../types';
import type { RunState } from './runstate';

export type AchievementId = keyof typeof ACHIEVEMENT_TEXT;

/**
 * Achievements are pure data plus a predicate. They are checked at a handful
 * of explicit moments rather than every frame — cheap, and it keeps the
 * "unlocked" toast tied to the thing that actually caused it.
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
  def('boxOpener'),
  def('untouched', 70),
  def('bigParty', 70),
  def('bossKill', 120),
  def('fastFloor', 150),
  def('fullSweep', 200),
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
 * Everything checkable from run state alone. Called after each encounter and
 * once more when the floor ends; both are cheap and idempotent.
 */
export function checkRunAchievements(save: SaveData, rs: RunState): AchievementDef[] {
  const out: AchievementDef[] = [];
  const fire = (id: AchievementId): void => {
    const a = award(save, id);
    if (a) out.push(a);
  };

  if (rs.kills > 0) fire('firstBlood');
  if (rs.partyPeak >= 40) fire('bigParty');
  if (rs.bossDown) fire('bossKill');
  if (rs.bossDown && rs.timeLeft >= 240) fire('fastFloor');
  if (rs.bossDown && !rs.hitHazard) fire('untouched');

  const p = rs.progress();
  if (rs.bossDown && p.visited >= p.total) fire('fullSweep');

  return out;
}
