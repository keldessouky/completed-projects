import "./style.css";
import { parse } from "./core/parser";
import { generate } from "./core/generator";
import { suggest, currentToken, type Suggestion } from "./core/autocomplete";
import type { GenerateOptions, OutputStyle, TargetModel } from "./core/types";

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found`);
  return el as T;
};

const input = $<HTMLTextAreaElement>("input");
const targetSel = $<HTMLSelectElement>("target");
const styleSel = $<HTMLSelectElement>("style");
const qualityChk = $<HTMLInputElement>("quality");
const negativeChk = $<HTMLInputElement>("negative");
const nsfwChk = $<HTMLInputElement>("nsfw");
const emphasisSel = $<HTMLSelectElement>("emphasis");
const acEl = $<HTMLUListElement>("ac");
const presetSel = $<HTMLSelectElement>("preset");
const positiveOut = $<HTMLPreElement>("positive");
const negativeOut = $<HTMLPreElement>("negative-out");
const negativeBlock = $<HTMLDivElement>("negative-block");
const chipsEl = $<HTMLDivElement>("chips");
const unmatchedEl = $<HTMLDivElement>("unmatched");
const workflowNote = $<HTMLParagraphElement>("workflow-note");

const NOTES: Partial<Record<TargetModel, string>> = {
  qwen:
    "Qwen-Image was trained on structured labels, so labeled categories beat " +
    "flowing prose. Keep it to ~1–3 sentences, put any literal text in " +
    'double quotes (e.g. a sign reading "OPEN"), and enable quality to append ' +
    "the official magic (Ultra HD, 4K, cinematic composition). In the Turbo " +
    "2-step workflow (cfg 1.0 + ConditioningZeroOut) the negative prompt is " +
    "inert, so it's off by default.",
  qwenTurbo:
    "Qwen-Image-2512 with the Wuli Turbo LoRA: same structured prompting as " +
    "Qwen-2512, sampled at 2 steps / cfg 1.0 (euler, simple). CFG-distillation " +
    "makes the negative prompt inert, so it's disabled here. LoRA scale sweet " +
    "spot: 0.8–1.2.",
  ltx:
    "LTX-2.3 wants cinematography prose: one flowing present-tense paragraph — " +
    "subject → action → camera movement → lighting. Name the camera move " +
    "explicitly (slow dolly in, handheld tracking); LTX invents motion when " +
    "unconstrained, so negatives matter more for video (official default " +
    "provided). Params: cfg 3.0–3.5, 20–30 steps iterating / 40+ final, " +
    "≤257 frames.",
  flux:
    "Flux understands natural language. Tag-dumping and quality boosters " +
    "actively degrade output, so they're suppressed here.",
  pony: "Pony models expect booru tags plus score_ tags (added as boosters).",
  illustrious: "Illustrious expects Danbooru-style tag ordering.",
  sd15: "SD 1.5 responds best to terse, comma-separated tags.",
  sdxl: "SDXL works with tags or natural language; tags shown by default.",
};

function currentOptions(): GenerateOptions {
  const target = targetSel.value as TargetModel;
  const style = styleSel.value as OutputStyle | "auto";
  const emphasis = parseFloat(emphasisSel.value);
  return {
    target,
    ...(style !== "auto" ? { style } : {}),
    addQualityTags: qualityChk.checked,
    includeNegative: negativeChk.checked,
    includeNsfw: nsfwChk.checked,
    ...(emphasis !== 1 ? { emphasizeSubject: emphasis } : {}),
  };
}

function render(): void {
  const opts = currentOptions();
  workflowNote.textContent = NOTES[opts.target] ?? "";

  const text = input.value.trim();
  if (!text) {
    positiveOut.textContent = "";
    negativeOut.textContent = "";
    negativeBlock.hidden = true;
    chipsEl.innerHTML = "";
    unmatchedEl.textContent = "";
    return;
  }

  const parsed = parse(text, { includeNsfw: opts.includeNsfw });
  const result = generate(parsed, opts);

  positiveOut.textContent = result.positive;

  if (result.negative) {
    negativeOut.textContent = result.negative;
    negativeBlock.hidden = false;
  } else {
    negativeBlock.hidden = true;
  }

  chipsEl.innerHTML = "";
  for (const tag of result.orderedTags) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.innerHTML = `<span class="cat">${tag.category}</span>${tag.text}`;
    chipsEl.appendChild(chip);
  }

  unmatchedEl.textContent = parsed.unmatched.length
    ? `Unrecognized words (left out of tags): ${parsed.unmatched.join(", ")}`
    : "";
}

// Copy buttons
document.querySelectorAll<HTMLButtonElement>(".copy-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const which = btn.dataset.copy;
    const el = which === "negative" ? negativeOut : positiveOut;
    try {
      await navigator.clipboard.writeText(el.textContent ?? "");
      btn.classList.add("copied");
      const original = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => {
        btn.classList.remove("copied");
        btn.textContent = original;
      }, 1200);
    } catch {
      btn.textContent = "Copy failed";
    }
  });
});

// ---------------------------------------------------------------------------
// Autocomplete controller
// ---------------------------------------------------------------------------
let acItems: Suggestion[] = [];
let acIndex = -1;

function closeAc(): void {
  acEl.hidden = true;
  acEl.innerHTML = "";
  acItems = [];
  acIndex = -1;
}

function renderAc(): void {
  acEl.innerHTML = "";
  acItems.forEach((s, i) => {
    const li = document.createElement("li");
    li.className = "ac-item" + (i === acIndex ? " active" : "");
    li.setAttribute("role", "option");
    li.innerHTML =
      `<span class="ac-cat${s.mature ? " mature" : ""}">${s.category}</span>` +
      `<span class="ac-val">${s.value}</span>` +
      (s.value !== s.tag ? `<span class="ac-tag">→ ${s.tag}</span>` : "");
    // Use mousedown so it fires before the textarea blur.
    li.addEventListener("mousedown", (e) => {
      e.preventDefault();
      accept(i);
    });
    acEl.appendChild(li);
  });
  acEl.hidden = acItems.length === 0;
}

function updateAc(): void {
  const caret = input.selectionStart ?? input.value.length;
  const { token } = currentToken(input.value, caret);
  if (token.length < 2) {
    closeAc();
    return;
  }
  acItems = suggest(token, { includeNsfw: nsfwChk.checked, limit: 8 });
  acIndex = acItems.length ? 0 : -1;
  renderAc();
}

function accept(i: number): void {
  const s = acItems[i];
  if (!s) return;
  const caret = input.selectionStart ?? input.value.length;
  const { start } = currentToken(input.value, caret);
  const before = input.value.slice(0, start);
  const after = input.value.slice(caret);
  const insert = s.value + (after.startsWith(" ") || after === "" ? "" : " ");
  input.value = before + insert + after;
  const newCaret = (before + insert).length;
  input.setSelectionRange(newCaret, newCaret);
  closeAc();
  input.focus();
  render();
}

input.addEventListener("keydown", (e) => {
  if (acEl.hidden || acItems.length === 0) return;
  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      acIndex = (acIndex + 1) % acItems.length;
      renderAc();
      break;
    case "ArrowUp":
      e.preventDefault();
      acIndex = (acIndex - 1 + acItems.length) % acItems.length;
      renderAc();
      break;
    case "Enter":
    case "Tab":
      if (acIndex >= 0) {
        e.preventDefault();
        accept(acIndex);
      }
      break;
    case "Escape":
      e.preventDefault();
      closeAc();
      break;
  }
});

// ---------------------------------------------------------------------------
// Presets: curated starting points tuned to the two primary models.
// ---------------------------------------------------------------------------
interface Preset {
  target: TargetModel;
  text: string;
  nsfw?: boolean;
  negative?: boolean;
}

const PRESETS: Record<string, Preset> = {
  "turbo-portrait": {
    target: "qwenTurbo",
    text:
      "Professional headshot of a 45-year-old executive with a confident " +
      "expression, wearing a navy blazer and white shirt, simple background, " +
      "soft studio lighting, photorealistic.",
  },
  "turbo-poster": {
    target: "qwenTurbo",
    text:
      'Event poster with the headline "Aurora Festival 2026", gradient ' +
      "background, minimalist, vibrant colors, high contrast.",
  },
  "turbo-product": {
    target: "qwenTurbo",
    text:
      "A perfume bottle of glass with amber liquid on marble, water droplets, " +
      "reflective, soft lighting, black background, macro lens, photorealistic.",
  },
  "ltx-street": {
    target: "ltx",
    text:
      "A young woman with long black hair wearing a leather jacket walking " +
      "through a neon-lit city street at night, rain, wet pavement, tracking " +
      "shot, cinematic, moody.",
    negative: true,
  },
  "ltx-nature": {
    target: "ltx",
    text:
      "A misty forest at dawn with a waterfall, sunlight through the canopy, " +
      "slow pull back, serene, cinematic.",
    negative: true,
  },
  "ltx-horror": {
    target: "ltx",
    text:
      "A grotesque biomechanical creature crouching in a derelict spaceship " +
      "corridor, slime, wet, fog, eerie, dramatic shadows, slow dolly in, " +
      "handheld, cinematic horror.",
    nsfw: true,
    negative: true,
  },
};

presetSel.addEventListener("change", () => {
  const p = PRESETS[presetSel.value];
  presetSel.value = "";
  if (!p) return;
  input.value = p.text;
  targetSel.value = p.target;
  if (p.nsfw) nsfwChk.checked = true;
  if (p.negative !== undefined) negativeChk.checked = p.negative;
  render();
  saveState();
});

// ---------------------------------------------------------------------------
// Persistence: keep the draft and settings across page reloads.
// ---------------------------------------------------------------------------
const STORAGE_KEY = "comfyui-prompt-generator/v1";

interface SavedState {
  text: string;
  target: string;
  style: string;
  quality: boolean;
  negative: boolean;
  nsfw: boolean;
  emphasis: string;
}

function saveState(): void {
  const state: SavedState = {
    text: input.value,
    target: targetSel.value,
    style: styleSel.value,
    quality: qualityChk.checked,
    negative: negativeChk.checked,
    nsfw: nsfwChk.checked,
    emphasis: emphasisSel.value,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage may be unavailable (private mode, quota) — persistence is best-effort.
  }
}

function restoreState(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw) as Partial<SavedState>;
    if (typeof s.text === "string") input.value = s.text;
    if (typeof s.target === "string" && [...targetSel.options].some((o) => o.value === s.target)) {
      targetSel.value = s.target;
    }
    if (typeof s.style === "string" && [...styleSel.options].some((o) => o.value === s.style)) {
      styleSel.value = s.style;
    }
    if (typeof s.quality === "boolean") qualityChk.checked = s.quality;
    if (typeof s.negative === "boolean") negativeChk.checked = s.negative;
    if (typeof s.nsfw === "boolean") nsfwChk.checked = s.nsfw;
    if (typeof s.emphasis === "string") emphasisSel.value = s.emphasis;
    return typeof s.text === "string";
  } catch {
    return false;
  }
}

input.addEventListener("input", () => {
  render();
  updateAc();
  saveState();
});
input.addEventListener("click", updateAc);
input.addEventListener("blur", () => setTimeout(closeAc, 120));

for (const el of [targetSel, styleSel, qualityChk, negativeChk, nsfwChk, emphasisSel]) {
  el.addEventListener("input", () => {
    render();
    saveState();
  });
}

// Restore the previous session; otherwise seed with a friendly example so the
// page isn't empty on first load.
if (!restoreState()) {
  input.value =
    "A young woman with long blonde hair stands in a rainy neon-lit city at " +
    "night, wearing a red leather jacket. The photo is cinematic and moody " +
    "with shallow depth of field, photorealistic.";
}
render();
