// The reward engine: everything that happens when you clear a level — XP and
// crawler levels, gold, viewers, skill points, loot boxes, sponsors,
// achievements, daily quests — plus opening boxes, the shop, classes and pets.
// Every function takes a save and returns a new one alongside a list of
// events for the UI to announce. Randomness is injected, so it's testable.
import { ALL_LEVELS, DECKS } from '../content';
import { REVIEW_ITEMS } from '../content/review';
import { ALL_ITEMS, FLOOR_SCROLLS, item, RARITY_ORDER, type Item, type Rarity } from './items';
import {
  codeStars,
  crawlerLevel,
  floorCleared,
  floorOf,
  isBoss,
  levelSchool,
  levelState,
  xpFor,
  xpToReach,
  type Box,
  type ClassId,
  type Counters,
  type Notice,
  type PetKind,
  type Save,
  type Tier,
} from './progress';
import { MAX_SKILL_LEVEL, SKILLS, skillLevel, type SkillId } from './skills';
import type { Level, ReviewItem } from './types';

export type Rng = () => number;

export type Reward =
  | { kind: 'xp'; amount: number; detail: string }
  | { kind: 'gold'; amount: number; detail: string }
  | { kind: 'viewers'; amount: number; total: number }
  | { kind: 'level-up'; level: number; title: string; newTitle: boolean }
  | { kind: 'skill-up'; skill: SkillId; level: number }
  | { kind: 'box'; box: Box }
  | { kind: 'achievement'; achievement: Achievement }
  | { kind: 'sponsor'; sponsor: Sponsor; floor: string }
  | { kind: 'fans'; milestone: number }
  | { kind: 'feed'; text: string }
  | { kind: 'streak'; count: number }
  | { kind: 'offer'; what: 'class' | 'pet' };

export interface Result {
  save: Save;
  events: Reward[];
}

// ---------------------------------------------------------------- boxes

export const TIER_INFO: Record<Tier, { name: string; color: string; icon: string }> = {
  bronze: { name: 'Bronze', color: '#cd8b52', icon: '🟫' },
  silver: { name: 'Silver', color: '#c9d3e3', icon: '⬜' },
  gold: { name: 'Gold', color: '#ffc94d', icon: '🟨' },
  platinum: { name: 'Platinum', color: '#9be6ff', icon: '🟦' },
  legendary: { name: 'Legendary', color: '#ff8a3d', icon: '🟧' },
  celestial: { name: 'Celestial', color: '#e8b6ff', icon: '🟪' },
};

export function addBox(save: Save, tier: Tier, source: string, guarantee?: string): Result {
  const box: Box = { id: `box-${save.nextBoxId}`, tier, source, ...(guarantee ? { guarantee } : {}) };
  return { save: { ...save, boxes: [...save.boxes, box], nextBoxId: save.nextBoxId + 1 }, events: [{ kind: 'box', box }] };
}

const LOOT: Record<Tier, { rolls: number; gold: [number, number]; weights: Partial<Record<Rarity, number>>; tokens: number; boosts: number; minRarity?: Rarity }> = {
  bronze: { rolls: 2, gold: [10, 25], weights: { common: 80, uncommon: 18, rare: 2 }, tokens: 0, boosts: 0 },
  silver: { rolls: 3, gold: [25, 60], weights: { common: 50, uncommon: 38, rare: 11, epic: 1 }, tokens: 0, boosts: 0 },
  gold: { rolls: 4, gold: [60, 140], weights: { common: 25, uncommon: 40, rare: 27, epic: 7, legendary: 1 }, tokens: 1, boosts: 0 },
  platinum: { rolls: 5, gold: [150, 300], weights: { uncommon: 35, rare: 42, epic: 19, legendary: 4 }, tokens: 2, boosts: 2 },
  legendary: { rolls: 5, gold: [300, 600], weights: { rare: 45, epic: 42, legendary: 13 }, tokens: 3, boosts: 3, minRarity: 'legendary' },
  celestial: { rolls: 6, gold: [1000, 1500], weights: { epic: 50, legendary: 50 }, tokens: 5, boosts: 5, minRarity: 'celestial' },
};

export type Loot =
  | { kind: 'gold'; amount: number; note?: string }
  | { kind: 'tokens'; amount: number }
  | { kind: 'boost'; amount: number }
  | { kind: 'item'; item: Item; isNew: boolean };

const SALVAGE: Record<Rarity, number> = { common: 8, uncommon: 20, rare: 50, epic: 120, legendary: 300, celestial: 600 };

function pickWeighted<K extends string>(weights: Partial<Record<K, number>>, rng: Rng): K {
  const entries = Object.entries(weights) as [K, number][];
  const total = entries.reduce((n, [, w]) => n + w, 0);
  let roll = rng() * total;
  for (const [k, w] of entries) {
    roll -= w;
    if (roll < 0) return k;
  }
  return entries[entries.length - 1][0];
}

const between = (rng: Rng, [lo, hi]: [number, number]) => Math.round(lo + rng() * (hi - lo));

function droppable(rarity: Rarity): Item[] {
  return ALL_ITEMS.filter((i) => i.drops && i.rarity === rarity);
}

/** Pick an item of this rarity, preferring ones the player doesn't own yet. */
function rollItem(save: Save, rarity: Rarity, rng: Rng): Item | null {
  for (let r = RARITY_ORDER.indexOf(rarity); r >= 0; r--) {
    const pool = droppable(RARITY_ORDER[r]);
    if (!pool.length) continue;
    const fresh = pool.filter((i) => !save.items[i.id]);
    const from = fresh.length ? fresh : pool;
    return from[Math.floor(rng() * from.length)];
  }
  return null;
}

function grantItem(save: Save, it: Item, loot: Loot[]): Save {
  const owned = !!save.items[it.id];
  // Cosmetics and scrolls are unique: a duplicate is salvaged for gold.
  if (owned && it.kind !== 'collectible') {
    loot.push({ kind: 'gold', amount: SALVAGE[it.rarity], note: `Duplicate ${it.name} salvaged` });
    return { ...save, gold: save.gold + SALVAGE[it.rarity] };
  }
  loot.push({ kind: 'item', item: it, isNew: !owned });
  return { ...save, items: { ...save.items, [it.id]: (save.items[it.id] ?? 0) + 1 } };
}

