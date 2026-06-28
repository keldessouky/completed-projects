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

input.addEventListener("input", () => {
  render();
  updateAc();
});
input.addEventListener("click", updateAc);
input.addEventListener("blur", () => setTimeout(closeAc, 120));

for (const el of [targetSel, styleSel, qualityChk, negativeChk, nsfwChk, emphasisSel]) {
  el.addEventListener("input", render);
}

// Seed with a friendly example so the page isn't empty on first load.
input.value =
  "A young woman with long blonde hair stands in a rainy neon-lit city at " +
  "night, wearing a red leather jacket. The photo is cinematic and moody " +
  "with shallow depth of field, photorealistic.";
render();
