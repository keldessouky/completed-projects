// Building a 40-card deck from a theme: 17 basic lands and 23 spells in one or
// two colours, with a sensible mana curve and a creature-heavy mix.
import { COLORS, COLOR_NAMES, type Card, type Color } from '../data/cards';
import type { Theme } from '../data/themes';
import { abilitiesOf, playability } from './abilities';
import { parseCost } from './mana';
import { makeRng, pick, type Rng } from './rng';

export interface DeckOptions {
  /** 'auto' picks colours that suit the theme; otherwise exactly these colours. */
  colors: 'auto' | Color[];
  seed?: number;
  /** Must-have cards: always in the deck (one copy each), and the deck's colours stretch to cast them. */
  pinned?: Card[];
}

export interface Deck {
  name: string;
  theme: Theme;
  colors: Color[];
  cards: Card[];
  /** Cards that came from the theme itself (the rest are filler from the whole universe). */
  themed: Set<Card>;
  /** The must-have cards the player asked for. */
  pinned: Set<Card>;
  poolSize: number;
}

export const DECK_SIZE = 40;
export const LAND_COUNT = 17;
const SPELLS = DECK_SIZE - LAND_COUNT;
const CREATURE_TARGET = 15;
/** How many spells we want at each mana value (index 1..6, 6 = six or more). */
const CURVE = [0, 2, 6, 6, 4, 3, 2];
const BASIC_FOR: Record<Color, string> = { W: 'Plains', U: 'Island', B: 'Swamp', R: 'Mountain', G: 'Forest' };

const deckableCache = new WeakMap<Card, boolean>();

/** Can this card be a spell in a generated deck? */
export function deckable(c: Card): boolean {
  let v = deckableCache.get(c);
  if (v === undefined) deckableCache.set(c, (v = isDeckable(c)));
  return v;
}

function isDeckable(c: Card): boolean {
  if (c.types.includes('Land') || c.types.includes('Planeswalker') || c.types.includes('Battle')) return false;
  if (!['Creature', 'Instant', 'Sorcery', 'Artifact', 'Enchantment'].some((t) => c.types.includes(t))) return false;
  if (!c.cost) return false;
  const cost = parseCost(c.cost);
  if (cost.hasX || c.cmc > 8) return false;
  if (c.types.includes('Creature') && (c.power === null || c.toughness === null || c.toughness <= 0)) return false;
  if (c.subtypes.includes('Vehicle') || c.subtypes.includes('Saga') || c.subtypes.includes('Class')) return false;
  return playability(c) !== 'none';
}

export const MAX_PINNED = 10;

/** Colours a card's costs (spell and abilities) need. */
export function colorsNeeded(c: Card): Color[] {
  const a = abilitiesOf(c);
  const costs = [parseCost(c.cost), ...a.activated.map((x) => x.cost), ...(a.attach?.equip ? [a.attach.equip] : [])];
  return COLORS.filter((col) => costs.some((cost) => cost.pips.some((pip) => pip.length === 1 && pip[0] === col)));
}

/**
 * Can the player put this card in a deck by hand? Any card you can cast in this game:
 * creatures and other permanents (even if their text isn't simulated), and instants or
 * sorceries that do something here. No lands (decks get basics), planeswalkers or X spells.
 */
export function pinnable(c: Card): boolean {
  if (!c.cost || c.types.includes('Land') || c.types.includes('Planeswalker') || c.types.includes('Battle')) return false;
  if (!['Creature', 'Instant', 'Sorcery', 'Artifact', 'Enchantment'].some((t) => c.types.includes(t))) return false;
  if (parseCost(c.cost).hasX) return false;
  if (c.types.includes('Creature') && (c.power === null || c.toughness === null || c.toughness <= 0)) return false;
  if ((c.types.includes('Instant') || c.types.includes('Sorcery')) && playability(c) === 'none') return false;
  return true;
}

/** Can a deck of these colours pay for this card? (Colourless cards fit anywhere.) */
export function fitsColors(c: Card, colors: Color[]): boolean {
  const a = abilitiesOf(c);
  const costs = [parseCost(c.cost), ...a.activated.map((x) => x.cost), ...(a.attach?.equip ? [a.attach.equip] : [])];
  return costs.every((cost) => cost.pips.every((pip) => pip.some((p) => colors.includes(p))));
}

