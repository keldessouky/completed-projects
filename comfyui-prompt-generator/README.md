# ComfyUI Prompt Generator

Convert a plain-English paragraph into an **optimized prompt for ComfyUI /
Stable Diffusion**. Type a description of the image you want; get back a prompt
structured the way diffusion models actually read it. Runs **entirely in the
browser** — no server, no API keys, nothing leaves your machine.

## Why

Different model families want different prompt shapes, and writing prompts well
is a skill. This tool encodes that knowledge:

| Target            | Output style        | Notes |
| ----------------- | ------------------- | ----- |
| **Qwen-Image**    | natural-language prose | Default. Tuned for the Qwen Turbo 2-step workflow. |
| **Flux**          | natural-language prose | Tags / quality boosters *hurt* Flux, so they're suppressed. |
| **SDXL**          | tags (or prose)     | Booru-style tags, attention-ordered. |
| **SD 1.5**        | tags                | Terse, comma-separated. |
| **Pony**          | booru + `score_` tags | Adds `score_9, score_8_up, …`. |
| **Illustrious**   | booru tags          | Danbooru-style ordering. |

### About the Qwen-Image Turbo workflow

The default target matches a common ComfyUI setup: `qwen_image` diffusion model
+ `qwen_2.5_vl_7b` text encoder + a **Turbo 2-step LoRA**, sampled at **cfg 1.0,
euler/simple, 2 steps**, with the negative branch routed through
`ConditioningZeroOut`.

Two consequences are baked into the generator:

1. **Prose, not tags.** Qwen-Image responds to rich descriptive sentences, so
   the converter emits flowing prose ordered *medium → composition → subject →
   details → clothing → action → setting → lighting → mood → quality*.
2. **No negative prompt.** With `cfg 1.0` and a zeroed-out negative branch, the
   negative prompt is mathematically inert — so it's empty by default for Qwen
   (and Flux). The toggle still exists for the other targets.

## How it works

```
paragraph ──▶ parse() ──▶ ParsedPrompt ──▶ generate() ──▶ { positive, negative }
              (lexicon +                    (tag composer
               composites)                  or prose composer)
```

- **`src/core/lexicon.ts`** — keyword → canonical-tag dictionaries grouped by
  semantic category (subject, appearance, clothing, pose, setting, lighting,
  style, …).
- **`src/core/parser.ts`** — normalizes text, runs the lexicon with whole-word
  matching, handles composites (`long blonde hair` → `long hair` + `blonde
  hair`), detects subject counts (`1girl`/`1boy`/`2girls`/`solo`), and removes
  subsumed tags (`woman` when `young woman` is present).
- **`src/core/generator.ts`** — orders tags by category priority (earlier tokens
  get more model attention) and renders either comma-separated tags (with
  optional `(subject:1.2)` weights and quality boosters) or natural-language
  prose.
- **`src/main.ts`** — the browser UI.

The core (`src/core`) is pure, dependency-free, and unit-tested, so it can be
reused outside the browser.

## Develop

```bash
npm install
npm run dev        # Vite dev server
npm test           # run the unit tests (vitest)
npm run build      # typecheck + production bundle to dist/
npm run preview    # serve the production build
```

## Example

> *A young woman with long blonde hair stands in a rainy neon-lit city at night,
> wearing a red leather jacket. The photo is cinematic and moody with shallow
> depth of field, photorealistic.*

**Qwen / Flux (prose):**
> A photorealistic, photograph of a young woman with long hair and blonde hair,
> wearing a leather jacket, in a city, night and rain, cinematic lighting and
> depth of field, moody atmosphere.

**SDXL (tags):**
> masterpiece, best quality, highly detailed, 1girl, solo, young woman, long
> hair, blonde hair, leather jacket, depth of field, city, night, rain,
> cinematic lighting, moody atmosphere, photorealistic, photograph

## Notes & limits

- The lexicon is hand-curated and won't recognize every word; unrecognized
  content words are surfaced in the UI so you can fold them in manually.
- Prose output is heuristic reconstruction from detected concepts — it nails
  ordering and coverage but may have minor article/grammar quirks you can tidy.
- Extending coverage is just adding entries to `src/core/lexicon.ts`.