/** Open a box: roll its contents, apply them, and remove it. */
export function openBox(save: Save, boxId: string, rng: Rng): { save: Save; loot: Loot[]; box: Box } | null {
  const box = save.boxes.find((b) => b.id === boxId);
  if (!box) return null;
  const table = LOOT[box.tier];
  const loot: Loot[] = [];
  let s: Save = { ...save, boxes: save.boxes.filter((b) => b.id !== boxId), counters: { ...save.counters, boxesOpened: save.counters.boxesOpened + 1 } };

  const gold = between(rng, table.gold);
  loot.push({ kind: 'gold', amount: gold });
  s = { ...s, gold: s.gold + gold };
  if (table.tokens) {
    loot.push({ kind: 'tokens', amount: table.tokens });
    s = { ...s, hintTokens: s.hintTokens + table.tokens };
  }
  if (table.boosts) {
    loot.push({ kind: 'boost', amount: table.boosts });
    s = { ...s, boosts: s.boosts + table.boosts };
  }
  if (box.guarantee) s = grantItem(s, item(box.guarantee), loot);
  if (table.minRarity) {
    const it = table.minRarity === 'celestial' ? item('orrery-heart') : rollItem(s, table.minRarity, rng);
    if (it) s = grantItem(s, it, loot);
  }
  for (let i = 0; i < table.rolls; i++) {
    const what = rng();
    if (what < 0.22) {
      const g = between(rng, [Math.round(table.gold[0] / 2), Math.round(table.gold[1] / 2)]);
      loot.push({ kind: 'gold', amount: g });
      s = { ...s, gold: s.gold + g };
    } else if (what < 0.3) {
      loot.push({ kind: 'tokens', amount: 1 });
      s = { ...s, hintTokens: s.hintTokens + 1 };
    } else {
      const it = rollItem(s, pickWeighted(table.weights, rng), rng);
      if (it) s = grantItem(s, it, loot);
    }
  }
  return { save: s, loot: mergeLoot(loot), box };
}

/** Combine repeated gold, token and boost lines into one each. */
function mergeLoot(loot: Loot[]): Loot[] {
  const out: Loot[] = [];
  let gold = 0;
  let tokens = 0;
  let boosts = 0;
  for (const l of loot) {
    if (l.kind === 'gold' && !l.note) gold += l.amount;
    else if (l.kind === 'tokens') tokens += l.amount;
    else if (l.kind === 'boost') boosts += l.amount;
    else out.push(l);
  }
  const head: Loot[] = [];
  if (gold) head.push({ kind: 'gold', amount: gold });
  if (tokens) head.push({ kind: 'tokens', amount: tokens });
  if (boosts) head.push({ kind: 'boost', amount: boosts });
  return [...head, ...out];
}

// ---------------------------------------------------------------- classes and pets

export interface ClassInfo {
  id: ClassId;
  name: string;
  icon: string;
  perk: string;
  flavor: string;
}

export const CLASSES: ClassInfo[] = [
  { id: 'type-sorcerer', name: 'Type Sorcerer', icon: '🧙', perk: '+25% XP on TypeScript levels.', flavor: 'Bends the compiler to their will. The compiler has mixed feelings about this.' },
  { id: 'component-artificer', name: 'Component Artificer', icon: '🛠', perk: '+25% XP on React levels.', flavor: 'Builds interfaces out of tiny reusable pieces. Has opinions about prop names.' },
  { id: 'bug-hunter', name: 'Bug Hunter', icon: '🔍', perk: '+20% gold from everything, and a free hint token for every boss you beat.', flavor: 'Tracks bugs across a codebase by scent alone. Smells faintly of coffee.' },
  { id: 'speedrunner', name: 'Speedrunner', icon: '⚡', perk: '50% longer par times, and double speed bonuses.', flavor: 'Types fast. Thinks faster. Occasionally both at once.' },
  { id: 'crowd-favourite', name: 'Crowd Favourite', icon: '🌟', perk: '+50% viewers, and every Fan Box is one tier better.', flavor: 'The camera loves them. The audience loves them. The compiler is indifferent.' },
];

export const classInfo = (id: ClassId | null) => CLASSES.find((c) => c.id === id) ?? null;

export const PETS: { kind: PetKind; name: string; icon: string; blurb: string }[] = [
  { kind: 'drone', name: 'Maintenance Drone', icon: '🤖', blurb: 'Beeps encouragingly. Fixed a fuse once.' },
  { kind: 'cat', name: "Ship's Cat", icon: '🐈', blurb: 'Sits on the keyboard at the worst possible moment.' },
  { kind: 'octopus', name: 'Octo', icon: '🐙', blurb: 'Can type with eight arms. Chooses not to.' },
  { kind: 'owl', name: 'Debug Owl', icon: '🦉', blurb: 'Stays up all night. Judges your variable names.' },
  { kind: 'fox', name: 'Station Fox', icon: '🦊', blurb: 'Clever, quick, and has stolen three sandwiches.' },
  { kind: 'dragon', name: 'Pocket Dragon', icon: '🐉', blurb: 'Breathes tiny flames at failing tests.' },
];

export const PET_LINES = {
  pass: ['*does a little victory spin*', '*chirps proudly*', '*high-fives you, somehow*', '*knew you could do it*', '*tells the other pets about you*'],
  fail: ['*pats your hand reassuringly*', '*reads the error message with you*', '*offers you a snack*', '*suggests a rubber duck*', '*believes in you*'],
  box: ['*shakes the box*', '*wants the box itself, not what\'s in it*', '*sniffs the loot*'],
};

export function choosePet(save: Save, kind: PetKind, name: string): Save {
  return { ...save, pet: { kind, name: name.trim().slice(0, 20) || PETS.find((p) => p.kind === kind)!.name } };
}

export function chooseClass(save: Save, id: ClassId): Save {
  return { ...save, classId: id };
}

// ---------------------------------------------------------------- sponsors and fans

export interface Sponsor {
  name: string;
  icon: string;
  message: string;
}

/** Each floor you clear, a sponsor sends a gift. All fictional, all slightly desperate. */
export const SPONSORS: Record<string, Sponsor> = {
  boot: { name: 'Quasar Cola', icon: '🥤', message: 'Quasar Cola: the official drink of engineers who just printed "Hello". Fizzier than a stack overflow!' },
  supply: { name: 'Stackwise Bank', icon: '🏦', message: 'Stackwise Bank noticed how well you handle arrays. Have you considered a career in accounting? Please?' },
  modern: { name: 'Null Pointer Insurance', icon: '🛡', message: 'Null Pointer Insurance: for when your code goes undefined. You clearly don\'t need us. Here\'s a gift anyway.' },
  foundry: { name: 'Typesafe Tyres', icon: '🛞', message: 'Typesafe Tyres: strongly typed, never deflated. Our engineers watched you work and wept.' },
  lab: { name: 'Generic Brand Generics', icon: '🧪', message: 'Generic Brand Generics<T>: works with whatever you\'ve got. Congratulations from all of us, whoever we are.' },
  vault: { name: 'Infer & Daughters', icon: '⚖', message: 'Infer & Daughters, Type-Level Solicitors: we have read your conditional types and are legally obliged to be impressed.' },
  bay: { name: 'Pixel Perfect Paints', icon: '🖌', message: 'Pixel Perfect Paints: we only sponsor engineers whose components are pure. You qualify. Barely.' },
  control: { name: 'StateFarm Hydroponics', icon: '🌱', message: 'StateFarm Hydroponics: we grow things immutably. Our tomatoes have never been mutated. Neither has your state.' },
  core: { name: 'Hookline Fishing Co.', icon: '🎣', message: 'Hookline Fishing Co.: we know a good hook when we see one. useEffect, useRef, useReducer… you caught them all.' },
  production: { name: 'The Consortium of Everything', icon: '🌌', message: 'The Consortium of Everything has been watching since Floor 1. On behalf of every viewer in the galaxy: well done, engineer.' },
};

