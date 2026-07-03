import type { ParsedPrompt, ParseOptions, Tag } from "./types";
import {
  LEXICON,
  NSFW_LEXICON,
  HAIR_COLORS,
  HAIR_LENGTHS,
  EYE_COLORS,
  PLURAL_SUBJECTS,
} from "./lexicon";

const CONTRACTIONS: Record<string, string> = {
  "won't": "will not",
  "can't": "cannot",
  "n't": " not",
  "'re": " are",
  "'s": " is",
  "'ll": " will",
  "'ve": " have",
  "'m": " am",
};

/** Lowercase, expand contractions, normalize whitespace and dashes. */
export function normalize(text: string): string {
  let out = text.toLowerCase();
  for (const [from, to] of Object.entries(CONTRACTIONS)) {
    out = out.split(from).join(to);
  }
  out = out
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return out;
}

/** Detect "long blonde hair" style phrases -> separate length & color tags. */
function extractHair(text: string, push: (t: Tag) => void): void {
  if (!/\bhair\b/.test(text)) return;
  for (const len of HAIR_LENGTHS) {
    const re = new RegExp(`\\b${len}\\b[^.,]*\\bhair\\b`, "i");
    if (re.test(text)) {
      push({ text: `${len} hair`, category: "appearance", source: `${len} hair` });
      break;
    }
  }
  for (const col of HAIR_COLORS) {
    const re = new RegExp(`\\b${col}\\b[^.,]*\\bhair\\b`, "i");
    if (re.test(text)) {
      const tag = col === "blond" ? "blonde hair" : `${col} hair`;
      push({ text: tag, category: "appearance", source: `${col} hair` });
    }
  }
}

/**
 * Detect age cues. Qwen-Image test cases lean heavily on explicit ages
 * ("45-year-old executive", "in their 70s"), which sharpen the subject.
 */
function extractAge(text: string, push: (t: Tag) => void): void {
  const exact = text.match(/\b(\d{1,3})[\s-]?year[\s-]?old\b/);
  if (exact) {
    push({ text: `${exact[1]}-year-old`, category: "subject", source: exact[0] });
    return;
  }
  const decade = text.match(/\bin (?:their|his|her) (\d0)s\b/);
  if (decade) {
    push({ text: `in their ${decade[1]}s`, category: "subject", source: decade[0] });
  }
}

/** Detect "blue eyes" style phrases. */
function extractEyes(text: string, push: (t: Tag) => void): void {
  if (!/\beyes?\b/.test(text)) return;
  for (const col of EYE_COLORS) {
    const re = new RegExp(`\\b${col}\\b\\s+eyes?\\b`, "i");
    if (re.test(text)) {
      const tag = col === "gold" ? "golden eyes" : `${col} eyes`;
      push({ text: tag, category: "appearance", source: `${col} eyes` });
    }
  }
}

/**
 * Detect subject count -> booru count tags (1girl/2girls/1boy/solo).
 * Only meaningful for tag-style models, but harmless to compute always.
 */
function extractSubjectCount(text: string, push: (t: Tag) => void): void {
  const wordNum: Record<string, number> = {
    a: 1, an: 1, one: 1, two: 2, three: 3, "a couple of": 2, several: 3,
  };

  // singular female
  const female = /\b(woman|girl|lady|she|her)\b/.test(text);
  const male = /\b(man|boy|guy|he|his|him)\b/.test(text);

  for (const [word, mapped] of Object.entries(PLURAL_SUBJECTS)) {
    if (new RegExp(`\\b${word}\\b`).test(text)) {
      // Try to find a leading count, default to 2 for plurals.
      let count = 2;
      const m = text.match(new RegExp(`\\b(\\w+)\\s+${word}\\b`));
      if (m && wordNum[m[1]]) count = wordNum[m[1]];
      if (mapped === "people") {
        push({ text: "multiple people", category: "subjectCount", source: word });
      } else {
        push({ text: `${count}${mapped}`, category: "subjectCount", source: word });
      }
      return;
    }
  }

  if (female && !male) {
    push({ text: "1girl", category: "subjectCount", source: "woman" });
    push({ text: "solo", category: "subjectCount", source: "solo subject" });
  } else if (male && !female) {
    push({ text: "1boy", category: "subjectCount", source: "man" });
    push({ text: "solo", category: "subjectCount", source: "solo subject" });
  } else if (female && male) {
    push({ text: "1girl", category: "subjectCount", source: "woman" });
    push({ text: "1boy", category: "subjectCount", source: "man" });
  }
}

