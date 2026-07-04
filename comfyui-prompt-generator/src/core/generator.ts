import type {
  Category,
  GeneratedPrompt,
  GenerateOptions,
  OutputStyle,
  ParsedPrompt,
  Tag,
  TargetModel,
} from "./types";
import { CATEGORY_ORDER } from "./types";
import { buildNegative } from "./negative";

/** Subject words that indicate a person, for scene-aware negatives. */
const PERSON_WORDS = new Set([
  "man", "woman", "girl", "boy", "person", "child", "baby", "lady",
  "warrior", "knight", "wizard", "witch", "king", "queen", "princess",
  "samurai", "ninja", "astronaut", "soldier", "elf", "angel", "mermaid",
]);

/** Quality booster tags by target. */
const QUALITY_TAGS: Record<TargetModel, string[]> = {
  qwen: [], // qwen prefers descriptive prose, not booster tokens
  qwenTurbo: [],
  ltx: [], // video guides warn extra keywords dilute motion coherence
  flux: [],
  sdxl: ["masterpiece", "best quality", "highly detailed"],
  sd15: ["masterpiece", "best quality", "highly detailed", "8k"],
  pony: ["score_9", "score_8_up", "score_7_up", "masterpiece", "best quality"],
  illustrious: ["masterpiece", "best quality", "very aesthetic", "absurdres"],
};

/** Targets that share Qwen-Image's structured-label prompting. */
const QWEN_FAMILY: ReadonlySet<TargetModel> = new Set(["qwen", "qwenTurbo"]);

/** Generic person words made redundant in tag output once a count tag exists. */
const GENERIC_PERSON = new Set(["man", "woman", "girl", "boy", "person", "lady"]);

/**
 * Official Qwen-Image "positive magic" suffix (English) from QwenLM/Qwen-Image
 * prompt_utils.py — appended to lift quality when boosters are enabled.
 */
const QWEN_POSITIVE_MAGIC = ["Ultra HD", "4K", "cinematic composition"];

function defaultStyle(target: TargetModel): OutputStyle {
  // Qwen (and its Turbo LoRA) were trained on structured label data ->
  // labeled categories win. Flux and LTX video want flowing natural language.
  // Everyone else: tags.
  if (QWEN_FAMILY.has(target)) return "structured";
  if (target === "flux" || target === "ltx") return "natural";
  return "tags";
}

/** Number words for humanizing booru count tokens in prose/structured output. */
const NUMBER_WORDS = ["", "one", "two", "three", "four", "five", "six"];

/**
 * Convert booru count tokens (1girl/2girls/solo/...) into natural phrases for
 * non-tag output. Singular tokens are dropped (the subject noun covers them);
 * plurals and groups become "two women", "group of people", etc.
 */
function humanizeCounts(tokens: string[]): string[] {
  const out: string[] = [];
  for (const tok of tokens) {
    if (tok === "multiple people") out.push("group of people");
    const m = tok.match(/^(\d+)(girls|boys)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      const noun = m[2] === "girls" ? "women" : "men";
      out.push(`${NUMBER_WORDS[n] ?? n} ${noun}`);
    }
    // 1girl / 1boy / solo are intentionally dropped for prose/structured.
  }
  return out;
}

/** Group tags by category preserving discovery order within a group. */
function group(tags: Tag[]): Map<Category, Tag[]> {
  const m = new Map<Category, Tag[]>();
  for (const cat of CATEGORY_ORDER) m.set(cat, []);
  for (const t of tags) m.get(t.category)!.push(t);
  return m;
}

/** Order tags by category priority (declaration order in CATEGORY_ORDER). */
function ordered(tags: Tag[]): Tag[] {
  const g = group(tags);
  const out: Tag[] = [];
  for (const cat of CATEGORY_ORDER) out.push(...g.get(cat)!);
  return out;
}

/** Render a tag with optional ComfyUI weight syntax. */
function renderTag(t: Tag): string {
  if (t.weight && t.weight !== 1) {
    return `(${t.text}:${t.weight.toFixed(2)})`;
  }
  return t.text;
}

function joinNatural(parts: string[]): string {
  const clean = parts.filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  return clean.slice(0, -1).join(", ") + " and " + clean[clean.length - 1];
}