export const FAN_MILESTONES = [100, 1_000, 5_000, 25_000, 100_000, 500_000, 1_000_000, 5_000_000];
const FAN_TIERS: Tier[] = ['bronze', 'bronze', 'silver', 'silver', 'gold', 'gold', 'platinum', 'legendary'];

function nextTier(t: Tier): Tier {
  const all: Tier[] = ['bronze', 'silver', 'gold', 'platinum', 'legendary', 'celestial'];
  return all[Math.min(all.length - 2, all.indexOf(t) + 1)];
}

export function addViewers(save: Save, amount: number): Result {
  const events: Reward[] = [];
  let s: Save = { ...save, viewers: save.viewers + amount };
  events.push({ kind: 'viewers', amount, total: s.viewers });
  while (s.fanMilestones < FAN_MILESTONES.length && s.viewers >= FAN_MILESTONES[s.fanMilestones]) {
    const milestone = FAN_MILESTONES[s.fanMilestones];
    let tier = FAN_TIERS[s.fanMilestones];
    if (s.classId === 'crowd-favourite') tier = nextTier(tier);
    s = { ...s, fanMilestones: s.fanMilestones + 1 };
    events.push({ kind: 'fans', milestone });
    const r = addBox(s, tier, `Fan Box: ${formatViewers(milestone)} viewers`);
    s = r.save;
    events.push(...r.events);
  }
  return { save: s, events };
}

