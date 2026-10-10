// The rules of a simple duel: two players, 20 life, 40-card decks.
//
// Simplifications (shown to the player in the How to play panel):
//  - no stack: spells and abilities resolve as soon as they're cast;
//  - instants, flash and activated abilities can be used in your main phases,
//    after blockers are declared when you attack, and while you declare blockers;
//  - mana is paid automatically from your untapped lands and mana sources;
//  - targets of triggers other than "enters" abilities are chosen automatically.
import type { Card, Color } from '../data/cards';
import {
  abilitiesOf, describeEffect, targetSlots,
  type Abilities, type Effect, type Filter, type Target, type TargetSpec,
} from './abilities';
import { parseCost, planPayment, type ManaCost, type ManaSource } from './mana';
import { makeRng, shuffle, type Rng } from './rng';

export type PlayerId = 0 | 1;
export const other = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0);

export interface CardRef {
  iid: number;
  card: Card;
}

export interface Perm extends CardRef {
  owner: PlayerId;
  controller: PlayerId;
  tapped: boolean;
  damage: number;
  deathtouched: boolean;
  counters: number;
  enteredTurn: number;
  token: boolean;
  attachedTo: number | null;
  temp: { p: number; t: number; kw: string[] }[];
}

export interface Player {
  id: PlayerId;
  name: string;
  life: number;
  library: CardRef[];
  hand: CardRef[];
  graveyard: CardRef[];
  exile: CardRef[];
  battlefield: Perm[];
  landsPlayed: number;
  drewFromEmpty: boolean;
}

export type Phase = 'main1' | 'attack' | 'block' | 'combat' | 'main2' | 'over';

export type TargetRef = { kind: 'player'; id: PlayerId } | { kind: 'perm'; iid: number };

export interface LogEntry {
  turn: number;
  who: PlayerId | null;
  text: string;
}

export interface CastChoice {
  mode?: number;
  targets: (TargetRef | null)[];
}

export interface Combat {
  attackers: number[];
  /** attacker iid → blocker iids */
  blocks: Record<number, number[]>;
}

const KW_VALUE: Record<string, number> = {
  Flying: 2, Deathtouch: 2, Lifelink: 1.2, 'First strike': 1.5, 'Double strike': 3, Trample: 1, Menace: 1,
  Hexproof: 1, Indestructible: 3, Vigilance: 0.5, Haste: 0.5, Reach: 0.5, Unblockable: 2, Prowess: 0.5,
};

let tokenSerial = 0;
function tokenCard(name: string, p: number, t: number, colors: Color[], kw: string[]): Card {
  return {
    id: `token-${++tokenSerial}`,
    name: `${name} Token`,
    fullName: `${name} Token`,
    cost: '',
    cmc: 0,
    typeLine: `Token Creature — ${name}`,
    types: ['Creature'],
    subtypes: name.split(' '),
    supertypes: [],
    text: kw.join(', '),
    power: p,
    toughness: t,
    powerText: String(p),
    toughnessText: String(t),
    colors,
    identity: colors,
    keywords: kw,
    set: '',
    firstSet: '',
    sets: [],
    rarity: 'c',
    year: 0,
    artist: '',
    hasBack: false,
    universesBeyond: false,
  };
}

export class Game {
  players: [Player, Player];
  active: PlayerId;
  turn = 1;
  phase: Phase = 'main1';
  combat: Combat | null = null;
  log: LogEntry[] = [];
  winner: PlayerId | 'draw' | null = null;
  /** Bumped on every change, so a UI can re-render cheaply. */
  version = 0;
  rng: Rng;
  private nextIid = 1;
  private readonly maxTurns: number;

  constructor(decks: [Card[], Card[]], opts: { seed?: number; names?: [string, string]; first?: PlayerId; maxTurns?: number } = {}) {
    this.rng = makeRng(opts.seed ?? Date.now());
    this.maxTurns = opts.maxTurns ?? 80;
    const names = opts.names ?? ['You', 'Opponent'];
    const players: Player[] = ([0, 1] as PlayerId[]).map((id) => ({
      id,
      name: names[id],
      life: 20,
      library: shuffle(decks[id].map((card) => ({ iid: this.nextIid++, card })), this.rng),
      hand: [],
      graveyard: [],
      exile: [],
      battlefield: [],
      landsPlayed: 0,
      drewFromEmpty: false,
    }));
    this.players = [players[0], players[1]];
    this.active = opts.first ?? (this.rng() < 0.5 ? 0 : 1);
    for (const p of this.players) this.openingHand(p);
    this.say(null, `${this.players[this.active].name} ${this.active === 0 ? 'go' : 'goes'} first.`);
  }

  // ------------------------------------------------------------ helpers

  private say(who: PlayerId | null, text: string) {
    this.log.push({ turn: this.turn, who, text });
    if (this.log.length > 400) this.log.splice(0, this.log.length - 400);
  }

  private touch() {
    this.version++;
  }

  /** Seven cards; one free redraw if the hand has fewer than 2 or more than 5 lands. */
  private openingHand(p: Player) {
    for (let attempt = 0; attempt < 2; attempt++) {
      for (let i = 0; i < 7; i++) this.drawCard(p.id, true);
      const lands = p.hand.filter((c) => c.card.types.includes('Land')).length;
      if ((lands >= 2 && lands <= 5) || attempt === 1) return;
      p.library.push(...p.hand.splice(0));
      p.library = shuffle(p.library, this.rng);
    }
  }

  ab(c: CardRef): Abilities {
    return abilitiesOf(c.card);
  }

