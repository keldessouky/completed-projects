// Themes: ways to carve the card universe into a deck — by franchise, plane,
// creature type, play style, era, single set or free-text search — plus
// Universal mode, which builds from everything.
import { abilitiesOf } from '../game/abilities';
import type { Card, Universe } from './cards';

export type ThemeGroup = 'Universal' | 'Franchises' | 'Planes' | 'Creature types' | 'Play styles' | 'Eras' | 'Sets' | 'Search';

export interface Theme {
  id: string;
  group: ThemeGroup;
  name: string;
  blurb: string;
  match: (c: Card) => boolean;
  /** Creature-type themes take creatures from the theme and spells from anywhere. */
  tribal?: boolean;
}

const firstIn = (codes: string) => {
  const set = new Set(codes.split(' '));
  return (c: Card) => set.has(c.firstSet);
};

/** Universes Beyond and other crossover franchises, by the sets their cards debuted in. */
const FRANCHISES: [string, string, string][] = [
  ['lotr', 'The Lord of the Rings', 'ltr ltc hob hoc pltr'],
  ['hobbit', 'The Hobbit', 'hob hoc'],
  ['warhammer', 'Warhammer 40,000', '40k'],
  ['doctorwho', 'Doctor Who', 'who'],
  ['fallout', 'Fallout', 'pip'],
  ['assassins', "Assassin's Creed", 'acr'],
  ['finalfantasy', 'Final Fantasy', 'fin fic fca pfin'],
  ['marvel', 'Marvel (Spider-Man & Super Heroes)', 'spm spe msh msc mdd mdc'],
  ['spiderman', "Marvel's Spider-Man", 'spm spe'],
  ['avatar', 'Avatar: The Last Airbender', 'tla tle'],
  ['tmnt', 'Teenage Mutant Ninja Turtles', 'tmt tmc'],
  ['startrek', 'Star Trek', 'trk trc'],
  ['jurassic', 'Jurassic World', 'rex'],
  ['transformers', 'Transformers', 'bot'],
  ['dnd', 'Dungeons & Dragons', 'afr afc clb'],
];

/** Planes of the Magic multiverse, by the sets set there. */
const PLANES: [string, string, string][] = [
  ['dominaria', 'Dominaria', 'lea leb 2ed arn atq leg drk fem ice all csp hml mir vis wth usg ulg uds inv pls apc ody tor jud ons lgn scg tsp tsb plc fut dom dmu dmc bro brc'],
  ['ravnica', 'Ravnica', 'rav gpt dis rtr gtc dgm grn rna war mkm mkc clu rvr'],
  ['innistrad', 'Innistrad', 'isd dka avr soi emn mid mic vow voc dbl inr'],
  ['zendikar', 'Zendikar', 'zen wwk roe bfz ogw znr znc'],
  ['kamigawa', 'Kamigawa', 'chk bok sok neo nec'],
  ['theros', 'Theros', 'ths bng jou thb'],
  ['mirrodin', 'Mirrodin & New Phyrexia', 'mrd dst 5dn som mbs nph one onc'],
  ['phyrexia', 'March of the Machine', 'mom moc mat'],
  ['alara', 'Alara', 'ala con arb'],
  ['lorwyn', 'Lorwyn & Shadowmoor', 'lrw mor shm eve ecl ecc'],
  ['tarkir', 'Tarkir', 'ktk frf dtk tdm tdc'],
  ['ixalan', 'Ixalan', 'xln rix lci lcc'],
  ['eldraine', 'Eldraine', 'eld woe woc'],
  ['kaladesh', 'Kaladesh & Aetherdrift', 'kld aer dft drc'],
  ['amonkhet', 'Amonkhet', 'akh hou'],
  ['strixhaven', 'Strixhaven (Arcavios)', 'stx sos soc'],
  ['kaldheim', 'Kaldheim', 'khm khc'],
  ['ikoria', 'Ikoria', 'iko'],
  ['capenna', 'New Capenna', 'snc ncc'],
  ['thunder', 'Thunder Junction', 'otj otc big'],
  ['bloomburrow', 'Bloomburrow', 'blb blc'],
  ['duskmourn', 'Duskmourn', 'dsk dsc'],
  ['eternities', 'Edge of Eternities', 'eoe eoc'],
  ['rath', 'Rath (Tempest)', 'tmp sth exo'],
  ['mercadia', 'Mercadia', 'mmq nem pcy'],
  ['fiora', 'Fiora (Conspiracy)', 'cns cn2'],
];