export function formatViewers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 ? 1 : 0)}K`;
  return String(n);
}

// ---------------------------------------------------------------- XP and skills

/** Add XP and pay out any level-ups: a box per level (better every 5th and 10th) and some gold. */
export function addXp(save: Save, amount: number, detail: string): Result {
  if (amount <= 0) return { save, events: [] };
  const before = crawlerLevel(save.xp);
  let s: Save = { ...save, xp: save.xp + amount };
  const events: Reward[] = [{ kind: 'xp', amount, detail }];
  const after = crawlerLevel(s.xp);
  for (let level = before.level + 1; level <= after.level; level++) {
    const title = crawlerLevel(xpToReach(level)).title;
    const prevTitle = crawlerLevel(xpToReach(level - 1)).title;
    events.push({ kind: 'level-up', level, title, newTitle: title !== prevTitle });
    const tier: Tier = level % 10 === 0 ? 'gold' : level % 5 === 0 ? 'silver' : 'bronze';
    const r = addBox(s, tier, `Level-Up Box: level ${level}`);
    // Level-ups come often, so the gold bonus grows gently with level.
    const gold = 10 + 5 * level;
    s = { ...r.save, gold: r.save.gold + gold };
    events.push(...r.events, { kind: 'gold', amount: gold, detail: `Level ${level} bonus` });
  }
  return { save: s, events };
}

export function addSkillPoints(save: Save, skills: SkillId[], points: number): Result {
  const events: Reward[] = [];
  const next = { ...save.skills };
  for (const skill of skills) {
    const before = skillLevel(next[skill] ?? 0);
    next[skill] = (next[skill] ?? 0) + points;
    const after = Math.min(MAX_SKILL_LEVEL, skillLevel(next[skill]!));
    if (after > before) events.push({ kind: 'skill-up', skill, level: after });
  }
  return { save: { ...save, skills: next }, events };
}

// ---------------------------------------------------------------- completing a level

export interface Outcome {
  stars: number;
  /** Code levels: passed on the very first run of this attempt. */
  firstTry: boolean;
  /** Code levels: failed runs before passing (on this attempt). */
  failedRuns: number;
  /** Code levels: no hints at all and no solution on this attempt. */
  clean: boolean;
  /** Quizzes: answered without a single mistake. */
  perfect?: boolean;
  /** Seconds spent on the level this visit. */
  seconds: number;
}

/** Par time for a speed bonus: a generous target, not a race. */
export function parSeconds(level: Level, classId: ClassId | null): number {
  const base = level.kind === 'quiz' ? 180 : isBoss(level) ? 900 : 360;
  return classId === 'speedrunner' ? base * 1.5 : base;
}

const FEED = {
  firstTry: [
    'First try! The chat is going absolutely feral.',
    'Did you SEE that? First run, all green. Somebody check if they\'re a robot.',
    'Not a single failed run. Our producers are in tears. Happy ones. Mostly.',
  ],
  flawless: [
    'Three stars! The sponsors are reaching for their wallets.',
    'Flawless. FLAWLESS. We may have to replay that in slow motion.',
  ],
  struggle: [
    'After a heroic number of attempts — victory! Viewers love a comeback.',
    'Persistence pays, folks. Literally. In loot boxes.',
  ],
  solution: [
    'They peeked at the solution. We saw that. The whole galaxy saw that.',
    'A solution was "consulted". Our legal team prefers the term "research".',
  ],
  boss: [
    'THE BOSS IS DOWN! Ratings are through the roof — and the roof is in space!',
    'Boss defeated! Somewhere, a sponsor is printing a very large cheque.',
  ],
  normal: [
    'Another system back online. Steady hands, steady ratings.',
    'Clean work. The audience nods approvingly. Some of them have several heads.',
    'Progress! The station hums. The chat spams little reactor emojis.',
  ],
};
const pick = <T,>(xs: T[], rng: Rng) => xs[Math.floor(rng() * xs.length)];

/**
 * Everything that happens when a level is passed. XP, gold and viewers are
 * paid only for *improvements* (a first clear, or more stars than before), so
 * replays can't be farmed — but they can still earn the stars you missed.
 */
export function completeLevel(save: Save, level: Level, outcome: Outcome, rng: Rng): Result {
  const prev = levelState(save, level.id);
  const firstClear = !prev.done;
  const best = Math.max(prev.stars, outcome.stars);
  const school = levelSchool(level);
  const floor = floorOf(level.id);
  const boss = isBoss(level);
  const events: Reward[] = [];
  let s: Save = {
    ...save,
    levels: { ...save.levels, [level.id]: { ...prev, done: true, stars: best, bestSeconds: Math.min(prev.bestSeconds ?? Infinity, outcome.seconds) } },
  };
  const apply = (r: Result) => {
    s = r.save;
    events.push(...r.events);
  };

  // XP: for the stars you improved, with class and boost bonuses.
  const baseXp = Math.max(0, xpFor(level, best) - xpFor(level, prev.stars));
  if (baseXp > 0) {
    let multiplier = 1;
    const parts: string[] = [];
    if ((s.classId === 'type-sorcerer' && school === 'TypeScript') || (s.classId === 'component-artificer' && school === 'React')) {
      multiplier += 0.25;
      parts.push('class +25%');
    }
    if (s.boosts > 0) {
      multiplier += 0.5;
      parts.push('boost +50%');
      s = { ...s, boosts: s.boosts - 1 };
    }
    apply(addXp(s, Math.round(baseXp * multiplier), parts.length ? parts.join(', ') : 'level clear'));
  }

  // Gold: a clear, its stars, and a speed bonus on first clears.
  let gold = firstClear ? (boss ? 40 : level.kind === 'quiz' ? 6 : 10) + best * 5 : Math.max(0, best - prev.stars) * 5;
  const underPar = firstClear && outcome.seconds <= parSeconds(level, s.classId);
  if (underPar) gold += s.classId === 'speedrunner' ? 30 : 15;
  if (s.classId === 'bug-hunter') gold = Math.round(gold * 1.2);
  if (gold > 0) {
    s = { ...s, gold: s.gold + gold };
    events.push({ kind: 'gold', amount: gold, detail: underPar ? 'clear + speed bonus' : 'clear' });
  }

  // Viewers: grow with the floor you're on, and love a show.
  if (firstClear || best > prev.stars) {
    let v = (30 + 20 * Math.max(0, floor.index)) * best;
    if (outcome.firstTry) v *= 2;
    if (boss) v *= 3;
    if (!firstClear) v = Math.round(v / 2);
    if (s.classId === 'crowd-favourite') v = Math.round(v * 1.5);
    apply(addViewers(s, v));
  }

  // Skill points: one for the first clear, one more for reaching three stars.
  if (firstClear) apply(addSkillPoints(s, level.skills, 1));
  if (best === 3 && prev.stars < 3) apply(addSkillPoints(s, level.skills, 1));

  // Loot.
  if (firstClear) apply(addBox(s, boss ? 'gold' : 'bronze', boss ? `Boss Box: ${level.system}` : `Level clear: ${level.title}`, boss ? FLOOR_SCROLLS[floor.id] : undefined));
  if (best === 3 && prev.stars < 3) apply(addBox(s, 'silver', `Flawless: ${level.title}`));
  if (firstClear && boss && s.classId === 'bug-hunter') s = { ...s, hintTokens: s.hintTokens + 1 };

  // Counters, for achievements and quests.
  const c = { ...s.counters };
  if (firstClear) c.levelsPassed++;
  if (best === 3 && prev.stars < 3) c.threeStars++;
  if (outcome.firstTry) c.firstTries++;
  if (outcome.clean && level.kind === 'code') c.cleanClears++;
  if (level.kind === 'quiz') c.quizzesDone++;
  if (outcome.perfect) c.perfectQuizzes++;
  if (firstClear && boss) c.bossesBeaten++;
  if (underPar) c.speedBonuses++;
  if (!firstClear && best > prev.stars) c.improvedClears++;
  s = { ...s, counters: c };

  // A whole floor cleared: the sponsor sends a gift.
  if (floor.index >= 0 && floorCleared(s, floor.index) && !s.sponsors.includes(floor.id)) {
    const sponsor = SPONSORS[floor.id];
    s = { ...s, sponsors: [...s.sponsors, floor.id] };
    events.push({ kind: 'sponsor', sponsor, floor: DECKS[floor.index].name });
    apply(addBox(s, floor.id === 'production' ? 'legendary' : 'platinum', `Sponsor Box: ${sponsor.name}`));
  }
  // The whole station restored: the Celestial box.
  if (ALL_LEVELS.every((l) => levelState(s, l.id).done) && !s.sponsors.includes('station')) {
    s = { ...s, sponsors: [...s.sponsors, 'station'] };
    apply(addBox(s, 'celestial', 'Celestial Box: Station Restored'));
  }

  // The commentary.
  const lines = boss ? FEED.boss : outcome.firstTry ? FEED.firstTry : best === 3 && prev.stars < 3 ? FEED.flawless : outcome.failedRuns >= 5 ? FEED.struggle : levelState(save, level.id).solution ? FEED.solution : FEED.normal;
  events.push({ kind: 'feed', text: pick(lines, rng) });

  // Offers that unlock with progress.
  if (floor.id === 'boot' && boss && !s.pet) events.push({ kind: 'offer', what: 'pet' });
  if (floor.id === 'modern' && boss && !s.classId) events.push({ kind: 'offer', what: 'class' });

  apply(checkAchievements(s));
  return { save: s, events };
}

/** Code levels: compute the outcome from the attempt's progress record. */
export function codeOutcome(save: Save, level: Level, seconds: number): Outcome {
  const p = levelState(save, level.id);
  return {
    stars: codeStars(p),
    firstTry: p.runs === 1,
    failedRuns: Math.max(0, p.runs - 1),
    clean: p.hints === 0 && !p.solution,
    seconds,
  };
}

// ---------------------------------------------------------------- achievements

export interface Achievement {
  id: string;
  name: string;
  icon: string;
  /** What you did. */
  description: string;
  /** What THE FEED says about it. */
  quip: string;
  tier: Tier;
  /** A title unlocked along with it. */
  title?: string;
  earned(save: Save): boolean;
}

const skillLevels = (s: Save) => Object.values(s.skills).map((p) => skillLevel(p ?? 0));
const ownedCount = (s: Save, kind?: string) => Object.keys(s.items).filter((id) => !kind || ALL_ITEMS.find((i) => i.id === id)?.kind === kind).length;
const level = (s: Save) => crawlerLevel(s.xp).level;

const FLOOR_ACHIEVEMENTS: { name: string; icon: string; quip: string }[] = [
  { name: 'Booted Up', icon: '💡', quip: 'You can now make a computer do things. Use this power responsibly. Or entertainingly.' },
  { name: 'Supply Chain', icon: '📦', quip: 'Arrays, loops and reduce. The quartermaster has asked for your autograph.' },
  { name: 'Modern Times', icon: '✨', quip: 'Closures, async, classes. You now write JavaScript better than most of the internet.' },
  { name: 'Type Founder', icon: '🔩', quip: 'The compiler is no longer your enemy. It\'s your extremely pedantic friend.' },
  { name: 'Lab Director', icon: '🧪', quip: 'Generics! Unions! Utility types! The lab coats suit you.' },
  { name: 'Vault Breaker', icon: '🔐', quip: 'You wrote a schema library. People get jobs for that. Real ones.' },
  { name: 'Component Architect', icon: '🧩', quip: 'Your components are small, typed and reusable. Unlike most furniture.' },
  { name: 'Mission Controller', icon: '🎛', quip: 'State, events, forms. The Control Room finally responds to buttons.' },
  { name: 'Core Engineer', icon: '☢', quip: 'Effects, refs, reducers and context. The reactor is online, and so are you.' },
  { name: 'Ship It', icon: '🚀', quip: 'Loading states, race conditions, accessibility, tests. That\'s not a student. That\'s a professional.' },
];

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'hello-world', name: 'Hello, World', icon: '👋', tier: 'bronze', description: 'Clear your first level.', quip: 'You told a computer to say something and it did. Power is a slippery slope.', earned: (s) => s.counters.levelsPassed >= 1 },
  { id: 'first-try', name: 'First Try', icon: '🎯', tier: 'silver', description: 'Pass a code level on your very first run.', quip: 'No failed runs. Not one. The compiler is suspicious of you now.', earned: (s) => s.counters.firstTries >= 1 },
  { id: 'persistence', name: 'Persistence', icon: '🔧', tier: 'silver', description: 'Pass a level after 5 or more failed runs.', quip: 'They say insanity is trying the same thing and expecting a different result. They say programming is the same thing, but it works on try six.', earned: (s) => s.counters.failedRuns >= 5 && s.counters.levelsPassed >= 1 },
  { id: 'ten-down', name: 'Ten Down', icon: '🔟', tier: 'silver', description: 'Clear 10 levels.', quip: 'Ten systems back online. The coffee machine is still broken. Priorities.', earned: (s) => s.counters.levelsPassed >= 10 },
  { id: 'quarter', name: 'Quarter Master', icon: '🗺', tier: 'gold', description: 'Clear 25 levels.', quip: 'A quarter of the station restored. The rest of the crew have started calling you "boss".', earned: (s) => s.counters.levelsPassed >= 25 },
  { id: 'halfway', name: 'Halfway There', icon: '🌗', tier: 'gold', description: 'Clear 45 levels.', quip: 'Halfway. Livin\' on a prayer. And on well-typed code.', earned: (s) => s.counters.levelsPassed >= 45 },
  { id: 'all-levels', name: 'Station Restored', icon: '🌟', tier: 'legendary', title: 'title-architect', description: 'Clear every level on the station.', quip: 'Every system online. You arrived not knowing what a string was. Look at you now.', earned: (s) => ALL_LEVELS.every((l) => levelState(s, l.id).done) },
  { id: 'self-taught', name: 'Self-Taught', icon: '📘', tier: 'silver', description: 'Earn 3 stars on 5 levels.', quip: 'Five flawless clears. Your teachers would be proud. Your teachers are a space station.', earned: (s) => s.counters.threeStars >= 5 },
  { id: 'perfectionist', name: 'Perfectionist', icon: '💎', tier: 'gold', title: 'title-perfect', description: 'Earn 3 stars on 25 levels.', quip: 'Twenty-five perfect scores. Have you considered that you might have a problem? Don\'t. It\'s working.', earned: (s) => s.counters.threeStars >= 25 },
  { id: 'flawless-floor', name: 'Flawless Floor', icon: '⭐', tier: 'gold', description: '3 stars on every level of a floor.', quip: 'An entire floor, flawless. The floor itself is blushing.', earned: (s) => DECKS.some((d) => d.levels.every((l) => levelState(s, l.id).stars === 3)) },
  { id: 'unassisted', name: 'Unassisted', icon: '🧠', tier: 'silver', description: 'Clear 10 code levels without hints or the solution.', quip: 'Ten levels, no hints. The hint system has filed for unemployment.', earned: (s) => s.counters.cleanClears >= 10 },
  { id: 'sharp-eye', name: 'Sharp Eye', icon: '👁', tier: 'silver', description: 'Finish a quiz without a mistake.', quip: 'Six questions, six right answers. You read code like other people read menus.', earned: (s) => s.counters.perfectQuizzes >= 1 },
  { id: 'quiz-master', name: 'Quiz Master', icon: '🎓', tier: 'gold', description: 'Finish 5 quizzes without a mistake.', quip: 'Five perfect quizzes. The quiz machine would like a word. It has run out of questions.', earned: (s) => s.counters.perfectQuizzes >= 5 },
  { id: 'boss-slayer', name: 'Boss Slayer', icon: '⚔', tier: 'silver', title: 'title-boss', description: 'Beat your first boss.', quip: 'Your first boss, defeated. It had a family. Well, a test suite.', earned: (s) => s.counters.bossesBeaten >= 1 },
  { id: 'pest-control', name: 'Pest Control', icon: '🪲', tier: 'gold', description: 'Beat 5 bosses.', quip: 'Five bosses down. The remaining bosses have started a support group.', earned: (s) => s.counters.bossesBeaten >= 5 },
  ...FLOOR_ACHIEVEMENTS.map((f, i): Achievement => ({
    id: `floor-${i + 1}`,
    name: f.name,
    icon: f.icon,
    tier: i === 9 ? 'legendary' : i >= 5 ? 'platinum' : 'gold',
    title: i === 9 ? 'title-production' : undefined,
    description: `Clear Floor ${i + 1}: ${DECKS[i]?.name ?? ''}.`,
    quip: f.quip,
    earned: (s) => floorCleared(s, i),
  })),
  { id: 'skill-2', name: 'Skill Issue (Resolved)', icon: '📈', tier: 'bronze', description: 'Raise any skill to level 2.', quip: 'Your first skill is level 2. The galaxy\'s bookmakers are revising their odds.', earned: (s) => skillLevels(s).some((l) => l >= 2) },
  { id: 'skill-3', name: 'Adept', icon: '🥉', tier: 'silver', description: 'Raise any skill to level 3.', quip: 'Adept! That\'s a real word with a real meaning and it applies to you.', earned: (s) => skillLevels(s).some((l) => l >= 3) },
  { id: 'skill-5', name: 'Master of One', icon: '🥇', tier: 'gold', description: 'Master a skill (level 5).', quip: 'A mastered skill. Somewhere, a recruiter just felt a disturbance.', earned: (s) => skillLevels(s).some((l) => l >= 5) },
  { id: 'polymath', name: 'Polymath', icon: '🎨', tier: 'gold', description: 'Have 10 skills at level 2 or higher.', quip: 'Ten skills. You\'re not a one-trick pony. You\'re a whole circus.', earned: (s) => skillLevels(s).filter((l) => l >= 2).length >= 10 },
  { id: 'full-stack', name: 'Full Stack of Pancakes', icon: '🥞', tier: 'platinum', description: 'A skill at level 3+ in JavaScript, TypeScript and React.', quip: 'All three schools. JavaScript, TypeScript, React. Syrup optional.', earned: (s) => (['JavaScript', 'TypeScript', 'React'] as const).every((school) => Object.entries(s.skills).some(([k, p]) => SKILLS[k as SkillId].school === school && skillLevel(p ?? 0) >= 3)) },
  { id: 'level-5', name: 'Getting Started', icon: '5️⃣', tier: 'bronze', description: 'Reach crawler level 5.', quip: 'Level 5. Junior developers have been hired for less.', earned: (s) => level(s) >= 5 },
  { id: 'level-10', name: 'Double Digits', icon: '🔢', tier: 'silver', description: 'Reach crawler level 10.', quip: 'Level 10! Please hold while we update your LinkedIn.', earned: (s) => level(s) >= 10 },
  { id: 'level-20', name: 'Veteran', icon: '🎖', tier: 'gold', description: 'Reach crawler level 20.', quip: 'Level 20. You\'ve seen things. Terrible things. Like `any`.', earned: (s) => level(s) >= 20 },
  { id: 'level-45', name: 'Living Legend', icon: '🗿', tier: 'platinum', description: 'Reach crawler level 45.', quip: 'Level 45. There are statues of you on several moons.', earned: (s) => level(s) >= 45 },
  { id: 'unboxing', name: 'Unboxing Video', icon: '📦', tier: 'bronze', description: 'Open your first loot box.', quip: 'Your first box! Four billion viewers just watched you open a box. This is what the galaxy wants.', earned: (s) => s.counters.boxesOpened >= 1 },
  { id: 'box-addict', name: 'Box Addict', icon: '🎁', tier: 'gold', description: 'Open 50 loot boxes.', quip: 'Fifty boxes. Our lawyers would like us to remind you that loot boxes are entirely free here. Unlike elsewhere.', earned: (s) => s.counters.boxesOpened >= 50 },
  { id: 'collector', name: 'Collector', icon: '🏺', tier: 'silver', description: 'Own 25 different items.', quip: 'Twenty-five items. Your quarters are starting to look like a museum of developer culture.', earned: (s) => ownedCount(s) >= 25 },
  { id: 'librarian', name: 'Librarian', icon: '📚', tier: 'gold', description: 'Collect 10 Codex scrolls.', quip: 'Ten scrolls. You now own more documentation than most codebases.', earned: (s) => ownedCount(s, 'scroll') >= 10 },
  { id: 'legendary-pull', name: 'Legendary Pull', icon: '🌠', tier: 'gold', description: 'Find a legendary item.', quip: 'LEGENDARY! The chat has crashed. Engineers are being dispatched.', earned: (s) => Object.keys(s.items).some((id) => ['legendary', 'celestial'].includes(ALL_ITEMS.find((i) => i.id === id)?.rarity ?? '')) },
  { id: 'credit-score', name: 'Credit Score', icon: '💰', tier: 'silver', description: 'Hold 1,000 gold at once.', quip: 'A thousand gold. Stackwise Bank has sent you a pen. A nice one.', earned: (s) => s.gold >= 1000 },
  { id: 'big-spender', name: 'Big Spender', icon: '🛍', tier: 'silver', description: 'Spend 500 gold in the Safe Room.', quip: 'Five hundred gold, spent. The shopkeeper bought a second ship.', earned: (s) => s.counters.goldSpent >= 500 },
  { id: 'token-gesture', name: 'Token Gesture', icon: '🎟', tier: 'bronze', description: 'Use a hint token.', quip: 'A hint, for free. Your stars remain un-besmirched.', earned: (s) => s.counters.tokensUsed >= 1 },
  { id: 'peeked', name: 'I Was Never Here', icon: '🙈', tier: 'bronze', description: 'Look at a reference solution.', quip: 'We saw that. The whole galaxy saw that. It\'s fine. Reading good code is how everyone learns.', earned: (s) => s.counters.solutionsSeen >= 1 },
  { id: 'fail-fast', name: 'Fail Fast', icon: '💥', tier: 'silver', description: 'Have 100 failed runs.', quip: 'One hundred failed runs. Every one of them taught you something. You have learned SO much.', earned: (s) => s.counters.failedRuns >= 100 },
  { id: 'remember-when', name: 'Remember When', icon: '🧠', tier: 'bronze', description: 'Finish your first review session.', quip: 'Your first review. Remembering things on purpose: the closest thing programming has to a cheat code.', earned: (s) => s.counters.reviewSessions >= 1 },
  { id: 'spaced-out', name: 'Spaced Out', icon: '📇', tier: 'silver', description: 'Answer 50 review cards.', quip: 'Fifty cards. Memory scientists have been saying this works since 1885. You are now one of their success stories.', earned: (s) => s.counters.reviewsAnswered >= 50 },
  { id: 'clean-sweep', name: 'Clean Sweep', icon: '🧹', tier: 'silver', description: 'Finish a review of five or more cards without a mistake.', quip: 'Not one wrong. Last week\'s lessons are still in there, filed neatly.', earned: (s) => s.counters.perfectReviews >= 1 },
  { id: 'long-term-memory', name: 'Long-Term Memory', icon: '🐘', tier: 'gold', title: 'title-recall', description: 'Remember 10 review cards for a month or more.', quip: 'Ten cards, remembered across a month. That\'s not cramming. That\'s knowing.', earned: (s) => Object.values(s.reviews).filter((r) => r.box >= REVIEW_MONTH_BOX).length >= 10 },
  { id: 'second-wind', name: 'Second Wind', icon: '🔁', tier: 'silver', description: 'Replay a level and raise its stars.', quip: 'They came back to a level they\'d already cleared, and did it better. That\'s the whole job, really.', earned: (s) => s.counters.improvedClears >= 1 },
  { id: 'rubber-duck', name: 'Rubber Duck', icon: '🦆', tier: 'silver', description: 'Explain 10 levels back in your own words.', quip: 'Ten explanations. If you can explain it, you understand it. The duck agrees.', earned: (s) => s.counters.notesWritten >= 10 },
  { id: 'going-viral', name: 'Going Viral', icon: '📈', tier: 'silver', description: 'Reach 10,000 viewers.', quip: 'Ten thousand viewers. Clip channels are making compilations of your semicolons.', earned: (s) => s.viewers >= 10_000 },
  { id: 'galactic-celebrity', name: 'Galactic Celebrity', icon: '🌌', tier: 'gold', title: 'title-celebrity', description: 'Reach 1,000,000 viewers.', quip: 'A MILLION viewers. You have fans on planets you can\'t pronounce.', earned: (s) => s.viewers >= 1_000_000 },
  { id: 'clocking-in', name: 'Clocking In', icon: '⏰', tier: 'bronze', description: 'Claim a daily quest.', quip: 'Your first daily quest. Consistency: the secret ingredient nobody wants to hear about.', earned: (s) => (s.quests?.claimed.length ?? 0) > 0 || s.streak.best >= 1 },
  { id: 'habit-forming', name: 'Habit Forming', icon: '📅', tier: 'silver', description: 'A 3-day streak.', quip: 'Three days in a row. Science says this is how habits start. Science is watching.', earned: (s) => s.streak.best >= 3 },
  { id: 'dedicated', name: 'Dedicated', icon: '🗓', tier: 'gold', description: 'A 7-day streak.', quip: 'A whole week. The station has given you your own parking space.', earned: (s) => s.streak.best >= 7 },
  { id: 'speed-demon', name: 'Speed Demon', icon: '🏎', tier: 'silver', description: 'Earn 5 speed bonuses.', quip: 'Five levels under par. Your keyboard is smoking slightly.', earned: (s) => s.counters.speedBonuses >= 5 },
  { id: 'class-act', name: 'Class Act', icon: '🎭', tier: 'bronze', description: 'Choose a class.', quip: 'A class! Your character sheet is finally more than a name and a frown.', earned: (s) => !!s.classId },
  { id: 'best-friend', name: 'Best Friend', icon: '🐾', tier: 'bronze', description: 'Adopt a companion.', quip: 'A companion! It will love you unconditionally, even when your tests fail.', earned: (s) => !!s.pet },
];

export const achievement = (id: string) => ACHIEVEMENTS.find((a) => a.id === id);

/** Award every newly earned achievement: its box and any title that comes with it. */
export function checkAchievements(save: Save): Result {
  let s = save;
  const events: Reward[] = [];
  // Earning one can earn another (e.g. its box pushes you to Hoarder), so loop until stable.
  for (let pass = 0; pass < 5; pass++) {
    const fresh = ACHIEVEMENTS.filter((a) => !s.achievements.includes(a.id) && a.earned(s));
    if (!fresh.length) break;
    for (const a of fresh) {
      s = { ...s, achievements: [...s.achievements, a.id] };
      if (a.title) s = { ...s, items: { ...s.items, [a.title]: 1 } };
      events.push({ kind: 'achievement', achievement: a });
      const r = addBox(s, a.tier, `Achievement: ${a.name}`);
      s = r.save;
      events.push(...r.events);
    }
  }
  return { save: s, events };
}

// ---------------------------------------------------------------- daily quests and streaks

export interface Quest {
  id: string;
  text: string;
  counter: keyof Counters;
  goal: number;
}

export const QUESTS: Quest[] = [
  { id: 'clear-2', text: 'Clear 2 levels', counter: 'levelsPassed', goal: 2 },
  { id: 'three-star', text: 'Earn 3 stars on a level', counter: 'threeStars', goal: 1 },
  { id: 'first-try', text: 'Pass a level on your first run', counter: 'firstTries', goal: 1 },
  { id: 'clean', text: 'Clear a level without hints', counter: 'cleanClears', goal: 1 },
  { id: 'quiz', text: 'Finish a quiz', counter: 'quizzesDone', goal: 1 },
  { id: 'review', text: 'Answer 5 review cards', counter: 'reviewsAnswered', goal: 5 },
  { id: 'explain', text: 'Explain a level back in your own words', counter: 'notesWritten', goal: 1 },
  { id: 'boxes', text: 'Open 2 loot boxes', counter: 'boxesOpened', goal: 2 },
  { id: 'runs', text: 'Run your code 5 times', counter: 'runs', goal: 5 },
];

/** A day as YYYY-MM-DD in the player's own time zone. */
export function dayOf(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Make sure today's three quests exist (the same three for everyone on the same day). */
export function ensureQuests(save: Save, today: string): Save {
  if (save.quests?.day === today) return save;
  // Reviewing needs something to review: that quest waits until the deck has cards.
  const pool = QUESTS.filter((q) => q.id !== 'review' || Object.keys(save.reviews).length > 0);
  const ids: string[] = [];
  let h = hash(today);
  while (ids.length < 3) {
    ids.push(pool.splice(h % pool.length, 1)[0].id);
    h = hash(String(h));
  }
  return { ...save, quests: { day: today, ids, claimed: [], base: { ...save.counters } } };
}

export function questProgress(save: Save, quest: Quest): number {
  if (!save.quests) return 0;
  return Math.min(quest.goal, save.counters[quest.counter] - save.quests.base[quest.counter]);
}

export function claimQuest(save: Save, questId: string, today: string): Result {
  const quest = QUESTS.find((q) => q.id === questId);
  if (!quest || !save.quests || save.quests.day !== today || !save.quests.ids.includes(questId) || save.quests.claimed.includes(questId)) return { save, events: [] };
  if (questProgress(save, quest) < quest.goal) return { save, events: [] };
  let s: Save = { ...save, quests: { ...save.quests, claimed: [...save.quests.claimed, questId] }, gold: save.gold + 30 };
  const events: Reward[] = [{ kind: 'gold', amount: 30, detail: `Quest: ${quest.text}` }];
  const r = addBox(s, 'silver', `Daily Quest: ${quest.text}`);
  s = r.save;
  events.push(...r.events);
  const streak = touchStreak(s, today);
  s = streak.save;
  events.push(...streak.events);
  const a = checkAchievements(s);
  return { save: a.save, events: [...events, ...a.events] };
}

const STREAK_REWARDS: Record<number, Tier> = { 3: 'silver', 7: 'gold', 14: 'platinum', 30: 'legendary' };

/** Count today toward the streak (once per day); missing a day starts it over. */
export function touchStreak(save: Save, today: string): Result {
  if (save.streak.day === today) return { save, events: [] };
  const yesterday = dayOf(new Date(new Date(`${today}T12:00:00`).getTime() - 86_400_000));
  const count = save.streak.day === yesterday ? save.streak.count + 1 : 1;
  let s: Save = { ...save, streak: { day: today, count, best: Math.max(save.streak.best, count) } };
  const events: Reward[] = [{ kind: 'streak', count }];
  const tier = STREAK_REWARDS[count];
  if (tier) {
    const r = addBox(s, tier, `Streak Box: ${count} days`);
    s = r.save;
    events.push(...r.events);
  }
  return { save: s, events };
}

// ---------------------------------------------------------------- the Safe Room shop

export type Ware =
  | { id: string; kind: 'token'; name: string; icon: string; price: number; description: string }
  | { id: string; kind: 'boost'; name: string; icon: string; price: number; description: string }
  | { id: string; kind: 'box'; name: string; icon: string; price: number; description: string; tier: Tier }
  | { id: string; kind: 'item'; name: string; icon: string; price: number; description: string; itemId: string };

export const WARES: Ware[] = [
  { id: 'token', kind: 'token', name: 'Hint Token', icon: '🎟', price: 60, description: 'Reveal a hint without losing a star.' },
  { id: 'boost', kind: 'boost', name: 'XP Boost ×3', icon: '🚀', price: 150, description: '+50% XP on your next 3 level clears.' },
  { id: 'box-bronze', kind: 'box', name: 'Bronze Box', icon: '🟫', price: 50, description: 'A little something.', tier: 'bronze' },
  { id: 'box-silver', kind: 'box', name: 'Silver Box', icon: '⬜', price: 120, description: 'A better something.', tier: 'silver' },
  { id: 'box-gold', kind: 'box', name: 'Gold Box', icon: '🟨', price: 300, description: 'Rare things live in here.', tier: 'gold' },
  ...ALL_ITEMS.filter((i) => i.price).map((i): Ware => ({ id: `item-${i.id}`, kind: 'item', name: i.name, icon: i.icon, price: i.price!, description: i.description, itemId: i.id })),
];

export const CLASS_CHANGE_PRICE = 300;

export function buy(save: Save, wareId: string): Result | null {
  const ware = WARES.find((w) => w.id === wareId);
  if (!ware || save.gold < ware.price) return null;
  if (ware.kind === 'item' && save.items[ware.itemId]) return null;
  let s: Save = { ...save, gold: save.gold - ware.price, counters: { ...save.counters, goldSpent: save.counters.goldSpent + ware.price } };
  const events: Reward[] = [];
  if (ware.kind === 'token') s = { ...s, hintTokens: s.hintTokens + 1 };
  if (ware.kind === 'boost') s = { ...s, boosts: s.boosts + 3 };
  if (ware.kind === 'item') s = { ...s, items: { ...s.items, [ware.itemId]: 1 } };
  if (ware.kind === 'box') {
    const r = addBox(s, ware.tier, `Bought: ${ware.name}`);
    s = r.save;
    events.push(...r.events);
  }
  const a = checkAchievements(s);
  return { save: a.save, events: [...events, ...a.events] };
}

export function changeClass(save: Save, id: ClassId): Save | null {
  if (!save.classId) return chooseClass(save, id);
  if (save.classId === id || save.gold < CLASS_CHANGE_PRICE) return null;
  return { ...save, classId: id, gold: save.gold - CLASS_CHANGE_PRICE, counters: { ...save.counters, goldSpent: save.counters.goldSpent + CLASS_CHANGE_PRICE } };
}

// ---------------------------------------------------------------- the inbox

/** Turn events into inbox notices (the persistent log of everything that happened). */
export function noticesFor(events: Reward[], at: number): Notice[] {
  const out: Notice[] = [];
  let n = 0;
  const add = (kind: Notice['kind'], icon: string, title: string, body: string) => out.push({ id: `${at}-${n++}`, at, kind, icon, title, body });
  for (const e of events) {
    if (e.kind === 'achievement') add('achievement', e.achievement.icon, `Achievement: ${e.achievement.name}`, e.achievement.quip);
    else if (e.kind === 'level-up') add('level-up', '⬆', `Crawler level ${e.level}`, e.newTitle ? `New career title: ${e.title}.` : `You're now level ${e.level}.`);
    else if (e.kind === 'skill-up') add('skill-up', SKILLS[e.skill].icon, `${SKILLS[e.skill].name} → level ${e.level}`, 'Your skill grows.');
    else if (e.kind === 'sponsor') add('sponsor', e.sponsor.icon, `Sponsor: ${e.sponsor.name}`, e.sponsor.message);
    else if (e.kind === 'fans') add('fans', '👁', `${formatViewers(e.milestone)} viewers!`, 'Your fans sent a Fan Box.');
    else if (e.kind === 'streak' && e.count > 1) add('streak', '🔥', `${e.count}-day streak`, 'Keep it going!');
  }
  return out;
}

