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
    hz: 120,
    maxStepsPerFrame: 6,
    maxFrameMs: 100,
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
   * The world, in plain cartesian units. Only drawing is isometric (see iso.ts),
   * so every number here is a distance you can reason about directly.
   */
  world: {
    size: 3600,
    /** one terrain tile, world units */
    tile: 48,
    /** tiles per chunk edge */
    chunkTiles: 8,
    /** baked chunks kept at once; must exceed the number mountable at once */
    chunkCache: 44,
    /** screen-space padding around the viewport before a chunk unmounts */
    chunkPadding: 340,
    edgePad: 90,
    seed: 0x5eed_1a3,
  },

  /** Camera: follows the hero with a dead zone so small steps don't swim. */
  camera: {
    deadZoneX: 40,
    deadZoneY: 54,
    lerp: 8,
    /** the hero sits below centre — you want to see where you are going */
    biasY: -72,
  },

  /** The hero. */
  hero: {
    radius: 15,
    speed: 172,
    /** how close to a pad or gate counts as standing on it */
    useRadius: 58,
    /** coins are hoovered up from this far away */
    pickupRadius: 62,
  },

  /**
   * The squad. This is the whole power curve: how many people are behind you
   * IS your damage, and the counter falling is how losing feels.
   */
  squad: {
    max: 60,
    /** what the muster post hands you at the start of a run */
    start: 8,
    /**
     * Cluster packing. The gap is in WORLD units, and the projection squashes
     * the vertical axis to 0.41 — so a ring that looks generous on paper draws
     * as a huddle a third of its size. 44 is what it takes for a member to
     * clear the body in front of it on screen.
     */
    ringGap: 44,
    perRing: 7,
    jitter: 7,
    /** spring-damper follow, slightly underdamped so the crowd has life */
    springK: 74,
    springD: 12,
    /** members lag this far behind the hero before catching up */
    slack: 24,
    countRollMs: 220,
    deathFlyMs: 420,
    /** one member's damage per hit, and how often */
    damage: 5,
    interval: 0.62,
    /**
     * How far a member will throw.
     *
     * Deliberately short — shorter than every enemy's aggro radius. A long
     * reach meant packs died on the approach and never touched the line, which
     * made the squad counter a number that only ever went up. The crowd has to
     * be a melee blob that trades bodies, or there is no game.
     */
    range: 120,
    /** the hero himself is worth this many members in a fight */
    heroWeight: 3,
  },

  /**
   * The companion. She is not a squad slot: she cannot be lost, she does not
   * take a formation position, and she keeps fighting when the crew is gone —
   * which is what makes a wipe a setback rather than a game over.
   */
  companion: {
    followDist: 96,
    speed: 210,
    damage: 9,
    interval: 0.8,
    range: 190,
    /** how often she has something to say about it, seconds */
    quipCooldown: 24,
  },

  /** Recruit pads: stand on one and it turns coins into people. */
  pad: {
    /** coins drained per second while standing on the pad */
    drainPerSec: 7,
    /** coins one recruit costs, rising as the pad is used */
    costBase: 1,
    costStep: 1,
    /** how many a single pad will ever give you */
    capacity: 14,
    /** how long the pad stays empty after being drained dry */
    refillSec: 45,
  },

  /** Coins lying in the world. */
  coins: {
    /** scattered per 1000² of world, outside structures */
    density: 5,
    value: 1,
    /** what a killed enemy leaves behind */
    dropMin: 1,
    dropMax: 3,
    poolSize: 220,
    /** magnet speed once inside pickupRadius */
    magnet: 420,
  },

  /** Enemy packs. `contact` is squad members lost when one reaches your line. */
  enemies: {
    grunt:  { hp: 90,   dmg: 7,  speed: 104, radius: 15, contact: 1, coins: 2,  aggro: 420, leash: 900 },
    heavy:  { hp: 280,  dmg: 16, speed: 78,  radius: 21, contact: 2, coins: 5,  aggro: 380, leash: 820 },
    archer: { hp: 140,  dmg: 10, speed: 96,  radius: 16, contact: 1, coins: 4,  aggro: 460, leash: 980, range: 150 },
    captain:{ hp: 1400, dmg: 22, speed: 88,  radius: 26, contact: 3, coins: 22, aggro: 520, leash: 1200 },
    poolSize: 140,
    despawnDist: 1500,
    respawnSec: 999,        // a cleared camp stays cleared for the session
    hitFlashMs: 70,
    /** how hard a struck enemy slides */
    knockback: 120,
    knockbackDecay: 8,
    /**
     * Seconds between melee bites at your line.
     *
     * This is the real difficulty dial: a camp of eight biting every 0.95 s
     * takes eight people a second, which turns any early camp into an instant
     * wipe. At 1.4 the same camp costs you a handful while the volley works.
     */
    contactInterval: 1.4,
    /** seconds between arrows, and how fast they travel */
    shotInterval: 1.7,
    arrowSpeed: 300,
    /** how far a body stays on the ground before it fades */
    corpseSec: 0.5,
  },

  /** Projectiles, both directions. */
  combat: {
    shotPoolSize: 180,
    /** the squad's thrown spears */
    spearSpeed: 520,
    spearLife: 0.9,
    arrowLife: 1.6,
    /** a shot is spent when it lands within this of a body */
    hitRadius: 12,
  },

  /** Camps and the castle. */
  poi: {
    camps: 8,
    pads: 6,
    minSpacing: 480,
    campSize: 8,
    campRadius: 150,
    /** a camp or pad within this of the hero is live */
    activeDist: 1400,
  },

  /** The castle gate: the objective at the end of the map. */
  castle: {
    hp: 1800,
    /** squad members lost per second while you stand in the gate's fire */
    gateDps: 1.6,
    /** how close the squad has to be to chip at it */
    range: 210,
    breachFreezeMs: 240,
    breachFlashMs: 320,
    breachDebrisMs: 2000,
  },

  /** Feel. */
  fx: {
    shakeHit: 3,
    shakeLoss: 8,
    shakeRecruit: 4,
    shakeBreach: 22,
    shakeDecay: 0.86,
    particleBudget: 340,
    damageNumberCap: 26,
    damageNumberMs: 600,
    hapticHitMs: 9,
    hapticLossMs: 26,
    hapticBreachMs: [30, 40, 80] as number[],
    hitParticles: 4,
    dieParticles: 12,
  },

  /** Audio mix. */
  audio: {
    musicVol: 0.55,
    sfxVol: 0.9,
    shootThrottleMs: 90,
    hitThrottleMs: 60,
    fadeMs: 450,
  },

  /** The stick is drawn as a ring around the hero, not under the thumb. */
  joystick: {
    /** taps below this fraction of screen height start a stick */
    zoneTopFrac: 0.28,
    ringRadius: 62,
    knobRadius: 24,
    fullThrowPx: 56,
    deadZone: 0.13,
  },

  /** System notification toasts. */
  system: {
    showMs: 3200,
    fadeMs: 240,
    maxVisible: 1,
    maxQueue: 6,
    lineHeight: 21,
    width: 372,
    worldTopY: 152,
  },

  /** Achievements. */
  meta: {
    /** coins paid out for an achievement, straight into the run's purse */
    achievementCoins: 20,
  },

  /** Save + misc. */
  save: {
    key: 'crawler.save',
    version: 5,
    debounceMs: 250,
    autosaveSec: 15,
  },
  devGesture: {
    taps: 5,
    withinMs: 1600,
    cornerPx: 90,
  },

  /**
   * Palette. Bright, saturated, high-key — this is a sunlit field seen from
   * above, and every value below is chosen to survive being drawn at 40 px.
   */
  colors: {
    grass: 0x7cbf4a,
    grassAlt: 0x6fb041,
    grassDark: 0x5c9636,
    path: 0xd8b477,
    ink: 0x2b2f24,
    inkLift: 0x3e442f,
    sand: 0xd9b479,
    sandDark: 0xc09c62,
    stone: 0x8b8d98,
    stoneDark: 0x4d4f59,
    wood: 0x7d4f2a,
    woodDark: 0x4a2e17,
    water: 0x4aa6c8,
    tree: 0x3f8b3a,
    treeDark: 0x2c6b2b,
    foe: 0xd63a2c,
    foeDark: 0x8c1f18,
    ally: 0x3a63c4,
    allyDark: 0x24408a,
    gold: 0xf5c033,
    goldDark: 0xa8760d,
    bone: 0xfff6e2,
    boneDim: 0xd8cfb8,
    hpRed: 0xe23a30,
    hpGreen: 0x62c94b,
    white: 0xffffff,
  },
} as const;

export type EnemyKind = 'grunt' | 'heavy' | 'archer' | 'captain';
export const ENEMY_KINDS: EnemyKind[] = ['grunt', 'heavy', 'archer', 'captain'];