const TRIBES = [
  'Dragon', 'Angel', 'Demon', 'Elf', 'Goblin', 'Zombie', 'Vampire', 'Merfolk', 'Dinosaur', 'Wizard', 'Knight',
  'Soldier', 'Cat', 'Elemental', 'Spirit', 'Beast', 'Pirate', 'Faerie', 'Sliver', 'Eldrazi', 'Hydra', 'Giant',
  'Werewolf', 'Rogue', 'Cleric', 'Warrior', 'Sphinx', 'Horror', 'Bird', 'Snake', 'Wolf', 'Robot', 'Ninja', 'Samurai',
];
const PLURAL: Record<string, string> = { Elf: 'Elves', Werewolf: 'Werewolves', Wolf: 'Wolves', Sphinx: 'Sphinxes', Merfolk: 'Merfolk', Eldrazi: 'Eldrazi', Samurai: 'Samurai', Ninja: 'Ninjas', Faerie: 'Faeries' };
const plural = (t: string) => PLURAL[t] ?? `${t}s`;

const has = (c: Card, k: string) => abilitiesOf(c).keywords.has(k);
const isCreature = (c: Card) => c.types.includes('Creature');
const effectKinds = (c: Card) => {
  const a = abilitiesOf(c);
  return new Set([...a.spell, ...a.modes.flat(), ...a.triggers.flatMap((t) => t.effects), ...a.activated.flatMap((x) => x.effects)].map((e) => e.k));
};

const STYLES: Omit<Theme, 'group'>[] = [
  { id: 'flyers', name: 'Skies', blurb: 'Creatures with flying, and the spells that back them up.', match: (c) => has(c, 'Flying') || (!isCreature(c) && effectKinds(c).size > 0 && c.colors.some((x) => x === 'W' || x === 'U')) },
  { id: 'burn', name: 'Burn', blurb: 'Damage spells and creatures that hurt on arrival.', match: (c) => effectKinds(c).has('damage') || (isCreature(c) && has(c, 'Haste')) },
  { id: 'removal', name: 'Control', blurb: 'Destroy, exile, bounce and tap — answer everything.', match: (c) => ['destroy', 'bounce', 'tap', 'damage'].some((k) => effectKinds(c).has(k as never)) || (isCreature(c) && (c.toughness ?? 0) >= 4) },
  { id: 'tokens', name: 'Go Wide', blurb: 'Make tokens, then pump the team.', match: (c) => effectKinds(c).has('token') || abilitiesOf(c).anthem !== null || effectKinds(c).has('pump') },
  { id: 'counters', name: '+1/+1 Counters', blurb: 'Grow your creatures permanently.', match: (c) => effectKinds(c).has('counters') || abilitiesOf(c).entersWithCounters > 0 },
  { id: 'big', name: 'Big Stompy', blurb: 'Creatures with power 5 or more, and ramp to cast them.', match: (c) => (c.power ?? 0) >= 5 || abilitiesOf(c).mana !== null || (isCreature(c) && c.cmc <= 2 && c.colors.includes('G')) },
  { id: 'evasion', name: 'Deathtouch & Lifelink', blurb: 'Creatures that trade up and keep you alive.', match: (c) => has(c, 'Deathtouch') || has(c, 'Lifelink') || effectKinds(c).has('gain') },
  { id: 'vanilla', name: 'Vanilla Beaters', blurb: 'Creatures with no rules text, or only keywords — the purest Magic.', match: (c) => isCreature(c) && abilitiesOf(c).unsupported.length === 0 && abilitiesOf(c).triggers.length === 0 && abilitiesOf(c).activated.length === 0 },
  { id: 'artifacts', name: 'Artifacts', blurb: 'Artifact creatures, equipment and mana rocks.', match: (c) => c.types.includes('Artifact') },
  { id: 'legends', name: 'Legends', blurb: 'Only legendary creatures and spells.', match: (c) => c.supertypes.includes('Legendary') },
  { id: 'auras', name: 'Auras & Equipment', blurb: 'Suit up your creatures.', match: (c) => abilitiesOf(c).attach !== null || (isCreature(c) && c.cmc <= 3) },
];

