// The computer opponent: a few honest heuristics, no peeking at your hand or library.
import { abilitiesOf, targetSlots, type Effect, type TargetSpec } from './abilities';
import { autoTarget, slotOwner, type CastChoice, type Game, type Perm, type PlayerId, type TargetRef } from './engine';
import { parseCost } from './mana';

interface Option {
  value: number;
  run: () => boolean;
}

/** Choose targets for a list of slots; null if a required target has no sensible choice. */
function chooseTargets(g: Game, pid: PlayerId, effects: Effect[], slots: TargetSpec[], source: number | null, offset = 0): (TargetRef | null)[] | null {
  const out: (TargetRef | null)[] = [];
  for (let i = 0; i < slots.length; i++) {
    const { effect, index } = slotOwner(effects, i + offset);
    const t = autoTarget(g, pid, slots[i], effect, source, index);
    out.push(t);
  }
  return out;
}

const fighting = (g: Game, p: Perm) =>
  !!g.combat && (g.combat.attackers.includes(p.iid) || Object.values(g.combat.blocks).some((b) => b.includes(p.iid)));

/** How good resolving these effects with these targets would be for `pid` (roughly, in "cards"). */
function judge(g: Game, pid: PlayerId, effects: Effect[], targets: (TargetRef | null)[], inCombat = false): number {
  let v = 0;
  let slot = 0;
  const opps = g.opponents(pid);
  /** Damage or life loss to an opponent: a little, unless it knocks them out. */
  const hurt = (id: PlayerId, n: number, per = 0.35) => (id === pid ? -n : g.players[id].life <= n ? 50 : n * per);
  const next = () => targets[slot++] ?? null;
  const permOf = (r: TargetRef | null) => (r && r.kind === 'perm' ? g.perm(r.iid) ?? null : null);
  const sign = (p: Perm | null) => (p ? (p.controller === pid ? -1 : 1) : 0);
  for (const e of effects) {
    switch (e.k) {
      case 'damage':
        for (const to of e.to) {
          if (to.sel === 'target') {
            const r = next();
            const p = permOf(r);
            if (r?.kind === 'player') v += hurt(r.id, e.n);
            else if (p) v += sign(p) * (g.toughness(p) - p.damage <= e.n && !g.has(p, 'Indestructible') ? g.value(p) : 0.2);
          } else if (to.sel === 'each-opp') for (const id of opps) v += hurt(id, e.n, 0.4);
          else if (to.sel === 'each-player') v += opps.reduce((n, id) => n + hurt(id, e.n, 0.4), 0) - e.n * 0.6;
          else if (to.sel === 'all-creatures') {
            for (const p of g.allPerms().filter((x) => g.isCreature(x) && g.toughness(x) - x.damage <= e.n)) v += (p.controller === pid ? -1 : 1) * g.value(p);
          }
        }
        break;
      case 'destroy':
      case 'bounce': {
        if (e.to.sel === 'target') {
          const p = permOf(next());
          if (p) v += sign(p) * g.value(p) * (e.k === 'bounce' ? 0.5 : 1);
        } else if (e.to.sel === 'all-creatures') {
          for (const p of g.allPerms().filter((x) => g.isCreature(x))) v += (p.controller === pid ? -1 : 1) * g.value(p);
        }
        break;
      }
      case 'tap': {
        const p = e.to.sel === 'target' ? permOf(next()) : null;
        if (p && p.controller !== pid && !p.tapped) v += inCombat ? 0.5 : 1;
        break;
      }
      case 'untap':
        if (e.to.sel === 'target') next();
        break;
      case 'pump': {
        if (e.to.sel === 'target') {
          const p = permOf(next());
          if (!p) break;
          if (e.t < 0) v += sign(p) * (g.toughness(p) + e.t - p.damage <= 0 ? g.value(p) : 0.3);
          else v += inCombat && p.controller === pid && fighting(g, p) ? 1.5 + e.p * 0.3 : -0.5; // only worth it mid-combat
        } else if (e.to.sel === 'all-creatures') {
          v += (e.t < 0 ? -1 : 1) * (inCombat ? 1 : -0.2) * g.creatures(pid).length * 0.5;
        }
        break;
      }
      case 'counters': {
        const p = e.to.sel === 'target' ? permOf(next()) : null;
        if (p) v += p.controller === pid ? e.n * 1.2 : -e.n;
        else if (e.to.sel === 'all-creatures') v += g.creatures(pid).length * e.n * 0.8;
        break;
      }
      case 'draw':
        v += e.n * 1.5;
        break;
      case 'gain':
        v += e.n * (g.players[pid].life < 8 ? 0.5 : 0.15);
        break;
      case 'lose':
        if (e.who.sel === 'target') {
          const r = next();
          if (r?.kind === 'player') v += hurt(r.id, e.n, 0.4);
        } else if (e.who.sel === 'each-player') v += opps.reduce((n, id) => n + hurt(id, e.n, 0.4), 0) - e.n * 0.6;
        else for (const id of opps) v += hurt(id, e.n, 0.4);
        break;
      case 'token':
        v += e.count * (e.p + e.t) * 0.5;
        break;
      case 'discard':
        v += e.n * 0.8 * (e.who.sel === 'each-opp' ? opps.length : 1);
        if (e.who.sel === 'target') next();
        break;
      case 'self-discard':
        v -= e.n * 0.6;
        break;
      case 'named-counter':
        break;
      case 'draw-per-counter':
        v += g.players[pid].life <= 6 ? -2 : 3;
        break;
      case 'lose-per-counter':
        v -= 1;
        break;
      case 'protection':
        v += 2;
        break;
      case 'fight': {
        const a = e.a.sel === 'target' ? permOf(next()) : null;
        const b = e.b.sel === 'target' ? permOf(next()) : null;
        if (a && b && a.controller === pid && b.controller !== pid) {
          if (g.power(a) >= g.toughness(b) - b.damage) v += g.value(b);
          if (g.power(b) >= g.toughness(a) - a.damage) v -= g.value(a);
        }
        break;
      }
    }
  }
  return v;
}