  allPerms(): Perm[] {
    return [...this.players[0].battlefield, ...this.players[1].battlefield];
  }

  perm(iid: number): Perm | undefined {
    return this.players[0].battlefield.find((x) => x.iid === iid) ?? this.players[1].battlefield.find((x) => x.iid === iid);
  }

  isCreature(p: Perm) {
    return p.card.types.includes('Creature');
  }

  creatures(pid: PlayerId): Perm[] {
    return this.players[pid].battlefield.filter((p) => this.isCreature(p));
  }

  private attachments(p: Perm): Perm[] {
    return this.allPerms().filter((x) => x.attachedTo === p.iid);
  }

  private anthems(p: Perm) {
    const out: { p: number; t: number; kw: string[] }[] = [];
    for (const src of this.players[p.controller].battlefield) {
      const a = this.ab(src).anthem;
      if (a && !(a.other && src.iid === p.iid)) out.push(a);
    }
    return out;
  }

  power(p: Perm): number {
    let n = (p.card.power ?? 0) + p.counters;
    for (const t of p.temp) n += t.p;
    for (const a of this.attachments(p)) n += this.ab(a).attach?.p ?? 0;
    for (const a of this.anthems(p)) n += a.p;
    return n;
  }

  toughness(p: Perm): number {
    let n = (p.card.toughness ?? 0) + p.counters;
    for (const t of p.temp) n += t.t;
    for (const a of this.attachments(p)) n += this.ab(a).attach?.t ?? 0;
    for (const a of this.anthems(p)) n += a.t;
    return n;
  }

  keywords(p: Perm): Set<string> {
    const k = new Set(this.ab(p).keywords);
    for (const t of p.temp) t.kw.forEach((x) => k.add(x));
    for (const a of this.attachments(p)) this.ab(a).attach?.kw.forEach((x) => k.add(x));
    for (const a of this.anthems(p)) a.kw.forEach((x) => k.add(x));
    return k;
  }

  has(p: Perm, kw: string) {
    return this.keywords(p).has(kw);
  }

  isSick(p: Perm) {
    return this.isCreature(p) && p.enteredTurn === this.turn && !this.has(p, 'Haste');
  }

  /** How much a creature matters — used by the AI and by automatic targeting. */
  value(p: Perm): number {
    if (!this.isCreature(p)) return 1 + p.card.cmc * 0.6;
    let v = this.power(p) * 1.5 + this.toughness(p) + p.card.cmc * 0.3;
    for (const k of this.keywords(p)) v += KW_VALUE[k] ?? 0;
    v += this.ab(p).activated.length * 1.5 + (this.ab(p).anthem ? 3 : 0);
    return v;
  }

  // --------------------------------------------------------------- mana

  manaSources(pid: PlayerId): ManaSource[] {
    const out: ManaSource[] = [];
    for (const p of this.players[pid].battlefield) {
      const m = this.ab(p).mana;
      if (!m || p.tapped) continue;
      if (this.isCreature(p) && this.isSick(p)) continue;
      out.push({ iid: p.iid, options: m.options, amount: m.amount, penalty: p.card.types.includes('Land') ? 0 : 1 });
    }
    return out;
  }

  availableMana(pid: PlayerId) {
    return this.manaSources(pid).reduce((n, s) => n + s.amount, 0);
  }

  canPay(pid: PlayerId, cost: ManaCost, exclude?: number) {
    return planPayment(cost, this.manaSources(pid).filter((s) => s.iid !== exclude)) !== null;
  }

  private pay(pid: PlayerId, cost: ManaCost, exclude?: number): boolean {
    const plan = planPayment(cost, this.manaSources(pid).filter((s) => s.iid !== exclude));
    if (!plan) return false;
    for (const iid of plan) this.perm(iid)!.tapped = true;
    return true;
  }

  // ------------------------------------------------------------ timing

  /** Can `pid` cast instants / activate abilities right now? */
  hasPriority(pid: PlayerId): boolean {
    if (this.winner !== null) return false;
    if (pid === this.active) return this.phase === 'main1' || this.phase === 'main2' || this.phase === 'combat';
    return this.phase === 'block';
  }

  private sorcerySpeed(pid: PlayerId) {
    return this.winner === null && pid === this.active && (this.phase === 'main1' || this.phase === 'main2');
  }

  isInstantSpeed(card: Card) {
    return card.types.includes('Instant') || abilitiesOf(card).keywords.has('Flash');
  }

  canPlayLand(pid: PlayerId, iid: number): boolean {
    const c = this.players[pid].hand.find((x) => x.iid === iid);
    return !!c && c.card.types.includes('Land') && this.sorcerySpeed(pid) && this.players[pid].landsPlayed === 0;
  }

  // ----------------------------------------------------------- targets

  /** The modes / effects a card does when cast, plus its "enters" triggers. */
  castEffects(card: Card, mode = 0): { effects: Effect[]; etb: Effect[] } {
    const a = abilitiesOf(card);
    const effects = a.modes.length ? a.modes[Math.min(mode, a.modes.length - 1)] : a.spell;
    const etb = a.triggers.filter((t) => t.when === 'etb').flatMap((t) => t.effects);
    return { effects, etb };
  }

  /** Every target the caster must choose, in order: aura host, spell targets, then enters-trigger targets. */
  castSlots(card: Card, mode = 0): { spec: TargetSpec; required: boolean; label: string }[] {
    const a = abilitiesOf(card);
    const out: { spec: TargetSpec; required: boolean; label: string }[] = [];
    if (a.attach?.kind === 'aura') {
      out.push({ spec: { sel: 'target', what: 'creature', ctrl: a.attach.auraOnOpponent ? undefined : 'you' }, required: true, label: 'Enchant which creature?' });
    }
    const { effects, etb } = this.castEffects(card, mode);
    for (const e of effects) for (const s of targetSlots([e])) out.push({ spec: s, required: !s.optional, label: describeEffect(e) });
    for (const e of etb) for (const s of targetSlots([e])) out.push({ spec: s, required: false, label: `When it enters: ${describeEffect(e)}` });
    return out;
  }

