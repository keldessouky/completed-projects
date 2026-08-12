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
 *  - no imports from world/, game/ or scenes/ (this is a leaf module)
 */

export const GAME_TITLE = 'CRAWLER';
export const GAME_SUBTITLE = 'The Open Floor';

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

export const WORLD_NAME = 'The Over City';
export const WORLD_TAG = 'Nine floors down, and somebody built a countryside in it.';

/** Region names, keyed by biome. */
export const BIOME_NAME = {
  grass: 'The Long Meadow',
  forest: 'The Understory',
  ruins: 'The Fallen Blocks',
  swamp: 'The Sump',
  waste: 'The Scoured Flat',
} as const;

export const POI_KIND_LABEL = {
  town: 'Settlement',
  camp: 'Camp',
  ruin: 'Ruin',
  shrine: 'Shrine',
  lair: 'Lair',
} as const;

/** Names dealt out to generated POIs, in order. */
export const TOWN_NAMES = ['Aldergate', 'Sixpenny'] as const;
export const CAMP_NAMES = [
  'The Gnaw', 'Rustworks', 'Bonepile', 'The Kennels', 'Slagheap',
  'Wicker Camp', 'The Hollow', 'Tinpot', 'The Drownings',
] as const;
export const RUIN_NAMES = [
  'Block Nine', 'The Stairwell', 'Car Park Two', 'The Atrium', 'Unit 40',
] as const;
export const SHRINE_NAMES = [
  'Sponsor Terminal', 'Vending Shrine', 'Loyalty Kiosk', 'Rewards Pylon',
] as const;
export const LAIR_NAME = 'The Depot';

/** Enemy display names and the phrasing used when they kill you. */
export const MOB_NAME = {
  rat: 'Sewer Rat',
  brute: 'Rubble Brute',
  drone: 'Maintenance Drone',
  elite: 'Foreman',
  boss: 'Chief Inspector Voll',
} as const;

export const MOB_BLAME = {
  rat: 'a rat',
  brute: 'a rubble brute',
  drone: 'a drone',
  elite: 'a foreman',
  boss: 'the Chief Inspector',
} as const;

export const BOSS_NAME = MOB_NAME.boss;
export const BOSS_TAG = 'Middle management with a firing solution.';

export const ABILITY = {
  blast: { name: 'Firecracker', desc: 'Improvised. Hurts everything nearby.' },
  surge: { name: 'Second Wind', desc: 'Patch yourself up and move.' },
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
  str: 'Damage per hit.',
  dex: 'Attack and movement speed.',
  con: 'Maximum health.',
  int: 'Shorter ability cooldowns.',
  wis: 'Stronger ability effects.',
  cha: 'Cheaper prices. People like you.',
  luck: 'Critical hits and better loot.',
} as const;

// ─────────────────────────── gear ───────────────────────────

export const SLOT_NAME = { weapon: 'Weapon', armour: 'Armour', trinket: 'Trinket' } as const;
export const TIER_NAME = { worn: 'Worn', solid: 'Solid', fine: 'Fine', prime: 'Prime' } as const;

/** Base nouns per slot; the tier adjective is prefixed at generation time. */
export const GEAR_NOUNS = {
  weapon: ['Nail Gun', 'Pipe Wrench', 'Rebar Spear', 'Staple Cannon', 'Claw Hammer'],
  armour: ['Hi-Vis Vest', 'Kneepads', 'Toolbelt Rig', 'Site Helmet', 'Padded Coverall'],
  trinket: ['Lanyard', 'Keycard', 'Lucky Fuse', 'Union Pin', 'Laminated Badge'],
} as const;

// ─────────────────────────── NPCs ───────────────────────────

export const NPC = {
  quartermaster: {
    name: 'Quartermaster Hask',
    greet: [
      'You are wearing boxer shorts.',
      'I have things that are not boxer shorts. They cost money.',
    ],
    nothing: ['Come back with gold. Or gear. I am not fussy.'],
  },
  broker: {
    name: 'Broker Iyla',
    greet: [
      'Everyone down here wants something fetched or something killed.',
      'I take a cut for knowing which is which.',
    ],
    nothing: ['Nothing on the board. Go make some trouble and check back.'],
  },
  guide: {
    name: CAST.guide,
    greet: [
      'You are alive, which puts you ahead of most of the intake.',
      'The Depot is east. Do not go there yet. You will go there anyway.',
    ],
    nothing: ['Level up. Find gear. Then the Depot. In that order.'],
  },
} as const;

// ─────────────────────────── quests ───────────────────────────

