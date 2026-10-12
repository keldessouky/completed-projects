// `npm run cards:update`: rebuild the card universe from Scryfall's bulk data.
//
// Downloads "Default Cards" (every English printing of every card, ~80 MB
// gzipped), folds the printings of each card into one record, and writes
// public/data/cards.json.gz — every real, playable-in-paper Magic card, with
// the sets it was printed in so decks can be built by franchise, plane or era.
//
//   node tools/build-cards.mjs                       download the latest bulk file
//   node tools/build-cards.mjs --from file.jsonl.gz  use a bulk file already on disk
//
// Card data and images are © Wizards of the Coast, served by Scryfall
// (https://scryfall.com/docs/api). Please keep requests polite: this script
// makes three, and the game itself only loads images from Scryfall's CDN.
import { createReadStream, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { createGunzip, gzipSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'data', 'cards.json.gz');
const args = process.argv.slice(2);
const from = args.includes('--from') ? args[args.indexOf('--from') + 1] : null;
const headers = { 'User-Agent': 'MultiverseDuel/1.0 (card snapshot builder)', Accept: 'application/json' };

async function getJson(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

// Not cards you can put in a deck: tokens, art cards, oversized planes, etc.
const SKIP_LAYOUTS = new Set([
  'token', 'double_faced_token', 'emblem', 'art_series', 'planar', 'scheme',
  'vanguard', 'front_card', 'host', 'augment', 'reversible_card',
]);
const SKIP_SET_TYPES = new Set(['token', 'memorabilia', 'funny', 'minigame', 'vanguard']);
const SKIP_TYPES = /^(Token|Card|Dungeon|Stickers|Conspiracy)\b|\b(Attraction|Contraption)\b/;
const MAIN_SET_TYPES = new Set(['expansion', 'core', 'draft_innovation', 'commander', 'starter', 'duel_deck', 'eternal']);

const TODAY = new Date().toISOString().slice(0, 10);

/** How good a printing is as the face of a card: a normal, black-bordered, in-set printing wins. */
function printingScore(c) {
  let s = 0;
  if (MAIN_SET_TYPES.has(c.set_type)) s += 6;
  else if (c.set_type === 'masters' || c.set_type === 'box') s += 2;
  if (c.promo) s -= 8;
  if (c.full_art || c.textless) s -= 3;
  if (c.border_color === 'black') s += 1;
  if ((c.frame_effects ?? []).some((f) => ['showcase', 'extendedart', 'inverted', 'etched'].includes(f))) s -= 2;
  if (c.highres_image) s += 1;
  if (c.lang !== 'en') s -= 4;
  if (c.released_at > TODAY) s -= 5; // previewed, not yet released
  return s;
}

/**
 * The "cool" printings: R serialized, B borderless, S showcase, E extended art,
 * M masterpiece, L Secret Lair, F full art, T etched/foil-etched frames.
 */
function variantKind(c) {
  const promo = new Set(c.promo_types ?? []);
  const fx = new Set(c.frame_effects ?? []);
  if (promo.has('serialized')) return 'R';
  if (c.border_color === 'borderless') return 'B';
  if (fx.has('showcase')) return 'S';
  if (fx.has('extendedart')) return 'E';
  if (c.set_type === 'masterpiece') return 'M';
  if (c.set === 'sld') return 'L';
  if (c.full_art) return 'F';
  if (fx.has('etched') || fx.has('inverted')) return 'T';
  return null;
}
const KIND_ORDER = 'RBSEMLFT';
const MAX_VARIANTS = 8;

const front = (c) => (c.card_faces ? c.card_faces[0] : c);

async function lines() {
  let stream;
  if (from) {
    stream = createReadStream(from);
  } else {
    const bulk = await getJson('https://api.scryfall.com/bulk-data/default-cards');
    const url = bulk.jsonl_download_uri ?? bulk.download_uri;
    console.log(`Downloading ${url} …`);
    const res = await fetch(url, { headers: { 'User-Agent': headers['User-Agent'] } });
    if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
    stream = Readable.fromWeb(res.body);
  }
  const gz = (from ?? '').endsWith('.json') || (from ?? '').endsWith('.jsonl') ? stream : stream.pipe(createGunzip());
  return createInterface({ input: gz, crlfDelay: Infinity });
}

const byOracle = new Map();
let printings = 0;
for await (let line of await lines()) {
  line = line.trim();
  if (line.endsWith(',')) line = line.slice(0, -1);
  if (!line.startsWith('{')) continue;
  const c = JSON.parse(line);
  if (!c.oracle_id || c.digital || c.oversized) continue;
  if (SKIP_LAYOUTS.has(c.layout) || SKIP_SET_TYPES.has(c.set_type)) continue;
  if (c.border_color === 'silver' || c.border_color === 'gold') continue;
  if (SKIP_TYPES.test(c.type_line ?? '')) continue;
  if (!c.image_uris && !c.card_faces?.[0]?.image_uris) continue;
  printings++;
  let rec = byOracle.get(c.oracle_id);
  if (!rec) {
    rec = { best: c, score: printingScore(c), sets: new Set(), first: null, ub: true, variants: [] };
    byOracle.set(c.oracle_id, rec);
  } else {
    const s = printingScore(c);
    if (s > rec.score || (s === rec.score && c.released_at > rec.best.released_at)) {
      rec.best = c;
      rec.score = s;
    }
  }
  rec.sets.add(c.set);
  const kind = variantKind(c);
  // Special printings (English, plus serialized cards in any language — like the 1-of-1 One Ring).
  if (kind && (c.lang === 'en' || kind === 'R')) rec.variants.push({ id: c.id, kind, set: c.set, date: c.released_at, lang: c.lang, cn: c.collector_number });
  const original = !c.promo && c.set_type !== 'promo';
  if (original && (!rec.first || c.released_at < rec.first.released_at)) rec.first = c;
  // A Universes Beyond card is one that has never been printed outside Universes Beyond.
  if (original && c.security_stamp !== 'triangle') rec.ub = false;
}

const sets = await getJson('https://api.scryfall.com/sets');
const setInfo = new Map(sets.data.map((s) => [s.code, s]));

const cards = [];
const usedSets = new Map();
const COLOR_ORDER = 'WUBRG';
const colorsOf = (cost) => [...COLOR_ORDER].filter((col) => new RegExp(`\\{[^}]*${col}[^}]*\\}`).test(cost ?? ''));
for (const { best: c, sets: printedIn, first: firstPrinting, ub, variants } of byOracle.values()) {
  const f = front(c);
  const first = firstPrinting ?? c;
  const card = {
    i: c.id,
    n: f.name,
    m: f.mana_cost ?? c.mana_cost ?? '',
    t: f.type_line ?? c.type_line,
    o: f.oracle_text ?? '',
    cl: (f.colors ?? (c.card_faces ? colorsOf(f.mana_cost) : c.colors) ?? []).join(''),
    ci: (c.color_identity ?? []).join(''),
    k: c.keywords ?? [],
    s: c.set,
    r: c.rarity[0],
    y: Number(first.released_at.slice(0, 4)),
    fs: first.set,
    ss: [...printedIn].join(' '),
    a: c.artist ?? '',
  };
  if (c.name !== f.name) card.fn = c.name;
  if (f.power !== undefined) {
    card.p = f.power;
    card.tg = f.toughness;
  }
  if (f.loyalty !== undefined) card.l = f.loyalty;
  if (c.card_faces?.[1]?.image_uris) card.b = 1;
  if (ub) card.ub = 1;
  // Coolest first: serialized, then borderless, showcase, …; newest first within a kind.
  const vs = variants
    .filter((v) => v.id !== c.id)
    // Within a kind: a #0 (the one-of-one serialized One Ring) first, then newest.
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || Number(b.cn === '0') - Number(a.cn === '0') || b.date.localeCompare(a.date))
    .slice(0, MAX_VARIANTS);
  if (vs.length) card.v = vs.map((v) => `${v.id}:${v.kind}:${v.set}:${v.cn === '0' ? '1of1' : v.lang !== 'en' ? v.lang : ''}`).join('|');
  // How widely the card is played (1 = most popular); a strong signal of card quality.
  if (c.edhrec_rank) card.e = c.edhrec_rank;
  const flavor = f.flavor_text ?? c.flavor_text;
  if (flavor && flavor.length < 160) card.ft = flavor;
  cards.push(card);
  for (const code of printedIn) usedSets.set(code, (usedSets.get(code) ?? 0) + 1);
}
cards.sort((a, b) => a.n.localeCompare(b.n));

const setList = [...usedSets.entries()]
  .map(([code, count]) => {
    const s = setInfo.get(code);
    return s ? { c: code, n: s.name, t: s.set_type, d: s.released_at ?? '', p: s.parent_set_code ?? '', k: count } : null;
  })
  .filter(Boolean)
  .sort((a, b) => b.d.localeCompare(a.d));

const snapshot = { generated: new Date().toISOString().slice(0, 10), printings, sets: setList, cards };
mkdirSync(dirname(out), { recursive: true });
const gz = gzipSync(JSON.stringify(snapshot), { level: 9 });
writeFileSync(out, gz);
console.log(`${cards.length} cards from ${printings} printings in ${setList.length} sets → ${out} (${(gz.length / 1e6).toFixed(1)} MB)`);