  private matchesFilter(p: Perm, f: Filter | undefined, source: number | null): boolean {
    if (!f) return true;
    if (f.another && p.iid === source) return false;
    if (f.tapped !== undefined && p.tapped !== f.tapped) return false;
    const attacking = !!this.combat?.attackers.includes(p.iid);
    const blocking = !!this.combat && Object.values(this.combat.blocks).some((b) => b.includes(p.iid));
    if (f.attacking && !attacking) return false;
    if (f.blocking && !blocking) return false;
    if (f.attackingOrBlocking && !attacking && !blocking) return false;
    if (f.notColor && f.notColor.some((c) => p.card.colors.includes(c))) return false;
    if (f.color && !f.color.some((c) => p.card.colors.includes(c))) return false;
    if (f.flying && !this.has(p, 'Flying')) return false;
    if (f.noFlying && this.has(p, 'Flying')) return false;
    if (f.powerMax !== undefined && this.power(p) > f.powerMax) return false;
    if (f.powerMin !== undefined && this.power(p) < f.powerMin) return false;
    if (f.mvMax !== undefined && p.card.cmc > f.mvMax) return false;
    if (f.mvMin !== undefined && p.card.cmc < f.mvMin) return false;
    if (f.nonToken && p.token) return false;
    return true;
  }

  private permMatches(p: Perm, spec: TargetSpec, pid: PlayerId, source: number | null): boolean {
    const t = p.card.types;
    const ok = {
      any: t.includes('Creature'),
      creature: t.includes('Creature'),
      player: false,
      permanent: true,
      artifact: t.includes('Artifact'),
      enchantment: t.includes('Enchantment'),
      'artifact-enchantment': t.includes('Artifact') || t.includes('Enchantment'),
      land: t.includes('Land'),
      nonland: !t.includes('Land'),
      'creature-land': t.includes('Creature') || t.includes('Land'),
    }[spec.what];
    if (!ok) return false;
    if (spec.ctrl === 'you' && p.controller !== pid) return false;
    if (spec.ctrl === 'opp' && p.controller === pid) return false;
    if (this.has(p, 'Shroud')) return false;
    if (this.has(p, 'Hexproof') && p.controller !== pid) return false;
    return this.matchesFilter(p, spec.filter, source);
  }

  legalTargets(pid: PlayerId, spec: TargetSpec, source: number | null = null): TargetRef[] {
    const out: TargetRef[] = [];
    if (spec.what === 'any' || spec.what === 'player') {
      for (const id of [other(pid), pid] as PlayerId[]) {
        if (spec.ctrl === 'opp' && id === pid) continue;
        out.push({ kind: 'player', id });
      }
    }
    if (spec.what !== 'player') {
      for (const p of this.allPerms()) if (this.permMatches(p, spec, pid, source)) out.push({ kind: 'perm', iid: p.iid });
    }
    return out;
  }

  isLegalTarget(pid: PlayerId, spec: TargetSpec, ref: TargetRef, source: number | null = null) {
    return this.legalTargets(pid, spec, source).some((r) => sameRef(r, ref));
  }

  /** Put a card straight into a zone — for tests and set-up scenarios. */
  put(pid: PlayerId, card: Card, zone: 'hand' | 'battlefield' | 'library' = 'battlefield', opts: { sick?: boolean } = {}): number {
    const ref = { iid: this.nextIid++, card };
    if (zone === 'battlefield') {
      const p = this.enter(pid, ref);
      if (!opts.sick) p.enteredTurn = -1;
    } else this.players[pid][zone].unshift(ref);
    this.touch();
    return ref.iid;
  }

  // ------------------------------------------------------------ casting

  /** Why `pid` can't cast this card now, or null if they can. */
  whyNotCast(pid: PlayerId, iid: number): string | null {
    const c = this.players[pid].hand.find((x) => x.iid === iid);
    if (!c) return 'Not in hand.';
    if (c.card.types.includes('Land')) return this.canPlayLand(pid, iid) ? null : this.players[pid].landsPlayed ? 'You already played a land this turn.' : 'Lands are played in your main phase.';
    if (!(this.isInstantSpeed(c.card) ? this.hasPriority(pid) : this.sorcerySpeed(pid))) {
      return this.isInstantSpeed(c.card) ? 'Not now.' : 'Only in your main phase.';
    }
    const cost = parseCost(c.card.cost);
    if (!this.canPay(pid, cost)) return 'Not enough mana.';
    const a = this.ab(c);
    const spell = c.card.types.includes('Instant') || c.card.types.includes('Sorcery');
    if (spell && !a.spell.length && !a.modes.length) return 'This game can’t simulate this spell.';
    const modes = a.modes.length ? a.modes.length : 1;
    for (let mode = 0; mode < modes; mode++) {
      const slots = this.castSlots(c.card, mode);
      if (slots.every((s) => !s.required || this.legalTargets(pid, s.spec).length > 0)) return null;
    }
    return 'No legal targets.';
  }

  canCast(pid: PlayerId, iid: number) {
    return this.whyNotCast(pid, iid) === null;
  }