function castOptions(g: Game, pid: PlayerId, inCombat: boolean): Option[] {
  const me = g.players[pid];
  const out: Option[] = [];
  for (const c of me.hand) {
    if (c.card.types.includes('Land') || !g.canCast(pid, c.iid)) continue;
    const a = abilitiesOf(c.card);
    const isCreature = c.card.types.includes('Creature');
    const modes = a.modes.length || 1;
    for (let mode = 0; mode < modes; mode++) {
      const slots = g.castSlots(c.card, mode);
      const { effects, etb } = g.castEffects(c.card, mode);
      let targets: (TargetRef | null)[] = [];
      let v = 0;
      let i = 0;
      if (a.attach?.kind === 'aura') {
        const spec = slots[0].spec;
        const legal = g.legalTargets(pid, spec);
        const perms = legal.flatMap((r) => (r.kind === 'perm' ? [g.perm(r.iid)!] : []));
        const want = a.attach.auraOnOpponent ? perms.filter((p) => p.controller !== pid) : perms.filter((p) => p.controller === pid);
        const host = want.sort((x, y) => g.value(y) - g.value(x))[0];
        if (!host) continue;
        targets.push({ kind: 'perm', iid: host.iid });
        v += a.attach.auraOnOpponent ? g.value(host) * 0.8 : 1.5 + a.attach.p + a.attach.t * 0.5 + a.attach.kw.length;
        i = 1;
      }
      const spellSlots = slots.slice(i, i + targetSlots(effects).length).map((s) => s.spec);
      const spellTargets = chooseTargets(g, pid, effects, spellSlots, null);
      if (!spellTargets) continue;
      const etbSlots = slots.slice(i + spellSlots.length).map((s) => s.spec);
      const etbTargets = chooseTargets(g, pid, etb, etbSlots, null) ?? etbSlots.map(() => null);
      targets = [...targets, ...spellTargets, ...etbTargets];
      if (slots.some((s, k) => s.required && !targets[k])) continue;
      v += judge(g, pid, effects, spellTargets, inCombat);
      if (etb.length) v += Math.max(0, judge(g, pid, etb, etbTargets));
      if (isCreature) v += 2 + (c.card.power ?? 0) * 0.6 + (c.card.toughness ?? 0) * 0.4 + a.keywords.size * 0.3;
      else if (!effects.length && !a.attach) v += 1.5 + (a.anthem ? g.creatures(pid).length : 0) + (a.mana ? 1.5 : 0); // other permanents
      if (a.attach?.kind === 'equipment') v += g.creatures(pid).length ? 1.5 : 0.5;
      v += c.card.cmc * 0.25; // use the mana
      const choice: CastChoice = { mode, targets };
      if (v > 0.6) out.push({ value: v, run: () => g.cast(pid, c.iid, choice) });
    }
  }
  for (const p of me.battlefield) {
    for (const idx of g.usableAbilities(pid, p.iid)) {
      const act = g.ab(p).activated[idx];
      const slots = targetSlots(act.effects);
      const targets = chooseTargets(g, pid, act.effects, slots, p.iid);
      if (!targets || slots.some((s, k) => !s.optional && !targets[k])) continue;
      let v = judge(g, pid, act.effects, targets, inCombat);
      if (act.tap && g.isCreature(p) && g.canAttack(p) && g.phase === 'main1') v -= 1; // it could attack instead
      if (v > 0.8) out.push({ value: v * 0.9, run: () => g.activate(pid, p.iid, idx, targets) });
    }
    if (g.canEquip(pid, p.iid) && p.attachedTo === null) {
      const host = g.creatures(pid).sort((a, b) => g.value(b) - g.value(a))[0];
      if (host) out.push({ value: 1.2, run: () => g.equip(pid, p.iid, host.iid) });
    }
  }
  return out.sort((a, b) => b.value - a.value);
}

