/**
 * EVERY player-facing name and string lives here.
 *
 * This module exists so the game's flavour is a swappable layer rather than
 * something threaded through the codebase. No other file should contain a
 * proper noun or a line of dialogue. Replacing this one file re-skins the
 * whole game — which is exactly the point: the current cast is a homage to
 * *Dungeon Crawler Carl*, and a distributable build wants an original one.
 *
 * The voice, for anyone adding to it:
 *  - The System is a bored municipal computer that finds you tedious. It uses
 *    bureaucratic register for atrocities and never once acknowledges that a
 *    person has died. Sentence, then a flat non-sequitur.
 *  - Carl is exhausted and out of his depth and keeps going anyway. He does
 *    not quip; he states things.
 *  - Donut is a cat with a title she awarded herself. Everything is beneath
 *    her and she is nonetheless the loudest thing in the room.
 *  - Nothing is ever framed as heroic. It is a broadcast, and you are content.
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
/** What the show calls the contestants. */
export const CRAWLER = 'Crawler';

export const CAST = {
  hero: 'Carl',
  heroTag: 'barefoot, boxer shorts, no plan',
  companion: 'Princess Donut',
  companionTag: 'Cat. Royalty. Her own opinion of both.',
  guide: 'Mordecai',
} as const;

export const WORLD_NAME = 'The Grasslands';
export const WORLD_TAG =
  'Nine floors down, somebody built a countryside. Then somebody else fortified it.';

/** Recruit-pad names, dealt out in order. */
export const PAD_NAMES = [
  'Muster Post', 'The Longhouse', 'Drill Yard', 'Recruiting Tent', 'The Barracks', 'Levy Point',
] as const;

/** Camp names, dealt out in order. */
export const CAMP_NAMES = [
  'The Gnaw', 'Bonepile', 'Slagheap', 'The Kennels',
  'Wicker Camp', 'The Hollow', 'Tinpot', 'Rustworks',
] as const;

export const KEEP_NAME = 'The Iron Keep';
export const KEEP_TAG = 'Whoever runs this floor lives behind that gate.';

/** Enemy display names, and the phrasing used when they cost you people. */
export const MOB_NAME = {
  grunt: 'Redcloak',
  heavy: 'Bruiser',
  archer: 'Slinger',
  captain: 'Floor Captain',
} as const;

export const MOB_BLAME = {
  grunt: 'the redcloaks',
  heavy: 'a bruiser',
  archer: 'the slingers',
  captain: 'a Floor Captain',
  boss: 'the Warden of the Third Floor',
} as const;

/** The boss, and what the System says while he is killing you. */
export const BOSS = {
  name: 'THE WARDEN',
  subtitle: 'Floor Three · Compliance Officer',
  wake: [
    'GATE BREACHED. COMPLIANCE OFFICER DISPATCHED.',
    'The Warden has held this door for nine seasons. Borant regrets the inconvenience to him.',
  ],
  phase2: [
    'WARDEN — SECOND PROTOCOL',
    'He is calling the garrison. They were not doing anything anyway.',
  ],
  phase3: [
    'WARDEN — FINAL PROTOCOL',
    'He has stopped pacing himself. Viewers are reminded that this is content.',
  ],
  charge: 'He plants his feet.',
  slam: 'The ground remembers this part.',
  dead: [
    'COMPLIANCE OFFICER RETIRED',
    'The Warden of the Third Floor is relieved of duty. His pension is forfeit.',
  ],
  donutWake: 'That is a LOT of armour, Carl. Hit the parts that squeak.',
  donutDead: 'I softened him up. You may thank me at your convenience.',
} as const;

/** What the people following you are called, by squad size. */
export const SQUAD_TIER = ['Alone', 'Stragglers', 'A Mob', 'An Actual Army'] as const;

/** What a unit of each rank is called, lowest first. */
export const UNIT_RANK = ['Straggler', 'Spearman', 'Swordsman', 'Knight', 'Champion'] as const;

/**
 * The System announcing a promotion. It does not congratulate you; it files
 * the paperwork and implies the loss of the four who did not get the title.
 */
export const PROMOTION = (rank: string, n: number): readonly string[] => [
  'FIELD PROMOTION PROCESSED',
  `${n} \u00d7 ${rank}. The other four are accounted for.`,
];

export const UI = {
  squad: 'CREW',
  coins: 'GOLD',
  recruit: 'Recruiting',
  recruitFull: 'No room',
  recruitBroke: 'No gold',
  recruitSpent: 'Nobody left',
  attack: 'Knock',
  restart: 'Again',
  continue: 'Continue',
  achievement: 'ACHIEVEMENT UNLOCKED',
  rewardBox: 'Reward',
} as const;

/**
 * System notifications. The voice: bureaucratic, bored, faintly hostile.
 * Functions take the numbers so no formatting logic leaks into game code.
 */