/** True if `small` appears as a whole word inside the longer phrase `big`. */
function isWholeWordSubset(small: string, big: string): boolean {
  if (small === big || small.length >= big.length) return false;
  const escaped = small.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`, "i").test(big);
}

/**
 * Remove tags subsumed by a more specific one ("woman" when "young woman"
 * exists, "field" when "depth of field" exists). Generic-person vs count
 * dedup is left to the tag composer so prose output can still say "a man".
 */
function postProcess(tags: Tag[]): Tag[] {
  const kept = tags.filter(
    (t) => !tags.some((other) => isWholeWordSubset(t.text, other.text)),
  );
  // Stable-sort into text order so downstream composers see concepts in the
  // sequence the user wrote them (e.g. the first action becomes the main verb).
  return kept
    .map((t, i) => ({ t, i }))
    .sort((a, b) => (a.t.pos ?? -1) - (b.t.pos ?? -1) || a.i - b.i)
    .map(({ t }) => t);
}

/**
 * Parse a free-text paragraph into a structured set of canonical tags.
 * Order of discovery does not matter; the generator re-orders by category.
 */
export function parse(input: string, opts: ParseOptions = {}): ParsedPrompt {
  const text = normalize(input);
  const tags: Tag[] = [];
  const seen = new Set<string>();

  const push = (t: Tag) => {
    const key = t.text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    tags.push(t);
  };

  // Literal text to render: capture quoted segments from the RAW input so the
  // original casing is preserved. Qwen renders quoted text far more reliably.
  for (const m of input.matchAll(/["“”]([^"“”]{1,80}?)["“”]/g)) {
    const phrase = m[1].trim();
    if (phrase.length >= 2 && /[a-z0-9]/i.test(phrase)) {
      push({ text: `"${phrase}"`, category: "text", source: m[0] });
    }
  }

  extractSubjectCount(text, push);
  extractAge(text, push);
  extractHair(text, push);
  extractEyes(text, push);

  // Apply the keyword lexicon (already sorted longest-first). The mature lexicon
  // is only consulted when the caller explicitly opts in.
  const active = opts.includeNsfw ? [...LEXICON, ...NSFW_LEXICON] : LEXICON;
  for (const rule of active) {
    const m = rule.pattern.exec(text);
    if (m) {
      push({ text: rule.tag, category: rule.category, source: rule.tag, pos: m.index });
    }
  }

  const finalTags = postProcess(tags);

  // Best-effort collection of content words that matched nothing, for UI hints.
  const matchedWords = new Set<string>();
  const addWords = (s: string) => {
    for (const w of s.replace(/[^\w\s-]/g, " ").split(/\s+/)) {
      if (w) matchedWords.add(w.toLowerCase());
    }
  };
  for (const t of finalTags) {
    addWords(t.text);
    if (t.source) addWords(t.source);
  }
  const STOP = new Set([
    "a", "an", "the", "of", "with", "and", "or", "in", "on", "at", "to", "is",
    "are", "was", "were", "be", "as", "by", "for", "from", "that", "this",
    "his", "her", "their", "its", "it", "they", "he", "she", "wearing", "has",
    "have", "over", "under", "into", "very", "some", "more", "across", "while",
  ]);
  const unmatched: string[] = [];
  const seenUnmatched = new Set<string>();
  for (const raw of text.replace(/[^\w\s-]/g, " ").split(/\s+/)) {
    const w = raw.trim();
    if (!w || w.length < 3) continue;
    if (STOP.has(w) || matchedWords.has(w)) continue;
    if (seenUnmatched.has(w)) continue;
    seenUnmatched.add(w);
    unmatched.push(w);
  }

  return { tags: finalTags, unmatched };
}