  playLand(pid: PlayerId, iid: number): boolean {
    if (!this.canPlayLand(pid, iid)) return false;
    const p = this.players[pid];
    const c = p.hand.splice(p.hand.findIndex((x) => x.iid === iid), 1)[0];
    p.landsPlayed++;
    this.enter(pid, c);
    this.say(pid, `${p.name} played ${c.card.name}.`);
    this.touch();
    return true;
  }

  cast(pid: PlayerId, iid: number, choice: CastChoice = { targets: [] }): boolean {
    if (this.canPlayLand(pid, iid)) return this.playLand(pid, iid);
    if (!this.canCast(pid, iid)) return false;
    const p = this.players[pid];
    const c = p.hand.find((x) => x.iid === iid)!;
    const slots = this.castSlots(c.card, choice.mode ?? 0);
    // Validate the chosen targets; required ones must be legal.
    const targets = slots.map((s, i) => {
      const t = choice.targets[i] ?? null;
      return t && this.isLegalTarget(pid, s.spec, t) ? t : null;
    });
    if (slots.some((s, i) => s.required && !targets[i])) return false;
    if (!this.pay(pid, parseCost(c.card.cost))) return false;
    p.hand.splice(p.hand.indexOf(c), 1);
    const a = this.ab(c);
    const modeText = a.modes.length > 1 ? ` (mode ${(choice.mode ?? 0) + 1})` : '';
    this.say(pid, `${p.name} cast ${c.card.name}${modeText}${describeTargets(this, targets)}.`);

    if (!c.card.types.includes('Creature')) {
      for (const perm of p.battlefield) if (this.has(perm, 'Prowess')) perm.temp.push({ p: 1, t: 1, kw: [] });
    }
    const isPermanent = !c.card.types.includes('Instant') && !c.card.types.includes('Sorcery');
    if (isPermanent) {
      let rest = targets;
      const perm = this.enter(pid, c);
      if (a.attach?.kind === 'aura') {
        const host = rest[0];
        rest = rest.slice(1);
        if (host?.kind === 'perm') perm.attachedTo = host.iid;
      }
      const { etb } = this.castEffects(c.card);
      if (etb.length) this.resolve(pid, perm.iid, etb, rest);
    } else {
      const { effects } = this.castEffects(c.card, choice.mode ?? 0);
      this.resolve(pid, null, effects, targets);
      p.graveyard.push(c);
    }
    this.checkState();
    this.touch();
    return true;
  }

  private enter(pid: PlayerId, c: CardRef, token = false): Perm {
    const a = abilitiesOf(c.card);
    const perm: Perm = {
      ...c,
      owner: pid,
      controller: pid,
      tapped: a.entersTapped,
      damage: 0,
      deathtouched: false,
      counters: a.entersWithCounters,
      enteredTurn: this.turn,
      token,
      attachedTo: null,
      temp: [],
    };
    this.players[pid].battlefield.push(perm);
    return perm;
  }

  // --------------------------------------------------------- activation

  /** Activated abilities of a permanent that `pid` could use right now. */
  usableAbilities(pid: PlayerId, iid: number): number[] {
    const perm = this.perm(iid);
    if (!perm || perm.controller !== pid || !this.hasPriority(pid)) return [];
    return this.ab(perm).activated.flatMap((act, i) => {
      if (act.tap && (perm.tapped || this.isSick(perm))) return [];
      if (!this.canPay(pid, act.cost, act.tap ? perm.iid : undefined)) return [];
      const slots = targetSlots(act.effects);
      if (slots.some((s) => !s.optional && this.legalTargets(pid, s, perm.iid).length === 0)) return [];
      return [i];
    });
  }

  activate(pid: PlayerId, iid: number, index: number, targets: (TargetRef | null)[] = []): boolean {
    if (!this.usableAbilities(pid, iid).includes(index)) return false;
    const perm = this.perm(iid)!;
    const act = this.ab(perm).activated[index];
    const slots = targetSlots(act.effects);
    const chosen = slots.map((s, i) => (targets[i] && this.isLegalTarget(pid, s, targets[i]!, perm.iid) ? targets[i] : null));
    if (slots.some((s, i) => !s.optional && !chosen[i])) return false;
    if (!this.pay(pid, act.cost, act.tap ? perm.iid : undefined)) return false;
    if (act.tap) perm.tapped = true;
    this.say(pid, `${this.players[pid].name} activated ${perm.card.name}: ${act.effects.map(describeEffect).join(', ')}${describeTargets(this, chosen)}.`);
    this.resolve(pid, perm.iid, act.effects, chosen);
    this.checkState();
    this.touch();
    return true;
  }

  canEquip(pid: PlayerId, equipIid: number): boolean {
    const eq = this.perm(equipIid);
    const cost = eq && this.ab(eq).attach?.equip;
    return !!eq && !!cost && eq.controller === pid && this.sorcerySpeed(pid) && this.canPay(pid, cost) && this.creatures(pid).length > 0;
  }

  equip(pid: PlayerId, equipIid: number, creatureIid: number): boolean {
    const eq = this.perm(equipIid);
    const target = this.perm(creatureIid);
    if (!eq || !target || !this.canEquip(pid, equipIid) || target.controller !== pid || !this.isCreature(target)) return false;
    if (eq.attachedTo === creatureIid) return false;
    if (!this.pay(pid, this.ab(eq).attach!.equip!)) return false;
    eq.attachedTo = creatureIid;
    this.say(pid, `${this.players[pid].name} equipped ${target.card.name} with ${eq.card.name}.`);
    this.touch();
    return true;
  }

  // ------------------------------------------------------------ effects

