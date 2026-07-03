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
  const fallback = opts.target === "ltx" ? "A cinematic shot" : "A highly detailed image";
  const opener = medium.length ? `A ${medium.join(", ")}` : fallback;

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

  // --- Camera movement (video models want it as its own explicit direction) ---
  const movement = txt("motion");
  if (movement.length) {
    sentence += ` The camera movement is a ${joinNatural(movement)}.`;
  } else if (opts.target === "ltx") {
    // LTX invents motion when unconstrained; anchor it explicitly.
    sentence += " The camera holds a steady, slow push in.";
  }

  // --- Quality framing (only when explicitly requested) ---
  if (opts.addQualityTags) {
    const magic = QWEN_FAMILY.has(opts.target)
      ? QWEN_POSITIVE_MAGIC.join(", ")
      : opts.target === "ltx"
        ? "Cinematic, natural motion, coherent physics"
        : "highly detailed, sharp focus, professional quality";
    sentence += ` ${magic.charAt(0).toUpperCase() + magic.slice(1)}.`;
  }

  return sentence;
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
        ? composeProse(parsed.tags, opts)
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