const ERAS: [string, string, number, number][] = [
  ['alpha', 'Alpha & Beta (1993)', 1993, 1993],
  ['90s', 'The 1990s', 1993, 1999],
  ['00s', 'The 2000s', 2000, 2009],
  ['10s', 'The 2010s', 2010, 2019],
  ['20s', 'The 2020s', 2020, 2099],
  ['new', 'The last two years', new Date().getFullYear() - 1, 2099],
];

const SET_TYPES = new Set(['expansion', 'core', 'draft_innovation', 'commander', 'masters', 'starter', 'eternal', 'duel_deck', 'box']);

export const UNIVERSAL: Theme = {
  id: 'universal',
  group: 'Universal',
  name: 'Universal',
  blurb: 'Any card from the entire multiverse — every set, every franchise, every era.',
  match: () => true,
};

export function buildThemes(u: Universe): Theme[] {
  const themes: Theme[] = [UNIVERSAL];
  themes.push({ id: 'ub', group: 'Franchises', name: 'All Universes Beyond', blurb: 'Every crossover franchise at once.', match: (c) => c.universesBeyond });
  for (const [id, name, codes] of FRANCHISES) {
    const from = firstIn(codes);
    themes.push({ id: `f-${id}`, group: 'Franchises', name, blurb: `Cards that debuted in ${codes.split(' ').map((s) => u.setsByCode.get(s)?.n).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3).join(', ')}.`, match: from });
  }
  for (const [id, name, codes] of PLANES) {
    themes.push({ id: `p-${id}`, group: 'Planes', name, blurb: `Cards first printed in sets set on ${name.split(' (')[0]}.`, match: firstIn(codes) });
  }
  for (const t of TRIBES) {
    const re = new RegExp(`\\b${plural(t)}\\b`);
    themes.push({
      id: `t-${t.toLowerCase()}`,
      group: 'Creature types',
      name: plural(t),
      blurb: `${plural(t)} and the cards that care about them.`,
      tribal: true,
      match: (c) => c.subtypes.includes(t) || c.keywords.includes('Changeling') || re.test(c.text),
    });
  }
  for (const s of STYLES) themes.push({ ...s, id: `s-${s.id}`, group: 'Play styles' });
  for (const [id, name, from, to] of ERAS) {
    themes.push({ id: `e-${id}`, group: 'Eras', name, blurb: `Cards first printed ${from === to ? `in ${from}` : `between ${from} and ${Math.min(to, new Date().getFullYear())}`}.`, match: (c) => c.year >= from && c.year <= to });
  }
  for (const s of u.sets) {
    if (!SET_TYPES.has(s.t) || s.k < 40) continue;
    themes.push({ id: `set-${s.c}`, group: 'Sets', name: s.n, blurb: `${s.c.toUpperCase()} · ${s.d.slice(0, 4)} · ${s.k} cards`, match: (c) => c.sets.includes(s.c) });
  }
  return themes;
}

/** A theme from free text: every word must appear in the name, type line or rules text. */
export function searchTheme(query: string): Theme {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return {
    id: `q-${query}`,
    group: 'Search',
    name: `“${query}”`,
    blurb: 'Cards whose name, type or rules text contains every word.',
    match: (c) => {
      const hay = `${c.fullName}\n${c.typeLine}\n${c.text}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    },
  };
}