  /** Resolve effects for `pid`; chosen targets are consumed in slot order. */
  resolve(pid: PlayerId, source: number | null, effects: Effect[], chosen: (TargetRef | null)[]) {
    let slot = 0;
    const src = source !== null ? this.perm(source) : undefined;
    const pick = (t: Target): TargetRef[] => {
      switch (t.sel) {
        case 'target': {
          const ref = chosen[slot++] ?? null;
          if (!ref) return [];
          if (ref.kind === 'perm' && !this.perm(ref.iid)) return [];
          return [ref];
        }
        case 'self':
          return src && this.perm(src.iid) ? [{ kind: 'perm', iid: src.iid }] : [];
        case 'you':
          return [{ kind: 'player', id: pid }];
        case 'each-opp':
          return [{ kind: 'player', id: other(pid) }];
        case 'each-player':
          return [{ kind: 'player', id: pid }, { kind: 'player', id: other(pid) }];
        case 'all-creatures':
          return this.allPerms()
            .filter((p) => this.isCreature(p))
            .filter((p) => !t.ctrl || (t.ctrl === 'you') === (p.controller === pid))
            .filter((p) => !t.other || p.iid !== source)
            .filter((p) => this.matchesFilter(p, t.filter, source))
            .map((p) => ({ kind: 'perm' as const, iid: p.iid }));
      }
    };
    const perms = (refs: TargetRef[]) => refs.flatMap((r) => (r.kind === 'perm' ? [this.perm(r.iid)!].filter(Boolean) : []));
    const lifelink = !!src && this.has(src, 'Lifelink');
    const deathtouch = !!src && this.has(src, 'Deathtouch');

    for (const e of effects) {
      switch (e.k) {
        case 'damage':
          for (const t of e.to) for (const r of pick(t)) this.dealDamage(r, e.n, deathtouch, lifelink ? pid : null);
          break;
        case 'destroy':
          for (const p of perms(pick(e.to))) {
            if (e.exile) this.leave(p, 'exile');
            else if (!this.has(p, 'Indestructible')) this.leave(p, 'graveyard');
          }
          break;
        case 'bounce':
          for (const p of perms(pick(e.to))) this.leave(p, 'hand');
          break;
        case 'tap':
          for (const p of perms(pick(e.to))) p.tapped = true;
          break;
        case 'untap':
          for (const p of perms(pick(e.to))) p.tapped = false;
          break;
        case 'pump':
          for (const p of perms(pick(e.to))) p.temp.push({ p: e.p, t: e.t, kw: e.kw });
          break;
        case 'counters':
          for (const p of perms(pick(e.to))) p.counters += e.n;
          break;
        case 'draw':
          for (let i = 0; i < e.n; i++) this.drawCard(pid);
          break;
        case 'gain':
          this.players[pid].life += e.n;
          break;
        case 'lose':
          for (const r of pick(e.who)) if (r.kind === 'player') this.players[r.id].life -= e.n;
          break;
        case 'token':
          for (let i = 0; i < e.count; i++) {
            this.enter(pid, { iid: this.nextIid++, card: tokenCard(e.name, e.p, e.t, e.colors, e.kw) }, true);
          }
          break;
        case 'discard':
          for (const r of pick(e.who)) if (r.kind === 'player') this.discardRandom(r.id, e.n);
          break;
        case 'self-discard':
          this.discardWorst(pid, e.n);
          break;
        case 'fight': {
          const [a] = perms(pick(e.a));
          const [b] = perms(pick(e.b));
          if (a && b && this.isCreature(a) && this.isCreature(b)) {
            this.dealDamage({ kind: 'perm', iid: b.iid }, this.power(a), this.has(a, 'Deathtouch'), this.has(a, 'Lifelink') ? a.controller : null);
            this.dealDamage({ kind: 'perm', iid: a.iid }, this.power(b), this.has(b, 'Deathtouch'), this.has(b, 'Lifelink') ? b.controller : null);
          }
          break;
        }
      }
    }
  }

  private dealDamage(ref: TargetRef, n: number, deathtouch: boolean, lifelinkTo: PlayerId | null) {
    if (n <= 0) return;
    if (ref.kind === 'player') this.players[ref.id].life -= n;
    else {
      const p = this.perm(ref.iid);
      if (!p || !this.isCreature(p)) return;
      p.damage += n;
      if (deathtouch) p.deathtouched = true;
    }
    if (lifelinkTo !== null) this.players[lifelinkTo].life += n;
  }

  /** Remove a permanent from the battlefield; auras on it go too, equipment stays. */
  private leave(p: Perm, to: 'graveyard' | 'exile' | 'hand') {
    const ctrl = this.players[p.controller];
    const i = ctrl.battlefield.indexOf(p);
    if (i < 0) return;
    ctrl.battlefield.splice(i, 1);
    if (this.combat) {
      this.combat.attackers = this.combat.attackers.filter((x) => x !== p.iid);
      for (const k of Object.keys(this.combat.blocks)) this.combat.blocks[+k] = this.combat.blocks[+k].filter((x) => x !== p.iid);
    }
    for (const a of this.allPerms().filter((x) => x.attachedTo === p.iid)) {
      if (this.ab(a).attach?.kind === 'aura') this.leave(a, 'graveyard');
      else a.attachedTo = null;
    }
    if (!p.token) this.players[p.owner][to === 'hand' ? 'hand' : to === 'exile' ? 'exile' : 'graveyard'].push({ iid: p.iid, card: p.card });
    if (to === 'graveyard' && this.isCreature(p)) {
      this.say(p.controller, `${p.card.name} died.`);
      const dies = this.ab(p).triggers.filter((t) => t.when === 'dies');
      for (const t of dies) this.autoResolve(p.controller, null, t.effects, `${p.card.name}: ${t.text}`);
    } else if (to === 'exile') this.say(p.controller, `${p.card.name} was exiled.`);
    else if (to === 'hand') this.say(p.controller, `${p.card.name} returned to its owner’s hand.`);
  }