/** Composition tags that read as "{framing} of a {subject}". */
const FRAMING = new Set([
  "close-up",
  "extreme close-up",
  "portrait",
  "full body",
  "upper body",
  "wide shot",
  "wide angle",
  "from above",
  "from below",
  "dutch angle",
  "silhouette",
]);

/**
 * Compose a flowing natural-language prompt from parsed tags, ordered the way
 * Qwen-Image / Flux respond best: medium -> composition+subject -> details ->
 * clothing -> action -> setting -> lighting -> mood -> quality.
 */
function composeProse(tags: Tag[], opts: GenerateOptions): string {
  const g = group(tags);
  const txt = (cat: Category) => g.get(cat)!.map((t) => t.text);

  const segments: string[] = [];

  // --- Medium / style opener ---
  const colors = txt("color");
  const styles = txt("style");
  const medium = [...colors, ...styles];
  const opener = medium.length ? `A ${medium.join(", ")}` : "A highly detailed image";

  // --- Subject phrase ---
  const comp = txt("composition");
  const framing = comp.filter((c) => FRAMING.has(c));
  const effects = comp.filter((c) => !FRAMING.has(c));
  const count = humanizeCounts(txt("subjectCount"));
  const subjects = txt("subject");
  const appearance = txt("appearance");

  const hasSubject = subjects.length > 0 || count.length > 0;
  if (hasSubject) {
    const subjectCore = subjects.length ? joinNatural(subjects) : joinNatural(count);
    const compPrefix = framing.length ? `${joinNatural(framing)} of ` : "of ";
    let subjectPhrase = `${compPrefix}a ${subjectCore}`;
    if (appearance.length) subjectPhrase += ` with ${joinNatural(appearance)}`;
    segments.push(`${opener} ${subjectPhrase}`);
  } else {
    // Subject-less scene: lead with the medium, let the environment carry it.
    const scene = medium.length ? `A ${medium.join(", ")} scene` : "A highly detailed scene";
    const lead = framing.length ? `${scene}, ${joinNatural(framing)}` : scene;
    segments.push(lead);
  }

  // --- Clothing ---
  const clothing = txt("clothing");
  if (clothing.length) segments.push(`wearing ${joinNatural(clothing)}`);

  // --- Expression + pose ---
  const action = [...txt("expression"), ...txt("pose")];
  if (action.length) segments.push(joinNatural(action));

  // --- Mature / horror content (opt-in) ---
  const content = txt("nsfw");
  if (content.length) segments.push(joinNatural(content));

  // --- Setting + time/weather ---
  const place = txt("setting");
  const tw = txt("timeWeather");
  if (place.length || tw.length) {
    let s = "";
    if (place.length) s += `in a ${joinNatural(place)}`;
    if (tw.length) s += `${place.length ? ", " : ""}${joinNatural(tw)}`;
    segments.push(s.trim());
  }

  // --- Lighting + composition effects (depth of field, bokeh, ...) ---
  const light = [...txt("lighting"), ...effects];
  if (light.length) segments.push(joinNatural(light));

  // --- Material / texture ---
  const materials = txt("material");
  if (materials.length) segments.push(joinNatural(materials));

  // --- Camera / lens / technique ---
  const cam = txt("camera");
  if (cam.length) segments.push(joinNatural(cam));

  // --- Mood ---
  const mood = txt("mood");
  if (mood.length) segments.push(`${joinNatural(mood)}`);

  // --- Literal text to render (Qwen) ---
  const literal = txt("text");
  if (literal.length) segments.push(`with the text ${joinNatural(literal)}`);

  let sentence = segments.filter(Boolean).join(", ");
  sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
  if (!/[.!?]$/.test(sentence)) sentence += ".";

  // --- Camera movement, if the user described any ---
  const movement = txt("motion");
  if (movement.length) {
    sentence += ` The camera movement is a ${joinNatural(movement)}.`;
  }

  // --- Quality framing (only when explicitly requested) ---
  if (opts.addQualityTags) {
    const magic = QWEN_FAMILY.has(opts.target)
      ? QWEN_POSITIVE_MAGIC.join(", ")
      : "highly detailed, sharp focus, professional quality";
    sentence += ` ${magic.charAt(0).toUpperCase() + magic.slice(1)}.`;
  }

  return sentence;
}

