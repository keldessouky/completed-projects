// Turns a card's rules text into the abilities this game can simulate.
//
// Magic has tens of thousands of distinct rules texts; no hand-written engine
// knows them all. This parser recognises the patterns that make up most of a
// typical deck — damage, removal, card draw, life, pump, counters, tokens,
// fights, auras, equipment, anthems, mana abilities and the common combat
// keywords — and reports everything else as "not simulated" so the player can
// see exactly what each card does in this game.
import type { Card, Color } from '../data/cards';
import { parseCost, type ManaCost, type ManaKind } from './mana';

// ---------------------------------------------------------------- targets

export type Who = 'you' | 'opp';

/** Restrictions such as "nonblack", "tapped", "with flying", "with power 3 or less". */
export interface Filter {
  tapped?: boolean;
  attacking?: boolean;
  blocking?: boolean;
  attackingOrBlocking?: boolean;
  notColor?: Color[];
  color?: Color[];
  flying?: boolean;
  noFlying?: boolean;
  powerMax?: number;
  powerMin?: number;
  mvMax?: number;
  mvMin?: number;
  nonToken?: boolean;
  another?: boolean;
}

export type TargetClass = 'any' | 'creature' | 'player' | 'permanent' | 'artifact' | 'enchantment' | 'artifact-enchantment' | 'land' | 'nonland' | 'creature-land';

export interface TargetSpec {
  sel: 'target';
  what: TargetClass;
  ctrl?: Who;
  filter?: Filter;
  optional?: boolean;
}

/** Who/what an effect touches: a chosen target, the card itself, or a fixed group. */
export type Target =
  | TargetSpec
  | { sel: 'self' }
  | { sel: 'you' }
  | { sel: 'each-opp' }
  | { sel: 'each-player' }
  | { sel: 'all-creatures'; ctrl?: Who; filter?: Filter; other?: boolean };

// ---------------------------------------------------------------- effects

export type Effect =
  | { k: 'damage'; n: number; to: Target[] }
  | { k: 'destroy'; to: Target; exile?: boolean }
  | { k: 'bounce'; to: Target }
  | { k: 'tap'; to: Target }
  | { k: 'untap'; to: Target }
  | { k: 'pump'; p: number; t: number; kw: string[]; to: Target }
  | { k: 'counters'; n: number; to: Target }
  | { k: 'draw'; n: number }
  | { k: 'gain'; n: number }
  | { k: 'lose'; n: number; who: Target }
  | { k: 'token'; count: number; p: number; t: number; name: string; colors: Color[]; kw: string[] }
  | { k: 'discard'; n: number; who: Target }
  | { k: 'self-discard'; n: number }
  | { k: 'fight'; a: Target; b: Target }
  /** Named counters on the card itself (burden, charge, …) and effects that count them. */
  | { k: 'named-counter'; name: string; n: number }
  | { k: 'draw-per-counter'; name: string }
  | { k: 'lose-per-counter'; name: string }
  /** "You gain protection from everything until your next turn." */
  | { k: 'protection' }
  /** Exile a permanent and return it at once (a "blink"): it comes back untapped, fresh, and its enters abilities fire again. */
  | { k: 'flicker'; to: Target };

export type Trigger = 'etb' | 'attack' | 'combat-damage' | 'dies' | 'upkeep' | 'end-step' | 'cast-noncreature' | 'cast-instant-sorcery';

export interface Activated {
  cost: ManaCost;
  tap: boolean;
  effects: Effect[];
  text: string;
}

export interface Abilities {
  keywords: Set<string>;
  /** What an instant or sorcery does (or each mode of a "Choose one —" spell). */
  spell: Effect[];
  modes: Effect[][];
  /** castOnly: "if you cast it" — doesn't happen when the permanent is blinked or put onto the battlefield. */
  triggers: { when: Trigger; effects: Effect[]; text: string; castOnly?: boolean }[];
  activated: Activated[];
  mana: { options: ManaKind[]; amount: number } | null;
  /** "Creatures you control get +1/+1" and friends. */
  anthem: { p: number; t: number; kw: string[]; other: boolean } | null;
  /** Auras and equipment: what they give the creature they're attached to. */
  attach: { kind: 'aura' | 'equipment'; p: number; t: number; kw: string[]; cantAttackOrBlock: boolean; doesntUntap: boolean; auraOnOpponent: boolean; equip?: ManaCost } | null;
  entersWithCounters: number;
  entersTapped: boolean;
  cantBlock: boolean;
  /** Lines of rules text the engine understood / skipped. */
  simulated: string[];
  unsupported: string[];
}

