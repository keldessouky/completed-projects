import "./style.css";
import { parse } from "./core/parser";
import { generate } from "./core/generator";
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
const emphasisSel = $<HTMLSelectElement>("emphasis");
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

  const parsed = parse(text);
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

for (const el of [input, targetSel, styleSel, qualityChk, negativeChk, emphasisSel]) {
  el.addEventListener("input", render);
}

// Seed with a friendly example so the page isn't empty on first load.
input.value =
  "A young woman with long blonde hair stands in a rainy neon-lit city at " +
  "night, wearing a red leather jacket. The photo is cinematic and moody " +
  "with shallow depth of field, photorealistic.";
render();