// ---------------------------------------------------------------------------
// LTX-2.3 video composer: real cinematography prose. LTX wants a physically
// plausible scene unfolding over time in present tense — "A young woman stands
// at the cliff edge. She raises her hands. The camera slowly pulls back." —
// so this composer builds sentences with a pronoun, present-tense verbs, and
// an explicit camera-movement sentence (LTX invents motion when unconstrained).
// ---------------------------------------------------------------------------

const FEMALE_WORDS = /\b(woman|girl|lady|witch|queen|princess|mermaid)\b/;
const MALE_WORDS = /\b(man|boy|guy|king|wizard|samurai)\b/;
const CREATURE_WORDS =
  /\b(monster|creature|beast|dragon|robot|android|alien|zombie|demon|kaiju|mutant|wraith|werewolf|xenomorph)\b/;

/**
 * Merge separate hair tags into one phrase for prose: ["long hair",
 * "black hair"] -> ["long black hair"]. Other appearance tags pass through.
 */
function mergeHair(appearance: string[]): string[] {
  const hair = appearance.filter((a) => a.endsWith(" hair"));
  if (hair.length < 2) return appearance;
  const rest = appearance.filter((a) => !a.endsWith(" hair"));
  const descriptors = hair.map((h) => h.slice(0, -5));
  return [`${descriptors.join(" ")} hair`, ...rest];
}

function pronounFor(subjects: string[]): string {
  const joined = subjects.join(" ").toLowerCase();
  if (FEMALE_WORDS.test(joined)) return "She";
  if (MALE_WORDS.test(joined)) return "He";
  if (CREATURE_WORDS.test(joined)) return "It";
  return "They";
}

/** Gerund pose/expression tag -> third-person present-tense clause. */
const PRESENT_TENSE: Record<string, string> = {
  standing: "stands",
  sitting: "sits",
  "lying down": "lies down",
  kneeling: "kneels",
  crouching: "crouches",
  running: "runs",
  walking: "walks",
  jumping: "jumps",
  dancing: "dances",
  flying: "flies",
  fighting: "fights",
  leaning: "leans",
  "crossed arms": "crosses their arms",
  "hands on hips": "rests their hands on their hips",
  "looking back": "looks back over their shoulder",
  "looking at viewer": "looks directly into the camera",
  "looking away": "looks away",
  smiling: "smiles",
  laughing: "laughs",
  crying: "cries",
  grin: "grins",
  blush: "blushes",
  wink: "winks",
  frown: "frowns",
  lurking: "lurks",
  stalking: "stalks forward",
  crawling: "crawls",
  emerging: "emerges",
  screaming: "screams",
  roaring: "roars",
  snarling: "snarls",
  writhing: "writhes",
  "turning around": "turns around",
  "walking toward the camera": "walks toward the camera",
};

function presentTense(tag: string): string {
  return PRESENT_TENSE[tag] ?? `is ${tag}`;
}

/** Motion tag (noun phrase) -> "The camera ..." verb clause. */
const CAMERA_VERBS: Record<string, string> = {
  "slow dolly in": "slowly dollies in",
  "slow push in": "slowly pushes in",
  "slow dolly out": "slowly dollies out",
  "slow pull back": "slowly pulls back to reveal the scene",
  "slow zoom in": "slowly zooms in",
  "slow zoom out": "slowly zooms out",
  "pan left": "pans left",
  "pan right": "pans right",
  "slow pan": "pans slowly across the scene",
  "tilt up": "tilts up",
  "tilt down": "tilts down",
  "tracking shot": "tracks alongside the subject",
  "handheld camera": "is handheld, following the action with slight natural shake",
  "orbiting shot": "orbits the subject",
  "crane shot": "cranes upward",
  "whip pan": "whip-pans",
  "rack focus": "racks focus between foreground and background",
  "over-the-shoulder shot": "holds an over-the-shoulder view",
  "POV shot": "shows the subject's point of view",
  "FPV drone shot": "flies through the scene like an FPV drone",
  "static camera": "remains locked off and static",
  "follow shot": "follows the subject",
};

/** Motion tags that describe time, not the camera. */
const TEMPORAL_MOTION: Record<string, string> = {
  "slow motion": "The scene plays out in slow motion.",
  "time-lapse": "The scene unfolds as a time-lapse.",
};

