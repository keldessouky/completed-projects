// The save file and the rules about levels: stars, XP, unlocking, crawler
// level. Pure functions over a plain object, so every rule is unit-testable;
// the store persists the object to localStorage.
import { ALL_LEVELS, DECKS } from '../content';
import type { SkillId } from './skills';
import { SKILLS, type School } from './skills';
import type { Level } from './types';

export type Tier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'legendary' | 'celestial';
export const TIERS: Tier[] = ['bronze', 'silver', 'gold', 'platinum', 'legendary', 'celestial'];

export interface Box {
  id: string;
  tier: Tier;
  /** What earned it, e.g. "Level clear: Arrays". */
  source: string;
  /** An item this box is guaranteed to contain (a floor boss's Codex scroll). */
  guarantee?: string;
}

export interface LevelProgress {
  done: boolean;
  stars: number; // best so far, 0–3
  hints: number; // hints revealed on the current attempt
  freeHints: number; // …of which were paid for with hint tokens (no star cost)
  solution: boolean; // solution revealed on the current attempt
  runs: number; // runs on the current attempt
  bestSeconds?: number;
  code?: string; // the player's latest code, so leaving never loses work
}

/** Lifetime tallies. Achievements and daily quests are measured against these. */
export interface Counters {
  levelsPassed: number;
  threeStars: number;
  firstTries: number;
  cleanClears: number; // code levels cleared with no hints and no solution
  quizzesDone: number;
  perfectQuizzes: number;
  bossesBeaten: number;
  boxesOpened: number;
  runs: number;
  failedRuns: number;
  tokensUsed: number;
  solutionsSeen: number;
  arcadeRounds: number;
  arcadeCorrect: number;
  speedBonuses: number;
  goldSpent: number;
  nightClears: number;
}

export const ZERO_COUNTERS: Counters = {
  levelsPassed: 0, threeStars: 0, firstTries: 0, cleanClears: 0, quizzesDone: 0, perfectQuizzes: 0, bossesBeaten: 0,
  boxesOpened: 0, runs: 0, failedRuns: 0, tokensUsed: 0, solutionsSeen: 0, arcadeRounds: 0, arcadeCorrect: 0,
  speedBonuses: 0, goldSpent: 0, nightClears: 0,
};

export type ClassId = 'type-sorcerer' | 'component-artificer' | 'bug-hunter' | 'speedrunner' | 'crowd-favourite';
export type PetKind = 'drone' | 'cat' | 'octopus' | 'owl' | 'fox' | 'dragon';

export interface Notice {
  id: string;
  at: number;
  kind: 'achievement' | 'level-up' | 'skill-up' | 'box' | 'sponsor' | 'fans' | 'feed' | 'quest' | 'streak' | 'loot';
  title: string;
  body: string;
  icon: string;
}

export interface Save {
  v: 2;
  name: string;
  levels: Record<string, LevelProgress>;
  xp: number;
  gold: number;
  viewers: number;
  hintTokens: number;
  /** Levels left on the XP boost (+50%). */
  boosts: number;
  boxes: Box[];
  items: Record<string, number>;
  equipped: { title: string; theme: string; hat: string | null };
  classId: ClassId | null;
  pet: { kind: PetKind; name: string } | null;
  skills: Partial<Record<SkillId, number>>;
  achievements: string[];
  sponsors: string[];
  fanMilestones: number;
  quests: { day: string; ids: string[]; claimed: string[]; base: Counters } | null;
  streak: { day: string; count: number; best: number };
  counters: Counters;
  arcadeBest: number;
  arcadeCombo: number;
  inbox: Notice[];
  nextBoxId: number;
  sound: boolean;
  unlockAll: boolean;
}

export const emptySave = (): Save => ({
  v: 2,
  name: '',
  levels: {},
  xp: 0,
  gold: 0,
  viewers: 0,
  hintTokens: 1,
  boosts: 0,
  boxes: [],
  items: { 'title-crawler': 1, 'theme-reactor': 1 },
  equipped: { title: 'title-crawler', theme: 'theme-reactor', hat: null },
  classId: null,
  pet: null,
  skills: {},
  achievements: [],
  sponsors: [],
  fanMilestones: 0,
  quests: null,
  streak: { day: '', count: 0, best: 0 },
  counters: { ...ZERO_COUNTERS },
  arcadeBest: 0,
  arcadeCombo: 0,
  inbox: [],
  nextBoxId: 1,
  sound: true,
  unlockAll: false,
});

export const blankLevel = (): LevelProgress => ({ done: false, stars: 0, hints: 0, freeHints: 0, solution: false, runs: 0 });

export function levelState(save: Save, id: string): LevelProgress {
  return save.levels[id] ?? blankLevel();
}

