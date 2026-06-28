export * from "./types";
export { parse, normalize } from "./parser";
export { generate, defaultStyle, QUALITY_TAGS } from "./generator";
export { defaultNegative } from "./negative";

import { parse } from "./parser";
import { generate } from "./generator";
import type { GenerateOptions, GeneratedPrompt } from "./types";

/** One-shot convenience: paragraph -> generated prompt. */
export function convert(input: string, opts: GenerateOptions): GeneratedPrompt {
  return generate(parse(input), opts);
}