  /** Resolve a triggered ability, choosing its targets automatically for its controller. */
  autoResolve(pid: PlayerId, source: number | null, effects: Effect[], label: string) {
    const chosen = targetSlots(effects).map((spec, i) => {
      const { effect, index } = slotOwner(effects, i);
      return autoTarget(this, pid, spec, effect, source, index);
    });
    const named = chosen.filter((t): t is TargetRef => !!t).map((t) => refName(this, t));
    this.say(pid, `${label.replace(/\s*\([^)]*\)/g, '')}${named.length ? ` → ${named.join(', ')}` : ''}`);
    this.resolve(pid, source, effects, chosen);
  }

  drawCard(pid: PlayerId, silent = false) {
    const p = this.players[pid];
    const c = p.library.shift();
    if (!c) {
      p.drewFromEmpty = true;
      if (!silent) this.say(pid, `${p.name} tried to draw from an empty library.`);
      return;
    }
    p.hand.push(c);
  }

  private discardRandom(pid: PlayerId, n: number) {
    const p = this.players[pid];
    for (let i = 0; i < n && p.hand.length; i++) {
      const [c] = p.hand.splice(Math.floor(this.rng() * p.hand.length), 1);
      p.graveyard.push(c);
      this.say(pid, `${p.name} discarded ${c.card.name}.`);
    }
  }

  /** Discard the least useful cards: extra lands when flooded, otherwise the most expensive. */
  discardWorst(pid: PlayerId, n: number) {
    const p = this.players[pid];
    for (let i = 0; i < n && p.hand.length; i++) {
      const lands = p.hand.filter((c) => c.card.types.includes('Land'));
      const landsOut = p.battlefield.filter((x) => x.card.types.includes('Land')).length;
      const pick = lands.length && (landsOut >= 5 || lands.length >= 3)
        ? lands[0]
        : [...p.hand].sort((a, b) => b.card.cmc - a.card.cmc)[0];
      p.hand.splice(p.hand.indexOf(pick), 1);
      p.graveyard.push(pick);
      this.say(pid, `${p.name} discarded ${pick.card.name}.`);
    }
  }

  // ------------------------------------------------------- state checks

  checkState() {
    for (let loop = 0; loop < 20; loop++) {
      let changed = false;
      for (const p of this.allPerms()) {
        if (!this.isCreature(p)) continue;
        const t = this.toughness(p);
        const lethal = t <= 0 || (!this.has(p, 'Indestructible') && (p.damage >= t || (p.deathtouched && p.damage > 0)));
        if (lethal) {
          this.leave(p, 'graveyard');
          changed = true;
        }
      }
      for (const p of this.allPerms()) {
        if (p.attachedTo !== null && !this.perm(p.attachedTo)) {
          if (this.ab(p).attach?.kind === 'aura') this.leave(p, 'graveyard');
          else p.attachedTo = null;
          changed = true;
        }
        if (this.ab(p).attach?.kind === 'aura' && p.attachedTo === null) {
          this.leave(p, 'graveyard');
          changed = true;
        }
      }
      if (!changed) break;
    }
    const lost = this.players.map((p) => p.life <= 0 || p.drewFromEmpty);
    if (lost[0] || lost[1]) {
      this.winner = lost[0] && lost[1] ? 'draw' : lost[0] ? 1 : 0;
      this.phase = 'over';
      this.combat = null;
      this.say(null, this.winner === 'draw' ? 'The game is a draw.' : `${this.players[this.winner].name} ${this.winner === 0 ? 'win' : 'wins'}!`);
    }
  }

  // ------------------------------------------------------------ combat

  canAttack(p: Perm): boolean {
    return this.isCreature(p) && p.controller === this.active && !p.tapped && !this.isSick(p) &&
      !this.has(p, 'Defender') && !this.attachments(p).some((a) => this.ab(a).attach?.cantAttackOrBlock);
  }

  canBlock(blocker: Perm, attacker: Perm): boolean {
    if (!this.isCreature(blocker) || blocker.tapped || blocker.controller === this.active) return false;
    if (this.ab(blocker).cantBlock || this.attachments(blocker).some((a) => this.ab(a).attach?.cantAttackOrBlock)) return false;
    if (this.has(attacker, 'Unblockable')) return false;
    if (this.has(attacker, 'Flying') && !this.has(blocker, 'Flying') && !this.has(blocker, 'Reach')) return false;
    return true;
  }

  /** main1 → declare attackers. */
  goToCombat() {
    if (this.phase !== 'main1' || this.winner !== null) return;
    this.phase = 'attack';
    this.touch();
  }

  declareAttackers(iids: number[]) {
    if (this.phase !== 'attack') return;
    const attackers = iids.map((i) => this.perm(i)).filter((p): p is Perm => !!p && this.canAttack(p));
    if (!attackers.length) {
      this.phase = 'main2';
      this.touch();
      return;
    }
    this.combat = { attackers: attackers.map((a) => a.iid), blocks: {} };
    for (const a of attackers) if (!this.has(a, 'Vigilance')) a.tapped = true;
    this.say(this.active, `${this.players[this.active].name} attacked with ${attackers.map((a) => a.card.name).join(', ')}.`);
    for (const a of attackers) {
      for (const t of this.ab(a).triggers.filter((x) => x.when === 'attack')) this.autoResolve(a.controller, a.iid, t.effects, `${a.card.name}: ${t.text}`);
    }
    this.checkState();
    this.phase = this.winner !== null ? 'over' : 'block';
    this.touch();
  }