export const COMBAT_KEYWORDS = [
  'Flying', 'Reach', 'Haste', 'Vigilance', 'Trample', 'Lifelink', 'Deathtouch', 'First strike',
  'Double strike', 'Defender', 'Menace', 'Indestructible', 'Hexproof', 'Shroud', 'Flash', 'Prowess',
] as const;
const KW_LOWER = new Map(COMBAT_KEYWORDS.map((k) => [k.toLowerCase(), k] as const));

const NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};
const num = (s: string | undefined): number | null => {
  if (s === undefined) return null;
  if (/^\d+$/.test(s)) return Number(s);
  return NUMBERS[s] ?? null;
};
const COLOR_WORDS: Record<string, Color> = { white: 'W', blue: 'U', black: 'B', red: 'R', green: 'G' };

// ------------------------------------------------------------- text prep

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Lower-case, drop reminder text and quoted abilities, and write the card's own name as "~". */
export function normalise(card: Pick<Card, 'name' | 'text'>, text = card.text): string {
  let t = text.replace(/\([^)]*\)/g, '').replace(/"[^"]*"/g, '"…"');
  const names = [card.name];
  const short = card.name.split(',')[0];
  if (short !== card.name && short.length > 2) names.push(short);
  const firstWord = card.name.split(' ')[0];
  if (firstWord.length > 3 && firstWord !== card.name && /^[A-Z]/.test(firstWord)) names.push(firstWord);
  for (const n of names.sort((a, b) => b.length - a.length)) t = t.replace(new RegExp(`\\b${escapeRe(n)}\\b`, 'g'), '~');
  t = t.toLowerCase();
  t = t.replace(/\bthis (creature|artifact|enchantment|permanent|land|spell|vehicle|card)\b/g, '~');
  return t.replace(/[ \t]+/g, ' ').trim();
}

// -------------------------------------------------------- target phrases

function parseFilterWords(words: string, f: Filter): string {
  let w = ` ${words} `;
  const take = (re: RegExp, fn: (m: RegExpMatchArray) => void) => {
    const m = w.match(re);
    if (m) {
      fn(m);
      w = w.replace(re, ' ');
    }
  };
  take(/ another /, () => (f.another = true));
  take(/ other /, () => (f.another = true));
  take(/ attacking or blocking /, () => (f.attackingOrBlocking = true));
  take(/ attacking /, () => (f.attacking = true));
  take(/ blocking /, () => (f.blocking = true));
  take(/ untapped /, () => (f.tapped = false));
  take(/ tapped /, () => (f.tapped = true));
  take(/ nontoken /, () => (f.nonToken = true));
  for (const [word, c] of Object.entries(COLOR_WORDS)) {
    take(new RegExp(` non${word} `), () => (f.notColor = [...(f.notColor ?? []), c]));
    take(new RegExp(` ${word} `), () => (f.color = [...(f.color ?? []), c]));
  }
  return w.trim();
}

