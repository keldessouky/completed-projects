/**
 * Core type definitions for the ComfyUI prompt generator.
 *
 * The pipeline is: raw paragraph -> parse() -> ParsedPrompt -> generate() -> GeneratedPrompt
 */

/**
 * Semantic categories a fragment of the input can belong to.
 * The declaration order here is ALSO the canonical emission order, because
 * diffusion models weight earlier tokens more heavily. Keep them ordered
 * from "most important / most defining" to "least".
 */
export const CATEGORY_ORDER = [
  "quality",      // masterpiece, best quality (meta tags)
  "subjectCount", // 1girl, 2girls, 1boy, solo
  "subject",      // woman, man, dragon, robot + age/descriptor
  "appearance",   // hair, eyes, skin, body type
  "clothing",     // jacket, dress, armor
  "expression",   // smiling, angry, crying
  "pose",         // standing, sitting, running
  "composition",  // close-up, full body, from above, rule of thirds
  "camera",       // lens, focal length, film stock, long exposure, macro
  "motion",       // camera movement over time: dolly in, pan, tracking (video)
  "setting",      // forest, city, indoors
  "timeWeather",  // night, sunset, rain, snow
  "lighting",     // cinematic lighting, rim light, golden hour
  "mood",         // moody, serene, ominous
  "style",        // oil painting, anime, photorealistic
  "color",        // vibrant colors, monochrome, color scheme
  "material",     // chrome, glass, marble, velvet, iridescent
  "nsfw",         // mature / horror / gore / creature (opt-in only)
  "text",         // literal text to render, kept in quotes (Qwen strength)
  "extra",        // anything classified but uncategorized
] as const;

export type Category = (typeof CATEGORY_ORDER)[number];

/** A single normalized concept extracted from the input. */
export interface Tag {
  /** The canonical text emitted into the prompt (e.g. "long hair"). */
  text: string;
  category: Category;
  /**
   * Optional emphasis weight. When set and != 1, the generator wraps the tag
   * as `(text:weight)`. Undefined means "no explicit weight".
   */
  weight?: number;
  /** The original input fragment this tag was derived from (for debugging/UI). */
  source?: string;
}

/** Result of parsing a paragraph into structured concepts. */
export interface ParsedPrompt {
  tags: Tag[];
  /** Fragments that could not be confidently classified. */
  unmatched: string[];
}

/** Target model families. They differ in preferred prompt style. */
export type TargetModel =
  | "qwen"        // Qwen-Image-2512: structured labels (default)
  | "qwenTurbo"   // Qwen-2512 + Wuli Turbo LoRA: same prompting, negative inert
  | "ltx"         // LTX-2.3 video: cinematography prose with camera motion
  | "flux"        // natural language ONLY; tags/quality boosters hurt
  | "sdxl"        // tags work; natural language also fine
  | "sd15"        // tag-driven, terse
  | "pony"        // booru tags + score tags
  | "illustrious"; // booru tags (Danbooru ordering)

/**
 * Output formatting style.
 * - `tags`: comma-separated booru tags (SD/SDXL/Pony/Illustrious)
 * - `natural`: flowing descriptive sentence (Flux, official Qwen enhancer style)
 * - `structured`: labeled categories, e.g. "Subject: ...\nLighting: ..."
 *   (Qwen was trained on structured labels; best precision)
 */
export type OutputStyle = "tags" | "natural" | "structured";

export interface GenerateOptions {
  target: TargetModel;
  /**
   * Force an output style. If omitted, a sensible default is chosen from the
   * target model (flux -> natural, everything else -> tags).
   */
  style?: OutputStyle;
  /** Prepend quality booster tags. Ignored for natural-language output. */
  addQualityTags?: boolean;
  /** Emphasize the main subject with a weight, e.g. 1.2. 0/undefined disables. */
  emphasizeSubject?: number;
  /** Include a generated negative prompt. */
  includeNegative?: boolean;
  /** Extra negative tags to append to the preset. */
  extraNegative?: string[];
  /** Allow mature/horror/gore/creature vocabulary (opt-in). */
  includeNsfw?: boolean;
}

/** Options controlling how a paragraph is parsed. */
export interface ParseOptions {
  /** Recognize mature/horror/gore/creature vocabulary (opt-in). */
  includeNsfw?: boolean;
}

export interface GeneratedPrompt {
  positive: string;
  negative: string;
  /** The tags actually emitted, in order, for inspection in the UI. */
  orderedTags: Tag[];
  styleUsed: OutputStyle;
}
