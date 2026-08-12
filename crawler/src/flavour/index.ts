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
 *  - no imports from world/ or scenes/ (this is a leaf module)
 */

export const GAME_TITLE = 'CRAWLER';
export const GAME_SUBTITLE = 'Muster';

/** The corporation running the show. */
export const CORP = 'Borant';
/** What the broadcast calls itself. */
export const SHOW = 'Dungeon Crawler World';

export const CAST = {
  hero: 'Carl',
  heroTag: 'barefoot, boxer shorts, no plan',
  companion: 'Princess Donut',
} as const;

export const WORLD_NAME = 'The Over City';
export const WORLD_TAG = 'Somebody built a countryside nine floors down, and then fortified it.';

/** Recruit-pad names, dealt out in order. */
export const PAD_NAMES = [
  'Muster Post', 'The Longhouse', 'Drill Yard', 'Recruiting Tent', 'The Barracks', 'Levy Point',
] as const;

/** Camp names, dealt out in order. */
export const CAMP_NAMES = [
  'The Gnaw', 'Bonepile', 'Slagheap', 'The Kennels',
  'Wicker Camp', 'The Hollow', 'Tinpot', 'Rustworks',
] as const;

export const KEEP_NAME = 'The Keep';
export const KEEP_TAG = 'Whoever runs this floor lives behind that gate.';

/** Enemy display names, and the phrasing used when they cost you people. */
export const MOB_NAME = {
  grunt: 'Redcloak',
  heavy: 'Bruiser',
  archer: 'Slinger',
  captain: 'Captain',
} as const;

export const MOB_BLAME = {
  grunt: 'the redcloaks',
  heavy: 'a bruiser',
  archer: 'the slingers',
  captain: 'a captain',
} as const;

/** What the people following you are called, by squad size. */
export const SQUAD_TIER = ['Survivor', 'Levy', 'Militia', 'Company'] as const;

export const UI = {
  squad: 'SQUAD',
  coins: 'COINS',
  recruit: 'Recruit',
  recruitFull: 'Full',
  recruitBroke: 'Need coins',
  recruitSpent: 'Emptied',
  attack: 'Breach',
  restart: 'Try Again',
  continue: 'Continue',
} as const;

/**
 * System notifications. The voice: bureaucratic, bored, faintly hostile.
 * Functions take the numbers so no formatting logic leaks into game code.
 */
export const SYS = {
  welcome: () => [
    `Welcome to Floor 3, Crawler.`,
    `Recruit anyone who will follow you. Walk east. Knock.`,
    `${CORP} reminds you that a crowd is not the same as a plan.`,
  ],
  recruited: (n: number) => [`${n} joined your squad.`],
  padEmpty: (name: string) => [`${name} has nobody left to give.`],
  campCleared: (name: string) => [`${name} is clear.`],
  squadLost: (n: number, blame: string) => [`Lost ${n} to ${blame}.`],
  keepSpotted: () => [
    `${KEEP_NAME} is in range.`,
    `Viewership is up 22%. Try to make it interesting.`,
  ],
  keepBreached: () => [
    `The gate is down.`,
    `Floor 3 belongs to a man in boxer shorts. Note it for the highlight reel.`,
  ],
  wiped: () => [`Your squad is gone.`, `You are, technically, still a contestant.`],
  lowSquad: () => [`Squad critical.`, `The audience has started a betting pool.`],
  achievement: (name: string, coins: number) => [
    `Achievement unlocked: ${name}`,
    `Reward: ${coins} coins.`,
  ],
} as const;

/** Announcer lines for the wipe screen. Picked at random. */
export const DEATH_LINES = [
  'And that is the end of a promising afternoon.',
  'Oh, that was ugly. Let us see it again in slow motion.',
  'The audience is clapping. Not for you.',
  'Somewhere, a sponsor is quietly withdrawing.',
  'Cause of death: enthusiasm.',
] as const;

export const VICTORY_LINES = [
  'The gate is open and nobody is defending it.',
  'A hundred people walked east because one of them said so.',
] as const;

export const ACHIEVEMENT_TEXT = {
  firstBlood: { name: 'First Blood', desc: 'Kill something. Anything.' },
  firstRecruit: { name: 'Charismatic', desc: 'Recruit your first follower.' },
  crowd: { name: 'Cult Leader', desc: 'Lead a squad of thirty.' },
  campClearer: { name: 'Eviction Specialist', desc: 'Clear three camps.' },
  rich: { name: 'Liquid', desc: 'Carry 200 coins at once.' },
  captainKill: { name: 'Middle Management', desc: 'Kill a Captain.' },
  breach: { name: 'Doorman', desc: `Breach ${KEEP_NAME}.` },
  untouched: { name: 'Suspiciously Careful', desc: 'Breach the gate without ever dropping below ten.' },
} as const;