// ---------------------------------------------------------------- small actions

const withLevel = (save: Save, id: string, patch: Partial<ReturnType<typeof levelState>>): Save => ({
  ...save,
  levels: { ...save.levels, [id]: { ...levelState(save, id), ...patch } },
});

/** A press of Run. A failure counts toward Persistence and Fail Fast. */
export function recordRun(save: Save, levelId: string, passed: boolean): Result {
  const p = levelState(save, levelId);
  const s = withLevel(
    { ...save, counters: { ...save.counters, runs: save.counters.runs + 1, failedRuns: save.counters.failedRuns + (passed ? 0 : 1) } },
    levelId,
    { runs: p.runs + 1 },
  );
  return passed ? { save: s, events: [] } : checkAchievements(s);
}

/** Reveal the next hint — with a hint token (free) if asked and available, otherwise at a star's cost. */
export function revealHint(save: Save, levelId: string, maxHints: number, useToken: boolean): Result {
  const p = levelState(save, levelId);
  if (p.hints >= maxHints) return { save, events: [] };
  const token = useToken && save.hintTokens > 0;
  const s = withLevel(
    token ? { ...save, hintTokens: save.hintTokens - 1, counters: { ...save.counters, tokensUsed: save.counters.tokensUsed + 1 } } : save,
    levelId,
    { hints: p.hints + 1, freeHints: p.freeHints + (token ? 1 : 0) },
  );
  return checkAchievements(s);
}