function chooseColors(pool: Card[], rng: Rng, universal: boolean): Color[] {
  if (universal || pool.length < 12) {
    const first = pick(COLORS, rng);
    const second = pick(COLORS.filter((c) => c !== first), rng);
    return rng() < 0.15 ? [first] : [first, second];
  }
  const weight = new Map<Color, number>(COLORS.map((c) => [c, 0]));
  for (const c of pool) for (const col of c.colors) weight.set(col, weight.get(col)! + 1 / c.colors.length);
  const ranked = COLORS.filter((c) => weight.get(c)! > 0).sort((a, b) => weight.get(b)! - weight.get(a)!);
  if (!ranked.length) return [pick(COLORS, rng)];
  const weighted = (cands: Color[]) => {
    const total = cands.reduce((n, c) => n + weight.get(c)!, 0);
    let r = rng() * total;
    for (const c of cands) if ((r -= weight.get(c)!) <= 0) return c;
    return cands[0];
  };
  const first = weighted(ranked.slice(0, 3));
  const rest = ranked.filter((c) => c !== first && weight.get(c)! >= weight.get(first)! * 0.2);
  // Mono-colour when the theme is overwhelmingly one colour and deep enough.
  const firstCount = pool.filter((c) => fitsColors(c, [first])).length;
  if (!rest.length || (firstCount >= SPELLS * 2 && weight.get(rest[0])! < weight.get(first)! * 0.35)) return [first];
  return [first, weighted(rest)];
}

function score(c: Card, rng: Rng): number {
  let s = rng() * 2;
  const p = playability(c);
  if (p === 'full') s += 0.8;
  const a = abilitiesOf(c);
  if (c.types.includes('Creature')) {
    const stats = (c.power ?? 0) + (c.toughness ?? 0);
    s += Math.min(1, (stats - c.cmc * 1.6) / 4); // reward efficient bodies
    s += a.keywords.size * 0.15 + a.triggers.length * 0.3 + a.activated.length * 0.2;
  } else {
    s += c.colors.length ? 0.5 : 0.1; // prefer spells in the deck's colours over colourless trinkets
  }
  if (c.cmc >= 7) s -= 1;
  return s;
}

/** Pick up to `n` cards from `cands`, following the mana curve; `have` is what's in the deck so far. */
function fill(cands: Card[], n: number, have: Card[], copies: (c: Card) => number, rng: Rng): Card[] {
  const out: Card[] = [];
  const count = new Map<Card, number>();
  for (const c of have) count.set(c, (count.get(c) ?? 0) + 1);
  const bucket = (c: Card) => Math.max(1, Math.min(6, c.cmc));
  const curveCount = (b: number) => [...have, ...out].filter((c) => bucket(c) === b).length;
  const ranked = cands.map((c) => ({ c, s: score(c, rng) })).sort((a, b) => b.s - a.s).map((x) => x.c);
  for (const strict of [true, false]) {
    let progress = true;
    while (out.length < n && progress) {
      progress = false;
      for (const c of ranked) {
        if (out.length >= n) break;
        if ((count.get(c) ?? 0) >= copies(c)) continue;
        if (strict && curveCount(bucket(c)) >= CURVE[bucket(c)] * 1.25 + 1) continue;
        out.push(c);
        count.set(c, (count.get(c) ?? 0) + 1);
        progress = true;
      }
    }
  }
  return out;
}