/** Stars for a code level: hints you paid for with stars, and peeking at the solution, cost stars. */
export function codeStars(p: Pick<LevelProgress, 'hints' | 'freeHints' | 'solution'>): number {
  if (p.solution) return 1;
  return 3 - Math.min(Math.max(0, p.hints - (p.freeHints ?? 0)), 2);
}

/** Stars for a quiz: one off per wrong answer, never below 1. */
export function quizStars(mistakes: number): number {
  return Math.max(1, 3 - mistakes);
}

// ---------------------------------------------------------------- floors and levels

export function floorOf(levelId: string): { index: number; id: string; name: string } {
  const index = DECKS.findIndex((d) => d.levels.some((l) => l.id === levelId));
  return { index, id: DECKS[index]?.id ?? '', name: DECKS[index]?.name ?? '' };
}

/** The school a level belongs to: floors 1–3 are JavaScript, 4–6 TypeScript, 7–10 React. */
export function levelSchool(level: Level): School {
  const index = floorOf(level.id).index;
  return index < 3 ? 'JavaScript' : index < 6 ? 'TypeScript' : 'React';
}

export const isBoss = (level: Level) => level.kind === 'code' && !!level.boss;

/** Full XP for a level, growing gently floor by floor (×1.0 on Floor 1 up to ×1.9 on Floor 10). */
export function maxXp(level: Level): number {
  const base = level.kind === 'quiz' ? 60 : isBoss(level) ? 250 : 100;
  return Math.round(base * (1 + Math.max(0, floorOf(level.id).index) * 0.1));
}

export function xpFor(level: Level, stars: number): number {
  return Math.round((maxXp(level) * stars) / 3);
}

/**
 * Levels unlock in order. A floor's boss is also open as soon as you reach the
 * floor ("skip the floor by beating its boss"), and beating it opens the next floor.
 */
export function isUnlocked(save: Save, id: string): boolean {
  if (save.unlockAll) return true;
  const index = ALL_LEVELS.findIndex((l) => l.id === id);
  if (index < 0) return false;
  if (index === 0 || levelState(save, id).done) return true;
  if (levelState(save, ALL_LEVELS[index - 1].id).done) return true;
  const level = ALL_LEVELS[index];
  if (isBoss(level)) {
    const floor = DECKS[floorOf(id).index];
    return isUnlocked(save, floor.levels[0].id);
  }
  return false;
}

export function stationPower(save: Save): number {
  const done = ALL_LEVELS.filter((l) => levelState(save, l.id).done).length;
  return Math.round((done / ALL_LEVELS.length) * 100);
}

export function floorCleared(save: Save, floorIndex: number): boolean {
  const deck = DECKS[floorIndex];
  return !!deck && deck.levels.every((l) => levelState(save, l.id).done);
}

// ---------------------------------------------------------------- crawler level

/** Total XP needed to reach crawler level L. Level 2 comes after your first level clear. */
export function xpToReach(level: number): number {
  const n = level - 1;
  return 25 * n * n + 75 * n;
}

export const MAX_LEVEL = 50;

export const CAREER = [
  { level: 1, title: 'Intern' },
  { level: 3, title: 'Junior Developer' },
  { level: 6, title: 'Developer' },
  { level: 10, title: 'Senior Developer' },
  { level: 14, title: 'Staff Engineer' },
  { level: 18, title: 'Principal Engineer' },
  { level: 22, title: 'Reactor Architect' },
  { level: 28, title: 'Living Legend' },
];

export function careerTitle(level: number): string {
  let title = CAREER[0].title;
  for (const c of CAREER) if (level >= c.level) title = c.title;
  return title;
}

export function crawlerLevel(xp: number) {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpToReach(level + 1)) level++;
  const floor = xpToReach(level);
  const next = level < MAX_LEVEL ? xpToReach(level + 1) : floor;
  return {
    level,
    title: careerTitle(level),
    into: xp - floor,
    span: next - floor,
    progress: level < MAX_LEVEL ? (xp - floor) / (next - floor) : 1,
    toNext: level < MAX_LEVEL ? next - xp : 0,
  };
}

// ---------------------------------------------------------------- persistence

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d);
const str = (v: unknown, d: string) => (typeof v === 'string' ? v : d);
const obj = (v: unknown): Record<string, any> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, any>) : {});

function parseLevels(raw: unknown): Record<string, LevelProgress> {
  const levels: Record<string, LevelProgress> = {};
  for (const [id, l] of Object.entries(obj(raw))) {
    if (!l || typeof l !== 'object') continue;
    const hints = Math.min(3, num(l.hints, 0));
    levels[id] = {
      done: l.done === true,
      stars: Math.min(3, num(l.stars, 0)),
      hints,
      freeHints: Math.min(hints, num(l.freeHints, 0)),
      solution: l.solution === true,
      runs: num(l.runs, 0),
      ...(typeof l.bestSeconds === 'number' && l.bestSeconds >= 0 ? { bestSeconds: l.bestSeconds } : {}),
      ...(typeof l.code === 'string' ? { code: l.code } : {}),
    };
  }
  return levels;
}