export const QUEST = {
  ratting: {
    title: 'Pest Control',
    brief: 'Kill 12 sewer rats. The settlement is tired of them and I am tired of hearing about it.',
    done: 'Twelve. Good. They will be back by Thursday.',
  },
  camps: {
    title: 'Eviction Notice',
    brief: 'Clear out a camp — any camp. Pick one on your map and empty it.',
    done: 'One camp quieter. The board has been updated. Nobody has thanked you.',
  },
  survey: {
    title: 'Know the Ground',
    brief: 'Find six places worth marking on a map. Wander. It is what you are for.',
    done: 'Six. You now know this floor better than the people who built it.',
  },
  foreman: {
    title: 'Middle Management',
    brief: 'A Foreman is out there running the camps. Kill three of them and the rest get nervous.',
    done: 'Three foremen. The nervousness is measurable. Well done.',
  },
  depot: {
    title: 'The Depot',
    brief: `${BOSS_NAME} runs the Depot in the east. Go and stop him running it.`,
    done: 'The Depot is yours. The stairs down are open whenever you are.',
  },
} as const;

// ─────────────────────────── the System ───────────────────────────

export const SYS = {
  welcome: () => [
    `Welcome to Floor 3, Crawler.`,
    `This floor is open. There are no walls and no schedule.`,
    `${CORP} reminds you that "open" is not the same as "safe".`,
  ],
  levelUp: (lvl: number, pts: number) => [
    `Level ${lvl}.`,
    `${pts} attribute point${pts === 1 ? '' : 's'} available.`,
    `Do try to spend ${pts === 1 ? 'it' : 'them'} on something useful.`,
  ],
  discovered: (name: string) => [`Discovered: ${name}.`, `Marked on your map. You are welcome.`],
  cleared: (name: string) => [`${name} is clear.`, `It will not stay that way.`],
  gearFound: (name: string) => [`Picked up: ${name}.`],
  questTaken: (title: string) => [`Quest accepted: ${title}.`],
  questReady: (title: string) => [`${title}: objective complete.`, `Return to the giver.`],
  questDone: (title: string, gold: number, xp: number) => [
    `Quest complete: ${title}.`,
    `${gold} gold, ${xp} XP.`,
  ],
  shrine: () => [
    `Sponsor terminal accessed.`,
    `One attribute point, courtesy of a brand that would rather not be named.`,
  ],
  bossSpotted: () => [
    `${BOSS_NAME} has noticed you.`,
    `Viewership is up 22%. Try to make it interesting.`,
  ],
  bossDown: () => [
    `${BOSS_NAME} has been retired.`,
    `The stairs down are open. There is no hurry. There is always a hurry.`,
  ],
  achievement: (name: string, gold: number) => [
    `Achievement unlocked: ${name}`,
    `Reward: ${gold} gold.`,
  ],
  lowHp: () => [`Health critical.`, `The audience has started a betting pool.`],
  sold: (name: string, gold: number) => [`Sold ${name} for ${gold} gold.`],
  bought: (name: string) => [`Purchased: ${name}.`],
} as const;

/** Announcer lines for the death broadcast. Picked at random. */
export const DEATH_LINES = [
  'And that is the end of a promising afternoon.',
  'Oh, that was ugly. Let us see it again in slow motion.',
  'The audience is clapping. Not for you.',
  'Somewhere, a sponsor is quietly withdrawing.',
  'Cause of death: curiosity.',
] as const;

export const RESPAWN_LINE = 'You wake up in a settlement. Lighter, and no wiser.';

export const VICTORY_LINES = [
  'The Depot is quiet. That is new.',
  'Floor 3 belongs to a man in boxer shorts. Note it for the highlight reel.',
] as const;

export const ACHIEVEMENT_TEXT = {
  firstBlood: { name: 'First Blood', desc: 'Kill something. Anything.' },
  firstGear: { name: 'Dressed', desc: 'Equip a piece of gear. Any piece.' },
  cartographer: { name: 'Cartographer', desc: 'Discover ten places.' },
  campClearer: { name: 'Eviction Specialist', desc: 'Clear three camps.' },
  wealthy: { name: 'Liquid', desc: 'Carry 1,000 gold at once.' },
  primeFind: { name: 'Lucky Fuse', desc: 'Find a Prime-tier item.' },
  bossKill: { name: 'Chief Inspected', desc: `Retire ${BOSS_NAME}.` },
  survivor: { name: 'Suspiciously Careful', desc: 'Reach level 8 without dying.' },
} as const;

export const UI = {
  talkPrompt: 'Talk',
  usePrompt: 'Use',
  enterPrompt: 'Enter',
  noQuests: 'Nothing on the board.',
  emptyBag: 'Your bag is empty. This is not a metaphor for anything.',
  equipped: 'Equipped',
  respawn: 'Get Up',
} as const;