export function revealSolution(save: Save, levelId: string): Result {
  if (levelState(save, levelId).solution) return { save, events: [] };
  return checkAchievements(withLevel({ ...save, counters: { ...save.counters, solutionsSeen: save.counters.solutionsSeen + 1 } }, levelId, { solution: true }));
}

/** Start a level over, for three stars: hints, solution and runs reset (best stars are kept). */
export function replayLevel(save: Save, levelId: string, starter: string): Save {
  return withLevel(save, levelId, { hints: 0, freeHints: 0, solution: false, runs: 0, code: starter });
}

// ---------------------------------------------------------------- spaced review

/**
 * Days until a card comes back, by box. A right answer moves a card up a box;
 * a wrong one sends it back to box 0 and tomorrow. Gaps that grow each time
 * you remember are what move knowledge into long-term memory.
 */
export const REVIEW_INTERVALS = [1, 3, 7, 14, 30, 60];
export const REVIEW_TOP = REVIEW_INTERVALS.length - 1;
/** Cards in this box or above come back a month or more apart. */
export const REVIEW_MONTH_BOX = 4;
/** At most this many cards in one session. */
export const REVIEW_SESSION = 10;

export function addDays(day: string, n: number): string {
  return dayOf(new Date(new Date(`${day}T12:00:00`).getTime() + n * 86_400_000));
}