/** Do one thing in a main phase: play a land, or cast/activate the best option. False when done. */
export function aiMainAction(g: Game, pid: PlayerId): boolean {
  const me = g.players[pid];
  const land = me.hand.find((c) => c.card.types.includes('Land') && g.canPlayLand(pid, c.iid));
  if (land) {
    // Play the basic whose colour the hand needs most.
    const lands = me.hand.filter((c) => c.card.types.includes('Land'));
    const need = new Map<string, number>();
    for (const c of me.hand) for (const pip of parseCost(c.card.cost).pips) for (const col of pip) need.set(col, (need.get(col) ?? 0) + 1);
    const have = new Map<string, number>();
    for (const p of me.battlefield) for (const o of g.ab(p).mana?.options ?? []) have.set(o, (have.get(o) ?? 0) + 1);
    const best = lands.sort((a, b) => {
      const score = (c: typeof a) => Math.max(0, ...(g.ab(c).mana?.options ?? []).map((o) => (need.get(o) ?? 0) - (have.get(o) ?? 0) * 0.7));
      return score(b) - score(a);
    })[0];
    return g.playLand(pid, best.iid);
  }
  const opts = castOptions(g, pid, false);
  for (const o of opts) if (o.run()) return true;
  return false;
}

// ---------------------------------------------------------------- combat

/** Would `blocker` survive / kill `attacker` in a straight fight? */
function fight(g: Game, attacker: Perm, blocker: Perm) {
  const aFirst = g.has(attacker, 'First strike') || g.has(attacker, 'Double strike');
  const bFirst = g.has(blocker, 'First strike') || g.has(blocker, 'Double strike');
  const aKills = (g.has(attacker, 'Deathtouch') && g.power(attacker) > 0) || g.power(attacker) >= g.toughness(blocker) - blocker.damage;
  const bKills = (g.has(blocker, 'Deathtouch') && g.power(blocker) > 0) || g.power(blocker) >= g.toughness(attacker) - attacker.damage;
  const aIndestructible = g.has(attacker, 'Indestructible');
  const bIndestructible = g.has(blocker, 'Indestructible');
  let attackerDies = bKills && !aIndestructible;
  let blockerDies = aKills && !bIndestructible;
  if (aFirst && !bFirst && blockerDies) attackerDies = false;
  if (bFirst && !aFirst && attackerDies) blockerDies = false;
  return { attackerDies, blockerDies };
}

