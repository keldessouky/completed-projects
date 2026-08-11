/**
 * EVERY player-facing name and string lives here.
 *
 * This module exists so the game's flavour is a swappable layer rather than
 * something threaded through the codebase. No other file should contain a
 * proper noun or a line of dialogue. Replacing this one file re-skins the
 * whole game — which is exactly the point: the current cast is a homage, and
 * a distributable build wants an original one.
 *
 * Rules for anything added here:
 *  - no gameplay numbers (those live in config.ts)
 *  - no imports from game/ or scenes/ (this is a leaf module)
 */

export const GAME_TITLE = 'CRAWLER';
export const GAME_SUBTITLE = 'Floor One';

/** The corporation running the show. */
export const CORP = 'Borant';
/** What the broadcast calls itself. */
export const SHOW = 'Dungeon Crawler World';

export const CAST = {
  hero: 'Carl',
  heroTag: 'barefoot, boxer shorts, no plan',
  companion: 'Princess Donut',
  companionTag: 'Persian. Champion bloodline. Insufferable.',
  guide: 'Mordecai',
} as const;

/** Floor names, indexed by floor number − 1. Only floor 1 is built. */
export const FLOOR_NAMES = ['The Basement'] as const;
export const FLOOR_SUBTITLES = ['Concrete, rebar, and whatever used to live down here.'] as const;

export const floorName = (i: number): string => FLOOR_NAMES[i] ?? `Floor ${i + 1}`;
export const floorSubtitle = (i: number): string => FLOOR_SUBTITLES[i] ?? '';

/** Node type labels shown on the floor map. */
export const NODE_LABEL = {
  entry: 'Entry',
  corridor: 'Tunnel',
  mob: 'Nest',
  loot: 'Loot Box',
  safe: 'Safe Room',
  boss: 'Boss',
  stairs: 'Stairs Down',
} as const;

/** Enemy display names, keyed by the engine's enemy kind. */
export const MOB_NAME = {
  brute: 'Rubble Brute',
  rat: 'Sewer Rat',
  drone: 'Maintenance Drone',
} as const;

/** Short phrases used in death diagnostics: "You lost 40 to <phrase>." */
export const MOB_BLAME = {
  brute: 'the rubble brutes',
  rat: 'the rat swarm',
  drone: 'the drones',
} as const;

export const BOSS_NAME = 'Unit 7, Sanitation Foreman';
export const BOSS_TAG = 'A janitor with a grudge and municipal funding.';

/** The party members you collect are nameless survivors — these are the tiers. */
export const PARTY_TIER = ['Survivor', 'Scavenger', 'Holdout', 'Veteran', 'Hardened'] as const;

export const ABILITY = {
  blast: { name: 'Firecracker', desc: 'Improvised. Damages everything on screen.' },
  rally: { name: 'Second Wind', desc: 'Pulls stragglers back into the line.' },
} as const;

export const STAT_NAME = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
  luck: 'Luck',
} as const;

export const STAT_DESC = {
  str: 'Damage per shot.',
  dex: 'Rate of fire.',
  con: 'Fewer losses to traps and contact.',
  int: 'Shorter ability cooldowns.',
  wis: 'Stronger ability effects.',
  cha: 'More party members follow you.',
  luck: 'Better loot, and the occasional crit.',
} as const;

/**
 * System notifications. The voice: bureaucratic, bored, faintly hostile.
 * Functions take the numbers so no formatting logic leaks into game code.
 */
export const SYS = {
  welcome: () => [
    `Welcome, Crawler.`,
    `You are one of ${(1_000_000).toLocaleString()}+ contestants. You are not special.`,
    `${CORP} thanks you for your participation and waives all liability.`,
  ],
  floorOpen: (floor: number, mins: number) => [
    `Floor ${floor} is now open.`,
    `Stairs seal in ${mins} minutes. Anything still on this floor at that time is deleted.`,
    `This is not a metaphor.`,
  ],
  timeWarn: (secs: number) => [`${secs} seconds until the stairs seal.`, `Suggested action: hurry.`],
  levelUp: (lvl: number, pts: number) => [
    `Level ${lvl}.`,
    `${pts} attribute point${pts === 1 ? '' : 's'} available.`,
    `Do try to spend ${pts === 1 ? 'it' : 'them'} on something useful.`,
  ],
  lootOpen: (tier: string) => [`${tier} Loot Box opened.`, `Contents below. No refunds.`],
  bossSpotted: () => [
    `Boss encountered: ${BOSS_NAME}.`,
    `Viewership is up 12%. Try to make it interesting.`,
  ],
  bossDown: () => [`${BOSS_NAME} has been retired.`, `The stairs are open. Go.`],
  achievement: (name: string, gold: number) => [
    `Achievement unlocked: ${name}`,
    `Reward: ${gold} gold.`,
  ],
  partyJoin: (n: number) => [`${n} survivor${n === 1 ? '' : 's'} joined your party.`],
  trapHit: (n: number) => [`You lost ${n}. That door was clearly marked.`],
  firstClass: () => [
    `Class selection unlocks on Floor 3.`,
    `Until then you are, officially, "Unclassed." The audience finds this endearing.`,
  ],
} as const;

/** Announcer lines for the death broadcast. Picked at random. */
export const DEATH_LINES = [
  'And that is the end of a promising run.',
  'Oh, that was ugly. Let us see it again in slow motion.',
  'The audience is clapping. Not for you.',
  'Somewhere, a sponsor is quietly withdrawing.',
  'Cause of death: optimism.',
] as const;

/** Shown when the floor timer runs out. */
export const TIMEOUT_LINE = 'The stairs sealed. You were still on the wrong side of them.';

export const CLEAR_LINES = [
  'Floor cleared. The audience is mildly impressed.',
  'You survived the easy one. Congratulations, allegedly.',
  'Down you go. It gets worse.',
] as const;

/** Door labels are the arithmetic itself, so they live in config. These are the marks. */
export const DOOR_HINT_GOOD = 'SAFE';
export const DOOR_HINT_TRAP = 'HAZARD';

export const ACHIEVEMENT_TEXT = {
  firstBlood: { name: 'First Blood', desc: 'Kill something. Anything.' },
  boxOpener: { name: 'Compulsive Gambler', desc: 'Open your first loot box.' },
  untouched: { name: 'Suspiciously Careful', desc: 'Clear a tunnel without stepping in a hazard.' },
  bigParty: { name: 'Cult Leader', desc: 'Reach 40 party members.' },
  bossKill: { name: 'Employee of the Month', desc: `Retire ${BOSS_NAME}.` },
  fastFloor: { name: 'Speedrunner', desc: 'Clear the floor with 4 minutes still on the clock.' },
  fullSweep: { name: 'Completionist', desc: 'Visit every node on the floor before taking the stairs.' },
} as const;

/** Vendor stock in the safe room. */
export const VENDOR = {
  title: 'Vending Machine',
  flavour: 'Sponsored content. Prices are non-negotiable and openly insulting.',
} as const;
