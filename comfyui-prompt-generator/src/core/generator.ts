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
import { defaultNegative } from "./negative";

/** Quality booster tags by target. */
const QUALITY_TAGS: Record<TargetModel, string[]> = {
  qwen: [], // qwen prefers descriptive prose, not booster tokens
  flux: [],
  sdxl: ["masterpiece", "best quality", "highly detailed"],
  sd15: ["masterpiece", "best quality", "highly detailed", "8k"],
  pony: ["score_9", "score_8_up", "score_7_up", "masterpiece", "best quality"],
  illustrious: ["masterpiece", "best quality", "very aesthetic", "absurdres"],
};

/** Generic person words made redundant in tag output once a count tag exists. */
const GENERIC_PERSON = new Set(["man", "woman", "girl", "boy", "person", "lady"]);

/** Models whose natural default output style is prose. */
const NATURAL_BY_DEFAULT: ReadonlySet<TargetModel> = new Set(["qwen", "flux"]);

function defaultStyle(target: TargetModel): OutputStyle {
  return NATURAL_BY_DEFAULT.has(target) ? "natural" : "tags";
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
  const count = txt("subjectCount").filter((c) => /people|multiple/.test(c));
  const subjects = txt("subject");
  const appearance = txt("appearance");

  const subjectCore = subjects.length
    ? joinNatural(subjects)
    : count.length
      ? count[0]
      : "subject";
  const compPrefix = framing.length ? `${joinNatural(framing)} of ` : "of ";
  let subjectPhrase = `${compPrefix}a ${subjectCore}`;
  if (appearance.length) subjectPhrase += ` with ${joinNatural(appearance)}`;

  segments.push(`${opener} ${subjectPhrase}`);

  // --- Clothing ---
  const clothing = txt("clothing");
  if (clothing.length) segments.push(`wearing ${joinNatural(clothing)}`);

  // --- Expression + pose ---
  const action = [...txt("expression"), ...txt("pose")];
  if (action.length) segments.push(joinNatural(action));

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

  // --- Mood ---
  const mood = txt("mood");
  if (mood.length) segments.push(`${joinNatural(mood)}`);

  let sentence = segments.filter(Boolean).join(", ");
  sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);

  // --- Quality framing (only when explicitly requested) ---
  if (opts.addQualityTags) {
    sentence += opts.target === "qwen"
      ? ". Hyper-realistic, highly detailed, professional studio quality."
      : ". Highly detailed, sharp focus, professional quality.";
  } else if (!/[.!?]$/.test(sentence)) {
    sentence += ".";
  }

  return sentence;
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
    styleUsed === "natural"
      ? composeProse(parsed.tags, opts)
      : composeTags(parsed.tags, opts);

  const negative = opts.includeNegative
    ? defaultNegative(opts.target, opts.extraNegative ?? [])
    : "";

  return { positive, negative, orderedTags: ord, styleUsed };
}

/** Convenience helper: parse-free generation isn't possible, but expose defaults. */
export { defaultStyle, QUALITY_TAGS };