/** Lethal on `opp` if every attacker swings at them and they block the biggest ones? */
function lethalOn(g: Game, mine: Perm[], opp: PlayerId): boolean {
  const blockers = g.creatures(opp).filter((p) => !p.tapped);
  const total = mine.reduce((n, p) => n + Math.max(0, g.power(p)), 0);
  const biggest = [...mine].filter((a) => blockers.some((b) => g.canBlock(b, a))).sort((a, b) => g.power(b) - g.power(a));
  const blockedAway = biggest.slice(0, blockers.length).reduce((n, p) => n + Math.max(0, g.power(p)), 0);
  return total - blockedAway >= g.players[opp].life;
}

/** Which creatures attack, and whom. Goes for a kill if there is one, else the weakest-defended opponent. */
export function chooseAttackers(g: Game, pid: PlayerId): Record<number, PlayerId> {
  // A player with protection takes no damage, so there's no point attacking them.
  const opps = g.opponents(pid).filter((o) => !g.players[o].protected);
  const mine = g.creatures(pid).filter((p) => g.canAttack(p));
  if (!mine.length || !opps.length) return {};
  const all = (opp: PlayerId) => Object.fromEntries(mine.map((p) => [p.iid, opp]));
  for (const opp of [...opps].sort((a, b) => g.players[a].life - g.players[b].life)) if (lethalOn(g, mine, opp)) return all(opp);

  // The opponent whose life and untapped defenders make them the softest target.
  const softness = (opp: PlayerId) => g.players[opp].life + g.creatures(opp).filter((p) => !p.tapped).reduce((n, p) => n + g.power(p) + g.toughness(p) * 0.5, 0);
  const target = [...opps].sort((a, b) => softness(a) - softness(b))[0];
  const theirs = g.creatures(target).filter((p) => !p.tapped);

  // Keep defenders home if any single opponent could hit back hard.
  const myLife = g.players[pid].life;
  const threat = Math.max(...opps.map((o) => g.creatures(o).reduce((n, p) => n + Math.max(0, g.power(p)), 0)));
  const out: Record<number, PlayerId> = {};
  for (const a of mine) {
    if (g.power(a) <= 0) continue;
    const blockers = theirs.filter((b) => g.canBlock(b, a));
    const badBlocks = blockers.filter((b) => {
      const f = fight(g, a, b);
      return f.attackerDies && (!f.blockerDies || g.value(b) < g.value(a) * 0.8);
    });
    const homeGuard = g.creatures(pid).filter((p) => !(p.iid in out) && p.iid !== a.iid).length;
    const needed = myLife <= threat + 2 && !g.has(a, 'Vigilance') && homeGuard < Math.min(2, opps.length);
    if ((!badBlocks.length || blockers.length === 0) && !(needed && myLife <= 8)) out[a.iid] = target;
  }
  return out;
}

