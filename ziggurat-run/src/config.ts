/**
 * Every balance constant and tunable in the game lives here.
 * No magic numbers anywhere else in the codebase — if a value shapes
 * gameplay, feel, economy, or performance, it is a named field below.
 */
export const CONFIG = {
  /** Design-space canvas. All layout math happens in these units. */
  design: {
    width: 440,           // iPhone Pro Max CSS points
    height: 956,
    maxResolution: 2.5,   // cap renderer DPR: 3.0 on a 6.9" panel costs more than it returns
    minUiScale: 0.75,     // below this letterbox scale we refuse to shrink hit targets further
  },

  /** Fixed-timestep simulation, decoupled from render. */
  sim: {
    hz: 120,              // physics rate — identical gameplay at 60 or 120 fps render
    maxStepsPerFrame: 6,  // spiral-of-death guard: clamp catch-up steps after a long hitch
    maxFrameMs: 100,      // clamp a single frame's wall-clock delta before accumulating
  },

  /** Frame-rate governor: target 120 on ProMotion, degrade gracefully. */
  fps: {
    degradeThresholdMs: 8.3,  // if avg frame time exceeds this (i.e. we miss 120fps)…
    windowMs: 2000,           // …across a rolling 2 s window…
    fallbackCap: 60,          // …lock the ticker to 60 fps for the rest of the session
  },

  /** Thermal guard: long sessions trade sparkle for temperature. */
  thermal: {
    softenAfterSec: 240,      // 4 minutes of accumulated RUN time
    particleBudgetScale: 0.6, // −40 % particle budget once tripped
  },

  /** Hero placement and steering. */
  hero: {
    screenY: 700,          // hero's fixed y in design space (world scrolls past)
    laneHalfWidth: 168,    // max |x| offset from lane center
    dragGain: 1.0,         // 1:1 finger tracking in design px
    steerLerp: 26,         // exponential smoothing rate (per second) toward finger target
    radius: 16,            // collision radius vs enemies reaching the line
  },

  /** Forward motion & camera. */
  run: {
    baseSpeed: 340,           // design px/s of world scroll
    speedPerSquad: 0.0012,    // +0.12 % speed per squad member — subtle surge as you grow
    speedMax: 1.16,           // cap on that multiplier
    camPullbackPerSquad: 0.0006, // world scale eases toward (1 − n·this), camera breathing
    camPullbackMax: 0.055,       // never pull back more than 5.5 %
    camLerp: 1.6,                // per-second ease rate for scale changes
  },

  /** Auto-fire. Hero and squad fire on one shared beat. */
  fire: {
    interval: 0.40,        // seconds between volleys at upgrade level 0
    projSpeed: 1250,       // design px/s upward
    projDamage: 1,         // base damage per arrow at upgrade level 0
    projRadius: 7,         // collision radius
    projLifeSec: 1.1,      // despawn beyond screen
    spreadX: 9,            // random lateral offset per squad arrow (loose volley feel)
    poolSize: 640,         // max live arrows (130 squad × ~2 volleys airborne + margin)
    beatJitterMs: 42,      // per-unit random delay inside a volley — organic ripple
  },

  /** Squad formation & growth. */
  squad: {
    max: 130,              // hard cap; overflow converts to coins
    overflowCoinPer: 1,    // coins per unit gained beyond the cap
    rowSpacing: 13,        // design px between formation rows (depth)
    colSpacing: 24,        // design px between slots in a row (width)
    laneClampPad: 10,      // formation edge stays this far inside the lane
    jitter: 4,             // per-slot positional noise so the wedge looks organic
    springK: 90,           // spring-damper follow: stiffness
    springD: 13,           // damping (slightly underdamped = lively)
    tierAt: [10, 25, 50, 100], // squad size thresholds that upgrade unit visuals
    countRollMs: 250,      // HUD squad number eases to new value over this time
    deathFlyMs: 420,       // dying unit tumble duration
  },

  /** Gates. Values are the *label* semantics; trap resistance softens traps. */
  gates: {
    speedRelative: 0,        // gates are fixed to the track (world scroll only)
    pairGapX: 4,             // gap between the two arches at lane center
    archWidth: 210,          // one arch spans just under half the lane
    archHeight: 128,
    triggerBand: 14,         // vertical band around gate line that scores the pass
    nearMissPx: 30,          // steering this close to a trap edge triggers slow-mo drama
    slowmoScale: 0.4,        // near-miss time scale
    slowmoMs: 400,           // near-miss duration (real time)
    minSquadFloor: 0,        // traps can wipe you — 0 alive = run over
    /** effect table: kind → how squad count n transforms */
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

  /** Enemy archetypes. contactLoss = squad members removed on reaching the line. */
  enemies: {
    golem:    { hp: 14, speed: 46,  radius: 26, contactLoss: 8, coin: 3, score: 'the clay golems' },
    scorpion: { hp: 3,  speed: 150, radius: 15, contactLoss: 3, coin: 1, score: 'the scorpion wave' },
    anzu:     { hp: 5,  speed: 95,  radius: 18, contactLoss: 2, coin: 2, score: 'the Anzu storm-birds',
                crossSpeed: 130,   // lateral px/s while crossing the lane
                waveAmp: 34, waveHz: 1.6 }, // flight bob
    hpPerStage: 0.16,     // +16 % HP per stage index — density and durability both climb
    speedPerStage: 0.02,  // +2 % speed per stage index
    hitFlashMs: 70,
    poolSize: 96,
    /** an enemy reaching the line only bites if within this of the hero's x —
     *  roughly the formation's half-width; dodge sideways and it streams past */
    contactHalfWidth: 82,
  },

  /** Boss: the ziggurat gate + lamassu pair. */
  boss: {
    baseHp: 260,             // stage-0 gate HP; scaled by stages.bossHpCurve
    approachSpeed: 26,       // design px/s the gate closes on you during the fight
    fightDistance: 470,      // gate spawns this far above the hero line
    lamassuWakeAt: 0.5,      // HP fraction where the statues animate awake
    shieldPeriod: 3.6,       // seconds per shield cycle once lamassu are awake
    shieldDuration: 1.3,     // invulnerable window inside each cycle
    gateWidth: 340,
    crushLine: 60,           // gate bottom reaching hero.screenY − this = wipe
    breachFreezeMs: 260,     // freeze-frame on kill
    breachFlashMs: 320,      // white flash duration
    breachDebrisMs: 2100,    // collapse sequence before results
    hitSfxThrottleMs: 90,
  },

  /**
   * Stage table generation. 12 stages across 3 chapters.
   * Every curve is a function of stage index i (0-based, 0..11).
   */
  stages: {
    count: 12,
    perChapter: 4,
    /** stage duration in seconds of scroll before the boss: 60 s → 88 s */
    durationSec: (i: number) => 60 + i * 2.5,
    /** seconds between gate pairs: generous early, denser late */
    gateEverySec: (i: number) => 8.2 - Math.min(2.4, i * 0.22),
    /** enemy waves per stage-minute */
    wavesPerMin: (i: number) => 4.2 + i * 0.55,
    /**
     * Enemies hold off until this many gate-pairs have gone by. The opening of
     * a stage is for growing, not fighting: a golem costs 8 units, so meeting
     * one on a squad of six ends the run before it starts. Stage 1 gets the
     * longest grace period — it has to be winnable first try.
     */
    waveLeadGates: (i: number) => (i === 0 ? 3 : i < 4 ? 2 : 1),
    /** fraction of gate pairs that include a trap side */
    trapRatio: (i: number) => Math.min(0.85, 0.3 + i * 0.05),
    /** boss HP curve — tuned so a decent run breaches with 8-14 s of fire */
    bossHp: (i: number, baseHp: number) => Math.round(baseHp * (1 + i * 0.85)),
    /**
     * Star thresholds — squad alive when the boss DIES.
     * strongSquad models a good-but-not-perfect run for that stage.
     */
    strongSquad: (i: number) => Math.round(34 + i * 7.4), // ~34 → ~115
    stars2Frac: 0.5,   // ≥50 % of strongSquad alive → ★★
    stars3Frac: 0.85,  // ≥85 % → ★★★ (1 star for any win)
    seedBase: 0x216b,  // layout RNG seed = seedBase + stageIndex (stable layouts)
  },

  /** Economy: earn per run, spend on permanent upgrades. */
  economy: {
    /** run income */
    coinPerEndSquad: 1,     // each surviving unit at breach pays 1
    starBonus: [0, 12, 30, 60], // lump by stars earned (index = stars)
    chapterIncomeMult: 0.45,    // +45 % kill/end income per chapter index
    failConsolationFrac: 0.25,  // failed runs keep 25 % of kill coins — progress never zero
    /**
     * Upgrade tracks: 5 levels each. Cost curve ≈ ×2.2 per level; the four
     * L1s (≈320 total) land after ~3 early runs, the full board (≈13 k)
     * after roughly a chapter-3 clear plus replays — matched against
     * income that scales with chapterIncomeMult and later-stage density.
     */
    upgrades: {
      squad:  { name: 'Levy',        desc: '+2 starting militia per level', per: 2,    costs: [80, 176, 387, 851, 1873] },
      rate:   { name: 'Quickdraw',   desc: '+8% volley speed per level',    per: 0.08, costs: [90, 198, 435, 958, 2107] },
      dmg:    { name: 'Bronze Tips', desc: '+15% arrow damage per level',   per: 0.15, costs: [90, 198, 435, 958, 2107] },
      resist: { name: 'Ward Seals',  desc: '−8% trap losses per level',     per: 0.08, costs: [70, 154, 339, 745, 1639] },
    },
    maxLevel: 5,
  },

  /** Feel: shake, particles, slow-mo, haptics. */
  fx: {
    shakeGate: 5,            // px amplitude on gate pickup
    shakeTrap: 8,
    shakeBossHit: 7,
    shakeBossBreach: 22,
    shakeSquadLoss: 6,
    shakeDecay: 0.86,        // per-frame amplitude retention at 120fps
    particleBudget: 320,     // hard cap on live particles
    damageNumberCap: 26,     // live damage numerals
    damageNumberMs: 620,     // pop lifetime
    coinFlyMs: 520,          // coin pickup flight to HUD
    hapticGateMs: 12,        // light tap
    hapticTrapMs: 28,
    hapticBreachMs: [30, 40, 80] as number[], // heavy pattern on boss breach
    glyphTrailEvery: 0.05,   // seconds between cuneiform trail motes per arrow
    hitParticles: 5,         // burst size on enemy hit
    dieParticles: 14,        // burst on enemy death
    gateParticles: 20,       // burst on gate pickup
  },

  /** Audio mix. */
  audio: {
    musicVol: 0.55,
    sfxVol: 0.9,
    shootThrottleMs: 110,   // one bowstring per volley beat, not per arrow
    hitThrottleMs: 70,
    fadeMs: 450,            // music crossfade
  },

  /** Tutorial: one contextual prompt, first gate pair, first run only. */
  tutorial: {
    dismissDragPx: 34,     // cumulative steering that counts as "got it"
    slowScale: 0.35,       // time slows while the hand is up (unless reduced motion)
    handLoopMs: 1100,      // swipe loop duration
  },

  /** Save + misc. */
  save: {
    key: 'ziggurat-run.save',
    version: 2,            // current schema version (v1 → v2 migration kept as a worked example)
    debounceMs: 250,
  },
  devGesture: {
    taps: 5,               // 5 taps…
    withinMs: 1600,        // …within 1.6 s…
    cornerPx: 90,          // …in the top-left corner square opens the dev overlay
  },

  /** Palette — every sprite and UI tint derives from these. */
  colors: {
    lapis: 0x1b3b8f,
    lapisBright: 0x2e56c4,
    lapisDeep: 0x122a66,
    bitumen: 0x14100e,
    bitumenLift: 0x241c17,
    gold: 0xd9a441,
    goldBright: 0xf0c268,
    ochre: 0xc97b3c,
    ochreDeep: 0x9c5a28,
    bone: 0xede3d2,
    boneDim: 0xcbbfa9,
    trapRed: 0xb5402e,     // ochre-shifted red for traps (shape+text carry meaning too)
    trapRedBright: 0xe0654b, // same hue lifted for text on dark panels (≈5:1 contrast)
    starEmpty: 0x4a4034,   // unearned star: dim but never invisible against a dark panel
    goodTeal: 0x2f8f83,    // secondary accent on buff gates
    hpGreen: 0x5da05a,
    white: 0xffffff,
  },
} as const;

export type GateKind = keyof typeof CONFIG.gates.effects;
export type EnemyKind = 'golem' | 'scorpion' | 'anzu';
export type UpgradeKey = keyof typeof CONFIG.economy.upgrades;
