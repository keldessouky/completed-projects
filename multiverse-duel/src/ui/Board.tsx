// The game table: your hand and battlefield at the bottom, one to three computer opponents at the top.
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import type { Card } from '../data/cards';
import { abilitiesOf, describeEffect, targetSlots, type TargetSpec } from '../game/abilities';
import { aiBlockStep, aiStep } from '../game/ai';
import type { Deck } from '../game/deck';
import { defaultNames, Game, sameRef, type CardRef, type Perm, type PlayerId, type TargetRef } from '../game/engine';
import { CardBack, CardFace, ManaCost } from './CardFace';
import { useArtSettings } from './Art';
import { GradeBadge } from './Grade';
import { useHover, type Hovered } from './Inspector';

const YOU: PlayerId = 0;
const ordinal = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;

type Pending =
  | { k: 'mode'; iid: number }
  | { k: 'target'; from: 'cast' | 'ability'; iid: number; mode?: number; ability?: number; slots: { spec: TargetSpec; required: boolean; label: string }[]; chosen: (TargetRef | null)[] }
  | { k: 'equip'; iid: number }
  | { k: 'abilities'; iid: number };

const PHASES: { id: string; label: string }[] = [
  { id: 'main1', label: 'Main' },
  { id: 'attack', label: 'Attack' },
  { id: 'block', label: 'Block' },
  { id: 'combat', label: 'Damage' },
  { id: 'main2', label: 'Main 2' },
];

const SPEEDS = { slow: 1100, normal: 650, fast: 250 } as const;