export function chooseBlocks(g: Game, pid: PlayerId): Record<number, number[]> {
  const combat = g.combat;
  if (!combat) return {};
  const attackers = g.attackersOf(pid).map((i) => g.perm(i)!).filter(Boolean).sort((a, b) => g.value(b) - g.value(a));
  const free = new Set(g.creatures(pid).map((p) => p.iid));
  const blocks: Record<number, number[]> = {};
  let incoming = attackers.reduce((n, a) => n + Math.max(0, g.power(a)), 0);
  const life = g.players[pid].life;
  for (const a of attackers) {
    const cands = [...free].map((i) => g.perm(i)!).filter((b) => g.canBlock(b, a));
    if (!cands.length || g.has(a, 'Menace')) continue;
    const good = cands.filter((b) => !fight(g, a, b).blockerDies).sort((x, y) => Number(fight(g, a, y).attackerDies) - Number(fight(g, a, x).attackerDies) || g.value(x) - g.value(y));
    const trade = cands.filter((b) => {
      const f = fight(g, a, b);
      return f.attackerDies && g.value(b) <= g.value(a) * 1.1;
    }).sort((x, y) => g.value(x) - g.value(y));
    let pickB: Perm | undefined = good.find((b) => fight(g, a, b).attackerDies) ?? trade[0] ?? good[0];
    if (!pickB && incoming >= life) pickB = cands.sort((x, y) => g.value(x) - g.value(y))[0]; // chump to survive
    if (!pickB) continue;
    blocks[a.iid] = [pickB.iid];
    free.delete(pickB.iid);
    if (!g.has(a, 'Trample')) incoming -= Math.max(0, g.power(a));
  }
  // Menace attackers: double-block only if needed to survive.
  for (const a of attackers) {
    if (!g.has(a, 'Menace') || incoming < life) continue;
    const cands = [...free].map((i) => g.perm(i)!).filter((b) => g.canBlock(b, a)).sort((x, y) => g.value(x) - g.value(y));
    if (cands.length >= 2) {
      blocks[a.iid] = [cands[0].iid, cands[1].iid];
      free.delete(cands[0].iid);
      free.delete(cands[1].iid);
      incoming -= Math.max(0, g.power(a));
    }
  }
  return g.blockProblem(blocks) ? {} : blocks;
}

/** Instant-speed tricks while combat is happening (removal on attackers, pump on a blocker). */
export function aiCombatTricks(g: Game, pid: PlayerId) {
  for (let i = 0; i < 3; i++) {
    const opts = castOptions(g, pid, true).filter((o) => o.value > 2);
    if (!opts.length || !opts[0].run()) break;
  }
}

/** The AI's whole response when it's attacked: maybe a trick, then declare blocks. */
export function aiDefend(g: Game, pid: PlayerId) {
  if (g.phase !== 'block' || !g.combat?.waiting.includes(pid)) return;
  aiCombatTricks(g, pid);
  if (g.phase !== 'block' || !g.combat?.waiting.includes(pid)) return;
  if (!g.declareBlockers(pid, chooseBlocks(g, pid))) g.declareBlockers(pid, {});
}

/**
 * During a block step, let one computer defender declare its blocks.
 * Returns 'wait' when only the human (or nobody) is left to declare.
 */
export function aiBlockStep(g: Game, human: PlayerId | null): 'acted' | 'wait' {
  const ai = g.combat?.waiting.find((id) => id !== human);
  if (g.phase !== 'block' || ai === undefined) return 'wait';
  aiDefend(g, ai);
  return 'acted';
}

/**
 * Advance the AI's own turn by one visible step. Returns 'wait' when the
 * human has to act (declare blockers), 'done' when the turn has passed.
 */
export function aiStep(g: Game, pid: PlayerId): 'acted' | 'wait' | 'done' {
  if (g.winner !== null) return 'done';
  if (g.active !== pid) return g.phase === 'block' ? 'wait' : 'done';
  switch (g.phase) {
    case 'main1':
      if (!aiMainAction(g, pid)) g.goToCombat();
      return 'acted';
    case 'attack': {
      const plan = chooseAttackers(g, pid);
      g.declareAttackers(Object.keys(plan).map(Number), plan);
      return 'acted';
    }
    case 'block':
      return 'wait';
    case 'combat':
      aiCombatTricks(g, pid);
      g.resolveCombat();
      return 'acted';
    case 'main2':
      if (!aiMainAction(g, pid)) {
        g.endTurn();
        return 'done';
      }
      return 'acted';
    default:
      return 'done';
  }
}

/** Play a whole game with every seat run by the AI (used by tests and the balance check). */
export function playOut(g: Game, maxSteps = 40_000) {
  for (let i = 0; i < maxSteps && g.winner === null; i++) {
    if (g.phase === 'block') aiBlockStep(g, null);
    else aiStep(g, g.active);
  }
  return g.winner;
}
