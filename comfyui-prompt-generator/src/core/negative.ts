import type { TargetModel } from "./types";

/**
 * Universal negative template recommended by the Qwen-Image-2512 guide
 * (apiyi test-case study). Works for natural-language models.
 */
const UNIVERSAL = [
  "blurry",
  "low quality",
  "pixelated",
  "distorted",
  "watermark",
  "text overlay",
  "signature",
  "oversaturated",
  "artificial",
  "plastic-looking",
];

/** Scenario-specific add-ons from the same guide. */
const PORTRAIT = ["extra fingers", "deformed hands", "unnatural proportions", "smooth plastic skin"];
const TEXT = ["misspelled text", "garbled letters", "unreadable font"];

/** Booru-flavored negatives for tag models. */
const BOORU_COMMON = [
  "low quality",
  "worst quality",
  "blurry",
  "jpeg artifacts",
  "lowres",
  "bad anatomy",
  "bad hands",
  "extra fingers",
  "missing fingers",
  "extra limbs",
  "deformed",
  "disfigured",
  "mutated",
  "watermark",
  "signature",
  "text",
];

const ANIME_SCORE = ["score_6", "score_5", "score_4"];

/** Context used to tailor the negative prompt to the scene. */
export interface NegativeContext {
  hasPerson?: boolean;
  hasText?: boolean;
}

function dedupe(parts: string[]): string {
  const seen = new Set<string>();
  return parts
    .filter((p) => {
      const k = p.toLowerCase();
      if (!p || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .join(", ");
}

/**
 * Build a negative prompt tailored to the target model and scene.
 *
 * For natural-language models (Qwen/Flux) this assembles the guide's universal
 * template plus scenario add-ons (portrait fixes when a person is present, text
 * fixes when literal text is requested). Tag models get booru-style negatives.
 *
 * NOTE: in the Qwen Turbo 2-step workflow (cfg 1.0 + ConditioningZeroOut) the
 * negative prompt is inert; this is why the UI keeps it OFF by default there.
 */
export function buildNegative(
  target: TargetModel,
  ctx: NegativeContext = {},
  extra: string[] = [],
): string {
  let base: string[];
  switch (target) {
    case "pony":
    case "illustrious":
      base = [...ANIME_SCORE, ...BOORU_COMMON];
      break;
    case "sd15":
    case "sdxl":
      base = [...BOORU_COMMON];
      break;
    default: // qwen, flux
      base = [...UNIVERSAL];
      if (ctx.hasPerson) base.push(...PORTRAIT);
      if (ctx.hasText) base.push(...TEXT);
  }
  return dedupe([...base, ...extra]);
}

/** Back-compat: context-free default negative for a target. */
export function defaultNegative(target: TargetModel, extra: string[] = []): string {
  return buildNegative(target, {}, extra);
}
