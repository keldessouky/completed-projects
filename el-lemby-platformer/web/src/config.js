// Tuning constants — kept numerically identical to GameConfig.swift and
// GameConfig.cs so all three platforms play the same. Units: points and
// seconds; world Y is up (the renderer flips).

export const CFG = {
  tile: 16,
  sceneW: 480,
  sceneH: 272,

  gravity: -9.8 * 150,
  maxFallSpeed: 700,

  maxRunSpeed: 116,
  runAcceleration: 640,
  groundFriction: 820,
  airAcceleration: 470,
  jumpSpeed: 452,
  jumpCutSpeed: 145,
  stompBounceSpeed: 310,
  coyoteTime: 0.09,
  jumpBufferTime: 0.12,
  hurtInvulnerabilityTime: 1.6,
  stompVelocityThreshold: -30,

  thugSpeed: 34,

  startLives: 3,
  stageCount: 2,
  stageTimeSeconds: 240,
  coinScore: 100,
  stompScore: 200,
  powerUpScore: 400,
  timeBonusPerSecond: 10,

  cameraLerp: 0.18,
  parallaxFar: 0.15,
  parallaxNear: 0.3,

  fallDeathY: -40,
};

// Every user-facing string, mirrored from the macOS/Windows builds.
export const L10N = {
  gameTitle: "اللمبي",
  gameSubtitle: "اللي بالي بالك",
  pressStart: "اضغط المسافة للبدء",
  controlsHint: "الأسهم أو A/D للحركة — المسافة للنط — M للصوت",
  fanDisclaimer: "لعبة معجبين غير رسمية مستوحاة من فيلم «اللي بالي بالك» (٢٠٠٣)",

  hudMoney: "العيش",
  hudLives: "الأرواح",
  hudTime: "الوقت",
  hudPowered: "مفوّل",

  paused: "وقفة يا معلم — اضغط P للمتابعة",
  demo: "عرض تجريبي — اضغط أي زر للعب",

  stageClear: "مبروك يا لمبي!",
  stageClearSub: "وصلت لسونيا في الزيارة بالسلامة",
  gameOver: "خلصت الأرواح يا لمبي",
  gameOverQuote: "«معلش… واللي بالي بالك»",
  scoreLabel: "النقاط",
  moneyLabel: "العيش اللي لمّيته",
  timeBonusLabel: "مكافأة الوقت",
  highScoreLabel: "أعلى نقاط",
  retryHint: "المسافة = من الأول — Enter = شاشة البداية",
  checkpointToast: "نقطة تفتيش — عند عربية الفول!",

  stageName: (n) => (n === 2 ? "المرحلة ٢ — فناء السجن" : "المرحلة ١ — العنبر"),
};

const EASTERN_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

export function eastern(value) {
  return String(value)
    .split("")
    .map((ch) => (ch >= "0" && ch <= "9" ? EASTERN_DIGITS[ch.charCodeAt(0) - 48] : ch))
    .join("");
}

export function easternCount(value) {
  return "×" + eastern(value);
}