export function Board({ decks, onRematch, onNewDecks, onHelp }: { decks: Deck[]; onRematch: () => void; onNewDecks: () => void; onHelp: () => void }) {
  const game = useMemo(() => new Game(decks.map((d) => d.cards), { names: defaultNames(decks.length) }), [decks]);
  const [, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const [pending, setPending] = useState<Pending | null>(null);
  /** Your planned attack: attacker → the opponent it attacks. */
  const [attackers, setAttackers] = useState<Record<number, PlayerId>>({});
  const [attackTarget, setAttackTarget] = useState<PlayerId>(1);
  const [blocks, setBlocks] = useState<Record<number, number[]>>({});
  /** Blocking: the blocker or the attacker picked first (either order works, or drag one onto the other). */
  const [picking, setPicking] = useState<number | null>(null);
  const [pickingAttacker, setPickingAttacker] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [hideOver, setHideOver] = useState(false);
  const [speed, setSpeed] = useState<keyof typeof SPEEDS>(() => {
    try {
      return (localStorage.getItem('multiverse-duel:speed') as keyof typeof SPEEDS) || 'normal';
    } catch {
      return 'normal';
    }
  });
  const hover = useHover();
  const { openVersions } = useArtSettings();
  const g = game;
  const toastTimer = useRef<number | undefined>(undefined);

  const say = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  // --- computer players act on their own, one visible step at a time
  useEffect(() => {
    if (g.winner !== null) return;
    let timer: number | undefined;
    if (g.phase === 'block') {
      if (g.combat?.waiting.some((id) => id !== YOU)) {
        timer = window.setTimeout(() => {
          aiBlockStep(g, YOU);
          refresh();
        }, SPEEDS[speed]);
      }
    } else if (g.active !== YOU) {
      timer = window.setTimeout(() => {
        aiStep(g, g.active);
        refresh();
      }, SPEEDS[speed]);
    }
    return () => window.clearTimeout(timer);
  });

  // Reset per-phase selections when the phase changes.
  const phaseKey = `${g.turn}-${g.phase}`;
  useEffect(() => {
    setAttackers({});
    setAttackTarget((t) => (g.players[t] && !g.players[t].lost && t !== YOU ? t : g.opponents(YOU)[0] ?? 1));
    setBlocks({});
    setPicking(null);
    setPickingAttacker(null);
    setPending(null);
  }, [phaseKey]);

  useEffect(() => {
    try {
      localStorage.setItem('multiverse-duel:speed', speed);
    } catch {
      /* ignore */
    }
  }, [speed]);

  const me = g.players[YOU];
  const myTurn = g.active === YOU;
  const defending = g.phase === 'block' && !!g.combat?.waiting.includes(YOU);
  const canAct = g.winner === null && !me.lost && (myTurn ? g.phase !== 'block' : defending);
  const opps = g.players.filter((p) => p.id !== YOU);
  const liveOpps = g.opponents(YOU);
  const nameOf = (id: PlayerId) => (id === YOU ? 'you' : g.players[id].name);

  // ---------------------------------------------------------------- targeting

  const currentSlot = pending?.k === 'target' ? pending.slots[pending.chosen.length] : null;
  const sourceIid = pending?.k === 'target' && pending.from === 'ability' ? pending.iid : null;
  const legal = useMemo(() => (currentSlot ? g.legalTargets(YOU, currentSlot.spec, sourceIid) : []), [currentSlot, sourceIid, g, g.version]);
  const isLegal = (r: TargetRef) => legal.some((x) => sameRef(x, r));

  const finish = (p: Extract<Pending, { k: 'target' }>, chosen: (TargetRef | null)[]) => {
    const ok = p.from === 'cast' ? g.cast(YOU, p.iid, { mode: p.mode, targets: chosen }) : g.activate(YOU, p.iid, p.ability!, chosen);
    if (!ok) say('That didn’t work — the targets may have changed.');
    setPending(null);
    refresh();
  };

  const choose = (r: TargetRef | null) => {
    if (pending?.k !== 'target') return;
    const chosen = [...pending.chosen, r];
    // Skip slots with no legal targets at all (e.g. an optional enters trigger on an empty board).
    while (chosen.length < pending.slots.length && !pending.slots[chosen.length].required && g.legalTargets(YOU, pending.slots[chosen.length].spec, sourceIid).length === 0) chosen.push(null);
    if (chosen.length >= pending.slots.length) finish(pending, chosen);
    else setPending({ ...pending, chosen });
  };

  const startTargeting = (p: Extract<Pending, { k: 'target' }>) => {
    const chosen: (TargetRef | null)[] = [];
    while (chosen.length < p.slots.length && !p.slots[chosen.length].required && g.legalTargets(YOU, p.slots[chosen.length].spec, p.from === 'ability' ? p.iid : null).length === 0) chosen.push(null);
    if (chosen.length >= p.slots.length) finish(p, chosen);
    else setPending({ ...p, chosen });
  };

  const castWithMode = (iid: number, mode: number | undefined) => {
    const c = g.players[YOU].hand.find((x) => x.iid === iid)!;
    const slots = g.castSlots(c.card, mode ?? 0);
    startTargeting({ k: 'target', from: 'cast', iid, mode, slots, chosen: [] });
  };

  // ------------------------------------------------------------------ clicks

  const clickHand = (c: CardRef) => {
    if (!canAct) return;
    if (pending) return say('Finish or cancel what you’re doing first.');
    if (c.card.types.includes('Land')) {
      if (g.playLand(YOU, c.iid)) refresh();
      else say(g.whyNotCast(YOU, c.iid) ?? 'Can’t play that now.');
      return;
    }
    const why = g.whyNotCast(YOU, c.iid);
    if (why) return say(why);
    const a = abilitiesOf(c.card);
    if (a.modes.length > 1) setPending({ k: 'mode', iid: c.iid });
    else castWithMode(c.iid, a.modes.length ? 0 : undefined);
  };

  const clickPlayer = (id: PlayerId) => {
    const r: TargetRef = { kind: 'player', id };
    if (currentSlot) {
      if (isLegal(r)) choose(r);
      return;
    }
    if (myTurn && g.phase === 'attack' && id !== YOU && !g.players[id].lost) setAttackTarget(id);
  };

  const clickPerm = (p: Perm) => {
    const r: TargetRef = { kind: 'perm', iid: p.iid };
    if (pending?.k === 'target') {
      if (isLegal(r)) choose(r);
      else say('Not a legal target.');
      return;
    }
    if (pending?.k === 'equip') {
      if (p.controller === YOU && g.isCreature(p) && g.equip(YOU, pending.iid, p.iid)) {
        setPending(null);
        refresh();
      } else say('Choose one of your creatures.');
      return;
    }
    if (pending) return;
    if (myTurn && g.phase === 'attack' && p.controller === YOU) {
      if (!g.canAttack(p)) return say(g.isSick(p) ? `${p.card.name} just arrived (summoning sickness).` : `${p.card.name} can’t attack.`);
      setAttackers((a) => {
        const next = { ...a };
        if (next[p.iid] === attackTarget) delete next[p.iid];
        else next[p.iid] = attackTarget;
        return next;
      });
      return;
    }
    if (defending) {
      const attackingMe = p.controller !== YOU && !!g.combat?.attackers.includes(p.iid);
      if (p.controller === YOU && g.isCreature(p)) {
        // Clicking an assigned blocker takes it back.
        const assigned = Object.entries(blocks).find(([, bs]) => bs.includes(p.iid));
        if (assigned && pickingAttacker === null) {
          setBlocks((b) => ({ ...b, [+assigned[0]]: b[+assigned[0]].filter((x) => x !== p.iid) }));
          return;
        }
        if (pickingAttacker !== null) return assignBlock(p.iid, pickingAttacker);
        if (p.tapped) return say(`${p.card.name} is tapped, so it can’t block.`);
        const targets = g.attackersOf(YOU).map((a) => g.perm(a)!).filter(Boolean);
        if (!targets.some((a) => g.canBlock(p, a))) {
          return say(`${p.card.name} can’t block any of these attackers${targets.every((a) => g.has(a, 'Flying')) ? ' — they fly, and it has neither flying nor reach' : ''}.`);
        }
        setPicking(picking === p.iid ? null : p.iid);
        return;
      }
      if (attackingMe) {
        if (g.combat!.defenderOf[p.iid] !== YOU) return say(`${p.card.name} is attacking ${g.players[g.combat!.defenderOf[p.iid]].name}, not you.`);
        if (picking !== null) return assignBlock(picking, p.iid);
        setPickingAttacker(pickingAttacker === p.iid ? null : p.iid);
        return;
      }
    }
    if (p.controller === YOU && canAct) {
      const usable = g.usableAbilities(YOU, p.iid);
      const equip = g.canEquip(YOU, p.iid);
      if (usable.length + (equip ? 1 : 0) > 1) return setPending({ k: 'abilities', iid: p.iid });
      if (usable.length === 1) return activate(p, usable[0]);
      if (equip) return setPending({ k: 'equip', iid: p.iid });
      const a = g.ab(p);
      if (a.activated.length) say('You can’t use that ability right now (mana, tapping or timing).');
    }
  };

  /** Put `blockerIid` in front of `attackerIid` (moving it off any other attacker), or explain why not. */
  const assignBlock = (blockerIid: number, attackerIid: number) => {
    const blocker = g.perm(blockerIid);
    const attacker = g.perm(attackerIid);
    setPicking(null);
    setPickingAttacker(null);
    if (!blocker || !attacker) return;
    if (blocker.controller !== YOU) return say('Block with one of your own creatures.');
    if (g.combat?.defenderOf[attackerIid] !== YOU) return say(`${attacker.card.name} isn’t attacking you.`);
    if (!g.canBlock(blocker, attacker)) {
      const why = blocker.tapped
        ? 'it’s tapped'
        : g.has(attacker, 'Unblockable')
          ? `${attacker.card.name} can’t be blocked`
          : g.has(attacker, 'Flying')
            ? `${attacker.card.name} has flying — only creatures with flying or reach can block it`
            : 'it can’t block';
      return say(`${blocker.card.name} can’t block ${attacker.card.name}: ${why}.`);
    }
    setBlocks((b) => {
      const next: Record<number, number[]> = {};
      for (const [k, v] of Object.entries(b)) next[+k] = v.filter((x) => x !== blockerIid);
      next[attackerIid] = [...(next[attackerIid] ?? []), blockerIid];
      return next;
    });
  };

  const activate = (p: Perm, index: number) => {
    const act = g.ab(p).activated[index];
    const slots = targetSlots(act.effects).map((spec, i) => ({ spec, required: !spec.optional, label: `${p.card.name}: ${describeEffect(act.effects[Math.min(i, act.effects.length - 1)])}` }));
    startTargeting({ k: 'target', from: 'ability', iid: p.iid, ability: index, slots, chosen: [] });
  };

  // ------------------------------------------------------------- primary actions

  const blockProblem = defending ? g.blockProblem(blocks) : null;
  const actions: { label: string; run: () => void; primary?: boolean; disabled?: boolean; title?: string }[] = [];
  if (g.winner !== null || me.lost) {
    actions.push({ label: 'Rematch', primary: true, run: onRematch });
    actions.push({ label: 'New decks', run: onNewDecks });
  } else if (!pending) {
    if (myTurn && g.phase === 'main1') {
      const any = g.creatures(YOU).some((p) => g.canAttack(p));
      actions.push({ label: any ? 'Attack ▸' : 'Go to combat ▸', primary: any, run: () => (g.goToCombat(), refresh()) });
      actions.push({ label: 'End turn', primary: !any, run: () => (g.goToCombat(), g.declareAttackers([]), g.endTurn(), refresh()) });
    } else if (myTurn && g.phase === 'attack') {
      const able = g.creatures(YOU).filter((p) => g.canAttack(p));
      const n = Object.keys(attackers).length;
      actions.push({ label: n ? `Attack with ${n}` : 'No attack', primary: true, run: () => (g.declareAttackers(Object.keys(attackers).map(Number), attackers), refresh()) });
      const allAtTarget = able.length > 0 && able.every((p) => attackers[p.iid] === attackTarget);
      if (able.length && !allAtTarget) {
        actions.push({ label: liveOpps.length > 1 ? `All at ${g.players[attackTarget].name}` : 'Select all', run: () => setAttackers(Object.fromEntries(able.map((p) => [p.iid, attackTarget]))) });
      }
    } else if (myTurn && g.phase === 'combat') {
      actions.push({ label: 'Deal combat damage', primary: true, run: () => (g.resolveCombat(), refresh()) });
    } else if (myTurn && g.phase === 'main2') {
      actions.push({ label: 'End turn', primary: true, run: () => (g.endTurn(), refresh()) });
    } else if (defending) {
      const n = Object.values(blocks).reduce((k, b) => k + b.length, 0);
      if (n) actions.push({ label: 'Clear blocks', run: () => (setBlocks({}), setPicking(null), setPickingAttacker(null)) });
      actions.push({
        label: n ? `Confirm ${n} block${n > 1 ? 's' : ''}` : 'No blocks',
        primary: true,
        title: blockProblem ?? undefined,
        run: () => {
          if (blockProblem) return say(`${blockProblem} Add another blocker, or click the block chip to remove it.`);
          if (g.declareBlockers(YOU, blocks)) refresh();
          else say('Those blocks aren’t legal any more — something changed. Clear them and try again.');
        },
      });
    }
  }

  // Keyboard: Space/Enter = main button, Esc = cancel.
  const primary = actions.find((a) => a.primary && !a.disabled);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'Escape') {
        setPending(null);
        setPicking(null);
        setShowLog(false);
      } else if ((e.key === ' ' || e.key === 'Enter') && primary && !pending) {
        e.preventDefault();
        primary.run();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ------------------------------------------------------------------ rendering

  const prompt = (() => {
    if (g.winner !== null) return '';
    if (pending?.k === 'target' && currentSlot) return `Choose a target — ${currentSlot.label}`;
    if (pending?.k === 'equip') return 'Choose one of your creatures to equip.';
    if (pending?.k === 'mode') return 'Choose a mode.';
    if (pending?.k === 'abilities') return 'Choose an ability.';
    if (me.lost) return `You’re out of the game — watching ${liveOpps.length} computer player${liveOpps.length > 1 ? 's' : ''} finish it.`;
    if (myTurn) {
      if (g.phase === 'main1') return g.players[YOU].landsPlayed ? 'Cast spells, or attack.' : 'Play a land, cast spells, then attack.';
      if (g.phase === 'attack') {
        return liveOpps.length > 1
          ? `Attacking ${g.players[attackTarget].name} — click your creatures. Click another opponent’s life to switch target.`
          : 'Click your creatures to choose attackers.';
      }
      if (g.phase === 'block') return liveOpps.length > 1 ? 'Your opponents are choosing blockers…' : 'The opponent is choosing blockers…';
      if (g.phase === 'combat') return 'Blocks are in. Cast an instant, or deal damage.';
      if (g.phase === 'main2') return 'Cast more spells, or end your turn.';
    }
    if (defending) {
      if (picking !== null) return `Now click the attacker for ${g.perm(picking)?.card.name} to block (glowing green).`;
      if (pickingAttacker !== null) return `Now click your creature that should block ${g.perm(pickingAttacker)?.card.name} (glowing green).`;
      if (blockProblem) return blockProblem;
      const mine = g.creatures(YOU);
      const incoming = g.attackersOf(YOU).map((a) => g.perm(a)!).filter(Boolean);
      if (!incoming.some((a) => mine.some((b) => g.canBlock(b, a)))) {
        const why = !mine.length
          ? 'you have no creatures'
          : mine.every((b) => b.tapped)
            ? 'your creatures are all tapped'
            : incoming.every((a) => g.has(a, 'Flying') || g.has(a, 'Unblockable'))
              ? `${incoming.map((a) => a.card.name).join(' and ')} ${incoming.length > 1 ? 'have' : 'has'} ${incoming.every((a) => g.has(a, 'Unblockable')) ? 'can’t-be-blocked' : 'flying, and only creatures with flying or reach can block fliers'}`
              : 'none of them can block these attackers';
        return `${g.players[g.active].name} is attacking you, but you can’t block: ${why}. Press No blocks (or cast an instant).`;
      }
      return `${g.players[g.active].name} is attacking you! Drag a creature onto an attacker to block it, or click one then the other.`;
    }
    if (g.phase === 'block') return `${g.players[g.active].name} attacked — ${g.combat?.waiting.map((id) => g.players[id].name).join(' and ')} choosing blockers…`;
    return `${g.players[g.active].name} is thinking…`;
  })();

  const hand = g.players[YOU].hand;
  const recent = g.log.slice(-3);
  const attackerNumber = (iid: number) => (g.combat?.attackers.indexOf(iid) ?? -1) + 1;

  const permProps = (p: Perm) => {
    const r: TargetRef = { kind: 'perm', iid: p.iid };
    const combatBlocks = g.combat?.blocks ?? {};
    const blocking = defending ? Object.entries(blocks).find(([, bs]) => bs.includes(p.iid)) : Object.entries(combatBlocks).find(([, bs]) => bs.includes(p.iid));
    const planned = attackers[p.iid];
    const atMe = g.combat?.defenderOf[p.iid] === YOU;
    const pickedBlocker = picking !== null ? g.perm(picking) : undefined;
    const pickedAttacker = pickingAttacker !== null ? g.perm(pickingAttacker) : undefined;
    const blockHint =
      defending &&
      ((pickedBlocker && atMe && g.canBlock(pickedBlocker, p)) ||
        (pickedAttacker && p.controller === YOU && g.canBlock(p, pickedAttacker)));
    const canBlockSomething = defending && p.controller === YOU && g.attackersOf(YOU).some((a) => g.canBlock(p, g.perm(a)!));
    const atWhom = g.combat?.defenderOf[p.iid] ?? planned;
    return {
      perm: p,
      game: g,
      targetable: (!!currentSlot && isLegal(r)) || !!blockHint,
      selected: planned !== undefined || picking === p.iid || pickingAttacker === p.iid,
      canBlock: canBlockSomething && picking === null && pickingAttacker === null && !Object.values(blocks).some((b) => b.includes(p.iid)),
      drag: defending && (canBlockSomething || atMe)
        ? {
            draggable: canBlockSomething,
            onDragStart: (e: DragEvent) => {
              e.dataTransfer.setData('text/plain', String(p.iid));
              e.dataTransfer.effectAllowed = 'link';
              setPicking(p.iid);
              setPickingAttacker(null);
            },
            onDragOver: atMe ? (e: DragEvent) => e.preventDefault() : undefined,
            onDrop: atMe
              ? (e: DragEvent) => {
                  e.preventDefault();
                  const from = Number(e.dataTransfer.getData('text/plain'));
                  if (from) assignBlock(from, p.iid);
                }
              : undefined,
          }
        : undefined,
      attackLabel: atWhom !== undefined && g.players.length > 2 ? `→ ${nameOf(atWhom)}` : '',
      attacking: !!g.combat?.attackers.includes(p.iid),
      atYou: g.combat?.defenderOf[p.iid] === YOU,
      attackNo: attackerNumber(p.iid),
      blockingNo: blocking ? attackerNumber(+blocking[0]) : 0,
      onClick: () => clickPerm(p),
      onHover: () => hover(liveInfo(g, p)),
    };
  };

  return (
    <div className="board">
      <div className={`opponents n${opps.length}`}>
        {opps.map((o) => (
          <div key={o.id} className={`opp-zone ${o.lost ? 'out' : ''} ${g.active === o.id ? 'active' : ''}`}>
            <PlayerBar
              game={g}
              id={o.id}
              targetable={!!currentSlot && isLegal({ kind: 'player', id: o.id })}
              attackTarget={myTurn && g.phase === 'attack' && liveOpps.length > 1 && attackTarget === o.id}
              onClick={() => clickPlayer(o.id)}
              deckName={decks[o.id].name}
            >
              <div className="opp-hand" aria-label={`${o.name} has ${o.hand.length} cards in hand`}>
                {o.hand.slice(0, 10).map((c) => (
                  <div key={c.iid} className="mini-back">
                    <CardBack />
                  </div>
                ))}
              </div>
            </PlayerBar>
            {o.lost ? (
              <div className="out-note">Out of the game — {ordinal(o.place ?? 0)} place</div>
            ) : (
              <Battlefield game={g} id={o.id} permProps={permProps} />
            )}
          </div>
        ))}
      </div>

      <div className="midbar">
        <div className="phase-track" aria-label="Turn phases">
          <span className={`whose ${myTurn ? 'you' : `opp seat-${g.active}`}`}>{g.winner !== null ? 'Game over' : myTurn ? `Your turn` : `${g.players[g.active].name}’s turn`}</span>
          {PHASES.map((ph) => (
            <span key={ph.id} className={`phase ${g.phase === ph.id ? 'on' : ''}`}>
              {ph.label}
            </span>
          ))}
          <span className="muted small">round {g.round}</span>
        </div>
        <div className="prompt" role="status">{prompt}</div>
        <div className="actions">
          {pending && (
            <>
              {pending.k === 'target' && currentSlot && !currentSlot.required && (
                <button type="button" onClick={() => choose(null)}>Skip</button>
              )}
              <button type="button" onClick={() => setPending(null)}>Cancel</button>
            </>
          )}
          {actions.map((a) => (
            <button key={a.label} type="button" className={a.primary ? 'primary' : ''} disabled={a.disabled} title={a.title} onClick={a.run}>
              {a.label}
            </button>
          ))}
        </div>
        {defending && Object.values(blocks).some((b) => b.length) && (
          <div className="block-summary" aria-label="Your blocks">
            {Object.entries(blocks).flatMap(([a, bs]) =>
              bs.map((b) => (
                <button
                  key={`${a}-${b}`}
                  type="button"
                  className="block-chip"
                  title="Click to remove this block"
                  onClick={() => setBlocks((cur) => ({ ...cur, [+a]: cur[+a].filter((x) => x !== b) }))}
                >
                  🛡 {g.perm(b)?.card.name} <span className="muted">blocks</span> ⚔ {g.perm(+a)?.card.name} <span className="x">✕</span>
                </button>
              )),
            )}
          </div>
        )}
        <div className="recent-log" onClick={() => setShowLog(true)} title="Click for the full game log">
          {recent.map((l, i) => (
            <div key={`${g.log.length}-${i}`} className={`log-line who-${l.who ?? 'n'}`}>{l.text}</div>
          ))}
        </div>
      </div>

      <Battlefield game={g} id={YOU} permProps={permProps} />
      <PlayerBar game={g} id={YOU} targetable={!!currentSlot && isLegal({ kind: 'player', id: YOU })} onClick={() => clickPlayer(YOU)} deckName={decks[0].name}>
        <div className="speed">
          <span className="muted small">AI speed</span>
          {(Object.keys(SPEEDS) as (keyof typeof SPEEDS)[]).map((s) => (
            <button key={s} type="button" className={`pill ${speed === s ? 'on' : ''}`} onClick={() => setSpeed(s)}>
              {s}
            </button>
          ))}
          <button type="button" className="pill" onClick={onHelp}>?</button>
        </div>
      </PlayerBar>
      <div className="hand" aria-label="Your hand">
        {hand.map((c) => {
          const playable = canAct && !pending && g.whyNotCast(YOU, c.iid) === null;
          return (
            <button
              key={c.iid}
              type="button"
              className={`hand-card ${playable ? 'playable' : ''}`}
              onClick={() => clickHand(c)}
              onContextMenu={(e) => {
                e.preventDefault();
                openVersions(c.card);
              }}
              onMouseEnter={() => hover({ card: c.card })}
              aria-label={`${c.card.name}${playable ? ' (playable)' : ''}`}
            >
              <CardFace card={c.card} />
              {!c.card.supertypes.includes('Basic') && <GradeBadge card={c.card} />}
            </button>
          );
        })}
        {!hand.length && <div className="muted small empty-hand">Your hand is empty.</div>}
      </div>

      {pending?.k === 'mode' && (
        <Modal title="Choose one" onClose={() => setPending(null)}>
          {abilitiesOf(hand.find((c) => c.iid === pending.iid)!.card).modes.map((m, i) => {
            const c = hand.find((x) => x.iid === pending.iid)!;
            const slots = g.castSlots(c.card, i);
            const ok = slots.every((s) => !s.required || g.legalTargets(YOU, s.spec).length > 0);
            return (
              <button key={i} type="button" className="mode-option" disabled={!ok} onClick={() => castWithMode(pending.iid, i)}>
                {m.map(describeEffect).join(', ')}
              </button>
            );
          })}
        </Modal>
      )}
      {pending?.k === 'abilities' && (() => {
        const p = g.perm(pending.iid);
        if (!p) return null;
        return (
          <Modal title={p.card.name} onClose={() => setPending(null)}>
            {g.usableAbilities(YOU, p.iid).map((i) => (
              <button key={i} type="button" className="mode-option" onClick={() => activate(p, i)}>
                {g.ab(p).activated[i].text}
              </button>
            ))}
            {g.canEquip(YOU, p.iid) && (
              <button type="button" className="mode-option" onClick={() => setPending({ k: 'equip', iid: p.iid })}>
                Equip <ManaCost cost={costText(g.ab(p).attach!.equip!)} size={13} />
              </button>
            )}
          </Modal>
        );
      })()}
      {showLog && (
        <Modal title="Game log" onClose={() => setShowLog(false)} wide>
          <div className="full-log">
            {g.log.map((l, i) => (
              <div key={i} className={`log-line who-${l.who ?? 'n'}`}>
                {l.text}
              </div>
            ))}
          </div>
        </Modal>
      )}
      {(g.winner !== null || me.lost) && !hideOver && (
        <div className="game-over">
          <div className="game-over-card">
            <h2>{g.winner === YOU ? 'Victory!' : g.winner === 'draw' ? 'Draw' : me.lost ? 'Defeat' : 'Game over'}</h2>
            <p className="muted">
              {g.winner === YOU
                ? opps.length > 1 ? `You outlasted all ${opps.length} opponents.` : 'You win!'
                : me.lost
                  ? `You finished ${ordinal(me.place ?? 0)} of ${g.players.length}.${g.winner === null ? ` ${liveOpps.length} computer players are still fighting.` : g.winner !== 'draw' ? ` ${g.players[g.winner].name} wins.` : ''}`
                  : g.log[g.log.length - 1]?.text}
            </p>
            <div className="actions">
              <button type="button" className="primary" onClick={onRematch}>Rematch (same decks)</button>
              <button type="button" onClick={onNewDecks}>New decks</button>
              <button type="button" onClick={() => setShowLog(true)}>Game log</button>
              <button type="button" onClick={() => setHideOver(true)}>{g.winner === null ? 'Watch the rest' : 'View board'}</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="toast" role="alert">{toast}</div>}
    </div>
  );
}

function costText(c: { generic: number; pips: string[][] }) {
  return `${c.generic ? `{${c.generic}}` : ''}${c.pips.map((p) => `{${p.join('/')}}`).join('')}` || '{0}';
}

function liveInfo(g: Game, p: Perm): Hovered {
  const notes: string[] = [];
  if (p.counters) notes.push(`+${p.counters}/+${p.counters} counters`);
  for (const [name, n] of Object.entries(p.named)) if (n) notes.push(`${n} ${name} counter${n > 1 ? 's' : ''}`);
  if (p.damage) notes.push(`${p.damage} damage`);
  if (g.isSick(p)) notes.push('summoning sick');
  if (p.tapped) notes.push('tapped');
  if (p.attachedTo !== null) notes.push(`attached to ${g.perm(p.attachedTo)?.card.name}`);
  if (p.token) notes.push('token');
  return { card: p.card, live: { power: g.power(p), toughness: g.toughness(p), keywords: [...g.keywords(p)], notes } };
}

function PlayerBar({ game: g, id, targetable, attackTarget, onClick, deckName, children }: { game: Game; id: PlayerId; targetable: boolean; attackTarget?: boolean; onClick: () => void; deckName: string; children?: ReactNode }) {
  const p = g.players[id];
  return (
    <div className={`player-bar ${id === YOU ? 'you' : `opp seat-${id}`} ${g.active === id ? 'active' : ''}`}>
      <button type="button" className={`life ${targetable ? 'targetable' : ''} ${attackTarget ? 'attack-target' : ''}`} onClick={onClick} aria-label={`${p.name}: ${p.life} life`}>
        <span key={p.life} className="life-num">{p.life}</span>
        <span className="life-label">{p.name}</span>
      </button>
      {p.protected && (
        <span className="chip prot" title="Protection from everything until their next turn: no damage, can't be targeted by opponents">
          🛡 Protected
        </span>
      )}
      <span className="muted small deck-name" title={deckName}>{deckName}</span>
      <span className="zone" title="Cards left in library">📚 {p.library.length}</span>
      <span className="zone" title="Cards in hand">✋ {p.hand.length}</span>
      <span className="zone" title={p.graveyard.map((c) => c.card.name).join(', ') || 'Empty'}>🪦 {p.graveyard.length}</span>
      <ManaPool game={g} id={id} />
      {children}
    </div>
  );
}

function ManaPool({ game: g, id }: { game: Game; id: PlayerId }) {
  const sources = g.manaSources(id);
  const counts = new Map<string, number>();
  for (const s of sources) {
    const k = s.options.length > 1 ? (s.options.length === 5 ? 'any' : s.options.join('/')) : s.options[0];
    counts.set(k, (counts.get(k) ?? 0) + s.amount);
  }
  return (
    <span className="mana-pool" title="Untapped mana available">
      {[...counts.entries()].map(([k, n]) => (
        <span key={k} className="mana-count">
          {k === 'any' ? '✦' : <ManaCost cost={`{${k}}`} size={15} />}×{n}
        </span>
      ))}
      {!counts.size && <span className="muted small">no mana</span>}
    </span>
  );
}

interface PermProps {
  perm: Perm;
  game: Game;
  targetable: boolean;
  selected: boolean;
  canBlock: boolean;
  drag?: { draggable: boolean; onDragStart: (e: DragEvent) => void; onDragOver?: (e: DragEvent) => void; onDrop?: (e: DragEvent) => void };
  attackLabel: string;
  attacking: boolean;
  atYou: boolean;
  attackNo: number;
  blockingNo: number;
  onClick: () => void;
  onHover: () => void;
}

function Battlefield({ game: g, id, permProps }: { game: Game; id: PlayerId; permProps: (p: Perm) => PermProps }) {
  const perms = g.players[id].battlefield;
  const lands = perms.filter((p) => p.card.types.includes('Land') && !g.isCreature(p));
  const others = perms.filter((p) => !lands.includes(p));
  const creatures = others.filter((p) => g.isCreature(p));
  const support = others.filter((p) => !g.isCreature(p));
  const landRow = (
    <div className="land-row">
      {groupLands(lands).map(([card, ps]) => (
        <LandStack key={card.name} card={card} perms={ps} permProps={permProps} />
      ))}
    </div>
  );
  return (
    <div className={`battlefield ${id === YOU ? 'you' : 'opp'}`}>
      {landRow}
      <div className="perm-row">
        {creatures.map((p) => (
          <PermView key={p.iid} {...permProps(p)} />
        ))}
        {support.length > 0 && <div className="perm-divider" />}
        {support.map((p) => (
          <PermView key={p.iid} {...permProps(p)} />
        ))}
        {!others.length && <div className="muted small empty-row">{id === YOU ? 'Your creatures will appear here.' : ''}</div>}
      </div>
    </div>
  );
}

function groupLands(lands: Perm[]): [Card, Perm[]][] {
  const m = new Map<string, Perm[]>();
  for (const l of lands) m.set(l.card.name, [...(m.get(l.card.name) ?? []), l]);
  return [...m.values()].map((ps) => [ps[0].card, ps]);
}

function LandStack({ card, perms, permProps }: { card: Card; perms: Perm[]; permProps: (p: Perm) => PermProps }) {
  const untapped = perms.filter((p) => !p.tapped).length;
  const first = permProps(perms[0]);
  const targetable = perms.map(permProps).find((x) => x.targetable);
  return (
    <button
      type="button"
      className={`land-stack ${untapped === 0 ? 'all-tapped' : ''} ${targetable ? 'targetable' : ''}`}
      onMouseEnter={first.onHover}
      onClick={() => (targetable ?? first).onClick()}
      aria-label={`${card.name}: ${untapped} of ${perms.length} untapped`}
    >
      <CardFace card={card} />
      <span className="land-count">
        {untapped}/{perms.length}
      </span>
    </button>
  );
}

function PermView(props: PermProps) {
  const { openVersions } = useArtSettings();
  return <PermViewInner {...props} openVersions={openVersions} />;
}

function PermViewInner({ openVersions, perm: p, game: g, targetable, selected, canBlock, drag, attackLabel, attacking, atYou, attackNo, blockingNo, onClick, onHover }: PermProps & { openVersions: (c: Card) => void }) {
  const creature = g.isCreature(p);
  const power = creature ? g.power(p) : 0;
  const toughness = creature ? g.toughness(p) : 0;
  const changed = creature && (power !== p.card.power || toughness !== p.card.toughness);
  const host = p.attachedTo !== null ? g.perm(p.attachedTo) : null;
  const sick = g.isSick(p) && g.active === p.controller;
  const kws = creature ? [...g.keywords(p)].filter((k) => !['Prowess', 'Flash'].includes(k)) : [];
  return (
    <button
      type="button"
      className={['perm', p.tapped ? 'tapped' : '', targetable ? 'targetable' : '', selected ? 'selected' : '', canBlock ? 'can-block' : '', attacking ? 'attacking' : '', atYou ? 'at-you' : '', blockingNo ? 'blocking' : ''].join(' ')}
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        openVersions(p.card);
      }}
      draggable={drag?.draggable}
      onDragStart={drag?.onDragStart}
      onDragOver={drag?.onDragOver}
      onDrop={drag?.onDrop}
      onMouseEnter={onHover}
      aria-label={`${p.card.name}${creature ? ` ${power}/${toughness}` : ''}${p.tapped ? ', tapped' : ''}`}
    >
      <div className="perm-card">
        <CardFace card={p.card} />
      </div>
      {creature && (
        <span className={`pt ${changed ? (power + toughness > (p.card.power ?? 0) + (p.card.toughness ?? 0) ? 'up' : 'down') : ''}`}>
          {power}/{toughness - p.damage}
        </span>
      )}
      {p.damage > 0 && <span className="dmg">−{p.damage}</span>}
      {p.counters > 0 && <span className="ctr">+{p.counters}</span>}
      {Object.entries(p.named).filter(([, n]) => n > 0).map(([name, n]) => (
        <span key={name} className="named-ctr" title={`${n} ${name} counter${n > 1 ? 's' : ''}`}>
          {n} {name}
        </span>
      ))}
      {sick && <span className="sick" title="Summoning sick: can’t attack or tap this turn">zzz</span>}
      {attackNo > 0 && <span className="badge atk">⚔{attackNo}</span>}
      {blockingNo > 0 && <span className="badge blk">🛡{blockingNo}</span>}
      {host && <span className="attached" title={`Attached to ${host.card.name}`}>↳ {host.card.name}</span>}
      {!host && attackLabel && <span className="attached attack-at">{attackLabel}</span>}
      {kws.length > 0 && <span className="kw-strip">{kws.map(kwIcon).join('')}</span>}
    </button>
  );
}

const KW_ICON: Record<string, string> = {
  Flying: '🪽', Reach: '🏹', Haste: '⚡', Vigilance: '👁', Trample: '🦶', Lifelink: '❤', Deathtouch: '☠', 'First strike': '⚔', 'Double strike': '⚔⚔',
  Defender: '🧱', Menace: '😈', Indestructible: '💎', Hexproof: '🛡', Shroud: '🌫', Unblockable: '👻',
};
const kwIcon = (k: string) => KW_ICON[k] ?? '';

function Modal({ title, children, onClose, wide }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal ${wide ? 'wide' : ''}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