function parseTail(tail: string, spec: TargetSpec): boolean {
  let t = tail.trim();
  const f = (spec.filter ??= {});
  const rules: [RegExp, (m: RegExpMatchArray) => void][] = [
    [/^you control\b/, () => (spec.ctrl = 'you')],
    [/^(you don't control|an opponent controls|your opponents control)\b/, () => (spec.ctrl = 'opp')],
    [/^with flying\b/, () => (f.flying = true)],
    [/^without flying\b/, () => (f.noFlying = true)],
    [/^with power (\d+) or less\b/, (m) => (f.powerMax = Number(m[1]))],
    [/^with power (\d+) or greater\b/, (m) => (f.powerMin = Number(m[1]))],
    [/^with mana value (\d+) or less\b/, (m) => (f.mvMax = Number(m[1]))],
    [/^with mana value (\d+) or greater\b/, (m) => (f.mvMin = Number(m[1]))],
    [/^(and|,)\b/, () => {}],
  ];
  while (t) {
    const rule = rules.find(([re]) => re.test(t));
    if (!rule) return false;
    const m = t.match(rule[0])!;
    rule[1](m);
    t = t.slice(m[0].length).trim();
  }
  if (Object.keys(f).length === 0) delete spec.filter;
  return true;
}

/** "target nonblack creature an opponent controls" → a TargetSpec. Accepts "up to one target …". */
export function parseTarget(phrase: string): TargetSpec | null {
  let p = phrase.trim().replace(/[.,;]$/, '');
  let optional = false;
  const upTo = p.match(/^up to (one|two|three|\d+) /);
  if (upTo) {
    optional = true;
    p = p.slice(upTo[0].length);
  }
  const m = p.match(/^(another |other )?target (.*)$/);
  if (!m) return null;
  if (/\b(card|spell|ability|graveyard|library)\b/.test(m[2])) return null;
  const spec: TargetSpec = { sel: 'target', what: 'creature' };
  if (optional) spec.optional = true;
  const f: Filter = {};
  if (m[1]) f.another = true;
  const nouns: [RegExp, TargetClass, Who?][] = [
    [/\bcreature or player\b/, 'any'],
    [/\bany target\b/, 'any'],
    [/\b(creature or planeswalker|creatures?)\b/, 'creature'],
    [/\bartifact or enchantment\b/, 'artifact-enchantment'],
    [/\bartifact or creature\b/, 'creature'],
    [/\bartifact\b/, 'artifact'],
    [/\benchantment\b/, 'enchantment'],
    [/\bnonland permanent\b/, 'nonland'],
    [/\bpermanent\b/, 'permanent'],
    [/\bland\b/, 'land'],
    [/\b(player or planeswalker|player)\b/, 'player'],
    [/\b(opponent or planeswalker|opponent)\b/, 'player', 'opp'],
  ];
  for (const [re, what, who] of nouns) {
    const nm = m[2].match(re);
    if (!nm) continue;
    const before = m[2].slice(0, nm.index);
    const after = m[2].slice(nm.index! + nm[0].length);
    const leftover = parseFilterWords(before, f);
    if (leftover && !/^(non-?land|nonartifact|noncreature)$/.test(leftover)) return null;
    spec.what = what;
    if (who) spec.ctrl = who;
    if (Object.keys(f).length) spec.filter = f;
    if (!parseTail(after, spec)) return null;
    return spec;
  }
  return null;
}

/** "each opponent", "each creature you don't control", "target creature", "~", "you" … */
function parseRecipient(phrase: string): Target | null {
  const p = phrase.trim().replace(/[.,;]$/, '');
  if (p === 'any target') return { sel: 'target', what: 'any' };
  if (p === '~' || p === 'it') return { sel: 'self' };
  if (p === 'you') return { sel: 'you' };
  if (/^(each opponent|each of your opponents|target opponent's controller)$/.test(p)) return { sel: 'each-opp' };
  if (p === 'each player') return { sel: 'each-player' };
  const each = p.match(/^(each|all) (other )?(.*?)creatures?( .*)?$/);
  if (each) {
    const f: Filter = {};
    if (parseFilterWords(each[3], f)) return null;
    const spec: TargetSpec = { sel: 'target', what: 'creature', filter: f };
    if (each[4] && !parseTail(each[4], spec)) return null;
    return { sel: 'all-creatures', ctrl: spec.ctrl, filter: spec.filter, other: !!each[2] };
  }
  return parseTarget(p);
}

// ---------------------------------------------------------- effect clauses

function parseKeywordList(s: string): string[] | null {
  const parts = s.split(/,? and |, /).map((x) => x.trim()).filter(Boolean);
  const out: string[] = [];
  for (const part of parts) {
    const k = KW_LOWER.get(part);
    if (!k) return null;
    out.push(k);
  }
  return out;
}

const SUBJECT = String.raw`(?:~|it|that creature|target [^.]*?|creatures you control|other creatures you control|each creature you control|all creatures|creatures your opponents control|all other creatures|up to one target [^.]*?)`;

/** Parse one sentence-sized clause ("~ deals 3 damage to any target") into effects. */
export function parseClause(clause: string): Effect[] | null {
  let c = clause.trim().replace(/\.$/, '').replace(/^you may /, '').replace(/^then /, '');
  if (!c) return [];

  // Two effects joined by "and" / ", then" — e.g. "each opponent loses 2 life and you gain 2 life".
  for (const sep of [', then ', ' and you ', '. you ']) {
    if (sep === ', then ' && /, then return (that card|it|that creature|them|those cards) to the battlefield/.test(c)) continue;
    const i = c.indexOf(sep);
    if (i > 0) {
      const a = parseClause(c.slice(0, i));
      const b = parseClause((sep.includes('you') ? 'you ' : '') + c.slice(i + sep.length));
      if (a && b) return [...a, ...b];
    }
  }

  let m: RegExpMatchArray | null;
  if ((m = c.match(/^(?:~ |it |that creature )?deals? (\d+|one|two|three|four|five|six|seven) damage to (.+?)(?: and (\d+) damage to (.+))?$/))) {
    const n = num(m[1])!;
    const recipients: Target[] = [];
    for (const part of m[2].split(/ and (?=each|target|you|~)/)) {
      const r = parseRecipient(part);
      if (!r) return null;
      recipients.push(r);
    }
    const out: Effect[] = [{ k: 'damage', n, to: recipients }];
    if (m[3]) {
      const r = parseRecipient(m[4]);
      if (!r) return null;
      out.push({ k: 'damage', n: Number(m[3]), to: [r] });
    }
    return out;
  }
  if ((m = c.match(/^exile (.+?),? then return (?:that card|it|that creature|them|those cards) to the battlefield under (?:its owner's|their owners'|your) control$/))) {
    const r = parseRecipient(m[1]);
    if (!r || r.sel === 'you' || r.sel === 'each-opp' || r.sel === 'each-player') return null;
    return [{ k: 'flicker', to: r }];
  }
  if ((m = c.match(/^(destroy|exile) (.+?)(?: until ~ leaves the battlefield)?(?:\. it can't be regenerated)?$/))) {
    const r = parseRecipient(m[2]);
    if (!r || r.sel === 'you' || r.sel === 'each-opp' || r.sel === 'each-player') return null;
    return [{ k: 'destroy', to: r, exile: m[1] === 'exile' }];
  }
  if ((m = c.match(/^return (.+?) to (?:its|their) owners?'?s?'? hands?$/))) {
    const r = parseRecipient(m[1]);
    if (!r || r.sel === 'you' || r.sel === 'each-opp' || r.sel === 'each-player') return null;
    return [{ k: 'bounce', to: r }];
  }
  if ((m = c.match(/^(tap|untap) (.+)$/))) {
    const r = parseRecipient(m[2]);
    if (!r || r.sel === 'you' || r.sel === 'each-opp' || r.sel === 'each-player') return null;
    return [{ k: m[1] as 'tap' | 'untap', to: r }];
  }
  if ((m = c.match(/^(?:you |target player )?draws? (a|one|two|three|four|five|\d+) cards?$/))) {
    return [{ k: 'draw', n: num(m[1])! }];
  }
  if ((m = c.match(/^(?:you )?discards? (a|one|two|\d+) cards?$/))) {
    return [{ k: 'self-discard', n: num(m[1])! }];
  }
  if ((m = c.match(/^(?:you |target player )?gains? (\d+|one|two|three|four|five|six|seven) life$/))) {
    return [{ k: 'gain', n: num(m[1])! }];
  }
  if ((m = c.match(/^(each opponent|target opponent|target player|each player) loses (\d+|one|two|three|four|five) life$/))) {
    const who: Target = m[1] === 'each player' ? { sel: 'each-player' } : m[1] === 'target player' ? { sel: 'target', what: 'player' } : { sel: 'each-opp' };
    return [{ k: 'lose', n: num(m[2])!, who }];
  }
  if ((m = c.match(/^(each opponent|target opponent|target player) discards (a|one|two|\d+) cards?$/))) {
    return [{ k: 'discard', n: num(m[2])!, who: { sel: 'each-opp' } }];
  }
  if ((m = c.match(new RegExp(`^(${SUBJECT}) gets? ([+-]\\d+)/([+-]\\d+)(?: and gains? ([a-z ,]+?))? until end of turn$`)))) {
    const to = pumpSubject(m[1]);
    const kw = m[4] ? parseKeywordList(m[4]) : [];
    if (!to || !kw) return null;
    return [{ k: 'pump', p: Number(m[2]), t: Number(m[3]), kw, to }];
  }
  if ((m = c.match(new RegExp(`^(${SUBJECT}) gains? ([a-z ,]+?) until end of turn$`)))) {
    const to = pumpSubject(m[1]);
    const kw = parseKeywordList(m[2]);
    if (!to || !kw) return null;
    return [{ k: 'pump', p: 0, t: 0, kw, to }];
  }
  if ((m = c.match(/^put (a|an|one|two|three|four|five|\d+) \+1\/\+1 counters? on (.+)$/))) {
    const to = m[2] === 'each creature you control' ? ({ sel: 'all-creatures', ctrl: 'you' } as Target) : parseRecipient(m[2]);
    if (!to || to.sel === 'you' || to.sel === 'each-opp' || to.sel === 'each-player') return null;
    return [{ k: 'counters', n: num(m[1])!, to }];
  }
  if ((m = c.match(/^create (a|an|one|two|three|four|five|\d+) (?:tapped )?(\d+)\/(\d+) ([a-z ,-]+?) creature tokens?(?: with ([a-z ,]+?))?(?: named [^.]*)?$/))) {
    const words = m[4].split(/[ ,]+/).filter((w) => w && w !== 'and');
    const colors = words.filter((w) => w in COLOR_WORDS).map((w) => COLOR_WORDS[w]);
    const kinds = words.filter((w) => !(w in COLOR_WORDS) && !['colorless', 'artifact', 'legendary', 'snow', 'enchantment'].includes(w));
    const kw = m[5] ? parseKeywordList(m[5]) : [];
    if (!kw) return null;
    const name = kinds.map((w) => w[0].toUpperCase() + w.slice(1)).join(' ') || 'Construct';
    return [{ k: 'token', count: num(m[1])!, p: Number(m[2]), t: Number(m[3]), name, colors, kw }];
  }
  if ((m = c.match(/^put (a|an|one|two|three|\d+) ([a-z]+) counters? on ~, then draw a card for each \2 counter on ~$/)) && m[2] !== '+1/+1') {
    return [{ k: 'named-counter', name: m[2], n: num(m[1])! }, { k: 'draw-per-counter', name: m[2] }];
  }
  if ((m = c.match(/^put (a|an|one|two|three|\d+) ([a-z]+) counters? on ~$/))) {
    return [{ k: 'named-counter', name: m[2], n: num(m[1])! }];
  }
  if ((m = c.match(/^(?:you )?draw a card for each ([a-z]+) counter on ~$/))) return [{ k: 'draw-per-counter', name: m[1] }];
  if ((m = c.match(/^you lose 1 life for each ([a-z]+) counter on ~$/))) return [{ k: 'lose-per-counter', name: m[1] }];
  if (/^(?:if you cast it, )?you gain protection from everything until your next turn$/.test(c)) return [{ k: 'protection' }];
  if ((m = c.match(/^(~|target creature you control) fights (.+)$/))) {
    const a = m[1] === '~' ? ({ sel: 'self' } as Target) : parseTarget(m[1]);
    const b = parseTarget(m[2]);
    if (!a || !b) return null;
    return [{ k: 'fight', a, b }];
  }
  return null;
}

function pumpSubject(s: string): Target | null {
  if (s === '~' || s === 'it' || s === 'that creature') return { sel: 'self' };
  if (s === 'creatures you control' || s === 'each creature you control') return { sel: 'all-creatures', ctrl: 'you' };
  if (s === 'other creatures you control') return { sel: 'all-creatures', ctrl: 'you', other: true };
  if (s === 'all creatures') return { sel: 'all-creatures' };
  if (s === 'all other creatures') return { sel: 'all-creatures', other: true };
  if (s === 'creatures your opponents control') return { sel: 'all-creatures', ctrl: 'opp' };
  return parseTarget(s);
}

// Whole lines that make no difference in a two-player game without a stack or a command zone.
const IGNORED_LINES = /^(devoid|changeling|partner|partner with [^.]*|~ can be your commander\.?|choose a background|doctor's companion|friends forever|this spell can't be countered\.?|~ can't be countered\.?|~ enters tapped\.?)$/;

// Sentences we deliberately ignore: they don't change a simple game meaningfully.
const HARMLESS = /^(scry \d+|surveil \d+|it can't be regenerated|shuffle[^.]*|mill \w+ cards?|you may scry \d+|investigate|look at the top card of your library)$/;

/** Parse a block of spell text (several sentences). Returns effects plus the sentences left over. */
export function parseEffects(text: string): { effects: Effect[]; rest: string[] } {
  const effects: Effect[] = [];
  const rest: string[] = [];
  const sentences = text.split(/(?<=\.)\s+|\n/).map((s) => s.trim()).filter(Boolean);
  for (const s of sentences) {
    const clause = s.replace(/\.$/, '');
    if (HARMLESS.test(clause)) continue;
    const e = parseClause(clause);
    if (e) effects.push(...e);
    else rest.push(s);
  }
  return { effects, rest };
}

// ------------------------------------------------------------------ cards

const TRIGGERS: [RegExp, Trigger][] = [
  [/^whenever you cast a noncreature spell$/, 'cast-noncreature'],
  [/^whenever you cast an instant or sorcery spell$/, 'cast-instant-sorcery'],
  [/^when ~ enters(?: the battlefield)?(?: or attacks)?$/, 'etb'],
  [/^when ~ enters(?: the battlefield)?(?: or dies)?$/, 'etb'],
  [/^whenever ~ attacks$/, 'attack'],
  [/^whenever ~ deals combat damage to a player$/, 'combat-damage'],
  [/^when ~ dies$/, 'dies'],
  [/^at the beginning of your upkeep$/, 'upkeep'],
  [/^at the beginning of your end step$/, 'end-step'],
];

const MANA_WORD: Record<string, ManaKind> = { w: 'W', u: 'U', b: 'B', r: 'R', g: 'G', c: 'C' };

function parseManaAbility(effect: string): { options: ManaKind[]; amount: number } | null {
  const e = effect.trim().replace(/\.$/, '');
  if (/^add one mana of any colou?r$/.test(e)) return { options: ['W', 'U', 'B', 'R', 'G'], amount: 1 };
  let m = e.match(/^add ((?:\{[wubrgc]\})+)$/);
  if (m) {
    const syms = [...m[1].matchAll(/\{([wubrgc])\}/g)].map((x) => MANA_WORD[x[1]]);
    if (new Set(syms).size === 1) return { options: [syms[0]], amount: syms.length };
    return null;
  }
  m = e.match(/^add ((?:\{[wubrgc]\}(?:,? or |, )?)+)$/);
  if (m) return { options: [...m[1].matchAll(/\{([wubrgc])\}/g)].map((x) => MANA_WORD[x[1]]), amount: 1 };
  return null;
}

const BASIC_MANA: Record<string, ManaKind> = { Plains: 'W', Island: 'U', Swamp: 'B', Mountain: 'R', Forest: 'G', Wastes: 'C' };

const cache = new WeakMap<Card, Abilities>();

export function abilitiesOf(card: Card): Abilities {
  const hit = cache.get(card);
  if (hit) return hit;
  const a = parseCard(card);
  cache.set(card, a);
  return a;
}

function parseCard(card: Card): Abilities {
  const a: Abilities = {
    keywords: new Set(),
    spell: [],
    modes: [],
    triggers: [],
    activated: [],
    mana: null,
    anthem: null,
    attach: null,
    entersWithCounters: 0,
    entersTapped: false,
    cantBlock: false,
    simulated: [],
    unsupported: [],
  };
  const isSpell = card.types.includes('Instant') || card.types.includes('Sorcery');
  const isAura = card.subtypes.includes('Aura');
  const isEquipment = card.subtypes.includes('Equipment');
  const kwLower = new Set(card.keywords.map((k) => k.toLowerCase()));

  const basics = card.subtypes.map((s) => BASIC_MANA[s]).filter(Boolean);
  if (card.types.includes('Land') && basics.length) a.mana = { options: [...new Set(basics)], amount: 1 };

  const text = normalise(card);
  const rawLines = card.text.split('\n');
  const lines = text.split('\n');

  let attach: NonNullable<Abilities['attach']> | null = isAura || isEquipment
    ? { kind: isAura ? 'aura' : 'equipment', p: 0, t: 0, kw: [], cantAttackOrBlock: false, doesntUntap: false, auraOnOpponent: false }
    : null;

  for (let li = 0; li < lines.length; li++) {
    // Ability words ("Avoidance — Whenever …", "Landfall — …") are flavour; the ability follows the dash.
    const line = lines[li].trim().replace(/^[a-z][a-z' -]{2,40} — (?=\S)/, '');
    const raw = rawLines[li]?.trim() ?? line;
    if (!line) continue;
    const ok = () => a.simulated.push(raw);
    const no = () => a.unsupported.push(raw);

    // Keyword lines: "Flying, vigilance", "Ward {2}", "Equip {3}", "Enchant creature".
    const parts = line.split(/, |; /).map((p) => p.trim());
    if (parts.every((p) => [...kwLower].some((k) => p === k || p.startsWith(`${k} `) || p.startsWith(`${k}—`)) || KW_LOWER.has(p))) {
      let any = false;
      for (const p of parts) {
        const k = KW_LOWER.get(p);
        if (k) {
          a.keywords.add(k);
          any = true;
        }
        const equip = p.match(/^equip (\{[^—]+\})$/);
        if (equip && attach) {
          attach.equip = parseCost(equip[1]);
          any = true;
        }
        if (p === 'enchant creature' && attach) any = true;
      }
      (any ? ok : no)();
      continue;
    }
    if (line.startsWith('choose one —') || line.startsWith('choose one or both —') || line.startsWith('choose one or more —')) {
      // Modal spell: the bullet lines follow.
      const modes: Effect[][] = [];
      let all = true;
      while (li + 1 < lines.length && lines[li + 1].trim().startsWith('•')) {
        li++;
        const { effects, rest } = parseEffects(lines[li].trim().replace(/^•\s*/, ''));
        if (effects.length && !rest.length && !effects.some(refersToSelf)) modes.push(effects);
        else {
          all = false;
          a.unsupported.push(rawLines[li]?.trim() ?? lines[li]);
        }
      }
      if (isSpell && modes.length >= 1) {
        a.modes = modes;
        a.simulated.push(raw + (all ? ' (all modes)' : ' (some modes)'));
      } else no();
      continue;
    }

    if (IGNORED_LINES.test(line)) continue;

    // Static abilities.
    let m: RegExpMatchArray | null;
    if (/^~ can't be blocked\.?$/.test(line)) {
      a.keywords.add('Unblockable');
      ok();
      continue;
    }
    if (/^~ enters(?: the battlefield)? tapped\.?$/.test(line)) {
      a.entersTapped = true;
      ok();
      continue;
    }
    if ((m = line.match(/^(other )?creatures you control get \+(\d+)\/\+(\d+)(?: and have ([a-z ,]+))?\.?$/))) {
      const kw = m[4] ? parseKeywordList(m[4]) : [];
      if (kw) {
        a.anthem = { p: Number(m[2]), t: Number(m[3]), kw, other: !!m[1] };
        ok();
        continue;
      }
    }
    if ((m = line.match(/^(?:other )?creatures you control have ([a-z ,]+)\.?$/))) {
      const kw = parseKeywordList(m[1]);
      if (kw) {
        a.anthem = { p: 0, t: 0, kw, other: line.startsWith('other') };
        ok();
        continue;
      }
    }
    if (attach && (m = line.match(/^(enchanted|equipped) creature gets ([+-]\d+)\/([+-]\d+)(?: and has ([a-z ,]+))?\.?$/))) {
      const kw = m[4] ? parseKeywordList(m[4]) : [];
      if (kw) {
        attach.p += Number(m[2]);
        attach.t += Number(m[3]);
        attach.kw.push(...kw);
        if (Number(m[2]) < 0 || Number(m[3]) < 0) attach.auraOnOpponent = true;
        ok();
        continue;
      }
    }
    if (attach && (m = line.match(/^(enchanted|equipped) creature has ([a-z ,]+)\.?$/))) {
      const kw = parseKeywordList(m[2]);
      if (kw) {
        attach.kw.push(...kw);
        ok();
        continue;
      }
    }
    if (attach && /^enchanted creature can't attack or block(, and its activated abilities can't be activated)?\.?$/.test(line)) {
      attach.cantAttackOrBlock = true;
      attach.auraOnOpponent = true;
      ok();
      continue;
    }
    if (attach && /^enchanted creature doesn't untap during its controller's untap step\.?$/.test(line)) {
      attach.doesntUntap = true;
      attach.auraOnOpponent = true;
      ok();
      continue;
    }
    if (/^~ can't block\.?$/.test(line)) {
      a.cantBlock = true;
      ok();
      continue;
    }
    if ((m = line.match(/^~ enters(?: the battlefield)? with (a|one|two|three|four|five|\d+) \+1\/\+1 counters? on it\.?$/))) {
      a.entersWithCounters = num(m[1]) ?? 0;
      ok();
      continue;
    }

    // Triggered abilities.
    if ((m = line.match(/^(when|whenever|at) ([^,]+), (.+)$/))) {
      const cond = `${m[1]} ${m[2]}`;
      const trig = TRIGGERS.find(([re]) => re.test(cond));
      if (trig) {
        const { effects, rest } = parseEffects(m[3]);
        if (effects.length) {
          const castOnly = /^if you cast it, /.test(m[3]);
          a.triggers.push({ when: trig[1], effects, text: raw, ...(castOnly ? { castOnly } : {}) });
          if (cond.includes('or attacks')) a.triggers.push({ when: 'attack', effects, text: raw });
          if (cond.includes('or dies')) a.triggers.push({ when: 'dies', effects, text: raw });
          if (rest.length) {
            a.simulated.push(`${raw} (partly)`);
            a.unsupported.push(...rest);
          } else ok();
          continue;
        }
      }
      no();
      continue;
    }

    // Activated abilities: "{2}{R}, {T}: ~ deals 1 damage to any target."
    if ((m = line.match(/^((?:\{[^}]+\}(?:, )?)+): (.+)$/))) {
      const costSyms = m[1];
      const tap = /\{t\}/.test(costSyms);
      const manaPart = costSyms.replace(/\{t\}/g, '').replace(/, /g, '');
      if (/\{q\}/.test(manaPart)) {
        no();
        continue;
      }
      if (tap && !manaPart) {
        const mana = parseManaAbility(m[2]);
        if (mana) {
          a.mana = mana;
          ok();
          continue;
        }
      }
      const { effects, rest } = parseEffects(m[2]);
      if (effects.length && !rest.length) {
        a.activated.push({ cost: parseCost(manaPart.toUpperCase()), tap, effects, text: raw });
        ok();
      } else no();
      continue;
    }

    // Spell text. ("It" / "that creature" in a spell means an earlier target, which we don't track.)
    if (isSpell) {
      const { effects, rest } = parseEffects(line);
      const ok2 = effects.filter((e) => !refersToSelf(e));
      if (ok2.length !== effects.length) rest.push('(a sentence about “it”)');
      a.spell.push(...ok2);
      if (ok2.length) {
        a.simulated.push(rest.length ? `${raw} (partly)` : raw);
        if (rest.length) a.unsupported.push(...rest.filter((r) => !r.startsWith('(')));
        if (rest.length && !a.unsupported.length) a.unsupported.push(raw);
      } else no();
      continue;
    }
    no();
  }

  if (attach) {
    if (attach.kind === 'aura' && !attach.cantAttackOrBlock && !attach.doesntUntap && attach.p === 0 && attach.t === 0 && !attach.kw.length) attach = null;
    else if (attach.kind === 'equipment' && !attach.equip) attach = null;
  }
  a.attach = attach;
  for (const k of card.keywords) {
    const kw = KW_LOWER.get(k.toLowerCase());
    if (kw) a.keywords.add(kw);
  }
  return a;
}

function refersToSelf(e: Effect): boolean {
  const self = (t: Target) => t.sel === 'self';
  switch (e.k) {
    case 'damage':
      return e.to.some(self);
    case 'destroy':
    case 'bounce':
    case 'tap':
    case 'untap':
    case 'pump':
    case 'counters':
    case 'flicker':
      return self(e.to);
    case 'fight':
      return self(e.a) || self(e.b);
    default:
      return false;
  }
}

/** Does this card do what its text says, closely enough to be fun in this game? */
export function playability(card: Card): 'full' | 'partial' | 'none' {
  const a = abilitiesOf(card);
  const isCreature = card.types.includes('Creature');
  const isSpell = card.types.includes('Instant') || card.types.includes('Sorcery');
  // A non-creature permanent has to *do* something; a keyword alone (an indestructible rock) doesn't count.
  const does = a.spell.length > 0 || a.modes.length > 0 || a.triggers.length > 0 || a.activated.length > 0 ||
    a.mana !== null || a.anthem !== null || a.attach !== null || a.entersWithCounters > 0;
  if (isSpell && a.spell.length === 0 && a.modes.length === 0) return 'none';
  // Skipping an additional cost would make the card far stronger than it is.
  if (a.unsupported.some((l) => /^as an additional cost/i.test(l))) return 'none';
  if (!isCreature && !isSpell && !does) return 'none';
  return a.unsupported.length === 0 ? 'full' : 'partial';
}

/** Every chosen-target slot in a list of effects, in the order the player picks them. */
export function targetSlots(effects: Effect[]): TargetSpec[] {
  const out: TargetSpec[] = [];
  const add = (t: Target) => {
    if (t.sel === 'target') out.push(t);
  };
  for (const e of effects) {
    switch (e.k) {
      case 'damage':
        e.to.forEach(add);
        break;
      case 'lose':
      case 'discard':
        add(e.who);
        break;
      case 'fight':
        add(e.a);
        add(e.b);
        break;
      case 'destroy':
      case 'bounce':
      case 'tap':
      case 'untap':
      case 'pump':
      case 'counters':
      case 'flicker':
        add(e.to);
        break;
      default:
        break;
    }
  }
  return out;
}

/** A one-line, plain-English summary of an effect, for the log and the card inspector. */
export function describeEffect(e: Effect): string {
  const who = (t: Target): string => {
    switch (t.sel) {
      case 'self':
        return 'itself';
      case 'you':
        return 'you';
      case 'each-opp':
        return 'each opponent';
      case 'each-player':
        return 'each player';
      case 'all-creatures':
        return `each ${t.other ? 'other ' : ''}creature${t.ctrl === 'you' ? ' you control' : t.ctrl === 'opp' ? ' an opponent controls' : ''}`;
      default:
        return `target ${t.what === 'any' ? 'creature or player' : t.what.replace('-', ' or ')}${t.ctrl === 'you' ? ' you control' : t.ctrl === 'opp' ? ' an opponent controls' : ''}`;
    }
  };
  switch (e.k) {
    case 'damage':
      return `${e.n} damage to ${e.to.map(who).join(' and ')}`;
    case 'destroy':
      return `${e.exile ? 'exile' : 'destroy'} ${who(e.to)}`;
    case 'bounce':
      return `return ${who(e.to)} to hand`;
    case 'tap':
    case 'untap':
      return `${e.k} ${who(e.to)}`;
    case 'pump':
      return `${who(e.to)} gets ${e.p >= 0 ? '+' : ''}${e.p}/${e.t >= 0 ? '+' : ''}${e.t}${e.kw.length ? ` and ${e.kw.join(', ').toLowerCase()}` : ''} this turn`;
    case 'counters':
      return `${e.n} +1/+1 counter${e.n > 1 ? 's' : ''} on ${who(e.to)}`;
    case 'draw':
      return `draw ${e.n}`;
    case 'gain':
      return `gain ${e.n} life`;
    case 'lose':
      return `${who(e.who)} loses ${e.n} life`;
    case 'token':
      return `create ${e.count} ${e.p}/${e.t} ${e.name}${e.kw.length ? ` with ${e.kw.join(', ').toLowerCase()}` : ''}`;
    case 'discard':
      return `opponent discards ${e.n}`;
    case 'self-discard':
      return `discard ${e.n}`;
    case 'fight':
      return `${who(e.a)} fights ${who(e.b)}`;
    case 'named-counter':
      return `put ${e.n} ${e.name} counter${e.n > 1 ? 's' : ''} on it`;
    case 'draw-per-counter':
      return `draw a card for each ${e.name} counter`;
    case 'lose-per-counter':
      return `lose 1 life for each ${e.name} counter`;
    case 'protection':
      return 'you gain protection from everything until your next turn';
    case 'flicker':
      return `blink ${who(e.to)} (exile it and return it to the battlefield)`;
  }
}