/** Cards for levels you've cleared join the review deck, first due the next day. */
export function syncReviews(save: Save, today: string): Save {
  let reviews: Save['reviews'] | null = null;
  for (const item of REVIEW_ITEMS) {
    if (save.reviews[item.id] || !levelState(save, item.after).done) continue;
    reviews ??= { ...save.reviews };
    reviews[item.id] = { box: 0, due: addDays(today, 1) };
  }
  return reviews ? { ...save, reviews } : save;
}

/** Cards due today or earlier: the most overdue first, then the least known. */
export function dueReviews(save: Save, today: string): ReviewItem[] {
  return REVIEW_ITEMS.filter((r) => save.reviews[r.id] && save.reviews[r.id].due <= today).sort(
    (a, b) => save.reviews[a.id].due.localeCompare(save.reviews[b.id].due) || save.reviews[a.id].box - save.reviews[b.id].box,
  );
}

/** The next day anything is due, after today (or null if the deck is empty). */
export function nextReviewDay(save: Save, today: string): string | null {
  const days = Object.values(save.reviews).map((r) => r.due).filter((d) => d > today).sort();
  return days[0] ?? null;
}

/** Answer a review card. Only the first answer in a session should be recorded. */
export function answerReview(save: Save, id: string, correct: boolean, today: string): Result {
  const state = save.reviews[id];
  if (!state) return { save, events: [] };
  const box = correct ? Math.min(REVIEW_TOP, state.box + 1) : 0;
  let s: Save = {
    ...save,
    reviews: { ...save.reviews, [id]: { box, due: addDays(today, REVIEW_INTERVALS[box]) } },
    counters: { ...save.counters, reviewsAnswered: save.counters.reviewsAnswered + 1, reviewsCorrect: save.counters.reviewsCorrect + (correct ? 1 : 0) },
  };
  // Effort counts too: a card you got wrong is a card you're about to learn.
  const x = addXp(s, correct ? 12 : 4, 'review');
  s = x.save;
  const a = checkAchievements(s);
  return { save: a.save, events: [...x.events, ...a.events] };
}