export function buildDeck(all: Card[], theme: Theme, opts: DeckOptions): Deck {
  const rng = makeRng(opts.seed ?? Math.floor(Math.random() * 2 ** 31));
  const eligible = all.filter(deckable);
  const pool = theme.id === 'universal' ? eligible : eligible.filter(theme.match);
  const pinned = [...new Set(opts.pinned ?? [])].filter(pinnable).slice(0, MAX_PINNED);
  const pinnedColors = COLORS.filter((col) => pinned.some((c) => colorsNeeded(c).includes(col)));
  let colors: Color[];
  if (opts.colors !== 'auto') colors = opts.colors.length ? [...opts.colors] : [pick(COLORS, rng)];
  else if (pinnedColors.length >= 2) colors = [];
  else if (pinnedColors.length === 1) {
    // Pair the must-have colour with the theme colour that suits it best.
    const others = chooseColors(pool.filter((c) => !c.colors.length || c.colors.some((x) => x !== pinnedColors[0])), rng, theme.id === 'universal').filter((x) => x !== pinnedColors[0]);
    colors = others.length ? [others[0]] : [];
  } else colors = chooseColors(pool, rng, theme.id === 'universal');
  // The deck's colours always include whatever the must-have cards need.
  for (const col of pinnedColors) if (!colors.includes(col)) colors.push(col);
  if (!colors.length) colors.push(pick(COLORS, rng));
  // Hybrid-only must-haves: add one of their colours if the deck can't pay for them yet.
  for (const c of pinned) {
    for (const cost of [parseCost(c.cost)]) for (const pip of cost.pips) if (!pip.some((x) => colors.includes(x))) colors.push(pip[0]);
  }
  colors.sort((a, b) => COLORS.indexOf(a) - COLORS.indexOf(b));

  const fits = pool.filter((c) => fitsColors(c, colors));
  const isCreature = (c: Card) => c.types.includes('Creature');
  // Copies: singleton when the theme is deep, more copies when it's shallow (like a real constructed deck).
  const copiesFor = (n: number) => (c: Card) => (c.supertypes.includes('Legendary') ? 1 : Math.min(4, Math.max(1, Math.ceil(SPELLS / Math.max(1, n)))));

  const themeCreatures = fits.filter(isCreature);
  const themeSpells = theme.tribal ? fits.filter((c) => !isCreature(c) && c.text.includes(theme.name)) : fits.filter((c) => !isCreature(c));
  // Keep auras, equipment and mana rocks to a few, so the deck has real spells.
  const isGear = (c: Card) => abilitiesOf(c).attach !== null || (abilitiesOf(c).mana !== null && !isCreature(c));
  const gearCap = theme.id === 's-auras' ? 6 : 3;
  const copies = copiesFor(themeCreatures.length + themeSpells.length);
  const chosen: Card[] = [...pinned];
  // A creature-type deck is mostly that type; its spells come from the whole universe if need be.
  const pinnedCreatures = pinned.filter(isCreature).length;
  const creatureTarget = Math.min(SPELLS - chosen.length, Math.max(0, (theme.tribal ? CREATURE_TARGET + 2 : CREATURE_TARGET) - pinnedCreatures));
  chosen.push(...fill(themeCreatures.filter((c) => !pinned.includes(c)), creatureTarget, chosen, copies, rng));
  const gearPool = themeSpells.filter(isGear);
  const spellSlots = Math.max(0, SPELLS - chosen.length - Math.min(2, gearPool.length));
  const spells = fill(themeSpells.filter((c) => !isGear(c)), spellSlots, chosen, copies, rng);
  chosen.push(...spells);
  chosen.push(...fill(gearPool, Math.max(0, Math.min(gearCap, SPELLS - chosen.length)), chosen, copies, rng));
  if (chosen.length < SPELLS && !theme.tribal) chosen.push(...fill(themeCreatures, SPELLS - chosen.length, chosen, copies, rng));
  const themed = new Set(chosen.filter((c) => !pinned.includes(c) || theme.id === 'universal' || theme.match(c)));

  // Not enough on-theme cards in these colours: top up from the whole universe.
  if (chosen.length < SPELLS) {
    const filler = eligible.filter((c) => fitsColors(c, colors) && !chosen.includes(c) && playability(c) === 'full');
    const creaturesNow = chosen.filter(isCreature).length;
    const wantCreatures = Math.max(0, Math.min(CREATURE_TARGET - creaturesNow, SPELLS - chosen.length));
    chosen.push(...fill(filler.filter(isCreature), wantCreatures, chosen, () => 1, rng));
    chosen.push(...fill(filler.filter((c) => !isCreature(c)), SPELLS - chosen.length, chosen, () => 1, rng));
    chosen.push(...fill(filler, SPELLS - chosen.length, chosen, () => 1, rng));
  }

  // Lands in proportion to coloured pips (every colour gets at least a few).
  const pips = new Map<Color, number>(colors.map((c) => [c, 0]));
  for (const c of chosen) for (const pip of parseCost(c.cost).pips) for (const p of pip) if (pips.has(p)) pips.set(p, pips.get(p)! + 1 / pip.length);
  const totalPips = [...pips.values()].reduce((a, b) => a + b, 0) || 1;
  const lands: Card[] = [];
  const basics = new Map(COLORS.map((c) => [c, all.find((x) => x.name === BASIC_FOR[c] && x.supertypes.includes('Basic'))!]));
  let left = LAND_COUNT;
  colors.forEach((c, i) => {
    const floor = colors.length === 1 ? LAND_COUNT : colors.length === 2 ? 5 : colors.length === 3 ? 4 : 3;
    const n = i === colors.length - 1 ? left : Math.max(floor, Math.round((LAND_COUNT * pips.get(c)!) / totalPips));
    const take = Math.min(left, n);
    for (let k = 0; k < take; k++) lands.push(basics.get(c)!);
    left -= take;
  });

  const cards = [...chosen.sort((a, b) => a.cmc - b.cmc || a.name.localeCompare(b.name)), ...lands];
  return {
    name: `${theme.name} · ${colors.map((c) => COLOR_NAMES[c]).join('–')}`,
    theme,
    colors,
    cards,
    themed,
    pinned: new Set(pinned),
    poolSize: pool.length,
  };
}
