import type { Category } from "./types";
import { LEXICON, NSFW_LEXICON, type Rule } from "./lexicon";

/** A single autocomplete suggestion. */
export interface Suggestion {
  /** The phrase inserted into the text when accepted. */
  value: string;
  /** The canonical tag this maps to (for display). */
  tag: string;
  category: Category;
  /** Whether this entry comes from the opt-in mature lexicon. */
  mature: boolean;
}

interface Entry extends Suggestion {
  /** Lowercased value for matching. */
  lc: string;
  /** Lowercased canonical tag, used as an alias for matching. */
  lcTag: string;
}

function buildEntries(ruleSet: Rule[], mature: boolean): Entry[] {
  return ruleSet.map((r) => ({
    value: r.keyword,
    tag: r.tag,
    category: r.category,
    mature,
    lc: r.keyword.toLowerCase(),
    lcTag: r.tag.toLowerCase(),
  }));
}

// Build once. Dedupe by value, preferring the entry whose value already equals
// its canonical tag (the "cleanest" phrasing).
const ALL: Entry[] = (() => {
  const merged = [...buildEntries(LEXICON, false), ...buildEntries(NSFW_LEXICON, true)];
  const byValue = new Map<string, Entry>();
  for (const e of merged) {
    const existing = byValue.get(e.lc);
    if (!existing || (e.value === e.tag && existing.value !== existing.tag)) {
      byValue.set(e.lc, e);
    }
  }
  return [...byValue.values()];
})();

/** True if `q` appears in `s` as an ordered subsequence (loose fuzzy match). */
function isSubsequence(q: string, s: string): boolean {
  let i = 0;
  for (let j = 0; j < s.length && i < q.length; j++) {
    if (s[j] === q[i]) i++;
  }
  return i === q.length;
}

/**
 * Score an entry against a query. Lower is better; -1 means "no match".
 * Tiers: exact(0) > prefix(1) > word-start(2) > substring(3) > subsequence(4).
 * Both the value and the canonical tag (alias) are considered.
 */
function score(q: string, e: Entry): number {
  let best = Infinity;
  for (const s of [e.lc, e.lcTag]) {
    if (s === q) best = Math.min(best, 0);
    else if (s.startsWith(q)) best = Math.min(best, 1);
    else if (s.split(/[\s-]+/).some((w) => w.startsWith(q))) best = Math.min(best, 2);
    else if (s.includes(q)) best = Math.min(best, 3);
    else if (q.length >= 3 && isSubsequence(q, s)) best = Math.min(best, 4);
  }
  return best === Infinity ? -1 : best;
}

export interface SuggestOptions {
  includeNsfw?: boolean;
  limit?: number;
}

/**
 * Return ranked suggestions for the current token. Pure and synchronous —
 * the dataset is small enough to scan on every keystroke in the browser.
 */
export function suggest(query: string, opts: SuggestOptions = {}): Suggestion[] {
  const q = query.trim().toLowerCase();
  if (q.length < 1) return [];
  const limit = opts.limit ?? 8;

  const scored: { e: Entry; s: number }[] = [];
  for (const e of ALL) {
    if (e.mature && !opts.includeNsfw) continue;
    const s = score(q, e);
    if (s >= 0) scored.push({ e, s });
  }

  scored.sort((a, b) => {
    if (a.s !== b.s) return a.s - b.s;
    if (a.e.value.length !== b.e.value.length) return a.e.value.length - b.e.value.length;
    return a.e.value.localeCompare(b.e.value);
  });

  return scored.slice(0, limit).map(({ e }) => ({
    value: e.value,
    tag: e.tag,
    category: e.category,
    mature: e.mature,
  }));
}

/**
 * Given the full textarea contents and the caret offset, return the token
 * currently being typed (the run of word characters immediately before the
 * caret, bounded by separators) plus its start index. Used to know what to
 * match and what span to replace on accept.
 */
export function currentToken(text: string, caret: number): { token: string; start: number } {
  let start = caret;
  while (start > 0 && !/[\s,.;:()\n\[\]"]/.test(text[start - 1])) {
    start--;
  }
  return { token: text.slice(start, caret), start };
}
