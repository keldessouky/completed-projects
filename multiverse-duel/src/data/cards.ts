// The card universe: every card in the Scryfall snapshot, loaded once.

/** One card as stored in public/data/cards.json.gz (see tools/build-cards.mjs). */
export interface RawCard {
  i: string; // Scryfall id of the printing whose image we show
  n: string; // name (front face)
  fn?: string; // full name, for split / double-faced cards
  m: string; // mana cost (front face)
  t: string; // type line (front face)
  o: string; // rules text (front face)
  cl: string; // colours, e.g. "WU"
  ci: string; // colour identity
  k: string[]; // keywords
  s: string; // set of the shown printing
  fs: string; // set it was first printed in
  ss: string; // every set it was printed in, space-separated
  r: string; // rarity: c u r m s b
  y: number; // year first printed
  a: string; // artist
  p?: string;
  tg?: string;
  l?: string;
  b?: 1; // has a back face image
  ub?: 1; // Universes Beyond only
  ft?: string; // flavour text
  e?: number; // EDHREC popularity rank (1 = most played)
}

export interface SetInfo {
  c: string; // code
  n: string; // name
  t: string; // set type
  d: string; // release date
  p: string; // parent set code
  k: number; // cards in the snapshot printed in it
}

export interface Snapshot {
  generated: string;
  printings: number;
  sets: SetInfo[];
  cards: RawCard[];
}

export type Color = 'W' | 'U' | 'B' | 'R' | 'G';
export const COLORS: Color[] = ['W', 'U', 'B', 'R', 'G'];
export const COLOR_NAMES: Record<Color, string> = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' };

/** A card definition with the fields the game needs, derived once from the raw record. */
export interface Card {
  id: string;
  name: string;
  fullName: string;
  cost: string;
  cmc: number;
  typeLine: string;
  types: string[]; // Creature, Instant, …
  subtypes: string[]; // Elf, Warrior, …
  supertypes: string[]; // Legendary, Basic, …
  text: string;
  power: number | null;
  toughness: number | null;
  powerText?: string;
  toughnessText?: string;
  loyalty?: string;
  colors: Color[];
  identity: Color[];
  keywords: string[];
  set: string;
  firstSet: string;
  sets: string[];
  rarity: string;
  year: number;
  artist: string;
  flavor?: string;
  hasBack: boolean;
  universesBeyond: boolean;
  /** EDHREC popularity rank across all cards (1 = most played), when known. */
  edhrecRank: number | null;
}

const SUPERTYPES = new Set(['Legendary', 'Basic', 'Snow', 'World', 'Ongoing', 'Elite', 'Host', 'Kindred', 'Tribal']);

export function cmcOf(cost: string): number {
  let n = 0;
  for (const [, sym] of cost.matchAll(/\{([^}]+)\}/g)) {
    if (/^\d+$/.test(sym)) n += Number(sym);
    else if (sym === 'X' || sym === 'Y' || sym === 'Z') continue;
    else if (/^2\//.test(sym)) n += 2;
    else n += 1;
  }
  return n;
}

const statOf = (s: string | undefined): number | null => (s !== undefined && /^-?\d+$/.test(s) ? Number(s) : null);

export function toCard(r: RawCard): Card {
  const [left, right = ''] = r.t.split(/\s+—\s+/);
  const words = left.split(/\s+/).filter(Boolean);
  return {
    id: r.i,
    name: r.n,
    fullName: r.fn ?? r.n,
    cost: r.m,
    cmc: cmcOf(r.m),
    typeLine: r.t,
    supertypes: words.filter((w) => SUPERTYPES.has(w)),
    types: words.filter((w) => !SUPERTYPES.has(w)),
    subtypes: right.split(/\s+/).filter(Boolean),
    text: r.o,
    power: statOf(r.p),
    toughness: statOf(r.tg),
    powerText: r.p,
    toughnessText: r.tg,
    loyalty: r.l,
    colors: [...r.cl].filter((c): c is Color => COLORS.includes(c as Color)),
    identity: [...r.ci].filter((c): c is Color => COLORS.includes(c as Color)),
    keywords: r.k,
    set: r.s,
    firstSet: r.fs,
    sets: r.ss.split(' '),
    rarity: r.r,
    year: r.y,
    artist: r.a,
    flavor: r.ft,
    hasBack: r.b === 1,
    universesBeyond: r.ub === 1,
    edhrecRank: r.e ?? null,
  };
}

export interface Universe {
  generated: string;
  printings: number;
  sets: SetInfo[];
  setsByCode: Map<string, SetInfo>;
  cards: Card[];
}

export function buildUniverse(s: Snapshot): Universe {
  return {
    generated: s.generated,
    printings: s.printings,
    sets: s.sets,
    setsByCode: new Map(s.sets.map((x) => [x.c, x])),
    cards: s.cards.map(toCard),
  };
}

/** Fetch and unpack the snapshot that ships with the game. */
export async function loadUniverse(url = `${import.meta.env.BASE_URL}data/cards.json.gz`): Promise<Universe> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Could not load the card database (${res.status}).`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  // A gzip file starts 1f 8b; some servers unzip it on the way, so check before inflating.
  const text =
    bytes[0] === 0x1f && bytes[1] === 0x8b
      ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
      : new TextDecoder().decode(bytes);
  return buildUniverse(JSON.parse(text) as Snapshot);
}

export const imageUrl = (id: string, size: 'normal' | 'large' | 'small' | 'art_crop' = 'normal', back = false) =>
  `https://cards.scryfall.io/${size}/${back ? 'back' : 'front'}/${id[0]}/${id[1]}/${id}.jpg`;

export const scryfallUrl = (c: Card) => `https://scryfall.com/search?q=${encodeURIComponent(`!"${c.fullName}"`)}`;

export const isType = (c: Card, t: string) => c.types.includes(t);