/**
 * Validate untrusted JSON from storage field by field. Anything odd falls back
 * to defaults; a version-1 save (from before the reward systems) is migrated,
 * keeping its levels, stars, XP and arcade record.
 */
export function parseSave(raw: string | null): Save {
  const base = emptySave();
  if (!raw) return base;
  let data: Record<string, any>;
  try {
    data = obj(JSON.parse(raw));
  } catch {
    return base;
  }
  if (data.v !== 1 && data.v !== 2) return base;

  const save: Save = {
    ...base,
    levels: parseLevels(data.levels),
    xp: num(data.xp, 0),
    arcadeBest: num(data.arcadeBest, 0),
    arcadeCombo: num(data.arcadeCombo, 0),
    sound: data.sound !== false,
    unlockAll: data.unlockAll === true,
  };
  if (data.v === 1) {
    // Credit what v1 players already did: one point per finished level's skills.
    for (const level of ALL_LEVELS) {
      if (save.levels[level.id]?.done) for (const s of level.skills) save.skills[s] = (save.skills[s] ?? 0) + 1;
    }
    save.counters.levelsPassed = Object.values(save.levels).filter((l) => l.done).length;
    save.counters.threeStars = Object.values(save.levels).filter((l) => l.stars === 3).length;
    return save;
  }

  const counters = obj(data.counters);
  const items: Record<string, number> = { ...base.items };
  for (const [k, v] of Object.entries(obj(data.items))) if (typeof v === 'number' && v > 0) items[k] = Math.floor(v);
  const equipped = obj(data.equipped);
  const pet = obj(data.pet);
  const quests = obj(data.quests);
  const streak = obj(data.streak);
  const skills: Partial<Record<SkillId, number>> = {};
  for (const [k, v] of Object.entries(obj(data.skills))) if (k in SKILLS) skills[k as SkillId] = num(v, 0);

  return {
    ...save,
    name: str(data.name, '').slice(0, 24),
    gold: num(data.gold, 0),
    viewers: num(data.viewers, 0),
    hintTokens: num(data.hintTokens, 0),
    boosts: num(data.boosts, 0),
    boxes: Array.isArray(data.boxes)
      ? data.boxes
          .filter((b: any) => b && typeof b.id === 'string' && TIERS.includes(b.tier))
          .map((b: any) => ({ id: b.id, tier: b.tier, source: str(b.source, 'Mystery'), ...(typeof b.guarantee === 'string' ? { guarantee: b.guarantee } : {}) }))
      : [],
    items,
    equipped: {
      title: items[equipped.title] ? equipped.title : base.equipped.title,
      theme: items[equipped.theme] ? equipped.theme : base.equipped.theme,
      hat: typeof equipped.hat === 'string' && items[equipped.hat] ? equipped.hat : null,
    },
    classId: (['type-sorcerer', 'component-artificer', 'bug-hunter', 'speedrunner', 'crowd-favourite'] as const).find((c) => c === data.classId) ?? null,
    pet: typeof pet.kind === 'string' && ['drone', 'cat', 'octopus', 'owl', 'fox', 'dragon'].includes(pet.kind) ? { kind: pet.kind as PetKind, name: str(pet.name, 'Pal').slice(0, 20) } : null,
    skills,
    achievements: Array.isArray(data.achievements) ? data.achievements.filter((a: unknown) => typeof a === 'string') : [],
    sponsors: Array.isArray(data.sponsors) ? data.sponsors.filter((a: unknown) => typeof a === 'string') : [],
    fanMilestones: num(data.fanMilestones, 0),
    quests:
      typeof quests.day === 'string' && Array.isArray(quests.ids)
        ? {
            day: quests.day,
            ids: quests.ids.filter((x: unknown) => typeof x === 'string'),
            claimed: Array.isArray(quests.claimed) ? quests.claimed.filter((x: unknown) => typeof x === 'string') : [],
            base: Object.fromEntries(Object.keys(ZERO_COUNTERS).map((k) => [k, num(obj(quests.base)[k], 0)])) as unknown as Counters,
          }
        : null,
    streak: { day: str(streak.day, ''), count: num(streak.count, 0), best: num(streak.best, 0) },
    counters: Object.fromEntries(Object.keys(ZERO_COUNTERS).map((k) => [k, num(counters[k], 0)])) as unknown as Counters,
    inbox: Array.isArray(data.inbox) ? data.inbox.filter((n: any) => n && typeof n.title === 'string').slice(-60) : [],
    nextBoxId: num(data.nextBoxId, 1),
  };
}