/** The end of a review session. */
export function finishReview(save: Save, answered: number, mistakes: number): Result {
  const s: Save = {
    ...save,
    counters: {
      ...save.counters,
      reviewSessions: save.counters.reviewSessions + 1,
      perfectReviews: save.counters.perfectReviews + (answered >= 5 && mistakes === 0 ? 1 : 0),
    },
  };
  return checkAchievements(s);
}

// ---------------------------------------------------------------- the notebook

/** A note needs a few words to count as explaining something. */
export const NOTE_MIN_WORDS = 5;

/**
 * Save the player's own explanation of a level (empty text deletes it). The
 * first real explanation of each level earns a little XP.
 */
export function saveNote(save: Save, levelId: string, text: string, at: number): Result {
  const clean = text.trim().slice(0, 600);
  if (!clean) {
    const { [levelId]: _gone, ...notes } = save.notes;
    return { save: { ...save, notes }, events: [] };
  }
  const first = !save.notes[levelId] && clean.split(/\s+/).length >= NOTE_MIN_WORDS;
  let s: Save = { ...save, notes: { ...save.notes, [levelId]: { text: clean, at } } };
  if (!first) return { save: s, events: [] };
  s = { ...s, counters: { ...s.counters, notesWritten: s.counters.notesWritten + 1 } };
  const x = addXp(s, 15, 'explained it back');
  const a = checkAchievements(x.save);
  return { save: a.save, events: [...x.events, ...a.events] };
}
