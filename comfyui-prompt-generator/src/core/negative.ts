import type { TargetModel } from "./types";

const COMMON = [
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

/**
 * Default negative prompt for a target model.
 *
 * Note: for the Qwen-Image turbo workflow (cfg 1.0 + ConditioningZeroOut on the
 * negative branch) the negative prompt has NO effect, so an empty string is the
 * honest default. Same reasoning applies to Flux at low/distilled guidance.
 */
export function defaultNegative(target: TargetModel, extra: string[] = []): string {
  let base: string[];
  switch (target) {
    case "qwen":
    case "flux":
      base = []; // inert in these workflows
      break;
    case "pony":
    case "illustrious":
      base = [...ANIME_SCORE, ...COMMON];
      break;
    default:
      base = COMMON;
  }
  return [...base, ...extra].join(", ");
}
