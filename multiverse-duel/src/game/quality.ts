// How good is a card? A 0–100 score and an S–D grade, so a player rerolling decks
// can tell at a glance which cards are worth having.
//
// The score blends three things, then ranks every card against all the cards a
// generated deck can use (so 90 means "better than 90% of them"):
//  - strength in THIS game: stats, keywords and simulated effects for the mana;
//  - how widely the card is played in real Magic (EDHREC rank), a strong signal of quality;
//  - rarity, a small nudge (rares and mythics are designed to be stronger).
import type { Card } from '../data/cards';
import { abilitiesOf, playability, type Effect, type Target } from './abilities';
import { parseCost } from './mana';

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D';

export const GRADES: { grade: Grade; name: string; min: number; blurb: string }[] = [
  { grade: 'S', name: 'Bomb', min: 95, blurb: 'top 5% — game-winning card' },
  { grade: 'A', name: 'Excellent', min: 82, blurb: 'top 18% — a card you’re glad to draw' },
  { grade: 'B', name: 'Solid', min: 60, blurb: 'above average' },
  { grade: 'C', name: 'Playable', min: 30, blurb: 'does its job' },
  { grade: 'D', name: 'Filler', min: 0, blurb: 'bottom 30% — weak or very situational' },
];

/**
 * Deck strength (average card score) → grade. Decks average out and the builder already
 * prefers good cards, so these bands are calibrated on generated decks: roughly the top
 * 10% of rolls are S, the next 25% A, the middle 30% B, then C, and the weakest 10% D.
 */
const DECK_GRADES: [Grade, number][] = [['S', 81], ['A', 76], ['B', 69], ['C', 61], ['D', 0]];

export const gradeOf = (score: number): Grade => GRADES.find((g) => score >= g.min)!.grade;
export const deckGradeOf = (score: number): Grade => DECK_GRADES.find(([, min]) => score >= min)![0];
export const gradeInfo = (g: Grade) => GRADES.find((x) => x.grade === g)!;

const KW: Record<string, number> = {
  Flying: 1.5, Deathtouch: 1.5, Lifelink: 1, 'First strike': 1, 'Double strike': 2.5, Trample: 0.7, Menace: 0.7,
  Hexproof: 0.8, Indestructible: 2, Vigilance: 0.4, Haste: 0.6, Reach: 0.3, Unblockable: 1.5, Prowess: 0.5,
  Shroud: 0.5, Flash: 0.5, Defender: -1.5,
};

function targetsMany(t: Target) {
  return t.sel === 'all-creatures' || t.sel === 'each-opp' || t.sel === 'each-player';
}

/** Rough value of one effect, in "points" comparable to a creature's stats. */
function effectValue(e: Effect): number {
  switch (e.k) {
    case 'damage':
      return e.to.reduce((v, t) => v + (t.sel === 'all-creatures' ? e.n * 1.5 : t.sel === 'target' && t.what === 'any' ? e.n * 1.4 + 0.5 : e.n * 1.2), 0);
    case 'destroy':
      return targetsMany(e.to) ? 6 : e.exile ? 5.5 : 5;
    case 'bounce':
      return targetsMany(e.to) ? 4 : 2.5;
    case 'tap':
      return 1;
    case 'untap':
      return 0.3;
    case 'pump':
      return e.t < 0 ? -e.t * 1.3 : (0.5 + (e.p + e.t) * 0.3 + e.kw.length * 0.4) * (targetsMany(e.to) ? 2 : 1);
    case 'counters':
      return e.n * 1.6 * (targetsMany(e.to) ? 2 : 1);
    case 'draw':
      return e.n * 2.2;
    case 'gain':
      return e.n * 0.3;
    case 'lose':
      return e.n * 0.8;
    case 'token':
      return e.count * ((e.p + e.t) * 0.9 + e.kw.reduce((n, k) => n + (KW[k] ?? 0), 0));
    case 'discard':
      return e.n * 1.5;
    case 'self-discard':
      return -e.n;
    case 'fight':
      return 4;
    case 'named-counter':
      return 0;
    case 'draw-per-counter':
      return 4; // grows every use
    case 'lose-per-counter':
      return -1.5;
    case 'protection':
      return 2.5;
    case 'flicker':
      return 2;
  }
}
const sum = (es: Effect[]) => es.reduce((v, e) => v + effectValue(e), 0);

