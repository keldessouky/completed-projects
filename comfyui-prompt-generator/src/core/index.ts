export * from "./types";
export { parse, normalize } from "./parser";
export { generate, defaultStyle, QUALITY_TAGS } from "./generator";
export { defaultNegative, buildNegative } from "./negative";
export { suggest, currentToken } from "./autocomplete";
export type { Suggestion } from "./autocomplete";

import { parse } from "./parser";
import { generate } from "./generator";
import type { GenerateOptions, GeneratedPrompt } from "./types";

/** One-shot convenience: paragraph -> generated prompt. */
export function convert(input: string, opts: GenerateOptions): GeneratedPrompt {
  return generate(parse(input, { includeNsfw: opts.includeNsfw }), opts);
}
