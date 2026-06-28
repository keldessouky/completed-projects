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
 * Standard Qwen-Image workflows (cfg ~4.5, many steps) benefit from a negative
 * prompt (~+15% satisfaction in community testing), so we provide one when
 * requested. NOTE: in the Turbo 2-step workflow (cfg 1.0 + ConditioningZeroOut
 * on the negative branch) the negative prompt is inert — hence it is OFF by
 * default for Qwen/Flux in the UI even though a sensible value exists here.
 */
export function defaultNegative(target: TargetModel, extra: string[] = []): string {
  let base: string[];
  switch (target) {
    case "pony":
    case "illustrious":
      base = [...ANIME_SCORE, ...COMMON];
      break;
    default:
      base = COMMON;
  }
  return [...base, ...extra].join(", ");
}
