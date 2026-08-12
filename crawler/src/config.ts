/**
 * Every balance constant and tunable in the game lives here.
 * No magic numbers anywhere else in the codebase — if a value shapes
 * gameplay, feel, economy, or performance, it is a named field below.
 *
 * Strings are NOT here; they live in src/flavour.
 */
export const CONFIG = {
  /** Design-space canvas. All UI layout happens in these units. */
  design: {
    width: 440,           // iPhone Pro Max CSS points
    height: 956,
    maxResolution: 2.5,   // cap renderer DPR: 3.0 on a 6.9" panel costs more than it returns
  },

  /** Fixed-timestep simulation, decoupled from render. */
  sim: {
    hz: 120,              // physics rate — identical gameplay at 60 or 120 fps render
    maxStepsPerFrame: 6,  // spiral-of-death guard: clamp catch-up steps after a long hitch
    maxFrameMs: 100,      // clamp a single frame's wall-clock delta before accumulating
  },

  /** Frame-rate governor: target 120 on ProMotion, degrade gracefully. */
  fps: {
    degradeThresholdMs: 8.3,
    windowMs: 2000,
    fallbackCap: 60,
  },

  /** Thermal guard: long sessions trade sparkle for temperature. */
  thermal: {
    softenAfterSec: 240,
    particleBudgetScale: 0.6,
  },

  /**
   * The world. A single continuous plane in world units; the camera shows a
   * 440×956 window onto it. Terrain is generated per chunk and cached, so the
   * size below costs memory only where the player has actually been.
   */
  world: {
    /** world units across and down — square */
    size: 5120,
    /** one terrain tile */
    tile: 32,
    /** tiles per chunk edge; chunk = 512 world units */
    chunkTiles: 16,
    /**
     * Chunks kept baked at once (LRU). Must comfortably exceed the number that
     * can be mounted at once — a 440×956 viewport plus padding mounts up to
     * ~20, and evicting a mounted chunk destroys a texture still in use.
     */
    chunkCache: 40,
    /** how far outside the viewport chunks are kept mounted */
    chunkPadding: 320,
    /** the player cannot leave this margin from the edge */
    edgePad: 96,
    seed: 0x5eed_1a3,
  },

  /** Camera: follows the player with a dead zone so small steps don't swim. */
  camera: {
    deadZoneX: 44,
    deadZoneY: 70,
    lerp: 7.5,          // per-second ease toward the target
    lookAhead: 0.16,    // fraction of velocity added ahead of the player
  },

  /** The player. */
  player: {
    radius: 13,
    speed: 196,          // world units per second at DEX base
    speedPerDex: 0.018,  // +1.8 % move speed per point above base
    /** seconds of invulnerability after taking a hit */
    iFrames: 0.62,
    /** auto-pickup radius for ground loot */
    pickupRadius: 34,
    /** how close you must be to talk to an NPC or use a door */
    interactRadius: 46,
    /** respawn costs this fraction of carried gold */
    deathGoldPenalty: 0.2,
    /** seconds face-down before the respawn screen */
    deathDelay: 1.4,
  },

  /** Donut: a follower who fights and has opinions. */
  companion: {
    /** stays within this of the player before catching up */
    followDist: 54,
    speed: 226,          // slightly faster so she can keep up after a sprint
    radius: 9,
    attackRange: 150,
    attackInterval: 1.1,
    /** her damage as a fraction of yours */
    damageFrac: 0.55,
  },

  /**
   * Combat. Attacks are automatic against the nearest valid target in range —
   * on a phone the interesting decision is where you stand, not whether you
   * remembered to tap attack.
   */
  combat: {
    attackRange: 232,
    attackInterval: 0.52,   // seconds at DEX base
    projSpeed: 620,
    projRadius: 8,
    projLifeSec: 1.2,
    projPoolSize: 220,
    /** damage numbers and hit flash */
    hitFlashMs: 65,
    critMult: 1.9,
    /** knockback applied to a struck enemy, world units/sec */
    knockback: 130,
    knockbackDecay: 7.5,
  },

  /**
   * Enemy archetypes. `range` 0 means it has to touch you.
   *
   * Every ranged enemy's `range` stays under the player's `combat.attackRange`
   * (232). A shooter that out-ranges you cannot be approached without eating
   * free hits, which on a phone reads as the game cheating rather than as a
   * threat — the AI stops at `range × 0.8`, so that is the number that has to
   * clear.
   */
  enemies: {
    rat:    { hp: 18,  dmg: 5,  speed: 128, radius: 13, range: 0,   cooldown: 1.0, xp: 9,  gold: 3,  aggro: 280, leash: 620 },
    brute:  { hp: 62,  dmg: 14, speed: 70,  radius: 21, range: 0,   cooldown: 1.6, xp: 28, gold: 12, aggro: 230, leash: 540 },
    drone:  { hp: 32,  dmg: 8,  speed: 112, radius: 16, range: 210, cooldown: 1.9, xp: 19, gold: 7,  aggro: 340, leash: 760 },
    elite:  { hp: 210, dmg: 22, speed: 100, radius: 26, range: 200, cooldown: 1.3, xp: 95, gold: 48, aggro: 380, leash: 900 },
    boss:   { hp: 1400, dmg: 30, speed: 90, radius: 40, range: 250, cooldown: 1.0,  xp: 440, gold: 320, aggro: 600, leash: 4000 },
    /** enemy projectile speed for ranged kinds */
    shotSpeed: 300,
    /** live enemies allowed at once, across the whole world */
    poolSize: 120,
    /** enemies further than this from the player are despawned and refunded */
    despawnDist: 1500,
    /** a cleared camp stays cleared for this long before it repopulates */
    respawnSec: 150,
    /** ordinary mobs gain this much health per player level, up to maxScale */
    scalePerLevel: 0.09,
    maxScale: 2.2,
  },

  /** Points of interest scattered over the world. */
  poi: {
    /** how many of each, excluding the two fixed towns and the boss lair */
    camps: 9,
    ruins: 5,
    shrines: 4,
    /** minimum spacing between any two POIs, world units */
    minSpacing: 780,
    /** radius within which a POI counts as discovered */
    discoverRadius: 300,
    /** enemies a camp holds, and how far they wander from its centre */
    campSize: 4,
    campRadius: 190,
    /** a shrine grants this once, permanently */
    shrineStatPoints: 1,
  },

  /** Ground loot. */
  loot: {
    /** chance a normal kill drops anything at all */
    dropChance: 0.34,
    eliteDropChance: 1,
    /** seconds a dropped item survives before it fades */
    lifeSec: 90,
    /** gear tiers and the stat budget each carries */
    tiers: ['worn', 'solid', 'fine', 'prime'] as const,
    tierWeight: { worn: 0.5, solid: 0.3, fine: 0.16, prime: 0.04 } as Record<string, number>,
    tierBudget: { worn: 2, solid: 4, fine: 7, prime: 11 } as Record<string, number>,
    /** LUCK shifts the tier roll by this much per point above base */
    luckTierShift: 0.02,
    /** how much gold a coin pile is worth, scaled by the source's gold value */
    goldPileFrac: 1,
  },

  /** Equipment slots and what a point of budget buys in each. */
  gear: {
    slots: ['weapon', 'armour', 'trinket'] as const,
    /** a point of weapon budget = +this much flat damage */
    weaponDamagePerPoint: 1.6,
    /** a point of armour budget = +this much max HP */
    armourHpPerPoint: 7,
    /** a point of trinket budget = +this fraction to one random stat's effect */
    trinketStatPerPoint: 1,
  },

  /**
   * Character stats. Base 1 in everything; points spent on level-up.
   * `per` is the effect of ONE point above the base.
   */
  stats: {
    base: 1,
    max: 40,
    pointsPerLevel: 3,
    /** XP needed to reach level n+1 from level n */
    xpToLevel: (lvl: number) => Math.round(80 * Math.pow(1.38, lvl - 1)),
    /** max HP at level n before armour */
    hpAtLevel: (lvl: number) => 120 + (lvl - 1) * 26,
    effects: {
      str:  1.8,    // +1.8 flat damage per point
      dex:  0.05,   // +5 % attack rate per point (and a little move speed)
      con:  9,      // +9 max HP per point
      int:  0.05,   // −5 % ability cooldown per point (capped)
      wis:  0.10,   // +10 % ability potency per point
      cha:  0.06,   // −6 % vendor prices per point (capped)
      luck: 0.035,  // +3.5 % crit chance per point (capped)
    },
    intMaxCdr: 0.5,
    chaMaxDiscount: 0.45,
    luckMaxCrit: 0.5,
    /** base damage before STR and weapon */
    baseDamage: 9,
  },

  /** The two ability buttons. */
  abilities: {
    blast: {
      cooldownSec: 12,
      /** damage = this × (1 + WIS effect), to everything in radius */
      damage: 46,
      radius: 210,
    },
    surge: {
      cooldownSec: 22,
      /** heal = this × (1 + WIS effect) */
      heal: 45,
      /** and this many seconds of extra move speed */
      hasteSec: 4,
      hasteMult: 1.45,
    },
    buttonSize: 64,     // ≥52 design-px tap target
  },

  /** Floating joystick: appears wherever the thumb lands. */
  joystick: {
    /** taps below this fraction of screen height start a stick */
    zoneTopFrac: 0.42,
    baseRadius: 58,
    knobRadius: 26,
    /** finger travel that counts as full deflection */
    fullThrowPx: 52,
    /** below this deflection the player stands still */
    deadZone: 0.14,
  },

  /** Minimap in the corner. */
  minimap: {
    size: 108,
    /** world units shown across the minimap */
    span: 2400,
    /** fog cells across the whole world */
    fogCells: 64,
    /** cells within this radius of the player get revealed */
    revealRadius: 380,
  },

  /** Economy. */
  economy: {
    achievementGold: 60,
    /** vendors buy your gear back at this fraction of its value */
    sellFrac: 0.4,
    /** gear value per point of budget */
    goldPerBudget: 26,
  },

  /** Feel: shake, particles, hit stop. */
  fx: {
    shakeHit: 4,
    shakePlayerHurt: 9,
    shakeBlast: 12,
    shakeBossDeath: 22,
    shakeDecay: 0.86,
    particleBudget: 320,
    damageNumberCap: 30,
    damageNumberMs: 620,
    hapticHitMs: 10,
    hapticHurtMs: 26,
    hapticBossMs: [30, 40, 80] as number[],
    hitParticles: 5,
    dieParticles: 16,
  },

  /** Audio mix. */
  audio: {
    musicVol: 0.55,
    sfxVol: 0.9,
    shootThrottleMs: 90,
    hitThrottleMs: 60,
    fadeMs: 450,
  },

  /** System notification toasts. */
  system: {
    showMs: 3600,
    fadeMs: 260,
    maxVisible: 1,
    maxQueue: 8,
    lineHeight: 21,
    width: 372,
    /** design y the feed hangs from while roaming — below the HUD band */
    worldTopY: 150,
  },

  /** Save + misc. */
  save: {
    key: 'crawler.save',
    version: 4,
    debounceMs: 250,
    /** the world autosaves this often while roaming */
    autosaveSec: 20,
  },
  devGesture: {
    taps: 5,
    withinMs: 1600,
    cornerPx: 90,
  },

  /** Palette — daylight over a floor that used to be a city. */
  colors: {
    ink: 0x141119,
    inkLift: 0x241f2b,
    grass: 0x4a6b3d,
    grassDim: 0x3a5531,
    dirt: 0x7a5c3a,
    dirtDim: 0x5c4429,
    stone: 0x6f6f78,
    stoneDim: 0x4a4a52,
    water: 0x2f5d78,
    forest: 0x2f4a2c,
    waste: 0x6b5a48,
    rust: 0xa2542b,
    rustDeep: 0x6d3618,
    sys: 0x2f7ad9,
    sysBright: 0x63a8f0,
    sysDeep: 0x18477f,
    amber: 0xd9a441,
    amberBright: 0xf0c268,
    bone: 0xe6e3dd,
    boneDim: 0xb0aca4,
    hpRed: 0xb5402e,
    hpRedBright: 0xe0654b,
    goodTeal: 0x2f8f83,
    hpGreen: 0x5da05a,
    white: 0xffffff,
  },
} as const;

export type EnemyKind = keyof typeof CONFIG.enemies & ('rat' | 'brute' | 'drone' | 'elite' | 'boss');
export type StatKey = keyof typeof CONFIG.stats.effects;
export type GearSlot = (typeof CONFIG.gear.slots)[number];
export type GearTier = (typeof CONFIG.loot.tiers)[number];
export type AbilityKey = 'blast' | 'surge';

export const STAT_KEYS: StatKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha', 'luck'];
export const ENEMY_KINDS: EnemyKind[] = ['rat', 'brute', 'drone', 'elite', 'boss'];
export const GEAR_SLOTS: GearSlot[] = ['weapon', 'armour', 'trinket'];
