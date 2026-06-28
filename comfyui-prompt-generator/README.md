# ComfyUI Prompt Generator

Convert a plain-English paragraph into an **optimized prompt for ComfyUI /
Stable Diffusion**. Type a description of the image you want; get back a prompt
structured the way diffusion models actually read it. Runs **entirely in the
browser** — no server, no API keys, nothing leaves your machine.

## Why

Different model families want different prompt shapes, and writing prompts well
is a skill. This tool encodes that knowledge:

| Target            | Output style          | Notes |
| ----------------- | --------------------- | ----- |
| **Qwen-Image**    | structured labels     | Default. Labeled categories + official positive magic. |
| **Flux**          | natural-language prose | Tags / quality boosters *hurt* Flux, so they're suppressed. |
| **SDXL**          | tags (or prose)       | Booru-style tags, attention-ordered. |
| **SD 1.5**        | tags                  | Terse, comma-separated. |
| **Pony**          | booru + `score_` tags | Adds `score_9, score_8_up, …`. |
| **Illustrious**   | booru tags            | Danbooru-style ordering. |

Three output styles are available for any target: **structured** (labeled
categories), **natural** (one flowing sentence), and **tags** (comma-separated).

### Autocomplete

Start typing a concept and a ranked dropdown suggests recognized vocabulary;
accept with **↑/↓ + Enter/Tab** (or click). Matching is tiered the way booru
tag-complete tools work — exact → prefix → word-start → substring → fuzzy
subsequence — and each lexicon entry's canonical tag doubles as a searchable
**alias** (typing `cinematic` surfaces `cinematic lighting`). It's a pure,
synchronous scan of the in-memory lexicon (small enough to run on every
keystroke), implemented in `src/core/autocomplete.ts`.

### Categories

Every parameter the Qwen guide structures around has its own category, in
emission order: quality, subject count, subject (incl. age), appearance,
clothing, expression, pose, composition, **camera** (lens / focal length / film
stock / long exposure), setting, time & weather, lighting, mood, style,
**color** scheme, **material** (chrome, glass, marble, velvet…), and **text**.

### Mature / horror content (opt-in)

A **Mature / horror** toggle unlocks a separate, opt-in lexicon aimed at horror
comics and monster / sci-fi art — gore, body horror, creatures, undead,
eldritch / cosmic-horror vocabulary, plus a tasteful adult set. It's **off by
default**; when off, those words are simply not recognized. When on, they parse
into a `Content:` field (structured) or inline (tags), and the autocomplete
includes them. The negative-prompt builder also stays scene-aware.

### About Qwen-Image (and the Turbo 2-step workflow)

The default target matches a common ComfyUI setup: `qwen_image` diffusion model
+ `qwen_2.5_vl_7b` text encoder + a **Turbo 2-step LoRA**, sampled at **cfg 1.0,
euler/simple, 2 steps**, with the negative branch routed through
`ConditioningZeroOut`.

What the research says about prompting Qwen-Image — and how it's baked in:

1. **Structure beats narrative.** Qwen-Image was trained on *structured label
   data*, and categorized descriptions (Subject / Environment / Lighting / …)
   measurably outperform flowing prose. So the default output is labeled
   categories, not a paragraph. (A `natural` mode is still one click away.)
2. **Brevity wins.** ~1–3 sentences is the sweet spot; the converter keeps
   output tight rather than padding it.
3. **Quote literal text.** Qwen's headline strength is text rendering, and
   wrapping the exact words in double quotes lifts accuracy from ~65% → ~96%.
   Anything you put in `"quotes"` is captured (case preserved) into a `Text:`
   field.
4. **Official "positive magic".** Enabling *Quality boosters* appends Qwen's own
   suffix — `Ultra HD, 4K, cinematic composition` — taken from
   [QwenLM/Qwen-Image `prompt_utils.py`](https://github.com/QwenLM/Qwen-Image/blob/main/src/examples/tools/prompt_utils.py).
5. **Scene-aware negative prompt.** Standard Qwen workflows (cfg ~4.5, ~50
   steps) benefit from a negative prompt (~+15% satisfaction), so one is built
   on request from the guide's universal template *plus* scenario add-ons —
   portrait fixes (`deformed hands, smooth plastic skin`) when a person is
   detected, text fixes (`misspelled text, garbled letters`) when literal text
   is present. In *this* Turbo workflow (`cfg 1.0` + zeroed negative branch) it
   is mathematically inert — hence **off by default**.
6. **Priority order & ages.** Output follows the guide's category priority
   (Subject → Pose → Clothing → Camera → Environment → Lighting → Mood), and
   explicit ages ("45-year-old", "in their 70s") are captured into the subject,
   matching how the guide's test cases sharpen portraits.

#### Suggested parameters (standard, non-Turbo workflow)

From the guide's 100-generation sweep — your Turbo LoRA fixes these, but for a
normal Qwen graph: **CFG 4.0–5.0** is the sweet spot (creative art 3–4,
precision/product 5–7), **50 steps** is the cost-effective quality tier, and for
**text rendering** bump CFG to 6–7 and steps to 50.

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
  get more model attention) and renders one of three styles: **structured**
  labeled categories (Qwen default, with the official positive-magic suffix),
  **natural** prose (Flux), or comma-separated **tags** (with optional
  `(subject:1.2)` weights and quality boosters).
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

**Qwen-Image (structured, quality on):**
> ```
> Subject: young woman, long hair, blonde hair
> Clothing: leather jacket
> Camera: depth of field
> Environment: city, night, rain
> Lighting: cinematic lighting
> Mood: moody atmosphere
> Style: photorealistic, photograph, Ultra HD, 4K, cinematic composition
> ```

**Flux (natural):**
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