  /** Check a set of blocks; returns a problem to show the player, or null. */
  blockProblem(blocks: Record<number, number[]>): string | null {
    if (!this.combat) return 'No combat.';
    const used = new Set<number>();
    for (const [aid, bids] of Object.entries(blocks)) {
      const attacker = this.perm(+aid);
      if (!attacker || !this.combat.attackers.includes(+aid)) return 'That creature isn’t attacking.';
      for (const b of bids) {
        const blocker = this.perm(b);
        if (!blocker || !this.canBlock(blocker, attacker)) return `${blocker?.card.name ?? 'That creature'} can’t block ${attacker.card.name}.`;
        if (used.has(b)) return `${blocker.card.name} can only block one attacker.`;
        used.add(b);
      }
      if (bids.length === 1 && this.has(attacker, 'Menace')) return `${attacker.card.name} has menace: block it with two or more creatures, or not at all.`;
    }
    return null;
  }

  declareBlockers(blocks: Record<number, number[]>): boolean {
    if (this.phase !== 'block' || !this.combat) return false;
    const clean: Record<number, number[]> = {};
    for (const [k, v] of Object.entries(blocks)) if (v.length) clean[+k] = [...v];
    if (this.blockProblem(clean)) return false;
    this.combat.blocks = clean;
    const def = other(this.active);
    const lines = Object.entries(clean).map(([a, bs]) => `${bs.map((b) => this.perm(b)!.card.name).join(' and ')} blocked ${this.perm(+a)!.card.name}`);
    this.say(def, lines.length ? `${lines.join('; ')}.` : `${this.players[def].name} didn’t block.`);
    this.phase = 'combat';
    this.touch();
    return true;
  }

  /** Deal combat damage (first strike step, then regular step) and move to main 2. */
  resolveCombat() {
    if (this.phase !== 'combat' || !this.combat) return;
    const combat = this.combat;
    const def = other(this.active);
    const anyFirst = this.allPerms().some((p) => this.has(p, 'First strike') || this.has(p, 'Double strike'));
    const steps: ('first' | 'regular')[] = anyFirst ? ['first', 'regular'] : ['regular'];
    const struck = new Set<number>();
    for (const step of steps) {
      const dealsNow = (p: Perm) =>
        step === 'first'
          ? this.has(p, 'First strike') || this.has(p, 'Double strike')
          : !(this.has(p, 'First strike') && struck.has(p.iid)) && (!struck.has(p.iid) || this.has(p, 'Double strike'));
      const hits: { from: Perm; to: TargetRef; n: number }[] = [];
      for (const aid of combat.attackers) {
        const a = this.perm(aid);
        if (!a || !dealsNow(a)) continue;
        struck.add(a.iid);
        const blockers = (combat.blocks[aid] ?? []).map((b) => this.perm(b)).filter((b): b is Perm => !!b);
        let power = this.power(a);
        if (power <= 0) continue;
        const wasBlocked = (combat.blocks[aid] ?? []).length > 0;
        if (!wasBlocked) {
          hits.push({ from: a, to: { kind: 'player', id: def }, n: power });
          continue;
        }
        // Assign lethal damage to each blocker in order; trample sends the rest to the player.
        for (const [i, b] of blockers.entries()) {
          const lethal = this.has(a, 'Deathtouch') ? 1 : Math.max(0, this.toughness(b) - b.damage);
          const last = i === blockers.length - 1;
          const n = last && !this.has(a, 'Trample') ? power : Math.min(power, lethal);
          if (n > 0) hits.push({ from: a, to: { kind: 'perm', iid: b.iid }, n });
          power -= n;
          if (power <= 0) break;
        }
        if (power > 0 && this.has(a, 'Trample')) hits.push({ from: a, to: { kind: 'player', id: def }, n: power });
      }
      for (const [aid, bids] of Object.entries(combat.blocks)) {
        for (const bid of bids) {
          const b = this.perm(bid);
          const a = this.perm(+aid);
          if (!b || !a || !dealsNow(b)) continue;
          struck.add(b.iid);
          const n = this.power(b);
          if (n > 0) hits.push({ from: b, to: { kind: 'perm', iid: a.iid }, n });
        }
      }
      const toPlayer = new Map<number, number>();
      for (const h of hits) {
        this.dealDamage(h.to, h.n, this.has(h.from, 'Deathtouch'), this.has(h.from, 'Lifelink') ? h.from.controller : null);
        if (h.to.kind === 'player') toPlayer.set(h.from.iid, (toPlayer.get(h.from.iid) ?? 0) + h.n);
      }
      const total = [...toPlayer.values()].reduce((x, y) => x + y, 0);
      if (total) this.say(this.active, `${this.players[def].name} took ${total} combat damage.`);
      for (const iid of toPlayer.keys()) {
        const a = this.perm(iid);
        if (!a) continue;
        for (const t of this.ab(a).triggers.filter((x) => x.when === 'combat-damage')) this.autoResolve(a.controller, a.iid, t.effects, `${a.card.name}: ${t.text}`);
      }
      this.checkState();
      if (this.winner !== null) return this.touch();
    }
    this.combat = null;
    this.phase = 'main2';
    this.touch();
  }

  // ------------------------------------------------------------- turns