function composeVideoProse(tags: Tag[], opts: GenerateOptions): string {
  const g = group(tags);
  const txt = (cat: Category) => g.get(cat)!.map((t) => t.text);

  const sentences: string[] = [];

  const subjects = txt("subject");
  const counts = humanizeCounts(txt("subjectCount"));
  const content = txt("nsfw");
  const appearance = mergeHair(txt("appearance"));
  const clothing = txt("clothing");
  const setting = txt("setting");
  const tw = txt("timeWeather");
  const poses = txt("pose");
  const expressions = txt("expression");

  // --- Sentence 1: scene anchor with the first action as the main verb ---
  // Creature/horror content can carry the scene when no plain subject exists:
  // noun-like content ("creature", "monster") becomes the head, the rest of
  // the content tags become its modifiers ("grotesque, biomechanical creature").
  const contentNouns = content.filter((c) => CREATURE_WORDS.test(c));
  const contentMods = content.filter((c) => !CREATURE_WORDS.test(c));
  let usedContent: string[] = [];
  let subjectCore = "";
  if (subjects.length) {
    subjectCore = joinNatural(subjects);
  } else if (contentNouns.length) {
    subjectCore = contentMods.length
      ? `${contentMods.join(", ")} ${contentNouns[0]}`
      : contentNouns[0];
    usedContent = [...contentMods, contentNouns[0]];
  } else if (content.length) {
    subjectCore = joinNatural(content.slice(0, 2));
    usedContent = content.slice(0, 2);
  } else if (counts.length) {
    subjectCore = joinNatural(counts);
  }
  const mainVerb = poses.length ? presentTense(poses[0]) : subjectCore ? "is seen" : "";

  let anchor: string;
  if (subjectCore) {
    anchor = `A ${subjectCore}`;
    if (appearance.length) anchor += ` with ${joinNatural(appearance)}`;
    if (clothing.length) anchor += `, wearing ${joinNatural(clothing)},`;
    anchor += ` ${mainVerb}`;
    if (setting.length) anchor += ` in a ${joinNatural(setting)}`;
    if (tw.length) anchor += `, ${joinNatural(tw)}`;
  } else {
    anchor = `A ${joinNatural(setting.length ? setting : ["scene"])}`;
    if (tw.length) anchor += `, ${joinNatural(tw)}`;
  }
  sentences.push(anchor.trim() + ".");

  // --- Sentence 2: remaining actions + expressions, present tense ---
  const pronoun = pronounFor([...subjects, ...content]);
  const extraActions = poses.slice(1).map(presentTense);
  const exprClauses = expressions.map(presentTense);
  const actions = [...extraActions, ...exprClauses];
  if (actions.length) sentences.push(`${pronoun} ${joinNatural(actions)}.`);

  // --- Horror/creature detail not used as the subject ---
  const contentRest = content.filter((c) => !usedContent.includes(c));
  if (contentRest.length) sentences.push(`The scene shows ${joinNatural(contentRest)}.`);

  // --- Sentence 3: camera — framing start + movement verb(s) ---
  const comp = txt("composition");
  const framing = comp.filter((c) => FRAMING.has(c));
  const movement = txt("motion");
  const cameraMoves = movement.filter((m) => !(m in TEMPORAL_MOTION));
  const temporal = movement.filter((m) => m in TEMPORAL_MOTION);

  let camera = "The camera";
  if (framing.length) camera += ` starts in a ${framing[0]} and`;
  camera += cameraMoves.length
    ? ` ${joinNatural(cameraMoves.map((m) => CAMERA_VERBS[m] ?? m))}`
    : " slowly pushes in"; // LTX invents motion when unconstrained; anchor it.
  sentences.push(camera + ".");
  for (const t of temporal) sentences.push(TEMPORAL_MOTION[t]);

  // --- Sentence 4: lighting, materials, mood ---
  const light = [...txt("lighting"), ...comp.filter((c) => !FRAMING.has(c))];
  const materials = txt("material");
  const mood = txt("mood");
  const atmoParts: string[] = [];
  if (light.length) atmoParts.push(`lit by ${joinNatural(light)}`);
  if (materials.length) atmoParts.push(`with ${joinNatural(materials)}`);
  if (mood.length) atmoParts.push(`the mood is ${joinNatural(mood)}`);
  if (atmoParts.length) {
    const atmo = atmoParts.join(", ");
    sentences.push(atmo.charAt(0).toUpperCase() + atmo.slice(1) + ".");
  }

  // --- Style + optional quality guardrails ---
  const styleParts = [...txt("style"), ...txt("color")];
  if (styleParts.length) sentences.push(`${joinNatural(styleParts).replace(/^./, (c) => c.toUpperCase())} style.`);
  if (opts.addQualityTags) sentences.push("Cinematic, natural motion, coherent physics.");

  return sentences.join(" ");
}