export const SYS = {
  welcome: () => [
    `Welcome to Floor Three, ${CRAWLER}.`,
    `Recruit anyone who will follow you. Walk east. Knock.`,
    `${CORP} reminds you that a crowd is not the same as a plan.`,
  ],
  donutJoins: () => [
    `${CAST.companion} has joined your party.`,
    `She has read the terms and conditions and has notes.`,
  ],
  recruited: (n: number) => [
    `${n} joined your crew.`,
    n >= 5 ? `They have not been told anything.` : `They did not ask many questions.`,
  ],
  padEmpty: (name: string) => [
    `${name} has nobody left to give.`,
    `Try somewhere with a worse view.`,
  ],
  campCleared: (name: string) => [
    `${name} is clear.`,
    `A sponsor has expressed mild interest.`,
  ],
  squadLost: (n: number, blame: string) => [
    `Lost ${n} to ${blame}.`,
    `They have been reclassified as scenery.`,
  ],
  keepSpotted: () => [
    `${KEEP_NAME} is in range.`,
    `Viewership is up 22%. Try to make it interesting.`,
  ],
  keepBreached: () => [
    `The gate is down.`,
    `Floor Three belongs to a man in boxer shorts.`,
    `Note it for the highlight reel.`,
  ],
  wiped: () => [
    `Your crew is gone.`,
    `You are, technically, still a contestant.`,
  ],
  lowSquad: () => [
    `Crew critical.`,
    `The audience has opened a betting pool. You are not favoured.`,
  ],
  achievement: (name: string, coins: number) => [
    `Achievement Unlocked: ${name}`,
    `Reward: ${coins} gold, deposited without ceremony.`,
  ],
  sponsor: () => [
    `You have attracted a sponsor.`,
    `They would like it known that they are not endorsing your methods.`,
  ],
} as const;

/**
 * Donut, interjecting. Fired occasionally on the events she would have an
 * opinion about, which is all of them.
 */
export const DONUT = {
  recruit: [
    'They are following you because they have nothing else on. Do not read into it.',
    'Carl. Carl. Are we collecting people now? I want that on the record.',
    'You have acquired subjects. I am the one with a title, so technically they are mine.',
  ],
  loss: [
    'That one was standing too far to the left. I did warn him.',
    'Carl, they keep dying. Tell them to stop.',
    'We are down several. I have already forgotten which several.',
  ],
  camp: [
    'Take a moment. Look regal. There are cameras.',
    'That was mostly me.',
  ],
  keep: [
    'It is a very large door and you are a man with no shoes. Proceed.',
    'If there is a throne behind that, it is mine. I am calling it now.',
  ],
  wipe: [
    'Well. That was humiliating for you.',
    'Get up. The lighting out here is terrible.',
  ],
} as const;

/**
 * Mordecai, at the recruit pads. He is the only voice in the game that is
 * actually trying to help, which is why he sounds so tired.
 */
export const GUIDE = {
  firstPad: [
    `${CAST.guide}: Stand on the plate. Gold buys bodies. Bodies buy time.`,
    `Don't get attached. That's the whole tutorial.`,
  ],
  padDry: [
    `${CAST.guide}: That one's tapped out. There are others.`,
  ],
  firstCamp: [
    `${CAST.guide}: They'll reach your line. They're supposed to.`,
    `You lose people or you lose the floor. Pick.`,
  ],
} as const;

/** Announcer lines for the wipe screen. Picked at random. */
export const DEATH_LINES = [
  'And that is the end of a promising afternoon.',
  'Oh, that was ugly. Let us see it again in slow motion.',
  'The audience is clapping. Not for you.',
  'Somewhere, a sponsor is quietly withdrawing.',
  'Cause of death: enthusiasm.',
  'He had a crowd and a direction. One of those was enough.',
] as const;

export const VICTORY_LINES = [
  'The gate is open and nobody is defending it.',
  'A hundred people walked east because one of them said so.',
  'Floor Three is closed. Borant thanks you for your content.',
] as const;

/**
 * Achievements. The System hands these out the way a council hands out
 * parking notices: correctly, promptly, and with no idea what it has said.
 */
export const ACHIEVEMENT_TEXT = {
  firstBlood: {
    name: 'First Blood',
    desc: 'Kill something. Anything.',
    sting: 'The bar was on the floor and you cleared it.',
  },
  firstRecruit: {
    name: 'Charismatic',
    desc: 'Convince one person to follow you.',
    sting: 'One. A landmark.',
  },
  crowd: {
    name: 'Cult Leader',
    desc: 'Lead thirty at once.',
    sting: 'None of them know where you are going. Neither do you.',
  },
  fullHouse: {
    name: 'Occupancy Violation',
    desc: 'Lead the maximum crew.',
    sting: 'Borant reminds you that crowd safety is your own responsibility.',
  },
  campClearer: {
    name: 'Eviction Specialist',
    desc: 'Clear three camps.',
    sting: 'A skill with no applications above ground.',
  },
  rich: {
    name: 'Liquid',
    desc: 'Carry two hundred gold at once.',
    sting: 'You cannot take it with you. You cannot take it anywhere.',
  },
  captainKill: {
    name: 'Middle Management',
    desc: 'Kill a Floor Captain.',
    sting: 'His performance review has been completed early.',
  },
  breach: {
    name: 'Doorman',
    desc: `Breach ${KEEP_NAME}.`,
    sting: 'Somebody had to knock.',
  },
  untouched: {
    name: 'Suspiciously Careful',
    desc: 'Breach the gate having never dropped below ten.',
    sting: 'The audience found this section slow.',
  },
  spendthrift: {
    name: 'Fiscally Irresponsible',
    desc: 'Spend three hundred gold on people.',
    sting: 'An economy of one product.',
  },
  bloodbath: {
    name: 'Statistically Significant',
    desc: 'Kill one hundred.',
    sting: 'A number the audience can put on a graph.',
  },
  loner: {
    name: 'Down To The Wire',
    desc: 'Take the gate with fewer than five left standing.',
    sting: 'This is the clip they will use.',
  },
} as const;