  /** End the active player's turn and start the next one (untap, upkeep, draw). */
  endTurn() {
    if (this.winner !== null) return;
    const me = this.players[this.active];
    for (const p of me.battlefield) {
      for (const t of this.ab(p).triggers.filter((x) => x.when === 'end-step')) this.autoResolve(me.id, p.iid, t.effects, `${p.card.name}: ${t.text}`);
    }
    this.checkState();
    if (this.winner !== null) return this.touch();
    if (me.hand.length > 7) this.discardWorst(me.id, me.hand.length - 7);
    for (const p of this.allPerms()) {
      p.damage = 0;
      p.deathtouched = false;
      p.temp = [];
    }
    this.combat = null;
    this.active = other(this.active);
    this.turn++;
    const next = this.players[this.active];
    next.landsPlayed = 0;
    for (const p of next.battlefield) {
      const frozen = this.attachments(p).some((a) => this.ab(a).attach?.doesntUntap);
      if (!frozen) p.tapped = false;
    }
    for (const p of next.battlefield) {
      for (const t of this.ab(p).triggers.filter((x) => x.when === 'upkeep')) this.autoResolve(next.id, p.iid, t.effects, `${p.card.name}: ${t.text}`);
    }
    this.drawCard(this.active);
    this.phase = 'main1';
    this.checkState();
    if (this.winner === null && this.turn > this.maxTurns) {
      const [a, b] = this.players.map((p) => p.life);
      this.winner = a === b ? 'draw' : a > b ? 0 : 1;
      this.phase = 'over';
      this.say(null, `Turn limit reached — ${this.winner === 'draw' ? 'a draw' : `${this.players[this.winner].name} ${this.winner === 0 ? 'win' : 'wins'} on life`}.`);
    }
    this.touch();
  }

  /** Move the active player's turn along: main1 → combat → main2 → next turn. */
  advance() {
    if (this.phase === 'main1') this.goToCombat();
    else if (this.phase === 'attack') this.declareAttackers([]);
    else if (this.phase === 'combat') this.resolveCombat();
    else if (this.phase === 'main2') this.endTurn();
  }
}

export const sameRef = (a: TargetRef, b: TargetRef) =>
  a.kind === b.kind && (a.kind === 'player' ? a.id === (b as { id: PlayerId }).id : a.iid === (b as { iid: number }).iid);

export function refName(g: Game, r: TargetRef): string {
  if (r.kind === 'player') return r.id === 0 ? 'you' : g.players[r.id].name;
  return g.perm(r.iid)?.card.name ?? 'a creature';
}

function describeTargets(g: Game, targets: (TargetRef | null)[]): string {
  const named = targets.filter((t): t is TargetRef => !!t).map((t) => refName(g, t));
  return named.length ? ` targeting ${named.join(', ')}` : '';
}

/** The effect that owns target slot `i`, and which of that effect's slots it is. */
export function slotOwner(effects: Effect[], i: number): { effect: Effect; index: number } {
  let n = 0;
  for (const e of effects) {
    const k = targetSlots([e]).length;
    if (i < n + k) return { effect: e, index: i - n };
    n += k;
  }
  return { effect: effects[effects.length - 1], index: 0 };
}

/** Is this effect bad for whatever it targets? */
export function harmful(e: Effect, slotInEffect = 0): boolean {
  switch (e.k) {
    case 'damage':
    case 'destroy':
    case 'bounce':
    case 'tap':
    case 'lose':
    case 'discard':
      return true;
    case 'pump':
      return e.p < 0 || e.t < 0;
    case 'fight':
      return slotInEffect === 1 || e.a.sel === 'self';
    default:
      return false;
  }
}

/** A sensible target for an automatically resolved ability (also the AI's first guess). */
export function autoTarget(g: Game, pid: PlayerId, spec: TargetSpec, e: Effect, source: number | null, slotInEffect = 0): TargetRef | null {
  const legal = g.legalTargets(pid, spec, source);
  if (!legal.length) return null;
  const bad = harmful(e, slotInEffect);
  const perms = legal.flatMap((r) => (r.kind === 'perm' ? [g.perm(r.iid)!] : []));
  const mine = perms.filter((p) => p.controller === pid);
  const theirs = perms.filter((p) => p.controller !== pid);
  const best = (ps: Perm[]) => ps.sort((a, b) => g.value(b) - g.value(a))[0];
  const oppPlayer = legal.find((r) => r.kind === 'player' && r.id !== pid);
  if (bad) {
    if (e.k === 'damage' || (e.k === 'pump' && e.t < 0)) {
      const n = e.k === 'damage' ? e.n : -e.t;
      const killable = theirs.filter((p) => g.isCreature(p) && !g.has(p, 'Indestructible') && g.toughness(p) - p.damage <= n);
      if (killable.length) return { kind: 'perm', iid: best(killable).iid };
      if (oppPlayer) return oppPlayer;
    }
    if (e.k === 'tap') {
      const untapped = theirs.filter((p) => !p.tapped);
      if (untapped.length) return { kind: 'perm', iid: best(untapped).iid };
    }
    if (theirs.length) return { kind: 'perm', iid: best(theirs).iid };
    if (oppPlayer) return oppPlayer;
    return spec.optional ? null : legal[legal.length - 1];
  }
  if (e.k === 'fight' && slotInEffect === 0) {
    const strongest = mine.sort((a, b) => g.power(b) - g.power(a))[0];
    if (strongest) return { kind: 'perm', iid: strongest.iid };
  }
  if (mine.length) return { kind: 'perm', iid: best(mine).iid };
  const me = legal.find((r) => r.kind === 'player' && r.id === pid);
  if (me) return me;
  return spec.optional ? null : legal[0];
}