/** Labeled-category layout for structured (Qwen) output. */
// Order follows the Qwen-Image guide's priority: Subject -> Pose -> Clothing
// -> Camera -> Environment -> Lighting -> Mood -> Style -> Text.
const STRUCTURED_LAYOUT: { label: string; cats: Category[] }[] = [
  { label: "Subject", cats: ["subjectCount", "subject", "appearance"] },
  { label: "Pose", cats: ["expression", "pose"] },
  { label: "Clothing", cats: ["clothing"] },
  { label: "Camera", cats: ["composition", "camera"] },
  { label: "Motion", cats: ["motion"] },
  { label: "Environment", cats: ["setting", "timeWeather"] },
  { label: "Lighting", cats: ["lighting"] },
  { label: "Mood", cats: ["mood"] },
  { label: "Material", cats: ["material"] },
  { label: "Style", cats: ["style", "color"] },
  { label: "Content", cats: ["nsfw"] },
  { label: "Text", cats: ["text"] },
];

/**
 * Compose a labeled, structured prompt. Qwen-Image was trained on structured
 * label data and follows this far more precisely than flowing prose.
 */
function composeStructured(tags: Tag[], opts: GenerateOptions): string {
  const g = group(tags);
  const lines: string[] = [];

  for (const { label, cats } of STRUCTURED_LAYOUT) {
    const vals: string[] = [];
    for (const c of cats) {
      const texts = g.get(c)!.map((t) => t.text);
      vals.push(...(c === "subjectCount" ? humanizeCounts(texts) : texts));
    }
    if (label === "Style" && opts.addQualityTags && QWEN_FAMILY.has(opts.target)) {
      vals.push(...QWEN_POSITIVE_MAGIC);
    }
    if (vals.length) lines.push(`${label}: ${vals.join(", ")}`);
  }

  return lines.join("\n");
}

/** Render the positive prompt as comma-separated tags in canonical order. */
function composeTags(tags: Tag[], opts: GenerateOptions): string {
  const hasCount = tags.some((t) => t.category === "subjectCount");
  let ord = ordered(
    hasCount
      ? tags.filter((t) => !(t.category === "subject" && GENERIC_PERSON.has(t.text)))
      : tags,
  );

  if (opts.emphasizeSubject && opts.emphasizeSubject !== 1) {
    ord = ord.map((t) =>
      t.category === "subject" || t.category === "subjectCount"
        ? { ...t, weight: opts.emphasizeSubject }
        : t,
    );
  }

  const parts = ord.map(renderTag);

  if (opts.addQualityTags) {
    parts.unshift(...QUALITY_TAGS[opts.target]);
  }

  // Dedupe while preserving order (quality tags may overlap nothing, but be safe).
  const seen = new Set<string>();
  const deduped = parts.filter((p) => {
    const k = p.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return deduped.join(", ");
}

/** Generate positive + negative prompts from parsed input. */
export function generate(parsed: ParsedPrompt, opts: GenerateOptions): GeneratedPrompt {
  const styleUsed = opts.style ?? defaultStyle(opts.target);
  const ord = ordered(parsed.tags);

  const positive =
    styleUsed === "structured"
      ? composeStructured(parsed.tags, opts)
      : styleUsed === "natural"
        ? opts.target === "ltx"
          ? composeVideoProse(parsed.tags, opts)
          : composeProse(parsed.tags, opts)
        : composeTags(parsed.tags, opts);

  const hasPerson =
    parsed.tags.some((t) => t.category === "subjectCount") ||
    parsed.tags.some((t) => t.category === "subject" && PERSON_WORDS.has(t.text));
  const hasText = parsed.tags.some((t) => t.category === "text");
  const negative = opts.includeNegative
    ? buildNegative(opts.target, { hasPerson, hasText }, opts.extraNegative ?? [])
    : "";

  return { positive, negative, orderedTags: ord, styleUsed };
}

/** Convenience helper: parse-free generation isn't possible, but expose defaults. */
export { defaultStyle, QUALITY_TAGS };
