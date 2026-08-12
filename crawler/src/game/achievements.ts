import { CONFIG } from '../config';
import { ACHIEVEMENT_TEXT } from '../flavour';
import type { SaveData } from '../types';
import type { RunState } from '../world/worldstate';
import { poiById } from '../world/worldgen';

export type AchievementId = keyof typeof ACHIEVEMENT_TEXT;

/**
 * Achievements are pure data plus a predicate. They are checked at a handful of
 * explicit moments rather than every frame — cheap, and it keeps the unlock
 * card tied to the thing that actually caused it.
 *
 * The reward is gold, paid straight into the run's purse, because gold is
 * people and people are the only currency the game has. An achievement that
 * paid out nothing would be a sticker; one that pays out four recruits is a
 * reason to go and do something stupid on purpose.
 */
export interface AchievementDef {
  id: AchievementId;
  name: string;
  desc: string;
  /** the System's parting remark, shown under the name on the unlock card */
  sting: string;
  coins: number;
}

const def = (id: AchievementId, coins: number = CONFIG.meta.achievementCoins): AchievementDef => ({
  id,
  name: ACHIEVEMENT_TEXT[id].name,
  desc: ACHIEVEMENT_TEXT[id].desc,
  sting: ACHIEVEMENT_TEXT[id].sting,
  coins,
});

export const ACHIEVEMENTS: AchievementDef[] = [
  def('firstBlood'),
  def('firstRecruit'),
  def('crowd', 40),
  def('fullHouse', 80),
  def('campClearer', 45),
  def('rich', 30),
  def('spendthrift', 40),
  def('bloodbath', 60),
  def('captainKill', 50),
  def('breach', 90),
  def('untouched', 90),
  def('loner', 120),
];

const byId = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

export const has = (save: SaveData, id: AchievementId): boolean => save.achievements.includes(id);

/**
 * Award an achievement if it isn't already held.
 * Returns the definition when it fires, so the caller can announce it and pay
 * the reward, or null when it was already earned.
 */
export function award(save: SaveData, id: AchievementId): AchievementDef | null {
  if (has(save, id)) return null;
  const a = byId.get(id);
  if (!a) return null;
  save.achievements.push(id);
  return a;
}

/** What the run looks like at the moment of a check. */
export interface AchievementContext {
  squad: number;
  /** gold spent on recruits this run */
  spent: number;
}

/**
 * Everything checkable from run state. Called after kills, recruits, camp
 * clears and the breach; cheap and idempotent. The caller banks the gold.
 */
export function checkAchievements(
  save: SaveData, run: RunState, ctx: AchievementContext,
): AchievementDef[] {
  const out: AchievementDef[] = [];
  const fire = (id: AchievementId): void => {
    const a = award(save, id);
    if (a) out.push(a);
  };

  if (save.kills > 0) fire('firstBlood');
  if (save.kills >= 100) fire('bloodbath');
  if (save.bestSquad > 0) fire('firstRecruit');
  if (ctx.squad >= 30) fire('crowd');
  if (ctx.squad >= CONFIG.squad.max) fire('fullHouse');
  if (run.coins >= 200) fire('rich');
  if (ctx.spent >= 300) fire('spendthrift');
  if (run.breached) {
    fire('breach');
    if (run.untouched) fire('untouched');
    // the clip they will use: through the gate with almost nobody left
    if (ctx.squad > 0 && ctx.squad < 5) fire('loner');
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
