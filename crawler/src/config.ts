/**
 * Every balance constant and tunable in the game lives here.
 * No magic numbers anywhere else in the codebase — if a value shapes
 * gameplay, feel, economy, or performance, it is a named field below.
 *
 * Strings are NOT here; they live in src/flavour.
 */
export const CONFIG = {
  /** Design-space canvas. All layout math happens in these units. */
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

  /** Hero placement and steering. */
  hero: {
    screenY: 700,
    laneHalfWidth: 168,
    dragGain: 1.0,
    steerLerp: 26,
    radius: 16,
  },

  /** Forward motion & camera. */
  run: {
    baseSpeed: 340,
    speedPerParty: 0.0012,
    speedMax: 1.16,
    camPullbackPerParty: 0.0006,
    camPullbackMax: 0.055,
    camLerp: 1.6,
  },

  /** Auto-fire. Carl and the party fire on one shared beat. */
  fire: {
    interval: 0.40,
    projSpeed: 1250,
    projDamage: 1,
    projRadius: 7,
    projLifeSec: 1.1,
    spreadX: 9,
    poolSize: 640,
    beatJitterMs: 42,
  },

  /** Party formation & growth: the V-wedge trailing behind Carl. */
  party: {
    max: 130,
    overflowGoldPer: 1,
    rowSpacing: 13,
    colSpacing: 24,
    laneClampPad: 10,
    jitter: 4,
    springK: 90,
    springD: 13,
    tierAt: [10, 25, 50, 100],
    countRollMs: 250,
    deathFlyMs: 420,
  },

  /**
   * Doors. Paired across the tunnel; you walk through exactly one.
   * `trapResist` (from CON) softens the trap side.
   */
  doors: {
    pairGapX: 4,
    archWidth: 210,
    archHeight: 128,
    triggerBand: 14,
    nearMissPx: 30,
    slowmoScale: 0.4,
    slowmoMs: 400,
    effects: {
      x2:   { mult: 2,   add: 0,   trap: false, label: '×2' },
      x3:   { mult: 3,   add: 0,   trap: false, label: '×3' },
      add5: { mult: 1,   add: 5,   trap: false, label: '+5' },
      add10:{ mult: 1,   add: 10,  trap: false, label: '+10' },
      sub5: { mult: 1,   add: -5,  trap: true,  label: '−5' },
      half: { mult: 0.5, add: 0,   trap: true,  label: '÷2' },
      pct50:{ mult: 0.5, add: 0,   trap: true,  label: '−50%' },
    },
  },

  /** Mob archetypes. contactLoss = party members removed on reaching the line. */
  enemies: {
    brute: { hp: 14, speed: 46,  radius: 26, contactLoss: 8, gold: 3, xp: 12 },
    rat:   { hp: 3,  speed: 150, radius: 15, contactLoss: 3, gold: 1, xp: 3 },
    drone: { hp: 5,  speed: 95,  radius: 18, contactLoss: 2, gold: 2, xp: 6,
             crossSpeed: 130, waveAmp: 34, waveHz: 1.6 },
    hpPerFloor: 0.16,
    speedPerFloor: 0.02,
    hitFlashMs: 70,
    poolSize: 96,
    contactHalfWidth: 82,
  },

  /**
   * Floor boss: a blocking hulk with two arms that wake halfway through.
   *
   * Tuned against the crush clock rather than against a wall-time target,
   * because the hulk closing on your line is what makes the fight a decision:
   * it travels `fightDistance − crushLine` at `approachSpeed`, so you have
   * ~20 s of fire regardless of how big your party is. At floor-1 damage
   * (1/arrow, one volley per 0.4 s) that puts the minimum viable party near
   * 30 and a comfortable one near 50 — i.e. you must clear at least one
   * tunnel before knocking, and a full sweep makes it easy.
   */
  boss: {
    baseHp: 1100,
    approachSpeed: 20,
    fightDistance: 470,
    armsWakeAt: 0.5,
    shieldPeriod: 3.6,
    shieldDuration: 1.3,
    gateWidth: 340,
    crushLine: 60,
    breachFreezeMs: 260,
    breachFlashMs: 320,
    breachDebrisMs: 2100,
    hitSfxThrottleMs: 90,
  },

  /**
   * Floors. Only floor 0 is built, but every curve is a function of the
   * floor index so floors 2+ are a data change, not a code change.
   */
  floors: {
    count: 18,
    built: 1,             // how many are actually playable today
    /** seconds on the floor clock */
    timeLimitSec: (i: number) => 480 - i * 6,
    /** warn the player once, this far out */
    warnAtSec: 60,
    /** flat clock cost for stepping between map nodes */
    travelCostSec: 8,
    /** clock cost of a loot box / safe room visit (encounters bill actual time) */
    lootCostSec: 12,
    safeCostSec: 25,
    /** boss HP curve */
    bossHp: (i: number, base: number) => Math.round(base * (1 + i * 0.85)),
    /** graph shape: layers of nodes between entry and boss */
    layers: (i: number) => 5 + Math.min(3, Math.floor(i / 4)),
    seedBase: 0x21c4,
  },

  /** Per-encounter generation, as curves over floor index. */
  encounter: {
    /** corridor scroll length in design px */
    corridorLen: (i: number) => 14_000 + i * 900,
    /** seconds between door pairs inside a corridor */
    doorEverySec: (i: number) => 8.2 - Math.min(2.4, i * 0.22),
    /** mob waves per corridor-minute */
    wavesPerMin: (i: number) => 4.2 + i * 0.55,
    /** doors clear before anything bites — floor 1 gets the longest grace */
    waveLeadDoors: (i: number) => (i === 0 ? 3 : i < 4 ? 2 : 1),
    /** fraction of door pairs that include a hazard side */
    trapRatio: (i: number) => Math.min(0.85, 0.3 + i * 0.05),
    /** waves in a standalone mob room */
    arenaWaves: (i: number) => 3 + Math.floor(i / 3),
    /** seconds between arena waves */
    arenaWaveGap: 4.5,
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
    xpToLevel: (lvl: number) => Math.round(70 * Math.pow(1.42, lvl - 1)),
    effects: {
      str:  0.14,   // +14 % arrow damage per point
      dex:  0.06,   // +6 % fire rate per point
      con:  0.05,   // −5 % losses per point (capped)
      int:  0.05,   // −5 % ability cooldown per point (capped)
      wis:  0.10,   // +10 % ability potency per point
      cha:  2,      // +2 starting party per point
      luck: 0.03,   // +3 % loot-tier upgrade chance per point
    },
    /** hard caps so a single dumped stat can't trivialise the game */
    conMaxResist: 0.55,
    intMaxCdr: 0.5,
    luckMaxUpgrade: 0.6,
  },

  /** The two HUD ability buttons. */
  abilities: {
    blast: {
      cooldownSec: 14,
      /** damage = this × (1 + WIS effect) */
      damage: 26,
      radius: 999,      // whole screen
    },
    rally: {
      cooldownSec: 28,
      /** party restored = this × (1 + WIS effect) */
      restore: 8,
    },
    buttonSize: 62,     // ≥52 design-px tap target
  },

  /** Loot boxes. */
  loot: {
    tiers: ['bronze', 'silver', 'gold'] as const,
    /** gold payout range per tier */
    goldRange: { bronze: [18, 34], silver: [42, 78], gold: [95, 160] } as Record<string, [number, number]>,
    /** xp payout range per tier */
    xpRange: { bronze: [12, 24], silver: [30, 55], gold: [70, 120] } as Record<string, [number, number]>,
    /** chance the box also contains a permanent attribute point */
    statPointChance: { bronze: 0.08, silver: 0.22, gold: 0.55 } as Record<string, number>,
    /** chance the box also contains party reinforcements, and how many */
    partyChance: { bronze: 0.45, silver: 0.6, gold: 0.75 } as Record<string, number>,
    partyRange: { bronze: [2, 5], silver: [5, 10], gold: [10, 18] } as Record<string, [number, number]>,
  },

  /** Safe room. */
  safe: {
    /** party restored to this fraction of your peak on the floor */
    healToFrac: 0.6,
    vendorPartyCost: 60,     // gold for +6 party
    vendorPartyGain: 6,
    vendorStatCost: 340,     // gold for a permanent attribute point
  },

  /** Economy. */
  economy: {
    goldPerEndParty: 1,
    clearBonus: 120,
    failConsolationFrac: 0.25,
    achievementGold: 40,
  },

  /** Feel: shake, particles, slow-mo, haptics. */
  fx: {
    shakeDoor: 5,
    shakeTrap: 8,
    shakeBossHit: 7,
    shakeBossBreach: 22,
    shakePartyLoss: 6,
    shakeDecay: 0.86,
    particleBudget: 320,
    damageNumberCap: 26,
    damageNumberMs: 620,
    hapticDoorMs: 12,
    hapticTrapMs: 28,
    hapticBreachMs: [30, 40, 80] as number[],
    glyphTrailEvery: 0.05,
    hitParticles: 5,
    dieParticles: 14,
    doorParticles: 20,
  },

  /** Audio mix. */
  audio: {
    musicVol: 0.55,
    sfxVol: 0.9,
    shootThrottleMs: 110,
    hitThrottleMs: 70,
    fadeMs: 450,
  },

  /** System notification toasts. */
  system: {
    showMs: 3600,        // per notification
    fadeMs: 260,
    maxVisible: 1,       // on screen at once — a stack buries whatever raised it
    maxQueue: 8,         // waiting for a slot
    lineHeight: 21,
    width: 372,
    /** design y the feed hangs from inside an encounter — below the HUD band */
    encounterTopY: 168,
  },

  /** Tutorial: one contextual prompt, first door pair, first run only. */
  tutorial: {
    dismissDragPx: 34,
    slowScale: 0.35,
    handLoopMs: 1100,
  },

  /** Save + misc. */
  save: {
    key: 'crawler.save',
    version: 3,
    debounceMs: 250,
  },
  devGesture: {
    taps: 5,
    withinMs: 1600,
    cornerPx: 90,
  },

  /** Palette — concrete, rust, emergency lighting, and the System's blue. */
  colors: {
    concrete: 0x3a3a3c,
    concreteDim: 0x24242a,
    pit: 0x0d0e11,        // near-black ground
    pitLift: 0x1a1c21,
    rust: 0xa2542b,
    rustDeep: 0x6d3618,
    sys: 0x2f7ad9,        // the System's notification blue
    sysBright: 0x63a8f0,
    sysDeep: 0x18477f,
    amber: 0xd9a441,      // emergency lighting / gold
    amberBright: 0xf0c268,
    bone: 0xe6e3dd,
    boneDim: 0xb0aca4,
    trapRed: 0xb5402e,
    trapRedBright: 0xe0654b,
    starEmpty: 0x3c3a36,
    goodTeal: 0x2f8f83,
    hpGreen: 0x5da05a,
    white: 0xffffff,
  },
} as const;

export type DoorKind = keyof typeof CONFIG.doors.effects;
export type EnemyKind = 'brute' | 'rat' | 'drone';
export type StatKey = keyof typeof CONFIG.stats.effects;
export type LootTier = (typeof CONFIG.loot.tiers)[number];
export type AbilityKey = 'blast' | 'rally';

export const STAT_KEYS: StatKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha', 'luck'];