/** 0..1: how much this card does for its mana in this game. */
export function gameStrength(c: Card): number {
  const a = abilitiesOf(c);
  const cmc = Math.max(c.cmc, 1); // free cards aren't infinitely efficient
  let value = 0;
  let expected = 1 + cmc * 2.3;
  if (c.types.includes('Creature')) {
    value += (c.power ?? 0) * 1.2 + (c.toughness ?? 0) * 0.8;
    for (const k of a.keywords) value += KW[k] ?? 0;
    for (const t of a.triggers) value += sum(t.effects) * (t.when === 'etb' || t.when === 'dies' ? 1 : t.when === 'upkeep' || t.when === 'end-step' ? 1.5 : 0.7);
    // A tap ability works every turn; a mana-only ability is a repeatable pump at best.
    for (const x of a.activated) value += Math.max(0, sum(x.effects)) * (x.tap ? 1.8 : 0.6);
    if (a.anthem) value += 4 + a.anthem.kw.length;
    if (a.mana) value += 1.5;
    value += a.entersWithCounters * 1.6 + (a.cantBlock ? -1 : 0);
  } else if (a.spell.length || a.modes.length) {
    value = a.modes.length ? Math.max(...a.modes.map(sum)) + (a.modes.length > 1 ? 1 : 0) : sum(a.spell);
    if (c.types.includes('Instant')) value += 0.5;
    expected = 1 + cmc * 2;
  } else if (a.attach) {
    value = a.attach.p + a.attach.t * 0.7 + a.attach.kw.reduce((n, k) => n + (KW[k] ?? 0) + 0.3, 0) + (a.attach.cantAttackOrBlock ? 5 : 0) + (a.attach.doesntUntap ? 3 : 0);
    if (a.attach.equip) {
      value *= 1.6; // equipment survives its creature and moves on
      expected += (a.attach.equip.generic + a.attach.equip.pips.length) * 0.6;
    }
    else value -= 0.5; // auras risk a two-for-one
  } else {
    if (a.anthem) value += 5 + a.anthem.kw.length * 1.5;
    if (a.mana) value += 1.5 + a.mana.amount + (a.mana.options.length > 1 ? 0.5 : 0);
    for (const t of a.triggers) value += sum(t.effects) * (t.when === 'upkeep' || t.when === 'end-step' ? 2 : 1);
    for (const x of a.activated) value += Math.max(0, sum(x.effects)) * (x.tap ? 1.8 : 0.8);
  }
  if (parseCost(c.cost).pips.length >= 3) value -= 0.3; // hard to cast
  const ratio = value / expected;
  return Math.max(0, Math.min(1, (ratio - 0.35) / 1.15));
}

const RARITY: Record<string, number> = { c: 0, u: 0.35, r: 0.7, m: 1, s: 0.6, b: 0.4 };
const LOG_MAX_RANK = Math.log10(33_000);

function rawScore(c: Card): number {
  const popularity = c.edhrecRank ? Math.max(0, 1 - Math.log10(c.edhrecRank) / LOG_MAX_RANK) : 0.3;
  const sim = playability(c);
  return gameStrength(c) * 45 + popularity * 32 + (RARITY[c.rarity] ?? 0) * 13 + (sim === 'full' ? 10 : sim === 'partial' ? 4 : 0);
}

let reference: number[] | null = null;
const cache = new WeakMap<Card, number>();

/** Rank cards against these (the deck-usable pool). Call once after loading the universe. */
export function initQuality(pool: Card[]) {
  reference = pool.map(rawScore).sort((a, b) => a - b);
}

/** 0–100: the share of deck-usable cards this card beats. */
export function cardScore(c: Card): number {
  const hit = cache.get(c);
  if (hit !== undefined) return hit;
  const raw = rawScore(c);
  let score: number;
  if (!reference || !reference.length) score = Math.round(Math.min(100, raw));
  else {
    let lo = 0;
    let hi = reference.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (reference[mid] < raw) lo = mid + 1;
      else hi = mid;
    }
    score = Math.round((lo / reference.length) * 100);
  }
  cache.set(c, score);
  return score;
}

export const cardGrade = (c: Card): Grade => gradeOf(cardScore(c));

/** Basic lands are neutral: they don't count toward a deck's strength. */
const counts = (c: Card) => !c.supertypes.includes('Basic');

export interface DeckStrength {
  score: number;
  grade: Grade;
  byGrade: Record<Grade, number>;
}

export function deckStrength(cards: Card[]): DeckStrength {
  const spells = cards.filter(counts);
  const byGrade: Record<Grade, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
  let total = 0;
  for (const c of spells) {
    const s = cardScore(c);
    total += s;
    byGrade[gradeOf(s)]++;
  }
  const score = spells.length ? Math.round(total / spells.length) : 0;
  return { score, grade: deckGradeOf(score), byGrade };
}
