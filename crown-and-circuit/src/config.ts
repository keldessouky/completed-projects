/**
 * Crown & Circuit — every balance constant and tunable.
 * No magic numbers anywhere else in the codebase.
 *
 * The spine of the design is ERAS: five technology tiers that re-skin and
 * re-stat the whole game as a run progresses, from iron age to neon.
 */

/** The five technology eras a run passes through. */
export const ERA = {
  IRON: 0,
  POWDER: 1,
  INDUSTRY: 2,
  MODERN: 3,
  NEON: 4,
} as const;
export type EraId = 0 | 1 | 2 | 3 | 4;

export const CONFIG = {
  /** Rendering / viewport. The world is free-roam, so we fit a fixed vertical
   *  slice of world and let width follow the device aspect — no letterboxing. */
  view: {
    worldViewHeight: 760,   // world units visible top-to-bottom, always
    minAspect: 0.46,        // clamp for absurdly tall windows
    maxAspect: 2.2,         // …and absurdly wide ones
    maxResolution: 2.5,     // cap renderer DPR
    uiRefHeight: 900,       // UI scales against this so buttons stay thumb-sized
    uiScaleMin: 0.8,
    uiScaleMax: 1.5,
  },

  /** Fixed-timestep simulation. 60 Hz: this is a top-down auto-battler with
   *  hundreds of entities, where 60 is imperceptible from 120 but half the cost. */
  sim: {
    hz: 60,
    maxStepsPerFrame: 5,
    maxFrameMs: 100,
  },

  /** Frame-rate governor and thermal guard (same policy as the runner). */
  fps: { degradeThresholdMs: 8.3, windowMs: 2000, fallbackCap: 60 },
  thermal: { softenAfterSec: 240, particleBudgetScale: 0.6 },

  /** The world map. Square, fort at centre, enemies arrive from the edges. */
  world: {
    size: 1900,             // world units per side
    fortCenter: 950,        // = size / 2
    edgePad: 90,            // spawn ring inset from the map border
    wanderBand: 300,        // how far past the fort the king can usefully roam
  },

  /** Spatial hash for broadphase. Cell ≈ largest query radius keeps buckets small. */
  grid: { cell: 64 },

  /** The king: free-roam, does not auto-fire — he is a magnet and a builder. */
  king: {
    speed: 232,             // world units/s at meta level 0
    accel: 2600,            // responsive but not instant
    radius: 15,
    fireInterval: 0.75,     // he does fight, on a slow cadence
    contactIFrames: 0.8,    // seconds of grace after taking a hit
    hp: 100,                // downed → dropped coins scatter, brief respawn
    downSec: 2.6,
  },

  /** Soldiers orbit the king in rings and auto-target. */
  squad: {
    max: 48,
    ringSpacing: 34,        // world units between formation rings
    perRing: 7,             // slots in the first ring; each ring adds this many
    followLerp: 5.2,        // per-second ease toward the assigned slot
    separation: 22,         // soldiers push apart at this distance
    separationForce: 130,
    engageRange: 1.0,       // multiplier on era weapon range
    fireJitter: 0.22,       // fraction of interval randomised per soldier
    tierEvery: 12,          // visual tier bumps every N soldiers
    attackAnimSec: 0.22,    // how long the attack pose holds after a shot
  },

  /**
   * ERA TABLE — the heart of the game. Each entry re-stats and re-skins
   * everything. Player weapons, tower weapons, palette, and the music bed all
   * key off the era index.
   */
  eras: [
    {
      id: ERA.IRON,
      name: 'Age of Iron',
      short: 'IRON',
      weapon: 'Sword & Spear',
      // player/soldier weapon
      dmg: 8, interval: 0.90, range: 128, projSpeed: 430, pierce: 0, spread: 0.10, shots: 1,
      // tower weapon
      towerDmg: 16, towerInterval: 1.15, towerRange: 210, towerProjSpeed: 520, towerPierce: 0,
      // scaling applied to enemies met during this era
      enemyHp: 1.0, enemySpeed: 1.0, coinMult: 1.0,
      // costs of a structure built during this era
      costMult: 1.0,
      tracer: 0x9fb4c9,     // projectile tint
      muzzle: 0xd8c9a8,
      music: 'musicIron',
      shootSfx: 'sfxBlade',
    },
    {
      id: ERA.POWDER,
      name: 'Age of Powder',
      short: 'POWDER',
      weapon: 'Musket & Cannon',
      dmg: 21, interval: 1.30, range: 178, projSpeed: 620, pierce: 0, spread: 0.14, shots: 1,
      towerDmg: 52, towerInterval: 1.8, towerRange: 265, towerProjSpeed: 640, towerPierce: 1,
      enemyHp: 2.6, enemySpeed: 1.06, coinMult: 2.2,
      costMult: 2.3,
      tracer: 0xf0c07a,
      muzzle: 0xffe4a8,
      music: 'musicPowder',
      shootSfx: 'sfxMusket',
    },
    {
      id: ERA.INDUSTRY,
      name: 'Age of Industry',
      short: 'INDUSTRY',
      weapon: 'Rifle & Gatling',
      dmg: 34, interval: 0.80, range: 205, projSpeed: 780, pierce: 0, spread: 0.09, shots: 1,
      towerDmg: 30, towerInterval: 0.30, towerRange: 285, towerProjSpeed: 820, towerPierce: 0,
      enemyHp: 6.6, enemySpeed: 1.12, coinMult: 5.0,
      costMult: 5.4,
      tracer: 0xffb45c,
      muzzle: 0xfff0c0,
      music: 'musicIndustry',
      shootSfx: 'sfxRifle',
    },
    {
      id: ERA.MODERN,
      name: 'Age of Steel',
      short: 'STEEL',
      weapon: 'Machine Gun & Missile',
      dmg: 26, interval: 0.19, range: 228, projSpeed: 1000, pierce: 0, spread: 0.16, shots: 1,
      towerDmg: 260, towerInterval: 2.1, towerRange: 330, towerProjSpeed: 700, towerPierce: 0,
      towerSplash: 78,      // missiles: only this era's towers do area damage
      enemyHp: 16.0, enemySpeed: 1.18, coinMult: 12.0,
      costMult: 12.0,
      tracer: 0xffd36b,
      muzzle: 0xffffff,
      music: 'musicModern',
      shootSfx: 'sfxMg',
    },
    {
      id: ERA.NEON,
      name: 'Age of Neon',
      short: 'NEON',
      weapon: 'Laser & Plasma',
      dmg: 78, interval: 0.42, range: 268, projSpeed: 1500, pierce: 2, spread: 0.03, shots: 1,
      towerDmg: 150, towerInterval: 0.55, towerRange: 360, towerProjSpeed: 1700, towerPierce: 3,
      enemyHp: 40.0, enemySpeed: 1.25, coinMult: 28.0,
      costMult: 27.0,
      tracer: 0x5cf5ff,
      muzzle: 0xd8ffff,
      music: 'musicNeon',
      shootSfx: 'sfxLaser',
    },
  ],

  /** Enemy archetypes. Base stats; multiplied by the era the wave belongs to. */
  enemies: {
    runner:  { hp: 30,  speed: 78,  radius: 13, dmg: 6,  coin: 1,  mass: 1.0 },
    brute:   { hp: 190, speed: 44,  radius: 24, dmg: 22, coin: 5,  mass: 2.6 },
    shooter: { hp: 62,  speed: 60,  radius: 15, dmg: 9,  coin: 2,  mass: 1.1,
               standoff: 168, shotInterval: 2.0, projSpeed: 320 },
    flyer:   { hp: 48,  speed: 104, radius: 16, dmg: 8,  coin: 2,  mass: 0.8 }, // ignores walls
    boss:    { hp: 2600, speed: 38, radius: 42, dmg: 46, coin: 60, mass: 8.0 },
    /** per-wave-within-run HP creep on top of era scaling */
    hpPerWave: 0.055,
    max: 240,
    separation: 26,
    separationForce: 240,
    hitFlashMs: 90,
    /** enemies only start attacking a structure within this range of it */
    attackRange: 26,
    attackInterval: 0.9,
  },

  /** Waves: 4 per era, 20 total. Cleared wave 4 of an era advances the era. */
  waves: {
    perEra: 4,
    total: 20,
    /** live budget for a wave, before era scaling */
    count: (w: number) => Math.round(11 + w * 3.4),
    /** seconds between spawn pulses inside a wave */
    pulseInterval: (w: number) => Math.max(0.55, 1.7 - w * 0.055),
    /** how many map edges spawn simultaneously */
    edges: (w: number) => (w < 3 ? 1 : w < 8 ? 2 : w < 14 ? 3 : 4),
    /** breathing room between waves, where you build */
    buildSec: 14,
    /** first wave gets extra grace so the tutorial can land */
    firstBuildSec: 20,
    /** the last wave of each era is a boss wave */
    bossOnLastOfEra: true,
    /** archetype mix by wave index (weights) */
    mix: (w: number): Record<string, number> => ({
      runner: 6,
      brute: w < 2 ? 0 : 1 + w * 0.12,
      shooter: w < 5 ? 0 : 1 + w * 0.10,
      flyer: w < 8 ? 0 : 1 + w * 0.09,
    }),
  },

  /** The fort: authored pads in expanding rings, walls auto-connect between them. */
  fort: {
    /** Coins in hand at the start of a run. Without this you cannot build
     *  before the first wave — coins only drop from kills — and the keep dies
     *  undefended. One tower's worth is exactly the right opening decision. */
    startingCoins: 70,
    keepHp: 900,            // your life total; enemies that reach the centre chew it
    keepRadius: 46,
    /** ring radii from the fort centre */
    ringRadius: [150, 250, 350],
    /** pads per ring — evenly spaced, first ring offset for a gate feel */
    ringPads: [6, 8, 10],
    ringOffset: [0, 0.39, 0.19],
    /** a ring unlocks once this fraction of the previous ring is built */
    ringUnlockFrac: 0.6,
    padRadius: 26,
    /** deposit rate: coins drained per second while standing on a pad */
    depositRate: 26,
    /** walls auto-connect between neighbouring built pads on the same ring */
    wallHp: 420,
    wallThickness: 13,
    towerHp: 320,
    /** structures rebuild themselves this long after being destroyed, free */
    rubbleSec: 12,
    /** structure kinds and their base cost (before era costMult) */
    cost: { tower: 42, barracks: 55, forge: 70, wall: 0 },
    /** barracks add this many soldiers, forge adds this damage fraction */
    barracksSoldiers: 3,
    forgeDamage: 0.16,
    /** upgrading an existing structure costs this fraction more each level */
    upgradeCostMult: 1.75,
    upgradeMaxLevel: 3,
    upgradeDamageMult: 0.55,  // +55 % damage per level
  },

  /** Coins: the ferry loop. This is the game's metronome — tune it carefully. */
  coins: {
    /** scatter physics on drop */
    popSpeed: 96,
    popSpeedVar: 58,
    drag: 3.4,
    settleSec: 0.45,
    /** the king sweeps coins up inside this radius (upgradeable) */
    magnet: 76,
    magnetSpeed: 620,
    magnetAccel: 2200,
    /** how much the king can carry before pickups stop (upgradeable) */
    carryCap: 70,
    /** visible stack over the king's head */
    stackStep: 3.2,         // world units of height per coin in the stack
    stackMaxVisual: 16,     // coins drawn before the stack just gets wider
    /** coins live this long on the ground before fading (generous) */
    lifeSec: 26,
    max: 400,
    /** when the king is downed he drops this fraction of his carry */
    dropOnDownFrac: 0.5,
  },

  /** Projectiles. */
  proj: { max: 512, radius: 6, lifeSec: 1.6 },

  /** Between-wave upgrade cards: pick 1 of 3. */
  cards: {
    choices: 3,
    /** each card's effect magnitude */
    fireRate: 0.12,         // −12 % interval
    damage: 0.18,           // +18 %
    range: 0.12,
    moveSpeed: 0.10,
    magnet: 0.22,
    carry: 0.25,
    soldiers: 2,            // flat soldiers
    keepRepair: 0.30,       // heal 30 % of keep max
    coinBonus: 0.20,        // +20 % coin value
  },

  /** Meta progression: shards persist between runs and buy permanent levels. */
  meta: {
    /** shards earned = banked coins at run end × this, plus per-wave bonus */
    shardPerCoin: 0.04,
    shardPerWave: 12,
    maxLevel: 5,
    upgrades: {
      squad:  { name: 'Standing Army', desc: '+2 starting soldiers per level', per: 2,    costs: [60, 132, 290, 638, 1404] },
      carry:  { name: 'Deep Pockets',  desc: '+20% carry capacity per level',  per: 0.20, costs: [50, 110, 242, 532, 1170] },
      magnet: { name: 'Lodestone',     desc: '+18% pickup radius per level',   per: 0.18, costs: [45, 99, 218, 479, 1054] },
      speed:  { name: 'Swift Boots',   desc: '+7% move speed per level',       per: 0.07, costs: [55, 121, 266, 585, 1287] },
      keep:   { name: 'Deep Founds',   desc: '+15% keep HP per level',         per: 0.15, costs: [65, 143, 314, 691, 1520] },
      purse:  { name: 'War Chest',     desc: '+25 starting gold per level',    per: 25,   costs: [40, 88, 193, 425, 935] },
    },
  },

  /** Feel. */
  fx: {
    shakeShoot: 0,          // per-shot shake would be nauseating at these rates
    shakeHit: 3,
    shakeBossHit: 5,
    shakeBuild: 7,
    shakeEraUp: 26,
    shakeKeepHit: 9,
    shakeDown: 14,
    shakeDecay: 0.86,
    particleBudget: 512,
    damageNumberCap: 32,
    damageNumberMs: 620,
    hitParticles: 3,
    dieParticles: 9,
    buildParticles: 26,
    depositCoinEvery: 0.045, // seconds between coin-fountain pops while depositing
    hapticBuild: 14,
    hapticEra: [30, 40, 90] as number[],
    hapticDown: 40,
    /** camera lead: the view drifts ahead of the king's velocity */
    camLead: 0.24,
    camLerp: 6.4,
    /** era-change flash and slow-mo */
    eraFlashMs: 520,
    eraSlowScale: 0.35,
    eraSlowMs: 900,
  },

  /** Audio mix. */
  audio: {
    musicVol: 0.5,
    sfxVol: 0.9,
    shootThrottleMs: 55,
    hitThrottleMs: 45,
    coinThrottleMs: 38,
    fadeMs: 700,
  },

  /** Tutorial: three contextual prompts on the first run only. */
  tutorial: {
    moveDismissPx: 90,      // world units travelled dismisses "move"
    collectDismiss: 6,      // coins picked up dismisses "collect"
    holdSec: 1.2,           // how long a prompt stays after its condition
  },

  /** Save + dev. */
  save: { key: 'crown-and-circuit.save', version: 1, debounceMs: 250 },
  devGesture: { taps: 5, withinMs: 1600, cornerPx: 90 },

  /** Palettes, one per era — terrain, structures and UI accents all key off these. */
  palettes: [
    { // IRON — mossy river valley, cold stone
      ground: 0x2f3d2c, groundAlt: 0x374733, road: 0x4a4436,
      stone: 0xa8a294, stoneDark: 0x6e6a60, wood: 0x6b4f31,
      accent: 0xc9a227, accent2: 0x7fa650, sky: 0x1b2420,
      enemy: 0x8d4a4a, enemyDark: 0x5e2f2f, ui: 0xe8e0cf,
    },
    { // POWDER — churned earth, smoke, brass
      ground: 0x3a352a, groundAlt: 0x453e30, road: 0x554a38,
      stone: 0xb0a894, stoneDark: 0x736b58, wood: 0x7a5533,
      accent: 0xe0a94a, accent2: 0xb5763a, sky: 0x241f18,
      enemy: 0x94503c, enemyDark: 0x5f3223, ui: 0xf0e6d2,
    },
    { // INDUSTRY — soot, rust, iron
      ground: 0x33322f, groundAlt: 0x3c3b37, road: 0x4c4a45,
      stone: 0x9d9c99, stoneDark: 0x64635f, wood: 0x6f5638,
      accent: 0xe08a3c, accent2: 0x8fa3ad, sky: 0x1e1d1c,
      enemy: 0x8a5340, enemyDark: 0x593325, ui: 0xeee9df,
    },
    { // STEEL — olive drab, concrete, tracer orange
      ground: 0x2e3630, groundAlt: 0x374039, road: 0x4a4f48,
      stone: 0x9aa09a, stoneDark: 0x5f645f, wood: 0x5c5a4e,
      accent: 0xffb545, accent2: 0x6f8f6a, sky: 0x1a1f1c,
      enemy: 0x7d5a4a, enemyDark: 0x4d382d, ui: 0xecefe9,
    },
    { // NEON — black glass, cyan, magenta
      ground: 0x14121f, groundAlt: 0x1a1729, road: 0x241f38,
      stone: 0x4a4468, stoneDark: 0x2b2740, wood: 0x39335c,
      accent: 0x5cf5ff, accent2: 0xff3fa4, sky: 0x0a0812,
      enemy: 0xb43fd8, enemyDark: 0x6b1f88, ui: 0xdff6ff,
    },
  ],

  /** Era-independent UI colours. */
  colors: {
    bg: 0x0e0f12,
    panel: 0x16181d,
    ink: 0xf2efe6,
    inkDim: 0x9aa0a8,
    good: 0x67c27a,
    warn: 0xe0a94a,
    bad: 0xd8524a,
    gold: 0xf0c34a,
    white: 0xffffff,
  },
} as const;

export type EnemyKind = 'runner' | 'brute' | 'shooter' | 'flyer' | 'boss';
export type StructureKind = 'tower' | 'barracks' | 'forge';
export type MetaKey = keyof typeof CONFIG.meta.upgrades;
export type EraDef = (typeof CONFIG.eras)[number];
